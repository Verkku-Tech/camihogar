/**
 * Precios de línea en moneda nativa; totales del pedido en moneda base (USD).
 * Conversión a Bs solo para display informativo o cobros (tasa del pago).
 */
import {
  formatCurrency,
  type Currency,
  type ExchangeRate,
  type ExchangeRatesAtCreationNormalized,
  type ExchangeRatesAtCreationRaw,
} from "@/lib/currency-utils";
import {
  calculateProductUnitPriceWithAttributes,
  type Category,
  type Order,
  type OrderProduct,
  type Product,
} from "@/lib/storage";

export const ORDER_BASE_CURRENCY: Currency = "USD";

export type ExchangeRatesInput = {
  USD?: ExchangeRate | { rate: number; effectiveDate?: string };
  EUR?: ExchangeRate | { rate: number; effectiveDate?: string };
};

export function getLinePriceCurrency(line: OrderProduct): Currency {
  return line.priceCurrency ?? "Bs";
}

/** Infiere moneda base cuando el API no devuelve baseCurrency (pedidos nuevos en USD). */
export function inferOrderBaseCurrency(
  order?: {
    baseCurrency?: Currency;
    products?: { priceCurrency?: Currency }[];
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
    total?: number;
  } | null,
): Currency {
  if (!order) return "Bs";
  if (order.baseCurrency) return order.baseCurrency;

  const lines = order.products ?? [];
  if (lines.length > 0) {
    const currencies = lines.map((l) => l.priceCurrency ?? "Bs");
    if (currencies.every((c) => c === "USD")) return "USD";
    if (currencies.some((c) => c === "USD") && !currencies.some((c) => c === "Bs")) {
      return "USD";
    }
  }

  return "Bs";
}

export function getOrderBaseCurrency(
  order?: {
    baseCurrency?: Currency;
    products?: { priceCurrency?: Currency }[];
    exchangeRatesAtCreation?: ExchangeRatesAtCreationRaw;
    total?: number;
  } | null,
): Currency {
  return inferOrderBaseCurrency(order);
}

export function isUsdBaseOrder(
  order?: { baseCurrency?: Currency } | null,
): boolean {
  return getOrderBaseCurrency(order) === "USD";
}

export function getUsdRate(rates?: ExchangeRatesInput): number | null {
  const r = rates?.USD?.rate;
  return r && r > 0 ? r : null;
}

/** Convierte entre monedas; null si falta tasa. */
export function convertAmountBetween(
  amount: number,
  from: Currency,
  to: Currency,
  rates?: ExchangeRatesInput,
): number | null {
  if (from === to) return amount;
  if (!rates) return null;

  let amountInBs = amount;
  if (from !== "Bs") {
    const fromRate =
      from === "USD" ? rates.USD?.rate : rates.EUR?.rate;
    if (!fromRate || fromRate <= 0) return null;
    amountInBs = amount * fromRate;
  }

  if (to === "Bs") return amountInBs;

  const toRate = to === "USD" ? rates.USD?.rate : rates.EUR?.rate;
  if (!toRate || toRate <= 0) return null;
  return amountInBs / toRate;
}

export function convertAmountBetweenOrKeep(
  amount: number,
  from: Currency,
  to: Currency,
  rates?: ExchangeRatesInput,
): number {
  const converted = convertAmountBetween(amount, from, to, rates);
  return converted ?? amount;
}

/** Re-hidrata líneas legacy (borrador v1 / pedidos sin priceCurrency). */
export function normalizeLegacyOrderLine(
  line: OrderProduct,
  catalogProduct?: Product | null,
): OrderProduct {
  if (line.priceCurrency) return line;

  if (catalogProduct) {
    const catCurrency = catalogProduct.priceCurrency || "Bs";
    if (catCurrency !== "Bs") {
      return {
        ...line,
        price: catalogProduct.price,
        priceCurrency: catCurrency,
        total: catalogProduct.price * (line.quantity || 1),
      };
    }
  }

  return { ...line, priceCurrency: "Bs" };
}

export function normalizeLegacyOrderLines(
  lines: OrderProduct[],
  allProducts: Product[],
): OrderProduct[] {
  return lines.map((line) => {
    const catalog =
      allProducts.find(
        (p) =>
          p.id.toString() === line.catalogProductId ||
          p.backendId === line.catalogProductId ||
          p.name === line.name,
      ) ?? null;
    return normalizeLegacyOrderLine(line, catalog);
  });
}

export type FormatLinePriceOptions = {
  showBsEquivalent?: boolean;
  liveRates?: ExchangeRatesInput;
};

/** Precio unitario en moneda de la línea, formateado; Bs equivalente opcional (tasa viva). */
export async function formatLineUnitPrice(
  line: OrderProduct,
  options?: FormatLinePriceOptions,
): Promise<string> {
  const currency = getLinePriceCurrency(line);
  const primary = formatCurrency(line.price, currency);

  if (!options?.showBsEquivalent || currency === "Bs") {
    return primary;
  }

  const bs = convertAmountBetween(
    line.price,
    currency,
    "Bs",
    options.liveRates,
  );
  if (bs === null) return primary;
  return `${primary} (${formatCurrency(bs, "Bs")})`;
}

