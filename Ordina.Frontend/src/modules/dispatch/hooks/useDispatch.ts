import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'
import { syncManager } from '../../../lib/sync-manager'

export interface DispatchQueueItem {
  orderId: string
  orderNumber: string
  clientName: string
  deliveryAddress?: string
  deliveryZone?: string
  deliveryType: string
  productCount: number
  totalAmount: number
  paymentStatus: string
  isReadyForDispatch: boolean
}

export interface DispatchRoute {
  id: string
  code: string
  driverName: string
  vehiclePlate?: string
  zone: string
  status: string
  scheduledDate: string
  items: Array<{
    orderId: string
    orderNumber: string
    clientName: string
    address: string
    isDelivered: boolean
    deliveredAt?: string
  }>
}

export function useDispatchQueue(zone?: string) {
  const query = zone ? `?zone=${encodeURIComponent(zone)}` : ''
  return useQuery<DispatchQueueItem[]>({
    queryKey: ['dispatch', 'queue', zone],
    queryFn: () => apiFetch(`dispatch/queue${query}`)
  })
}

export function useDispatchRoutes(date?: string, zone?: string) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (zone) params.set('zone', zone)
  return useQuery<DispatchRoute[]>({
    queryKey: ['dispatch', 'routes', date, zone],
    queryFn: () => apiFetch(`dispatch/routes?${params.toString()}`)
  })
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      routeId: string
      orderId: string
      notes?: string
    }) => {
      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: 'dispatch/confirm-delivery',
          method: 'POST',
          payload
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch('dispatch/confirm-delivery', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  })
}
