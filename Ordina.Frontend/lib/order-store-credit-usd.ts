/**
 * Conversión de abonos y total a USD alineada con order-payments y order-currency-display.
 */
import type { Order } from "@/lib/storage";
import { normalizeExchangeRatesAtCreation } from "@/lib/currency-utils";
import { getCommercialTotalUsd } from "@/lib/order-currency-display";
import {
  getActivePaymentsList,
  PAYMENT_BALANCE_EPSILON_USD,
  sumPaymentsToUsd,
} from "@/lib/order-payments";
import { isUsdBaseOrder } from "@/lib/order-line-pricing";

export type OrderLikeForUsdCredit = Pick<
  Order,
  | "total"
  | "baseCurrency"
  | "exchangeRatesAtCreation"
  | "paymentDetails"
  | "partialPayments"
  | "mixedPayments"
  | "paymentMethod"
  | "appliedStoreCreditUsd"
>;

export function getBsPerUsdFromOrder(
  order: Pick<Order, "exchangeRatesAtCreation">,
): number {
  const n = normalizeExchangeRatesAtCreation(order.exchangeRatesAtCreation);
  const r = n?.USD?.rate ?? 0;
  if (r <= 0) {
    throw new Error("El pedido no tiene tasa USD (exchangeRatesAtCreation.USD.rate).");
  }
  return r;
}

function convertAmountToUsd(
  amount: number,
  currency: string | undefined,
  paymentBsPerUsdOrNull: number | null | undefined,
  order: OrderLikeForUsdCredit,
): number {
  const cur = (currency ?? "Bs").trim();
  if (cur.toUpperCase() === "USD") return amount;

  const bsPerUsd = getBsPerUsdFromOrder(order);

  if (cur.toUpperCase() === "EUR") {
    const n = normalizeExchangeRatesAtCreation(order.exchangeRatesAtCreation);
    const bsPerEur = n?.EUR?.rate ?? 0;
    if (bsPerEur <= 0) {
      throw new Error("El pedido no tiene tasa EUR para convertir el pago.");
    }
    const bs = amount * bsPerEur;
    return bs / bsPerUsd;
  }

  const rate =
    paymentBsPerUsdOrNull != null && paymentBsPerUsdOrNull > 0
      ? paymentBsPerUsdOrNull
      : bsPerUsd;
  return amount / rate;
}

/** Fallback legacy: pago único sin lista de abonos. */
function mainPaymentToUsd(order: OrderLikeForUsdCredit): number {
  const det = order.paymentDetails;
  const monto = det?.originalAmount ?? det?.cashReceived ?? order.total;
  const mon =
    det?.originalCurrency ??
    det?.cashCurrency ??
    (isUsdBaseOrder(order) ? "USD" : "Bs");
  return convertAmountToUsd(monto ?? 0, mon, det?.exchangeRate, order);
}

export function orderTotalToUsd(order: OrderLikeForUsdCredit): number {
  return getCommercialTotalUsd(order);
}

export function sumPaymentsUsd(order: OrderLikeForUsdCredit): number {
  const list = getActivePaymentsList(order);
  if (list.length > 0) {
    return sumPaymentsToUsd(list, order);
  }
  if (order.paymentMethod?.trim()) return mainPaymentToUsd(order);
  return 0;
}

export function computeOverpaymentUsd(order: OrderLikeForUsdCredit): number {
  const totalUsd = getCommercialTotalUsd(order);
  const paidUsd = sumPaymentsUsd(order);
  const credit = order.appliedStoreCreditUsd ?? 0;
  const excess = paidUsd + credit - totalUsd;
  if (excess <= PAYMENT_BALANCE_EPSILON_USD) return 0;
  return Math.round(excess * 100) / 100;
}

export function tryComputeOverpaymentUsd(
  order: OrderLikeForUsdCredit,
): number | null {
  try {
    return computeOverpaymentUsd(order);
  } catch {
    return null;
  }
}

export function appliedUsdToBs(
  appliedUsd: number,
  order: Pick<Order, "exchangeRatesAtCreation">,
): number {
  if (appliedUsd <= 0) return 0;
  return appliedUsd * getBsPerUsdFromOrder(order);
}
