import { describe, test, expect } from "bun:test";
import { parseReportDateRange, isDateInReportRange } from "../report-date-range";
import { paymentToUsd } from "../order-payments";
import type { PartialPayment } from "../storage";

describe("Payments Report Calculations and Filtering", () => {
  test("parseReportDateRange sets start to beginning of day and end to end of day", () => {
    const { start, end } = parseReportDateRange("2026-09-01", "2026-09-30");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8); // September (0-indexed)
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(30);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  test("isDateInReportRange matches timestamps within boundary inclusive", () => {
    const { start, end } = parseReportDateRange("2026-09-10", "2026-09-20");

    expect(isDateInReportRange("2026-09-10T00:00:00.000Z", start, end)).toBe(true);
    expect(isDateInReportRange("2026-09-15T14:30:00.000Z", start, end)).toBe(true);
    expect(isDateInReportRange("2026-09-20T23:59:59.000Z", start, end)).toBe(true);
    expect(isDateInReportRange("2026-09-09T23:59:59.000Z", start, end)).toBe(false);
    expect(isDateInReportRange("2026-09-21T00:00:01.000Z", start, end)).toBe(false);
  });

  test("paymentToUsd correctly normalizes Bs payment to USD using payment exchange rate", () => {
    const payment: PartialPayment = {
      id: "pay-1",
      amount: 3650,
      currency: "Bs",
      method: "Pago Móvil",
      paymentDetails: {
        exchangeRate: 36.5,
        isConciliated: true,
      },
    };

    const usdVal = paymentToUsd(payment);
    expect(usdVal).toBe(100);
  });

  test("paymentToUsd preserves USD amounts without conversion", () => {
    const payment: PartialPayment = {
      id: "pay-2",
      amount: 150,
      currency: "USD",
      method: "Efectivo USD",
      paymentDetails: {
        isConciliated: true,
      },
    };

    const usdVal = paymentToUsd(payment);
    expect(usdVal).toBe(150);
  });

  test("aggregates payment totals by payment method and conciliation status", () => {
    const payments: PartialPayment[] = [
      { id: "1", amount: 100, currency: "USD", method: "Zelle", paymentDetails: { isConciliated: true } },
      { id: "2", amount: 200, currency: "USD", method: "Zelle", paymentDetails: { isConciliated: false } },
      { id: "3", amount: 50, currency: "USD", method: "Efectivo USD", paymentDetails: { isConciliated: true } },
    ];

    const conciliated = payments.filter((p) => p.paymentDetails?.isConciliated);
    const nonConciliated = payments.filter((p) => !p.paymentDetails?.isConciliated);

    const totalZelle = payments
      .filter((p) => p.method === "Zelle")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalConciliated = conciliated.reduce((sum, p) => sum + p.amount, 0);

    expect(totalZelle).toBe(300);
    expect(totalConciliated).toBe(150);
    expect(nonConciliated.length).toBe(1);
    expect(nonConciliated[0].id).toBe("2");
  });
});
