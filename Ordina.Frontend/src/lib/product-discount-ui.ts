import type { Currency } from "@/lib/currency-utils";

export type DiscountUiType = "monto" | "porcentaje";

type ProductAttrs = Record<string, string | number | string[]> | undefined;

/** Claves en OrderProduct.attributes (persisten en API). */
export const DISCOUNT_UI_TYPE_KEY = "discountUiType";
export const DISCOUNT_UI_CURRENCY_KEY = "discountUiCurrency";
export const DISCOUNT_UI_PERCENT_KEY = "discountUiPercent";

function normalizeType(raw: unknown): DiscountUiType {
  const s = raw != null ? String(raw).toLowerCase().trim() : "";
  return s === "porcentaje" ? "porcentaje" : "monto";
}

/** Valor en `discountUiType` cuando la clave existe; si falta la clave → undefined (no asumir monto). */
function parseExplicitDiscountUiType(
  attrs: ProductAttrs | undefined
): "porcentaje" | "monto" | undefined {
  const raw = attrs?.[DISCOUNT_UI_TYPE_KEY];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined;
  }
  const s = String(raw).toLowerCase().trim();
  if (s === "porcentaje") return "porcentaje";
  if (s === "monto") return "monto";
  return undefined;
}

function normalizeCurrency(
  raw: unknown,
  fallback: Currency
): Currency {
  const s = raw != null ? String(raw).toUpperCase().trim() : "";
  if (s === "USD" || s === "EUR") return s;
  if (s === "BS") return "Bs";
  return fallback;
}

