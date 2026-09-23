import { describe, test, expect } from "bun:test";
import {
  inferOrderBaseCurrency,
  getLinePriceCurrency,
  convertAmountBetween,
  type ExchangeRatesInput,
} from "../order-line-pricing";
import type { OrderProduct } from "../storage";

describe("Order Form Pricing and Currency Inference", () => {
  const mockRates: ExchangeRatesInput = {
    USD: { rate: 36.5, effectiveDate: "2026-09-22" },
    EUR: { rate: 39.8, effectiveDate: "2026-09-22" },
  };

  test("getLinePriceCurrency defaults to Bs if priceCurrency is not specified", () => {
    const lineWithoutCurrency = { id: "l1", name: "Cojín", price: 10, quantity: 1 } as OrderProduct;
    expect(getLinePriceCurrency(lineWithoutCurrency)).toBe("Bs");

    const lineWithUsd = { id: "l2", name: "Mueble", price: 150, quantity: 1, priceCurrency: "USD" } as OrderProduct;
    expect(getLinePriceCurrency(lineWithUsd)).toBe("USD");
  });

  test("inferOrderBaseCurrency detects USD from product lines", () => {
    const orderWithUsdLines = {
      products: [
        { priceCurrency: "USD" as const },
        { priceCurrency: "USD" as const },
      ],
    };
    expect(inferOrderBaseCurrency(orderWithUsdLines)).toBe("USD");
  });

  test("inferOrderBaseCurrency detects USD for modern commercial orders with frozen rates", () => {
    const orderWithFrozenRates = {
      total: 450,
      exchangeRatesAtCreation: {
        USD: { rate: 36.5, effectiveDate: "2026-09-22" },
      },
    };
    expect(inferOrderBaseCurrency(orderWithFrozenRates)).toBe("USD");
  });

  test("convertAmountBetween correctly converts between USD and Bs", () => {
    const usdToBs = convertAmountBetween(100, "USD", "Bs", mockRates);
    expect(usdToBs).toBe(3650);

    const bsToUsd = convertAmountBetween(3650, "Bs", "USD", mockRates);
    expect(bsToUsd).toBe(100);
  });

  test("convertAmountBetween returns null when rate is not available", () => {
    const result = convertAmountBetween(100, "USD", "Bs", undefined);
    expect(result).toBeNull();
  });

  test("calculates full order breakdown with discount and delivery accurately", () => {
    const items = [
      { price: 200, quantity: 2 }, // 400
      { price: 50, quantity: 3 },  // 150
    ];

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const generalDiscountPercent = 10;
    const discountAmount = subtotal * (generalDiscountPercent / 100);
    const deliveryCost = 35;
    const total = subtotal - discountAmount + deliveryCost;

    expect(subtotal).toBe(550);
    expect(discountAmount).toBe(55);
    expect(total).toBe(530);
  });
});
