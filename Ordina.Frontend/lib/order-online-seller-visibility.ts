/**
 * Visibilidad de pedidos para el rol "Online Seller" (equipo online, Opción A):
 * - Ver: documentos donde vendorId, referrerId o sourceReservationVendorId
 *   pertenece a cualquier usuario con rol Online Seller.
 * - Acciones (editar/eliminar/despachar): solo pedidos propios (vendorId o referrerId = usuario actual).
 */

export type OrderLikeForOnlineVisibility = {
  vendorId: string
  referrerId?: string | null
  sourceReservationVendorId?: string | null
}

function normId(value: string): string {
  return value.trim()
}

/** IDs de actores online en un pedido/reserva (vendor, referidor, vendedor de reserva origen). */
export function collectOnlineSellerActorIds(
  order: OrderLikeForOnlineVisibility,
): string[] {
  const ids: string[] = []
  const vendor = normId(order.vendorId ?? "")
  if (vendor) ids.push(vendor)
  const ref = order.referrerId?.trim()
  if (ref) ids.push(normId(ref))
  const source = order.sourceReservationVendorId?.trim()
  if (source) ids.push(normId(source))
  return ids
}

/**
 * Visible para cualquier Online Seller si algún actor del pedido es del equipo online.
 */
export function isOrderVisibleToOnlineSellerTeam(
  order: OrderLikeForOnlineVisibility,
  onlineSellerIds: ReadonlySet<string>,
): boolean {
  // El backend es la fuente de verdad; sin IDs locales no bloqueamos (p. ej. offline / cache vacío).
  if (onlineSellerIds.size === 0) return true
  return collectOnlineSellerActorIds(order).some((id) => onlineSellerIds.has(id))
}

/**
 * El pedido pertenece al usuario (puede editar/eliminar/despachar).
 */
export function isOrderOwnedByOnlineSeller(
  order: OrderLikeForOnlineVisibility,
  currentUserId: string,
): boolean {
  const uid = normId(currentUserId)
  if (!uid) return false
  if (normId(order.vendorId) === uid) return true
  const ref = order.referrerId?.trim()
  if (ref && normId(ref) === uid) return true
  return false
}

/** @deprecated Usar isOrderVisibleToOnlineSellerTeam o isOrderOwnedByOnlineSeller */
export function isOrderVisibleToOnlineSeller(
  order: OrderLikeForOnlineVisibility,
  currentUserId: string,
): boolean {
  return isOrderOwnedByOnlineSeller(order, currentUserId)
}

export function isOnlineSellerRole(role: string | undefined | null): boolean {
  if (!role?.trim()) return false
  const raw = role.trim()
  if (raw === "Online Seller") return true
  return raw.toLowerCase() === "vendedor online"
}
