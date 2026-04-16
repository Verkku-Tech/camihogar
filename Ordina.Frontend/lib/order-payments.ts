import type { Order, PartialPayment } from "@/lib/storage";

/** Misma regla que el detalle del pedido y el reporte backend: partial si existe, si no mixed */
export function getActivePaymentsForReport(order: Order): {
  payments: PartialPayment[];
  paymentType: "partial" | "mixed";
} {
  if (order.partialPayments && order.partialPayments.length > 0) {
    return { payments: order.partialPayments, paymentType: "partial" };
  }
  if (order.mixedPayments && order.mixedPayments.length > 0) {
    return { payments: order.mixedPayments, paymentType: "mixed" };
  }
  return { payments: [], paymentType: "partial" };
}

/** Normaliza abonos para el backend: evita duplicar filas en reporte (partial + mixed) y rellena monto original en Bs si falta */
export function normalizePaymentsForSave(
  payments: PartialPayment[]
): PartialPayment[] {
  return payments.map((p) => {
    const base = { ...(p.paymentDetails || {}) } as NonNullable<
      PartialPayment["paymentDetails"]
    >;
    if (
      p.amount > 0 &&
      base.originalAmount === undefined &&
      base.cashReceived === undefined
    ) {
      base.originalAmount = p.amount;
      base.originalCurrency =
        (p.currency as "Bs" | "USD" | "EUR" | undefined) || "Bs";
    }
    const hasDetail = Object.keys(base).some((k) => {
      const v = base[k as keyof typeof base];
      return v !== undefined && v !== null && v !== "";
    });
    return {
      ...p,
      paymentDetails: hasDetail ? base : undefined,
    };
  });
}
