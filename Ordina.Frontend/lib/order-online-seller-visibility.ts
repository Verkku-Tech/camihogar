/**
 * Visibilidad de pedidos para el rol "Online Seller":
 * - Pedidos cuyo vendor es un usuario con rol Online Seller, o
 * - Pedidos con referidor (presupuesto / venta referida), aunque el vendor sea tienda.
 */

export type OrderLikeForOnlineVisibility = {
  vendorId: string
  referrerId?: string | null
}

export function buildOnlineSellerVendorIdSet(
  users: ReadonlyArray<{ id: string; role?: string | null }>,
): Set<string> {
  const set = new Set<string>()
  for (const u of users) {
    if (u.id && u.role === "Online Seller") set.add(u.id)
  }
  return set
}

export function isOrderVisibleToOnlineSeller(
  order: OrderLikeForOnlineVisibility,
  onlineSellerVendorIds: Set<string>,
): boolean {
  const ref = order.referrerId?.trim()
  if (ref) return true
  if (onlineSellerVendorIds.has(order.vendorId)) return true
  return false
}
