import { describe, test, expect, beforeEach } from 'bun:test'
import { connectivityManager } from '../connectivity'
import { ApiError } from '../api-client'

describe('ConnectivityManager', () => {
  beforeEach(() => {
    connectivityManager.resetForTesting()
  })

  test('initial status is connected', () => {
    expect(connectivityManager.getStatus()).toBe('connected')
    expect(connectivityManager.isServerUnreachable()).toBe(false)
  })

  test('reportSuccess keeps status as connected', () => {
    connectivityManager.reportSuccess()
    expect(connectivityManager.getStatus()).toBe('connected')
  })

  test('HTTP 500 error DOES NOT trigger unreachable / offline mode', () => {
    const error500 = new ApiError('Internal Server Error', 500, { message: 'Database crash or unhandled bug' })
    connectivityManager.reportFailure(error500)

    // Critical requirement: 500 is an app bug, NOT server reachability failure
    expect(connectivityManager.getStatus()).toBe('connected')
    expect(connectivityManager.isServerUnreachable()).toBe(false)
  })

  test('HTTP 502 Bad Gateway triggers unreachable status', () => {
    const error502 = new ApiError('Bad Gateway', 502)
    connectivityManager.reportFailure(error502)

    expect(connectivityManager.getStatus()).toBe('unreachable')
    expect(connectivityManager.isServerUnreachable()).toBe(true)
  })

  test('HTTP 503 Service Unavailable (DB down) triggers unreachable status', () => {
    const error503 = new ApiError('Service Unavailable', 503, { status: 'Unhealthy', database: 'Disconnected' })
    connectivityManager.reportFailure(error503)

    expect(connectivityManager.getStatus()).toBe('unreachable')
    expect(connectivityManager.isServerUnreachable()).toBe(true)
  })

  test('HTTP 504 Gateway Timeout triggers unreachable status', () => {
    const error504 = new ApiError('Gateway Timeout', 504)
    connectivityManager.reportFailure(error504)

    expect(connectivityManager.getStatus()).toBe('unreachable')
    expect(connectivityManager.isServerUnreachable()).toBe(true)
  })

  test('Transport error (Failed to fetch) triggers unreachable status', () => {
    const transportError = new TypeError('Failed to fetch')
    connectivityManager.reportFailure(transportError)

    expect(connectivityManager.getStatus()).toBe('unreachable')
    expect(connectivityManager.isServerUnreachable()).toBe(true)
  })

  test('Subscribers are notified on status change', () => {
    let notified = false
    const unsubscribe = connectivityManager.subscribe(() => {
      notified = true
    })

    connectivityManager.reportFailure(new TypeError('Failed to fetch'))
    expect(notified).toBe(true)
    unsubscribe()
  })

  test('probeHealth marks unreachable when health endpoint network fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'))

    try {
      const isHealthy = await connectivityManager.probeHealth()
      expect(isHealthy).toBe(false)
      expect(connectivityManager.isServerUnreachable()).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('probeHealth recovers to connected when health endpoint returns Healthy', async () => {
    // Set unreachable first
    connectivityManager.reportFailure(new TypeError('Network down'))
    expect(connectivityManager.isServerUnreachable()).toBe(true)

    const originalFetch = globalThis.fetch
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'Healthy' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    try {
      const isHealthy = await connectivityManager.probeHealth()
      expect(isHealthy).toBe(true)
      expect(connectivityManager.isServerUnreachable()).toBe(false)
      expect(connectivityManager.getStatus()).toBe('connected')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

