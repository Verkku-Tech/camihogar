import { getDb, OutboxMutation } from './db'
import { apiFetch, ApiError } from './api-client'
import { QueryClient } from '@tanstack/react-query'

export class SyncManager {
  private isSyncing = false
  private queryClient: QueryClient | null = null
  private listeners: Array<() => void> = []

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.drainOutbox())
    }
  }

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
  }): Promise<string> {
    const mutationId = crypto.randomUUID()
    const outboxItem: OutboxMutation = {
      mutationId,
      endpoint: mutation.endpoint,
      method: mutation.method.toUpperCase(),
      payload: mutation.payload,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0
    }

    const db = await getDb()
    await db.add('outbox_mutations', outboxItem)
    this.notify()

    if (navigator.onLine) {
      this.drainOutbox().catch(() => {})
    }

    return mutationId
  }

  async drainOutbox(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return
    this.isSyncing = true

    try {
      const db = await getDb()
      const pendingItems = await db.getAllFromIndex('outbox_mutations', 'by-status', 'pending')

      // Sort FIFO by createdAt
      pendingItems.sort((a, b) => a.createdAt - b.createdAt)

      for (const item of pendingItems) {
        if (!item.id) continue

        // Mark as processing
        item.status = 'processing'
        await db.put('outbox_mutations', item)
        this.notify()

        try {
          await apiFetch(item.endpoint, {
            method: item.method,
            body: item.payload ? JSON.stringify(item.payload) : undefined,
            mutationId: item.mutationId
          })

          // Success: delete from outbox
          await db.delete('outbox_mutations', item.id)
          this.notify()

          // Invalidate relevant caches
          if (this.queryClient) {
            this.queryClient.invalidateQueries()
          }
        } catch (err: any) {
          if (err instanceof ApiError && err.statusCode === 409) {
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
          } else if (err instanceof ApiError && err.statusCode >= 400 && err.statusCode < 500) {
            // Unrecoverable client error
            item.status = 'failed'
            item.errorMessage = err.message
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
}

export const syncManager = new SyncManager()
