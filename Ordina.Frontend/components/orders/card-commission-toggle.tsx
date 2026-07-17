"use client";

import { Percent } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CARD_COMMISSION_RATE,
  computeCardCommissionBs,
} from "@/lib/card-commission";
import { formatCurrency } from "@/lib/currency-utils";

interface CardCommissionToggleProps {
  applied: boolean;
  amountBs: number;
  exchangeRate?: number;
  onAppliedChange: (applied: boolean) => void;
  disabled?: boolean;
}

export function CardCommissionToggle({
  applied,
  amountBs,
  exchangeRate,
  onAppliedChange,
  disabled = false,
}: CardCommissionToggleProps) {
  const commissionBs = applied ? computeCardCommissionBs(amountBs) : 0;
  const commissionUsd =
    commissionBs > 0 && exchangeRate && exchangeRate > 0
      ? commissionBs / exchangeRate
      : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Checkbox
          id="card-commission-applied"
          checked={applied}
          disabled={disabled}
          onCheckedChange={(checked) => onAppliedChange(checked === true)}
        />
        <div className="space-y-1 leading-none">
          <Label
            htmlFor="card-commission-applied"
            className="text-xs font-medium cursor-pointer"
          >
            Registrar comisión del {(CARD_COMMISSION_RATE * 100).toFixed(0)}%
            (informativo)
          </Label>
          <p className="text-xs text-muted-foreground">
            No afecta el total del pedido ni el saldo pendiente.
          </p>
        </div>
      </div>

      {applied && commissionBs > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-sm dark:border-amber-800 dark:bg-amber-950/80">
          <Percent className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-900 dark:text-amber-100">
            <span className="font-medium">Comisión TDC:</span>{" "}
            <span className="font-semibold">
              {formatCurrency(commissionBs, "Bs")}
            </span>
            {commissionUsd != null && (
              <span className="text-amber-800/90 dark:text-amber-200/90">
                {" "}
                (~{formatCurrency(commissionUsd, "USD")})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export function CardCommissionDetailHint({
  commissionBs,
  exchangeRate,
}: {
  commissionBs: number;
  exchangeRate?: number;
}) {
  const commissionUsd =
    exchangeRate && exchangeRate > 0 ? commissionBs / exchangeRate : null;

  return (
    <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
      Comisión TDC (6%): {formatCurrency(commissionBs, "Bs")}
      {commissionUsd != null && (
        <span className="ml-1">(~{formatCurrency(commissionUsd, "USD")})</span>
      )}
    </div>
  );
}