function readPercentFromAttrs(attrs: ProductAttrs | undefined): number | undefined {
  const raw = attrs?.[DISCOUNT_UI_PERCENT_KEY];
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Lee tipo, moneda y (si existe) el % tecleado en descuentos por porcentaje.
 */
export function readDiscountUiFromProduct(
  product: { attributes?: ProductAttrs },
  fallbackCurrency: Currency = "Bs"
): { type: DiscountUiType; currency: Currency; percent: number | undefined } {
  const attrs = product.attributes;
  const type = normalizeType(attrs?.[DISCOUNT_UI_TYPE_KEY]);
  const currency = normalizeCurrency(attrs?.[DISCOUNT_UI_CURRENCY_KEY], fallbackCurrency);
  const percent = readPercentFromAttrs(attrs);
  return { type, currency, percent };
}

/**
 * Fusiona metadatos UI del descuento sin borrar otras claves de attributes.
 * Si `type` es "monto" o `percentIfPercentage` no aplica, elimina `discountUiPercent`.
 */
export function mergeDiscountUiIntoAttributes(
  attrs: ProductAttrs,
  type: DiscountUiType,
  currency: Currency,
  percentIfPercentage?: number | null
): Record<string, string | number | string[]> {
  const base: Record<string, string | number | string[]> = attrs
    ? { ...attrs }
    : {};
  base[DISCOUNT_UI_TYPE_KEY] = type;
  base[DISCOUNT_UI_CURRENCY_KEY] = currency;
  if (type === "porcentaje" && percentIfPercentage != null && Number.isFinite(percentIfPercentage)) {
    const clamped = Math.max(0, Math.min(100, percentIfPercentage));
    base[DISCOUNT_UI_PERCENT_KEY] = Math.round(clamped * 100) / 100;
  } else {
    delete base[DISCOUNT_UI_PERCENT_KEY];
  }
  return base;
}

/** Línea de pedido lista para guardar: descuento 0 explícito y sin metadatos UI huérfanos. */
export function mapOrderProductForSave<T extends {
  discount?: number;
  attributes?: ProductAttrs;
}>(product: T): T {
  const discount = product.discount ?? 0;
  if (discount > 0) {
    return { ...product, discount };
  }
  if (!product.attributes) {
    return { ...product, discount: 0 };
  }
  const attrs = { ...product.attributes };
  delete attrs[DISCOUNT_UI_TYPE_KEY];
  delete attrs[DISCOUNT_UI_CURRENCY_KEY];
  delete attrs[DISCOUNT_UI_PERCENT_KEY];
  return {
    ...product,
    discount: 0,
    attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
  };
}

/**
 * Si no hay `discountUiPercent` guardado, infiere el % a partir del monto y del subtotal
 * de línea antes del descuento (campo `product.total` en el flujo de pedido).
 */
export function getImpliedDiscountPercentFromLine(
  lineSubtotalBeforeDiscount: number,
  discountAmountBs: number
): number | undefined {
  if (discountAmountBs <= 0 || lineSubtotalBeforeDiscount <= 0) return undefined;
  return Math.round((discountAmountBs / lineSubtotalBeforeDiscount) * 10000) / 100;
}

type LineForDiscount = {
  attributes?: ProductAttrs;
  total: number;
  discount?: number;
};

/**
 * Indica si el descuento de línea es por % (con valor para mostrar) o monto fijo.
 */
export function getLineDiscountDisplayMode(
  product: LineForDiscount,
  _fallbackCurrency: Currency
):
  | { mode: "monto" }
  | { mode: "porcentaje"; percent: number } {
  const d = product.discount ?? 0;
  if (d <= 0) return { mode: "monto" };

  const explicit = parseExplicitDiscountUiType(product.attributes);
  const storedPercent = readPercentFromAttrs(product.attributes);

  if (explicit === "monto") return { mode: "monto" };

  if (explicit === "porcentaje" || storedPercent != null) {
    const percent =
      storedPercent ?? getImpliedDiscountPercentFromLine(product.total, d);
    if (percent == null) return { mode: "monto" };
    return { mode: "porcentaje", percent };
  }

  return { mode: "monto" };
}

export function formatPercentForDisplay(percent: number): string {
  if (Number.isInteger(percent)) return String(percent);
  return percent.toLocaleString("es-VE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Texto antes del guion y montos en detalle de pedido: `Descuento:` o `Descuento: 10%`.
 */
export function getLineDiscountLabelLead(
  discMode: { mode: "monto" } | { mode: "porcentaje"; percent: number }
): string {
  if (discMode.mode === "porcentaje") {
    return `Descuento: ${formatPercentForDisplay(discMode.percent)}%`;
  }
  return "Descuento:";
}

/**
 * Etiqueta para la fila agregada "Descuentos individuales" en resumen de pedido.
 */
export function getIndividualDiscountsSummaryLabel(
  products: LineForDiscount[],
  fallbackCurrency: Currency
): string {
  const withDisc = products.filter((p) => (p.discount ?? 0) > 0);
  if (withDisc.length === 0) return "Descuentos individuales:";
  const parts = withDisc.map((p) => getLineDiscountDisplayMode(p, fallbackCurrency));
  const allPercentage = parts.every((p) => p.mode === "porcentaje");
  if (allPercentage) {
    const values = parts.map(
      (p) => (p as { mode: "porcentaje"; percent: number }).percent
    );
    const uniq = new Set(values);
    if (uniq.size === 1) {
      return `Descuentos individuales (${formatPercentForDisplay(values[0])}%):`;
    }
    return "Descuentos individuales (varios %):";
  }
  const allMonto = parts.every((p) => p.mode === "monto");
  if (allMonto) return "Descuentos individuales:";
  return "Descuentos individuales (monto y %):";
}

/** Etiqueta de la fila «Descuento general» en resumen financiero (pedido/presupuesto). */
export function getGeneralDiscountSummaryLabel(order: {
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
}): string {
  if (!order.generalDiscountAmount || order.generalDiscountAmount <= 0) {
    return "Descuento general:";
  }
  if (
    order.generalDiscountType === "porcentaje" &&
    order.generalDiscountPercent != null &&
    Number.isFinite(order.generalDiscountPercent) &&
    order.generalDiscountPercent > 0 &&
    order.generalDiscountPercent <= 100
  ) {
    return `Descuento general (${formatPercentForDisplay(order.generalDiscountPercent)}%):`;
  }
  return "Descuento general:";
}
