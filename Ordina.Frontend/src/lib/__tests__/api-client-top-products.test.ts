import { describe, it, expect } from "bun:test";
import { apiClient, type ProductVariantStat, type ProductAttributeBreakdownResponse } from "../api-client";

describe("ApiClient Top Products Attribute Breakdown", () => {
  it("has getProductAttributeBreakdown method", () => {
    expect(typeof (apiClient as any).getProductAttributeBreakdown).toBe("function");
  });

  it("supports ProductVariantStat with real order certification and attributes", () => {
    const mockStat: ProductVariantStat = {
      rank: 1,
      variantName: "Box: BL / Copete: Lineal / Tela: Lino / Color: Gris",
      attributes: {
        Box: "BL",
        Copete: "Lineal",
        Tela: "Lino",
        Color: "Gris",
      },
      unitsSold: 15,
      percentage: 60.0,
      totalInvoicedUsd: 1500.0,
      orderNumbers: ["ORD-001", "ORD-002", "ORD-003"],
      orders: [
        {
          orderNumber: "ORD-001",
          clientName: "Juan Perez",
          createdAt: "2026-09-20T12:00:00Z",
          quantity: 10,
          totalUsd: 1000.0,
          status: "Entregado",
        },
      ],
    };

    expect(mockStat.rank).toBe(1);
    expect(mockStat.orderNumbers).toHaveLength(3);
    expect(mockStat.orderNumbers[0]).toBe("ORD-001");
    expect(mockStat.orders).toHaveLength(1);
    expect(mockStat.orders?.[0].clientName).toBe("Juan Perez");
    expect(mockStat.orders?.[0].status).toBe("Entregado");
    expect(Object.keys(mockStat.attributes)).toHaveLength(4);
    expect(mockStat.percentage).toBe(60.0);
  });

  it("supports topVariants and totalUniqueVariantsCount in ProductAttributeBreakdownResponse", () => {
    const mockResponse: ProductAttributeBreakdownResponse = {
      productName: "Cama King",
      category: "Camas",
      totalUnitsSold: 25,
      totalInvoicedUsd: 2500,
      averageUnitPriceUsd: 100,
      ordersCount: 5,
      attributes: [],
      topVariants: [
        {
          rank: 1,
          variantName: "Box: BL / Color: Gris",
          attributes: { Box: "BL", Color: "Gris" },
          unitsSold: 15,
          percentage: 60.0,
          totalInvoicedUsd: 1500,
          orderNumbers: ["ORD-001"],
        },
      ],
      totalUniqueVariantsCount: 3,
    };

    expect(mockResponse.topVariants).toHaveLength(1);
    expect(mockResponse.totalUniqueVariantsCount).toBe(3);
  });

  it("supports activeAttributeIds and isSuggestedForGrouping in response and attributes", () => {
    const mockResponse: ProductAttributeBreakdownResponse = {
      productName: "Cama Matrimonial",
      category: "Camas",
      totalUnitsSold: 50,
      attributes: [
        {
          attributeId: "box",
          attributeTitle: "Box",
          totalUnitsWithAttribute: 50,
          options: [{ value: "DT", unitsSold: 40, percentage: 80 }],
          isSuggestedForGrouping: true,
        },
        {
          attributeId: "tela",
          attributeTitle: "Tela",
          totalUnitsWithAttribute: 50,
          options: [{ value: "Lino", unitsSold: 10, percentage: 20 }],
          isSuggestedForGrouping: false,
        },
      ],
      activeAttributeIds: ["box"],
    };

    expect(mockResponse.activeAttributeIds).toEqual(["box"]);
    expect(mockResponse.attributes[0].isSuggestedForGrouping).toBe(true);
    expect(mockResponse.attributes[1].isSuggestedForGrouping).toBe(false);
  });
});