export function formatLineAmount(
  amount: number,
  currency: Currency,
  options?: FormatLinePriceOptions,
): string {
  const primary = formatCurrency(amount, currency);
  if (!options?.showBsEquivalent || currency === "Bs") {
    return primary;
  }
  const bs = convertAmountBetween(
    amount,
    currency,
    "Bs",
    options.liveRates,
  );
  if (bs === null) return primary;
  return `${primary} (${formatCurrency(bs, "Bs")})`;
}

export type ProductLineTotalOptions = {
  baseCurrency?: Currency;
  exchangeRates?: ExchangeRatesInput;
  categories: Category[];
  allProducts: Product[];
  markup?: number;
};

/** Total de línea (unitario×cantidad + markup + sobreprecio) en moneda base del pedido. */
export function getProductLineBaseTotalInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): number {
  const baseCurrency = options.baseCurrency ?? ORDER_BASE_CURRENCY;
  const rates = options.exchangeRates;
  const lineCurrency = getLinePriceCurrency(product);
  const markup = options.markup ?? 0;
  const category = options.categories.find(
    (cat) => cat.name === product.category,
  );

  let lineTotalNative: number;

  if (!category) {
    lineTotalNative = product.total;
  } else {
    const unitPrice = calculateProductUnitPriceWithAttributes(
      product.price,
      product.attributes,
      category,
      rates,
      options.allProducts,
      options.categories,
      { targetCurrency: lineCurrency, basePriceCurrency: lineCurrency },
    );
    lineTotalNative = unitPrice * product.quantity;
  }

  let surchargeNative = 0;
  if (product.surchargeEnabled && product.surchargeAmount) {
    surchargeNative = convertAmountBetweenOrKeep(
      product.surchargeAmount,
      "USD",
      lineCurrency,
      rates,
    );
  }

  const lineWithExtras =
    lineTotalNative +
    convertAmountBetweenOrKeep(markup, baseCurrency, lineCurrency, rates) +
    surchargeNative;

  return convertAmountBetweenOrKeep(
    lineWithExtras,
    lineCurrency,
    baseCurrency,
    rates,
  );
}

/** Descuento de línea en moneda base del pedido. */
export function getLineDiscountInBaseCurrency(
  product: OrderProduct,
  discountAmount: number,
  discountCurrency: Currency,
  baseCurrency: Currency,
  rates?: ExchangeRatesInput,
): number {
  if (!discountAmount || discountAmount <= 0) return 0;
  return convertAmountBetweenOrKeep(
    discountAmount,
    discountCurrency,
    baseCurrency,
    rates,
  );
}

export function sumProductLinesToBaseCurrency(
  products: OrderProduct[],
  options: ProductLineTotalOptions & {
    productMarkups?: Record<string, number>;
    getDiscountForProduct?: (
      product: OrderProduct,
    ) => { amount: number; currency: Currency };
  },
): number {
  const baseCurrency = options.baseCurrency ?? ORDER_BASE_CURRENCY;
  return products.reduce((sum, product) => {
    const base = getProductLineBaseTotalInBaseCurrency(product, {
      ...options,
      markup: options.productMarkups?.[product.id] ?? 0,
    });
    const disc = options.getDiscountForProduct?.(product);
    const discountInBase = disc
      ? getLineDiscountInBaseCurrency(
          product,
          disc.amount,
          disc.currency,
          baseCurrency,
          options.exchangeRates,
        )
      : getLineDiscountInBaseCurrency(
          product,
          product.discount ?? 0,
          "Bs",
          baseCurrency,
          options.exchangeRates,
        );
    return sum + Math.max(base - discountInBase, 0);
  }, 0);
}

/** Costo de delivery en moneda base. */
export function sumDeliveryServicesToBaseCurrency(
  deliveryServices: {
    deliveryExpress?: { enabled: boolean; cost?: number; currency?: Currency };
    servicioAcarreo?: { enabled: boolean; cost?: number; currency?: Currency };
    servicioArmado?: { enabled: boolean; cost?: number; currency?: Currency };
  },
  baseCurrency: Currency,
  rates?: ExchangeRatesInput,
): number {
  let total = 0;
  const add = (cost?: number, currency?: Currency) => {
    if (!cost || cost <= 0) return;
    total += convertAmountBetweenOrKeep(
      cost,
      currency ?? "USD",
      baseCurrency,
      rates,
    );
  };
  if (deliveryServices.deliveryExpress?.enabled) {
    add(
      deliveryServices.deliveryExpress.cost,
      deliveryServices.deliveryExpress.currency,
    );
  }
  if (deliveryServices.servicioAcarreo?.enabled) {
    add(
      deliveryServices.servicioAcarreo.cost,
      deliveryServices.servicioAcarreo.currency,
    );
  }
  if (deliveryServices.servicioArmado?.enabled) {
    add(
      deliveryServices.servicioArmado.cost,
      deliveryServices.servicioArmado.currency,
    );
  }
  return total;
}

export function ratesFromOrder(
  order?: Pick<Order, "exchangeRatesAtCreation"> | null,
): ExchangeRatesInput | undefined {
  if (!order?.exchangeRatesAtCreation) return undefined;
  const n = order.exchangeRatesAtCreation as ExchangeRatesAtCreationNormalized;
  return {
    USD: n.USD,
    EUR: n.EUR,
  };
}
