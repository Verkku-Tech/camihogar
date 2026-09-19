import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface OutboxMutation {
  id?: number
  mutationId: string
  endpoint: string
  method: string
  payload?: any
  headers?: Record<string, string>
  status: 'pending' | 'processing' | 'conflict' | 'failed'
  errorMessage?: string
  createdAt: number
  retryCount: number
}

export interface TelemetryLog {
  id?: number
  level: 'info' | 'warn' | 'error' | 'critical'
  message: string
  stack?: string
  url?: string
  userAgent?: string
  mutationId?: string
  timestamp: string
  extra?: Record<string, any>
}

export interface CacheEntry {
  key: string
  value: any
}

interface OrdinaDBSchema extends DBSchema {
  tanstack_cache: {
    key: string
    value: CacheEntry
  }
  outbox_mutations: {
    key: number
    value: OutboxMutation
    indexes: {
      'by-status': string
      'by-created': number
      'by-mutation-id': string
    }
  }
  telemetry_buffer: {
    key: number
    value: TelemetryLog
    indexes: {
      'by-timestamp': string
    }
  }
}

const DB_NAME = 'ordina_db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OrdinaDBSchema>> | null = null

export function getDb(): Promise<IDBPDatabase<OrdinaDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OrdinaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. TanStack Query offline cache store
        if (!db.objectStoreNames.contains('tanstack_cache')) {
          db.createObjectStore('tanstack_cache', { keyPath: 'key' })
        }

        // 2. Outbox mutations for reliable offline writes
        if (!db.objectStoreNames.contains('outbox_mutations')) {
          const outboxStore = db.createObjectStore('outbox_mutations', {
            keyPath: 'id',
            autoIncrement: true
          })
          outboxStore.createIndex('by-status', 'status')
          outboxStore.createIndex('by-created', 'createdAt')
          outboxStore.createIndex('by-mutation-id', 'mutationId', { unique: true })
        }

        // 3. Telemetry buffer for unhandled errors
        if (!db.objectStoreNames.contains('telemetry_buffer')) {
          const telemetryStore = db.createObjectStore('telemetry_buffer', {
            keyPath: 'id',
            autoIncrement: true
          })
          telemetryStore.createIndex('by-timestamp', 'timestamp')
        }
      }
    })
  }
  return dbPromise
}
