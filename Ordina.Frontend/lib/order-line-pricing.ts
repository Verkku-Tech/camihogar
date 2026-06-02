/**
 * Precios de línea en moneda nativa; totales del pedido en moneda base (USD).
 * Conversión a Bs solo para display informativo o cobros (tasa del pago).
 */
import {
  formatCurrency,
  normalizeExchangeRatesAtCreation,
  type Currency,
  type ExchangeRate,
  type ExchangeRatesAtCreationNormalized,
  type ExchangeRatesAtCreationRaw,
} from "@/lib/currency-utils";
import { readDiscountUiFromProduct } from "@/lib/product-discount-ui";
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

  // API sin baseCurrency: pedidos nuevos guardan total en USD (ej. 330, 464).
  // Legacy en Bs suele ser montos altos (ej. 200.177). Umbral separa ambos.
  if (
    order.exchangeRatesAtCreation &&
    order.total != null &&
    order.total > 0 &&
    order.total <= 100_000
  ) {
    const n = normalizeExchangeRatesAtCreation(order.exchangeRatesAtCreation);
    if (n?.USD?.rate && n.USD.rate > 0) {
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

type ProductLinePartsInBase = {
  baseInBase: number;
  surchargeInBase: number;
};

function getProductLinePartsInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): ProductLinePartsInBase {
  const baseCurrency = options.baseCurrency ?? ORDER_BASE_CURRENCY;
  const rates = options.exchangeRates;
  const lineCurrency = getLinePriceCurrency(product);
  const markup = options.markup ?? 0;
  const category = options.categories.find(
    (cat) => cat.name === product.category,
  );

  let lineTotalNative: number;

  if (!category) {
    const surchargeNativeLegacy =
      product.surchargeEnabled && product.surchargeAmount
        ? convertAmountBetweenOrKeep(
            product.surchargeAmount,
            "USD",
            lineCurrency,
            rates,
          )
        : 0;
    lineTotalNative = Math.max(0, product.total - surchargeNativeLegacy);
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

  const baseNative =
    lineTotalNative +
    convertAmountBetweenOrKeep(markup, baseCurrency, lineCurrency, rates);

  let surchargeNative = 0;
  if (product.surchargeEnabled && product.surchargeAmount) {
    surchargeNative = convertAmountBetweenOrKeep(
      product.surchargeAmount,
      "USD",
      lineCurrency,
      rates,
    );
  }

  return {
    baseInBase: convertAmountBetweenOrKeep(
      baseNative,
      lineCurrency,
      baseCurrency,
      rates,
    ),
    surchargeInBase: convertAmountBetweenOrKeep(
      surchargeNative,
      lineCurrency,
      baseCurrency,
      rates,
    ),
  };
}

/** Precio×cantidad + markup en moneda base (sin sobreprecio; base imponible y descuentos). */
export function getProductLineBaseWithoutSurchargeInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): number {
  return getProductLinePartsInBaseCurrency(product, options).baseInBase;
}

/** Sobreprecio de línea en moneda base (0 si no aplica). */
export function getProductLineSurchargeInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): number {
  return getProductLinePartsInBaseCurrency(product, options).surchargeInBase;
}

/** Subtotal de línea para tabla: base + sobreprecio (antes de descontar). */
export function getProductLineSubtotalDisplayInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): number {
  const { baseInBase, surchargeInBase } = getProductLinePartsInBaseCurrency(
    product,
    options,
  );
  return baseInBase + surchargeInBase;
}

/** Total de línea tras descuento: (base − descuento) + sobreprecio. */
export function getProductLineTotalAfterDiscountInBaseCurrency(
  product: OrderProduct,
  discountInBase: number,
  options: ProductLineTotalOptions,
): number {
  const { baseInBase, surchargeInBase } = getProductLinePartsInBaseCurrency(
    product,
    options,
  );
  return Math.max(baseInBase - discountInBase, 0) + surchargeInBase;
}

/**
 * @deprecated Usar funciones específicas (base / surcharge / subtotal / total tras descuento).
 * Equivale a subtotal display (base + sobreprecio, sin descontar).
 */
export function getProductLineBaseTotalInBaseCurrency(
  product: OrderProduct,
  options: ProductLineTotalOptions,
): number {
  return getProductLineSubtotalDisplayInBaseCurrency(product, options);
}

/** Moneda en que está guardado `product.discount` (porcentaje → moneda base). */
export function getProductDiscountCurrencyForTotals(
  product: OrderProduct,
  options: {
    productDiscountTypes?: Record<string, "monto" | "porcentaje">;
    productDiscountCurrencies?: Record<string, Currency>;
    preferredCurrency?: Currency;
  },
): Currency {
  const ui = readDiscountUiFromProduct(
    product,
    options.preferredCurrency ?? ORDER_BASE_CURRENCY,
  );
  const type = options.productDiscountTypes?.[product.id] ?? ui.type;
  if (type === "porcentaje") return ORDER_BASE_CURRENCY;
  return (
    options.productDiscountCurrencies?.[product.id] ?? ui.currency
  );
}

