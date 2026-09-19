"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Currency } from "@/lib/currency-utils";
import { toast } from "sonner";

type DeliveryServiceCostInputProps = {
  label: string;
  cost: number | undefined;
  currency: Currency;
  onChange: (cost: number | undefined, currency: Currency) => void;
  convertCurrencyValue: (
    value: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ) => number | null;
  required?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
};

export function DeliveryServiceCostInput({
  label,
  cost,
  currency,
  onChange,
  convertCurrencyValue,
  required = false,
  placeholder = "0.00",
  allowEmpty = false,
}: DeliveryServiceCostInputProps) {
  const inputValue =
    cost === undefined || cost === 0 ? "" : String(cost);

  return (
    <div className="space-y-2 pl-6">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Select
          value={currency}
          onValueChange={(value: Currency) => {
            if (cost == null || cost === 0) {
              onChange(cost, value);
              return;
            }
            const converted = convertCurrencyValue(cost, currency, value);
            if (converted === null) {
              toast.error(
                "No hay tasa BCV para convertir el monto a esa moneda.",
              );
              return;
            }
            onChange(converted, value);
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Bs">Bs</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          required={required}
          value={inputValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(allowEmpty ? undefined : 0, currency);
              return;
            }
            const parsed = Number.parseFloat(raw);
            if (!Number.isFinite(parsed)) {
              onChange(allowEmpty ? undefined : 0, currency);
              return;
            }
            onChange(parsed, currency);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
      </div>
    </div>
  );
}
