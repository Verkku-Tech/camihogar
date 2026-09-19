import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'
import { syncManager } from '../../../lib/sync-manager'

export interface WorkOrderItem {
  orderId: string
  orderNumber: string
  clientName: string
  productId: string
  productName: string
  category: string
  quantity: number
  stage: string
  manufacturingProviderId?: string
  manufacturingProviderName?: string
  manufacturingStartedAt?: string
  manufacturingNotes?: string
}

export interface KanbanBoard {
  corte: WorkOrderItem[]
  costura: WorkOrderItem[]
  tapiceria: WorkOrderItem[]
  carpinteria: WorkOrderItem[]
  pintura: WorkOrderItem[]
  controlCalidad: WorkOrderItem[]
  terminado: WorkOrderItem[]
}

export function useKanbanBoard(providerId?: string) {
  const query = providerId ? `?providerId=${providerId}` : ''
  return useQuery<KanbanBoard>({
    queryKey: ['manufacturing', 'kanban', providerId],
    queryFn: () => apiFetch(`manufacturing/kanban${query}`),
    refetchInterval: 30000 // Polling every 30s
  })
}

export function useUpdateManufacturingStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      orderId: string
      productId: string
      stage: string
      notes?: string
      providerId?: string
      providerName?: string
    }) => {
      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: 'manufacturing/stage',
          method: 'PATCH',
          payload
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch('manufacturing/stage', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing'] })
    }
  })
}

export function useRefabricateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      orderId: string
      productId: string
      reason: string
      notes?: string
    }) => {
      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: 'manufacturing/refabricate',
          method: 'POST',
          payload
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch('manufacturing/refabricate', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  })
}
