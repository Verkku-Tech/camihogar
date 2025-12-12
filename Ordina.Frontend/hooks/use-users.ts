import { useState, useEffect, useCallback } from 'react'
import { apiClient, type UserResponseDto, type CreateUserDto, type UpdateUserDto } from '@/lib/api-client'
import * as db from '@/lib/indexeddb'
import { syncManager } from '@/lib/sync-manager'

interface User {
  id: string
  username: string
  email: string
  name: string
  role: string
  status: string
  createdAt?: string
}

interface UseUsersOptions {
  autoSync?: boolean // Sincronizar automáticamente al montar
  statusFilter?: string
}

export function useUsers(options: UseUsersOptions = {}) {
  const { autoSync = true, statusFilter } = options
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)

  // Detectar conexión
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  // Cargar usuarios desde IndexedDB primero, luego sincronizar
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // 1. Cargar desde IndexedDB (rápido, funciona offline)
      const localUsers = await db.getAll<User>('users')
      setUsers(localUsers)

      // 2. Si hay conexión, sincronizar con backend
      if (isOnline && autoSync) {
        await syncUsers()
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error cargando usuarios')
      setError(error)
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isOnline, autoSync])

  // Sincronizar usuarios con el backend
  const syncUsers = useCallback(async () => {
    if (!isOnline) {
      console.log('⚠️ Sin conexión, usando datos locales')
      return
    }

    try {
      setIsSyncing(true)
      const apiUsers = await apiClient.getUsers(statusFilter)

      // Actualizar IndexedDB con datos del servidor
      for (const apiUser of apiUsers) {
        const existingUser = await db.get<User>('users', apiUser.id)
        if (existingUser) {
          await db.update('users', {
            id: apiUser.id,
            username: apiUser.username,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            status: apiUser.status,
            createdAt: apiUser.createdAt,
          })
        } else {
          await db.add('users', {
            id: apiUser.id,
            username: apiUser.username,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            status: apiUser.status,
            createdAt: apiUser.createdAt,
          })
        }
      }

      // Recargar desde IndexedDB
      const updatedUsers = await db.getAll<User>('users')
      setUsers(updatedUsers)

      // Sincronizar operaciones pendientes
      await syncManager.syncPendingOperations()
    } catch (err) {
      console.error('Error syncing users:', err)
      // No lanzar error, usar datos locales
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, statusFilter])

  // Crear usuario
  const createUser = useCallback(async (userData: CreateUserDto): Promise<User> => {
    try {
      setError(null)

      // Generar ID temporal
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newUser: User = {
        id: tempId,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: userData.status || 'active',
        createdAt: new Date().toISOString(),
      }

      // Guardar en IndexedDB inmediatamente
      await db.add('users', newUser)
      setUsers(prev => [...prev, newUser])

      if (isOnline) {
        try {
          // Intentar crear en el backend
          const createdUser = await apiClient.createUser(userData)
          
          // Actualizar con el ID real del servidor
          await db.remove('users', tempId)
          await db.add('users', {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            name: createdUser.name,
            role: createdUser.role,
            status: createdUser.status,
            createdAt: createdUser.createdAt,
          })

          // Actualizar estado
          setUsers(prev => prev.map(u => u.id === tempId ? {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            name: createdUser.name,
            role: createdUser.role,
            status: createdUser.status,
            createdAt: createdUser.createdAt,
          } : u))

          return {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            name: createdUser.name,
            role: createdUser.role,
            status: createdUser.status,
            createdAt: createdUser.createdAt,
          }
        } catch (apiError) {
          // Si falla, agregar a cola de sincronización
          await syncManager.addToQueue({
            type: 'create',
            entity: 'user',
            entityId: tempId,
            data: userData,
          })
          throw apiError
        }
      } else {
        // Sin conexión, agregar a cola
        await syncManager.addToQueue({
          type: 'create',
          entity: 'user',
          entityId: tempId,
          data: userData,
        })
      }

      return newUser
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error creando usuario')
      setError(error)
      throw error
    }
  }, [isOnline])

  // Actualizar usuario
  const updateUser = useCallback(async (id: string, userData: UpdateUserDto): Promise<User> => {
    try {
      setError(null)

      // Obtener usuario actual
      const currentUser = await db.get<User>('users', id)
      if (!currentUser) {
        throw new Error('Usuario no encontrado')
      }

      // Actualizar en IndexedDB inmediatamente
      const updatedUser: User = {
        ...currentUser,
        ...userData,
      }
      await db.update('users', updatedUser)
      setUsers(prev => prev.map(u => u.id === id ? updatedUser : u))

      if (isOnline) {
        try {
          // Intentar actualizar en el backend
          const apiUser = await apiClient.updateUser(id, userData)
          
          // Actualizar con datos del servidor
          await db.update('users', {
            id: apiUser.id,
            username: apiUser.username,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            status: apiUser.status,
            createdAt: apiUser.createdAt,
          })

          setUsers(prev => prev.map(u => u.id === id ? {
            id: apiUser.id,
            username: apiUser.username,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            status: apiUser.status,
            createdAt: apiUser.createdAt,
          } : u))

          return {
            id: apiUser.id,
            username: apiUser.username,
            email: apiUser.email,
            name: apiUser.name,
            role: apiUser.role,
            status: apiUser.status,
            createdAt: apiUser.createdAt,
          }
        } catch (apiError) {
          // Si falla, agregar a cola
          await syncManager.addToQueue({
            type: 'update',
            entity: 'user',
            entityId: id,
            data: userData,
          })
          throw apiError
        }
      } else {
        // Sin conexión, agregar a cola
        await syncManager.addToQueue({
          type: 'update',
          entity: 'user',
          entityId: id,
          data: userData,
        })
      }

      return updatedUser
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error actualizando usuario')
      setError(error)
      throw error
    }
  }, [isOnline])

  // Eliminar usuario
  const deleteUser = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null)

      // Eliminar de IndexedDB inmediatamente
      await db.remove('users', id)
      setUsers(prev => prev.filter(u => u.id !== id))

      if (isOnline) {
        try {
          // Intentar eliminar en el backend
          await apiClient.deleteUser(id)
        } catch (apiError) {
          // Si falla, agregar a cola
          await syncManager.addToQueue({
            type: 'delete',
            entity: 'user',
            entityId: id,
            data: {},
          })
          throw apiError
        }
      } else {
        // Sin conexión, agregar a cola
        await syncManager.addToQueue({
          type: 'delete',
          entity: 'user',
          entityId: id,
          data: {},
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error eliminando usuario')
      setError(error)
      throw error
    }
  }, [isOnline])

  // Cargar usuarios al montar
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Sincronizar cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && !isLoading) {
      syncUsers()
    }
  }, [isOnline, syncUsers, isLoading])

  return {
    users,
    isLoading,
    isSyncing,
    error,
    isOnline,
    createUser,
    updateUser,
    deleteUser,
    refresh: loadUsers,
    sync: syncUsers,
  }
}

