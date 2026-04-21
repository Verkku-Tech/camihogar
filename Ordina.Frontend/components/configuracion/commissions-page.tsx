"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Save, RefreshCcw, Users, ShoppingBag, ArrowLeftRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getCategories,
  type Category,
  batchUpsertProductCommissions,
  batchUpsertSaleTypeCommissionRules,
  seedDefaultSaleTypeRules,
  type SaleTypeCommissionRule,
  getUsers,
  type User,
} from "@/lib/storage";
import { apiClient } from "@/lib/api-client";

type EditedRule = { vendorRate: number; referrerRate: number; postventaRate: number };

export function CommissionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCommissionValues, setCategoryCommissionValues] = useState<Record<string, number>>({});

  const [saleTypeRules, setSaleTypeRules] = useState<SaleTypeCommissionRule[]>([]);
  const [editedRules, setEditedRules] = useState<Record<string, EditedRule>>({});

  const [users, setUsers] = useState<User[]>([]);
  const [exclusiveUsers, setExclusiveUsers] = useState<Set<string>>(new Set());

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

      let loadedRules: SaleTypeCommissionRule[] = [];
      try {
        loadedRules = await apiClient.getSaleTypeCommissionRules();
      } catch (e) {
        console.error(e);
        errors.push("No se pudieron cargar las reglas de distribución desde el servidor.");
      }

      const loadedUsers = await getUsers();

      setCategories(loadedCategories);
      setSaleTypeRules(loadedRules);
      setUsers(loadedUsers.filter((u) => u.status === "active"));

      if (errors.length) {
        setSettingsApiError(errors.join(" "));
      }

      const commissionValues: Record<string, number> = {};
      loadedCategories.forEach((category) => {
        const existingCommission = loadedProductCommissions.find(
          (pc) =>
            (category.backendId && pc.categoryId === category.backendId) ||
            pc.categoryName?.trim().toLowerCase() === category.name.trim().toLowerCase()
        );
        commissionValues[category.name] = existingCommission?.commissionValue || 0;
      });
      setCategoryCommissionValues(commissionValues);

      const rulesMap: Record<string, EditedRule> = {};
      loadedRules.forEach((rule) => {
        rulesMap[rule.saleType] = {
          vendorRate: rule.vendorRate,
          referrerRate: rule.referrerRate,
          postventaRate: rule.postventaRate ?? 0,
        };
      });
      setEditedRules(rulesMap);

      const exclusiveSet = new Set<string>();
      loadedUsers.forEach((user) => {
        if (user.exclusiveCommission) {
          exclusiveSet.add(user.id);
        }
      });
      setExclusiveUsers(exclusiveSet);
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
        const categoryId = fromBackend || fromId || category.name.trim();
        return {
          categoryId,
          categoryName: category.name,
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

  const handleRuleChange = (
    saleType: string,
    field: keyof EditedRule,
    value: number
  ) => {
    setEditedRules((prev) => ({
      ...prev,
      [saleType]: {
        vendorRate: prev[saleType]?.vendorRate ?? 0,
        referrerRate: prev[saleType]?.referrerRate ?? 0,
        postventaRate: prev[saleType]?.postventaRate ?? 0,
        [field]: value,
      },
    }));
  };

  const handleSaveSaleTypeRules = async () => {
    setIsSaving(true);
    try {
      const rulesToSave = saleTypeRules.map((rule) => ({
        saleType: rule.saleType,
        saleTypeLabel: rule.saleTypeLabel,
        vendorRate: editedRules[rule.saleType]?.vendorRate ?? rule.vendorRate,
        referrerRate: editedRules[rule.saleType]?.referrerRate ?? rule.referrerRate,
        postventaRate: editedRules[rule.saleType]?.postventaRate ?? rule.postventaRate ?? 0,
      }));

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

  const handleExclusiveToggle = async (userId: string, exclusive: boolean) => {
    try {
      await apiClient.updateUser(userId, { exclusiveCommission: exclusive });

      setExclusiveUsers((prev) => {
        const newSet = new Set(prev);
        if (exclusive) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });

      toast.success(`Comisión exclusiva ${exclusive ? "activada" : "desactivada"}`);
    } catch (error) {
      console.error("Error updating user exclusive status:", error);
      toast.error("Error al actualizar el estado del vendedor");
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
                Cada porcentaje se aplica sobre la comisión en USD de la familia del producto (no sobre el precio del
                pedido). ENCARGO y Sistema de Apartado incluyen reparto a post venta. Use &quot;Restaurar&quot; solo si
                desea reemplazar todas las reglas por los valores estándar.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                        <TableHead className="text-center">Vendedor tienda (% comisión familia)</TableHead>
                        <TableHead className="text-center">Post venta (% comisión familia)</TableHead>
                        <TableHead className="text-center">Referido online (% comisión familia)</TableHead>
                        <TableHead className="text-center">Suma %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleTypeRules.map((rule) => {
                        const vendorRate = editedRules[rule.saleType]?.vendorRate ?? rule.vendorRate;
                        const referrerRate = editedRules[rule.saleType]?.referrerRate ?? rule.referrerRate;
                        const postventaRate =
                          editedRules[rule.saleType]?.postventaRate ?? rule.postventaRate ?? 0;
                        const total = vendorRate + referrerRate + postventaRate;

                        return (
                          <TableRow key={rule.saleType}>
                            <TableCell className="font-medium">{rule.saleTypeLabel}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                className="w-20 mx-auto text-center"
                                value={vendorRate}
                                onChange={(e) =>
                                  handleRuleChange(
                                    rule.saleType,
                                    "vendorRate",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                className="w-20 mx-auto text-center"
                                value={postventaRate}
                                onChange={(e) =>
                                  handleRuleChange(
                                    rule.saleType,
                                    "postventaRate",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                className="w-20 mx-auto text-center"
                                value={referrerRate}
                                onChange={(e) =>
                                  handleRuleChange(
                                    rule.saleType,
                                    "referrerRate",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={total > 0 ? "default" : "secondary"}>{total}%</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                Vendedores que administran completo a sus clientes y NO comparten comisión con referidos/postventa
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
                      <TableHead className="text-center">Comisión Exclusiva</TableHead>
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
                            <Switch
                              checked={exclusiveUsers.has(user.id)}
                              onCheckedChange={(checked) => handleExclusiveToggle(user.id, checked)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Los vendedores con comisión exclusiva recibirán el 100% de la comisión de sus
                  ventas, incluso cuando haya un referido asociado. La comisión no se dividirá con el referido/postventa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
