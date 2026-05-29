import type { Order, PartialPayment } from "@/lib/storage";
import {
  convertAmountBetween,
  isUsdBaseOrder,
  type ExchangeRatesInput,
} from "@/lib/order-line-pricing";
import {
  normalizeExchangeRatesAtCreation,
  type ExchangeRatesAtCreationRaw,
} from "@/lib/currency-utils";

/** Misma tolerancia que en formularios de pedido para saldo y validación. */
export const PAYMENT_BALANCE_EPSILON_BS = 0.1;
export const PAYMENT_BALANCE_EPSILON_USD = 0.01;

/** Contexto de tasas acepta Order, DTO API (null en USD/EUR) y presupuestos. */
export type PaymentOrderContext = {
  baseCurrency?: Order["baseCurrency"];
  exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
};

/** Monto del pago expresado en USD (moneda comercial del pedido nuevo). */
export function paymentToUsd(
  payment: PartialPayment,
  order?: PaymentOrderContext | null,
): number {
  const det = payment.paymentDetails;
  const originalCurrency = (det?.originalCurrency ??
    payment.currency ??
    "Bs") as "Bs" | "USD" | "EUR";
  const originalAmount =
    det?.originalAmount ??
    det?.cashReceived ??
    (originalCurrency === "Bs" ? payment.amount : payment.amount);

  if (originalCurrency === "USD") {
    return originalAmount ?? 0;
  }

  const rates: ExchangeRatesInput | undefined =
    order?.exchangeRatesAtCreation
      ? (normalizeExchangeRatesAtCreation(
          order.exchangeRatesAtCreation,
        ) as ExchangeRatesInput)
      : undefined;

  if (originalCurrency === "Bs") {
    const rate = det?.exchangeRate ?? rates?.USD?.rate;
    if (rate && rate > 0) return (payment.amount || 0) / rate;
    if (originalAmount && rates?.USD?.rate) {
      return originalAmount / rates.USD.rate;
    }
    return 0;
  }

  const converted = convertAmountBetween(
    originalAmount ?? payment.amount ?? 0,
    originalCurrency,
    "USD",
    rates,
  );
  return converted ?? 0;
}

export function sumPaymentsToUsd(
  payments: PartialPayment[],
  order?: PaymentOrderContext | null,
): number {
  return payments.reduce((sum, p) => {
    if (
      p.paymentDetails?.casheaFinancedPortion ||
      p.method === CASHEA_FINANCED_METHOD_LABEL
    ) {
      return sum;
    }
    return sum + paymentToUsd(p, order);
  }, 0);
}

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

export type OrderPendingTotalInput = PartialMixedPaymentsSource & {
  total: number;
  baseCurrency?: Order["baseCurrency"];
  exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
  appliedStoreCreditUsd?: number;
};

/** Saldo pendiente vs el total: USD si baseCurrency USD, si no Bs (legacy). */
export function getOrderPendingTotal(order: OrderPendingTotalInput): number {
  const payments = getActivePaymentsList(order);
  if (isUsdBaseOrder(order)) {
    const paidUsd = sumPaymentsToUsd(payments, order);
    const credit = order.appliedStoreCreditUsd ?? 0;
    return Math.max(0, order.total - credit - paidUsd);
  }
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const creditUsd = order.appliedStoreCreditUsd ?? 0;
  let creditBs = 0;
  if (creditUsd > 0 && order.exchangeRatesAtCreation) {
    const rates = normalizeExchangeRatesAtCreation(
      order.exchangeRatesAtCreation,
    );
    const rate = rates?.USD?.rate;
    if (rate && rate > 0) creditBs = creditUsd * rate;
  }
  return Math.max(0, order.total - totalPaid - creditBs);
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
    order.partialPayments && order.partialPayments.length > 0
      ? "partial"
      : "mixed";
  return { payments, paymentType };
}

