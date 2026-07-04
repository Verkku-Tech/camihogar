/**
 * Display y totales comerciales: USD fijo para deuda; Bs informativo con tasa viva;
 * legacy Bs usa tasa del pedido (exchangeRatesAtCreation) para el $ mostrado.
 */
import {
  formatCurrency,
  getActiveExchangeRates,
  normalizeExchangeRatesAtCreation,
  type Currency,
  type ExchangeRate,
  type ExchangeRatesAtCreationRaw,
} from "@/lib/currency-utils";
import {
  getOrderBaseCurrency,
  getUsdRate,
  inferOrderBaseCurrency,
  isUsdBaseOrder,
  type ExchangeRatesInput,
} from "@/lib/order-line-pricing";
import {
  getActivePaymentsList,
  getOrderPendingTotal,
  isCasheaCommerciallySettled,
  sumPaymentBsEquivalentsForDisplay,
  sumPaymentsToUsd,
  type PartialMixedPaymentsSource,
  type PaymentOrderContext,
} from "@/lib/order-payments";
import type { Order, OrderProduct, PartialPayment } from "@/lib/storage";

export type DualCurrencyFormatted = {
  primary: string;
  secondary?: string;
};

export type CommercialRatesMap = {
  USD?: ExchangeRate;
  EUR?: ExchangeRate;
};

/** Pedido, presupuesto o fila con totales para display e inferencia de moneda base. */
export type OrderAmountDisplayInput = {
  total?: number;
  baseCurrency?: Currency;
  exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
  products?: { priceCurrency?: Currency }[];
};

export function getDisplayBaseCurrency(
  order: OrderAmountDisplayInput,
): Currency {
  return inferOrderBaseCurrency(order);
}

export function formatOrderAmountForDisplay(
  amount: number,
  order: OrderAmountDisplayInput,
  liveRates?: ExchangeRatesInput,
): string {
  const base = getDisplayBaseCurrency(order);
  const commercial = commercialRatesToExchangeRatesInput(
    getCommercialRatesFromOrder(order),
  );
  const live =
    liveRates ??
    commercialRatesToExchangeRatesInput(getCommercialRatesFromOrder(order));
  return formatCommercialDualDisplay(amount, base, {
    commercialRates: commercial,
    liveRates: live,
  });
}

/** Solo USD comercial (sin Bs entre paréntesis). */
export function formatOrderAmountUsdOnly(
  amount: number,
  order: OrderAmountDisplayInput,
): string {
  const base = getDisplayBaseCurrency(order);
  if (base === "USD") {
    return formatCurrency(amount, "USD");
  }
  const rate = getUsdRate(
    commercialRatesToExchangeRatesInput(getCommercialRatesFromOrder(order)),
  );
  if (rate && rate > 0) {
    return formatCurrency(amount / rate, "USD");
  }
  return formatCurrency(amount, "Bs");
}

export async function formatOrderAmountForDisplayAsync(
  amount: number,
  order: OrderAmountDisplayInput,
  fallbackLiveRates?: CommercialRatesMap,
): Promise<string> {
  let live = fallbackLiveRates
    ? commercialRatesToExchangeRatesInput(fallbackLiveRates)
    : undefined;
  if (!live?.USD?.rate) {
    const active = await getActiveExchangeRates();
    live = commercialRatesToExchangeRatesInput({
      USD: active.USD,
      EUR: active.EUR,
    });
  }
  return formatOrderAmountForDisplay(amount, order, live);
}

export async function formatOrderAmountUsdOnlyAsync(
  amount: number,
  order: OrderAmountDisplayInput,
): Promise<string> {
  return formatOrderAmountUsdOnly(amount, order);
}

/**
 * @deprecated Usar formatOrderAmountForDisplayAsync.
 */
export async function formatCurrencyWithUsdPrimaryFromOrder(
  amount: number,
  orderOrBudget?: OrderAmountDisplayInput,
  fallbackRates?: CommercialRatesMap,
): Promise<string> {
  return formatOrderAmountForDisplayAsync(amount, orderOrBudget ?? {}, fallbackRates);
}

/**
 * @deprecated Usar formatOrderAmountUsdOnlyAsync.
 */
export async function formatUsdOnlyFromOrderTotal(
  amount: number,
  orderOrBudget?: OrderAmountDisplayInput,
): Promise<string> {
  return formatOrderAmountUsdOnlyAsync(amount, orderOrBudget ?? {});
}

