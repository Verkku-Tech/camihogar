import { describe, expect, it } from "bun:test";
import { extractStructuredChanges } from "@/lib/audit-log-labels";
import type { OrderAuditLogDto } from "@/lib/api-client";

describe("Order Audit Timeline Item Logic", () => {
  it("extracts multiple changes and limits to 3 initial items with remaining count", () => {
    const log: OrderAuditLogDto = {
      id: "log-1",
      orderId: "ord-1",
      orderNumber: "ORD-466",
      action: "updated",
      userId: "u1",
      userName: "Nicole Gutiérrez",
      summary: "Actualizó 5 campos",
      changes: [
        { field: "Observations", oldValue: "previo", newValue: "nuevo" },
        { field: "DispatchObservations", oldValue: null, newValue: "Máximo 5pm" },
        { field: "DeliveryAddress", oldValue: "Dir 1", newValue: "Dir 2" },
        { field: "SaleType", oldValue: "tienda", newValue: "entrega" },
        { field: "PaymentCondition", oldValue: "Pendiente", newValue: "Todo Pago" },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(5);
    const initialItems = items.slice(0, 3);
    expect(initialItems).toHaveLength(3);
    const remainingCount = items.length - 3;
    expect(remainingCount).toBe(2);
  });

  it("detects payment additions and deletions correctly", () => {
    const log: OrderAuditLogDto = {
      id: "log-2",
      orderId: "ord-2",
      orderNumber: "ORD-1205",
      action: "updated",
      userId: "u1",
      userName: "Nicole Gutiérrez",
      summary: "Actualizó pagos",
      changes: [
        { field: "mixedPayments[+]", newValue: "Método=Binance; Monto=170; Moneda=USD", displayNewValue: "Binance $170,00" },
        { field: "mixedPayments[-]", oldValue: "Método=Binance; Monto=200; Moneda=USD", displayOldValue: "Binance $200,00" },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe("payment_add");
    expect(items[0].paymentText).toBe("Binance $170,00");
    expect(items[1].type).toBe("payment_remove");
    expect(items[1].paymentText).toBe("Binance $200,00");
  });
});