/** Normaliza abonos para el backend: evita duplicar filas en reporte (partial + mixed) y rellena monto original en Bs si falta */
export function normalizePaymentsForSave(
  payments: PartialPayment[],
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
/**
 * Tras normalizar los cobros en tienda (una o más filas), añade si aplica la línea de saldo financiado por Cashea.
 * Ignora filas que ya sean la porción financiada (re-guardado / edición).
 *
 * @param orderTotalBs Monto total que deben cubrir entre sí los cobros en tienda y la financiación Cashea
 *   (alinear con `isPaymentsValid`: p. ej. `total - appliedCreditBsApprox` si el crédito no va en `total`).
 */
export function buildCasheaPaymentsForSave(
  normalizedPayments: PartialPayment[],
  orderTotalBs: number,
): PartialPayment[] {
  const inStore = normalizedPayments.filter(
    (p) =>
      !p.paymentDetails?.casheaFinancedPortion &&
      p.method !== CASHEA_FINANCED_METHOD_LABEL,
  );

  if (inStore.length === 0) {
    throw new Error("Cashea: se requiere al menos un cobro en tienda.");
  }

  const paidSum = inStore.reduce((s, p) => s + (p.amount || 0), 0);

  if (paidSum <= 0) {
    throw new Error("Cashea: el total cobrado en tienda debe ser mayor a 0.");
  }

  if (paidSum > orderTotalBs + PAYMENT_BALANCE_EPSILON_BS) {
    throw new Error(
      "Cashea: la suma de cobros en tienda supera el total a cubrir.",
    );
  }

  const remainder = orderTotalBs - paidSum;

  if (remainder <= PAYMENT_BALANCE_EPSILON_BS) {
    return inStore;
  }

  const stubAmount = Math.round(Math.max(0, remainder) * 100) / 100;
  const dateRef = inStore[0]?.date;

  const stub: PartialPayment = {
    id: `cashea-fin-${Date.now().toString(36)}`,
    amount: stubAmount,
    method: CASHEA_FINANCED_METHOD_LABEL,
    date: dateRef,
    currency: "Bs",
    paymentDetails: {
      casheaFinancedPortion: true,
      originalAmount: stubAmount,
      originalCurrency: "Bs",
    },
  };

  return [...inStore, stub];
}

function casheaInStorePayments(payments: PartialPayment[]): PartialPayment[] {
  return payments.filter(
    (p) =>
      !p.paymentDetails?.casheaFinancedPortion &&
      p.method !== CASHEA_FINANCED_METHOD_LABEL,
  );
}

/** Total a cubrir (inicial + financiación Cashea) en Bs para `buildCasheaPaymentsForSave`. */
export function getCasheaTotalDueBs(options: {
  totalDueUsd: number;
  totalDueBsLegacy?: number;
  useUsdTotals: boolean;
  usdRate?: number | null;
}): number {
  const dueUsd = Math.max(0, options.totalDueUsd);
  if (!options.useUsdTotals) {
    return Math.max(0, options.totalDueBsLegacy ?? dueUsd);
  }
  const rate = options.usdRate;
  if (rate && rate > 0) return dueUsd * rate;
  return dueUsd;
}

/** true si los cobros en tienda superan el total del pedido (respeta USD comercial vs Bs legacy). */
export function casheaInStorePaymentsExceedTotal(
  payments: PartialPayment[],
  options: {
    totalDueUsd: number;
    totalDueBsLegacy?: number;
    useUsdTotals: boolean;
    order?: PaymentOrderContext | null;
    usdRate?: number | null;
  },
): boolean {
  const inStore = casheaInStorePayments(payments);
  if (options.useUsdTotals) {
    const paidUsd = sumPaymentsToUsd(inStore, options.order);
    const capUsd =
      Math.max(0, options.totalDueUsd) + PAYMENT_BALANCE_EPSILON_USD;
    return paidUsd > capUsd;
  }
  const capBs =
    getCasheaTotalDueBs({
      totalDueUsd: options.totalDueUsd,
      totalDueBsLegacy: options.totalDueBsLegacy,
      useUsdTotals: false,
    }) + PAYMENT_BALANCE_EPSILON_BS;
  const paidBs = inStore.reduce((s, p) => s + (p.amount || 0), 0);
  return paidBs > capBs;
}

/** Suma solo lo cobrado en tienda (excluye la porción financiada automática en Cashea). */
export function sumPaymentsInStoreBs(payments: PartialPayment[]): number {
  return payments.reduce((sum, p) => {
    if (
      p.paymentDetails?.casheaFinancedPortion ||
      p.method === CASHEA_FINANCED_METHOD_LABEL
    ) {
      return sum;
    }
    return sum + (p.amount || 0);
  }, 0);
}

/** Para editar: quita la línea sintética de financiación y deja solo los cobros en tienda. */
export function filterCasheaStubForEditForm(
  order: Order,
  list: PartialPayment[],
): PartialPayment[] {
  if (order.paymentCondition !== "cashea") return list;
  return list.filter(
    (p) =>
      !p.paymentDetails?.casheaFinancedPortion &&
      p.method !== CASHEA_FINANCED_METHOD_LABEL,
  );
}
