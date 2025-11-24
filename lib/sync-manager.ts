import * as db from "./indexeddb"

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'user' | 'order' | 'product' | 'client' | 'provider' | 'store'
  entityId: string
  data: any
  timestamp: number
  retryCount: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  error?: string
}

class SyncManager {
  private isOnline = navigator.onLine
  private syncInterval: NodeJS.Timeout | null = null

  constructor() {
    // Detectar cambios de conexión
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.syncPendingOperations()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
      })

      // Sincronizar periódicamente si hay conexión
      this.startPeriodicSync()
    }
  }

  async addToQueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    }

    await db.add('sync_queue', syncOp)
    console.log(`📝 Operación agregada a cola: ${syncOp.type} ${syncOp.entity}`)

    // Si hay conexión, intentar sincronizar inmediatamente
    if (this.isOnline) {
      this.syncPendingOperations()
    }
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    try {
      const all = await db.getAll<SyncOperation>('sync_queue')
      return all.filter(op => op.status === 'pending' || op.status === 'failed')
    } catch (error) {
      console.error('Error getting pending operations:', error)
      return []
    }
  }

  async syncPendingOperations(): Promise<void> {
    if (!this.isOnline) {
      console.log('⚠️ Sin conexión, no se puede sincronizar')
      return
    }

    const pending = await this.getPendingOperations()
    if (pending.length === 0) return

    console.log(`🔄 Sincronizando ${pending.length} operaciones pendientes...`)

    for (const operation of pending) {
      try {
        // Marcar como sincronizando
        operation.status = 'syncing'
        await db.update('sync_queue', operation)

        // Ejecutar operación según tipo
        await this.executeSyncOperation(operation)

        // Marcar como completada
        operation.status = 'completed'
        await db.update('sync_queue', operation)
        console.log(`✅ Operación sincronizada: ${operation.type} ${operation.entity}`)
      } catch (error: any) {
        operation.retryCount++
        operation.status = operation.retryCount >= 3 ? 'failed' : 'pending'
        operation.error = error.message
        await db.update('sync_queue', operation)
        console.error(`❌ Error sincronizando operación:`, error)
      }
    }
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    // Esta función será implementada por cada entidad
    // Por ahora, solo para usuarios
    if (operation.entity === 'user') {
      const { apiClient } = await import('./api-client')
      
      switch (operation.type) {
        case 'create':
          await apiClient.createUser(operation.data)
          break
        case 'update':
          await apiClient.updateUser(operation.entityId, operation.data)
          break
        case 'delete':
          await apiClient.deleteUser(operation.entityId)
          break
      }
    }
  }

  startPeriodicSync() {
    if (typeof window === 'undefined') return
    
    // Sincronizar cada 30 segundos si hay conexión
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncPendingOperations()
      }
    }, 30000)
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline
  }
}

export const syncManager = new SyncManager()

