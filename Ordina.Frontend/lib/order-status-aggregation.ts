import type { OrderProductDto } from "@/lib/api-client";
import { isReservationOrder } from "@/lib/order-document-types";

function isFabricationLocation(locationStatus?: string | null): boolean {
  return locationStatus?.trim().toUpperCase() === "FABRICACION";
}

function normalizeManufacturingStatus(status?: string | null): string {
  if (!status?.trim()) return "debe_fabricar";

  const normalized = status.trim().toLowerCase();
  if (normalized === "fabricado") return "almacen_no_fabricado";

  if (
    normalized === "debe_fabricar" ||
    normalized === "por_fabricar" ||
    normalized === "fabricando" ||
    normalized === "almacen_no_fabricado"
  ) {
    return normalized;
  }

  return "debe_fabricar";
}

function selectProductsForStatusAggregation(
  products: OrderProductDto[],
): OrderProductDto[] {
  if (products.length <= 1) return products;

  const fabrication = products.filter((p) =>
    isFabricationLocation(p.locationStatus),
  );
  const nonFabrication = products.filter(
    (p) => !isFabricationLocation(p.locationStatus),
  );

  if (fabrication.length > 0 && nonFabrication.length > 0) return fabrication;

  return products;
}

/** Estado agregado del pedido (espejo de OrderStatusAggregation en backend). */
export function calculateOrderStatusFromProducts(
  products: OrderProductDto[] | undefined | null,
): string {
  const productList = products ?? [];
  if (productList.length === 0) return "Generado";

  const statusProducts = selectProductsForStatusAggregation(productList);

  let hasGenerado = false;
  let hasValidado = false;
  let hasFabricandose = false;
  let hasReporteFabricacion = false;
  let hasEnAlmacen = false;
  let hasEnRuta = false;
  let allCompletado = true;

  for (const product of statusProducts) {
    const status = product.logisticStatus ?? "Generado";
    if (status !== "Completado") allCompletado = false;

    const inFabricacion = isFabricationLocation(product.locationStatus);
    const manufacturing = normalizeManufacturingStatus(product.manufacturingStatus);
    const inManufacturingQueue = inFabricacion && manufacturing === "por_fabricar";
    const inManufacturingActive = inFabricacion && manufacturing === "fabricando";

    if (status === "Generado" || status === "Pendiente") {
      hasGenerado = true;
    } else if (status === "Fabricándose" || inManufacturingActive) {
      hasFabricandose = true;
    } else if (inManufacturingQueue) {
      hasReporteFabricacion = true;
    } else if (status === "Validado") {
      hasValidado = true;
    } else if (status === "En Almacén") {
      hasEnAlmacen = true;
    } else if (status === "En Ruta") {
      hasEnRuta = true;
    }
  }

  if (allCompletado) return "Completado";
  if (hasGenerado) return "Generado";
  if (hasFabricandose) return "Fabricándose";
  if (hasReporteFabricacion) return "Reporte de fabricación";
  if (hasValidado) return "Validado";
  if (hasEnAlmacen) return "En Almacén";
  if (hasEnRuta) return "En Ruta";

  return "Generado";
}

type OrderWithProducts = {
  type?: string;
  status: string;
  orderNumber?: string;
  products?: OrderProductDto[];
};

/**
 * Estado a mostrar/filtrar: recalcula en pedidos mixtos; respeta presupuestos y reservas.
 */
export function resolveDisplayOrderStatus(order: OrderWithProducts): string {
  const type = order.type?.trim().toLowerCase();
  if (type === "budget" || isReservationOrder(order)) return order.status;

  const products = order.products;
  if (!products?.length) return order.status;

  return calculateOrderStatusFromProducts(products);
}
