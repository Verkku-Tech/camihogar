"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { DeliveryServiceCostInput } from "../delivery-service-cost-input";
import { formatCurrency, type Currency } from "@/lib/currency-utils";
import { toast } from "sonner";
import { type PartialPayment, type ProductImage } from "@/lib/storage";
import { PAYMENT_BALANCE_EPSILON_USD } from "@/lib/order-payments";
import {
  todayPaymentDateYyyyMmDd,
  validatePaymentDateNotFuture,
} from "@/lib/exchange-rate-for-date";
import {
  applyBsOnlyPaymentAmountForDate,
  getEffectivePaymentDateYmd,
  resolvePaymentExchangeRate,
  syncPaymentRateOnDateChange,
} from "@/lib/order-payment-input";
import { formatPercentForDisplay } from "@/lib/product-discount-ui";
import { ImageUploader } from "../ImageUploader";
import {
  PAYMENT_CONDITIONS,
  PURCHASE_TYPES,
  type PurchaseTypeUiValue,
  DELIVERY_TYPES,
  DELIVERY_ZONES,
  paymentMethods,
  digitalPaymentMethods,
  bsOnlyPaymentMethods,
  paymentMethodUsesOnlyOfficialBsRate,
  efectivoCashExcludesManualBs,
  paymentMethodsRequiringReceivingAccount,
} from "../constants";

