import { describe, expect, it } from "bun:test";
import {
  extractStructuredChanges,
  formatRelativeTime,
  type StructuredAuditItem,
} from "@/lib/audit-log-labels";
import type { OrderAuditLogDto } from "@/lib/api-client";

describe("Audit Log Structured Change Extraction", () => {
  it("extracts status change as typed status item", () => {
    const log: OrderAuditLogDto = {
      id: "1",
      orderId: "ord-1",
      orderNumber: "ORD-1642",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Estado del pedido: En almacén → En Ruta",
      changes: [
        {
          field: "Status",
          oldValue: "almacen_no_fabricado",
          newValue: "en ruta",
          displayField: "Estado del pedido",
          displayOldValue: "En almacén",
          displayNewValue: "En Ruta",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: "status",
      label: "Estado del pedido",
      oldValue: "En almacén",
      newValue: "En Ruta",
    });
  });

  it("extracts added and removed payments with amounts", () => {
    const log: OrderAuditLogDto = {
      id: "2",
      orderId: "ord-2",
      orderNumber: "ORD-1205",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Agregó pago: Binance $170,00 — Eliminó pago: Binance $200,00",
      changes: [
        {
          field: "mixedPayments[+]",
          oldValue: null,
          newValue: "Método=Binance; Monto=170; Moneda=USD",
          displayField: "Pago agregado",
          displayNewValue: "Binance $170,00",
        },
        {
          field: "mixedPayments[-]",
          oldValue: "Método=Binance; Monto=200; Moneda=USD",
          newValue: null,
          displayField: "Pago eliminado",
          displayOldValue: "Binance $200,00",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      type: "payment_add",
      paymentText: "Binance $170,00",
    });
    expect(items[1]).toEqual({
      type: "payment_remove",
      paymentText: "Binance $200,00",
    });
  });

  it("extracts arbitrary field changes with before and after values", () => {
    const log: OrderAuditLogDto = {
      id: "3",
      orderId: "ord-3",
      orderNumber: "ORD-466",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Actualizó Observaciones de despacho: (sin valor) → Máximo 5pm",
      changes: [
        {
          field: "DispatchObservations",
          oldValue: null,
          newValue: "Máximo 5pm",
          displayField: "Observaciones de despacho",
          displayOldValue: "(sin valor)",
          displayNewValue: "Máximo 5pm",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: "field_diff",
      label: "Observaciones de despacho",
      oldValue: "(sin valor)",
      newValue: "Máximo 5pm",
    });
  });

  it("handles order creation log with payment summary", () => {
    const log: OrderAuditLogDto = {
      id: "4",
      orderId: "ord-4",
      orderNumber: "ORD-2143",
      action: "created",
      userId: "u2",
      userName: "Francis",
      summary: "Agregó pago durante la creación del pedido: Tarjeta de débito Bs. 106.195,00",
      changes: [],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].type).toBe("creation_summary");
    expect(items[0].paymentText).toBe("Tarjeta de débito Bs. 106.195,00");
  });

  it("formats relative time correctly", () => {
    const now = new Date("2026-09-23T18:00:00Z");
    expect(formatRelativeTime("2026-09-23T17:59:30Z", now)).toBe("Hace momentos");
    expect(formatRelativeTime("2026-09-23T17:45:00Z", now)).toBe("Hace 15 min");
    expect(formatRelativeTime("2026-09-23T15:00:00Z", now)).toBe("Hace 3 horas");
    expect(formatRelativeTime("2026-09-21T18:00:00Z", now)).toBe("Hace 2 días");
  });
});
