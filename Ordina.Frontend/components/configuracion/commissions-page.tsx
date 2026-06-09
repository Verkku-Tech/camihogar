"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Save, RefreshCcw, Users, ShoppingBag, ArrowLeftRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getCategories,
  type Category,
  batchUpsertProductCommissions,
  batchUpsertSaleTypeCommissionRules,
  seedDefaultSaleTypeRules,
  ensureSaleTypeRulesComplete,
  type SaleTypeCommissionRule,
  type ProductCommission,
  getUsers,
  type User,
  type CommissionExclusivityMode,
  COMMISSION_EXCLUSIVITY_MODES,
  normalizeCommissionExclusivityMode,
  FAMILY_COMMISSION_USD_TIERS,
} from "@/lib/storage";
import { apiClient, type SaleTypeCommissionCompletenessDto } from "@/lib/api-client";
import {
  EXPECTED_SALE_TYPE_RULE_COUNT,
  familiesForTier,
  familiesWithNonStandardTier,
  groupRulesBySaleType,
  rulesNeedAttention,
  tierEquals,
  validateDistributionUsd,
} from "@/lib/commission-distribution-ui";

/** Alinea espacios y mayúsculas al cruzar catálogo con comisiones del API. */
function normalizeCategoryKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

type EditedRule = { vendorRate: number; referrerRate: number; postventaRate: number };

function ruleRowKey(rule: Pick<SaleTypeCommissionRule, "saleType" | "familyCommissionUsdPerUnit">): string {
  return `${rule.saleType}:${rule.familyCommissionUsdPerUnit}`;
}

