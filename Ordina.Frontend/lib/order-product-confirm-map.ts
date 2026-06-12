import type { OrderProductDto } from "@/lib/api-client";
import type { OrderProduct, Product } from "@/lib/storage";

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
    catalogProductId: p.catalogProductId,
  }));
}

/**
 * Resuelve el producto de catálogo asociado a una línea de pedido.
 *
 * El "precio base" del desglose vive en el catálogo, no en la línea del pedido.
 * Para mostrarlo basta con encontrar el producto en `allProducts`.
 *
 * Estrategias en orden de confianza:
 *   1. `catalogProductId` (pedidos nuevos): match exacto al catálogo.
 *   2. `name` + `category` (pedidos viejos): siempre presentes en la línea.
 *
 * NUNCA usar `line.id` para resolver el catálogo: ese campo es ObjectId de Mongo.
 */
export function resolveCatalogProductForOrderLine(
  line: OrderProduct,
  allProducts: Product[],
): Product | undefined {
  const id = line.catalogProductId?.trim();
  if (id) {
    const byId = allProducts.find(
      (p) => p.backendId === id || p.id.toString() === id,
    );
    if (byId) return byId;
  }

  const name = line.name?.trim();
  if (!name) return undefined;
  const category = line.category?.trim();
  return allProducts.find(
    (p) =>
      p.name?.trim() === name &&
      (!category || p.category?.trim() === category),
  );
}
