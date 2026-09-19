import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'
import { syncManager } from '../../../lib/sync-manager'

export interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveDate: string
}

export function useLatestExchangeRate(from = 'Bs', to = 'USD') {
  return useQuery<ExchangeRate>({
    queryKey: ['exchange-rate', 'latest', from, to],
    queryFn: () => apiFetch(`finance/exchange-rates/latest?fromCurrency=${from}&toCurrency=${to}`),
    staleTime: 1000 * 60 * 15 // 15 min cache
  })
}

export function useSetExchangeRate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      fromCurrency: string
      toCurrency: string
      rate: number
    }) => {
      if (!navigator.onLine) {
        await syncManager.enqueueMutation({
          endpoint: 'finance/exchange-rates',
          method: 'POST',
          payload
        })
        return { isQueuedOffline: true }
      }

      return await apiFetch('finance/exchange-rates', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] })
    }
  })
}
