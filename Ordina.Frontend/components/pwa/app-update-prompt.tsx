"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"
import {
  applyUpdate,
  AUTO_RELOAD_MS,
  getWaitingServiceWorker,
  subscribePwaUpdate,
} from "@/lib/pwa-update"
import { useAppVersionCheck } from "@/hooks/use-app-version-check"

export function AppUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const autoReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAutoReloadTimer = useCallback(() => {
    if (autoReloadTimerRef.current) {
      clearTimeout(autoReloadTimerRef.current)
      autoReloadTimerRef.current = null
    }
  }, [])

  const scheduleAutoReload = useCallback(() => {
    clearAutoReloadTimer()
    autoReloadTimerRef.current = setTimeout(() => {
      applyUpdate()
    }, AUTO_RELOAD_MS)
  }, [clearAutoReloadTimer])

  const handleUpdateNow = useCallback(() => {
    clearAutoReloadTimer()
    applyUpdate()
  }, [clearAutoReloadTimer])

  const handlePostpone = useCallback(() => {
    scheduleAutoReload()
  }, [scheduleAutoReload])

  useEffect(() => {
    const unsubscribe = subscribePwaUpdate(() => {
      setUpdateAvailable(true)
      scheduleAutoReload()
    })

    if (getWaitingServiceWorker()) {
      setUpdateAvailable(true)
      scheduleAutoReload()
    }

    return () => {
      unsubscribe()
      clearAutoReloadTimer()
    }
  }, [scheduleAutoReload, clearAutoReloadTimer])

  useAppVersionCheck(() => {
    setUpdateAvailable(true)
    scheduleAutoReload()
  })

  if (!updateAvailable) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-lg sm:left-auto sm:right-4">
      <div className="bg-card border border-primary/30 rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">
              Nueva versión disponible
            </h3>
            <p className="text-xs text-muted-foreground">
              Hay una actualización de CamiHogar. Actualiza para ver los últimos
              cambios. Si no haces nada, la app se actualizará sola en unos
              minutos.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePostpone}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Posponer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleUpdateNow}
            size="sm"
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar ahora
          </Button>
          <Button onClick={handlePostpone} size="sm" variant="outline">
            Más tarde
          </Button>
        </div>
      </div>
    </div>
  )
}
