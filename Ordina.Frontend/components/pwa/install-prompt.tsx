"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Verificar si se ha descartado previamente (guardar en localStorage)
    const dismissed = localStorage.getItem("pwa-install-dismissed")
    if (dismissed === "true") {
      setIsDismissed(true)
    }

    // Escuchar evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Escuchar cuando se instala
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      localStorage.removeItem("pwa-install-dismissed")
    })

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        console.log("PWA instalada exitosamente")
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error("Error al instalar PWA:", error)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setDeferredPrompt(null)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  // No mostrar si está instalada o descartada o no hay prompt disponible
  if (isInstalled || isDismissed || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Instalar CamiHogar</h3>
            <p className="text-xs text-muted-foreground">
              Instala la app para acceso rápido y funcionamiento offline
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Instalar
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="outline"
          >
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  )
}

