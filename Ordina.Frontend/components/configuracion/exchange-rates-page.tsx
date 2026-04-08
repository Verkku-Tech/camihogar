"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, AlertCircle, History } from "lucide-react";
import { toast } from "sonner";
import { ExchangeRate } from "@/lib/currency-utils";
import { ApiClient } from "@/lib/api-client";
import { useCurrency } from "@/contexts/currency-context";
import { Switch } from "@/components/ui/switch";

const HISTORY_DAYS = 30;

/** Normaliza fila del API (camelCase o PascalCase) al tipo ExchangeRate */
function normalizeExchangeRateRow(row: Record<string, unknown>): ExchangeRate {
  const id = String(row.id ?? row.Id ?? "");
  const effectiveRaw = (row.effectiveDate ?? row.EffectiveDate) as string;
  const createdRaw = (row.createdAt ?? row.CreatedAt) as string;
  return {
    id,
    fromCurrency: "Bs",
    toCurrency: (row.toCurrency ?? row.ToCurrency ?? "USD") as "USD" | "EUR",
    rate: Number(row.rate ?? row.Rate ?? 0),
    effectiveDate: effectiveRaw || new Date().toISOString(),
    isActive: Boolean(row.isActive ?? row.IsActive),
    createdAt: createdRaw || new Date().toISOString(),
    updatedAt: createdRaw || new Date().toISOString(),
  };
}

