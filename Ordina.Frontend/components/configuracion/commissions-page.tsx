"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Percent, Save, RefreshCcw, Users, ShoppingBag, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import {
  getCategories,
  type Category,
  getProductCommissions,
  batchUpsertProductCommissions,
  type ProductCommission,
  getSaleTypeCommissionRules,
  batchUpsertSaleTypeCommissionRules,
  seedDefaultSaleTypeRules,
  type SaleTypeCommissionRule,
  getUsers,
  type User,
} from "@/lib/storage";
import { apiClient } from "@/lib/api-client";

// Valores de comisión disponibles (múltiplos de 2.5)
const COMMISSION_VALUES = [0, 2.5, 5, 7.5, 10, 12.5, 15];

export function CommissionsPage() {
  // Estados para comisiones por categoría
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCommissions, setProductCommissions] = useState<ProductCommission[]>([]);
  const [categoryCommissionValues, setCategoryCommissionValues] = useState<Record<string, number>>({});
  
  // Estados para reglas de tipo de venta
  const [saleTypeRules, setSaleTypeRules] = useState<SaleTypeCommissionRule[]>([]);
  const [editedRules, setEditedRules] = useState<Record<string, { vendorRate: number; referrerRate: number }>>({});
  
  // Estados para usuarios con comisión exclusiva
  const [users, setUsers] = useState<User[]>([]);
  const [exclusiveUsers, setExclusiveUsers] = useState<Set<string>>(new Set());
  
  // Estados de carga
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        loadedCategories,
        loadedProductCommissions,
        loadedRules,
        loadedUsers,
      ] = await Promise.all([
        getCategories(),
        getProductCommissions(),
        getSaleTypeCommissionRules(),
        getUsers(),
      ]);

      setCategories(loadedCategories);
      setProductCommissions(loadedProductCommissions);
      setSaleTypeRules(loadedRules);
      setUsers(loadedUsers.filter((u) => u.status === "active"));

      // Inicializar valores de comisión por categoría
      const commissionValues: Record<string, number> = {};
      loadedCategories.forEach((category) => {
        const existingCommission = loadedProductCommissions.find(
          (pc) => pc.categoryId === category.backendId || pc.categoryName === category.name
        );
        commissionValues[category.name] = existingCommission?.commissionValue || 0;
      });
      setCategoryCommissionValues(commissionValues);

      // Inicializar reglas editadas
      const rulesMap: Record<string, { vendorRate: number; referrerRate: number }> = {};
      loadedRules.forEach((rule) => {
        rulesMap[rule.saleType] = {
          vendorRate: rule.vendorRate,
          referrerRate: rule.referrerRate,
        };
      });
      setEditedRules(rulesMap);

      // Inicializar usuarios con comisión exclusiva
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

  // ===== HANDLERS PARA COMISIONES POR CATEGORÍA =====

  const handleCategoryCommissionChange = (categoryName: string, value: number) => {
    setCategoryCommissionValues((prev) => ({
      ...prev,
      [categoryName]: value,
    }));
  };

  const handleSaveProductCommissions = async () => {
    setIsSaving(true);
    try {
      const commissionsToSave = categories.map((category) => ({
        categoryId: category.backendId || category.id.toString(),
        categoryName: category.name,
        commissionValue: categoryCommissionValues[category.name] || 0,
      }));

      await batchUpsertProductCommissions(commissionsToSave);
      toast.success("Comisiones por categoría guardadas exitosamente");
      await loadData(); // Recargar datos
    } catch (error) {
      console.error("Error saving product commissions:", error);
      toast.error("Error al guardar las comisiones");
    } finally {
      setIsSaving(false);
    }
  };

  // ===== HANDLERS PARA REGLAS DE TIPO DE VENTA =====

  const handleRuleChange = (
    saleType: string,
    field: "vendorRate" | "referrerRate",
    value: number
  ) => {
    setEditedRules((prev) => ({
      ...prev,
      [saleType]: {
        ...prev[saleType],
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

  const handleSeedDefaultRules = async () => {
    setIsSaving(true);
    try {
      await seedDefaultSaleTypeRules();
      toast.success("Reglas por defecto cargadas exitosamente");
      await loadData();
    } catch (error) {
      console.error("Error seeding default rules:", error);
      toast.error("Error al cargar reglas por defecto");
    } finally {
      setIsSaving(false);
    }
  };

  // ===== HANDLERS PARA VENDEDORES EXCLUSIVOS =====

  const handleExclusiveToggle = async (userId: string, exclusive: boolean) => {
    try {
      // Actualizar usuario en el backend
      await apiClient.updateUser(userId, { exclusiveCommission: exclusive });
      
      // Actualizar estado local
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración de Comisiones</h1>
        <p className="text-muted-foreground">
          Gestiona las comisiones por familia de productos y reglas de distribución
        </p>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
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

        {/* TAB 1: Comisiones por Categoría/Familia */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Comisiones por Familia de Producto
              </CardTitle>
              <CardDescription>
                Configura la comisión base para cada categoría de productos (en múltiplos de 2.5%)
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
                        <TableHead className="w-48">Comisión Base (%)</TableHead>
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
                            <Select
                              value={(categoryCommissionValues[category.name] || 0).toString()}
                              onValueChange={(value) =>
                                handleCategoryCommissionChange(category.name, parseFloat(value))
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {COMMISSION_VALUES.map((value) => (
                                  <SelectItem key={value} value={value.toString()}>
                                    {value === 0 ? "Sin comisión" : `${value}%`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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

        {/* TAB 2: Distribución por Tipo de Venta */}
        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Distribución de Comisiones por Tipo de Venta
              </CardTitle>
              <CardDescription>
                Define cómo se reparte la comisión entre Vendedor de Tienda y Postventa/Referido en ventas compartidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {saleTypeRules.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No hay reglas configuradas</p>
                  <Button onClick={handleSeedDefaultRules} disabled={isSaving}>
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
                        <TableHead className="text-center">Vendedor Tienda (%)</TableHead>
                        <TableHead className="text-center">Postventa/Referido (%)</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleTypeRules.map((rule) => {
                        const vendorRate = editedRules[rule.saleType]?.vendorRate ?? rule.vendorRate;
                        const referrerRate = editedRules[rule.saleType]?.referrerRate ?? rule.referrerRate;
                        const total = vendorRate + referrerRate;
                        
                        return (
                          <TableRow key={rule.saleType}>
                            <TableCell className="font-medium">{rule.saleTypeLabel}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                className="w-20 mx-auto text-center"
                                value={vendorRate}
                                onChange={(e) =>
                                  handleRuleChange(rule.saleType, "vendorRate", parseFloat(e.target.value) || 0)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                className="w-20 mx-auto text-center"
                                value={referrerRate}
                                onChange={(e) =>
                                  handleRuleChange(rule.saleType, "referrerRate", parseFloat(e.target.value) || 0)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={total > 0 ? "default" : "secondary"}>
                                {total}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={handleSeedDefaultRules} disabled={isSaving}>
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

        {/* TAB 3: Vendedores Exclusivos */}
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
                  <strong>Nota:</strong> Los vendedores con comisión exclusiva recibirán el 100% de la comisión 
                  de sus ventas, incluso cuando haya un referido asociado. La comisión no se dividirá 
                  con el referido/postventa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
