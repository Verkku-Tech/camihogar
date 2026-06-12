import type { OrderProductDto } from "@/lib/api-client";
import type { OrderProduct, Product } from "@/lib/storage";
import { resolveCatalogProductFromOrderProductId } from "@/lib/storage";

/** Paridad con CommissionLineClassifier.GetCatalogProductId en backend. */
export function getCatalogProductIdFromLineId(lineId: string): string {
  const trimmed = lineId?.trim() ?? "";
  if (!trimmed) return "";

  const parts = trimmed.split("-");
  if (parts.length >= 3) {
    const ts = parts[parts.length - 2];
    if (/^\d+$/.test(ts)) {
      return parts.slice(0, -2).join("-");
    }
  }
  return trimmed;
}

/** Mapea líneas de pedido al DTO de confirmación preservando metadatos de catálogo/moneda. */
export function mapOrderProductsToConfirmDto(
  products: OrderProduct[],
): OrderProductDto[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    priceCurrency: p.priceCurrency,
    quantity: p.quantity,
    total: p.total,
    category: p.category,
    stock: p.stock,
    attributes: p.attributes,
    discount: p.discount,
    observations: p.observations,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    availabilityStatus: p.availabilityStatus,
    manufacturingStatus: p.manufacturingStatus,
    manufacturingProviderId: p.manufacturingProviderId,
    manufacturingProviderName: p.manufacturingProviderName,
    manufacturingStartedAt: p.manufacturingStartedAt,
    manufacturingCompletedAt: p.manufacturingCompletedAt,
    manufacturingNotes: p.manufacturingNotes,
    locationStatus: p.locationStatus,
    logisticStatus: p.logisticStatus,
    deliveredAt: p.deliveredAt,
    surchargeEnabled: p.surchargeEnabled,
    surchargeAmount: p.surchargeAmount,
    surchargeReason: p.surchargeReason,
    refabricationReason: p.refabricationReason,
    refabricatedAt: p.refabricatedAt,
    refabricationHistory: p.refabricationHistory?.map((r) => ({
      reason: r.reason,
      date: r.date,
      previousProviderId: r.previousProviderId,
      previousProviderName: r.previousProviderName,
      newProviderId: r.newProviderId,
      newProviderName: r.newProviderName,
    })),
    commissionLineSource: p.commissionLineSource,
    catalogProductId:
      p.catalogProductId?.trim() ||
      getCatalogProductIdFromLineId(p.id) ||
      undefined,
  }));
}

function findCatalogByStableId(
  catalogId: string,
  allProducts: Product[],
): Product | undefined {
  const id = catalogId.trim();
  if (!id) return undefined;
  return allProducts.find(
    (p) => p.backendId === id || p.id.toString() === id,
  );
}

/** Resuelve producto de catálogo para desglose (línea ORD/RES, incl. post-conversión). */
export function resolveCatalogProductForOrderLine(
  line: OrderProduct,
  allProducts: Product[],
  originalProducts?: OrderProduct[],
): Product | undefined {
  const fromLineId = resolveCatalogProductFromOrderProductId(
    line.id,
    allProducts,
  );
  if (fromLineId) return fromLineId;

  const stableId =
    line.catalogProductId?.trim() || getCatalogProductIdFromLineId(line.id);
  const fromStable = stableId
    ? findCatalogByStableId(stableId, allProducts)
    : undefined;
  if (fromStable) return fromStable;

  const compositeMatch = line.id?.match(/^(\d+)-/);
  if (compositeMatch) {
    const n = Number.parseInt(compositeMatch[1], 10);
    const byNum = allProducts.find((p) => p.id === n);
    if (byNum) return byNum;
  }

  if (originalProducts?.length) {
    const orig = originalProducts.find(
      (o) =>
        o.id === line.id ||
        (o.name === line.name && o.category === line.category),
    );
    if (orig && orig.id !== line.id) {
      return resolveCatalogProductForOrderLine(orig, allProducts);
    }
  }

  return undefined;
}
