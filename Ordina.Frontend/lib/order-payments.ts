import type { Order, PartialPayment } from "@/lib/storage";

/** Objeto con listas de abonos (pedido, listado unificado, etc.) */
export type PartialMixedPaymentsSource = {
  partialPayments?: PartialPayment[] | null | undefined;
  mixedPayments?: PartialPayment[] | null | undefined;
};

/**
 * Lista activa de abonos: si hay partialPayments con ítems, solo esos; si no, mixedPayments.
 * Igual que detalle del pedido, reporte y guardado multi-pago (partial vacío + mixed lleno).
 */
export function getActivePaymentsList(
  source: PartialMixedPaymentsSource,
): PartialPayment[] {
  if (source.partialPayments && source.partialPayments.length > 0) {
    return source.partialPayments;
  }
  if (source.mixedPayments && source.mixedPayments.length > 0) {
    return source.mixedPayments;
  }
  return [];
}

/** Misma regla que el detalle del pedido y el reporte backend: partial si existe, si no mixed */
export function getActivePaymentsForReport(order: Order): {
  payments: PartialPayment[];
  paymentType: "partial" | "mixed";
} {
  const payments = getActivePaymentsList(order);
  if (payments.length === 0) {
    return { payments: [], paymentType: "partial" };
  }
  const paymentType =
    order.partialPayments && order.partialPayments.length > 0 ? "partial" : "mixed";
  return { payments, paymentType };
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
