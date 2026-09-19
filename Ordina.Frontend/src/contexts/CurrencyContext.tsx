"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Currency,
  getActiveExchangeRates,
  convertCurrency,
  formatCurrency,
  type ExchangeRate,
} from "@/lib/currency-utils";
import {
  getCurrencyPreference,
  setCurrencyPreference,
} from "@/lib/currency-preference";

interface CurrencyContextType {
  preferredCurrency: Currency;
  setPreferredCurrency: (currency: Currency) => Promise<void>;
  formatWithPreference: (
    amount: number,
    originalCurrency: Currency,
  ) => Promise<string>;
  isLoading: boolean;
  exchangeRates?: { USD?: ExchangeRate; EUR?: ExchangeRate };
  hasActiveExchangeRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [preferredCurrency, setPreferredCurrencyState] =
    useState<Currency>("Bs");
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  const [hasActiveExchangeRates, setHasActiveExchangeRates] = useState(true);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const [currency, ratesObj] = await Promise.all([
          getCurrencyPreference(),
          getActiveExchangeRates(),
        ]);

        const activeCurrency: Currency = ratesObj.USD ? "USD" : "Bs";

        setPreferredCurrencyState(activeCurrency);
        setExchangeRates(ratesObj);
        setHasActiveExchangeRates(!!ratesObj.USD || !!ratesObj.EUR);
      } catch (error) {
        console.error("Error loading currency preference:", error);
        setHasActiveExchangeRates(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreference();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const ratesObj = await getActiveExchangeRates();
        const activeCurrency: Currency = ratesObj.USD ? "USD" : "Bs";
        setPreferredCurrencyState(activeCurrency);
        setExchangeRates(ratesObj);
        setHasActiveExchangeRates(!!ratesObj.USD || !!ratesObj.EUR);
      } catch (error) {
        console.error("Error reloading exchange rates:", error);
        setHasActiveExchangeRates(false);
      }
    }, 60000);

    const handleRateUpdate = () => {
      void getActiveExchangeRates().then((ratesObj) => {
        setExchangeRates(ratesObj);
        setHasActiveExchangeRates(!!ratesObj.USD || !!ratesObj.EUR);
      });
    };
    window.addEventListener("exchangeRateUpdated", handleRateUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("exchangeRateUpdated", handleRateUpdate);
    };
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
    originalCurrency: Currency,
  ): Promise<string> => {
    if (originalCurrency === preferredCurrency) {
      return formatCurrency(amount, originalCurrency);
    }

    try {
      const convertedAmount = await convertCurrency(
        amount,
        originalCurrency,
        preferredCurrency,
        exchangeRates,
      );
      if (convertedAmount === null) {
        return `${formatCurrency(amount, originalCurrency)} (sin tasa BCV)`;
      }
      return formatCurrency(convertedAmount, preferredCurrency);
    } catch (error) {
      console.error("Error converting currency:", error);
      return `${formatCurrency(amount, originalCurrency)} (sin tasa BCV)`;
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
        hasActiveExchangeRates,
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
