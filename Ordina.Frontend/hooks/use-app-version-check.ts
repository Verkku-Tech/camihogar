"use client"

import { useEffect, useRef } from "react"
import { APP_UI_VERSION } from "@/lib/app-version"
import { notifyVersionMismatch } from "@/lib/pwa-update"

type VersionJson = {
  version?: string
}

/**
 * Compara la versión embebida en el bundle con /version.json del servidor.
 * Si difieren, dispara el flujo de actualización (banner + recarga diferida).
 */
export function useAppVersionCheck(onMismatch: () => void): void {
  const onMismatchRef = useRef(onMismatch)
  onMismatchRef.current = onMismatch

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.onLine) return
    if (APP_UI_VERSION === "dev") return

    let cancelled = false

    const check = async () => {
      try {
        const response = await fetch("/version.json", { cache: "no-store" })
        if (!response.ok) return

        const data = (await response.json()) as VersionJson
        const serverVersion = data.version?.trim()
        if (!serverVersion || cancelled) return

        if (serverVersion !== APP_UI_VERSION) {
          notifyVersionMismatch()
          onMismatchRef.current()
        }
      } catch {
        // Sin red o version.json ausente en dev: ignorar
      }
    }

    void check()

    const onFocus = () => {
      void check()
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
    }
  }, [])
}
