import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'
import { syncManager } from '../../../lib/sync-manager'

export interface OrderProduct {
  id: string
  name: string
  price: number
  quantity: number
  total: number
  category: string
  stock: number
  discount?: number
  observations?: string
  manufacturingStatus?: string
  locationStatus?: string
  logisticStatus?: string
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  vendorId: string
  vendorName: string
  products: OrderProduct[]
  subtotal: number
  deliveryCost: number
  total: number
  status: string
  paymentType: string
  paymentMethod: string
  deliveryAddress?: string
  hasDelivery: boolean
  observations?: string
  createdAt: string
  updatedAt: string
}

export interface PagedOrdersResult {
  items: Order[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export function useOrders(params: {
  pageNumber?: number
  pageSize?: number
  status?: string
  type?: string
  searchTerm?: string
}) {
  const queryParams = new URLSearchParams()
  if (params.pageNumber) queryParams.set('pageNumber', params.pageNumber.toString())
  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
  if (params.status) queryParams.set('status', params.status)
  if (params.type) queryParams.set('type', params.type)
  if (params.searchTerm) queryParams.set('searchTerm', params.searchTerm)

  return useQuery<PagedOrdersResult>({
    queryKey: ['orders', params],
    queryFn: () => apiFetch(`orders?${queryParams.toString()}`),
    staleTime: 1000 * 60 * 2 // 2 minutes
  })
}

export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () => apiFetch(`orders/${id}`),
    enabled: !!id
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: any) => {
      if (!navigator.onLine) {
        // Offline: enqueue in outbox
        await syncManager.enqueueMutation({
          endpoint: 'orders',
          method: 'POST',
          payload
        })
        return { isQueuedOffline: true }
      }
      return await apiFetch('orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dto,
      expectedUpdatedAt
    }: {
      id: string
      dto: any
      expectedUpdatedAt?: string
    }) => {
      const headers: Record<string, string> = {}
      if (expectedUpdatedAt) {
        headers['If-Match'] = `"${expectedUpdatedAt}"`
      }

      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: `orders/${id}`,
          method: 'PUT',
          payload: dto
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch(`orders/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(dto)
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] })
    }
  })
}