/** Tasas comerciales del pedido (día de creación), formato ExchangeRate. */
export function getCommercialRatesFromOrder(
  order?: {
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
  } | null,
): CommercialRatesMap {
  const n = normalizeExchangeRatesAtCreation(order?.exchangeRatesAtCreation);
  const out: CommercialRatesMap = {};
  if (n?.USD?.rate && n.USD.rate > 0) {
    out.USD = {
      id: "commercial-usd",
      fromCurrency: "Bs",
      toCurrency: "USD",
      rate: n.USD.rate,
      effectiveDate: n.USD.effectiveDate,
      isActive: true,
      createdAt: n.USD.effectiveDate,
      updatedAt: n.USD.effectiveDate,
    };
  }
  if (n?.EUR?.rate && n.EUR.rate > 0) {
    out.EUR = {
      id: "commercial-eur",
      fromCurrency: "Bs",
      toCurrency: "EUR",
      rate: n.EUR.rate,
      effectiveDate: n.EUR.effectiveDate,
      isActive: true,
      createdAt: n.EUR.effectiveDate,
      updatedAt: n.EUR.effectiveDate,
    };
  }
  return out;
}

export function commercialRatesToExchangeRatesInput(
  rates: CommercialRatesMap,
): ExchangeRatesInput {
  return {
    USD: rates.USD,
    EUR: rates.EUR,
  };
}

/** Formato dual: primario USD comercial; secundario Bs (tasa viva si hay). */
export function formatDualCurrencyAmounts(
  amount: number,
  baseCurrency: Currency,
  options: {
    commercialRates?: ExchangeRatesInput;
    liveRates?: ExchangeRatesInput;
  },
): DualCurrencyFormatted {
  const commercialUsdRate = getUsdRate(options.commercialRates);
  const liveUsdRate =
    getUsdRate(options.liveRates) ?? commercialUsdRate ?? null;

  if (baseCurrency === "USD") {
    const primary = formatCurrency(amount, "USD");
    if (liveUsdRate && liveUsdRate > 0) {
      return {
        primary,
        secondary: formatCurrency(amount * liveUsdRate, "Bs"),
      };
    }
    return { primary };
  }

  const bsAmount = amount;
  if (commercialUsdRate && commercialUsdRate > 0) {
    return {
      primary: formatCurrency(bsAmount / commercialUsdRate, "USD"),
      secondary: formatCurrency(bsAmount, "Bs"),
    };
  }
  return { primary: formatCurrency(bsAmount, "Bs") };
}

/** Una línea para tablas (paso 1): `$X (Bs. Y)` o solo primario. */
export function formatCommercialDualDisplay(
  amount: number,
  baseCurrency: Currency,
  options: {
    commercialRates?: ExchangeRatesInput;
    liveRates?: ExchangeRatesInput;
  },
): string {
  const { primary, secondary } = formatDualCurrencyAmounts(
    amount,
    baseCurrency,
    options,
  );
  return secondary ? `${primary} (${secondary})` : primary;
}

/** Total comercial en USD (nativo si base USD; si no Bs / tasa pedido). */
export function getCommercialTotalUsd(order: {
  total: number;
  baseCurrency?: Currency;
  exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
}): number {
  if (isUsdBaseOrder(order)) return order.total;
  const rate = getUsdRate(
    commercialRatesToExchangeRatesInput(
      getCommercialRatesFromOrder(order),
    ),
  );
  if (rate && rate > 0) return order.total / rate;
  return order.total;
}

/** Total cobrado en tienda en USD (respeta originalCurrency / cashReceived por pago). */
export function getOrderPaidUsd(
  order: PartialMixedPaymentsSource & {
    baseCurrency?: Currency;
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
  },
): number {
  return sumPaymentsToUsd(getActivePaymentsList(order), order);
}

/** Saldo pendiente en USD comercial (total USD − pagado USD). */
export function getOrderPendingUsd(
  order: PartialMixedPaymentsSource & {
    total: number;
    baseCurrency?: Currency;
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
    paymentCondition?: string;
    paymentMethod?: string;
  },
): number {
  if (isCasheaCommerciallySettled(order)) {
    return 0;
  }
  if (isUsdBaseOrder(order)) {
    return getOrderPendingTotal(order);
  }
  const totalUsd = getCommercialTotalUsd(order);
  const paidUsd = getOrderPaidUsd(order);
  return Math.max(0, totalUsd - paidUsd);
}

/**
 * Total cobrado: primario USD (suma comercial) y secundario = suma de equivalentes Bs por línea.
 */
export function formatOrderPaymentTotalsDisplay(
  paidUsd: number,
  payments: PartialPayment[],
  order?: PaymentOrderContext | null,
): DualCurrencyFormatted {
  const primary = formatCurrency(paidUsd, "USD");
  const bsTotal = sumPaymentBsEquivalentsForDisplay(payments, order);
  if (bsTotal > 0) {
    return {
      primary,
      secondary: formatCurrency(bsTotal, "Bs"),
    };
  }
  return { primary };
}