/** Monto a persistir en `product.discount` (nativo para monto; base para %). */
export function computeProductDiscountStoredAmount(params: {
  inputValue: number;
  discountType: "monto" | "porcentaje";
  discountCurrency: Currency;
  baseTotalInBase: number;
  rates?: ExchangeRatesInput;
  maxDiscount?: number;
  maxDiscountCurrency?: Currency;
  baseCurrency?: Currency;
}): number {
  const base = params.baseCurrency ?? ORDER_BASE_CURRENCY;
  if (params.discountType === "porcentaje") {
    const percentage = Math.max(0, Math.min(params.inputValue, 100));
    return Math.round(((params.baseTotalInBase * percentage) / 100) * 100) / 100;
  }

  const native = normalizeMonetaryAmountFromLegacy(
    params.inputValue,
    params.discountCurrency,
    params.rates,
  );
  let inBase = convertAmountBetweenOrKeep(
    native,
    params.discountCurrency,
    base,
    params.rates,
  );
  inBase = Math.max(0, Math.min(inBase, params.baseTotalInBase));

  if (params.maxDiscount && params.maxDiscount > 0) {
    const maxCurr = params.maxDiscountCurrency ?? "Bs";
    const maxInBase = convertAmountBetweenOrKeep(
      params.maxDiscount,
      maxCurr,
      base,
      params.rates,
    );
    if (maxInBase > 0) inBase = Math.min(inBase, maxInBase);
  }

  return convertAmountBetweenOrKeep(
    inBase,
    base,
    params.discountCurrency,
    params.rates,
  );
}

export function normalizeProductLineDiscountFromLegacy(
  line: OrderProduct,
  discountCurrency: Currency,
  discountType: "monto" | "porcentaje",
  rates?: ExchangeRatesInput,
): OrderProduct {
  if (!line.discount || line.discount <= 0 || discountType === "porcentaje") {
    return line;
  }
  return {
    ...line,
    discount: normalizeMonetaryAmountFromLegacy(
      line.discount,
      discountCurrency,
      rates,
    ),
  };
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
    includeSurcharge?: boolean;
    getDiscountForProduct?: (
      product: OrderProduct,
    ) => { amount: number; currency: Currency };
  },
): number {
  const baseCurrency = options.baseCurrency ?? ORDER_BASE_CURRENCY;
  const includeSurcharge = options.includeSurcharge !== false;
  return products.reduce((sum, product) => {
    const lineOpts = {
      ...options,
      markup: options.productMarkups?.[product.id] ?? 0,
    };
    const base = getProductLineBaseWithoutSurchargeInBaseCurrency(
      product,
      lineOpts,
    );
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
    const lineTotal = getProductLineTotalAfterDiscountInBaseCurrency(
      product,
      discountInBase,
      lineOpts,
    );
    if (includeSurcharge) return sum + lineTotal;
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

export type DeliveryServiceLine = {
  enabled: boolean;
  cost?: number;
  currency?: Currency;
};

/**
 * Antes el formulario guardaba montos en Bs con `currency` USD/EUR.
 * Convierte a monto nativo cuando el valor parece Bs mal etiquetado.
 */
export function normalizeMonetaryAmountFromLegacy(
  amount: number,
  currency: Currency | undefined,
  rates?: ExchangeRatesInput,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return amount;
  const c = currency ?? ORDER_BASE_CURRENCY;
  if (c === "Bs") return amount;

  const rate = c === "USD" ? rates?.USD?.rate : rates?.EUR?.rate;
  if (!rate || rate <= 0) return amount;

  const impliedNative = amount / rate;
  if (amount > rate * 20 && impliedNative > 0 && impliedNative < 10_000) {
    return Math.round(impliedNative * 100) / 100;
  }
  return amount;
}

export type NormalizedDeliveryServices = {
  deliveryExpress?: { enabled: boolean; cost: number; currency: Currency };
  servicioAcarreo?: { enabled: boolean; cost?: number; currency: Currency };
  servicioArmado?: { enabled: boolean; cost: number; currency: Currency };
};

function normalizeDeliveryLine(
  line: DeliveryServiceLine | undefined,
  rates?: ExchangeRatesInput,
):
  | { enabled: boolean; cost: number; currency: Currency }
  | { enabled: boolean; cost?: number; currency: Currency }
  | undefined {
  if (!line) return undefined;
  const currency = line.currency ?? ORDER_BASE_CURRENCY;
  if (!line.enabled || line.cost == null || line.cost <= 0) {
    return { ...line, currency };
  }
  return {
    ...line,
    currency,
    cost: normalizeMonetaryAmountFromLegacy(line.cost, currency, rates),
  };
}

export function normalizeDeliveryServicesFromLegacy(
  services: {
    deliveryExpress?: DeliveryServiceLine & { cost: number };
    servicioAcarreo?: DeliveryServiceLine;
    servicioArmado?: DeliveryServiceLine & { cost: number };
  },
  rates?: ExchangeRatesInput,
): NormalizedDeliveryServices {
  const deliveryExpress = normalizeDeliveryLine(
    services.deliveryExpress,
    rates,
  );
  const servicioAcarreo = normalizeDeliveryLine(
    services.servicioAcarreo,
    rates,
  );
  const servicioArmado = normalizeDeliveryLine(
    services.servicioArmado,
    rates,
  );
  return {
    deliveryExpress: deliveryExpress as
      | { enabled: boolean; cost: number; currency: Currency }
      | undefined,
    servicioAcarreo,
    servicioArmado: servicioArmado as
      | { enabled: boolean; cost: number; currency: Currency }
      | undefined,
  };
}

/** Descuento general en monto fijo → moneda base del pedido (USD comercial). */
export function getGeneralDiscountInBaseCurrency(
  amount: number,
  currency: Currency,
  baseCurrency: Currency = ORDER_BASE_CURRENCY,
  rates?: ExchangeRatesInput,
): number {
  const normalized = normalizeMonetaryAmountFromLegacy(amount, currency, rates);
  return convertAmountBetweenOrKeep(
    normalized,
    currency,
    baseCurrency,
    rates,
  );
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
