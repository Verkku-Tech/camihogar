import * as db from "./indexeddb"

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: 'user' | 'order' | 'product' | 'category' | 'client' | 'provider' | 'store' | 'commission'
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
        // Si es un error de validación (400), no reintentar
        const errorMsg = error?.message || ''
        const isValidationError = 
          errorMsg.includes('is required') ||
          errorMsg.includes('validation error') ||
          errorMsg.includes('400')
        
        if (isValidationError) {
          operation.status = 'failed'
          operation.error = errorMsg
          await db.update('sync_queue', operation)
          console.error(`❌ Error de validación permanente, no se reintentará:`, errorMsg)
          continue
        }

        operation.retryCount++
        operation.status = operation.retryCount >= 3 ? 'failed' : 'pending'
        operation.error = errorMsg
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

      if (operation.entity === 'order') {
        switch (operation.type) {
          case 'create':
            await apiClient.createOrder(operation.data as any)
            break
          case 'update':
            // Para update, necesitamos el ID del backend, intentar obtenerlo por orderNumber
            try {
              const orderId = operation.entityId
              // Intentar obtener el pedido local para obtener el orderNumber
              const { getOrder } = await import('./storage')
              const localOrder = await getOrder(orderId)
              if (localOrder) {
                // Buscar el pedido en el backend por orderNumber
                const backendOrder = await apiClient.getOrderByOrderNumber(localOrder.orderNumber)
                if (backendOrder) {
                  await apiClient.updateOrder(backendOrder.id, operation.data as any)
                } else {
                  // Si no existe en el backend, intentar crear uno nuevo con los datos del update
                  // Esto puede pasar si el pedido se creó offline y luego se actualizó
                  throw new Error(`Pedido ${localOrder.orderNumber} no encontrado en el backend. Debe crearse primero.`)
                }
              } else {
                throw new Error(`Pedido con ID ${orderId} no encontrado localmente`)
              }
            } catch (error) {
              console.error('Error en sincronización de actualización de pedido:', error)
              throw error
            }
            break
          case 'delete':
            // Para delete, necesitamos el ID del backend
            const deleteOrderId = operation.entityId
            try {
              const { getOrder } = await import('./storage')
              const localOrder = await getOrder(deleteOrderId)
              if (localOrder) {
                const backendOrder = await apiClient.getOrderByOrderNumber(localOrder.orderNumber)
                if (backendOrder) {
                  await apiClient.deleteOrder(backendOrder.id)
                }
              }
            } catch (error) {
              console.error('Error en sincronización de eliminación de pedido:', error)
              // No lanzar error, el pedido ya fue eliminado localmente
            }
            break
        }
        return
      }

      if (operation.entity === 'provider') {
        const { providerFromBackendDto, providerToCreateDto, providerToUpdateDto } = await import('./storage')
        switch (operation.type) {
          case 'create': {
            const localProvider = operation.data as any
            const createDto = providerToCreateDto({
              razonSocial: localProvider.razonSocial,
              rif: localProvider.rif,
              direccion: localProvider.direccion,
              telefono: localProvider.telefono,
              email: localProvider.email,
              contacto: localProvider.contacto,
              tipo: localProvider.tipo,
              estado: localProvider.estado,
            })
            const backendProvider = await apiClient.createProvider(createDto)
            const newProvider = providerFromBackendDto(backendProvider)
            await db.remove('providers', operation.entityId)
            await db.add('providers', newProvider)
            // Actualizar cola: operaciones pendientes que referencian este id local
            const pending = await this.getPendingOperations()
            for (const op of pending) {
              if (op.entity === 'provider' && op.entityId === operation.entityId && op.id !== operation.id) {
                ;(op as any).entityId = newProvider.id
                op.data = { ...(op.data || {}), id: newProvider.id }
                await db.update('sync_queue', op)
              }
            }
            break
          }
          case 'update': {
            try {
              await apiClient.updateProvider(operation.entityId, providerToUpdateDto(operation.data || {}))
              const updatedFromBackend = await apiClient.getProviderById(operation.entityId)
              if (updatedFromBackend) {
                const updatedProvider = providerFromBackendDto(updatedFromBackend)
                await db.update('providers', updatedProvider)
              }
            } catch (err: any) {
              // 409 Conflict: RIF o email duplicado → aceptar datos del servidor (resolución de conflicto)
              if (err?.message && (err.message.includes('409') || err.message.includes('Conflict') || err.message.includes('Ya existe'))) {
                try {
                  const fromBackend = await apiClient.getProviderById(operation.entityId)
                  if (fromBackend) {
                    await db.update('providers', providerFromBackendDto(fromBackend))
                  }
                } catch (_) {
                  // si no se puede refrescar, marcar como fallido para reintentar
                }
                return // operación resuelta (servidor gana), no reintentar
              }
              throw err
            }
            break
          }
          case 'delete':
            await apiClient.deleteProvider(operation.entityId)
            await db.remove('providers', operation.entityId)
            break
        }
        return
      }

      if (operation.entity === 'commission') {
        // Sincronizar comisiones con el backend
        // Nota: El backend debe tener endpoints para recibir comisiones
        // Por ahora, intentamos sincronizar pero no fallamos si no existe el endpoint
        try {
          const token = typeof window !== "undefined" 
            ? localStorage.getItem("auth_token") 
            : null

          if (!token) {
            throw new Error("No hay token de autenticación")
          }

          // Determinar URL base según el servicio (orders para comisiones)
          const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"
          const baseUrl = isHttps 
            ? "/api/proxy/orders"
            : "http://localhost:5093" // URL directa para desarrollo

          const url = operation.type === 'delete' 
            ? `${baseUrl}/api/Commissions/${operation.entityId}`
            : `${baseUrl}/api/Commissions`

          const method = operation.type === 'create' ? 'POST' 
            : operation.type === 'update' ? 'PUT' 
            : 'DELETE'

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
          })

          if (!response.ok) {
            // Si el endpoint no existe (404), no es crítico - la app funciona offline
            if (response.status === 404) {
              console.log(`⚠️ Endpoint de comisiones no disponible en backend - se sincronizará cuando esté disponible`)
              return // No lanzar error, solo loggear
            }
            throw new Error(`Error sincronizando comisión: ${response.statusText}`)
          }
        } catch (error: any) {
          // Si el error es porque el endpoint no existe, no es crítico
          if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('Failed to fetch')) {
            console.log(`⚠️ Endpoint de comisiones no disponible - se sincronizará cuando esté disponible`)
            return
          }
          throw error
        }
        return
      }

      // Para otras entidades (clients, etc.)
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

