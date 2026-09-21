// ponytail: offline fallback adapter for IndexedDB reads & outbox writes
import { getAll, get, put } from './indexeddb'
import { syncManager } from './sync-manager'

export class LocalApi {
  /** Guarda entidades en IndexedDB de forma no bloqueante (fire-and-forget). */
  async cacheEntities<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) return
    try {
      for (const item of items) {
        if (item && item.id) {
          await put(storeName, item).catch(() => {})
        }
      }
    } catch {
      // Background cache failure should not break app flow
    }
  }

  /** Lectura paginada y con búsqueda de clientes desde IndexedDB */
  async getClientsPaged(page: number = 1, pageSize: number = 50, search?: string) {
    const all = await getAll<any>('clients')
    let filtered = all

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = all.filter((c) => {
        const name = (c.nombreRazonSocial || '').toLowerCase()
        const rut = (c.rutId || '').toLowerCase()
        const alias = (c.apodo || '').toLowerCase()
        const phone = (c.telefono || '').toLowerCase()
        const email = (c.email || '').toLowerCase()
        return name.includes(q) || rut.includes(q) || alias.includes(q) || phone.includes(q) || email.includes(q)
      })
    }

    const total = filtered.length
    const startIndex = (page - 1) * pageSize
    const items = filtered.slice(startIndex, startIndex + pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  }

  async getClient(id: string) {
    return (await get<any>('clients', id)) || null
  }

  async getProducts() {
    return await getAll<any>('products')
  }

  async getCategories() {
    return await getAll<any>('categories')
  }

  async getUsers() {
    return await getAll<any>('users')
  }

  async getVendors() {
    const vendors = await getAll<any>('vendors')
    if (vendors.length > 0) return vendors
    // Fallback: filter users with vendor/sales role
    const users = await getAll<any>('users')
    return users.filter((u) => u.role?.toLowerCase()?.includes('vendedor') || u.role?.toLowerCase()?.includes('ventas'))
  }

  async getStores() {
    return await getAll<any>('stores')
  }

  async getOrders() {
    return await getAll<any>('orders')
  }

  /** Creación offline de cliente con ID provisional y encolado en outbox */
  async createClient(dto: any) {
    const localId = `cli_off_${crypto.randomUUID().slice(0, 8)}`
    const client = {
      ...dto,
      id: localId,
      createdAt: new Date().toISOString(),
      isOfflineCreated: true
    }

    await put('clients', client)
    await syncManager.enqueueMutation({
      endpoint: '/api/clients',
      method: 'POST',
      payload: dto
    })

    return client
  }

  /** Edición offline de cliente y encolado en outbox */
  async updateClient(id: string, dto: any) {
    const existing = (await get<any>('clients', id)) || {}
    const updated = {
      ...existing,
      ...dto,
      id,
      updatedAt: new Date().toISOString(),
      isOfflineUpdated: true
    }

    await put('clients', updated)
    await syncManager.enqueueMutation({
      endpoint: `/api/clients/${id}`,
      method: 'PUT',
      payload: dto
    })

    return updated
  }

  /** Creación offline de pedido con numeración ORD-OFF- y encolado en outbox */
  async createOrder(dto: any) {
    const localId = `ord_off_${crypto.randomUUID().slice(0, 8)}`
    const orderNumber = `ORD-OFF-${Date.now().toString().slice(-6)}`
    const order = {
      ...dto,
      id: localId,
      orderNumber,
      status: dto.status || 'Registrado',
      createdAt: new Date().toISOString(),
      isOfflineCreated: true
    }

    await put('orders', order)
    await syncManager.enqueueMutation({
      endpoint: '/api/orders',
      method: 'POST',
      payload: dto
    })

    return order
  }
}

export const localApi = new LocalApi()
