import { telemetry } from './telemetry'

let inMemoryToken: string | null = null

export function setAuthToken(token: string | null) {
  inMemoryToken = token
}

export function getAuthToken(): string | null {
  return inMemoryToken
}

export class ApiError extends Error {
  statusCode: number
  data?: any

  constructor(message: string, statusCode: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.data = data
  }
}

interface RequestOptions extends RequestInit {
  mutationId?: string
  skipAuthRefresh?: boolean
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  const headers = new Headers(options.headers || {})
  headers.set('X-Requested-With', 'XMLHttpRequest')

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`)
  }

  // Generate or forward Idempotency UUIDv4 for all modifying requests
  const mutationId = options.mutationId || (isMutation ? crypto.randomUUID() : undefined)
  if (mutationId) {
    headers.set('X-Mutation-Id', mutationId)
  }

  const url = endpoint.startsWith('http') ? endpoint : endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Needed for HttpOnly refresh cookie
    })

    // Handle 401 Unauthorized: Attempt silent refresh once
    if (res.status === 401 && !options.skipAuthRefresh && !endpoint.includes('/api/auth/')) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include'
        })

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setAuthToken(data.token)
          // Retry original request with new token
          return await apiFetch<T>(endpoint, { ...options, skipAuthRefresh: true })
        } else {
          setAuthToken(null)
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }
      } catch {
        setAuthToken(null)
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }

    if (!res.ok) {
      let errorBody: any = null
      try {
        errorBody = await res.json()
      } catch {
        errorBody = await res.text()
      }

      const errorMessage = errorBody?.message || errorBody?.error || `HTTP ${res.status}: ${res.statusText}`
      const error = new ApiError(errorMessage, res.status, errorBody)

      if (res.status >= 500) {
        telemetry.log('error', `API Failure: ${method} ${url}`, error.stack, { status: res.status, body: errorBody }, mutationId)
      }

      throw error
    }

    if (res.status === 204) {
      return {} as T
    }

    return await res.json()
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err
    }
    // Network / Offline Error
    const networkError = new ApiError('Error de conexión o modo sin conexión.', 0, { originalError: err?.message })
    throw networkError
  }
}
