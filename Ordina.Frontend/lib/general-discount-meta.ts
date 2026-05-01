import type { DiscountUiType } from "@/lib/product-discount-ui";

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
    return {
      generalDiscountType: "porcentaje",
      generalDiscountPercent: orderForm.generalDiscount,
    };
  }
  return { generalDiscountType: "monto" };
}
