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
import { getAll, add, update } from "@/lib/indexeddb";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { ExchangeRate } from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";

export function ExchangeRatesPage() {
  const { preferredCurrency, setPreferredCurrency } = useCurrency();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    toCurrency: "USD" as "USD" | "EUR",
    rate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const allRates = await getAll<ExchangeRate>("exchange_rates");
      setRates(
        allRates.sort(
          (a, b) =>
            new Date(b.effectiveDate).getTime() -
            new Date(a.effectiveDate).getTime()
        )
      );
    } catch (error) {
      console.error("Error loading exchange rates:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Desactivar tasas anteriores de la misma moneda
      const existingRates = rates.filter(
        (r) => r.toCurrency === formData.toCurrency && r.isActive
      );

      for (const rate of existingRates) {
        await update("exchange_rates", { ...rate, isActive: false });
      }

      // Crear nueva tasa
      const newRate: ExchangeRate = {
        id: crypto.randomUUID(),
        fromCurrency: "Bs",
        toCurrency: formData.toCurrency,
        rate: parseFloat(formData.rate),
        effectiveDate: formData.effectiveDate,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await add("exchange_rates", newRate);
      await loadRates();
      setShowForm(false);
      setFormData({
        toCurrency: "USD",
        rate: "",
        effectiveDate: new Date().toISOString().split("T")[0],
      });
      toast.success("Tasa de cambio creada exitosamente");
    } catch (error) {
      console.error("Error saving exchange rate:", error);
      toast.error("Error al guardar la tasa de cambio");
    }
  };

  const handleDeactivate = async (rate: ExchangeRate) => {
    try {
      await update("exchange_rates", { ...rate, isActive: false });
      await loadRates();
      toast.success("Tasa desactivada exitosamente");
    } catch (error) {
      console.error("Error deactivating rate:", error);
      toast.error("Error al desactivar la tasa");
    }
  };

  const handleCurrencyToggle = async (currency: "USD" | "EUR", checked: boolean) => {
    try {
      if (checked) {
        // Activar esta moneda (desactiva automáticamente Bolívar)
        await setPreferredCurrency(currency);
        toast.success(`Moneda de visualización cambiada a ${currency === "USD" ? "Dólares" : "Euros"}`);
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
                    step="0.01"
                    min="0"
                    value={formData.rate}
                    onChange={(e) =>
                      setFormData({ ...formData, rate: e.target.value })
                    }
                    placeholder="Ej: 38.50"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: 38.50 significa 1 USD = 38.50 Bs
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
                  <TableHead className="text-center">Moneda de Visualización</TableHead>
                  <TableHead>Acciones</TableHead>
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
                      <TableCell>{rate.rate.toFixed(2)} Bs</TableCell>
                      <TableCell>
                        {new Date(rate.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="checkbox-con" style={{ margin: "0", justifyContent: "center" }}>
                          <input
                            id={`currency-checkbox-${rate.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              handleCurrencyToggle(rate.toCurrency, e.target.checked)
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(rate)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                : `La moneda de visualización actual es ${preferredCurrency === "USD" ? "Dólares" : "Euros"}. Desactiva todos los checkboxes para volver a Bolívares.`}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

