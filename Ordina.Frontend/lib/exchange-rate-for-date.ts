import {
  getActiveExchangeRates,
  type ExchangeRate,
  type Currency,
} from "@/lib/currency-utils";
import { getAll } from "@/lib/indexeddb";

const CACHE_TTL_MS = 5 * 60 * 1000;
const rateCache = new Map<string, { rate: ExchangeRate; at: number }>();

/** Normaliza a yyyy-MM-dd para API e inputs type=date. */
export function paymentDateToYyyyMmDd(date: string | undefined): string {
  if (date == null || String(date).trim() === "") return "";
  const s = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayPaymentDateYyyyMmDd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeApiRateRow(
  row: Record<string, unknown>,
  toCurrency: "USD" | "EUR",
): ExchangeRate | null {
  const rate = Number(row.rate ?? row.Rate ?? 0);
  if (!rate || rate <= 0) return null;
  const effectiveRaw = (row.effectiveDate ?? row.EffectiveDate) as string;
  const id = String(row.id ?? row.Id ?? `for-date-${toCurrency}`);
  const createdRaw = (row.createdAt ?? row.CreatedAt ?? effectiveRaw) as string;
  return {
    id,
    fromCurrency: "Bs",
    toCurrency,
    rate,
    effectiveDate: effectiveRaw || new Date().toISOString(),
    isActive: Boolean(row.isActive ?? row.IsActive ?? true),
    createdAt: createdRaw || new Date().toISOString(),
    updatedAt: createdRaw || new Date().toISOString(),
  };
}

async function getRateFromIndexedDbForDate(
  dateYmd: string,
  toCurrency: "USD" | "EUR",
): Promise<ExchangeRate | null> {
  const orderDateObj = new Date(`${dateYmd}T12:00:00`);
  orderDateObj.setHours(0, 0, 0, 0);
  const targetMs = orderDateObj.getTime();

  const allRates = await getAll<ExchangeRate>("exchange_rates");
  const forCurrency = allRates
    .filter((r) => r.toCurrency === toCurrency)
    .sort(
      (a, b) =>
        new Date(b.effectiveDate).getTime() -
        new Date(a.effectiveDate).getTime(),
    );

  const onOrBefore = forCurrency.find(
    (r) => new Date(r.effectiveDate).getTime() <= targetMs,
  );
  if (onOrBefore) return onOrBefore;

  return forCurrency[0] ?? null;
}

export type PaymentDateRateResult = {
  rate: ExchangeRate | null;
  /** true si no hubo tasa histórica en API/IndexedDB y se usó la activa de hoy */
  usedFallbackToToday: boolean;
};

/**
 * Tasa Bs→USD/EUR vigente en la fecha del cobro (API → IndexedDB → tasa activa hoy).
 */
export async function getExchangeRateForPaymentDate(
  date: string | undefined,
  toCurrency: "USD" | "EUR" = "USD",
): Promise<PaymentDateRateResult> {
  const dateYmd = paymentDateToYyyyMmDd(date) || todayPaymentDateYyyyMmDd();
  const cacheKey = `${toCurrency}|${dateYmd}`;
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { rate: cached.rate, usedFallbackToToday: false };
  }

  let usedFallbackToToday = false;

  try {
    const { ApiClient } = await import("./api-client");
    const client = new ApiClient();
    const row = await client.getExchangeRateForDate(toCurrency, dateYmd);
    const normalized = normalizeApiRateRow(
      row as Record<string, unknown>,
      toCurrency,
    );
    if (normalized) {
      rateCache.set(cacheKey, { rate: normalized, at: Date.now() });
      return { rate: normalized, usedFallbackToToday: false };
    }
  } catch {
    // 404 o red: continuar con fallback local
  }

  try {
    const fromDb = await getRateFromIndexedDbForDate(dateYmd, toCurrency);
    if (fromDb) {
      rateCache.set(cacheKey, { rate: fromDb, at: Date.now() });
      return { rate: fromDb, usedFallbackToToday: false };
    }
  } catch {
    // ignore
  }

  const active = await getActiveExchangeRates();
  const todayRate = active[toCurrency];
  if (todayRate) {
    usedFallbackToToday = true;
    rateCache.set(cacheKey, { rate: todayRate, at: Date.now() });
    return { rate: todayRate, usedFallbackToToday: true };
  }

  return { rate: null, usedFallbackToToday: true };
}

export function invalidatePaymentDateRateCache(): void {
  rateCache.clear();
}

/** Valida fecha de cobro: no futura (día local del navegador). */
export function validatePaymentDateNotFuture(dateYmd: string): boolean {
  const input = paymentDateToYyyyMmDd(dateYmd);
  if (!input) return false;
  return input <= todayPaymentDateYyyyMmDd();
}

export function paymentRateCurrencyLabel(currency: Currency): string {
  if (currency === "EUR") return "EUR";
  return "USD";
}