/**
 * Monto dual alineado con PDF: primario en moneda base del pedido;
 * Bs secundario con tasa congelada del pedido (no tasa viva del día).
 */
export function formatOrderAmountWithOrderRateBs(
  amount: number,
  order?: OrderAmountDisplayInput | null,
): DualCurrencyFormatted {
  const base = getDisplayBaseCurrency(order ?? { total: amount });
  const commercial = commercialRatesToExchangeRatesInput(
    getCommercialRatesFromOrder(order),
  );
  return formatDualCurrencyAmounts(amount, base, {
    commercialRates: commercial,
    liveRates: commercial,
  });
}

/** Bs informativo para cobros/saldo en USD comercial. */
export function formatOrderPaymentUsdWithOrderRateBs(
  amountUsd: number,
  order?: OrderAmountDisplayInput | null,
): DualCurrencyFormatted {
  return formatOrderAmountWithOrderRateBs(amountUsd, {
    ...order,
    baseCurrency: "USD",
  });
}

/** Formato dual para montos de pago/saldo: primario USD real + Bs informativo (tasa viva). */
export function formatOrderPaymentUsdForDisplay(
  amountUsd: number,
  order?: {
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
  } | null,
  liveRates?: ExchangeRatesInput,
): string {
  const commercial = commercialRatesToExchangeRatesInput(
    getCommercialRatesFromOrder(order),
  );
  const live =
    liveRates ??
    commercialRatesToExchangeRatesInput(getCommercialRatesFromOrder(order));
  return formatCommercialDualDisplay(amountUsd, "USD", {
    commercialRates: commercial,
    liveRates: live,
  });
}

function lineSnapshotKey(p: OrderProduct): string {
  return JSON.stringify({
    id: p.id,
    price: p.price,
    quantity: p.quantity,
    priceCurrency: p.priceCurrency,
    discount: p.discount,
    total: p.total,
    attributes: p.attributes,
    surchargeEnabled: p.surchargeEnabled,
    surchargeAmount: p.surchargeAmount,
  });
}

/** Si las líneas no cambiaron, congelar totales comerciales al guardar/mostrar. */
export function shouldFreezeCommercialTotals(
  initialOrder: Order | null | undefined,
  selectedProducts: OrderProduct[],
): boolean {
  if (!initialOrder) return false;
  const initial = initialOrder.products || [];
  if (initial.length !== selectedProducts.length) return false;
  const a = initial.map(lineSnapshotKey).sort().join("|");
  const b = selectedProducts.map(lineSnapshotKey).sort().join("|");
  return a === b;
}

export type FrozenCommercialTotals = {
  productSubtotal: number;
  productDiscountTotal: number;
  productSurchargeTotal?: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

export function getFrozenCommercialTotalsFromOrder(
  order: Order,
): FrozenCommercialTotals {
  return {
    productSubtotal: order.subtotalBeforeDiscounts ?? order.subtotal,
    productDiscountTotal: order.productDiscountTotal ?? 0,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    total: order.total,
  };
}

/** Restaura baseCurrency y líneas tras crear/lee del API (no persiste baseCurrency en backend). */
export function applyOrderCurrencyMetadata(
  persisted: Order,
  source?: Pick<
    Order,
    "baseCurrency" | "exchangeRatesAtCreation" | "products"
  >,
): Order {
  const exchangeRatesAtCreation =
    persisted.exchangeRatesAtCreation ?? source?.exchangeRatesAtCreation;

  const sourceProducts = source?.products ?? [];
  const products = persisted.products.map((line, index) => {
    const src = sourceProducts.find(
      (p) => p.id === line.id || p.name === line.name,
    ) ?? sourceProducts[index];
    if (!src) return line;
    return {
      ...line,
      priceCurrency: line.priceCurrency ?? src.priceCurrency,
      price: line.price ?? src.price,
      total: line.total ?? src.total,
    };
  });

  const baseCurrency =
    persisted.baseCurrency ??
    source?.baseCurrency ??
    inferOrderBaseCurrency({
      ...persisted,
      products,
    });

  return {
    ...persisted,
    baseCurrency,
    products,
    ...(exchangeRatesAtCreation
      ? { exchangeRatesAtCreation }
      : {}),
  };
}

export function buildExchangeRatesAtCreationPayload(
  rates: CommercialRatesMap,
): NonNullable<Order["exchangeRatesAtCreation"]> {
  return {
    USD: rates.USD
      ? {
          rate: rates.USD.rate,
          effectiveDate: rates.USD.effectiveDate,
        }
      : undefined,
    EUR: rates.EUR
      ? {
          rate: rates.EUR.rate,
          effectiveDate: rates.EUR.effectiveDate,
        }
      : undefined,
  };
}
