import 'fake-indexeddb/auto'
import { describe, test, expect, beforeEach } from 'bun:test'
import { apiClient, setAuthToken, getAuthToken, requestTokenRefresh } from '../api-client'
import { connectivityManager } from '../connectivity'
import { localApi } from '../local-api'
import { clearStore } from '../indexeddb'

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis as any
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size }
  } as Storage
}

describe('ApiClient Offline Grace Period and LocalApi routing', () => {
  beforeEach(async () => {
    connectivityManager.resetForTesting()
    setAuthToken(null)
    globalThis.localStorage.clear()
    await clearStore('clients')
    await clearStore('products')
  })

  test('requestTokenRefresh preserves token within 1-hour grace period on network failure', async () => {
    setAuthToken('existing-jwt-token')
    const recentTime = Date.now() - 10 * 60 * 1000 // 10 minutes ago
    localStorage.setItem('auth_last_active_at', recentTime.toString())

    // Simulated offline / network failure is caught and falls back to grace period
    const token = await requestTokenRefresh()
    expect(token).toBe('existing-jwt-token')
    expect(getAuthToken()).toBe('existing-jwt-token')
  })

  test('requestTokenRefresh clears token if grace period (> 1 hour) has expired', async () => {
    setAuthToken('expired-jwt-token')
    const oldTime = Date.now() - 70 * 60 * 1000 // 70 minutes ago
    localStorage.setItem('auth_last_active_at', oldTime.toString())

    let expiredFired = false
    const listener = () => { expiredFired = true }
    window.addEventListener('auth:expired', listener)

    const token = await requestTokenRefresh()
    expect(token).toBeNull()
    expect(getAuthToken()).toBeNull()
    expect(expiredFired).toBe(true)

    window.removeEventListener('auth:expired', listener)
  })

  test('getClientsPaged falls back to localApi when server is unreachable', async () => {
    await localApi.cacheEntities('clients', [
      { id: 'c1', rutId: 'V-1111', nombreRazonSocial: 'Mueblería Central', telefono: '12345' }
    ])

    // Simulate unreachable server
    connectivityManager.reportFailure(new TypeError('Failed to fetch'))
    expect(connectivityManager.isServerUnreachable()).toBe(true)

    const result = await apiClient.getClientsPaged(1, 20)
    expect(result.items.length).toBe(1)
    expect(result.items[0].nombreRazonSocial).toBe('Mueblería Central')
  })

  test('createClient routes to localApi and creates local ID when server is unreachable', async () => {
    connectivityManager.reportFailure(new TypeError('Failed to fetch'))

    const newClient = await apiClient.createClient({
      rutId: 'V-2222',
      nombreRazonSocial: 'Cliente Local Offline',
      telefono: '54321'
    } as any)

    expect(newClient.id.startsWith('cli_off_')).toBe(true)
    expect(newClient.nombreRazonSocial).toBe('Cliente Local Offline')
  })

  test('getStores, getAccounts, and getProviders fall back to localApi when server is unreachable', async () => {
    await clearStore('stores')
    await clearStore('accounts')
    await clearStore('providers')

    await localApi.cacheEntities('stores', [
      { id: 'st-1', name: 'Sucursal Norte', code: 'NORTE', status: 'active' }
    ])
    await localApi.cacheEntities('accounts', [
      { id: 'acc-1', storeId: 'st-1', accountNumber: '0102-1111', isActive: true }
    ])
    await localApi.cacheEntities('providers', [
      { id: 'prv-1', razonSocial: 'Proveedor ABC', estado: 'activo' }
    ])

    connectivityManager.reportFailure(new TypeError('Network down'))
    expect(connectivityManager.isServerUnreachable()).toBe(true)

    const stores = await apiClient.getStores('active')
    expect(stores.length).toBe(1)
    expect(stores[0].name).toBe('Sucursal Norte')

    const accounts = await apiClient.getAccounts('st-1', true)
    expect(accounts.length).toBe(1)
    expect(accounts[0].accountNumber).toBe('0102-1111')

    const providers = await apiClient.getProviders()
    expect(providers.length).toBe(1)
    expect(providers[0].razonSocial).toBe('Proveedor ABC')
  })

  test('getOrdersPaged, getOrderById, and updateOrder fall back to localApi when server is unreachable', async () => {
    await clearStore('orders')
    await localApi.cacheEntities('orders', [
      { id: 'ord-test-1', orderNumber: 'ORD-777', clientName: 'Valeria Ramos', vendorName: 'Carlos Diaz', status: 'Registrado' }
    ])

    connectivityManager.reportFailure(new TypeError('Server down'))
    expect(connectivityManager.isServerUnreachable()).toBe(true)

    // getOrdersPaged fallback
    const paged = await apiClient.getOrdersPaged(1, 10)
    expect(paged.orders.length).toBe(1)
    expect(paged.orders[0].orderNumber).toBe('ORD-777')

    // getOrderById fallback
    const single = await apiClient.getOrderById('ord-test-1')
    expect(single).toBeDefined()
    expect(single.orderNumber).toBe('ORD-777')

    // getOrderByOrderNumber fallback
    const byNumber = await apiClient.getOrderByOrderNumber('ORD-777')
    expect(byNumber).toBeDefined()
    expect(byNumber.id).toBe('ord-test-1')

    // updateOrder fallback
    const updated = await apiClient.updateOrder('ord-test-1', { status: 'Entregado' } as any)
    expect(updated.status).toBe('Entregado')
  })
})
