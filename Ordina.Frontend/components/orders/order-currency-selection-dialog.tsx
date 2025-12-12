"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign } from "lucide-react";
import type { Currency, ExchangeRate } from "@/lib/currency-utils";
import { getAll } from "@/lib/indexeddb";
import { formatCurrency } from "@/lib/currency-utils";

interface OrderCurrencySelectionDialogProps {
  open: boolean;
  orderDate: string; // Fecha del pedido para buscar la tasa del día
  // NUEVO: Recibir las tasas guardadas del pedido
  savedExchangeRates?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  };
  onCurrencySelect: (currency: Currency) => void;
  onOpenChange?: (open: boolean) => void; // Callback para cuando cambia el estado del diálogo
}

export function OrderCurrencySelectionDialog({
  open,
  orderDate,
  savedExchangeRates, // NUEVO prop
  onCurrencySelect,
  onOpenChange,
}: OrderCurrencySelectionDialogProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("Bs");
  const [exchangeRates, setExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExchangeRates = async () => {
      try {
        setLoading(true);

        // PRIORIDAD: Usar las tasas guardadas del pedido si existen
        if (savedExchangeRates) {
          const rates: { USD?: ExchangeRate; EUR?: ExchangeRate } = {};

          if (savedExchangeRates.USD) {
            rates.USD = {
              id: `saved-usd-${orderDate}`,
              fromCurrency: "Bs",
              toCurrency: "USD",
              rate: savedExchangeRates.USD.rate,
              effectiveDate: savedExchangeRates.USD.effectiveDate,
              isActive: true,
              createdAt: orderDate,
              updatedAt: orderDate,
            };
          }

          if (savedExchangeRates.EUR) {
            rates.EUR = {
              id: `saved-eur-${orderDate}`,
              fromCurrency: "Bs",
              toCurrency: "EUR",
              rate: savedExchangeRates.EUR.rate,
              effectiveDate: savedExchangeRates.EUR.effectiveDate,
              isActive: true,
              createdAt: orderDate,
              updatedAt: orderDate,
            };
          }

          setExchangeRates(rates);
          setLoading(false);
          return;
        }

        // Fallback: Buscar desde IndexedDB si no hay tasas guardadas
        const orderDateObj = new Date(orderDate);
        orderDateObj.setHours(0, 0, 0, 0);

        // Obtener todas las tasas
        const allRates = await getAll<ExchangeRate>("exchange_rates");

        // Filtrar tasas activas y ordenar por fecha
        const activeRates = allRates
          .filter((r) => r.isActive)
          .sort(
            (a, b) =>
              new Date(b.effectiveDate).getTime() -
              new Date(a.effectiveDate).getTime()
          );

        // Buscar la tasa más reciente hasta el día del pedido
        const usdRate = activeRates.find(
          (r) =>
            r.toCurrency === "USD" &&
            new Date(r.effectiveDate).getTime() <= orderDateObj.getTime()
        );

        const eurRate = activeRates.find(
          (r) =>
            r.toCurrency === "EUR" &&
            new Date(r.effectiveDate).getTime() <= orderDateObj.getTime()
        );

        // Si no hay tasa para el día del pedido, usar la más reciente disponible
        const latestUsd = activeRates.find((r) => r.toCurrency === "USD");
        const latestEur = activeRates.find((r) => r.toCurrency === "EUR");

        setExchangeRates({
          USD: usdRate || latestUsd,
          EUR: eurRate || latestEur,
        });
      } catch (error) {
        console.error("Error loading exchange rates:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadExchangeRates();
    }
  }, [open, orderDate, savedExchangeRates]);

  const handleContinue = () => {
    onCurrencySelect(selectedCurrency);
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Si se intenta cerrar sin seleccionar, prevenir el cierre
    if (!newOpen && !selectedCurrency) {
      return; // No permitir cerrar sin seleccionar
    }
    // Notificar al padre del cambio de estado
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Seleccionar Moneda para Visualización
          </DialogTitle>
          <DialogDescription>
            Selecciona la moneda en la que deseas ver la totalización de este
            pedido. Las conversiones se basan en las tasas de cambio del día en
            que se creó el pedido, garantizando valores precisos y consistentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Selector de moneda */}
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda de Visualización</Label>
            <Select
              value={selectedCurrency}
              onValueChange={(value) => setSelectedCurrency(value as Currency)}
            >
              <SelectTrigger id="currency">
                <SelectValue placeholder="Seleccionar moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bs">Bolívares (Bs.)</SelectItem>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
                <SelectItem value="EUR">Euros (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tasas de cambio del día */}
          {!loading && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
              <Label className="text-sm font-semibold">
                Tasas de Cambio del Día del Pedido
              </Label>
              <div className="space-y-2 text-sm">
                {exchangeRates.USD && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD:</span>
                    <span className="font-medium">
                      1 USD = {formatCurrency(exchangeRates.USD.rate, "Bs")}
                    </span>
                  </div>
                )}
                {exchangeRates.EUR && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EUR:</span>
                    <span className="font-medium">
                      1 EUR = {formatCurrency(exchangeRates.EUR.rate, "Bs")}
                    </span>
                  </div>
                )}
                {!exchangeRates.USD && !exchangeRates.EUR && (
                  <p className="text-sm text-muted-foreground">
                    No hay tasas de cambio disponibles para el día del pedido.
                  </p>
                )}
              </div>
              {exchangeRates.USD && (
                <p className="text-xs text-muted-foreground mt-2">
                  Fecha efectiva USD:{" "}
                  {new Date(
                    exchangeRates.USD.effectiveDate
                  ).toLocaleDateString()}
                </p>
              )}
              {exchangeRates.EUR && (
                <p className="text-xs text-muted-foreground">
                  Fecha efectiva EUR:{" "}
                  {new Date(
                    exchangeRates.EUR.effectiveDate
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Cargando tasas de cambio...
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={handleContinue} disabled={loading}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