export function ExchangeRatesPage() {
  const { preferredCurrency, setPreferredCurrency } = useCurrency();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [rateHistory, setRateHistory] = useState<ExchangeRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    toCurrency: "USD" as "USD" | "EUR",
    rate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadRates();
  }, []);

  // Función helper para formatear la tasa de cambio
  const formatExchangeRate = (rate: number): string => {
    // Convertir a string y eliminar ceros innecesarios al final
    const rateStr = rate.toString();
    if (rateStr.includes('.')) {
      // Eliminar ceros finales después del punto decimal, pero mantener el punto si hay dígitos antes
      // Ejemplo: "347.26310000" -> "347.2631", "347.0" -> "347"
      return rateStr.replace(/\.?0+$/, '');
    }
    return rateStr;
  };

  const loadRates = async () => {
    try {
      const client = new ApiClient();
      const [activeRaw, historyRaw] = await Promise.all([
        client.getActiveExchangeRates(),
        client.getExchangeRateHistory(HISTORY_DAYS),
      ]);
      const activeRates = Array.isArray(activeRaw)
        ? activeRaw.map((r) => normalizeExchangeRateRow(r as Record<string, unknown>))
        : [];
      const history = Array.isArray(historyRaw)
        ? historyRaw.map((r) => normalizeExchangeRateRow(r as Record<string, unknown>))
        : [];
      setRates(activeRates);
      setRateHistory(history);
    } catch (error) {
      console.error("Error loading exchange rates:", error);
      toast.error("Error al cargar las tasas de cambio");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const client = new ApiClient();

      // Crear nueva tasa en el backend
      await client.setExchangeRate({
        fromCurrency: "Bs",
        toCurrency: formData.toCurrency,
        rate: parseFloat(formData.rate)
      });

      // Activar automáticamente el modo de visualización para la nueva moneda
      await setPreferredCurrency(formData.toCurrency);

      // Disparar evento para actualizar el sidebar y otros componentes
      window.dispatchEvent(new CustomEvent("exchangeRateUpdated"));

      await loadRates();
      setShowForm(false);
      setFormData({
        toCurrency: "USD",
        rate: "",
        effectiveDate: new Date().toISOString().split("T")[0],
      });
      toast.success("Tasa de cambio creada exitosamente. Moneda de visualización activada automáticamente.");
    } catch (error: any) {
      console.error("Error saving exchange rate:", error);
      const errorMessage = error.message || "Error al guardar la tasa de cambio";
      toast.error(errorMessage);
    }
  };



  const handleCurrencyToggle = async (
    currency: "USD" | "EUR",
    checked: boolean
  ) => {
    try {
      if (checked) {
        // Activar esta moneda (desactiva automáticamente Bolívar)
        await setPreferredCurrency(currency);
        toast.success(
          `Moneda de visualización cambiada a ${currency === "USD" ? "Dólares" : "Euros"
          }`
        );
      } else {
        // Desactivar esta moneda (vuelve a Bolívar por defecto)
        await setPreferredCurrency("Bs");
        toast.success("Moneda de visualización cambiada a Bolívares");
      }
    } catch (error) {
      console.error("Error changing currency:", error);
      toast.error("Error al cambiar la moneda de visualización");
    }
  };

  const activeRates = rates.filter((r) => r.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Tasas de Cambio
          </h1>
          <p className="text-muted-foreground">
            Gestiona las tasas de cambio para conversión de monedas (USD, EUR)
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Tasa
        </Button>
      </div>

      {/* Alerta cuando no hay tasas */}
      {rates.length === 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  No hay tasas de cambio configuradas
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Es necesario crear al menos una tasa de cambio (USD o EUR) para poder
                  realizar conversiones de moneda en pedidos y presupuestos.
                  Las tasas se marcan como activas automáticamente al crearlas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form para nueva tasa */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva Tasa de Cambio</CardTitle>
            <CardDescription>
              Define una nueva tasa de cambio. La nueva tasa desactivará
              automáticamente las anteriores de la misma moneda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={formData.toCurrency}
                    onValueChange={(value: "USD" | "EUR") =>
                      setFormData({ ...formData, toCurrency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                      <SelectItem value="EUR">Euros (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tasa (Bs por unidad)</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.rate}
                    onChange={(e) =>
                      setFormData({ ...formData, rate: e.target.value })
                    }
                    placeholder="Ej: 347.26310000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: 347.26310000 significa 1 USD = 347.26310000 Bs
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Guardar</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      toCurrency: "USD",
                      rate: "",
                      effectiveDate: new Date().toISOString().split("T")[0],
                    });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabla de tasas activas */}
      <Card>
        <CardHeader>
          <CardTitle>Tasas Activas</CardTitle>
          <CardDescription>
            Tasas de cambio vigentes actualmente en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeRates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay tasas de cambio configuradas</p>
              <p className="text-sm">Agrega una tasa para comenzar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Tasa (Bs)</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-center">
                    Moneda de Visualización
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRates.map((rate) => {
                  const isChecked = preferredCurrency === rate.toCurrency;

                  return (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {rate.toCurrency === "USD" ? "💵 Dólares" : "💶 Euros"}
                      </TableCell>
                      <TableCell>{formatExchangeRate(rate.rate)} Bs</TableCell>
                      <TableCell>
                        {new Date(rate.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div
                          className="checkbox-con"
                          style={{ margin: "0", justifyContent: "center" }}
                        >
                          <Switch
                            id={`currency-switch-${rate.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleCurrencyToggle(rate.toCurrency, checked)
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {activeRates.length > 0 && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground text-center">
              {preferredCurrency === "Bs"
                ? "La moneda de visualización actual es Bolívares (por defecto). Activa un checkbox para cambiar."
                : `La moneda de visualización actual es ${preferredCurrency === "USD" ? "Dólares" : "Euros"
                }. Desactiva todos los checkboxes para volver a Bolívares.`}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Historial reciente (activas e inactivas) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de tasas
          </CardTitle>
          <CardDescription>
            Registros de los últimos {HISTORY_DAYS} días (incluye tasas reemplazadas al agregar una
            nueva). La tasa vigente para pedidos cerrados sigue guardada en cada pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rateHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No hay registros en el historial reciente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Tasa (Bs)</TableHead>
                  <TableHead>Fecha registro</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateHistory.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.toCurrency === "USD" ? "💵 Dólares" : "💶 Euros"}
                    </TableCell>
                    <TableCell>{formatExchangeRate(rate.rate)} Bs</TableCell>
                    <TableCell>
                      {new Date(rate.createdAt).toLocaleString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {rate.isActive ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
