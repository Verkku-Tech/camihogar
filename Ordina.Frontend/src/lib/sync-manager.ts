import { getDb, OutboxMutation } from './db'
import { apiFetch } from './api-client'
import { connectivityManager } from './connectivity'
import { QueryClient } from '@tanstack/react-query'
import { remove, put } from './indexeddb'

export class SyncManager {
  private isSyncing = false
  private queryClient: QueryClient | null = null
  private listeners: Array<() => void> = []

  setQueryClient(client: QueryClient) {
    this.queryClient = client
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  async getPendingCount(): Promise<number> {
    try {
      const db = await getDb()
      const tx = db.transaction('outbox_mutations', 'readonly')
      const index = tx.store.index('by-status')
      return await index.count('pending')
    } catch {
      return 0
    }
  }

  async getConflictedCount(): Promise<number> {
    try {
      const db = await getDb()
      const tx = db.transaction('outbox_mutations', 'readonly')
      const index = tx.store.index('by-status')
      return await index.count('conflict')
    } catch {
      return 0
    }
  }

  async enqueueMutation(mutation: {
    endpoint: string
    method: string
    payload?: any
    localEntityId?: string
    storeName?: string
  }): Promise<string> {
    const mutationId = crypto.randomUUID()
    const outboxItem: OutboxMutation = {
      mutationId,
      endpoint: mutation.endpoint,
      method: mutation.method.toUpperCase(),
      payload: mutation.payload,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      localEntityId: mutation.localEntityId,
      storeName: mutation.storeName
    }

    const db = await getDb()
    await db.add('outbox_mutations', outboxItem)
    this.notify()

    if (!connectivityManager.isServerUnreachable()) {
      this.drainOutbox().catch(() => {})
    }

    return mutationId
  }

  async drainOutbox(): Promise<void> {
    if (this.isSyncing || connectivityManager.isServerUnreachable()) return
    this.isSyncing = true

    try {
      const db = await getDb()
      const pendingItems = await db.getAllFromIndex('outbox_mutations', 'by-status', 'pending')

      // Auto-heal legacy malformed endpoints (e.g. /api/user -> /api/users/{id})
      for (const item of pendingItems) {
        if (item.endpoint === '/api/user' || item.endpoint === '/api/user/') {
          const entityId = item.payload?.id || item.payload?.userId || item.payload?.entityId
          if (entityId) {
            item.endpoint = `/api/users/${entityId}`
            await db.put('outbox_mutations', item)
          } else {
            // Unresolvable legacy mutation without ID
            item.status = 'failed'
            item.errorMessage = 'Endpoint malformado /api/user sin ID de usuario.'
            await db.put('outbox_mutations', item)
          }
        } else if (item.endpoint.startsWith('/api/user/')) {
          item.endpoint = item.endpoint.replace('/api/user/', '/api/users/')
          await db.put('outbox_mutations', item)
        }
      }

      // Re-read pending items after auto-healing
      const activePending = await db.getAllFromIndex('outbox_mutations', 'by-status', 'pending')
      // Sort FIFO by createdAt
      activePending.sort((a, b) => a.createdAt - b.createdAt)

      for (const item of activePending) {
        if (!item.id) continue

        // Mark as processing
        item.status = 'processing'
        await db.put('outbox_mutations', item)
        this.notify()

        try {
          const res = await apiFetch<any>(item.endpoint, {
            method: item.method,
            body: item.payload ? JSON.stringify(item.payload) : undefined,
            mutationId: item.mutationId
          })

          // Success: delete from outbox
          await db.delete('outbox_mutations', item.id)

          // Reconcile provisional local entity if present
          if (item.localEntityId && item.storeName) {
            await remove(item.storeName, item.localEntityId).catch(() => {})
            if (res && res.id) {
              await put(item.storeName, res).catch(() => {})
            }
          }

          this.notify()

          // Invalidate relevant caches
          if (this.queryClient) {
            this.queryClient.invalidateQueries()
          }
        } catch (err: any) {
          const statusCode = err?.statusCode ?? err?.status
          if (statusCode === 409) {
            // Concurrency conflict
            item.status = 'conflict'
            item.errorMessage = err.message || 'Conflicto de concurrencia al sincronizar.'
            await db.put('outbox_mutations', item)
            this.notify()
            window.dispatchEvent(
              new CustomEvent('sync:conflict', {
                detail: { item, error: err.message }
              })
            )
            // Continue processing remaining independent mutations
          } else if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
            // Unrecoverable client error (400, 404, 422, etc.)
            console.warn(`Outbox mutation ${item.mutationId} (${item.endpoint}) failed with HTTP ${statusCode}: ${err.message}. Marking failed.`)
            item.status = 'failed'
            item.errorMessage = err.message || `Error del cliente (HTTP ${statusCode})`
            await db.put('outbox_mutations', item)
            this.notify()
          } else {
            // Network error: revert to pending and stop draining
            item.status = 'pending'
            item.retryCount += 1
            await db.put('outbox_mutations', item)
            this.notify()
            break
          }
        }
      }
    } finally {
      this.isSyncing = false
    }
  }

  // Backward compatibility methods for legacy UI components
  async addToQueue(op: any): Promise<void> {
    const entityPluralMap: Record<string, string> = {
      user: 'users',
      client: 'clients',
      product: 'products',
      category: 'categories',
      provider: 'providers',
      store: 'stores',
      account: 'accounts',
      order: 'orders'
    }
    const plural = entityPluralMap[op.entity] || (op.entity?.endsWith('s') ? op.entity : `${op.entity}s`)
    const method = op.type === 'create' ? 'POST' : op.type === 'update' ? 'PUT' : 'DELETE'
    const endpoint = op.type === 'create' || !op.entityId
      ? `/api/${plural}`
      : `/api/${plural}/${op.entityId}`

    await this.enqueueMutation({ endpoint, method, payload: op.data })
  }

  async getPendingOperations(): Promise<any[]> {
    return []
  }

  async syncPendingOperations(): Promise<void> {
    await this.drainOutbox()
  }

  async clearFailedMutations(): Promise<number> {
    const db = await getDb()
    const failedItems = await db.getAllFromIndex('outbox_mutations', 'by-status', 'failed')
    for (const item of failedItems) {
      if (item.id) await db.delete('outbox_mutations', item.id)
    }
    this.notify()
    return failedItems.length
  }
}

export const syncManager = new SyncManager()

