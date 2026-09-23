import { describe, test, expect } from "bun:test";
import {
  calculateOrderStatusFromProducts,
  resolveDisplayOrderStatus,
} from "../order-status-aggregation";
import type { OrderProductDto } from "../api-client";

describe("Manufacturing Status Aggregation and Report SLA Tracking", () => {
  test("returns Completado when all products are completely finished", () => {
    const products: OrderProductDto[] = [
      { id: "p1", name: "Mesa Comedor", logisticStatus: "Completado", price: 200, quantity: 1, total: 200 },
      { id: "p2", name: "Silla Comedor", logisticStatus: "Completado", price: 50, quantity: 4, total: 200 },
    ];

    expect(calculateOrderStatusFromProducts(products)).toBe("Completado");
  });

  test("returns Fabricándose when at least one product is currently in fabrication", () => {
    const products: OrderProductDto[] = [
      { id: "p1", name: "Mesa Comedor", logisticStatus: "Completado", price: 200, quantity: 1, total: 200 },
      { id: "p2", name: "Silla Comedor", logisticStatus: "Fabricándose", price: 50, quantity: 4, total: 200 },
    ];

    expect(calculateOrderStatusFromProducts(products)).toBe("Fabricándose");
  });

  test("prioritizes Declinado over other production states", () => {
    const products: OrderProductDto[] = [
      { id: "p1", name: "Cama Matrimonial", logisticStatus: "Declinado", price: 300, quantity: 1, total: 300 },
      { id: "p2", name: "Colchón", logisticStatus: "En Almacén", price: 200, quantity: 1, total: 200 },
    ];

    expect(calculateOrderStatusFromProducts(products)).toBe("Declinado");
  });

  test("prioritizes products in FABRICACION location when aggregating mixed orders", () => {
    const products: OrderProductDto[] = [
      { id: "p1", name: "Almohada (Tienda)", locationStatus: "TIENDA", logisticStatus: "En Almacén", price: 30, quantity: 2, total: 60 },
      { id: "p2", name: "Juego de Dormitorio", locationStatus: "FABRICACION", logisticStatus: "Fabricándose", price: 600, quantity: 1, total: 600 },
    ];

    // Status aggregation focuses on the fabrication bottleneck
    expect(calculateOrderStatusFromProducts(products)).toBe("Fabricándose");
  });

  test("resolveDisplayOrderStatus preserves budget and reservation types", () => {
    const budgetOrder = {
      type: "budget",
      status: "Presupuesto",
      products: [
        { id: "p1", name: "Mueble X", logisticStatus: "Fabricándose", price: 100, quantity: 1, total: 100 },
      ],
    };

    expect(resolveDisplayOrderStatus(budgetOrder)).toBe("Presupuesto");
  });

  test("SLA tracking identifies delayed orders based on estimated delivery date", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const isOrderDelayed = (order: { estimatedDeliveryDate?: string; status: string }) => {
      if (order.status === "Completado" || order.status === "Cancelado") return false;
      if (!order.estimatedDeliveryDate) return false;
      return new Date(order.estimatedDeliveryDate).getTime() < Date.now();
    };

    expect(isOrderDelayed({ estimatedDeliveryDate: yesterday, status: "Fabricándose" })).toBe(true);
    expect(isOrderDelayed({ estimatedDeliveryDate: tomorrow, status: "Fabricándose" })).toBe(false);
    expect(isOrderDelayed({ estimatedDeliveryDate: yesterday, status: "Completado" })).toBe(false);
  });
});
