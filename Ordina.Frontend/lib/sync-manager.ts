import * as db from "./indexeddb"

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'user' | 'order' | 'product' | 'category' | 'client' | 'provider' | 'store'
  entityId: string
  data: any
  timestamp: number
  retryCount: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  error?: string
}

class SyncManager {
  private isOnline: boolean
  private syncInterval: NodeJS.Timeout | null = null

  constructor() {
    // Inicializar con valor seguro para SSR
    this.isOnline = typeof window !== 'undefined' ? navigator.onLine : true
    
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
    const { apiClient } = await import('./api-client')
    
    try {
      // Si la operación viene de la cola del SW, tiene formato diferente
      if (operation.data && operation.data.url && operation.data.method) {
        // Es una petición desde el Service Worker
        await this.executeQueuedRequest(operation.data)
        return
      }

      // Manejar según la entidad
      if (operation.entity === 'user') {
        // Formato normal desde la app
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
        return
      }

      if (operation.entity === 'category') {
        switch (operation.type) {
          case 'create':
            await apiClient.createCategory(operation.data)
            break
          case 'update':
            await apiClient.updateCategory(operation.entityId, operation.data)
            break
          case 'delete':
            await apiClient.deleteCategory(operation.entityId)
            break
        }
        return
      }

      if (operation.entity === 'product') {
        switch (operation.type) {
          case 'create':
            // Resolver el categoryId antes de crear el producto
            const productData = operation.data as any
            if (productData.categoryId && productData.category) {
              // Verificar si el categoryId parece ser un ID local (numérico corto)
              // Los ObjectIds de MongoDB tienen 24 caracteres hexadecimales
              if (/^\d+$/.test(productData.categoryId) && productData.categoryId.length < 10) {
                // Es un ID local, resolver el ObjectId del backend
                const { resolveCategoryBackendId } = await import('./storage')
                const backendCategoryId = await resolveCategoryBackendId(productData.category)
                
                if (backendCategoryId) {
                  productData.categoryId = backendCategoryId
                } else {
                  throw new Error(
                    `La categoría "${productData.category}" no existe en el backend y no se pudo sincronizar.`
                  )
                }
              }
            }
            
            await apiClient.createProduct(productData)
            break
          case 'update':
            await apiClient.updateProduct(operation.entityId, operation.data)
            break
          case 'delete':
            await apiClient.deleteProduct(operation.entityId)
            break
        }
        return
      }

      // Para otras entidades (orders, clients, etc.)
      // No hacer nada todavía - se implementará cuando el backend esté listo
      console.log(`⚠️ Sincronización de ${operation.entity} no implementada aún - se guardará para cuando el backend esté listo`)
      // No lanzar error, solo loggear - la app sigue funcionando offline
    } catch (error) {
      // Si falla, mantener en cola para reintentar
      throw error
    }
  }

  // Ejecutar petición encolada desde el Service Worker
  private async executeQueuedRequest(requestData: any): Promise<void> {
    try {
      const token = typeof window !== "undefined" 
        ? localStorage.getItem("auth_token") 
        : null

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(requestData.headers || {}),
      }

      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers,
        body: requestData.body,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Si es GET, actualizar cache
      if (requestData.method === "GET") {
        try {
          const data = await response.json()
          const { add, update } = await import("./indexeddb")
          const cacheKey = `api_cache_${new URL(requestData.url).pathname}`
          try {
            await update("api_cache", {
              id: cacheKey,
              endpoint: new URL(requestData.url).pathname,
              data,
              timestamp: Date.now(),
            })
          } catch {
            await add("api_cache", {
              id: cacheKey,
              endpoint: new URL(requestData.url).pathname,
              data,
              timestamp: Date.now(),
            })
          }
        } catch {
          // Si no es JSON, no cachear
        }
      }
    } catch (error) {
      throw error
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

