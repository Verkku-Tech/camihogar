import type { Client, Order } from "@/lib/storage"

/** Solo dígitos; alinea búsqueda con teléfonos y CI formateados. */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

function addClientSearchFields(parts: string[], client?: Client | null): void {
  if (!client) return
  if (client.nombreRazonSocial?.trim()) {
    parts.push(client.nombreRazonSocial.trim())
  }
  if (client.apodo?.trim()) {
    parts.push(client.apodo.trim())
  }
  if (client.email?.trim()) {
    parts.push(client.email.trim())
  }
  if (client.telefono) {
    parts.push(client.telefono)
    const d = digitsOnly(client.telefono)
    if (d) parts.push(d)
  }
  if (client.telefono2) {
    parts.push(client.telefono2)
    const d = digitsOnly(client.telefono2)
    if (d) parts.push(d)
  }
  if (client.rutId) {
    parts.push(client.rutId)
    const d = digitsOnly(client.rutId)
    if (d) parts.push(d)
  }
}

function joinSearchParts(parts: string[]): string {
  return parts.filter((p) => p && String(p).trim().length > 0).join(" ")
}

/**
 * Cadena buscable para el combobox del header (orden + cliente: nombre, apodo, email, teléfonos, CI y variantes numéricas).
 */
export function buildOrderSearchValue(
  order: Pick<Order, "orderNumber" | "clientName">,
  client?: Client | null,
): string {
  const parts: string[] = [order.orderNumber, order.clientName]
  addClientSearchFields(parts, client)
  return joinSearchParts(parts)
}

/**
 * Cadena buscable para filtrar filas por cliente en Pedidos (misma lógica de teléfono/CI que el buscador global).
 */
export function buildClientFilterHaystack(
  orderClientName: string,
  client?: Client | null,
): string {
  const parts: string[] = [orderClientName]
  addClientSearchFields(parts, client)
  return joinSearchParts(parts)
}
