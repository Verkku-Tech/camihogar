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

  async getStores(status?: string) {
    const all = await getAll<any>('stores')
    if (!status) return all
    const lower = status.toLowerCase()
    return all.filter((s) => (s.status || '').toLowerCase() === lower || (lower === 'active' && s.activo === true))
  }

  async getProviders() {
    return await getAll<any>('providers')
  }

  async getAccounts(storeId?: string, isActive?: boolean) {
    const all = await getAll<any>('accounts')
    return all.filter((a) => {
      if (storeId && a.storeId !== storeId) return false
      if (isActive !== undefined && (a.isActive ?? a.activo) !== isActive) return false
      return true
    })
  }

  async getOrders() {
    return await getAll<any>('orders')
  }

  async getOrder(id: string) {
    return (await get<any>('orders', id)) || null
  }

  async getOrderByOrderNumber(orderNumber: string) {
    if (!orderNumber) return null
    const all = await getAll<any>('orders')
    const lower = orderNumber.trim().toLowerCase()
    return all.find((o) => (o.orderNumber || '').trim().toLowerCase() === lower) || null
  }

  /** Lectura paginada y filtrada de pedidos desde IndexedDB */
  async getOrdersPaged(page: number = 1, pageSize: number = 50, filters?: any) {
    const all = await getAll<any>('orders')
    let filtered = all

    if (filters) {
      if (filters.search && typeof filters.search === 'string') {
        const q = filters.search.trim().toLowerCase()
        filtered = filtered.filter((o) => {
          const num = (o.orderNumber || '').toLowerCase()
          const cli = (o.clientName || o.cliente || '').toLowerCase()
          const ven = (o.vendorName || o.vendedor || '').toLowerCase()
          return num.includes(q) || cli.includes(q) || ven.includes(q)
        })
      }

      if (filters.clientSearch && typeof filters.clientSearch === 'string') {
        const q = filters.clientSearch.trim().toLowerCase()
        filtered = filtered.filter((o) => (o.clientName || o.cliente || '').toLowerCase().includes(q))
      }

      if (filters.vendor && filters.vendor !== 'all') {
        filtered = filtered.filter((o) => o.vendorName === filters.vendor || o.vendorId === filters.vendor)
      }

      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter((o) => (o.status || '').toLowerCase() === filters.status.toLowerCase())
      }

      if (filters.excludeStatuses) {
        const excluded = String(filters.excludeStatuses).split(',').map((s) => s.trim().toLowerCase())
        filtered = filtered.filter((o) => !excluded.includes((o.status || '').toLowerCase()))
      }

      if (filters.saleType && filters.saleType !== 'all') {
        filtered = filtered.filter((o) => o.saleType === filters.saleType)
      }

      if (filters.dateFrom) {
        filtered = filtered.filter((o) => (o.createdAt || '') >= filters.dateFrom)
      }

      if (filters.dateTo) {
        filtered = filtered.filter((o) => (o.createdAt || '') <= filters.dateTo)
      }

      if (filters.includeBudgets === false) {
        filtered = filtered.filter((o) => o.type !== 'budget' && o.status !== 'Presupuesto')
      }
    }

    const totalCount = filtered.length
    const totalPages = Math.ceil(totalCount / pageSize) || 1
    const startIndex = (page - 1) * pageSize
    const items = filtered.slice(startIndex, startIndex + pageSize)

    return {
      orders: items,
      items,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      serverTimestamp: new Date().toISOString()
    }
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
      payload: dto,
      localEntityId: localId,
      storeName: 'clients'
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
      payload: dto,
      localEntityId: localId,
      storeName: 'orders'
    })

    return order
  }

  /** Edición offline de pedido y encolado en outbox */
  async updateOrder(id: string, dto: any) {
    const existing = (await get<any>('orders', id)) || {}
    const updated = {
      ...existing,
      ...dto,
      id,
      updatedAt: new Date().toISOString(),
      isOfflineUpdated: true
    }

    await put('orders', updated)
    await syncManager.enqueueMutation({
      endpoint: `/api/orders/${id}`,
      method: 'PUT',
      payload: dto
    })

    return updated
  }
}

export const localApi = new LocalApi()
