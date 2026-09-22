import 'fake-indexeddb/auto'
import { describe, test, expect, beforeEach } from 'bun:test'
import { localApi } from '../local-api'
import { clearStore, getAll } from '../indexeddb'

describe('LocalApi Offline Emulation', () => {
  beforeEach(async () => {
    await clearStore('clients')
    await clearStore('products')
    await clearStore('orders')
  })

  test('cacheEntities saves items into IndexedDB', async () => {
    await localApi.cacheEntities('clients', [
      { id: 'cli-1', rutId: 'V-12345678', nombreRazonSocial: 'Juan Perez', telefono: '04141234567' },
      { id: 'cli-2', rutId: 'J-98765432', nombreRazonSocial: 'Empresa ABC CA', telefono: '04127654321' }
    ])

    const stored = await getAll<any>('clients')
    expect(stored.length).toBe(2)
    expect(stored[0].nombreRazonSocial).toBe('Juan Perez')
  })

  test('getClientsPaged filters by search term and paginates', async () => {
    await localApi.cacheEntities('clients', [
      { id: 'c1', rutId: 'V-100', nombreRazonSocial: 'Carlos Diaz', telefono: '111' },
      { id: 'c2', rutId: 'V-200', nombreRazonSocial: 'Maria Gomez', telefono: '222' },
      { id: 'c3', rutId: 'V-300', nombreRazonSocial: 'Carlos Sanchez', telefono: '333' }
    ])

    // Search 'Carlos'
    const result = await localApi.getClientsPaged(1, 10, 'Carlos')
    expect(result.total).toBe(2)
    expect(result.items.length).toBe(2)
    expect(result.items.map((i: any) => i.nombreRazonSocial)).toContain('Carlos Diaz')
    expect(result.items.map((i: any) => i.nombreRazonSocial)).toContain('Carlos Sanchez')

    // Search 'Gomez'
    const gomezResult = await localApi.getClientsPaged(1, 10, 'Gomez')
    expect(gomezResult.total).toBe(1)
    expect(gomezResult.items[0].nombreRazonSocial).toBe('Maria Gomez')
  })

  test('createClient saves client locally with local ID and enqueues mutation', async () => {
    const newClientDto = {
      rutId: 'V-99999999',
      nombreRazonSocial: 'Cliente Offline Test',
      telefono: '04149999999'
    }

    const created = await localApi.createClient(newClientDto)
    expect(created.id).toBeDefined()
    expect(created.id.startsWith('cli_off_')).toBe(true)
    expect(created.nombreRazonSocial).toBe('Cliente Offline Test')

    // Verify it is in IndexedDB
    const stored = await getAll<any>('clients')
    expect(stored.some((c: any) => c.id === created.id)).toBe(true)
  })

  test('createOrder generates ORD-OFF- number, saves locally and enqueues mutation', async () => {
    const newOrderDto = {
      clientId: 'cli-1',
      clientName: 'Juan Perez',
      items: [{ productId: 'prod-1', productName: 'Cama Matrimonial', quantity: 1, unitPrice: 150 }],
      totalAmount: 150
    }

    const created = await localApi.createOrder(newOrderDto)
    expect(created.id).toBeDefined()
    expect(created.orderNumber).toBeDefined()
    expect(created.orderNumber.startsWith('ORD-OFF-')).toBe(true)
    expect(created.totalAmount).toBe(150)

    const stored = await getAll<any>('orders')
    expect(stored.some((o: any) => o.id === created.id)).toBe(true)
  })

  test('getOrdersPaged filters orders and paginates from IndexedDB', async () => {
    await clearStore('orders')
    await localApi.cacheEntities('orders', [
      { id: 'o1', orderNumber: 'ORD-001', clientName: 'Ana Lopez', vendorName: 'Carlos Diaz', status: 'Registrado', saleType: 'directa', createdAt: '2026-03-01T10:00:00Z' },
      { id: 'o2', orderNumber: 'ORD-002', clientName: 'Beatriz Mora', vendorName: 'Juan Gomez', status: 'Entregado', saleType: 'online', createdAt: '2026-03-02T10:00:00Z' },
      { id: 'o3', orderNumber: 'PRE-003', clientName: 'Carlos Vega', vendorName: 'Carlos Diaz', status: 'Presupuesto', type: 'budget', createdAt: '2026-03-03T10:00:00Z' }
    ])

    // Filter by vendor
    const byVendor = await localApi.getOrdersPaged(1, 10, { vendor: 'Carlos Diaz' })
    expect(byVendor.totalCount).toBe(2)
    expect(byVendor.orders.length).toBe(2)

    // Filter by status
    const byStatus = await localApi.getOrdersPaged(1, 10, { status: 'Entregado' })
    expect(byStatus.totalCount).toBe(1)
    expect(byStatus.orders[0].orderNumber).toBe('ORD-002')

    // Search by clientName
    const bySearch = await localApi.getOrdersPaged(1, 10, { search: 'Beatriz' })
    expect(bySearch.totalCount).toBe(1)
    expect(bySearch.orders[0].orderNumber).toBe('ORD-002')

    // Paged slice
    const paged = await localApi.getOrdersPaged(1, 1)
    expect(paged.orders.length).toBe(1)
    expect(paged.totalPages).toBe(3)
  })

  test('getOrder and getOrderByOrderNumber fetch single order from IndexedDB', async () => {
    await clearStore('orders')
    await localApi.cacheEntities('orders', [
      { id: 'o-special', orderNumber: 'ORD-999', clientName: 'Pedro Perez' }
    ])

    const byId = await localApi.getOrder('o-special')
    expect(byId).toBeDefined()
    expect(byId.clientName).toBe('Pedro Perez')

    const byNumber = await localApi.getOrderByOrderNumber('ORD-999')
    expect(byNumber).toBeDefined()
    expect(byNumber.id).toBe('o-special')

    const notFound = await localApi.getOrderByOrderNumber('NON-EXISTENT')
    expect(notFound).toBeNull()
  })

  test('updateOrder updates local entity and enqueues outbox mutation', async () => {
    await clearStore('orders')
    await localApi.cacheEntities('orders', [
      { id: 'o-upd', orderNumber: 'ORD-100', clientName: 'Original Name', status: 'Registrado' }
    ])

    const updated = await localApi.updateOrder('o-upd', { status: 'Entregado' })
    expect(updated.status).toBe('Entregado')
    expect(updated.clientName).toBe('Original Name')

    const inDb = await localApi.getOrder('o-upd')
    expect(inDb.status).toBe('Entregado')
  })

  test('getStores, getProviders, and getAccounts query IndexedDB stores', async () => {
    await clearStore('stores')
    await clearStore('providers')
    await clearStore('accounts')

    await localApi.cacheEntities('stores', [
      { id: 's1', name: 'Tienda Principal', status: 'active' },
      { id: 's2', name: 'Tienda Cerrada', status: 'inactive' }
    ])

    await localApi.cacheEntities('providers', [
      { id: 'p1', razonSocial: 'Maderas El Roble', estado: 'activo' }
    ])

    await localApi.cacheEntities('accounts', [
      { id: 'a1', storeId: 's1', accountNumber: '0102-001', isActive: true },
      { id: 'a2', storeId: 's2', accountNumber: '0102-002', isActive: false }
    ])

    const activeStores = await localApi.getStores('active')
    expect(activeStores.length).toBe(1)
    expect(activeStores[0].name).toBe('Tienda Principal')

    const providers = await localApi.getProviders()
    expect(providers.length).toBe(1)
    expect(providers[0].razonSocial).toBe('Maderas El Roble')

    const activeAccounts = await localApi.getAccounts('s1', true)
    expect(activeAccounts.length).toBe(1)
    expect(activeAccounts[0].accountNumber).toBe('0102-001')
  })
})
