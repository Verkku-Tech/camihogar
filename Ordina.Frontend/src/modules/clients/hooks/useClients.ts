import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getAuthToken } from '../../../lib/api-client'
import { syncManager } from '../../../lib/sync-manager'

export interface Client {
  id: string
  name: string
  rutId: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  type: string
  status: string
  totalOrdersCount: number
  totalSpentUsd: number
}

export interface PagedClientsResult {
  items: Client[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export function useClients(params: {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
}) {
  const queryParams = new URLSearchParams()
  if (params.pageNumber) queryParams.set('pageNumber', params.pageNumber.toString())
  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
  if (params.searchTerm) queryParams.set('searchTerm', params.searchTerm)

  return useQuery<PagedClientsResult>({
    queryKey: ['clients', params],
    queryFn: () => apiFetch(`clients?${queryParams.toString()}`)
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      name: string
      rutId: string
      phone?: string
      email?: string
      address?: string
      city?: string
      state?: string
      type?: string
    }) => {
      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: 'clients',
          method: 'POST',
          payload
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch('clients', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    }
  })
}

export function useImportClientsCsv() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const token = getAuthToken()
      const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest'
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/clients/import-csv', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include'
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Error al importar CSV de clientes.')
      }

      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    }
  })
}
