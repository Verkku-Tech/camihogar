import { describe, it, expect } from "bun:test";
import { apiClient } from "../api-client";

describe("ApiClient Top Products Attribute Breakdown", () => {
  it("has getProductAttributeBreakdown method", () => {
    expect(typeof (apiClient as any).getProductAttributeBreakdown).toBe("function");
  });
});
