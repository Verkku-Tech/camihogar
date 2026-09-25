// ponytail: lightweight reachability tracker with proactive heartbeat and 500 error isolation
export type ConnectionStatus = 'connected' | 'unreachable' | 'syncing'

export class ConnectivityManager {
  private status: ConnectionStatus = 'connected'
  private listeners: Array<() => void> = []
  private heartbeatTimer: any = null
  private isProbing: boolean = false
  private lastSuccessfulPing: number = Date.now()

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
    if (this.status !== 'connected') {
      this.status = 'connected'
      this.notify()
    }
  }

  private markUnreachable() {
    if (this.status !== 'unreachable') {
      this.status = 'unreachable'
      this.notify()
    }
  }

  reportFailure(error: any) {
    // 500 is an application unhandled bug, NOT server reachability failure
    const statusCode = error?.statusCode ?? error?.status
    if (statusCode === 500) {
      return
    }

    const isTransportError =
      error instanceof TypeError ||
      error?.name === 'AbortError' ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      (!statusCode && error instanceof Error)

    const isGatewayOrDown = statusCode === 502 || statusCode === 503 || statusCode === 504

    if (isTransportError || isGatewayOrDown) {
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
    this.markUnreachable()
  }

  async probeHealth(): Promise<boolean> {
    if (this.isProbing) return this.status === 'connected'
    this.isProbing = true

    try {
      const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const healthUrl = apiBase ? `${apiBase}/api/health` : '/api/health'
      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(2500) : undefined
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
        this.markUnreachable()
        return false
      }
    } catch {
      // Network failure, connection refused, or timeout
      this.markUnreachable()
      return false
    } finally {
      this.isProbing = false
    }

    return false
  }

  private startHeartbeat() {
    if (this.heartbeatTimer || typeof window === 'undefined') return
    // ponytail: 5s continuous heartbeat for fast ~3-5s failure detection
    this.heartbeatTimer = setInterval(() => {
      void this.probeHealth()
    }, 5000)
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
    this.listeners = []
    this.isProbing = false
  }
}

export const connectivityManager = new ConnectivityManager()

