"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiClient, type ConfirmOrderDto, type OrderProductDto } from "@/lib/api-client";
import type { Order, OrderProduct, PartialPayment } from "@/lib/storage";
import { ProductSelectionDialog } from "@/components/orders/product-selection-dialog";
import { ProductEditDialog } from "@/components/orders/product-edit-dialog";
import { RemoveProductDialog } from "@/components/orders/remove-product-dialog";
import { PAYMENT_CONDITIONS } from "@/components/orders/new-order-dialog";
import {
  normalizePaymentsForSave,
  buildCasheaPaymentsForSave,
  PAYMENT_BALANCE_EPSILON_BS,
} from "@/lib/order-payments";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { paymentMethodsRequiringReceivingAccount } from "@/components/orders/constants";
import type { Currency } from "@/lib/currency-utils";

function mapProductsToDto(products: OrderProduct[]): OrderProductDto[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    quantity: p.quantity,
    total: p.total,
    category: p.category,
    stock: p.stock,
    attributes: p.attributes,
    discount: p.discount,
    observations: p.observations,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    availabilityStatus: p.availabilityStatus,
    manufacturingStatus: p.manufacturingStatus,
    manufacturingProviderId: p.manufacturingProviderId,
    manufacturingProviderName: p.manufacturingProviderName,
    manufacturingStartedAt: p.manufacturingStartedAt,
    manufacturingCompletedAt: p.manufacturingCompletedAt,
    manufacturingNotes: p.manufacturingNotes,
    locationStatus: p.locationStatus,
    logisticStatus: p.logisticStatus,
    surchargeEnabled: p.surchargeEnabled,
    surchargeAmount: p.surchargeAmount,
    surchargeReason: p.surchargeReason,
    refabricationReason: p.refabricationReason,
    refabricatedAt: p.refabricatedAt,
    refabricationHistory: p.refabricationHistory?.map((r) => ({
      reason: r.reason,
      date: r.date,
      previousProviderId: r.previousProviderId,
      previousProviderName: r.previousProviderName,
      newProviderId: r.newProviderId,
      newProviderName: r.newProviderName,
    })),
  }));
}

export interface ConfirmOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mongo id del PCF */
  pendingOrderId: string | null;
  onConfirmed?: (orderNumber: string) => void;
}

