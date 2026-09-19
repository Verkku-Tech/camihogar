import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'

export interface DashboardMetrics {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  totalSalesUsd: number
  totalClients: number
  totalProductsInStock: number
  manufacturingPendingCount: number
  dispatchPendingCount: number
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => apiFetch('reports/dashboard'),
    refetchInterval: 60000 // Polling 1 min
  })
}
