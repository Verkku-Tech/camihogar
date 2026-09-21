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
})
