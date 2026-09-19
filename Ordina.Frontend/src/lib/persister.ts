import { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { getDb } from './db'

const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE'

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        const db = await getDb()
        await db.put('tanstack_cache', {
          key: CACHE_KEY,
          value: client
        })
      } catch (err) {
        console.warn('Failed to persist TanStack query cache to IndexedDB:', err)
      }
    },
    restoreClient: async () => {
      try {
        const db = await getDb()
        const record = await db.get('tanstack_cache', CACHE_KEY)
        return record?.value as PersistedClient | undefined
      } catch (err) {
        console.warn('Failed to restore TanStack query cache from IndexedDB:', err)
        return undefined
      }
    },
    removeClient: async () => {
      try {
        const db = await getDb()
        await db.delete('tanstack_cache', CACHE_KEY)
      } catch (err) {
        console.warn('Failed to remove TanStack query cache from IndexedDB:', err)
      }
    }
  }
}
