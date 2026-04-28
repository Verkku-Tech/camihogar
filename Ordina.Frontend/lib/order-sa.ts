import { PURCHASE_TYPES } from "@/components/orders/constants"
import {
  getOrderPendingTotal,
  PAYMENT_BALANCE_EPSILON_BS,
  type PartialMixedPaymentsSource,
} from "@/lib/order-payments"

const WAREHOUSE_STATUSES = new Set(["En Almacén", "Almacén"])

/** Plazo de pago (días) para Sistema de Apartado: el día 91 desde el pedido es el primer vencido. */
export const SA_LAYAWAY_DAYS = 90

export { getOrderPendingTotal }

/** Misma regla de saldo que el detalle del pedido; nombre alineado con fabricación/SA. */
export const getSistemaApartadoPendingTotal = getOrderPendingTotal

export function getDaysSinceOrder(createdAt: string, from: Date = new Date()): number {
  return Math.floor(
    (from.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )
}

/** Días de mora después de SA_LAYAWAY_DAYS; 0 mientras aún aplica el plazo. */
export function getLayawayDaysPastWindow(createdAt: string, from: Date = new Date()): number {
  return Math.max(0, getDaysSinceOrder(createdAt, from) - SA_LAYAWAY_DAYS)
}

type OrderWithSaleAndTotal = { type?: string; saleType?: string; total: number } & PartialMixedPaymentsSource

/**
 * Un SA pasa a tratarse como el resto (fabricación, etc.) cuando el saldo está liquidado
 * (misma tolerancia que en formularios de pedido).
 */
export function isSistemaApartadoReadyForNormalFlow(order: OrderWithSaleAndTotal): boolean {
  if (!isSistemaApartado(order)) return true
  return getOrderPendingTotal(order) <= PAYMENT_BALANCE_EPSILON_BS
}

export function isSistemaApartado(order: {
  type?: string
  saleType?: string
}): boolean {
  return order.type === "order" && order.saleType === "sistema_apartado"
}

/** Resaltar fila en listados cuando un SA está en almacén (lista densa). */
export function isSaWarehouseHighlight(order: {
  type?: string
  saleType?: string
  status: string
}): boolean {
  return isSistemaApartado(order) && WAREHOUSE_STATUSES.has(order.status.trim())
}

export function purchaseTypeLabel(saleType?: string): string | undefined {
  if (!saleType) return undefined
  return PURCHASE_TYPES.find((t) => t.value === saleType)?.label
}