export function ConfirmOrderDialog({
  open,
  onOpenChange,
  pendingOrderId,
  onConfirmed,
}: ConfirmOrderDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pcfType, setPcfType] = useState<string | null>(null);
  const [pcfStatus, setPcfStatus] = useState<string | null>(null);
  const [clientLabel, setClientLabel] = useState("");
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [saleType, setSaleType] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<string>("");
  const [deliveryZone, setDeliveryZone] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [generalDiscountAmount, setGeneralDiscountAmount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [observations, setObservations] = useState("");
  const [hasDelivery, setHasDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [exchangeRatesAtCreation, setExchangeRatesAtCreation] = useState<
    ConfirmOrderDto["exchangeRatesAtCreation"]
  >();
  const [productMarkups, setProductMarkups] = useState<Record<string, number> | undefined>();
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false);
  const [postventaId, setPostventaId] = useState<string | undefined>();
  const [postventaName, setPostventaName] = useState<string | undefined>();
  const [deliveryServices, setDeliveryServices] = useState<Order["deliveryServices"]>();

  const [paymentCondition, setPaymentCondition] = useState<
    "cashea" | "pagara_en_tienda" | "pago_a_entrega" | "pago_parcial" | "todo_pago" | ""
  >("pagara_en_tienda");
  const [payments, setPayments] = useState<PartialPayment[]>([]);

  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<OrderProduct | null>(null);
  const [removingProduct, setRemovingProduct] = useState<OrderProduct | null>(null);

  const resetState = useCallback(() => {
    setPcfType(null);
    setPcfStatus(null);
    setClientLabel("");
    setProducts([]);
    setSaleType("");
    setDeliveryType("");
    setDeliveryZone("");
    setDeliveryCost(0);
    setGeneralDiscountAmount(0);
    setTaxEnabled(true);
    setObservations("");
    setHasDelivery(false);
    setDeliveryAddress("");
    setExchangeRatesAtCreation(undefined);
    setProductMarkups(undefined);
    setCreateSupplierOrder(false);
    setPostventaId(undefined);
    setPostventaName(undefined);
    setDeliveryServices(undefined);
    setPaymentCondition("pagara_en_tienda");
    setPayments([]);
  }, []);

  useEffect(() => {
    if (!open || !pendingOrderId) {
      resetState();
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const dto = await apiClient.getOrderById(pendingOrderId);
        if (cancelled) return;
        setPcfType(dto.type ?? "");
        setPcfStatus(dto.status ?? "");
        setClientLabel(`${dto.clientName} (${dto.clientId})`);
        setProducts(
          dto.products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
            total: p.total,
            category: p.category,
            stock: p.stock,
            attributes: p.attributes,
            discount: p.discount,
            observations: p.observations,
            images: p.images?.map((img) => ({
              id: img.id,
              base64: img.base64,
              filename: img.filename,
              type: img.type,
              uploadedAt: img.uploadedAt,
              size: img.size,
            })),
            availabilityStatus: p.availabilityStatus as OrderProduct["availabilityStatus"],
            manufacturingStatus: p.manufacturingStatus as OrderProduct["manufacturingStatus"],
            manufacturingProviderId: p.manufacturingProviderId,
            manufacturingProviderName: p.manufacturingProviderName,
            manufacturingStartedAt: p.manufacturingStartedAt,
            manufacturingCompletedAt: p.manufacturingCompletedAt,
            manufacturingNotes: p.manufacturingNotes,
            locationStatus: p.locationStatus as OrderProduct["locationStatus"],
            logisticStatus: p.logisticStatus,
            surchargeEnabled: p.surchargeEnabled,
            surchargeAmount: p.surchargeAmount,
            surchargeReason: p.surchargeReason,
            refabricationReason: p.refabricationReason,
            refabricatedAt: p.refabricatedAt,
            refabricationHistory: p.refabricationHistory,
          })),
        );
        setSaleType(dto.saleType ?? "");
        setDeliveryType(dto.deliveryType ?? "");
        setDeliveryZone(dto.deliveryZone ?? "");
        setDeliveryCost(dto.deliveryCost ?? 0);
        setGeneralDiscountAmount(dto.generalDiscountAmount ?? 0);
        setTaxEnabled((dto.taxAmount ?? 0) > 0.001);
        setObservations(dto.observations ?? "");
        setHasDelivery(dto.hasDelivery);
        setDeliveryAddress(dto.deliveryAddress ?? "");
        setExchangeRatesAtCreation(dto.exchangeRatesAtCreation);
        setProductMarkups(dto.productMarkups);
        setCreateSupplierOrder(dto.createSupplierOrder ?? false);
        setPostventaId(dto.postventaId);
        setPostventaName(dto.postventaName);
        setDeliveryServices(dto.deliveryServices as Order["deliveryServices"]);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("No se pudo cargar el pedido por confirmar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, pendingOrderId, resetState]);

  const productSubtotal = useMemo(
    () => products.reduce((s, p) => s + (p.total || 0), 0),
    [products],
  );
  const subtotal = productSubtotal;
  const taxAmount = taxEnabled ? subtotal * 0.16 : 0;
  const total = Math.max(0, subtotal + taxAmount + deliveryCost - generalDiscountAmount);

  const addPayment = () => {
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      currency: "Bs" as Currency,
      paymentDetails: {},
    };
    setPayments((prev) => [...prev, newPayment]);
  };

  const validatePayments = (): boolean => {
    if (paymentCondition === "pago_a_entrega" || paymentCondition === "pagara_en_tienda")
      return true;
    if (paymentCondition === "cashea") {
      if (payments.length !== 1) {
        toast.error("Cashea: registre exactamente un pago inicial.");
        return false;
      }
    } else if (payments.length === 0) {
      toast.error("Agrega al menos un pago.");
      return false;
    }
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const label = `Pago ${i + 1}`;
      if (!payment.method) {
        toast.error(`${label}: método requerido`);
        return false;
      }
      if (!payment.amount || payment.amount <= 0) {
        toast.error(`${label}: monto inválido`);
        return false;
      }
      if (
        (paymentMethodsRequiringReceivingAccount as readonly string[]).includes(payment.method) &&
        !payment.paymentDetails?.accountId
      ) {
        toast.error(`${label}: selecciona cuenta receptora`);
        return false;
      }
    }
    if (paymentCondition === "cashea" && payments[0] && payments[0].amount > total + PAYMENT_BALANCE_EPSILON_BS) {
      toast.error("El monto del pago inicial no puede superar el total.");
      return false;
    }
    return true;
  };

  const handleConfirm = async () => {
    if (!pendingOrderId || !user?.id) return;
    if (pcfType !== "PendingConfirmation" || pcfStatus !== "Por Confirmar") {
      toast.error("Este documento no se puede confirmar.");
      return;
    }
    if (products.length === 0) {
      toast.error("Debe haber al menos un producto.");
      return;
    }
    if (!paymentCondition) {
      toast.error("Selecciona condición de pago.");
      return;
    }
    if (!validatePayments()) return;

    let paymentsNorm = normalizePaymentsForSave(payments);
    if (paymentCondition === "cashea") {
      paymentsNorm = buildCasheaPaymentsForSave(paymentsNorm, total);
    }
    const multi = paymentsNorm.length > 1;

    const paymentType =
      paymentCondition === "pago_a_entrega" || paymentCondition === "cashea"
        ? "directo"
        : paymentCondition === "todo_pago"
          ? "directo"
          : "apartado";

    const paymentMethod =
      paymentCondition === "pago_a_entrega"
        ? "Pago a la entrega"
        : paymentCondition === "cashea"
          ? "Cashea"
          : paymentCondition === "pagara_en_tienda"
            ? "Pagará en Tienda"
            : multi
              ? "Mixto"
              : paymentsNorm[0]?.method || "";

    const body: ConfirmOrderDto = {
      storeVendorId: user.id,
      storeVendorName: user.name || user.username,
      products: mapProductsToDto(products),
      paymentType,
      paymentMethod,
      paymentCondition: paymentCondition || undefined,
      paymentDetails:
        paymentCondition === "pago_a_entrega" ||
        paymentCondition === "pagara_en_tienda" ||
        paymentsNorm.length === 0
          ? undefined
          : !multi
            ? paymentsNorm[0]?.paymentDetails
            : undefined,
      partialPayments:
        paymentCondition === "pago_a_entrega" || paymentCondition === "pagara_en_tienda"
          ? undefined
          : multi
            ? []
            : paymentsNorm,
      mixedPayments:
        paymentCondition === "pago_a_entrega" || paymentCondition === "pagara_en_tienda"
          ? undefined
          : multi
            ? paymentsNorm
            : undefined,
      saleType: saleType || undefined,
      deliveryType: deliveryType || undefined,
      deliveryZone: deliveryZone || undefined,
      deliveryAddress: hasDelivery ? deliveryAddress : undefined,
      hasDelivery,
      deliveryServices: hasDelivery ? deliveryServices : undefined,
      observations: observations.trim() || undefined,
      subtotal,
      taxAmount,
      deliveryCost,
      total,
      generalDiscountAmount: generalDiscountAmount > 0 ? generalDiscountAmount : undefined,
      productMarkups,
      createSupplierOrder,
      postventaId,
      postventaName,
      exchangeRatesAtCreation,
    };

    setSubmitting(true);
    try {
      const created = await apiClient.confirmPendingOrder(pendingOrderId, body);
      toast.success(`Pedido ${created.orderNumber} confirmado.`);
      onOpenChange(false);
      onConfirmed?.(created.orderNumber);
      resetState();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo confirmar el pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const canAddPayment =
    paymentCondition !== "pago_a_entrega" &&
    !(paymentCondition === "cashea" && payments.length >= 1);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar pedido (tienda)</DialogTitle>
            <DialogDescription>
              Revisa productos y completa el pago. Si cambias productos, la comisión se reparte entre tienda y vendedor
              online según las reglas.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Cargando…
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{clientLabel}</p>

              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" size="sm" variant="outline" onClick={() => setProductSelectOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar producto
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Total Bs</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingProduct(p);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRemovingProduct(p);
                            setRemoveOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid gap-2 sm:grid-cols-2 text-sm border-t pt-3">
                <div>Subtotal productos</div>
                <div className="text-right tabular-nums">
                  Bs. {subtotal.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
                <div>IVA (16%)</div>
                <div className="text-right tabular-nums">
                  Bs. {taxAmount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
                <div>Delivery</div>
                <div className="text-right tabular-nums">
                  Bs. {deliveryCost.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
                <div className="font-medium">Total</div>
                <div className="text-right font-medium tabular-nums">
                  Bs. {total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Condición de pago</Label>
                <Select
                  value={paymentCondition}
                  onValueChange={(v) =>
                    setPaymentCondition(
                      v as "cashea" | "pagara_en_tienda" | "pago_a_entrega" | "pago_parcial" | "todo_pago",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Condición" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentCondition !== "pago_a_entrega" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Pagos</Label>
                    {canAddPayment && (
                      <Button type="button" size="sm" variant="outline" onClick={addPayment}>
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar pago
                      </Button>
                    )}
                  </div>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin líneas de pago.</p>
                  ) : (
                    payments.map((pay) => (
                      <div key={pay.id} className="flex flex-wrap gap-2 items-end border rounded-md p-2">
                        <div className="flex-1 min-w-[120px]">
                          <Label className="text-xs">Método</Label>
                          <Select
                            value={pay.method}
                            onValueChange={(v) =>
                              setPayments((list) =>
                                list.map((p) => (p.id === pay.id ? { ...p, method: v } : p)),
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Efectivo">Efectivo</SelectItem>
                              <SelectItem value="Pago Móvil">Pago Móvil</SelectItem>
                              <SelectItem value="Transferencia">Transferencia</SelectItem>
                              <SelectItem value="Punto de Venta">Punto de Venta</SelectItem>
                              <SelectItem value="Zelle">Zelle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Monto Bs</Label>
                          <input
                            type="number"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                            value={pay.amount || ""}
                            onChange={(e) =>
                              setPayments((list) =>
                                list.map((p) =>
                                  p.id === pay.id ? { ...p, amount: Number(e.target.value) || 0 } : p,
                                ),
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPayments((list) => list.filter((p) => p.id !== pay.id))}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={loading || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirmando…
                </>
              ) : (
                "Confirmar pedido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductSelectionDialog
        open={productSelectOpen}
        onOpenChange={setProductSelectOpen}
        onProductsSelect={setProducts}
        selectedProducts={products}
      />

      <ProductEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={editingProduct}
        onProductUpdate={(updated) => {
          setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
          setEditOpen(false);
          setEditingProduct(null);
        }}
      />

      <RemoveProductDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        product={removingProduct}
        onConfirm={() => {
          if (removingProduct) {
            setProducts((list) => list.filter((p) => p.id !== removingProduct.id));
            setRemovingProduct(null);
            setRemoveOpen(false);
          }
        }}
      />
    </>
  );
}
