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
    const rates = await getAll<ExchangeRate>("exchange_rates");
    const activeRates = rates
      .filter((r) => r.toCurrency === toCurrency && r.isActive)
      .sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() -
          new Date(a.effectiveDate).getTime()
      );

    return activeRates[0] || null;
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
    const rates = await getAll<ExchangeRate>("exchange_rates");
    const activeRates = rates.filter((r) => r.isActive);

    const usdRate = activeRates
      .filter((r) => r.toCurrency === "USD")
      .sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() -
          new Date(a.effectiveDate).getTime()
      )[0];

    const eurRate = activeRates
      .filter((r) => r.toCurrency === "EUR")
      .sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() -
          new Date(a.effectiveDate).getTime()
      )[0];

    return {
      USD: usdRate || undefined,
      EUR: eurRate || undefined,
    };
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