export function CommissionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCommissionValues, setCategoryCommissionValues] = useState<Record<string, number>>({});

  const [saleTypeRules, setSaleTypeRules] = useState<SaleTypeCommissionRule[]>([]);
  const [productCommissions, setProductCommissions] = useState<ProductCommission[]>([]);
  const [rulesCompleteness, setRulesCompleteness] =
    useState<SaleTypeCommissionCompletenessDto | null>(null);
  const [editedRules, setEditedRules] = useState<Record<string, EditedRule>>({});

  const [users, setUsers] = useState<User[]>([]);
  const [exclusivityModes, setExclusivityModes] = useState<
    Map<string, CommissionExclusivityMode>
  >(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsApiError, setSettingsApiError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setSettingsApiError(null);
    const errors: string[] = [];

    try {
      const loadedCategories = await getCategories();
      let loadedProductCommissions: Awaited<ReturnType<typeof apiClient.getProductCommissions>> = [];
      try {
        loadedProductCommissions = await apiClient.getProductCommissions();
      } catch (e) {
        console.error(e);
        errors.push("No se pudieron cargar las comisiones por familia desde el servidor.");
      }

      setProductCommissions(loadedProductCommissions);

      let loadedRules: SaleTypeCommissionRule[] = [];
      try {
        loadedRules = await apiClient.getSaleTypeCommissionRules();
        try {
          setRulesCompleteness(await apiClient.getSaleTypeRulesCompleteness());
        } catch {
          setRulesCompleteness(null);
        }
      } catch (e) {
        console.error(e);
        errors.push("No se pudieron cargar las reglas de distribución desde el servidor.");
      }

      const loadedUsers = await getUsers();

      setCategories(loadedCategories);
      const sortedRules = [...loadedRules].sort((a, b) => {
        const cmp = a.saleType.localeCompare(b.saleType);
        if (cmp !== 0) return cmp;
        return (a.familyCommissionUsdPerUnit ?? 0) - (b.familyCommissionUsdPerUnit ?? 0);
      });
      setSaleTypeRules(sortedRules);
      setUsers(loadedUsers.filter((u) => u.status === "active"));

      if (errors.length) {
        setSettingsApiError(errors.join(" "));
      }

      const commissionValues: Record<string, number> = {};
      loadedCategories.forEach((category) => {
        const existingCommission = loadedProductCommissions.find(
          (pc) =>
            (category.backendId && pc.categoryId === category.backendId) ||
            normalizeCategoryKey(pc.categoryName ?? "") === normalizeCategoryKey(category.name)
        );
        commissionValues[category.name] = existingCommission?.commissionValue || 0;
      });
      setCategoryCommissionValues(commissionValues);

      const rulesMap: Record<string, EditedRule> = {};
      sortedRules.forEach((rule) => {
        rulesMap[ruleRowKey(rule)] = {
          vendorRate: rule.vendorRate,
          referrerRate: rule.referrerRate,
          postventaRate: rule.postventaRate ?? 0,
        };
      });
      setEditedRules(rulesMap);

      const modesMap = new Map<string, CommissionExclusivityMode>();
      loadedUsers.forEach((user) => {
        modesMap.set(
          user.id,
          normalizeCommissionExclusivityMode(
            user.commissionExclusivityMode,
            user.exclusiveCommission,
          ),
        );
      });
      setExclusivityModes(modesMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryCommissionChange = (categoryName: string, value: number) => {
    setCategoryCommissionValues((prev) => ({
      ...prev,
      [categoryName]: value,
    }));
  };

  const handleSaveProductCommissions = async () => {
    setIsSaving(true);
    try {
      const commissionsToSave = categories.map((category) => {
        const fromBackend = (category.backendId || "").trim();
        const fromId = String(category.id ?? "").trim();
        const nameNorm = category.name.replace(/\s+/g, " ").trim();
        const categoryId = fromBackend || fromId || nameNorm;
        return {
          categoryId,
          categoryName: nameNorm,
          commissionValue: Math.max(0, categoryCommissionValues[category.name] ?? 0),
        };
      });

      await batchUpsertProductCommissions(commissionsToSave);
      toast.success("Comisiones por categoría guardadas exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error saving product commissions:", error);
      toast.error("Error al guardar las comisiones");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRuleChange = (rowKey: string, field: keyof EditedRule, value: number) => {
    setEditedRules((prev) => ({
      ...prev,
      [rowKey]: {
        vendorRate: prev[rowKey]?.vendorRate ?? 0,
        referrerRate: prev[rowKey]?.referrerRate ?? 0,
        postventaRate: prev[rowKey]?.postventaRate ?? 0,
        [field]: value,
      },
    }));
  };

  const handleSaveSaleTypeRules = async () => {
    setIsSaving(true);
    try {
      for (const rule of saleTypeRules) {
        if (rule.familyCommissionUsdPerUnit === 0) continue;
        const key = ruleRowKey(rule);
        const v = editedRules[key]?.vendorRate ?? rule.vendorRate;
        const r = editedRules[key]?.referrerRate ?? rule.referrerRate;
        const p = editedRules[key]?.postventaRate ?? rule.postventaRate ?? 0;
        const err = validateDistributionUsd(v, r, p);
        if (err) {
          toast.error(`${rule.saleTypeLabel} · ${rule.familyCommissionUsdPerUnit} USD/u: ${err}`);
          setIsSaving(false);
          return;
        }
        const tierOk = FAMILY_COMMISSION_USD_TIERS.some((t) =>
          tierEquals(t, rule.familyCommissionUsdPerUnit),
        );
        if (!tierOk) {
          toast.error(
            `Tier inválido en ${rule.saleTypeLabel}: debe ser 2.5, 5 o 7.5 USD/u familia`,
          );
          setIsSaving(false);
          return;
        }
      }

      const rulesToSave = saleTypeRules
        .filter((rule) => rule.familyCommissionUsdPerUnit > 0)
        .map((rule) => {
        const key = ruleRowKey(rule);
        return {
          saleType: rule.saleType,
          saleTypeLabel: rule.saleTypeLabel,
          familyCommissionUsdPerUnit: rule.familyCommissionUsdPerUnit,
          vendorRate: editedRules[key]?.vendorRate ?? rule.vendorRate,
          referrerRate: editedRules[key]?.referrerRate ?? rule.referrerRate,
          postventaRate: editedRules[key]?.postventaRate ?? rule.postventaRate ?? 0,
        };
      });

      await batchUpsertSaleTypeCommissionRules(rulesToSave);
      toast.success("Reglas de distribución guardadas exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error saving sale type rules:", error);
      toast.error("Error al guardar las reglas");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedDefaultRules = async (force: boolean) => {
    setIsSaving(true);
    try {
      await seedDefaultSaleTypeRules(force);
      toast.success(
        force
          ? "Reglas restauradas a valores por defecto"
          : "Reglas por defecto cargadas (solo si no había reglas previas)"
      );
      await loadData();
    } catch (error) {
      console.error("Error seeding default rules:", error);
      toast.error("Error al cargar reglas por defecto");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaultsClick = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Sobrescribir todas las reglas de distribución con los valores por defecto? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    void handleSeedDefaultRules(true);
  };

  const handleEnsureCompleteRules = async () => {
    setIsSaving(true);
    try {
      const { inserted } = await ensureSaleTypeRulesComplete();
      toast.success(
        inserted > 0
          ? `Se agregaron ${inserted} reglas faltantes`
          : "Las reglas ya estaban completas",
      );
      await loadData();
    } catch (error) {
      console.error("Error completing rules:", error);
      toast.error("Error al completar reglas");
    } finally {
      setIsSaving(false);
    }
  };

  const ruleGroups = useMemo(
    () => groupRulesBySaleType(saleTypeRules),
    [saleTypeRules],
  );

  const nonStandardFamilies = useMemo(
    () => familiesWithNonStandardTier(productCommissions),
    [productCommissions],
  );

  const distributionNeedsAttention = rulesNeedAttention(saleTypeRules);

  const exclusivityModeLabels: Record<CommissionExclusivityMode, string> = {
    [COMMISSION_EXCLUSIVITY_MODES.Shared]: "Comparte",
    [COMMISSION_EXCLUSIVITY_MODES.Exclusive]: "Exclusivo",
    [COMMISSION_EXCLUSIVITY_MODES.ExclusiveWithReferrer]:
      "Exclusivo (comparte con referido)",
  };

  const handleModeChange = async (
    userId: string,
    mode: CommissionExclusivityMode,
  ) => {
    try {
      await apiClient.updateUser(userId, { commissionExclusivityMode: mode });

      setExclusivityModes((prev) => {
        const next = new Map(prev);
        next.set(userId, mode);
        return next;
      });

      toast.success(`Modo de comisión actualizado: ${exclusivityModeLabels[mode]}`);
    } catch (error) {
      console.error("Error updating user commission exclusivity mode:", error);
      toast.error("Error al actualizar el modo de comisión del vendedor");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración de Comisiones</h1>
        <p className="text-muted-foreground">
          Gestiona las comisiones por familia de productos y reglas de distribución
        </p>
      </div>

      {settingsApiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{settingsApiError}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-3">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Por Familia de Producto
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            Distribución por Tipo de Venta
          </TabsTrigger>
          <TabsTrigger value="exclusive" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Vendedores Exclusivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Comisiones por Familia de Producto
              </CardTitle>
              <CardDescription>
                Monto en dólares (USD) por unidad vendida de cada familia. 0 = sin comisión (no aparece en el reporte).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay categorías configuradas</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría/Familia</TableHead>
                        <TableHead>Productos</TableHead>
                        <TableHead className="w-48">Comisión (USD / unidad)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{category.products} productos</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              className="w-32"
                              value={
                                categoryCommissionValues[category.name] === 0
                                  ? ""
                                  : categoryCommissionValues[category.name] ?? ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") {
                                  handleCategoryCommissionChange(category.name, 0);
                                  return;
                                }
                                const n = Number.parseFloat(v);
                                handleCategoryCommissionChange(
                                  category.name,
                                  Number.isFinite(n) ? n : 0
                                );
                              }}
                              placeholder="0"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleSaveProductCommissions} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Distribución de Comisiones por Tipo de Venta
              </CardTitle>
              <CardDescription>
                Por cada tipo de venta hay tres filas según el nivel de comisión familia del producto (2.5, 5 o
                7.5 USD/u). Los montos de vendedor, post venta y referido son USD fijos por unidad vendida en
                ventas compartidas (pueden diferir del monto familia). La columna &quot;Familias&quot; muestra qué
                categorías usan cada nivel (pestaña anterior).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionNeedsAttention && (
                <Alert className="mb-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>
                      Faltan reglas o hay datos legacy (
                      {saleTypeRules.length}/{EXPECTED_SALE_TYPE_RULE_COUNT} esperadas).
                      {rulesCompleteness?.hasLegacyTierZero &&
                        " Existen filas con USD/u familia = 0."}
                    </p>
                    {rulesCompleteness && rulesCompleteness.missingDescriptions.length > 0 && (
                      <ul className="list-disc pl-5 text-sm">
                        {rulesCompleteness.missingDescriptions.slice(0, 5).map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                        {rulesCompleteness.missingDescriptions.length > 5 && (
                          <li>…y {rulesCompleteness.missingDescriptions.length - 5} más</li>
                        )}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleEnsureCompleteRules()}
                        disabled={isSaving}
                      >
                        Completar reglas faltantes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSeedDefaultRules(false)}
                        disabled={isSaving}
                      >
                        Cargar por defecto
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {nonStandardFamilies.length > 0 && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Familias con comisión distinta de 2.5, 5 o 7.5 USD/u usan el tier 2.5 en el reporte:{" "}
                    {nonStandardFamilies.join("; ")}
                  </AlertDescription>
                </Alert>
              )}

              {saleTypeRules.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No hay reglas configuradas</p>
                  <Button onClick={() => void handleSeedDefaultRules(false)} disabled={isSaving}>
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Cargar Reglas por Defecto
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de Venta</TableHead>
                        <TableHead className="text-center">Comisión familia (USD/u)</TableHead>
                        <TableHead>Familias que aplican</TableHead>
                        <TableHead className="text-center">Vendedor tienda (USD/u)</TableHead>
                        <TableHead className="text-center">Post venta (USD/u)</TableHead>
                        <TableHead className="text-center">Referido online (USD/u)</TableHead>
                        <TableHead className="text-center">Total USD/u</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ruleGroups.map((group) =>
                        group.rules.map((rule, rowIndex) => {
                          const rk = ruleRowKey(rule);
                          const vendorUsd = editedRules[rk]?.vendorRate ?? rule.vendorRate;
                          const referrerUsd =
                            editedRules[rk]?.referrerRate ?? rule.referrerRate;
                          const postventaUsd =
                            editedRules[rk]?.postventaRate ?? rule.postventaRate ?? 0;
                          const totalUsd = vendorUsd + referrerUsd + postventaUsd;
                          const tier = rule.familyCommissionUsdPerUnit;
                          const families = familiesForTier(productCommissions, tier);
                          const totalDiffersFromTier = !tierEquals(totalUsd, tier);

                          return (
                            <TableRow key={rule.id}>
                              {rowIndex === 0 && (
                                <TableCell
                                  className="font-medium align-top"
                                  rowSpan={group.rules.length}
                                >
                                  {group.saleTypeLabel}
                                </TableCell>
                              )}
                              <TableCell className="text-center tabular-nums font-medium">
                                {tier}
                              </TableCell>
                              <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                                {families.length > 0 ? (
                                  <span className="line-clamp-3" title={families.join(", ")}>
                                    {families.join(", ")}
                                  </span>
                                ) : (
                                  <span className="italic">Ninguna familia con este monto</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="20"
                                  className="w-20 mx-auto text-center"
                                  value={vendorUsd}
                                  onChange={(e) =>
                                    handleRuleChange(
                                      rk,
                                      "vendorRate",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="20"
                                  className="w-20 mx-auto text-center"
                                  value={postventaUsd}
                                  onChange={(e) =>
                                    handleRuleChange(
                                      rk,
                                      "postventaRate",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="20"
                                  className="w-20 mx-auto text-center"
                                  value={referrerUsd}
                                  onChange={(e) =>
                                    handleRuleChange(
                                      rk,
                                      "referrerRate",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={totalDiffersFromTier ? "secondary" : "default"}
                                  title={
                                    totalDiffersFromTier
                                      ? `Total reparto (${totalUsd}) distinto del tier familia (${tier})`
                                      : undefined
                                  }
                                >
                                  {totalUsd}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        }),
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={handleRestoreDefaultsClick} disabled={isSaving}>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Restaurar Valores por Defecto
                    </Button>
                    <Button onClick={handleSaveSaleTypeRules} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exclusive">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Vendedores con Comisión Exclusiva
              </CardTitle>
              <CardDescription>
                Define si el vendedor comparte comisión, es exclusivo o exclusivo solo con referido
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.filter((u) => u.role === "Store Seller" || u.role === "Online Seller").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay vendedores registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-center">Modo de comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((u) => u.role === "Store Seller" || u.role === "Online Seller")
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {user.role === "Store Seller" ? "Vendedor de Tienda" : "Vendedor Online"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Select
                              value={
                                exclusivityModes.get(user.id) ??
                                COMMISSION_EXCLUSIVITY_MODES.Shared
                              }
                              onValueChange={(value) =>
                                handleModeChange(
                                  user.id,
                                  value as CommissionExclusivityMode,
                                )
                              }
                            >
                              <SelectTrigger className="w-[240px] mx-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={COMMISSION_EXCLUSIVITY_MODES.Shared}>
                                  Comparte
                                </SelectItem>
                                <SelectItem value={COMMISSION_EXCLUSIVITY_MODES.Exclusive}>
                                  Exclusivo
                                </SelectItem>
                                <SelectItem
                                  value={COMMISSION_EXCLUSIVITY_MODES.ExclusiveWithReferrer}
                                >
                                  Exclusivo (comparte con referido)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Exclusivo recibe el 100% sin compartir. Exclusivo (comparte con referido) reparte
                  solo con el referido según vendorRate y referrerRate de las reglas de tipo de venta; post venta no aplica.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
