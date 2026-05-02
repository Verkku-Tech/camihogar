/**
 * Visibilidad de pedidos para el rol "Online Seller":
 * - Pedidos donde el usuario es el vendedor (vendorId), o
 * - Pedidos donde el usuario es el referidor (p. ej. presupuesto referido montado en tienda).
 */

export type OrderLikeForOnlineVisibility = {
  vendorId: string
  referrerId?: string | null
}

function normId(value: string): string {
  return value.trim()
}

/**
 * @param currentUserId ID del usuario autenticado (Online Seller).
 */
export function isOrderVisibleToOnlineSeller(
  order: OrderLikeForOnlineVisibility,
  currentUserId: string,
): boolean {
  const uid = normId(currentUserId)
  if (!uid) return false
  if (normId(order.vendorId) === uid) return true
  const ref = order.referrerId?.trim()
  if (ref && ref === uid) return true
  return false
}
