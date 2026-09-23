import { describe, test, expect } from "bun:test";
import {
  convertCurrency,
  convertFromBs,
  convertToBs,
  formatCurrency,
  normalizeExchangeRatesAtCreation,
  type ExchangeRate,
} from "../../lib/currency-utils";

describe("CurrencyContext and Currency Utilities", () => {
  const mockRates: { USD?: ExchangeRate; EUR?: ExchangeRate } = {
    USD: {
      id: "rate-usd-1",
      fromCurrency: "Bs",
      toCurrency: "USD",
      rate: 36.5,
      effectiveDate: "2026-09-22T00:00:00Z",
      isActive: true,
      createdAt: "2026-09-22T00:00:00Z",
      updatedAt: "2026-09-22T00:00:00Z",
    },
    EUR: {
      id: "rate-eur-1",
      fromCurrency: "Bs",
      toCurrency: "EUR",
      rate: 39.8,
      effectiveDate: "2026-09-22T00:00:00Z",
      isActive: true,
      createdAt: "2026-09-22T00:00:00Z",
      updatedAt: "2026-09-22T00:00:00Z",
    },
  };

  test("convertToBs converts foreign currency amount using multiplication by rate", () => {
    const usdAmount = 100;
    const bsAmount = convertToBs(usdAmount, "USD", 36.5);
    expect(bsAmount).toBe(3650);
  });

  test("convertFromBs converts Bs to foreign currency using division by rate", () => {
    const bsAmount = 3650;
    const usdAmount = convertFromBs(bsAmount, "USD", 36.5);
    expect(usdAmount).toBe(100);
  });

  test("convertCurrency returns original amount when fromCurrency matches toCurrency", async () => {
    const result = await convertCurrency(150, "USD", "USD", mockRates);
    expect(result).toBe(150);
  });

  test("convertCurrency accurately converts USD to Bs with active rate", async () => {
    const result = await convertCurrency(200, "USD", "Bs", mockRates);
    expect(result).toBe(7300);
  });

  test("convertCurrency accurately converts Bs to EUR with active rate", async () => {
    const result = await convertCurrency(398, "Bs", "EUR", mockRates);
    expect(result).toBeCloseTo(10, 2);
  });

  test("convertCurrency returns null when exchange rate is missing or invalid", async () => {
    const emptyRates = {};
    const result = await convertCurrency(100, "USD", "Bs", emptyRates);
    expect(result).toBeNull();
  });

  test("formatCurrency prefixes correct symbol and formats two decimals", () => {
    const formattedUsd = formatCurrency(1250.5, "USD");
    expect(formattedUsd).toContain("$");
    expect(formattedUsd).toContain("1");
    expect(formattedUsd).toContain("250");
    expect(formattedUsd).toContain("50");

    const formattedBs = formatCurrency(5000, "Bs");
    expect(formattedBs).toContain("Bs.");
    expect(formattedBs).toContain("5");
    expect(formattedBs).toContain("000");

    const formattedEur = formatCurrency(75.25, "EUR");
    expect(formattedEur).toContain("€");
    expect(formattedEur).toContain("75");
  });

  test("normalizeExchangeRatesAtCreation handles mixed case and raw payload", () => {
    const rawPayload = {
      usd: { rate: 36.5, effectiveDate: "2026-09-22" },
      EUR: { rate: 39.8, effectiveDate: "2026-09-22" },
    };

    const normalized = normalizeExchangeRatesAtCreation(rawPayload as any);
    expect(normalized).toBeDefined();
    expect(normalized?.USD?.rate).toBe(36.5);
    expect(normalized?.EUR?.rate).toBe(39.8);
  });

  test("normalizeExchangeRatesAtCreation filters out invalid or zero rates", () => {
    const invalidPayload = {
      usd: { rate: 0, effectiveDate: "2026-09-22" },
      eur: { rate: -5, effectiveDate: "2026-09-22" },
    };

    const normalized = normalizeExchangeRatesAtCreation(invalidPayload as any);
    expect(normalized).toBeUndefined();
  });
});
