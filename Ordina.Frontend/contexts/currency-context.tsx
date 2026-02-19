"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Currency, getActiveExchangeRates, convertCurrency } from "@/lib/currency-utils";
import { getCurrencyPreference, setCurrencyPreference } from "@/lib/currency-preference";
import { formatCurrency } from "@/lib/currency-utils";

interface CurrencyContextType {
  preferredCurrency: Currency;
  setPreferredCurrency: (currency: Currency) => Promise<void>;
  formatWithPreference: (amount: number, originalCurrency: Currency) => Promise<string>;
  isLoading: boolean;
  exchangeRates?: { USD?: { rate: number; effectiveDate: string }; EUR?: { rate: number; effectiveDate: string } };
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [preferredCurrency, setPreferredCurrencyState] = useState<Currency>("Bs");
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<{ USD?: { rate: number; effectiveDate: string }; EUR?: { rate: number; effectiveDate: string } }>({});

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const { ApiClient } = await import("@/lib/api-client");
        const client = new ApiClient();

        // Cargar preferencia y tasas en paralelo
        const [currency, activeRates] = await Promise.all([
          getCurrencyPreference(),
          client.getActiveExchangeRates(),
        ]);

        // Convertir array de tasas a objeto { USD: ..., EUR: ... }
        const ratesObj: { USD?: any; EUR?: any } = {};
        if (Array.isArray(activeRates)) {
          const usd = activeRates.find((r: any) => r.toCurrency === "USD");
          if (usd) ratesObj.USD = usd;

          const eur = activeRates.find((r: any) => r.toCurrency === "EUR");
          if (eur) ratesObj.EUR = eur;
        }

        // Determine default currency: Force USD if available, else Bs
        const activeCurrency: Currency = ratesObj.USD ? "USD" : "Bs";

        setPreferredCurrencyState(activeCurrency);
        setExchangeRates(ratesObj as any);
      } catch (error) {
        console.error("Error loading currency preference:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreference();
  }, []);

  // Recargar tasas periódicamente
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { ApiClient } = await import("@/lib/api-client");
        const client = new ApiClient();
        const activeRates = await client.getActiveExchangeRates();

        const ratesObj: { USD?: any; EUR?: any } = {};
        if (Array.isArray(activeRates)) {
          const usd = activeRates.find((r: any) => r.toCurrency === "USD");
          if (usd) ratesObj.USD = usd;

          const eur = activeRates.find((r: any) => r.toCurrency === "EUR");
          if (eur) ratesObj.EUR = eur;
        }

        // Auto-switch based on availability during periodic refresh
        const activeCurrency: Currency = ratesObj.USD ? "USD" : "Bs";
        setPreferredCurrencyState(activeCurrency);
        setExchangeRates(ratesObj as any);
      } catch (error) {
        console.error("Error reloading exchange rates:", error);
      }
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, []);

  const setPreferredCurrency = async (currency: Currency) => {
    try {
      await setCurrencyPreference(currency);
      setPreferredCurrencyState(currency);
    } catch (error) {
      console.error("Error setting currency preference:", error);
      throw error;
    }
  };

  const formatWithPreference = async (
    amount: number,
    originalCurrency: Currency
  ): Promise<string> => {
    // Si la moneda original es la preferida, no convertir
    if (originalCurrency === preferredCurrency) {
      return formatCurrency(amount, originalCurrency);
    }

    // Convertir a la moneda preferida
    try {
      const convertedAmount = await convertCurrency(
        amount,
        originalCurrency,
        preferredCurrency
      );
      return formatCurrency(convertedAmount, preferredCurrency);
    } catch (error) {
      console.error("Error converting currency:", error);
      // Si falla la conversión, mostrar en moneda original
      return formatCurrency(amount, originalCurrency);
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        preferredCurrency,
        setPreferredCurrency,
        formatWithPreference,
        isLoading,
        exchangeRates,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

