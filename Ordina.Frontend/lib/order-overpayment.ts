/**
 * Excedente comercial (vuelto/cambio): pagado en USD − total en USD.
 */
import type { Order } from "@/lib/storage";
import { getCommercialTotalUsd } from "@/lib/order-currency-display";
import {
  getActivePaymentsList,
  PAYMENT_BALANCE_EPSILON_USD,
  sumPaymentsToUsd,
} from "@/lib/order-payments";

export type OrderLikeForOverpayment = Pick<
  Order,
  | "total"
  | "baseCurrency"
  | "exchangeRatesAtCreation"
  | "paymentDetails"
  | "partialPayments"
  | "mixedPayments"
  | "paymentMethod"
>;

function sumPaymentsUsd(order: OrderLikeForOverpayment): number {
  const list = getActivePaymentsList(order);
  if (list.length > 0) {
    return sumPaymentsToUsd(list, order);
  }
  if (!order.paymentMethod?.trim()) return 0;
  const det = order.paymentDetails;
  const monto = det?.originalAmount ?? det?.cashReceived ?? order.total;
  const mon = det?.originalCurrency ?? det?.cashCurrency ?? "Bs";
  if (mon.toUpperCase() === "USD") return monto ?? 0;
  const rate = det?.exchangeRate;
  if (rate && rate > 0) return (monto ?? 0) / rate;
  return sumPaymentsToUsd(list, order);
}

export function computeOverpaymentUsd(
  order: OrderLikeForOverpayment,
): number {
  const totalUsd = getCommercialTotalUsd(order);
  const paidUsd = sumPaymentsUsd(order);
  const excess = paidUsd - totalUsd;
  if (excess <= PAYMENT_BALANCE_EPSILON_USD) return 0;
  return Math.round(excess * 100) / 100;
}

export function tryComputeOverpaymentUsd(
  order: OrderLikeForOverpayment,
): number | null {
  try {
    return computeOverpaymentUsd(order);
  } catch {
    return null;
  }
}
