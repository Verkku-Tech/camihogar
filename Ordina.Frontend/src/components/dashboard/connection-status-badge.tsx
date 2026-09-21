// ponytail: compact connectivity and outbox sync indicator
import { useState, useEffect } from 'react'
import { connectivityManager, ConnectionStatus } from '@/lib/connectivity'
import { syncManager } from '@/lib/sync-manager'
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConnectionStatusBadge() {
  const [status, setStatus] = useState<ConnectionStatus>(connectivityManager.getStatus())
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isManualSyncing, setIsManualSyncing] = useState(false)

  const updateState = async () => {
    setStatus(connectivityManager.getStatus())
    const count = await syncManager.getPendingCount()
    setPendingCount(count)
  }

  useEffect(() => {
    updateState()
    const unsubConn = connectivityManager.subscribe(() => updateState())
    const unsubSync = syncManager.subscribe(() => updateState())

    return () => {
      unsubConn()
      unsubSync()
    }
  }, [])

  const handleManualSync = async () => {
    if (isManualSyncing) return
    setIsManualSyncing(true)
    try {
      await connectivityManager.probeHealth()
      await syncManager.drainOutbox()
      await updateState()
    } finally {
      setIsManualSyncing(false)
    }
  }

  if (status === 'syncing' || isManualSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse"
        title="Sincronizando operaciones con el servidor..."
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Sincronizando...</span>
        {pendingCount > 0 && <span className="text-[10px] font-semibold bg-blue-500/20 px-1 rounded">{pendingCount}</span>}
      </div>
    )
  }

  if (status === 'unreachable') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20"
        title="Modo local activo. Las operaciones se guardan en IndexedDB y se sincronizarán al reconectar."
      >
        <CloudOff className="w-3.5 h-3.5" />
        <span className="font-medium">Modo local</span>
        {pendingCount > 0 && (
          <span className="text-[10px] font-semibold bg-amber-500/20 px-1 rounded" title={`${pendingCount} operaciones pendientes`}>
            {pendingCount}
          </span>
        )}
      </div>
    )
  }

  // Connected status
  return (
    <div className="flex items-center gap-1.5">
      {pendingCount > 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          className="h-7 px-2 text-xs flex items-center gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
          title="Hay operaciones pendientes de sincronización. Clic para sincronizar."
        >
          <RefreshCw className={`w-3 h-3 ${isManualSyncing ? "animate-spin" : ""}`} />
          <span>{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
        </Button>

      ) : (
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="En línea. Conectado al servidor."
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden md:inline text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">En línea</span>
        </div>
      )}
    </div>
  )
}
