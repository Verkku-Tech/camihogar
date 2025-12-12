import { useState, useCallback } from 'react'
import { apiClient, ApiError } from '@/lib/api-client'

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useApi<T = any>(options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (apiCall: () => Promise<T>) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await apiCall()
        setData(result)
        options?.onSuccess?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Error desconocido')
        setError(error)
        options?.onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [options]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  }
}

