/**
 * Conversión de abonos y total a USD alineada con OrderPaymentUsdConverter (backend).
 */
import type { Order, PartialPayment } from "@/lib/storage";
import { normalizeExchangeRatesAtCreation } from "@/lib/currency-utils";
import { getActivePaymentsList } from "@/lib/order-payments";

export type OrderLikeForUsdCredit = Pick<
  Order,
  "total" | "exchangeRatesAtCreation" | "paymentDetails" | "partialPayments" | "mixedPayments" | "paymentMethod"
>;

export function getBsPerUsdFromOrder(order: Pick<Order, "exchangeRatesAtCreation">): number {
  const n = normalizeExchangeRatesAtCreation(order.exchangeRatesAtCreation);
  const r = n?.USD?.rate ?? 0;
  if (r <= 0) throw new Error("El pedido no tiene tasa USD (exchangeRatesAtCreation.USD.rate).");
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
    if (bsPerEur <= 0) throw new Error("El pedido no tiene tasa EUR para convertir el pago.");
    const bs = amount * bsPerEur;
    return bs / bsPerUsd;
  }

  const rate = paymentBsPerUsdOrNull != null && paymentBsPerUsdOrNull > 0 ? paymentBsPerUsdOrNull : bsPerUsd;
  return amount / rate;
}

export function paymentLineToUsd(payment: PartialPayment, order: OrderLikeForUsdCredit): number {
  const det = payment.paymentDetails;
  const monto = det?.originalAmount ?? det?.cashReceived ?? payment.amount;
  const mon = det?.originalCurrency ?? det?.cashCurrency ?? "Bs";
  return convertAmountToUsd(monto ?? 0, mon, det?.exchangeRate, order);
}

export function mainPaymentToUsd(order: OrderLikeForUsdCredit): number {
  const det = order.paymentDetails;
  const monto = det?.originalAmount ?? det?.cashReceived ?? order.total;
  const mon = det?.originalCurrency ?? det?.cashCurrency ?? "Bs";
  return convertAmountToUsd(monto ?? 0, mon, det?.exchangeRate, order);
}

export function orderTotalToUsd(order: OrderLikeForUsdCredit): number {
  return order.total / getBsPerUsdFromOrder(order);
}

export function sumPaymentsUsd(order: OrderLikeForUsdCredit): number {
  const list = getActivePaymentsList(order);
  if (list.length > 0) return list.reduce((s, p) => s + paymentLineToUsd(p, order), 0);
  if (order.paymentMethod?.trim()) return mainPaymentToUsd(order);
  return 0;
}

export function computeOverpaymentUsd(order: OrderLikeForUsdCredit): number {
  const totalUsd = orderTotalToUsd(order);
  const paidUsd = sumPaymentsUsd(order);
  const excess = paidUsd - totalUsd;
  return excess > 0 ? Math.round(excess * 100) / 100 : 0;
}

export function tryComputeOverpaymentUsd(order: OrderLikeForUsdCredit): number | null {
  try {
    return computeOverpaymentUsd(order);
  } catch {
    return null;
  }
}

export function appliedUsdToBs(appliedUsd: number, order: Pick<Order, "exchangeRatesAtCreation">): number {
  if (appliedUsd <= 0) return 0;
  return appliedUsd * getBsPerUsdFromOrder(order);
}
