import type { DiscountUiType } from "@/lib/product-discount-ui";

/** Valor a persistir: 0 explícito limpia descuento en backend e IndexedDB. */
export function resolveGeneralDiscountAmountForSave(amount: number): number {
  return amount > 0 ? amount : 0;
}

/** Campos opcionales para persistir junto a `generalDiscountAmount` (Create/Update Order). */
export function buildGeneralDiscountPersistPayload(orderForm: {
  generalDiscountAmount: number;
  generalDiscountType: DiscountUiType;
  generalDiscount: number;
}): {
  generalDiscountType?: "monto" | "porcentaje";
  generalDiscountPercent?: number;
} {
  if (!orderForm.generalDiscountAmount || orderForm.generalDiscountAmount <= 0) {
    return {};
  }
  if (orderForm.generalDiscountType === "porcentaje" && orderForm.generalDiscount > 0) {
    const clamped = Math.min(100, Math.max(0, orderForm.generalDiscount));
    return {
      generalDiscountType: "porcentaje",
      generalDiscountPercent: clamped,
    };
  }
  return { generalDiscountType: "monto" };
}
