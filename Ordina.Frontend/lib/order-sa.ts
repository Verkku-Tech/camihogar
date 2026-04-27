import { PURCHASE_TYPES } from "@/components/orders/constants"

const WAREHOUSE_STATUSES = new Set(["En Almacén", "Almacén"])

export function isSistemaApartado(order: {
  type: string
  saleType?: string
}): boolean {
  return order.type === "order" && order.saleType === "sistema_apartado"
}

/** Resaltar fila en listados cuando un SA está en almacén (lista densa). */
export function isSaWarehouseHighlight(order: {
  type: string
  saleType?: string
  status: string
}): boolean {
  return isSistemaApartado(order) && WAREHOUSE_STATUSES.has(order.status.trim())
}

export function purchaseTypeLabel(saleType?: string): string | undefined {
  if (!saleType) return undefined
  return PURCHASE_TYPES.find((t) => t.value === saleType)?.label
}
