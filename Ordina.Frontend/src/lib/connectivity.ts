// ponytail: lightweight reachability tracker with proactive heartbeat and 500 error isolation
export type ConnectionStatus = 'connected' | 'unreachable' | 'syncing'

export class ConnectivityManager {
  private status: ConnectionStatus = 'connected'
  private listeners: Array<() => void> = []
  private heartbeatTimer: any = null
  private unreachableTimer: any = null
  private isProbing: boolean = false
  private lastSuccessfulPing: number = 0
  private debounceMs: number = 1000

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => this.handleOfflineEvent())
      window.addEventListener('online', () => {
        void this.probeHealth()
      })
      window.addEventListener('focus', () => {
        void this.probeHealth()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.probeHealth()
        }
      })
      this.startHeartbeat()
    }
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  isServerUnreachable(): boolean {
    return this.status === 'unreachable'
  }

  get isServerReachable(): boolean {
    return this.status !== 'unreachable'
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (err) {
        console.error('Error in connectivity listener:', err)
      }
    })
  }

  reportSuccess() {
    this.lastSuccessfulPing = Date.now()
    if (this.unreachableTimer) {
      clearTimeout(this.unreachableTimer)
      this.unreachableTimer = null
    }
    if (this.status !== 'connected') {
      this.status = 'connected'
      this.notify()
    }
  }

  private markUnreachable(immediate = false) {
    if (this.status === 'unreachable') return

    const applyUnreachable = () => {
      this.unreachableTimer = null
      if (this.status !== 'unreachable') {
        this.status = 'unreachable'
        this.notify()
      }
    }

    if (immediate || this.debounceMs === 0) {
      if (this.unreachableTimer) {
        clearTimeout(this.unreachableTimer)
        this.unreachableTimer = null
      }
      applyUnreachable()
      return
    }

    if (!this.unreachableTimer) {
      this.unreachableTimer = setTimeout(applyUnreachable, this.debounceMs)
    }
  }

  reportFailure(error: any) {
    // Aborted or canceled requests are deliberate client cancellations, NOT reachability failures
    if (
      error?.name === 'AbortError' ||
      error?.name === 'CanceledError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('canceled')
    ) {
      return
    }

    const statusCode = error?.statusCode ?? error?.status

    // 500 is an application unhandled bug, NOT server reachability failure
    // 4xx are valid application responses from an active, responding server
    if (statusCode === 500 || (statusCode && statusCode >= 400 && statusCode < 500)) {
      return
    }

    const isTransportError =
      error instanceof TypeError ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      (!statusCode && error instanceof Error)

    const isGatewayOrDown = statusCode === 502 || statusCode === 503 || statusCode === 504

    if (isTransportError || isGatewayOrDown) {
      // Anti-flap guard: if a successful request happened within 2000ms, don't flap; verify in background
      if (this.status === 'connected' && this.lastSuccessfulPing > 0 && Date.now() - this.lastSuccessfulPing < 2000) {
        void this.probeHealth()
        return
      }
      this.markUnreachable()
    }
  }

  setSyncing(syncing: boolean) {
    const newStatus: ConnectionStatus = syncing ? 'syncing' : 'connected'
    if (this.status !== newStatus) {
      this.status = newStatus
      this.notify()
    }
  }

  private handleOfflineEvent() {
    this.markUnreachable(true)
  }

  private getHealthUrl(): string {
    if (typeof window !== 'undefined' && window.location?.hostname?.endsWith('pages.dev')) {
      return 'https://ch-api-v2.verkku.com/api/health'
    }
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    return apiBase ? `${apiBase}/api/health` : '/api/health'
  }

  async probeHealth(): Promise<boolean> {
    if (this.isProbing) return this.status === 'connected'
    this.isProbing = true

    try {
      const healthUrl = this.getHealthUrl()
      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(6000) : undefined
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.status === 'Healthy') {
          const wasDisconnected = this.status !== 'connected'
          this.reportSuccess()
          if (wasDisconnected) {
            await this.triggerOutboxDrain()
          }
          return true
        }
      }

      // If status is 502, 503, 504 or unhandled non-500 failure, mark unreachable
      const status = res.status
      if (status !== 500) {
        this.markUnreachable(true)
        return false
      }
    } catch {
      // Network failure, connection refused, or timeout
      this.markUnreachable(true)
      return false
    } finally {
      this.isProbing = false
    }

    return false
  }

  private startHeartbeat() {
    if (this.heartbeatTimer || typeof window === 'undefined') return
    // ponytail: 10s steady heartbeat for responsive failure and recovery detection
    this.heartbeatTimer = setInterval(() => {
      void this.probeHealth()
    }, 10000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private async triggerOutboxDrain() {
    try {
      const { syncManager } = await import('./sync-manager')
      this.setSyncing(true)
      await syncManager.drainOutbox()
      this.setSyncing(false)
    } catch {
      this.setSyncing(false)
    }
  }

  // Testing helper
  resetForTesting() {
    this.status = 'connected'
    this.stopHeartbeat()
    if (this.unreachableTimer) {
      clearTimeout(this.unreachableTimer)
      this.unreachableTimer = null
    }
    this.listeners = []
    this.isProbing = false
    this.lastSuccessfulPing = 0
    this.debounceMs = 0
  }
}

export const connectivityManager = new ConnectivityManager()


