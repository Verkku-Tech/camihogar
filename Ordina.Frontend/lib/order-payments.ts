import type { Order, PartialPayment } from "@/lib/storage";

/** Misma tolerancia que en formularios de pedido para saldo y validación. */
export const PAYMENT_BALANCE_EPSILON_BS = 0.1;

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

/** Saldo pendiente vs el total (Bs): partial si tiene ítems, si no mixed. */
export function getOrderPendingTotal(
  order: PartialMixedPaymentsSource & { total: number }
): number {
  const totalPaid = getActivePaymentsList(order).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );
  return Math.max(0, order.total - totalPaid);
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

/** Líneas guardadas en pedido Cashea: el stub sintético tiene este método. */
export const CASHEA_FINANCED_METHOD_LABEL = "Cashea (financiación)";

/**
 * Tras normalizar exactamente el pago inicial, añade (si aplica) la línea de saldo financiado por Cashea.
 */
export function buildCasheaPaymentsForSave(
  normalizedInitialOneRow: PartialPayment[],
  orderTotalBs: number,
): PartialPayment[] {
  if (normalizedInitialOneRow.length !== 1) {
    throw new Error("Cashea: se requiere exactamente un pago inicial.");
  }
  const first = normalizedInitialOneRow[0];
  const initialAmt = first.amount || 0;
  const remainder = orderTotalBs - initialAmt;
  if (remainder <= PAYMENT_BALANCE_EPSILON_BS) {
    return [first];
  }
  const stubAmount = Math.round(Math.max(0, remainder) * 100) / 100;
  const stub: PartialPayment = {
    id: `cashea-fin-${Date.now().toString(36)}`,
    amount: stubAmount,
    method: CASHEA_FINANCED_METHOD_LABEL,
    date: first.date,
    currency: "Bs",
    paymentDetails: {
      casheaFinancedPortion: true,
      originalAmount: stubAmount,
      originalCurrency: "Bs",
    },
  };
  return [first, stub];
}

/** Suma solo lo cobrado en tienda (excluye la porción financiada automática en Cashea). */
export function sumPaymentsInStoreBs(payments: PartialPayment[]): number {
  return payments.reduce((sum, p) => {
    if (p.paymentDetails?.casheaFinancedPortion) return sum;
    return sum + (p.amount || 0);
  }, 0);
}

/** Para editar: quita la línea sintética y deja solo el abono inicial en el formulario. */
export function filterCasheaStubForEditForm(
  order: Order,
  list: PartialPayment[],
): PartialPayment[] {
  if (order.paymentCondition !== "cashea") return list;
  return list.filter((p) => !p.paymentDetails?.casheaFinancedPortion);
}
