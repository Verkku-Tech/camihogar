"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { UseOrderFormReturn } from "../hooks/use-order-form";
import { formatCurrency, type Currency } from "@/lib/currency-utils";
import { maskAccountNumber, type ProductImage } from "@/lib/storage";
import { ImageUploader } from "../ImageUploader";
import {
  PAYMENT_CONDITIONS,
  PURCHASE_TYPES,
  DELIVERY_TYPES,
  DELIVERY_ZONES,
  paymentMethods,
  digitalPaymentMethods,
} from "../constants";

interface Step3OrderDetailsProps {
  orderForm: UseOrderFormReturn;
  onSubmit: () => void;
  addPayment?: () => void;
  updatePayment?: (id: string, field: any, value: any) => void;
  updatePaymentDetails?: (id: string, field: string, value: any) => void;
  removePayment?: (id: string) => void;
  getAccountsForPaymentMethod?: (method: string) => any[];
  saveAccountInfoToPayment?: (paymentId: string, account: any) => void;
  updatePaymentImages?: (paymentId: string, images: ProductImage[]) => void;
}

export function Step3OrderDetails({
  orderForm,
  onSubmit,
  addPayment,
  updatePayment,
  updatePaymentDetails,
  removePayment,
  getAccountsForPaymentMethod,
  saveAccountInfoToPayment,
  updatePaymentImages,
}: Step3OrderDetailsProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">
            Realizar Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 sm:space-y-6 p-4 sm:p-6">
          {/* 1. REQUIERE DELIVERY */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasDelivery"
                checked={orderForm.hasDelivery}
                onCheckedChange={(checked) => {
                  orderForm.setHasDelivery(checked as boolean);
                  if (!checked) {
                    // Resetear servicios cuando se desactiva delivery
                    orderForm.setDeliveryServices({
                      deliveryExpress: { enabled: false, cost: 0, currency: "Bs" },
                      servicioAcarreo: { enabled: false, cost: undefined, currency: "Bs" },
                      servicioArmado: { enabled: false, cost: 0, currency: "Bs" },
                    });
                  }
                }}
              />
              <Label
                htmlFor="hasDelivery"
                className="text-base font-medium"
              >
                ¿Requiere delivery?
              </Label>
            </div>

            {orderForm.hasDelivery && (
              <div className="space-y-4 pl-4 sm:pl-6">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-medium">
                    Dirección de Entrega
                  </Label>
                  <Textarea
                    id="deliveryAddress"
                    value={orderForm.formData.deliveryAddress}
                    onChange={(e) =>
                      orderForm.setFormData((prev) => ({
                        ...prev,
                        deliveryAddress: e.target.value,
                      }))
                    }
                    placeholder="Ingrese la dirección de entrega"
                    rows={3}
                    className="w-full"
                  />
                </div>

                {/* DELIVERY EXPRESS */}
                <div className="space-y-2 border-l-2 pl-4 border-primary/20">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="deliveryExpress"
                      checked={orderForm.deliveryServices.deliveryExpress?.enabled || false}
                      onCheckedChange={(checked) => {
                        orderForm.setDeliveryServices((prev) => ({
                          ...prev,
                          deliveryExpress: {
                            enabled: checked as boolean,
                            cost: checked ? (prev.deliveryExpress?.cost || 0) : 0,
                            currency: prev.deliveryExpress?.currency || "Bs",
                          },
                        }));
                      }}
                    />
                    <Label htmlFor="deliveryExpress" className="text-sm sm:text-base font-medium">
                      DELIVERY EXPRESS
                    </Label>
                  </div>
                  {orderForm.deliveryServices.deliveryExpress?.enabled && (
                    <div className="space-y-2 pl-6">
                      <Label className="text-xs text-muted-foreground">Gastos de Entrega</Label>
                      <div className="flex gap-2">
                        <Select
                          value={orderForm.deliveryServices.deliveryExpress.currency}
                          onValueChange={(value: Currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              deliveryExpress: prev.deliveryExpress
                                ? {
                                    ...prev.deliveryExpress,
                                    currency: value,
                                    cost: orderForm.convertCurrencyValue(
                                      prev.deliveryExpress.cost || 0,
                                      prev.deliveryExpress.currency,
                                      value
                                  ),
                                  }
                                : { enabled: true, cost: 0, currency: value },
                            }));
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bs">Bs</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={(() => {
                            const cost = orderForm.deliveryServices.deliveryExpress?.cost || 0;
                            const currency = orderForm.deliveryServices.deliveryExpress?.currency || "Bs";
                            if (cost === 0) return "";
                            if (currency === "Bs") return cost;
                            const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                            return rate && rate > 0 ? cost / rate : cost;
                          })()}
                          onChange={(e) => {
                            const inputValue = Number.parseFloat(e.target.value) || 0;
                            const currency = orderForm.deliveryServices.deliveryExpress?.currency || "Bs";
                            let valueInBs = inputValue;
                            if (currency !== "Bs") {
                              const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                              if (rate && rate > 0) {
                                valueInBs = inputValue * rate;
                              }
                            }
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              deliveryExpress: prev.deliveryExpress
                                ? { ...prev.deliveryExpress, cost: valueInBs }
                                : { enabled: true, cost: valueInBs, currency: "Bs" },
                            }));
                          }}
                          placeholder="0.00"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SERVICIO DE ACARREO */}
                <div className="space-y-2 border-l-2 pl-4 border-primary/20">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="servicioAcarreo"
                      checked={orderForm.deliveryServices.servicioAcarreo?.enabled || false}
                      onCheckedChange={(checked) => {
                        orderForm.setDeliveryServices((prev) => ({
                          ...prev,
                          servicioAcarreo: {
                            enabled: checked as boolean,
                            cost: checked ? (prev.servicioAcarreo?.cost || undefined) : undefined,
                            currency: prev.servicioAcarreo?.currency || "Bs",
                          },
                        }));
                      }}
                    />
                    <Label htmlFor="servicioAcarreo" className="text-sm sm:text-base font-medium">
                      SERVICIO DE ACARREO
                    </Label>
                  </div>
                  {orderForm.deliveryServices.servicioAcarreo?.enabled && (
                    <div className="space-y-2 pl-6">
                      <Label className="text-xs text-muted-foreground">Precio (opcional)</Label>
                      <div className="flex gap-2">
                        <Select
                          value={orderForm.deliveryServices.servicioAcarreo.currency}
                          onValueChange={(value: Currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioAcarreo: prev.servicioAcarreo
                                ? {
                                    ...prev.servicioAcarreo,
                                    currency: value,
                                    cost: prev.servicioAcarreo.cost
                                      ? orderForm.convertCurrencyValue(
                                          prev.servicioAcarreo.cost,
                                          prev.servicioAcarreo.currency,
                                          value
                                      )
                                      : undefined,
                                  }
                                : { enabled: true, cost: undefined, currency: value },
                            }));
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bs">Bs</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={(() => {
                            const cost = orderForm.deliveryServices.servicioAcarreo?.cost;
                            if (cost === undefined || cost === 0) return "";
                            const currency = orderForm.deliveryServices.servicioAcarreo?.currency || "Bs";
                            if (currency === "Bs") return cost;
                            const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                            return rate && rate > 0 ? cost / rate : cost;
                          })()}
                          onChange={(e) => {
                            const inputValue = e.target.value === "" ? undefined : Number.parseFloat(e.target.value) || 0;
                            const currency = orderForm.deliveryServices.servicioAcarreo?.currency || "Bs";
                            let valueInBs: number | undefined = inputValue;
                            if (inputValue !== undefined && currency !== "Bs") {
                              const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                              if (rate && rate > 0) {
                                valueInBs = inputValue * rate;
                              }
                            }
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioAcarreo: prev.servicioAcarreo
                                ? { ...prev.servicioAcarreo, cost: valueInBs }
                                : { enabled: true, cost: valueInBs, currency: "Bs" },
                            }));
                          }}
                          placeholder="0.00 (opcional)"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SERVICIO DE ARMADO */}
                <div className="space-y-2 border-l-2 pl-4 border-primary/20">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="servicioArmado"
                      checked={orderForm.deliveryServices.servicioArmado?.enabled || false}
                      onCheckedChange={(checked) => {
                        orderForm.setDeliveryServices((prev) => ({
                          ...prev,
                          servicioArmado: {
                            enabled: checked as boolean,
                            cost: checked ? (prev.servicioArmado?.cost || 0) : 0,
                            currency: prev.servicioArmado?.currency || "Bs",
                          },
                        }));
                      }}
                    />
                    <Label htmlFor="servicioArmado" className="text-sm sm:text-base font-medium">
                      SERVICIO DE ARMADO <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  {orderForm.deliveryServices.servicioArmado?.enabled && (
                    <div className="space-y-2 pl-6">
                      <Label className="text-xs text-muted-foreground">Precio (obligatorio)</Label>
                      <div className="flex gap-2">
                        <Select
                          value={orderForm.deliveryServices.servicioArmado.currency}
                          onValueChange={(value: Currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioArmado: prev.servicioArmado
                                ? {
                                    ...prev.servicioArmado,
                                    currency: value,
                                    cost: orderForm.convertCurrencyValue(
                                      prev.servicioArmado.cost || 0,
                                      prev.servicioArmado.currency,
                                      value
                                  ),
                                  }
                                : { enabled: true, cost: 0, currency: value },
                            }));
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bs">Bs</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          required
                          value={(() => {
                            const cost = orderForm.deliveryServices.servicioArmado?.cost || 0;
                            const currency = orderForm.deliveryServices.servicioArmado?.currency || "Bs";
                            if (cost === 0) return "";
                            if (currency === "Bs") return cost;
                            const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                            return rate && rate > 0 ? cost / rate : cost;
                          })()}
                          onChange={(e) => {
                            const inputValue = Number.parseFloat(e.target.value) || 0;
                            const currency = orderForm.deliveryServices.servicioArmado?.currency || "Bs";
                            let valueInBs = inputValue;
                            if (currency !== "Bs") {
                              const rate = currency === "USD" ? orderForm.exchangeRates.USD?.rate : orderForm.exchangeRates.EUR?.rate;
                              if (rate && rate > 0) {
                                valueInBs = inputValue * rate;
                              }
                            }
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioArmado: prev.servicioArmado
                                ? { ...prev.servicioArmado, cost: valueInBs }
                                : { enabled: true, cost: valueInBs, currency: "Bs" },
                            }));
                          }}
                          placeholder="0.00"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. TOTALIZACIÓN */}
          <div className="p-3 sm:p-4 bg-muted rounded-lg space-y-4">
            {/* Tabla de orderForm.totales */}
            <div className="overflow-x-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">
                        Concepto
                      </TableHead>
                      <TableHead className="text-right">
                        Monto
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Base imponible (descuentos por producto + express + acarreo + armada) */}
                    <TableRow>
                      <TableCell className="text-xs sm:text-sm">
                        Base imponible (descuentos por producto + express + acarreo + armada):
                      </TableCell>
                      {orderForm.renderCurrencyCell(orderForm.subtotal + orderForm.deliveryCost)}
                    </TableRow>

                    {/* Impuesto */}
                    <TableRow>
                      <TableCell className="text-xs sm:text-sm">
                        Impuesto:
                      </TableCell>
                      {orderForm.renderCurrencyCell(orderForm.taxAmount)}
                    </TableRow>

                    {/* Total */}
                    <TableRow className="font-medium border-t">
                      <TableCell className="text-xs sm:text-sm">
                        Total:
                      </TableCell>
                      {orderForm.renderCurrencyCell(orderForm.totalBeforeGeneralDiscount)}
                    </TableRow>

                    {/* Descuento General */}
                    {orderForm.generalDiscountAmount > 0 && (
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm text-red-600">
                          Descuento General:
                        </TableCell>
                        {orderForm.renderCurrencyCellNegative(
                          orderForm.generalDiscountAmount,
                          "text-red-600"
                      )}
                    </TableRow>
                  )}

                    {/* Total Final */}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell className="text-base sm:text-lg">
                        Total Final:
                      </TableCell>
                      {orderForm.renderCurrencyCell(
                        orderForm.total,
                        "text-base sm:text-lg font-semibold"
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
          </div>

          {/* 3. DESCUENTO */}
          <div className="space-y-2.5">
            <Label
              htmlFor="orderForm.generalDiscount"
              className="text-sm sm:text-base font-medium"
            >
              Descuento general
            </Label>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
              <Select
                value={orderForm.generalDiscountType}
                onValueChange={(value: "monto" | "porcentaje") =>
                  orderForm.handleGeneralDiscountTypeChange(value)
                }
                disabled={orderForm.selectedProducts.length === 0}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monto">Monto</SelectItem>
                  <SelectItem value="porcentaje">
                    Porcentaje
                  </SelectItem>
                </SelectContent>
              </Select>
              {orderForm.generalDiscountType === "monto" && (
                <Select
                  value={orderForm.generalDiscountCurrency}
                  onValueChange={(value: Currency) => {
                    // Convertir el valor actual a la nueva moneda (similar a delivery)
                    if (orderForm.generalDiscount > 0) {
                      let newValue = orderForm.generalDiscount;
                      if (orderForm.generalDiscountCurrency === "Bs") {
                        // De Bs a otra moneda
                        const rate =
                          value === "USD"
                            ? orderForm.exchangeRates.USD?.rate
                            : orderForm.exchangeRates.EUR?.rate;
                        if (rate && rate > 0) {
                          newValue = orderForm.generalDiscount / rate;
                        }
                      } else if (value === "Bs") {
                        // De otra moneda a Bs
                        const rate =
                          orderForm.generalDiscountCurrency === "USD"
                            ? orderForm.exchangeRates.USD?.rate
                            : orderForm.exchangeRates.EUR?.rate;
                        if (rate && rate > 0) {
                          newValue = orderForm.generalDiscount * rate;
                        }
                      } else {
                        // Entre USD y EUR
                        const currentRate =
                          orderForm.generalDiscountCurrency === "USD"
                            ? orderForm.exchangeRates.USD?.rate
                            : orderForm.exchangeRates.EUR?.rate;
                        const newRate =
                          value === "USD"
                            ? orderForm.exchangeRates.USD?.rate
                            : orderForm.exchangeRates.EUR?.rate;
                        if (currentRate && newRate && currentRate > 0) {
                          newValue =
                            (orderForm.generalDiscount * currentRate) / newRate;
                        }
                      }
                      orderForm.setGeneralDiscount(newValue);
                    }
                    orderForm.setGeneralDiscountCurrency(value);
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
                id="generalDiscount"
                type="number"
                min="0"
                step={
                  orderForm.generalDiscountType === "porcentaje" ? "1" : "0.01"
                }
                max={
                  orderForm.generalDiscountType === "porcentaje"
                    ? 100
                    : (() => {
                        const subtotal = orderForm.subtotalAfterProductDiscounts;
                        const taxAmount = subtotal * 0.16;
                        const deliveryCost = orderForm.calculateDeliveryCost();
                        const totalBeforeGeneralDiscount = subtotal + taxAmount + deliveryCost;
                        return totalBeforeGeneralDiscount;
                      })()
                }
                value={
                  orderForm.generalDiscount === 0
                    ? ""
                    : orderForm.generalDiscountType === "porcentaje"
                    ? (() => {
                        const subtotal = orderForm.subtotalAfterProductDiscounts;
                        const taxAmount = subtotal * 0.16;
                        const deliveryCost = orderForm.calculateDeliveryCost();
                        const totalBeforeGeneralDiscount = subtotal + taxAmount + deliveryCost;
                        return totalBeforeGeneralDiscount > 0
                          ? Math.round(
                              (orderForm.generalDiscount /
                                totalBeforeGeneralDiscount) *
                                100 *
                                100
                            ) / 100 // Redondear a 2 decimales máximo
                          : 0;
                      })()
                    : (() => {
                        // Mostrar en la moneda seleccionada (similar a delivery)
                        if (orderForm.generalDiscountCurrency === "Bs") {
                          return orderForm.generalDiscount;
                        }
                        const rate =
                          orderForm.generalDiscountCurrency === "USD"
                            ? orderForm.exchangeRates.USD?.rate
                            : orderForm.exchangeRates.EUR?.rate;
                        if (rate && rate > 0) {
                          return (
                            Math.round((orderForm.generalDiscount / rate) * 100) /
                            100
                        );
                        }
                        return orderForm.generalDiscount;
                      })()
                }
                onChange={(e) => {
                  const inputValue =
                    Number.parseFloat(e.target.value) || 0;
                  if (orderForm.generalDiscountType === "monto") {
                    // Convertir a Bs según la moneda seleccionada (similar a delivery)
                    let valueInBs = inputValue;
                    if (orderForm.generalDiscountCurrency !== "Bs") {
                      const rate =
                        orderForm.generalDiscountCurrency === "USD"
                          ? orderForm.exchangeRates.USD?.rate
                          : orderForm.exchangeRates.EUR?.rate;
                      if (rate && rate > 0) {
                        valueInBs = inputValue * rate;
                      }
                    }
                    orderForm.setGeneralDiscount(valueInBs);
                  } else {
                    orderForm.handleGeneralDiscountChange(inputValue);
                  }
                }}
                placeholder={
                  orderForm.generalDiscountType === "porcentaje" ? "0%" : "0.00"
                }
                disabled={orderForm.selectedProducts.length === 0}
                className="w-full sm:w-48"
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Este descuento se aplica al orderForm.total final (después de impuestos y gastos de entrega).
            </p>
          </div>

          {/* 4. TIPO DE VENTA Y MÉTODO DE PAGO */}
          <div className="space-y-4">
            {/* Condición de Pago */}
            <div className="space-y-2">
              <Label htmlFor="orderForm.paymentCondition" className="text-sm sm:text-base">
                Condición de Pago <span className="text-red-500">*</span>
            </Label>
              <Select
                value={orderForm.paymentCondition}
                onValueChange={(value) =>
                  orderForm.setPaymentCondition(
                    value as
                      | "cashea"
                      | "pagara_en_tienda"
                      | "pago_a_entrega"
                      | "pago_parcial"
                      | "todo_pago"
                      | ""
                )
                }
              >
                <SelectTrigger id="orderForm.paymentCondition">
                  <SelectValue placeholder="Seleccione la condición de pago" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_CONDITIONS.map((condition) => (
                    <SelectItem key={condition.value} value={condition.value}>
                      {condition.label}
                    </SelectItem>
                ))}
                </SelectContent>
              </Select>
              </div>

            {/* Tipo de Venta */}
            <div className="space-y-2">
              <Label htmlFor="orderForm.saleType" className="text-sm sm:text-base">
                Tipo de Venta <span className="text-red-500">*</span>
                </Label>
              <Select
                value={orderForm.saleType}
                onValueChange={(value) =>
                  orderForm.setSaleType(
                    value as
                      | "encargo"
                      | "entrega"
                      | "sistema_apartado"
                      | ""
                )
                }
              >
                <SelectTrigger id="orderForm.saleType">
                  <SelectValue placeholder="Seleccione el tipo de venta" />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                ))}
                </SelectContent>
              </Select>
              </div>

            {/* Tipo de Entrega */}
            <div className="space-y-2">
              <Label htmlFor="orderForm.deliveryType" className="text-sm sm:text-base">
                Tipo de Entrega <span className="text-red-500">*</span>
                </Label>
              <Select
                value={orderForm.deliveryType}
                onValueChange={(value) =>
                  orderForm.setDeliveryType(
                    value as
                      | "entrega_programada"
                      | "delivery_express"
                      | "retiro_tienda"
                      | "retiro_almacen"
                      | ""
                )
                }
              >
                <SelectTrigger id="orderForm.deliveryType">
                  <SelectValue placeholder="Seleccione el tipo de entrega" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                ))}
                </SelectContent>
              </Select>
              </div>

            {/* Zona de Entrega */}
            <div className="space-y-2">
              <Label htmlFor="orderForm.deliveryZone" className="text-sm sm:text-base">
                Zona de Entrega <span className="text-red-500">*</span>
                </Label>
              <Select
                value={orderForm.deliveryZone}
                onValueChange={(value) =>
                  orderForm.setDeliveryZone(
                    value as
                      | "caracas"
                      | "g_g"
                      | "san_antonio_los_teques"
                      | "caucagua_higuerote"
                      | "la_guaira"
                      | "charallave_cua"
                      | "interior_pais"
                      | ""
                )
                }
              >
                <SelectTrigger id="orderForm.deliveryZone">
                  <SelectValue placeholder="Seleccione la zona de entrega" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_ZONES.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                ))}
                </SelectContent>
              </Select>
              </div>

            {/* Sección unificada de Pagos - funciona para todos los tipos de venta */}
            <div className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <Label className="text-sm sm:text-base">
                      Pagos
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPayment}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Pago
                    </Button>
                  </div>

                  {orderForm.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
                        {/* Método primero */}
                        <div className="flex-1 w-full">
                          <Label className="text-xs">Método</Label>
                          <Select
                            value={payment.method}
                            onValueChange={(value) => {
                              updatePayment?.(
                                payment.id,
                                "method",
                                value
                            );
                              // Si se cambia a método digital, establecer automáticamente USD
                              if (digitalPaymentMethods.includes(value)) {
                                updatePayment?.(
                                  payment.id,
                                  "currency",
                                  "USD"
                              );
                                updatePaymentDetails?.(
                                  payment.id,
                                  "originalCurrency",
                                  "USD"
                              );
                              }
                              // Si se cambia a Efectivo, inicializar cashCurrency con la moneda del pago
                              if (value === "Efectivo") {
                                const currentCurrency = payment.currency || orderForm.getDefaultCurrencyFromSelection();
                                updatePaymentDetails?.(
                                  payment.id,
                                  "cashCurrency",
                                  currentCurrency
                              );
                                // También actualizar payment.currency si no está definido
                                if (!payment.currency) {
                                  updatePayment?.(
                                    payment.id,
                                    "currency",
                                    currentCurrency
                                );
                                }
                                // Si hay una tasa de cambio disponible, guardarla
                                if (currentCurrency !== "Bs" && orderForm.exchangeRates[currentCurrency]?.rate) {
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "exchangeRate",
                                    orderForm.exchangeRates[currentCurrency].rate
                                );
                                }
                              } else {
                                // Si se cambia a un método diferente a Efectivo y había cashReceived, limpiarlo
                                updatePaymentDetails?.(
                                  payment.id,
                                  "cashReceived",
                                  0
                              );
                                updatePaymentDetails?.(
                                  payment.id,
                                  "cashCurrency",
                                  "Bs"
                              );
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethods
                                .filter((method) => method && method.trim() !== "")
                                .map((method) => (
                                  <SelectItem key={method} value={method}>
                                    {method}
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Fecha */}
                        <div className="flex-1 w-full">
                          <Label className="text-xs">Fecha</Label>
                          <Input
                            type="date"
                            value={payment.date}
                            onChange={(e) =>
                              updatePayment?.(
                                payment.id,
                                "date",
                                e.target.value
                            )
                            }
                            className="w-full"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePayment?.(payment.id)}
                          className="w-full sm:w-auto self-end sm:self-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="ml-2 sm:hidden">
                            Eliminar
                          </span>
                        </Button>
                      </div>

                      {/* Campos condicionales según método de pago */}
                      {payment.method === "Pago Móvil" && (
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-sm font-medium">
                            Información de Pago Móvil
                          </Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`pagomovil-currency-${payment.id}`}
                                className="text-xs"
                              >
                                Moneda *
                              </Label>
                              <Select
                                value={
                                  (payment.currency && orderForm.selectedCurrencies.includes(payment.currency))
                                    ? payment.currency
                                    : orderForm.getDefaultCurrencyFromSelection()
                                }
                                onValueChange={(value: Currency) => {
                                  // Actualizar la moneda registrada
                                  updatePayment?.(
                                    payment.id,
                                    "currency",
                                    value
                                );

                                  // Si ya hay un originalAmount y originalCurrency guardados, 
                                  // solo actualizar la moneda y recalcular el amount en Bs
                                  const currentOriginalAmount = payment.paymentDetails?.originalAmount;
                                  const currentOriginalCurrency = payment.paymentDetails?.originalCurrency;
                                          
                                  if (currentOriginalAmount !== undefined && currentOriginalCurrency) {
                                    // Actualizar la moneda original
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                            
                                    // Si el monto original está en otra moneda, mantenerlo pero recalcular Bs
                                    // Si cambia a la misma moneda que ya tiene el originalAmount, mantenerlo
                                    if (value !== currentOriginalCurrency) {
                                      // Si cambia de moneda, mantener el originalAmount actual
                                      // y recalcular el amount en Bs basado en la nueva moneda
                                      let valueInBs = currentOriginalAmount;
                                      if (value !== "Bs") {
                                        const rate =
                                          value === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (rate && rate > 0) {
                                          valueInBs = currentOriginalAmount * rate;
                                          updatePaymentDetails?.(
                                            payment.id,
                                            "exchangeRate",
                                            rate
                                        );
                                        }
                                      } else {
                                        // Si cambia a Bs, el originalAmount ya está en Bs
                                        valueInBs = currentOriginalAmount;
                                      }
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        valueInBs
                                    );
                                    }
                                  } else if (payment.amount > 0) {
                                    // Si no hay originalAmount guardado pero hay amount, calcular desde amount
                                    let originalAmount = payment.amount;
                                    if (value !== "Bs") {
                                      const rate =
                                        value === "USD"
                                          ? orderForm.exchangeRates.USD?.rate
                                          : orderForm.exchangeRates.EUR?.rate;
                                      if (rate && rate > 0) {
                                        originalAmount = payment.amount / rate;
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "exchangeRate",
                                          rate
                                      );
                                      }
                                    }
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalAmount",
                                      originalAmount
                                  );
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  } else {
                                    // Si no hay monto aún, solo actualizar la moneda
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bs">
                                    Bolívares (Bs)
                                  </SelectItem>
                                  <SelectItem value="USD">
                                    Dólares (USD)
                                  </SelectItem>
                                  <SelectItem value="EUR">
                                    Euros (EUR)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Campo Monto después de Moneda */}
                            <div className="space-y-2">
                              <Label
                                htmlFor={`pagomovil-amount-${payment.id}`}
                                className="text-xs"
                              >
                                Monto *
                              </Label>
                              <Input
                                id={`pagomovil-amount-${payment.id}`}
                                type="number"
                                step="0.01"
                                value={(() => {
                                  if (payment.amount === 0) return "";
                                  // Si hay monto original guardado, usarlo
                                  if (
                                    payment.paymentDetails
                                      ?.originalAmount !== undefined
                                ) {
                                    return payment.paymentDetails
                                      .originalAmount;
                                  }
                                  // Fallback: calcular desde payment.amount
                                  const paymentCurrency =
                                    payment.currency || orderForm.getDefaultCurrencyFromSelection();
                                  if (paymentCurrency === "Bs") {
                                    return payment.amount;
                                  }
                                  const rate =
                                    paymentCurrency === "USD"
                                      ? orderForm.exchangeRates.USD?.rate
                                      : orderForm.exchangeRates.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return payment.amount / rate;
                                  }
                                  return payment.amount;
                                })()}
                                onChange={(e) => {
                                  const inputValue =
                                    Number.parseFloat(e.target.value) ||
                                    0;
                                  const paymentCurrency =
                                    payment.currency || orderForm.getDefaultCurrencyFromSelection();

                                  // SIEMPRE guardar el monto original en la moneda del pago
                                  // Esto asegura que siempre tengamos el valor original
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalAmount",
                                    inputValue
                                );
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalCurrency",
                                    paymentCurrency
                                );

                                  // También actualizar payment.currency si no está definida
                                  if (!payment.currency) {
                                    updatePayment?.(
                                      payment.id,
                                      "currency",
                                      paymentCurrency
                                  );
                                  }

                                  // Convertir a Bs según la moneda seleccionada
                                  let valueInBs = inputValue;
                                  if (paymentCurrency !== "Bs") {
                                    const rate =
                                      paymentCurrency === "USD"
                                        ? orderForm.exchangeRates.USD?.rate
                                        : orderForm.exchangeRates.EUR?.rate;
                                    if (rate && rate > 0) {
                                      valueInBs = inputValue * rate;
                                      // Guardar la tasa de cambio usada
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        rate
                                    );
                                    }
                                  } else {
                                    // Si es Bs, asegurar que el exchangeRate sea null/undefined
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      undefined
                                  );
                                  }
                                  updatePayment?.(
                                    payment.id,
                                    "amount",
                                    valueInBs
                                );
                                }}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`pagomovil-reference-${payment.id}`}
                                className="text-xs"
                              >
                                N° Referencia *
                              </Label>
                              <Input
                                id={`pagomovil-reference-${payment.id}`}
                                value={
                                  payment.paymentDetails
                                    ?.pagomovilReference || ""
                                }
                                onChange={(e) =>
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "pagomovilReference",
                                    e.target.value
                                )
                                }
                                placeholder="Ingrese el número de referencia"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`pagomovil-account-${payment.id}`}
                                className="text-xs"
                              >
                                Banco Receptor *
                              </Label>
                              <Select
                                value={payment.paymentDetails?.accountId || undefined}
                                onValueChange={(value) => {
                                  const selectedAccount = orderForm.accounts.find(acc => acc.id === value);
                                  if (selectedAccount) {
                                    saveAccountInfoToPayment?.(payment.id, selectedAccount);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione un banco receptor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAccountsForPaymentMethod?.("Pago Móvil")
                                    .filter((account) => account.id && account.id.trim() !== "")
                                    .map((account) => (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {maskAccountNumber(account.accountNumber || "")}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {account.bank || ""}
                                          </span>
                                        </div>
                                      </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {/* Comprobante de Pago - Imágenes */}
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-medium">
                              Comprobante de Pago (Imágenes)
                            </Label>
                            {updatePaymentImages && (
                              <ImageUploader
                                images={payment.images || []}
                                onImagesChange={(images) => updatePaymentImages(payment.id, images)}
                                maxImages={3}
                                maxSizeMB={1}
                                maxTotalSizeMB={2.5}
                                compressionQuality={0.7}
                                maxWidth={1600}
                                maxHeight={1600}
                                isSensitive={true}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {payment.method === "Transferencia" && (
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-sm font-medium">
                            Información de Transferencia
                          </Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`transferencia-currency-${payment.id}`}
                                className="text-xs"
                              >
                                Moneda *
                              </Label>
                              <Select
                                value={
                                  (payment.currency && orderForm.selectedCurrencies.includes(payment.currency))
                                    ? payment.currency
                                    : orderForm.getDefaultCurrencyFromSelection()
                                }
                                onValueChange={(value: Currency) => {
                                  // Actualizar la moneda registrada
                                  updatePayment?.(
                                    payment.id,
                                    "currency",
                                    value
                                );

                                  // Si ya hay un originalAmount y originalCurrency guardados, 
                                  // solo actualizar la moneda y recalcular el amount en Bs
                                  const currentOriginalAmount = payment.paymentDetails?.originalAmount;
                                  const currentOriginalCurrency = payment.paymentDetails?.originalCurrency;
                                          
                                  if (currentOriginalAmount !== undefined && currentOriginalCurrency) {
                                    // Actualizar la moneda original
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                            
                                    // Si el monto original está en otra moneda, mantenerlo pero recalcular Bs
                                    // Si cambia a la misma moneda que ya tiene el originalAmount, mantenerlo
                                    if (value !== currentOriginalCurrency) {
                                      // Si cambia de moneda, mantener el originalAmount actual
                                      // y recalcular el amount en Bs basado en la nueva moneda
                                      let valueInBs = currentOriginalAmount;
                                      if (value !== "Bs") {
                                        const rate =
                                          value === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (rate && rate > 0) {
                                          valueInBs = currentOriginalAmount * rate;
                                          updatePaymentDetails?.(
                                            payment.id,
                                            "exchangeRate",
                                            rate
                                        );
                                        }
                                      } else {
                                        // Si cambia a Bs, el originalAmount ya está en Bs
                                        valueInBs = currentOriginalAmount;
                                      }
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        valueInBs
                                    );
                                    }
                                  } else if (payment.amount > 0) {
                                    // Si no hay originalAmount guardado pero hay amount, calcular desde amount
                                    let originalAmount = payment.amount;
                                    if (value !== "Bs") {
                                      const rate =
                                        value === "USD"
                                          ? orderForm.exchangeRates.USD?.rate
                                          : orderForm.exchangeRates.EUR?.rate;
                                      if (rate && rate > 0) {
                                        originalAmount = payment.amount / rate;
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "exchangeRate",
                                          rate
                                      );
                                      }
                                    }
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalAmount",
                                      originalAmount
                                  );
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  } else {
                                    // Si no hay monto aún, solo actualizar la moneda
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bs">
                                    Bolívares (Bs)
                                  </SelectItem>
                                  <SelectItem value="USD">
                                    Dólares (USD)
                                  </SelectItem>
                                  <SelectItem value="EUR">
                                    Euros (EUR)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Campo Monto después de Moneda */}
                            <div className="space-y-2">
                              <Label
                                htmlFor={`transferencia-amount-${payment.id}`}
                                className="text-xs"
                              >
                                Monto *
                              </Label>
                              <Input
                                id={`transferencia-amount-${payment.id}`}
                                type="number"
                                step="0.01"
                                value={(() => {
                                  if (payment.amount === 0) return "";
                                  // Si hay monto original guardado, usarlo
                                  if (
                                    payment.paymentDetails
                                      ?.originalAmount !== undefined
                                ) {
                                    return payment.paymentDetails
                                      .originalAmount;
                                  }
                                  // Fallback: calcular desde payment.amount
                                  const paymentCurrency =
                                    payment.currency || orderForm.getDefaultCurrencyFromSelection();
                                  if (paymentCurrency === "Bs") {
                                    return payment.amount;
                                  }
                                  const rate =
                                    paymentCurrency === "USD"
                                      ? orderForm.exchangeRates.USD?.rate
                                      : orderForm.exchangeRates.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return payment.amount / rate;
                                  }
                                  return payment.amount;
                                })()}
                                onChange={(e) => {
                                  const inputValue =
                                    Number.parseFloat(e.target.value) ||
                                    0;
                                  const paymentCurrency =
                                    payment.currency || orderForm.getDefaultCurrencyFromSelection();

                                  // SIEMPRE guardar el monto original en la moneda del pago
                                  // Esto asegura que siempre tengamos el valor original
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalAmount",
                                    inputValue
                                );
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalCurrency",
                                    paymentCurrency
                                );

                                  // También actualizar payment.currency si no está definida
                                  if (!payment.currency) {
                                    updatePayment?.(
                                      payment.id,
                                      "currency",
                                      paymentCurrency
                                  );
                                  }

                                  // Convertir a Bs según la moneda seleccionada
                                  let valueInBs = inputValue;
                                  if (paymentCurrency !== "Bs") {
                                    const rate =
                                      paymentCurrency === "USD"
                                        ? orderForm.exchangeRates.USD?.rate
                                        : orderForm.exchangeRates.EUR?.rate;
                                    if (rate && rate > 0) {
                                      valueInBs = inputValue * rate;
                                      // Guardar la tasa de cambio usada
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        rate
                                    );
                                    }
                                  } else {
                                    // Si es Bs, asegurar que el exchangeRate sea null/undefined
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      undefined
                                  );
                                  }
                                  updatePayment?.(
                                    payment.id,
                                    "amount",
                                    valueInBs
                                );
                                }}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`transferencia-account-${payment.id}`}
                                className="text-xs"
                              >
                                Banco Receptor *
                              </Label>
                              <Select
                                value={payment.paymentDetails?.accountId || undefined}
                                onValueChange={(value) => {
                                  const selectedAccount = orderForm.accounts.find(acc => acc.id === value);
                                  if (selectedAccount) {
                                    saveAccountInfoToPayment?.(payment.id, selectedAccount);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione un banco receptor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAccountsForPaymentMethod?.("Transferencia")
                                    .filter((account) => account.id && account.id.trim() !== "")
                                    .map((account) => (
                                      <SelectItem key={account.id} value={account.id}>
                                        <div className="flex flex-col">
                                          <span className="font-medium">
                                            {maskAccountNumber(account.accountNumber || "")}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {account.bank || ""}
                                          </span>
                                        </div>
                                      </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`transferencia-reference-${payment.id}`}
                                className="text-xs"
                              >
                                N° de Referencia *
                              </Label>
                              <Input
                                id={`transferencia-reference-${payment.id}`}
                                value={
                                  payment.paymentDetails
                                    ?.transferenciaReference || ""
                                }
                                onChange={(e) =>
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "transferenciaReference",
                                    e.target.value
                                )
                                }
                                placeholder="Ingrese el número de referencia"
                              />
                            </div>
                          </div>
                          
                          {/* Comprobante de Transferencia - Imágenes */}
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-medium">
                              Comprobante de Transferencia (Imágenes)
                            </Label>
                            {updatePaymentImages && (
                              <ImageUploader
                                images={payment.images || []}
                                onImagesChange={(images) => updatePaymentImages(payment.id, images)}
                                maxImages={3}
                                maxSizeMB={1}
                                maxTotalSizeMB={2.5}
                                compressionQuality={0.7}
                                maxWidth={1600}
                                maxHeight={1600}
                                isSensitive={true}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sección genérica para métodos que solo necesitan Moneda y Monto */}
                      {payment.method && 
                       payment.method !== "" && 
                       !["Pago Móvil", "Transferencia", "Efectivo"].includes(payment.method) && (
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-sm font-medium">
                            Información de {payment.method}
                          </Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {/* Campo Moneda - Oculto para métodos digitales */}
                            {!digitalPaymentMethods.includes(payment.method) && (
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-currency-${payment.id}`}
                                  className="text-xs"
                                >
                                  Moneda *
                                </Label>
                                <Select
                                  value={
                                    (payment.currency && orderForm.selectedCurrencies.includes(payment.currency))
                                      ? payment.currency
                                      : orderForm.getDefaultCurrencyFromSelection()
                                  }
                                  onValueChange={(value: Currency) => {
                                  // Actualizar la moneda registrada
                                  updatePayment?.(
                                    payment.id,
                                    "currency",
                                    value
                                );

                                  // Si ya hay un originalAmount y originalCurrency guardados, 
                                  // solo actualizar la moneda y recalcular el amount en Bs
                                  const currentOriginalAmount = payment.paymentDetails?.originalAmount;
                                  const currentOriginalCurrency = payment.paymentDetails?.originalCurrency;
                                          
                                  if (currentOriginalAmount !== undefined && currentOriginalCurrency) {
                                    // Actualizar la moneda original
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                            
                                    // Si el monto original está en otra moneda, mantenerlo pero recalcular Bs
                                    // Si cambia a la misma moneda que ya tiene el originalAmount, mantenerlo
                                    if (value !== currentOriginalCurrency) {
                                      // Si cambia de moneda, mantener el originalAmount actual
                                      // y recalcular el amount en Bs basado en la nueva moneda
                                      let valueInBs = currentOriginalAmount;
                                      if (value !== "Bs") {
                                        const rate =
                                          value === "USD"
                                            ? orderForm.exchangeRates.USD?.rate
                                            : orderForm.exchangeRates.EUR?.rate;
                                        if (rate && rate > 0) {
                                          valueInBs = currentOriginalAmount * rate;
                                          updatePaymentDetails?.(
                                            payment.id,
                                            "exchangeRate",
                                            rate
                                        );
                                        }
                                      } else {
                                        // Si cambia a Bs, el originalAmount ya está en Bs
                                        valueInBs = currentOriginalAmount;
                                      }
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        valueInBs
                                    );
                                    }
                                  } else if (payment.amount > 0) {
                                    // Si no hay originalAmount guardado pero hay amount, calcular desde amount
                                    let originalAmount = payment.amount;
                                    if (value !== "Bs") {
                                      const rate =
                                        value === "USD"
                                          ? orderForm.exchangeRates.USD?.rate
                                          : orderForm.exchangeRates.EUR?.rate;
                                      if (rate && rate > 0) {
                                        originalAmount = payment.amount / rate;
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "exchangeRate",
                                          rate
                                      );
                                      }
                                    }
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalAmount",
                                      originalAmount
                                  );
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  } else {
                                    // Si no hay monto aún, solo actualizar la moneda
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "originalCurrency",
                                      value
                                  );
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bs">
                                    Bolívares (Bs)
                                  </SelectItem>
                                  <SelectItem value="USD">
                                    Dólares (USD)
                                  </SelectItem>
                                  <SelectItem value="EUR">
                                    Euros (EUR)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-amount-${payment.id}`}
                                className="text-xs"
                              >
                                Monto *
                              </Label>
                              <Input
                                id={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-amount-${payment.id}`}
                                type="number"
                                step="0.01"
                                value={(() => {
                                  if (payment.amount === 0) return "";
                                  // Si hay monto original guardado, usarlo
                                  if (
                                    payment.paymentDetails
                                      ?.originalAmount !== undefined
                                ) {
                                    return payment.paymentDetails
                                      .originalAmount;
                                  }
                                  // Fallback: calcular desde payment.amount
                                  // Para métodos digitales, siempre usar USD
                                  const paymentCurrency = digitalPaymentMethods.includes(payment.method)
                                    ? "USD"
                                    : (payment.currency || orderForm.getDefaultCurrencyFromSelection());
                                  if (paymentCurrency === "Bs") {
                                    return payment.amount;
                                  }
                                  const rate =
                                    paymentCurrency === "USD"
                                      ? orderForm.exchangeRates.USD?.rate
                                      : orderForm.exchangeRates.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return payment.amount / rate;
                                  }
                                  return payment.amount;
                                })()}
                                onChange={(e) => {
                                  const inputValue =
                                    Number.parseFloat(e.target.value) ||
                                    0;
                                  // Para métodos digitales, siempre usar USD
                                  const paymentCurrency = digitalPaymentMethods.includes(payment.method)
                                    ? "USD"
                                    : (payment.currency || orderForm.getDefaultCurrencyFromSelection());

                                  // SIEMPRE guardar el monto original en la moneda del pago
                                  // Esto asegura que siempre tengamos el valor original
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalAmount",
                                    inputValue
                                );
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "originalCurrency",
                                    paymentCurrency
                                );

                                  // También actualizar payment.currency si no está definida
                                  if (!payment.currency) {
                                    updatePayment?.(
                                      payment.id,
                                      "currency",
                                      paymentCurrency
                                  );
                                  }

                                  // Convertir a Bs según la moneda seleccionada
                                  let valueInBs = inputValue;
                                  if (paymentCurrency !== "Bs") {
                                    const rate =
                                      paymentCurrency === "USD"
                                        ? orderForm.exchangeRates.USD?.rate
                                        : orderForm.exchangeRates.EUR?.rate;
                                    if (rate && rate > 0) {
                                      valueInBs = inputValue * rate;
                                      // Guardar la tasa de cambio usada
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        rate
                                    );
                                    }
                                  } else {
                                    // Si es Bs, asegurar que el exchangeRate sea null/undefined
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      undefined
                                  );
                                  }
                                  updatePayment?.(
                                    payment.id,
                                    "amount",
                                    valueInBs
                                );
                                }}
                                placeholder="0.00"
                              />
                            </div>
                            {/* Campo de cuenta para métodos bancarios y digitales */}
                            {["Banesco Panamá", "Mercantil Panamá", "Facebank", "Binance", "Paypal", "Zelle"].includes(payment.method) && (
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-account-${payment.id}`}
                                  className="text-xs"
                                >
                                  Cuenta {["Binance", "Paypal"].includes(payment.method) ? "(Digital)" : "(Bancaria)"} *
                                </Label>
                                <Select
                                  value={payment.paymentDetails?.accountId || undefined}
                                  onValueChange={(value) => {
                                    const selectedAccount = orderForm.accounts.find(acc => acc.id === value);
                                    if (selectedAccount) {
                                      saveAccountInfoToPayment?.(payment.id, selectedAccount);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        ["Binance", "Paypal"].includes(payment.method)
                                          ? "Seleccione cuenta digital"
                                          : "Seleccione cuenta bancaria"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAccountsForPaymentMethod?.(payment.method)
                                      .filter((account) => account.id && account.id.trim() !== "")
                                      .map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                          {account.accountType === "Cuentas Digitales" ? (
                                            <div className="flex flex-col">
                                              <span className="font-medium">
                                                {account.email || "Sin correo"}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {account.wallet || "Sin wallet"}
                                              </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                              <span className="font-medium">
                                                {maskAccountNumber(account.accountNumber || "")}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {account.bank || ""}
                                              </span>
                                            </div>
                                          )}
                                        </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {/* Campo ENVIA para Zelle */}
                            {payment.method === "Zelle" && (
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`zelle-envia-${payment.id}`}
                                  className="text-xs"
                                >
                                  ENVIA *
                                </Label>
                                <Input
                                  id={`zelle-envia-${payment.id}`}
                                  type="text"
                                  value={payment.paymentDetails?.envia || ""}
                                  onChange={(e) =>
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "envia",
                                      e.target.value
                                  )
                                  }
                                  placeholder="Nombre del titular de la cuenta que paga"
                                />
                              </div>
                            )}
                            
                            {/* Comprobante de Pago - Imágenes para métodos genéricos */}
                            {updatePaymentImages && (
                              <div className="space-y-2 pt-2 border-t col-span-full">
                                <Label className="text-xs font-medium">
                                  Comprobante de Pago (Imágenes)
                                </Label>
                                <ImageUploader
                                  images={payment.images || []}
                                  onImagesChange={(images) => updatePaymentImages(payment.id, images)}
                                  maxImages={3}
                                  maxSizeMB={1}
                                  maxTotalSizeMB={2.5}
                                  compressionQuality={0.7}
                                  maxWidth={1600}
                                  maxHeight={1600}
                                  isSensitive={true}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {payment.method === "Efectivo" && (
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-sm font-medium">
                            Información de Pago en Efectivo
                          </Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`cash-currency-${payment.id}`}
                                className="text-xs"
                              >
                                Moneda *
                              </Label>
                              <Select
                                value={
                                  (payment.paymentDetails?.cashCurrency && 
                                   orderForm.selectedCurrencies.includes(payment.paymentDetails.cashCurrency))
                                    ? payment.paymentDetails.cashCurrency
                                    : orderForm.getDefaultCurrencyFromSelection()
                                }
                                onValueChange={(value: Currency) => {
                                  // Actualizar cashCurrency
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "cashCurrency",
                                    value
                                );

                                  // ACTUALIZAR payment.currency también
                                  updatePayment?.(
                                    payment.id,
                                    "currency",
                                    value
                                );

                                  // Actualizar la tasa de cambio si es necesario
                                  const rate =
                                    value !== "Bs" &&
                                    orderForm.exchangeRates[value]
                                      ? orderForm.exchangeRates[value]?.rate || 1
                                      : 1;

                                  if (value !== "Bs") {
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      rate
                                  );
                                  }

                                  // Recalcular el amount en Bs basado en cashReceived
                                  const cashReceived =
                                    payment.paymentDetails
                                      ?.cashReceived || 0;
                                  if (cashReceived > 0) {
                                    const amountInBs =
                                      value === "Bs"
                                        ? cashReceived
                                        : cashReceived * rate;
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      amountInBs
                                  );
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bs">
                                    Bolívares (Bs)
                                  </SelectItem>
                                  <SelectItem value="USD">
                                    Dólares (USD)
                                  </SelectItem>
                                  <SelectItem value="EUR">
                                    Euros (EUR)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label
                                htmlFor={`cash-received-${payment.id}`}
                                className="text-xs"
                              >
                                Monto recibido del cliente *
                              </Label>
                              <Input
                                id={`cash-received-${payment.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  payment.paymentDetails
                                    ?.cashReceived || ""
                                }
                                onChange={(e) => {
                                  const received =
                                    parseFloat(e.target.value) || 0;

                                  // Guardar el monto recibido
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "cashReceived",
                                    received
                                );

                                  // Calcular y actualizar el amount en Bs automáticamente
                                  const currency =
                                    payment.paymentDetails
                                      ?.cashCurrency || "Bs";
                                  const rate =
                                    currency !== "Bs"
                                      ? payment.paymentDetails
                                          ?.exchangeRate ||
                                        orderForm.exchangeRates[currency]?.rate ||
                                        1
                                      : 1;

                                  // El amount siempre se guarda en Bs
                                  const amountInBs =
                                    currency === "Bs"
                                      ? received
                                      : received * rate;

                                  updatePayment?.(
                                    payment.id,
                                    "amount",
                                    amountInBs
                                );

                                  // Guardar/actualizar la tasa si no está guardada
                                  if (
                                    currency !== "Bs" &&
                                    !payment.paymentDetails
                                      ?.exchangeRate
                                ) {
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      orderForm.exchangeRates[currency]?.rate || 1
                                  );
                                  }
                                }}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          {payment.paymentDetails?.cashReceived &&
                            payment.paymentDetails.cashReceived > 0 && (
                              <>
                                {/* Mostrar el monto del pago calculado */}
                                <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-sm">
                                  <span className="font-medium">
                                    Monto del pago:{" "}
                                  </span>
                                  {formatCurrency(payment.amount, "Bs")}{" "}
                                  {(() => {
                                    const currency =
                                      payment.paymentDetails
                                        ?.cashCurrency;
                                    if (currency && currency !== "Bs") {
                                      return (
                                        <span className="text-xs text-muted-foreground">
                                          (
                                          {formatCurrency(
                                            payment.amount /
                                              (payment.paymentDetails
                                                ?.exchangeRate || 1),
                                            currency
                                      )}
                                    </span>
                                    );
                                    }
                                    return null;
                                  })()}
                                </div>

                                {/* Mostrar cambio si el cliente pagó más */}
                                {(() => {
                                  const paymentAmountInCurrency =
                                    payment.paymentDetails
                                      .cashCurrency === "Bs"
                                      ? payment.amount
                                      : payment.amount /
                                        (payment.paymentDetails
                                          .exchangeRate || 1);

                                  if (
                                    payment.paymentDetails
                                      .cashReceived >
                                    paymentAmountInCurrency
                                ) {
                                    return (
                                      <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                                        <span className="font-medium">
                                          Cambio/Vuelto:{" "}
                                        </span>
                                        {formatCurrency(
                                          payment.paymentDetails
                                            .cashReceived -
                                            paymentAmountInCurrency,
                                          payment.paymentDetails
                                            .cashCurrency as Currency
                                        )}
                                      </div>
                                  );
                                  }
                                  return null;
                                })()}
                              </>
                            )}
                            {payment.paymentDetails?.cashCurrency &&
                            payment.paymentDetails.cashCurrency !==
                              "Bs" && (
                              <p className="text-xs text-muted-foreground">
                                Tasa usada: 1{" "}
                                {payment.paymentDetails.cashCurrency} ={" "}
                                {payment.paymentDetails.exchangeRate?.toFixed(
                                  2
                              ) || "N/A"}{" "}
                                Bs
                              </p>
                            )}
                            
                            {/* Comprobante de Pago en Efectivo - Imágenes */}
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-xs font-medium">
                                Comprobante de Pago en Efectivo (Imágenes)
                              </Label>
                              {updatePaymentImages && (
                                <ImageUploader
                                  images={payment.images || []}
                                  onImagesChange={(images) => updatePaymentImages(payment.id, images)}
                                  maxImages={3}
                                  maxSizeMB={1}
                                  maxTotalSizeMB={2.5}
                                  compressionQuality={0.7}
                                  maxWidth={1600}
                                  maxHeight={1600}
                                  isSensitive={true}
                                />
                              )}
                            </div>
                        </div>
                      )}
                    </div>
                ))}

                  {/* Tabla de resumen de pagos - Similar a la tabla de orderForm.totales */}
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">
                                Concepto
                              </TableHead>
                              <TableHead className="text-right">
                                Monto
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {/* Total pagado */}
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm">
                                <span
                                  className={
                                    orderForm.isPaymentsValid
                                      ? "text-green-600 font-semibold"
                                      : "font-semibold"
                                  }
                                >
                                  Total pagado:
                                </span>
                              </TableCell>
                              {orderForm.renderCurrencyCell(
                                orderForm.totalPaidInBs,
                                orderForm.isPaymentsValid
                                  ? "text-green-600 font-semibold"
                                  : "font-semibold"
                              )}
                            </TableRow>

                            {/* Total del pedido */}
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm">
                                Total del pedido:
                              </TableCell>
                              {orderForm.renderCurrencyCell(orderForm.total)}
                            </TableRow>

                            {/* Falta / Cambio / Estado */}
                            <TableRow
                              className={`font-semibold border-t ${
                                orderForm.isPaymentsValid
                                  ? "text-green-600"
                                  : orderForm.remainingAmount > 0
                                  ? "text-orange-600"
                                  : "text-blue-600"
                              }`}
                            >
                              <TableCell className="text-sm sm:text-base">
                                {orderForm.remainingAmount === 0
                                  ? "Estado:"
                                  : orderForm.remainingAmount > 0
                                  ? "Falta:"
                                  : "Cambio/Vuelto:"}
                              </TableCell>
                              {orderForm.renderCurrencyCell(
                                Math.abs(orderForm.remainingAmount),
                                `text-sm sm:text-base font-semibold ${
                                  orderForm.isPaymentsValid
                                    ? "text-green-600"
                                    : orderForm.remainingAmount > 0
                                    ? "text-orange-600"
                                    : "text-blue-600"
                                }`
                              )}
                            </TableRow>
                          </TableBody>
                        </Table>
                        {orderForm.isPaymentsValid && (
                          <p className="text-xs text-green-600 text-center mt-2">
                            (Pagado completo)
                          </p>
                        )}
                      </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. OBSERVACIONES */}
          <div className="space-y-2">
            <Label
              htmlFor="generalObservations"
              className="text-sm sm:text-base"
            >
              Observaciones Generales
            </Label>
            <Textarea
              id="generalObservations"
              value={orderForm.generalObservations}
              onChange={(e) => orderForm.setGeneralObservations(e.target.value)}
              placeholder="Agregar observaciones generales para el pedido"
              rows={3}
              className="w-full"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Notas generales sobre el pedido
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Images Section - AQUÍ ES DONDE DEBES AGREGAR EL COMPONENTE DE IMÁGENES */}
      {/* TODO: Descomentar y usar cuando crees el componente ImageUploadSection */}
      {/* 
      <ImageUploadSection
        images={orderImages}
        onImagesChange={setOrderImages}
      />
      */}
    </div>
  );
}
