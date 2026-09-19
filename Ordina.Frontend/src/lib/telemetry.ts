import { getDb, TelemetryLog } from './db'

class TelemetryService {
  private isFlushing = false
  private flushTimer: any = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flush())
      this.flushTimer = setInterval(() => this.flush(), 30000)

      // Catch global errors
      window.addEventListener('error', (event) => {
        this.log('error', event.message, event.error?.stack, { filename: event.filename, lineno: event.lineno })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.log('error', `Unhandled Promise Rejection: ${event.reason}`, event.reason?.stack)
      })
    }
  }

  async log(level: TelemetryLog['level'], message: string, stack?: string, extra?: Record<string, any>, mutationId?: string) {
    const entry: TelemetryLog = {
      level,
      message,
      stack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      mutationId,
      timestamp: new Date().toISOString(),
      extra
    }

    try {
      const db = await getDb()
      await db.add('telemetry_buffer', entry)
    } catch (err) {
      console.warn('Could not buffer telemetry log:', err)
    }

    if (navigator.onLine && (level === 'error' || level === 'critical')) {
      this.flush().catch(() => {})
    }
  }

  async flush() {
    if (this.isFlushing || !navigator.onLine) return
    this.isFlushing = true

    try {
      const db = await getDb()
      const logs = await db.getAll('telemetry_buffer')
      if (!logs || logs.length === 0) {
        this.isFlushing = false
        return
      }

      // Batch send up to 50 logs
      const batch = logs.slice(0, 50)
      const res = await fetch('/api/telemetry/client-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ logs: batch })
      })

      if (res.ok || res.status === 202) {
        // Delete sent logs
        const tx = db.transaction('telemetry_buffer', 'readwrite')
        for (const item of batch) {
          if (item.id !== undefined) {
            await tx.store.delete(item.id)
          }
        }
        await tx.done
      }
    } catch (err) {
      // Offline or network error; logs remain in IndexedDB
    } finally {
      this.isFlushing = false
    }
  }
}

export const telemetry = new TelemetryService()
