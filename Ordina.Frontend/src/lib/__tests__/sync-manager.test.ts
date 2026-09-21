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
})

