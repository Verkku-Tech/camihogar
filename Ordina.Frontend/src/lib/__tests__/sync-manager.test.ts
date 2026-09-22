import 'fake-indexeddb/auto'
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { setAuthToken, getAuthToken } from '../api-client'
import { syncManager } from '../sync-manager'

describe('Auth and API Client Token State', () => {
  beforeEach(() => {
    setAuthToken(null)
  })

  test('setAuthToken stores token in memory', () => {
    expect(getAuthToken()).toBeNull()
    setAuthToken('test-jwt-token-xyz')
    expect(getAuthToken()).toBe('test-jwt-token-xyz')
  })

  test('setAuthToken clear removes token from memory', () => {
    setAuthToken('test-jwt-token-xyz')
    setAuthToken(null)
    expect(getAuthToken()).toBeNull()
  })
})

describe('SyncManager Outbox Enqueue', () => {
  test('enqueueMutation returns a valid UUIDv4 mutationId', async () => {
    const mutationId = await syncManager.enqueueMutation({
      endpoint: 'orders',
      method: 'POST',
      payload: { clientName: 'Test' }
    })

    expect(mutationId).toBeDefined()
    expect(typeof mutationId).toBe('string')
    // UUID regex check
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutationId)).toBe(true)
  })

  test('addToQueue formats plural REST endpoints with entityId correctly', async () => {
    let capturedEndpoint = ''
    let capturedMethod = ''
    const originalEnqueue = syncManager.enqueueMutation.bind(syncManager)
    syncManager.enqueueMutation = async (mutation: any) => {
      capturedEndpoint = mutation.endpoint
      capturedMethod = mutation.method
      return 'mock-uuid'
    }

    try {
      await syncManager.addToQueue({
        type: 'update',
        entity: 'user',
        entityId: 'user-789',
        data: { name: 'New Name' }
      })

      expect(capturedEndpoint).toBe('/api/users/user-789')
      expect(capturedMethod).toBe('PUT')
    } finally {
      syncManager.enqueueMutation = originalEnqueue
    }
  })

  test('drainOutbox reconciles localEntityId with server response entity in IndexedDB', async () => {
    const { put, get, clearStore } = await import('../indexeddb')
    await clearStore('orders')

    // Local provisional order in IndexedDB
    await put('orders', {
      id: 'ord_off_123',
      orderNumber: 'ORD-OFF-123',
      clientName: 'Offline Client'
    })

    // Mock global fetch to return server order
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: any, init: any) => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          id: 'ord_server_789',
          orderNumber: 'ORD-2026-0001',
          clientName: 'Offline Client'
        })
      } as any
    }) as any

    const { connectivityManager } = await import('../connectivity')
    // Simulate unreachable so it enqueues to outbox without firing immediate background drain
    connectivityManager.reportFailure(new TypeError('Failed to fetch'))

    try {
      // Enqueue mutation with localEntityId and storeName while offline
      await syncManager.enqueueMutation({
        endpoint: '/api/orders',
        method: 'POST',
        payload: { clientName: 'Offline Client' },
        localEntityId: 'ord_off_123',
        storeName: 'orders'
      })

      // Now server is reachable and we drain the outbox
      connectivityManager.reportSuccess()
      await syncManager.drainOutbox()

      // Provisional order should be removed
      const oldOrder = await get('orders', 'ord_off_123')
      expect(oldOrder).toBeUndefined()

      // Server order should be stored
      const newOrder = await get<any>('orders', 'ord_server_789')
      expect(newOrder).toBeDefined()
      expect(newOrder.orderNumber).toBe('ORD-2026-0001')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