/** Parseo tolerante a coma decimal (es-VE); devuelve null si vacío o no numérico. */
function parseLocalePositiveNumber(raw: string): number | null {
  const s = raw.trim().replace(/,/g, ".");
  if (s === "" || s === ".") return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parsePercentInput(raw: string): number {
  const n = parseLocalePositiveNumber(raw);
  if (n === null) return 0;
  return Math.max(0, Math.min(n, 100));
}

/** `<input type="date" />` solo acepta yyyy-MM-dd; el API suele devolver ISO completo. */
function paymentDateToInputValue(date: string | undefined): string {
  if (date == null || String(date).trim() === "") return "";
  const s = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function PaymentCobroRateHint({
  paymentDate,
  exchangeRate,
  currency = "USD",
}: {
  paymentDate?: string;
  exchangeRate?: number;
  currency?: "USD" | "EUR";
}) {
  const dateYmd = paymentDateToInputValue(paymentDate);
  if (!dateYmd || exchangeRate == null || exchangeRate <= 0) return null;
  const [y, m, d] = dateYmd.split("-");
  const formattedDate = `${d}/${m}/${y}`;
  return (
    <p className="text-xs text-muted-foreground col-span-full">
      Tasa del cobro ({formattedDate}): 1 {currency} ={" "}
      {exchangeRate.toFixed(2)} Bs
    </p>
  );
}

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
  /** Cuando true (vendedor), solo se muestra la sección de pagos. */
  paymentsOnly?: boolean;
  /** Si false, no se muestra eliminar línea de pago (p. ej. vendedores sin orders.delete). Por defecto true. */
  allowRemovePayment?: boolean;
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
  paymentsOnly = false,
  allowRemovePayment = true,
}: Step3OrderDetailsProps) {
  const generalPctFocusedRef = useRef(false);
  const [generalPctDraft, setGeneralPctDraft] = useState("");

  useEffect(() => {
    if (orderForm.generalDiscountType !== "porcentaje") {
      generalPctFocusedRef.current = false;
      setGeneralPctDraft("");
      return;
    }
    if (generalPctFocusedRef.current) return;
    setGeneralPctDraft(
      orderForm.generalDiscount > 0
        ? formatPercentForDisplay(orderForm.generalDiscount)
        : "",
    );
  }, [orderForm.generalDiscountType, orderForm.generalDiscount]);

  const porcentajeEquivalentPreviewBs = useMemo(() => {
    if (orderForm.generalDiscountType !== "porcentaje") return 0;
    const t = orderForm.totalBeforeGeneralDiscount;
    if (t <= 0) return 0;
    const trimmed = generalPctDraft.trim();
    if (trimmed !== "") {
      const pct = parsePercentInput(trimmed);
      return Math.min((t * pct) / 100, t);
    }
    const p = Math.min(Math.max(orderForm.generalDiscount, 0), 100);
    return (t * p) / 100;
  }, [
    orderForm.generalDiscountType,
    orderForm.generalDiscount,
    orderForm.totalBeforeGeneralDiscount,
    generalPctDraft,
  ]);

  const applyPercentDraftFromBlur = () => {
    generalPctFocusedRef.current = false;
    const pct = parsePercentInput(generalPctDraft);
    orderForm.handleGeneralDiscountChange(pct);
    const pctClamped = Math.max(0, Math.min(pct, 100));
    setGeneralPctDraft(
      pctClamped > 0 ? formatPercentForDisplay(pctClamped) : "",
    );
  };

  const casheaOneLineOnly =
    orderForm.paymentCondition === "cashea" && orderForm.payments.length >= 1;

  const handlePaymentDateChange = async (
    payment: PartialPayment,
    dateValue: string,
  ) => {
    if (payment.paymentDetails?.isConciliated) {
      toast.error("No se puede cambiar la fecha de un pago conciliado.");
      return;
    }
    if (dateValue && !validatePaymentDateNotFuture(dateValue)) {
      toast.error("La fecha del cobro no puede ser futura.");
      return;
    }
    updatePayment?.(payment.id, "date", dateValue);
    await syncPaymentRateOnDateChange(
      payment,
      dateValue || todayPaymentDateYyyyMmDd(),
      {
        updatePayment,
        updatePaymentDetails,
        recalcForeignAmountInBs: true,
        showFallbackToast: true,
      },
    );
  };

  const resolveRateForPaymentLine = async (
    payment: PartialPayment,
    toCurrency: "USD" | "EUR",
  ): Promise<number | null> => {
    const { rate, usedFallbackToToday } = await resolvePaymentExchangeRate(
      payment.date,
      toCurrency,
    );
    if (usedFallbackToToday) {
      toast.warning(
        "No hay tasa registrada para esa fecha; se usó la tasa activa de hoy.",
      );
    }
    return rate;
  };

  const [storeCreditOfferOpen, setStoreCreditOfferOpen] = useState(false);
  const [storeCreditOfferDismissed, setStoreCreditOfferDismissed] =
    useState(false);

  useEffect(() => {
    setStoreCreditOfferDismissed(false);
  }, [orderForm.selectedClient?.id]);

  useEffect(() => {
    if (orderForm.isDraftGateBlocking) {
      setStoreCreditOfferOpen(false);
    }
  }, [orderForm.isDraftGateBlocking]);

  useEffect(() => {
    if (storeCreditOfferDismissed || storeCreditOfferOpen) return;
    if (orderForm.isDraftGateBlocking) return;
    if (!orderForm.selectedClient?.id) return;
    const bal = orderForm.clientStoreCreditBalanceUsd;
    if (bal == null || bal <= 0) return;
    if (
      orderForm.paymentCondition === "pago_a_entrega" ||
      orderForm.paymentCondition === "pagara_en_tienda"
    ) {
      return;
    }
    if (orderForm.appliedStoreCreditUsd > 0) return;
    setStoreCreditOfferOpen(true);
  }, [
    orderForm.isDraftGateBlocking,
    orderForm.selectedClient?.id,
    orderForm.clientStoreCreditBalanceUsd,
    orderForm.paymentCondition,
    orderForm.appliedStoreCreditUsd,
    storeCreditOfferDismissed,
    storeCreditOfferOpen,
  ]);

  const closeStoreCreditOffer = (dismiss: boolean) => {
    setStoreCreditOfferOpen(false);
    if (dismiss) setStoreCreditOfferDismissed(true);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AlertDialog
        open={storeCreditOfferOpen}
        onOpenChange={(open) => {
          setStoreCreditOfferOpen(open);
          if (!open) setStoreCreditOfferDismissed(true);
        }}
      >
        <AlertDialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Usar saldo a favor del cliente?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Este cliente tiene{" "}
                  <span className="font-medium text-foreground">
                    USD{" "}
                    {(orderForm.clientStoreCreditBalanceUsd ?? 0).toFixed(2)}
                  </span>{" "}
                  de crédito de tienda. Puede aplicarlo al total de este pedido
                  o dejarlo intacto y cobrar solo en caja.
                </p>
                <p>
                  Máximo aplicable a este pedido: USD{" "}
                  {orderForm.maxApplicableStoreCreditUsd.toFixed(2)}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogCancel
              type="button"
              className="mt-0 w-full sm:mt-0"
              onClick={() => {
                orderForm.setAppliedStoreCreditUsd(0);
                closeStoreCreditOffer(true);
              }}
            >
              No, no usar crédito
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => closeStoreCreditOffer(true)}
            >
              Elegir monto abajo
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                const bal = orderForm.clientStoreCreditBalanceUsd ?? 0;
                const cap = orderForm.maxApplicableStoreCreditUsd;
                const amount = Math.round(Math.min(bal, cap) * 100) / 100;
                orderForm.setAppliedStoreCreditUsd(amount);
                closeStoreCreditOffer(true);
              }}
            >
              Sí, aplicar todo lo posible
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">
            {paymentsOnly ? "Pagos del pedido" : "Servicios Adicionales"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 sm:space-y-6 p-4 sm:p-6">
          {!paymentsOnly && (
            <>
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
                          deliveryExpress: {
                            enabled: false,
                            cost: 0,
                            currency: "USD",
                          },
                          servicioAcarreo: {
                            enabled: false,
                            cost: undefined,
                            currency: "USD",
                          },
                          servicioArmado: {
                            enabled: false,
                            cost: 0,
                            currency: "USD",
                          },
                        });
                      }
                    }}
                  />
                  <Label
                    htmlFor="hasDelivery"
                    className="text-base font-medium"
                  >
                    ¿Requiere servicio adicional?
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
                          checked={
                            orderForm.deliveryServices.deliveryExpress
                              ?.enabled || false
                          }
                          onCheckedChange={(checked) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              deliveryExpress: {
                                enabled: checked as boolean,
                                cost: checked
                                  ? prev.deliveryExpress?.cost || 0
                                  : 0,
                                currency:
                                  prev.deliveryExpress?.currency || "USD",
                              },
                            }));
                          }}
                        />
                        <Label
                          htmlFor="deliveryExpress"
                          className="text-sm sm:text-base font-medium"
                        >
                          DELIVERY EXPRESS
                        </Label>
                      </div>
                      {orderForm.deliveryServices.deliveryExpress?.enabled && (
                        <DeliveryServiceCostInput
                          label="Gastos de Entrega"
                          cost={
                            orderForm.deliveryServices.deliveryExpress.cost || 0
                          }
                          currency={
                            orderForm.deliveryServices.deliveryExpress
                              .currency || "USD"
                          }
                          convertCurrencyValue={orderForm.convertCurrencyValue}
                          onChange={(cost, currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              deliveryExpress: {
                                enabled: true,
                                cost: cost ?? 0,
                                currency,
                              },
                            }));
                          }}
                        />
                      )}
                    </div>

                    {/* SERVICIO DE ACARREO */}
                    <div className="space-y-2 border-l-2 pl-4 border-primary/20">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="servicioAcarreo"
                          checked={
                            orderForm.deliveryServices.servicioAcarreo
                              ?.enabled || false
                          }
                          onCheckedChange={(checked) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioAcarreo: {
                                enabled: checked as boolean,
                                cost: checked
                                  ? prev.servicioAcarreo?.cost || undefined
                                  : undefined,
                                currency:
                                  prev.servicioAcarreo?.currency || "USD",
                              },
                            }));
                          }}
                        />
                        <Label
                          htmlFor="servicioAcarreo"
                          className="text-sm sm:text-base font-medium"
                        >
                          SERVICIO DE ACARREO
                        </Label>
                      </div>
                      {orderForm.deliveryServices.servicioAcarreo?.enabled && (
                        <DeliveryServiceCostInput
                          label="Precio (opcional)"
                          cost={orderForm.deliveryServices.servicioAcarreo.cost}
                          currency={
                            orderForm.deliveryServices.servicioAcarreo
                              .currency || "USD"
                          }
                          convertCurrencyValue={orderForm.convertCurrencyValue}
                          allowEmpty
                          placeholder="0.00 (opcional)"
                          onChange={(cost, currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioAcarreo: {
                                enabled: true,
                                cost,
                                currency,
                              },
                            }));
                          }}
                        />
                      )}
                    </div>

                    {/* SERVICIO DE ARMADO */}
                    <div className="space-y-2 border-l-2 pl-4 border-primary/20">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="servicioArmado"
                          checked={
                            orderForm.deliveryServices.servicioArmado
                              ?.enabled || false
                          }
                          onCheckedChange={(checked) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioArmado: {
                                enabled: checked as boolean,
                                cost: checked
                                  ? prev.servicioArmado?.cost || 0
                                  : 0,
                                currency:
                                  prev.servicioArmado?.currency || "USD",
                              },
                            }));
                          }}
                        />
                        <Label
                          htmlFor="servicioArmado"
                          className="text-sm sm:text-base font-medium"
                        >
                          SERVICIO DE ARMADO
                        </Label>
                      </div>
                      {orderForm.deliveryServices.servicioArmado?.enabled && (
                        <DeliveryServiceCostInput
                          label="Precio (obligatorio)"
                          cost={
                            orderForm.deliveryServices.servicioArmado.cost || 0
                          }
                          currency={
                            orderForm.deliveryServices.servicioArmado
                              .currency || "USD"
                          }
                          convertCurrencyValue={orderForm.convertCurrencyValue}
                          required
                          onChange={(cost, currency) => {
                            orderForm.setDeliveryServices((prev) => ({
                              ...prev,
                              servicioArmado: {
                                enabled: true,
                                cost: cost ?? 0,
                                currency,
                              },
                            }));
                          }}
                        />
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
                        <TableHead className="w-[200px]">Concepto</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Base imponible (descuentos por producto) */}
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm">
                          Base imponible (descuentos por producto):
                        </TableCell>
                        {orderForm.renderCurrencyCell(orderForm.subtotal)}
                      </TableRow>

                      {/* Impuesto con checkbox para habilitar/deshabilitar */}
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="tax-enabled"
                              checked={orderForm.taxEnabled}
                              onCheckedChange={(checked) =>
                                orderForm.setTaxEnabled(!!checked)
                              }
                            />
                            <label
                              htmlFor="tax-enabled"
                              className="cursor-pointer select-none"
                            >
                              Impuesto (16%):
                            </label>
                          </div>
                        </TableCell>
                        {orderForm.taxEnabled ? (
                          orderForm.renderCurrencyCell(orderForm.taxAmount)
                        ) : (
                          <TableCell className="text-right text-muted-foreground">
                            $ 0,00
                          </TableCell>
                        )}
                      </TableRow>

                      {orderForm.productSurchargeTotal > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm font-medium">
                            Sobreprecio:
                          </TableCell>
                          {orderForm.renderCurrencyCell(
                            orderForm.productSurchargeTotal,
                          )}
                        </TableRow>
                      )}

                      {/* Servicios complementarios (se suman después del impuesto) */}
                      {orderForm.deliveryServices.deliveryExpress?.enabled &&
                        orderForm.deliveryServices.deliveryExpress.cost > 0 && (
                          <TableRow>
                            <TableCell className="text-xs sm:text-sm font-medium">
                              Delivery Express:
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(
                                orderForm.deliveryServices.deliveryExpress.cost,
                                orderForm.deliveryServices.deliveryExpress
                                  .currency || "USD",
                              )}
                            </TableCell>
                          </TableRow>
                        )}

                      {orderForm.deliveryServices.servicioAcarreo?.enabled &&
                        orderForm.deliveryServices.servicioAcarreo.cost &&
                        orderForm.deliveryServices.servicioAcarreo.cost > 0 && (
                          <TableRow>
                            <TableCell className="text-xs sm:text-sm font-medium">
                              Servicio de Acarreo:
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(
                                orderForm.deliveryServices.servicioAcarreo.cost,
                                orderForm.deliveryServices.servicioAcarreo
                                  .currency || "USD",
                              )}
                            </TableCell>
                          </TableRow>
                        )}

                      {orderForm.deliveryServices.servicioArmado?.enabled &&
                        orderForm.deliveryServices.servicioArmado.cost > 0 && (
                          <TableRow>
                            <TableCell className="text-xs sm:text-sm font-medium">
                              Servicio de Armado:
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(
                                orderForm.deliveryServices.servicioArmado.cost,
                                orderForm.deliveryServices.servicioArmado
                                  .currency || "USD",
                              )}
                            </TableCell>
                          </TableRow>
                        )}

                      {/* Total */}
                      <TableRow className="font-medium border-t">
                        <TableCell className="text-xs sm:text-sm">
                          Total:
                        </TableCell>
                        {orderForm.renderCurrencyCell(
                          orderForm.totalBeforeGeneralDiscount,
                        )}
                      </TableRow>

                      {/* Descuento General */}
                      {orderForm.generalDiscountAmount > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm text-red-600">
                            Descuento General:
                          </TableCell>
                          {orderForm.renderCurrencyCellNegative(
                            orderForm.generalDiscountAmount,
                            "text-red-600",
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
                          "text-base sm:text-lg font-semibold",
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
                      <SelectItem value="porcentaje">Porcentaje</SelectItem>
                    </SelectContent>
                  </Select>
                  {orderForm.generalDiscountType === "monto" && (
                    <Select
                      value={orderForm.generalDiscountCurrency}
                      onValueChange={(value: Currency) => {
                        if (orderForm.generalDiscount > 0) {
                          const converted = orderForm.convertCurrencyValue(
                            orderForm.generalDiscount,
                            orderForm.generalDiscountCurrency,
                            value,
                          );
                          if (converted === null) {
                            toast.error(
                              "No hay tasa BCV para convertir el monto a esa moneda.",
                            );
                            return;
                          }
                          orderForm.setGeneralDiscount(converted);
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
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <div className="flex items-center gap-1 w-full sm:w-48">
                      {orderForm.generalDiscountType === "porcentaje" ? (
                        <Input
                          id="generalDiscount"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={generalPctDraft}
                          onChange={(e) => setGeneralPctDraft(e.target.value)}
                          onFocus={() => {
                            generalPctFocusedRef.current = true;
                          }}
                          onBlur={applyPercentDraftFromBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="0"
                          disabled={orderForm.selectedProducts.length === 0}
                          className="flex-1 min-w-0 w-full sm:w-48"
                        />
                      ) : (
                        <Input
                          id="generalDiscount"
                          type="number"
                          min="0"
                          step="0.01"
                          max={(() => {
                            const subtotal =
                              orderForm.subtotalAfterProductDiscounts;
                            const taxAmount = subtotal * 0.16;
                            const deliveryCost = orderForm.deliveryCost;
                            const totalBeforeGeneralDiscount =
                              subtotal + taxAmount + deliveryCost;
                            return totalBeforeGeneralDiscount;
                          })()}
                          value={
                            orderForm.generalDiscount === 0
                              ? ""
                              : orderForm.generalDiscount
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const inputValue = parseLocalePositiveNumber(raw);
                            if (inputValue === null) {
                              if (raw === "") orderForm.setGeneralDiscount(0);
                              return;
                            }
                            orderForm.setGeneralDiscount(inputValue);
                          }}
                          placeholder="0.00"
                          disabled={orderForm.selectedProducts.length === 0}
                          className="flex-1 min-w-0 w-full sm:w-48"
                        />
                      )}
                      {orderForm.generalDiscountType === "porcentaje" && (
                        <span className="text-sm text-muted-foreground shrink-0">
                          %
                        </span>
                      )}
                    </div>
                    {orderForm.generalDiscountType === "porcentaje" &&
                      porcentajeEquivalentPreviewBs > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Equivalente: −
                          {formatCurrency(porcentajeEquivalentPreviewBs, "Bs")}
                        </p>
                      )}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Este descuento se aplica al orderForm.total final (después de
                  impuestos y gastos de entrega).
                </p>
              </div>

              {/* 4. TIPO DE VENTA Y MÉTODO DE PAGO */}
              <div className="space-y-4">
                {/* Condición de Pago */}
                <div className="space-y-2">
                  <Label
                    htmlFor="orderForm.paymentCondition"
                    className="text-sm sm:text-base"
                  >
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
                          | "",
                      )
                    }
                  >
                    <SelectTrigger id="orderForm.paymentCondition">
                      <SelectValue placeholder="Seleccione la condición de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CONDITIONS.map((condition) => (
                        <SelectItem
                          key={condition.value}
                          value={condition.value}
                        >
                          {condition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo de Venta */}
                <div className="space-y-2">
                  <Label
                    htmlFor="orderForm.saleType"
                    className="text-sm sm:text-base"
                  >
                    Tipo de Venta <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={orderForm.saleType}
                    onValueChange={(value) =>
                      orderForm.setSaleType(value as PurchaseTypeUiValue)
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
                  <Label
                    htmlFor="orderForm.deliveryType"
                    className="text-sm sm:text-base"
                  >
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
                          | "",
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
                  <Label
                    htmlFor="orderForm.deliveryZone"
                    className="text-sm sm:text-base"
                  >
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
                          | "",
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
              </div>
            </>
          )}

          {/* Sección unificada de Pagos - funciona para todos los tipos de venta */}
          <div className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <Label className="text-sm sm:text-base">Pagos</Label>
                  {addPayment && (
                    //!casheaOneLineOnly
                    //&&
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
                  )}
                </div>
                {orderForm.paymentCondition === "cashea" && (
                  <p className="text-sm text-muted-foreground">
                    Cashea: registre un único pago inicial en tienda. Al guardar
                    el pedido, el saldo restante se registrará como financiación
                    Cashea.
                  </p>
                )}

                {orderForm.selectedClient &&
                  orderForm.paymentCondition !== "pago_a_entrega" &&
                  orderForm.paymentCondition !== "pagara_en_tienda" && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium">
                        Saldo a favor del cliente
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Disponible (USD):{" "}
                        {orderForm.clientStoreCreditBalanceUsd == null
                          ? "…"
                          : orderForm.clientStoreCreditBalanceUsd.toFixed(2)}
                      </p>
                      {(orderForm.clientStoreCreditBalanceUsd ?? 0) > 0 && (
                        <div className="flex flex-col gap-2 max-w-sm">
                          <Label
                            className="text-xs"
                            htmlFor="applied-store-credit-usd"
                          >
                            Aplicar crédito (USD)
                          </Label>
                          <Input
                            id="applied-store-credit-usd"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={orderForm.maxApplicableStoreCreditUsd}
                            step={0.01}
                            value={
                              orderForm.appliedStoreCreditUsd === 0
                                ? ""
                                : String(orderForm.appliedStoreCreditUsd)
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "" || raw === ".") {
                                orderForm.setAppliedStoreCreditUsd(0);
                                return;
                              }
                              const v = Number.parseFloat(
                                raw.replace(",", "."),
                              );
                              if (!Number.isFinite(v)) {
                                orderForm.setAppliedStoreCreditUsd(0);
                                return;
                              }
                              const cap = orderForm.maxApplicableStoreCreditUsd;
                              orderForm.setAppliedStoreCreditUsd(
                                Math.round(
                                  Math.max(0, Math.min(v, cap)) * 100,
                                ) / 100,
                              );
                            }}
                          />
                          {orderForm.appliedCreditBsApprox > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Equivalente en Bs del crédito aplicado:{" "}
                              {formatCurrency(
                                orderForm.appliedCreditBsApprox,
                                "Bs",
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {orderForm.payments.map((payment) => (
                  <fieldset
                    key={payment.id}
                    className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg min-w-0 border-border"
                  >
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
                      {/* Método primero */}
                      <div className="flex-1 w-full">
                        <Label className="text-xs">Método</Label>
                        <Select
                          value={payment.method}
                          onValueChange={(value) => {
                            updatePayment?.(payment.id, "method", value);
                            // Si se cambia a método digital (AirTM, Binance, Facebank, etc.), establecer automáticamente USD
                            if (digitalPaymentMethods.includes(value)) {
                              updatePayment?.(payment.id, "currency", "USD");
                              updatePaymentDetails?.(
                                payment.id,
                                "originalCurrency",
                                "USD",
                              );

                              if (payment.paymentDetails?.originalAmount) {
                                void (async () => {
                                  const rate = await resolveRateForPaymentLine(
                                    payment,
                                    "USD",
                                  );
                                  if (rate && rate > 0) {
                                    const valueInBs =
                                      payment.paymentDetails!.originalAmount! *
                                      rate;
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      valueInBs,
                                    );
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      rate,
                                    );
                                  }
                                })();
                              }
                            }
                            // Si se cambia a método solo Bs (Pago Móvil, Transferencia, TDD, TDC), forzar Bs
                            if (bsOnlyPaymentMethods.includes(value)) {
                              updatePayment?.(payment.id, "currency", "Bs");
                              updatePaymentDetails?.(
                                payment.id,
                                "originalCurrency",
                                "Bs",
                              );
                              void syncPaymentRateOnDateChange(
                                payment,
                                getEffectivePaymentDateYmd(payment.date),
                                {
                                  updatePaymentDetails,
                                  showFallbackToast: true,
                                },
                              );

                              if (payment.paymentDetails?.originalAmount) {
                                updatePayment?.(
                                  payment.id,
                                  "amount",
                                  payment.paymentDetails.originalAmount,
                                );
                              }
                            }
                            // Si se cambia a Efectivo, inicializar cashCurrency con la moneda del pago
                            if (value === "Efectivo") {
                              const currentCurrency =
                                payment.currency ||
                                orderForm.getDefaultCurrencyFromSelection();
                              updatePaymentDetails?.(
                                payment.id,
                                "cashCurrency",
                                currentCurrency,
                              );
                              // También actualizar payment.currency si no está definido
                              if (!payment.currency) {
                                updatePayment?.(
                                  payment.id,
                                  "currency",
                                  currentCurrency,
                                );
                              }
                              void (async () => {
                                const received =
                                  payment.paymentDetails?.cashReceived || 0;
                                if (currentCurrency === "Bs") {
                                  await syncPaymentRateOnDateChange(
                                    payment,
                                    getEffectivePaymentDateYmd(payment.date),
                                    {
                                      updatePaymentDetails,
                                      showFallbackToast: true,
                                    },
                                  );
                                  if (received > 0) {
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      received,
                                    );
                                  }
                                } else {
                                  const toCur =
                                    currentCurrency === "EUR" ? "EUR" : "USD";
                                  const rate =
                                    (await resolveRateForPaymentLine(
                                      payment,
                                      toCur,
                                    )) ?? 1;
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "exchangeRate",
                                    rate,
                                  );
                                  if (
                                    efectivoCashExcludesManualBs(currentCurrency)
                                  ) {
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "useCustomRate",
                                      false,
                                    );
                                  }
                                  if (received > 0) {
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      received * rate,
                                    );
                                  }
                                }
                              })();
                            } else {
                              // Si se cambia a un método diferente a Efectivo y había cashReceived, limpiarlo
                              updatePaymentDetails?.(
                                payment.id,
                                "cashReceived",
                                0,
                              );
                              updatePaymentDetails?.(
                                payment.id,
                                "cashCurrency",
                                "Bs",
                              );
                            }
                            if (paymentMethodUsesOnlyOfficialBsRate(value)) {
                              updatePaymentDetails?.(
                                payment.id,
                                "useCustomRate",
                                false,
                              );
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Método" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods
                              .filter(
                                (method) => method && method.trim() !== "",
                              )
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
                          value={paymentDateToInputValue(payment.date)}
                          disabled={!!payment.paymentDetails?.isConciliated}
                          onChange={(e) => {
                            void handlePaymentDateChange(
                              payment,
                              e.target.value,
                            );
                          }}
                          className="w-full"
                        />
                      </div>
                      {allowRemovePayment &&
                        removePayment &&
                        !payment.paymentDetails?.isConciliated && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePayment(payment.id)}
                            className="w-full sm:w-auto self-end sm:self-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="ml-2 sm:hidden">Eliminar</span>
                          </Button>
                        )}
                      {payment.paymentDetails?.isConciliated && (
                        <Badge
                          variant="secondary"
                          className="self-end text-[10px] shrink-0"
                        >
                          Conciliado
                        </Badge>
                      )}
                    </div>
                    <PaymentCobroRateHint
                      paymentDate={payment.date}
                      exchangeRate={payment.paymentDetails?.exchangeRate}
                      currency={
                        payment.paymentDetails?.cashCurrency === "EUR" ||
                        payment.paymentDetails?.originalCurrency === "EUR"
                          ? "EUR"
                          : "USD"
                      }
                    />

                    {/* Campos condicionales según método de pago */}
                    {payment.method === "Pago Móvil" && (
                      <div className="space-y-3 pt-2 border-t">
                        <Label className="text-sm font-medium">
                          Información de Pago Móvil
                        </Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Moneda fija: Bs (solo lectura) */}
                          <div className="space-y-2">
                            <Label className="text-xs">Moneda</Label>
                            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                              Bolívares (Bs)
                            </div>
                          </div>
                          {/* Campo Monto - siempre en Bs */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`pagomovil-amount-${payment.id}`}
                              className="text-xs"
                            >
                              Monto (Bs) *
                            </Label>
                            <Input
                              id={`pagomovil-amount-${payment.id}`}
                              type="number"
                              step="0.01"
                              value={payment.amount === 0 ? "" : payment.amount}
                              onChange={(e) => {
                                const inputValue =
                                  Number.parseFloat(e.target.value) || 0;
                                void applyBsOnlyPaymentAmountForDate(
                                  payment.id,
                                  inputValue,
                                  payment.date,
                                  updatePayment,
                                  updatePaymentDetails,
                                ).then(({ usedFallbackToToday }) => {
                                  if (usedFallbackToToday) {
                                    toast.warning(
                                      "No hay tasa para la fecha del cobro; se usó la tasa de hoy.",
                                    );
                                  }
                                });
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
                                payment.paymentDetails?.pagomovilReference || ""
                              }
                              onChange={(e) =>
                                updatePaymentDetails?.(
                                  payment.id,
                                  "pagomovilReference",
                                  e.target.value,
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
                              value={
                                payment.paymentDetails?.accountId || undefined
                              }
                              onValueChange={(value) => {
                                const selectedAccount = orderForm.accounts.find(
                                  (acc) => acc.id === value,
                                );
                                if (selectedAccount) {
                                  saveAccountInfoToPayment?.(
                                    payment.id,
                                    selectedAccount,
                                  );
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un banco receptor" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAccountsForPaymentMethod?.("Pago Móvil")
                                  .filter(
                                    (account) =>
                                      account.id && account.id.trim() !== "",
                                  )
                                  .map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {account.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {account.code}
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
                              onImagesChange={(images) =>
                                updatePaymentImages(payment.id, images)
                              }
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
                          {/* Moneda fija: Bs (solo lectura) */}
                          <div className="space-y-2">
                            <Label className="text-xs">Moneda</Label>
                            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                              Bolívares (Bs)
                            </div>
                          </div>
                          {/* Campo Monto - siempre en Bs */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`transferencia-amount-${payment.id}`}
                              className="text-xs"
                            >
                              Monto (Bs) *
                            </Label>
                            <Input
                              id={`transferencia-amount-${payment.id}`}
                              type="number"
                              step="0.01"
                              value={payment.amount === 0 ? "" : payment.amount}
                              onChange={(e) => {
                                const inputValue =
                                  Number.parseFloat(e.target.value) || 0;
                                void applyBsOnlyPaymentAmountForDate(
                                  payment.id,
                                  inputValue,
                                  payment.date,
                                  updatePayment,
                                  updatePaymentDetails,
                                ).then(({ usedFallbackToToday }) => {
                                  if (usedFallbackToToday) {
                                    toast.warning(
                                      "No hay tasa para la fecha del cobro; se usó la tasa de hoy.",
                                    );
                                  }
                                });
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
                              value={
                                payment.paymentDetails?.accountId || undefined
                              }
                              onValueChange={(value) => {
                                const selectedAccount = orderForm.accounts.find(
                                  (acc) => acc.id === value,
                                );
                                if (selectedAccount) {
                                  saveAccountInfoToPayment?.(
                                    payment.id,
                                    selectedAccount,
                                  );
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un banco receptor" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAccountsForPaymentMethod?.("Transferencia")
                                  .filter(
                                    (account) =>
                                      account.id && account.id.trim() !== "",
                                  )
                                  .map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {account.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {account.code}
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
                                  e.target.value,
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
                              onImagesChange={(images) =>
                                updatePaymentImages(payment.id, images)
                              }
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

                    {/* Tarjeta de Débito - Solo Bs con selector de banco */}
                    {payment.method === "Tarjeta de débito" && (
                      <div className="space-y-3 pt-2 border-t">
                        <Label className="text-sm font-medium">
                          Información de Tarjeta de Débito
                        </Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Moneda fija: Bs (solo lectura) */}
                          <div className="space-y-2">
                            <Label className="text-xs">Moneda</Label>
                            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                              Bolívares (Bs)
                            </div>
                          </div>
                          {/* Campo Monto - siempre en Bs */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`tdd-amount-${payment.id}`}
                              className="text-xs"
                            >
                              Monto (Bs) *
                            </Label>
                            <Input
                              id={`tdd-amount-${payment.id}`}
                              type="number"
                              step="0.01"
                              value={payment.amount === 0 ? "" : payment.amount}
                              onChange={(e) => {
                                const inputValue =
                                  Number.parseFloat(e.target.value) || 0;
                                void applyBsOnlyPaymentAmountForDate(
                                  payment.id,
                                  inputValue,
                                  payment.date,
                                  updatePayment,
                                  updatePaymentDetails,
                                ).then(({ usedFallbackToToday }) => {
                                  if (usedFallbackToToday) {
                                    toast.warning(
                                      "No hay tasa para la fecha del cobro; se usó la tasa de hoy.",
                                    );
                                  }
                                });
                              }}
                              placeholder="0.00"
                            />
                          </div>
                          {/* Selector de Banco */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`tdd-bank-${payment.id}`}
                              className="text-xs"
                            >
                              Banco *
                            </Label>
                            <Select
                              value={payment.paymentDetails?.bank || undefined}
                              onValueChange={(value) => {
                                updatePaymentDetails?.(
                                  payment.id,
                                  "bank",
                                  value,
                                );
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione el banco" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAccountsForPaymentMethod?.("Transferencia")
                                  .filter(
                                    (account) =>
                                      account.id && account.id.trim() !== "",
                                  )
                                  .map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.label || account.id}
                                    >
                                      {account.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Comprobante - Imágenes */}
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-xs font-medium">
                            Comprobante (Imágenes)
                          </Label>
                          {updatePaymentImages && (
                            <ImageUploader
                              images={payment.images || []}
                              onImagesChange={(images) =>
                                updatePaymentImages(payment.id, images)
                              }
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

                    {/* Tarjeta de Crédito - Solo Bs con selector de banco */}
                    {payment.method === "Tarjeta de Crédito" && (
                      <div className="space-y-3 pt-2 border-t">
                        <Label className="text-sm font-medium">
                          Información de Tarjeta de Crédito
                        </Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {/* Moneda fija: Bs (solo lectura) */}
                          <div className="space-y-2">
                            <Label className="text-xs">Moneda</Label>
                            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                              Bolívares (Bs)
                            </div>
                          </div>
                          {/* Campo Monto - siempre en Bs */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`tdc-amount-${payment.id}`}
                              className="text-xs"
                            >
                              Monto (Bs) *
                            </Label>
                            <Input
                              id={`tdc-amount-${payment.id}`}
                              type="number"
                              step="0.01"
                              value={payment.amount === 0 ? "" : payment.amount}
                              onChange={(e) => {
                                const inputValue =
                                  Number.parseFloat(e.target.value) || 0;
                                void applyBsOnlyPaymentAmountForDate(
                                  payment.id,
                                  inputValue,
                                  payment.date,
                                  updatePayment,
                                  updatePaymentDetails,
                                ).then(({ usedFallbackToToday }) => {
                                  if (usedFallbackToToday) {
                                    toast.warning(
                                      "No hay tasa para la fecha del cobro; se usó la tasa de hoy.",
                                    );
                                  }
                                });
                              }}
                              placeholder="0.00"
                            />
                          </div>
                          {/* Selector de Banco */}
                          <div className="space-y-2">
                            <Label
                              htmlFor={`tdc-bank-${payment.id}`}
                              className="text-xs"
                            >
                              Banco *
                            </Label>
                            <Select
                              value={payment.paymentDetails?.bank || undefined}
                              onValueChange={(value) => {
                                updatePaymentDetails?.(
                                  payment.id,
                                  "bank",
                                  value,
                                );
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione el banco" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAccountsForPaymentMethod?.("Transferencia")
                                  .filter(
                                    (account) =>
                                      account.id && account.id.trim() !== "",
                                  )
                                  .map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.label || account.id}
                                    >
                                      {account.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Comprobante - Imágenes */}
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-xs font-medium">
                            Comprobante (Imágenes)
                          </Label>
                          {updatePaymentImages && (
                            <ImageUploader
                              images={payment.images || []}
                              onImagesChange={(images) =>
                                updatePaymentImages(payment.id, images)
                              }
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
                      ![
                        "Pago Móvil",
                        "Transferencia",
                        "Tarjeta de débito",
                        "Tarjeta de Crédito",
                        "Efectivo",
                      ].includes(payment.method) && (
                        <div className="space-y-3 pt-2 border-t">
                          <Label className="text-sm font-medium">
                            Información de {payment.method}
                          </Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {/* Campo Moneda - Oculto para métodos digitales (USD) y métodos de solo Bs */}
                            {!digitalPaymentMethods.includes(payment.method) &&
                              !bsOnlyPaymentMethods.includes(
                                payment.method,
                              ) && (
                                <div className="space-y-2">
                                  <Label
                                    htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, "-")}-currency-${payment.id}`}
                                    className="text-xs"
                                  >
                                    Moneda *
                                  </Label>
                                  <Select
                                    value={
                                      payment.currency ||
                                      orderForm.getDefaultCurrencyFromSelection()
                                    }
                                    onValueChange={(value: Currency) => {
                                      // Actualizar la moneda registrada
                                      updatePayment?.(
                                        payment.id,
                                        "currency",
                                        value,
                                      );

                                      // Si ya hay un originalAmount y originalCurrency guardados,
                                      // solo actualizar la moneda y recalcular el amount en Bs
                                      const currentOriginalAmount =
                                        payment.paymentDetails?.originalAmount;
                                      const currentOriginalCurrency =
                                        payment.paymentDetails
                                          ?.originalCurrency;

                                      if (
                                        currentOriginalAmount !== undefined &&
                                        currentOriginalCurrency
                                      ) {
                                        // Actualizar la moneda original
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "originalCurrency",
                                          value,
                                        );

                                        // Si el monto original está en otra moneda, mantenerlo pero recalcular Bs
                                        // Si cambia a la misma moneda que ya tiene el originalAmount, mantenerlo
                                        if (value !== currentOriginalCurrency) {
                                          void (async () => {
                                            let valueInBs = currentOriginalAmount;
                                            if (value !== "Bs") {
                                              const toCur =
                                                value === "EUR" ? "EUR" : "USD";
                                              const rate =
                                                await resolveRateForPaymentLine(
                                                  payment,
                                                  toCur,
                                                );
                                              if (rate && rate > 0) {
                                                valueInBs =
                                                  currentOriginalAmount * rate;
                                                updatePaymentDetails?.(
                                                  payment.id,
                                                  "exchangeRate",
                                                  rate,
                                                );
                                              }
                                            }
                                            updatePayment?.(
                                              payment.id,
                                              "amount",
                                              valueInBs,
                                            );
                                          })();
                                        }
                                      } else if (payment.amount > 0) {
                                        void (async () => {
                                          let originalAmount = payment.amount;
                                          if (value !== "Bs") {
                                            const toCur =
                                              value === "EUR" ? "EUR" : "USD";
                                            const rate =
                                              await resolveRateForPaymentLine(
                                                payment,
                                                toCur,
                                              );
                                            if (rate && rate > 0) {
                                              originalAmount =
                                                payment.amount / rate;
                                              updatePaymentDetails?.(
                                                payment.id,
                                                "exchangeRate",
                                                rate,
                                              );
                                            }
                                          }
                                          updatePaymentDetails?.(
                                            payment.id,
                                            "originalAmount",
                                            originalAmount,
                                          );
                                          updatePaymentDetails?.(
                                            payment.id,
                                            "originalCurrency",
                                            value,
                                          );
                                        })();
                                      } else {
                                        // Si no hay monto aún, solo actualizar la moneda
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "originalCurrency",
                                          value,
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
                            {/* Indicador de moneda fija para métodos digitales */}
                            {digitalPaymentMethods.includes(payment.method) && (
                              <div className="space-y-2">
                                <Label className="text-xs">Moneda</Label>
                                <div className="flex items-center h-10 px-3 border rounded-md bg-muted text-muted-foreground text-sm">
                                  Dólares (USD)
                                </div>
                              </div>
                            )}
                            <div className="space-y-3 col-span-full">
                              {(() => {
                                let paymentCurrency: Currency;
                                if (
                                  digitalPaymentMethods.includes(payment.method)
                                ) {
                                  paymentCurrency = "USD";
                                } else if (
                                  bsOnlyPaymentMethods.includes(payment.method)
                                ) {
                                  paymentCurrency = "Bs";
                                } else {
                                  paymentCurrency =
                                    payment.currency ||
                                    orderForm.getDefaultCurrencyFromSelection();
                                }

                                const hideManualBs =
                                  paymentMethodUsesOnlyOfficialBsRate(
                                    payment.method,
                                  );

                                return (
                                  <>
                                    {paymentCurrency !== "Bs" &&
                                      !hideManualBs && (
                                        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md border">
                                          <Checkbox
                                            id={`custom-rate-${payment.id}`}
                                            checked={
                                              !!payment.paymentDetails
                                                ?.useCustomRate
                                            }
                                            onCheckedChange={(checked) => {
                                              updatePaymentDetails?.(
                                                payment.id,
                                                "useCustomRate",
                                                checked,
                                              );
                                              // Al desactivar, recalculamos basado en la tasa oficial
                                              if (!checked) {
                                                void (async () => {
                                                  const toCur =
                                                    paymentCurrency === "EUR"
                                                      ? "EUR"
                                                      : "USD";
                                                  const rate =
                                                    await resolveRateForPaymentLine(
                                                      payment,
                                                      toCur,
                                                    );
                                                  const origAmt =
                                                    payment.paymentDetails
                                                      ?.originalAmount || 0;
                                                  if (rate && rate > 0) {
                                                    updatePaymentDetails?.(
                                                      payment.id,
                                                      "exchangeRate",
                                                      rate,
                                                    );
                                                    updatePayment?.(
                                                      payment.id,
                                                      "amount",
                                                      origAmt * rate,
                                                    );
                                                  }
                                                })();
                                              }
                                            }}
                                          />
                                          <Label
                                            htmlFor={`custom-rate-${payment.id}`}
                                            className="text-xs font-medium cursor-pointer"
                                          >
                                            Tasa manual (Ingresar equivalente
                                            exacto en Bs)
                                          </Label>
                                        </div>
                                      )}

                                    {paymentCurrency !== "Bs" &&
                                      !hideManualBs &&
                                      !payment.paymentDetails
                                        ?.useCustomRate && (
                                        <p className="text-xs text-muted-foreground">
                                          El monto se convierte a Bs
                                          automáticamente usando la tasa del
                                          día. Si la tasa del banco difiere,
                                          activa &quot;Tasa manual&quot; arriba.
                                        </p>
                                      )}

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {/* Monto en Divisa */}
                                      <div className="space-y-2">
                                        <Label
                                          htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, "-")}-amount-${payment.id}`}
                                          className="text-xs"
                                        >
                                          Monto{" "}
                                          {digitalPaymentMethods.includes(
                                            payment.method,
                                          )
                                            ? "($)"
                                            : ""}{" "}
                                          *
                                        </Label>
                                        <Input
                                          id={`${payment.method.toLowerCase().replace(/\s+/g, "-")}-amount-${payment.id}`}
                                          type="number"
                                          step="0.01"
                                          value={(() => {
                                            if (payment.amount === 0) return "";
                                            if (
                                              payment.paymentDetails
                                                ?.originalAmount !== undefined
                                            ) {
                                              return payment.paymentDetails
                                                .originalAmount;
                                            }
                                            if (paymentCurrency === "Bs") {
                                              return payment.amount;
                                            }
                                            const rate =
                                              paymentCurrency === "USD"
                                                ? orderForm.exchangeRates.USD
                                                    ?.rate
                                                : orderForm.exchangeRates.EUR
                                                    ?.rate;
                                            if (rate && rate > 0) {
                                              return payment.amount / rate;
                                            }
                                            return payment.amount;
                                          })()}
                                          onChange={(e) => {
                                            const inputValue =
                                              Number.parseFloat(
                                                e.target.value,
                                              ) || 0;

                                            updatePaymentDetails?.(
                                              payment.id,
                                              "originalAmount",
                                              inputValue,
                                            );
                                            updatePaymentDetails?.(
                                              payment.id,
                                              "originalCurrency",
                                              paymentCurrency,
                                            );
                                            updatePayment?.(
                                              payment.id,
                                              "currency",
                                              paymentCurrency,
                                            );

                                            void (async () => {
                                              if (
                                                payment.paymentDetails
                                                  ?.useCustomRate &&
                                                !hideManualBs
                                              ) {
                                                if (payment.amount === 0) {
                                                  const toCur =
                                                    paymentCurrency === "EUR"
                                                      ? "EUR"
                                                      : "USD";
                                                  const rate =
                                                    await resolveRateForPaymentLine(
                                                      payment,
                                                      toCur,
                                                    );
                                                  if (rate && rate > 0) {
                                                    updatePayment?.(
                                                      payment.id,
                                                      "amount",
                                                      inputValue * rate,
                                                    );
                                                    updatePaymentDetails?.(
                                                      payment.id,
                                                      "exchangeRate",
                                                      rate,
                                                    );
                                                  }
                                                } else if (inputValue > 0) {
                                                  updatePaymentDetails?.(
                                                    payment.id,
                                                    "exchangeRate",
                                                    Number(
                                                      (
                                                        payment.amount /
                                                        inputValue
                                                      ).toFixed(4),
                                                    ),
                                                  );
                                                }
                                                return;
                                              }

                                              let valueInBs = inputValue;
                                              if (paymentCurrency !== "Bs") {
                                                const toCur =
                                                  paymentCurrency === "EUR"
                                                    ? "EUR"
                                                    : "USD";
                                                const rate =
                                                  await resolveRateForPaymentLine(
                                                    payment,
                                                    toCur,
                                                  );
                                                if (rate && rate > 0) {
                                                  valueInBs = inputValue * rate;
                                                  updatePaymentDetails?.(
                                                    payment.id,
                                                    "exchangeRate",
                                                    rate,
                                                  );
                                                } else {
                                                  updatePaymentDetails?.(
                                                    payment.id,
                                                    "exchangeRate",
                                                    undefined,
                                                  );
                                                }
                                              } else {
                                                updatePaymentDetails?.(
                                                  payment.id,
                                                  "exchangeRate",
                                                  undefined,
                                                );
                                              }
                                              updatePayment?.(
                                                payment.id,
                                                "amount",
                                                valueInBs,
                                              );
                                            })();
                                          }}
                                          placeholder="0.00"
                                        />
                                      </div>

                                      {/* Monto en Bolívares Equivalente */}
                                      {payment.paymentDetails?.useCustomRate &&
                                        paymentCurrency !== "Bs" &&
                                        !hideManualBs && (
                                          <div className="space-y-2">
                                            <Label
                                              htmlFor={`custom-bs-amount-${payment.id}`}
                                              className="text-xs"
                                            >
                                              Equivalente en Bs *
                                            </Label>
                                            <Input
                                              id={`custom-bs-amount-${payment.id}`}
                                              type="number"
                                              step="0.01"
                                              value={
                                                payment.amount === 0
                                                  ? ""
                                                  : payment.amount
                                              }
                                              onChange={(e) => {
                                                const bsValue =
                                                  Number.parseFloat(
                                                    e.target.value,
                                                  ) || 0;
                                                updatePayment?.(
                                                  payment.id,
                                                  "amount",
                                                  bsValue,
                                                );

                                                // Recalcular la tasa implícita
                                                const origAmt =
                                                  payment.paymentDetails
                                                    ?.originalAmount;
                                                if (origAmt && origAmt > 0) {
                                                  updatePaymentDetails?.(
                                                    payment.id,
                                                    "exchangeRate",
                                                    Number(
                                                      (
                                                        bsValue / origAmt
                                                      ).toFixed(4),
                                                    ),
                                                  );
                                                }
                                              }}
                                              placeholder="0.00"
                                            />
                                          </div>
                                        )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                            {/* Campo de cuenta para métodos bancarios y digitales */}
                            {(
                              paymentMethodsRequiringReceivingAccount as readonly string[]
                            ).includes(payment.method) && (
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, "-")}-account-${payment.id}`}
                                  className="text-xs"
                                >
                                  Cuenta{" "}
                                  {payment.method === "Binance"
                                    ? "(Digital)"
                                    : "(Bancaria)"}{" "}
                                  *
                                </Label>
                                <Select
                                  value={
                                    payment.paymentDetails?.accountId ||
                                    undefined
                                  }
                                  onValueChange={(value) => {
                                    const selectedAccount =
                                      orderForm.accounts.find(
                                        (acc) => acc.id === value,
                                      );
                                    if (selectedAccount) {
                                      saveAccountInfoToPayment?.(
                                        payment.id,
                                        selectedAccount,
                                      );
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        payment.method === "Binance"
                                          ? "Seleccione cuenta digital"
                                          : "Seleccione cuenta bancaria"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAccountsForPaymentMethod?.(
                                      payment.method,
                                    )
                                      .filter(
                                        (account) =>
                                          account.id &&
                                          account.id.trim() !== "",
                                      )
                                      .map((account) => (
                                        <SelectItem
                                          key={account.id}
                                          value={account.id}
                                        >
                                          {account.accountType ===
                                          "Cuentas Digitales" ? (
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
                                                {account.label}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {account.code}
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
                                      e.target.value,
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
                                  onImagesChange={(images) =>
                                    updatePaymentImages(payment.id, images)
                                  }
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
                                payment.paymentDetails?.cashCurrency ||
                                orderForm.getDefaultCurrencyFromSelection()
                              }
                              onValueChange={(value: Currency) => {
                                updatePaymentDetails?.(
                                  payment.id,
                                  "cashCurrency",
                                  value,
                                );
                                updatePayment?.(payment.id, "currency", value);

                                void (async () => {
                                  const cashReceived =
                                    payment.paymentDetails?.cashReceived || 0;
                                  if (value === "Bs") {
                                    await resolveRateForPaymentLine(
                                      payment,
                                      "USD",
                                    ).then((usdRate) => {
                                      if (usdRate && usdRate > 0) {
                                        updatePaymentDetails?.(
                                          payment.id,
                                          "exchangeRate",
                                          usdRate,
                                        );
                                      }
                                    });
                                    if (cashReceived > 0) {
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        cashReceived,
                                      );
                                    }
                                  } else {
                                    const toCur =
                                      value === "EUR" ? "EUR" : "USD";
                                    const rate =
                                      (await resolveRateForPaymentLine(
                                        payment,
                                        toCur,
                                      )) ?? 1;
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      rate,
                                    );
                                    if (cashReceived > 0) {
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        cashReceived * rate,
                                      );
                                    }
                                  }
                                })();

                                if (efectivoCashExcludesManualBs(value)) {
                                  updatePaymentDetails?.(
                                    payment.id,
                                    "useCustomRate",
                                    false,
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
                                <SelectItem value="EUR">Euros (EUR)</SelectItem>
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
                              value={payment.paymentDetails?.cashReceived || ""}
                              onChange={(e) => {
                                const received =
                                  parseFloat(e.target.value) || 0;

                                updatePaymentDetails?.(
                                  payment.id,
                                  "cashReceived",
                                  received,
                                );

                                const currency =
                                  payment.paymentDetails?.cashCurrency || "Bs";

                                updatePaymentDetails?.(
                                  payment.id,
                                  "originalAmount",
                                  received,
                                );
                                updatePaymentDetails?.(
                                  payment.id,
                                  "originalCurrency",
                                  currency,
                                );

                                void (async () => {
                                  if (currency === "Bs") {
                                    const usdRate =
                                      await resolveRateForPaymentLine(
                                        payment,
                                        "USD",
                                      );
                                    if (usdRate && usdRate > 0) {
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        usdRate,
                                      );
                                    }
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      received,
                                    );
                                  } else {
                                    const toCur =
                                      currency === "EUR" ? "EUR" : "USD";
                                    const rate =
                                      (await resolveRateForPaymentLine(
                                        payment,
                                        toCur,
                                      )) ?? 1;
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "exchangeRate",
                                      rate,
                                    );
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      received * rate,
                                    );
                                  }
                                })();
                              }}
                              placeholder="0.00"
                            />
                          </div>

                          {/* Equivalente en Bs Manual para Efectivo */}
                          {payment.paymentDetails?.useCustomRate &&
                            payment.paymentDetails.cashCurrency !== "Bs" &&
                            !efectivoCashExcludesManualBs(
                              payment.paymentDetails.cashCurrency,
                            ) && (
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`cash-custom-bs-${payment.id}`}
                                  className="text-xs"
                                >
                                  Equivalente en Bs *
                                </Label>
                                <Input
                                  id={`cash-custom-bs-${payment.id}`}
                                  type="number"
                                  step="0.01"
                                  value={
                                    payment.amount === 0 ? "" : payment.amount
                                  }
                                  onChange={(e) => {
                                    const bsValue =
                                      Number.parseFloat(e.target.value) || 0;
                                    updatePayment?.(
                                      payment.id,
                                      "amount",
                                      bsValue,
                                    );

                                    // Recalcular la tasa implícita
                                    const received =
                                      payment.paymentDetails?.cashReceived;
                                    if (received && received > 0) {
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        Number((bsValue / received).toFixed(4)),
                                      );
                                    }
                                  }}
                                  placeholder="0.00"
                                />
                              </div>
                            )}

                          {/* Tasa Manual Switch */}
                          {payment.paymentDetails?.cashCurrency &&
                            payment.paymentDetails.cashCurrency !== "Bs" &&
                            !efectivoCashExcludesManualBs(
                              payment.paymentDetails.cashCurrency,
                            ) && (
                              <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md border col-span-full">
                                <Checkbox
                                  id={`cash-custom-rate-${payment.id}`}
                                  checked={
                                    !!payment.paymentDetails?.useCustomRate
                                  }
                                  onCheckedChange={(checked) => {
                                    updatePaymentDetails?.(
                                      payment.id,
                                      "useCustomRate",
                                      checked,
                                    );
                                    if (!checked) {
                                      const currency =
                                        payment.paymentDetails?.cashCurrency ||
                                        "Bs";
                                      const rate =
                                        currency !== "Bs"
                                          ? orderForm.exchangeRates[currency]
                                              ?.rate || 1
                                          : 1;
                                      const received =
                                        payment.paymentDetails?.cashReceived ||
                                        0;
                                      updatePaymentDetails?.(
                                        payment.id,
                                        "exchangeRate",
                                        rate,
                                      );
                                      updatePayment?.(
                                        payment.id,
                                        "amount",
                                        currency === "Bs"
                                          ? received
                                          : received * rate,
                                      );
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`cash-custom-rate-${payment.id}`}
                                  className="text-xs font-medium cursor-pointer"
                                >
                                  Tasa manual (Ingresar equivalente exacto en
                                  Bs)
                                </Label>
                              </div>
                            )}
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
                                    payment.paymentDetails?.cashCurrency;
                                  if (currency && currency !== "Bs") {
                                    return (
                                      <span className="text-xs text-muted-foreground">
                                        (
                                        {formatCurrency(
                                          payment.amount /
                                            (payment.paymentDetails
                                              ?.exchangeRate || 1),
                                          currency,
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
                                  payment.paymentDetails.cashCurrency === "Bs"
                                    ? payment.amount
                                    : payment.amount /
                                      (payment.paymentDetails.exchangeRate ||
                                        1);

                                if (
                                  payment.paymentDetails.cashReceived >
                                  paymentAmountInCurrency
                                ) {
                                  return (
                                    <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                                      <span className="font-medium">
                                        Cambio/Vuelto:{" "}
                                      </span>
                                      {formatCurrency(
                                        payment.paymentDetails.cashReceived -
                                          paymentAmountInCurrency,
                                        payment.paymentDetails
                                          .cashCurrency as Currency,
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                        {payment.paymentDetails?.cashCurrency &&
                          payment.paymentDetails.cashCurrency !== "Bs" && (
                            <p className="text-xs text-muted-foreground">
                              Tasa usada: 1{" "}
                              {payment.paymentDetails.cashCurrency} ={" "}
                              {payment.paymentDetails.exchangeRate?.toFixed(
                                2,
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
                              onImagesChange={(images) =>
                                updatePaymentImages(payment.id, images)
                              }
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
                  </fieldset>
                ))}

                {/* Tabla de resumen de pagos - Similar a la tabla de orderForm.totales */}
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Concepto</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Total pagado */}
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm">
                          Total pagado (cobros en tienda):
                        </TableCell>
                        {orderForm.renderPaymentTotalCell(
                          orderForm.totalPaidUsd,
                          orderForm.isPaymentsValid
                            ? "text-green-600 font-semibold"
                            : "font-semibold",
                          true,
                        )}
                      </TableRow>

                      {orderForm.appliedCreditBsApprox > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
                            Crédito tienda aplicado:
                          </TableCell>
                          {orderForm.renderCurrencyCellNegative(
                            orderForm.appliedCreditBsApprox,
                            "text-emerald-800 dark:text-emerald-200 [&>div.font-medium]:text-emerald-900 dark:[&>div.font-medium]:text-emerald-100 [&>div.text-muted-foreground]:text-emerald-800/90 dark:[&>div.text-muted-foreground]:text-emerald-200/85",
                          )}
                        </TableRow>
                      )}

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
                            : orderForm.remainingAmountUsd > 0
                              ? "text-orange-600"
                              : "text-blue-600"
                        }`}
                      >
                        <TableCell className="text-sm sm:text-base">
                          {Math.abs(orderForm.remainingAmountUsd) <
                          PAYMENT_BALANCE_EPSILON_USD
                            ? "Estado:"
                            : orderForm.remainingAmountUsd > 0
                              ? "Falta:"
                              : "Cambio/Vuelto:"}
                        </TableCell>
                        {orderForm.renderPaymentTotalCell(
                          Math.abs(orderForm.remainingAmountUsd),
                          `text-sm sm:text-base font-semibold ${
                            orderForm.isPaymentsValid
                              ? "text-green-600"
                              : orderForm.remainingAmountUsd > 0
                                ? "text-orange-600"
                                : "text-blue-600"
                          }`,
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                  {Math.abs(orderForm.remainingAmountUsd) <
                    PAYMENT_BALANCE_EPSILON_USD && (
                    <p className="text-xs text-green-600 text-center mt-2">
                      (Pagado completo)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!paymentsOnly && (
            <>
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
                  onChange={(e) =>
                    orderForm.setGeneralObservations(e.target.value)
                  }
                  placeholder="Agregar observaciones generales para el pedido"
                  rows={3}
                  className="w-full"
                />
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Notas generales sobre el pedido
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <label
              htmlFor="dispatchObservations"
              className="text-sm sm:text-base"
            >
              Observaciones de despacho
            </label>

            <Textarea
              id="dispatchObservations"
              value={orderForm.dispatchObservations}
              onChange={(e) =>
                orderForm.setDispatchObservations(e.target.value)
              }
              placeholder="Agregar observaciones generales para el despacho"
              rows={3}
              className="w-full"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Notas generales sobre el despacho
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
