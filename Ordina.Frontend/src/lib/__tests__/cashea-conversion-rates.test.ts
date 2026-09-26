import { describe, it, expect } from "vitest";
import { buildCasheaPaymentsForSave, getCasheaTotalDueBs } from "../order-payments";
import type { PartialPayment } from "@/lib/storage";

describe("Cashea conversion and fallback rates", () => {
  it("does not throw exceeding total error when paying in Bs with rate on payment", () => {
    const payment: PartialPayment = {
      id: "p1",
      method: "Pago Móvil",
      amount: 55671.1,
      currency: "Bs",
      paymentDetails: {
        originalAmount: 55671.1,
        originalCurrency: "Bs",
        exchangeRate: 857.01,
      },
    };
    // Order total is 324.80 USD (~278,356.85 Bs). Payment is 55,671.10 Bs (~64.96 USD).
    // Even if usdRate is undefined in options, it should resolve from payment or order context.
    const result = buildCasheaPaymentsForSave([payment], {
      orderTotalBs: 278356.85,
      useUsdTotals: true,
      totalDueUsd: 324.8,
      usdRate: 857.01,
      order: {
        baseCurrency: "USD",
      },
    });

    expect(result).toHaveLength(2);
    expect(result[1].paymentDetails?.casheaFinancedPortion).toBe(true);
  });

  it("handles missing options.usdRate gracefully by resolving from inStore payment rate", () => {
    const payment: PartialPayment = {
      id: "p1",
      method: "Pago Móvil",
      amount: 55671.1,
      currency: "Bs",
      paymentDetails: {
        originalAmount: 55671.1,
        originalCurrency: "Bs",
        exchangeRate: 857.01,
      },
    };
    const totalDueBs = getCasheaTotalDueBs({
      totalDueUsd: 324.8,
      useUsdTotals: true,
      usdRate: undefined,
      inStorePayments: [payment],
    });

    expect(totalDueBs).toBeCloseTo(324.8 * 857.01, 1);

    const result = buildCasheaPaymentsForSave([payment], {
      orderTotalBs: totalDueBs,
      useUsdTotals: true,
      totalDueUsd: 324.8,
      usdRate: undefined, // Simulates missing frozen rate in options
      order: {
        baseCurrency: "USD",
      },
    });

    expect(result).toHaveLength(2);
    expect(result[1].paymentDetails?.casheaFinancedPortion).toBe(true);
  });
});
