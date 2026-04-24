import type { Currency } from "@/lib/currency-utils";

export type DiscountUiType = "monto" | "porcentaje";

type ProductAttrs = Record<string, string | number | string[]> | undefined;

/** Claves en OrderProduct.attributes (persisten en API). */
export const DISCOUNT_UI_TYPE_KEY = "discountUiType";
export const DISCOUNT_UI_CURRENCY_KEY = "discountUiCurrency";

function normalizeType(raw: unknown): DiscountUiType {
  const s = raw != null ? String(raw).toLowerCase().trim() : "";
  return s === "porcentaje" ? "porcentaje" : "monto";
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

/**
 * Lee tipo y moneda del descuento por línea desde attributes (o valores por defecto).
 */
export function readDiscountUiFromProduct(
  product: { attributes?: ProductAttrs },
  fallbackCurrency: Currency = "Bs"
): { type: DiscountUiType; currency: Currency } {
  const attrs = product.attributes;
  const type = normalizeType(attrs?.[DISCOUNT_UI_TYPE_KEY]);
  const currency = normalizeCurrency(attrs?.[DISCOUNT_UI_CURRENCY_KEY], fallbackCurrency);
  return { type, currency };
}

/**
 * Fusiona metadatos UI del descuento sin borrar otras claves de attributes.
 */
export function mergeDiscountUiIntoAttributes(
  attrs: ProductAttrs,
  type: DiscountUiType,
  currency: Currency
): Record<string, string | number | string[]> {
  const base: Record<string, string | number | string[]> = attrs
    ? { ...attrs }
    : {};
  base[DISCOUNT_UI_TYPE_KEY] = type;
  base[DISCOUNT_UI_CURRENCY_KEY] = currency;
  return base;
}
