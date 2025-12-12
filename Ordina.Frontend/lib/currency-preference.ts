import { Currency } from "./currency-utils";
import { add, get, getAll, update } from "./indexeddb";

export interface CurrencyPreference {
  id: string;
  key: "display_currency"; // Clave única para la preferencia
  value: Currency;
  updatedAt: string;
}

const PREFERENCE_KEY = "display_currency";
const DEFAULT_CURRENCY: Currency = "Bs";
const STORE_NAME = "app_settings";

// Obtener la preferencia de moneda
export const getCurrencyPreference = async (): Promise<Currency> => {
  try {
    const settings = await getAll<CurrencyPreference>(STORE_NAME);
    const preference = settings.find((s) => s.key === PREFERENCE_KEY);
    return preference?.value || DEFAULT_CURRENCY;
  } catch (error) {
    console.error("Error getting currency preference:", error);
    return DEFAULT_CURRENCY;
  }
};

// Guardar la preferencia de moneda
export const setCurrencyPreference = async (currency: Currency): Promise<void> => {
  try {
    const settings = await getAll<CurrencyPreference>(STORE_NAME);
    const existing = settings.find((s) => s.key === PREFERENCE_KEY);

    const preference: CurrencyPreference = {
      id: existing?.id || crypto.randomUUID(),
      key: PREFERENCE_KEY,
      value: currency,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await update(STORE_NAME, preference);
    } else {
      await add(STORE_NAME, preference);
    }
  } catch (error) {
    console.error("Error setting currency preference:", error);
    throw error;
  }
};

