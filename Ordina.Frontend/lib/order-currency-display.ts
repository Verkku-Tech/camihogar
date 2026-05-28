/**
 * Display y totales comerciales: USD fijo para deuda; Bs informativo con tasa viva;
 * legacy Bs usa tasa del pedido (exchangeRatesAtCreation) para el $ mostrado.
 */
import {
  formatCurrency,
  normalizeExchangeRatesAtCreation,
  type Currency,
  type ExchangeRate,
  type ExchangeRatesAtCreationRaw,
} from "@/lib/currency-utils";
import {
  getOrderBaseCurrency,
  getUsdRate,
  isUsdBaseOrder,
  type ExchangeRatesInput,
} from "@/lib/order-line-pricing";
import {
  getOrderPendingTotal,
  type PartialMixedPaymentsSource,
} from "@/lib/order-payments";
import type { Order, OrderProduct } from "@/lib/storage";

export type DualCurrencyFormatted = {
  primary: string;
  secondary?: string;
};

export type CommercialRatesMap = {
  USD?: ExchangeRate;
  EUR?: ExchangeRate;
};

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

/** Saldo pendiente en USD comercial. */
export function getOrderPendingUsd(
  order: PartialMixedPaymentsSource & {
    total: number;
    baseCurrency?: Currency;
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
    appliedStoreCreditUsd?: number;
  },
): number {
  const pending = getOrderPendingTotal(order);
  if (isUsdBaseOrder(order)) return pending;
  const rate = getUsdRate(
    commercialRatesToExchangeRatesInput(
      getCommercialRatesFromOrder(order),
    ),
  );
  if (rate && rate > 0) return pending / rate;
  return 0;
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
