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
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    const checkInstalled = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      const isInStandalone = (window.navigator as any).standalone === true
      return standalone || isInStandalone
    }

    if (checkInstalled()) {
      setIsInstalled(true)
      return
    }

    // Verificar si se ha descartado previamente
    const dismissed = localStorage.getItem("pwa-install-dismissed")
    if (dismissed === "true") {
      setIsDismissed(true)
    }

    // Escuchar evento beforeinstallprompt (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      console.log("✅ beforeinstallprompt event captured")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Escuchar cuando se instala
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      localStorage.removeItem("pwa-install-dismissed")
      console.log("✅ PWA instalada")
    })

    // Fallback: Mostrar instrucciones después de un tiempo si no hay prompt
    // (útil para iOS Safari u otros navegadores)
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !isInstalled && !isDismissed) {
        // Solo mostrar fallback en iOS o si es un navegador móvil
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        if (isIOS || isMobile) {
          setShowFallback(true)
        }
      }
    }, 3000)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      clearTimeout(fallbackTimer)
    }
  }, [deferredPrompt, isInstalled, isDismissed])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        console.log("✅ PWA instalada exitosamente")
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error("❌ Error al instalar PWA:", error)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setDeferredPrompt(null)
    setShowFallback(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  // No mostrar si está instalada o descartada
  if (isInstalled || isDismissed) {
    return null
  }

  // Si hay prompt disponible, mostrar botón de instalación
  if (deferredPrompt) {

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

  // Fallback para iOS/Safari (mostrar instrucciones manuales)
  if (showFallback) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Instalar CamiHogar</h3>
              <p className="text-xs text-muted-foreground">
                {isIOS
                  ? "Toca el botón Compartir y luego 'Añadir a pantalla de inicio'"
                  : "Busca el botón de instalación en la barra de direcciones"}
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
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Entendido
          </Button>
        </div>
      </div>
    )
  }

  return null
}

