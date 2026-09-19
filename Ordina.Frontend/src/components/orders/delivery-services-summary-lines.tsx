"use client";

import { useMemo } from "react";
import type { Order } from "@/lib/storage";
import type { Currency } from "@/lib/currency-utils";
import {
  getActiveDeliveryServiceLines,
  type ExchangeRatesInput,
} from "@/lib/order-line-pricing";

type DeliveryServicesSummaryLinesProps = {
  deliveryCost: number;
  deliveryServices?: Order["deliveryServices"];
  baseCurrency: Currency;
  exchangeRates?: ExchangeRatesInput;
  renderTotalAmount: () => React.ReactNode;
  renderLineAmount: (amountInBase: number) => React.ReactNode;
};

export function DeliveryServicesSummaryLines({
  deliveryCost,
  deliveryServices,
  baseCurrency,
  exchangeRates,
  renderTotalAmount,
  renderLineAmount,
}: DeliveryServicesSummaryLinesProps) {
  const lines = useMemo(
    () =>
      getActiveDeliveryServiceLines(
        deliveryServices,
        baseCurrency,
        exchangeRates,
      ),
    [deliveryServices, baseCurrency, exchangeRates],
  );

  if (deliveryCost <= 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span>Servicios Adicionales:</span>
        {renderTotalAmount()}
      </div>
      {lines.length === 1 && (
        <p className="text-xs text-muted-foreground pl-1">{lines[0].label}</p>
      )}
      {lines.length > 1 &&
        lines.map((line) => (
          <div
            key={line.key}
            className="flex justify-between text-sm text-muted-foreground pl-2"
          >
            <span>{line.label}</span>
            {renderLineAmount(line.costInBase)}
          </div>
        ))}
    </div>
  );
}
