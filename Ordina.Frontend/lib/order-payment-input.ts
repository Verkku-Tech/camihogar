import type { Currency } from "@/lib/currency-utils";
import {
  getExchangeRateForPaymentDate,
  paymentDateToYyyyMmDd,
  todayPaymentDateYyyyMmDd,
} from "@/lib/exchange-rate-for-date";
import type { ExchangeRatesInput } from "@/lib/order-line-pricing";
import type { PartialPayment } from "@/lib/storage";

type UpdatePayment = (
  paymentId: string,
  field: keyof PartialPayment,
  value: PartialPayment[keyof PartialPayment],
) => void;

type UpdatePaymentDetails = (
  paymentId: string,
  field: string,
  value: unknown,
) => void;

export type ResolveRateResult = {
  rate: number | null;
  usedFallbackToToday: boolean;
};

/** Obtiene la tasa para la fecha del abono (USD por defecto). */
export async function resolvePaymentExchangeRate(
  paymentDate: string | undefined,
  toCurrency: "USD" | "EUR" = "USD",
): Promise<ResolveRateResult> {
  const { rate, usedFallbackToToday } = await getExchangeRateForPaymentDate(
    paymentDate,
    toCurrency,
  );
  if (rate && rate.rate > 0) {
    return { rate: rate.rate, usedFallbackToToday };
  }
  return { rate: null, usedFallbackToToday };
}

/** Persiste exchangeRate según fecha del cobro (no modifica montos). */
export async function resolveAndApplyPaymentExchangeRate(
  paymentId: string,
  paymentDate: string | undefined,
  toCurrency: "USD" | "EUR",
  updatePaymentDetails: UpdatePaymentDetails | undefined,
): Promise<ResolveRateResult> {
  const result = await resolvePaymentExchangeRate(paymentDate, toCurrency);
  if (result.rate != null && result.rate > 0) {
    updatePaymentDetails?.(paymentId, "exchangeRate", result.rate);
  }
  return result;
}

/** Persiste monto en Bs y la tasa del día del cobro. */
export function applyBsOnlyPaymentAmount(
  paymentId: string,
  inputValue: number,
  usdRate: number | null | undefined,
  updatePayment: UpdatePayment | undefined,
  updatePaymentDetails: UpdatePaymentDetails | undefined,
): void {
  updatePayment?.(paymentId, "amount", inputValue);
  updatePayment?.(paymentId, "currency", "Bs");
  updatePaymentDetails?.(paymentId, "originalAmount", inputValue);
  updatePaymentDetails?.(paymentId, "originalCurrency", "Bs");
  if (usdRate != null && usdRate > 0) {
    updatePaymentDetails?.(paymentId, "exchangeRate", usdRate);
  }
}

/** Variante async: resuelve tasa por fecha del abono y aplica monto Bs. */
export async function applyBsOnlyPaymentAmountForDate(
  paymentId: string,
  inputValue: number,
  paymentDate: string | undefined,
  updatePayment: UpdatePayment | undefined,
  updatePaymentDetails: UpdatePaymentDetails | undefined,
): Promise<ResolveRateResult> {
  const { rate, usedFallbackToToday } = await resolvePaymentExchangeRate(
    paymentDate,
    "USD",
  );
  applyBsOnlyPaymentAmount(
    paymentId,
    inputValue,
    rate,
    updatePayment,
    updatePaymentDetails,
  );
  return { rate, usedFallbackToToday };
}

/** @deprecated Usar applyBsOnlyPaymentAmount con tasa explícita o applyBsOnlyPaymentAmountForDate */
export function applyBsOnlyPaymentAmountWithFormRates(
  paymentId: string,
  inputValue: number,
  exchangeRates: ExchangeRatesInput,
  updatePayment: UpdatePayment | undefined,
  updatePaymentDetails: UpdatePaymentDetails | undefined,
): void {
  applyBsOnlyPaymentAmount(
    paymentId,
    inputValue,
    exchangeRates.USD?.rate,
    updatePayment,
    updatePaymentDetails,
  );
}

export function getEffectivePaymentDateYmd(
  paymentDate: string | undefined,
): string {
  return paymentDateToYyyyMmDd(paymentDate) || todayPaymentDateYyyyMmDd();
}

export function recalcPaymentAmountBsFromForeign(
  payment: PartialPayment,
  foreignAmount: number,
  currency: Currency,
  rate: number,
): number {
  if (currency === "Bs") return foreignAmount;
  if (rate > 0) return foreignAmount * rate;
  return payment.amount || 0;
}

function foreignCurrencyForPayment(payment: PartialPayment): "USD" | "EUR" {
  const c = (payment.paymentDetails?.originalCurrency ??
    payment.paymentDetails?.cashCurrency ??
    payment.currency) as Currency | undefined;
  if (c === "EUR") return "EUR";
  return "USD";
}

export type SyncPaymentDateRateOptions = {
  updatePayment?: UpdatePayment;
  updatePaymentDetails?: UpdatePaymentDetails;
  /** Recalcula amount en Bs desde originalAmount en USD/EUR si no hay tasa manual */
  recalcForeignAmountInBs?: boolean;
  showFallbackToast?: boolean;
};

/**
 * Tras cambiar payment.date: actualiza exchangeRate y opcionalmente amount en Bs (divisas).
 * No modifica montos en Bs ya capturados en métodos solo-Bs.
 */
export async function syncPaymentRateOnDateChange(
  payment: PartialPayment,
  dateYmd: string,
  options: SyncPaymentDateRateOptions,
): Promise<ResolveRateResult> {
  const effectiveDate = paymentDateToYyyyMmDd(dateYmd) || todayPaymentDateYyyyMmDd();
  const toCurrency = foreignCurrencyForPayment(payment);
  const result = await resolveAndApplyPaymentExchangeRate(
    payment.id,
    effectiveDate,
    toCurrency,
    options.updatePaymentDetails,
  );

  if (options.showFallbackToast && result.usedFallbackToToday) {
    const { toast } = await import("sonner");
    toast.warning(
      "No hay tasa registrada para esa fecha; se aplicó la tasa activa de hoy.",
    );
  }

  if (
    options.recalcForeignAmountInBs &&
    result.rate != null &&
    result.rate > 0 &&
    !payment.paymentDetails?.useCustomRate
  ) {
    const oc = (payment.paymentDetails?.originalCurrency ??
      payment.paymentDetails?.cashCurrency) as Currency | undefined;
    if (oc === "USD" || oc === "EUR") {
      const orig =
        payment.paymentDetails?.originalAmount ??
        (oc === payment.paymentDetails?.cashCurrency
          ? payment.paymentDetails?.cashReceived
          : undefined);
      if (orig != null && orig > 0) {
        const valueInBs = orig * result.rate;
        options.updatePayment?.(payment.id, "amount", valueInBs);
        options.updatePaymentDetails?.(payment.id, "exchangeRate", result.rate);
      }
    }
  }

  return result;
}
