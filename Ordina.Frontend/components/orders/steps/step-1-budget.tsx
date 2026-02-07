"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { UseOrderFormReturn } from "../hooks/use-order-form";
import { formatCurrency, type Currency } from "@/lib/currency-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/contexts/currency-context";

interface Step1BudgetProps {
  orderForm: UseOrderFormReturn;
  onClientLookup: () => void;
  onProductSelection: () => void;
  onEditProduct: (product: any) => void;
  onRemoveProduct: (product: any) => void;
}

export function Step1Budget({
  orderForm,
  onClientLookup,
  onProductSelection,
  onEditProduct,
  onRemoveProduct,
}: Step1BudgetProps) {
  const { preferredCurrency } = useCurrency();

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          {/* Vendor Selection */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendedor</Label>
              <Select
                value={orderForm.formData.vendor}
                onValueChange={(value) =>
                  orderForm.setFormData((prev) => ({ ...prev, vendor: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {orderForm.mockVendors
                    .filter((vendor) => vendor.id && vendor.id.trim() !== "")
                    .map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referrer">Referidor</Label>
              <Select
                value={orderForm.formData.referrer}
                onValueChange={(value) =>
                  orderForm.setFormData((prev) => ({ ...prev, referrer: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar referidor" />
                </SelectTrigger>
                <SelectContent>
                  {orderForm.mockReferrers
                    .filter((referrer) => referrer.id && referrer.id.trim() !== "")
                    .map((referrer) => (
                      <SelectItem key={referrer.id} value={referrer.id}>
                        {referrer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              readOnly
              value={orderForm.selectedClient?.name || ""}
              placeholder="Seleccionar cliente..."
              onClick={onClientLookup}
              className="cursor-pointer"
            />
          </div>

          {/* Products Table */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <Label>Productos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={onProductSelection}
                disabled={!orderForm.canAddProduct}
                title={
                  !orderForm.formData.vendor && !orderForm.selectedClient
                    ? "Selecciona un vendedor y un cliente para agregar productos"
                    : !orderForm.formData.vendor
                    ? "Selecciona un vendedor para agregar productos"
                    : !orderForm.selectedClient
                    ? "Selecciona un cliente para agregar productos"
                    : ""
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </div>
            {!orderForm.canAddProduct && (
              <p className="text-xs text-muted-foreground">
                {!orderForm.formData.vendor && !orderForm.selectedClient
                  ? "⚠️ Debes seleccionar un vendedor y un cliente para agregar productos"
                  : !orderForm.formData.vendor
                  ? "⚠️ Debes seleccionar un vendedor para agregar productos"
                  : "⚠️ Debes seleccionar un cliente para agregar productos"}
              </p>
            )}

            {orderForm.selectedProducts.length > 0 ? (
              <>
                {/* Vista de tarjetas para móvil */}
                <div className="space-y-4 sm:hidden">
                  {orderForm.selectedProducts.map((product) => {
                    const baseTotal = orderForm.getProductBaseTotal(product);
                    const discount = product.discount || 0;
                    const finalTotal = Math.max(baseTotal - discount, 0);

                    return (
                      <Card key={product.id} className="p-4 sm:p-5">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-base mb-1">
                                {product.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold">
                                {orderForm.formattedProductFinalTotals[product.id] ||
                                  formatCurrency(finalTotal, "Bs")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total final
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Precio:</span>
                              <span className="ml-2 font-medium">
                                {orderForm.formattedProductPrices[product.id] ||
                                  formatCurrency(product.price, "Bs")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cantidad:</span>
                              <span className="ml-2 font-medium">{product.quantity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Subtotal:</span>
                              <span className="ml-2 font-medium">
                                {orderForm.formattedProductTotals[product.id] ||
                                  formatCurrency(baseTotal, "Bs")}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2.5 pt-3 border-t">
                            <Label className="text-sm font-medium">Descuento</Label>
                            <div className="flex gap-2.5">
                              <Select
                                value={
                                  orderForm.productDiscountTypes[product.id] || "monto"
                                }
                                onValueChange={(value: "monto" | "porcentaje") =>
                                  orderForm.handleProductDiscountTypeChange(
                                    product.id,
                                    value
                                  )
                                }
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monto">Monto</SelectItem>
                                  <SelectItem value="porcentaje">Porcentaje</SelectItem>
                                </SelectContent>
                              </Select>
                              {orderForm.productDiscountTypes[product.id] === "monto" && (
                                <Select
                                  value={
                                    orderForm.productDiscountCurrencies[product.id] ||
                                    orderForm.getDefaultCurrencyFromSelection()
                                  }
                                  onValueChange={(value: Currency) => {
                                    orderForm.setProductDiscountCurrencies((prev) => ({
                                      ...prev,
                                      [product.id]: value,
                                    }));
                                    // Recalcular el descuento mostrado
                                    const currentDiscount = product.discount || 0;
                                    const currentCurrency =
                                      orderForm.productDiscountCurrencies[product.id] ||
                                      orderForm.getDefaultCurrencyFromSelection();
                                    const newCurrency = value;
                                    if (currentCurrency !== newCurrency) {
                                      // Convertir el descuento actual a la nueva moneda
                                      let discountInNewCurrency = currentDiscount;
                                      if (currentCurrency === "Bs") {
                                        const rate =
                                          newCurrency === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (rate && rate > 0) {
                                          discountInNewCurrency = currentDiscount / rate;
                                        }
                                      } else if (newCurrency === "Bs") {
                                        const rate =
                                          currentCurrency === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (rate && rate > 0) {
                                          discountInNewCurrency = currentDiscount * rate;
                                        }
                                      } else {
                                        const currentRate =
                                          currentCurrency === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        const newRate =
                                          newCurrency === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (
                                          currentRate &&
                                          newRate &&
                                          currentRate > 0
                                        ) {
                                          discountInNewCurrency =
                                            (currentDiscount * currentRate) / newRate;
                                        }
                                      }
                                      orderForm.handleProductDiscountChange(
                                        product.id,
                                        discountInNewCurrency
                                      );
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bs">Bs</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Input
                                type="number"
                                min="0"
                                step={
                                  orderForm.productDiscountTypes[product.id] ===
                                  "porcentaje"
                                    ? "1"
                                    : "0.01"
                                }
                                max={(() => {
                                  const discountType =
                                    orderForm.productDiscountTypes[product.id] || "monto";
                                  if (discountType === "porcentaje") {
                                    return 100;
                                  }

                                  // Para monto, considerar el maxDiscount de la categoría
                                  const category = orderForm.categories.find(
                                    (cat) => cat.name === product.category
                                  );
                                  if (category && category.maxDiscount > 0) {
                                    // Convertir maxDiscount a Bs si está en otra moneda
                                    let maxDiscountInBs = category.maxDiscount;
                                    if (
                                      category.maxDiscountCurrency &&
                                      category.maxDiscountCurrency !== "Bs"
                                    ) {
                                      const rate =
                                        category.maxDiscountCurrency === "USD"
                                          ? orderForm.exchangeRates.USD?.rate
                                          : orderForm.exchangeRates.EUR?.rate;
                                      if (rate && rate > 0) {
                                        maxDiscountInBs = category.maxDiscount * rate;
                                      }
                                    }
                                    return Math.min(baseTotal, maxDiscountInBs);
                                  }
                                  return baseTotal;
                                })()}
                                value={(() => {
                                  const discountType =
                                    orderForm.productDiscountTypes[product.id] || "monto";
                                  if (discount === 0) return "";
                                  if (discountType === "porcentaje") {
                                    const percentage =
                                      baseTotal > 0 ? (discount / baseTotal) * 100 : 0;
                                    return Math.round(percentage * 100) / 100;
                                  }
                                  // Para monto, convertir a la moneda seleccionada
                                  const discountCurrency =
                                    orderForm.productDiscountCurrencies[product.id] ||
                                    preferredCurrency;
                                  if (discountCurrency === "Bs") {
                                    return discount;
                                  }
                                  const rate =
                                    discountCurrency === "USD"
                                      ? orderForm.exchangeRates.USD?.rate
                                      : orderForm.exchangeRates.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return discount / rate;
                                  }
                                  return discount;
                                })()}
                                onChange={(e) =>
                                  orderForm.handleProductDiscountChange(
                                    product.id,
                                    Number.parseFloat(e.target.value) || 0
                                  )
                                }
                                className="flex-1 min-w-[100px] text-sm"
                                placeholder={
                                  orderForm.productDiscountTypes[product.id] ===
                                  "porcentaje"
                                    ? "0%"
                                    : "0.00"
                                }
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditProduct(product)}
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onRemoveProduct(product)}
                              className="flex-1"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Vista de tabla responsive para tablet/desktop/pantallas grandes */}
                <div className="hidden sm:block overflow-hidden">
                  <div className="w-full overflow-x-hidden">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[20%]">Producto</TableHead>
                          <TableHead className="w-[10%]">Precio</TableHead>
                          <TableHead className="w-[10%] text-center">Cantidad</TableHead>
                          <TableHead className="w-[10%]">Subtotal</TableHead>
                          <TableHead className="w-[24%]">Descuento</TableHead>
                          <TableHead className="w-[10%]">Total final</TableHead>
                          <TableHead className="w-[12%] text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderForm.selectedProducts.map((product) => {
                          const baseTotal = orderForm.getProductBaseTotal(product);
                          const discount = product.discount || 0;
                          const finalTotal = Math.max(baseTotal - discount, 0);

                          return (
                            <TableRow key={product.id}>
                              <TableCell className="w-[20%]">
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-sm">{product.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="w-[10%] text-right text-sm">
                                {orderForm.formattedProductPrices[product.id] ||
                                  formatCurrency(product.price, "Bs")}
                              </TableCell>
                              <TableCell className="w-[10%] text-center text-sm font-medium">
                                {product.quantity || 1}
                              </TableCell>
                              <TableCell className="w-[10%] text-right text-sm">
                                {orderForm.formattedProductTotals[product.id] ||
                                  formatCurrency(baseTotal, "Bs")}
                              </TableCell>
                              <TableCell className="w-[24%]">
                                <div className="flex gap-1.5 items-center">
                                  <Select
                                    value={
                                      orderForm.productDiscountTypes[product.id] || "monto"
                                    }
                                    onValueChange={(value: "monto" | "porcentaje") =>
                                      orderForm.handleProductDiscountTypeChange(
                                        product.id,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-28 h-8 text-xs px-2">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="monto">Monto</SelectItem>
                                      <SelectItem value="porcentaje">Porcentaje</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {orderForm.productDiscountTypes[product.id] === "monto" && (
                                    <Select
                                      value={
                                        orderForm.productDiscountCurrencies[product.id] ||
                                        orderForm.getDefaultCurrencyFromSelection()
                                      }
                                      onValueChange={(value: Currency) => {
                                        orderForm.setProductDiscountCurrencies((prev) => ({
                                          ...prev,
                                          [product.id]: value,
                                        }));
                                        // Recalcular el descuento mostrado
                                        const currentDiscount = product.discount || 0;
                                        const currentCurrency =
                                          orderForm.productDiscountCurrencies[product.id] ||
                                          preferredCurrency;
                                        const newCurrency = value;
                                        if (currentCurrency !== newCurrency) {
                                          // Convertir el descuento actual a la nueva moneda
                                          let discountInNewCurrency = currentDiscount;
                                          if (currentCurrency === "Bs") {
                                            const rate =
                                              newCurrency === "USD"
                                                ? orderForm.exchangeRates.USD?.rate
                                                : orderForm.exchangeRates.EUR?.rate;
                                            if (rate && rate > 0) {
                                              discountInNewCurrency = currentDiscount / rate;
                                            }
                                          } else if (newCurrency === "Bs") {
                                            const rate =
                                              currentCurrency === "USD"
                                                ? orderForm.exchangeRates.USD?.rate
                                                : orderForm.exchangeRates.EUR?.rate;
                                            if (rate && rate > 0) {
                                              discountInNewCurrency = currentDiscount * rate;
                                            }
                                          } else {
                                            const currentRate =
                                              currentCurrency === "USD"
                                                ? orderForm.exchangeRates.USD?.rate
                                                : orderForm.exchangeRates.EUR?.rate;
                                            const newRate =
                                              newCurrency === "USD"
                                                ? orderForm.exchangeRates.USD?.rate
                                                : orderForm.exchangeRates.EUR?.rate;
                                            if (
                                              currentRate &&
                                              newRate &&
                                              currentRate > 0
                                            ) {
                                              discountInNewCurrency =
                                                (currentDiscount * currentRate) / newRate;
                                            }
                                          }
                                          orderForm.handleProductDiscountChange(
                                            product.id,
                                            discountInNewCurrency
                                          );
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-16 h-7 text-xs px-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Bs">Bs</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                  <Input
                                    type="number"
                                    min="0"
                                    step={
                                      orderForm.productDiscountTypes[product.id] ===
                                      "porcentaje"
                                        ? "1"
                                        : "0.01"
                                    }
                                    max={(() => {
                                      const discountType =
                                        orderForm.productDiscountTypes[product.id] || "monto";
                                      if (discountType === "porcentaje") {
                                        return 100;
                                      }

                                      // Para monto, considerar el maxDiscount de la categoría
                                      const category = orderForm.categories.find(
                                        (cat) => cat.name === product.category
                                      );
                                      if (category && category.maxDiscount > 0) {
                                        // Convertir maxDiscount a Bs si está en otra moneda
                                        let maxDiscountInBs = category.maxDiscount;
                                        if (
                                          category.maxDiscountCurrency &&
                                          category.maxDiscountCurrency !== "Bs"
                                        ) {
                                          const rate =
                                            category.maxDiscountCurrency === "USD"
                                              ? orderForm.exchangeRates.USD?.rate
                                              : orderForm.exchangeRates.EUR?.rate;
                                          if (rate && rate > 0) {
                                            maxDiscountInBs = category.maxDiscount * rate;
                                          }
                                        }
                                        return Math.min(baseTotal, maxDiscountInBs);
                                      }
                                      return baseTotal;
                                    })()}
                                    value={(() => {
                                      const discountType =
                                        orderForm.productDiscountTypes[product.id] || "monto";
                                      if (discount === 0) return "";
                                      if (discountType === "porcentaje") {
                                        const percentage =
                                          baseTotal > 0
                                            ? (discount / baseTotal) * 100
                                            : 0;
                                        return Math.round(percentage * 100) / 100;
                                      }
                                      // Para monto, convertir a la moneda seleccionada
                                      const discountCurrency =
                                        orderForm.productDiscountCurrencies[product.id] ||
                                        preferredCurrency;
                                      if (discountCurrency === "Bs") {
                                        return discount;
                                      }
                                      const rate =
                                        discountCurrency === "USD"
                                          ? orderForm.exchangeRates.USD?.rate
                                          : orderForm.exchangeRates.EUR?.rate;
                                      if (rate && rate > 0) {
                                        return discount / rate;
                                      }
                                      return discount;
                                    })()}
                                    onChange={(e) =>
                                      orderForm.handleProductDiscountChange(
                                        product.id,
                                        Number.parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="flex-1 min-w-[80px] h-7 text-sm"
                                    placeholder={
                                      orderForm.productDiscountTypes[product.id] ===
                                      "porcentaje"
                                        ? "0%"
                                        : "0.00"
                                    }
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="w-[10%] font-semibold text-right text-sm">
                                {orderForm.formattedProductFinalTotals[product.id] ||
                                  formatCurrency(finalTotal, "Bs")}
                              </TableCell>
                              <TableCell className="w-[12%] text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onEditProduct(product)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRemoveProduct(product)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
                No hay productos seleccionados
              </div>
            )}
          </div>

          {/* Subtotal */}
          <div className="flex justify-end">
            <div className="text-right">
              <div className="text-sm sm:text-lg font-semibold">
                <span className="block sm:inline">
                  Subtotal (después de descuentos):
                </span>
                <span className="block sm:inline sm:ml-1">
                  {orderForm.formattedSubtotal ||
                    formatCurrency(orderForm.subtotal, "Bs")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
