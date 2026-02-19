// Utilidades para manejo de monedas y tasas de cambio
import { getAll } from "./indexeddb";

export type Currency = "Bs" | "USD" | "EUR";

export interface ExchangeRate {
  id: string;
  fromCurrency: "Bs";
  toCurrency: "USD" | "EUR";
  rate: number;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Obtener la tasa de cambio más reciente para una moneda
export const getLatestExchangeRate = async (
  toCurrency: "USD" | "EUR"
): Promise<ExchangeRate | null> => {
  try {
    const { ApiClient } = await import("./api-client");
    const client = new ApiClient();
    const rate = await client.getLatestExchangeRate(toCurrency);
    return rate || null;
  } catch (error) {
    console.error("Error getting exchange rate:", error);
    return null;
  }
};

// Obtener todas las tasas activas
export const getActiveExchangeRates = async (): Promise<{
  USD?: ExchangeRate;
  EUR?: ExchangeRate;
}> => {
  try {
    const { ApiClient } = await import("./api-client");
    const client = new ApiClient();
    const rates = await client.getActiveExchangeRates();

    // Convertir array a objeto { USD: ..., EUR: ... }
    const result: { USD?: ExchangeRate; EUR?: ExchangeRate } = {};

    if (Array.isArray(rates)) {
      const usdRate = rates.find(r => r.toCurrency === "USD");
      if (usdRate) result.USD = usdRate;

      const eurRate = rates.find(r => r.toCurrency === "EUR");
      if (eurRate) result.EUR = eurRate;
    }

    return result;
  } catch (error) {
    console.error("Error getting active exchange rates:", error);
    return {};
  }
};

// Convertir de Bs a otra moneda
export const convertFromBs = (
  amount: number,
  toCurrency: "USD" | "EUR",
  rate: number
): number => {
  if (rate <= 0) return amount;
  return amount / rate;
};

// Convertir a Bs desde otra moneda
export const convertToBs = (
  amount: number,
  fromCurrency: "USD" | "EUR",
  rate: number
): number => {
  if (rate <= 0) return amount;
  return amount * rate;
};

// Convertir entre dos monedas (pasando por Bs)
export const convertCurrency = async (
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates?: { USD?: ExchangeRate; EUR?: ExchangeRate }
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;

  // Si no se proporcionan las tasas, obtenerlas
  if (!rates) {
    rates = await getActiveExchangeRates();
  }

  // Convertir a Bs primero
  let amountInBs = amount;
  if (fromCurrency !== "Bs") {
    const fromRate = rates[fromCurrency];
    if (!fromRate || !fromRate.rate) {
      console.warn(`No se encontró tasa de cambio para ${fromCurrency}`);
      return amount;
    }
    amountInBs = convertToBs(amount, fromCurrency, fromRate.rate);
  }

  // Convertir de Bs a moneda destino
  if (toCurrency === "Bs") return amountInBs;

  const toRate = rates[toCurrency];
  if (!toRate || !toRate.rate) {
    console.warn(`No se encontró tasa de cambio para ${toCurrency}`);
    return amountInBs;
  }
  return convertFromBs(amountInBs, toCurrency, toRate.rate);
};

// Formatear moneda
export const formatCurrency = (amount: number, currency: Currency): string => {
  const symbols: Record<Currency, string> = {
    Bs: "Bs.",
    USD: "$",
    EUR: "€",
  };

  // Formatear con separadores de miles y 2 decimales
  const formattedAmount = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${symbols[currency]}${formattedAmount}`;
};

// Obtener el símbolo de moneda
export const getCurrencySymbol = (currency: Currency): string => {
  const symbols: Record<Currency, string> = {
    Bs: "Bs.",
    USD: "$",
    EUR: "€",
  };
  return symbols[currency];
};

// Convertir precio de producto a Bs usando tasas de cambio
export const convertProductPriceToBs = async (
  price: number,
  currency: Currency,
  rates?: { USD?: ExchangeRate; EUR?: ExchangeRate }
): Promise<number> => {
  if (currency === "Bs") return price;

  // Si no se proporcionan las tasas, obtenerlas
  if (!rates) {
    rates = await getActiveExchangeRates();
  }

  if (currency === "USD") {
    const rate = rates.USD?.rate;
    if (!rate || rate <= 0) {
      console.warn("No se encontró tasa de cambio para USD, usando precio original");
      return price;
    }
    return price * rate;
  }

  if (currency === "EUR") {
    const rate = rates.EUR?.rate;
    if (!rate || rate <= 0) {
      console.warn("No se encontró tasa de cambio para EUR, usando precio original");
      return price;
    }
    return price * rate;
  }

  return price;
};

// Convertir ajuste de precio de atributo a Bs
export const convertAttributeAdjustmentToBs = async (
  adjustment: number,
  currency: Currency,
  rates?: { USD?: ExchangeRate; EUR?: ExchangeRate }
): Promise<number> => {
  if (currency === "Bs" || !currency) return adjustment;
  return convertProductPriceToBs(adjustment, currency, rates);
};

/**
 * Formatea un monto en USD como moneda principal, usando la tasa del pedido si está disponible
 * @param amountInBs - Monto en bolívares
 * @param orderOrBudget - Pedido o presupuesto que contiene exchangeRatesAtCreation
 * @param fallbackRates - Tasas de cambio activas actuales (opcional, se obtienen si no se proporcionan)
 * @returns String formateado como "USD (Bs)" o solo "USD" si no hay tasa
 */
export const formatCurrencyWithUsdPrimaryFromOrder = async (
  amountInBs: number,
  orderOrBudget?: { exchangeRatesAtCreation?: { USD?: { rate: number; effectiveDate: string } } },
  fallbackRates?: { USD?: ExchangeRate; EUR?: ExchangeRate }
): Promise<string> => {
  let usdRate: number | null = null;

  // PRIORIDAD 1: Usar la tasa del pedido/presupuesto (más confiable)
  if (orderOrBudget?.exchangeRatesAtCreation?.USD?.rate &&
    orderOrBudget.exchangeRatesAtCreation.USD.rate > 0) {
    usdRate = orderOrBudget.exchangeRatesAtCreation.USD.rate;
  }

  // PRIORIDAD 2: Usar tasas activas actuales si no hay tasa del pedido
  if (!usdRate) {
    if (!fallbackRates) {
      fallbackRates = await getActiveExchangeRates();
    }
    usdRate = fallbackRates?.USD?.rate || null;
  }

  // Si hay tasa, convertir y mostrar en USD
  if (usdRate && usdRate > 0) {
    const amountInUsd = amountInBs / usdRate;
    const usdFormatted = formatCurrency(amountInUsd, "USD");
    const bsFormatted = formatCurrency(amountInBs, "Bs");
    return `${usdFormatted} (${bsFormatted})`;
  }

  // Si no hay tasa disponible, mostrar solo en Bs
  return formatCurrency(amountInBs, "Bs");
};

