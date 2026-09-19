import type { PartialPayment } from "@/lib/storage";

export const CARD_COMMISSION_RATE = 0.06;

export function computeCardCommissionBs(amountBs: number): number {
  if (!amountBs || amountBs <= 0) return 0;
  return Math.round(amountBs * CARD_COMMISSION_RATE * 100) / 100;
}

export function resolvePaymentAmountBs(payment: PartialPayment): number {
  return payment.paymentDetails?.originalAmount ?? payment.amount ?? 0;
}

export function shouldShowCardCommission(payment: PartialPayment): boolean {
  return (
    payment.method === "Tarjeta de Crédito" &&
    Boolean(payment.paymentDetails?.cardCommissionApplied) &&
    (payment.paymentDetails?.cardCommissionAmount ?? 0) > 0
  );
}
