"use client"

import { useEffect, useState } from "react"

export function RegisterServiceWorker() {
  const [isOnline, setIsOnline] = useState(true)
  const [swRegistered, setSwRegistered] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      console.warn("⚠️ Service Workers no soportados en este navegador")
      return
    }

    // Detectar estado de conexión
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      console.log("🌐 Conexión restaurada")
      // Notificar al SyncManager para que sincronice
      window.dispatchEvent(new Event("online"))
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log("🔴 Sin conexión - Modo offline activado")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Registrar Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })

        setSwRegistered(true)
        console.log("✅ Service Worker registrado:", registration.scope)

        // Escuchar mensajes del Service Worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "ADD_TO_SYNC_QUEUE") {
            // El SW quiere agregar algo a la cola de sincronización
            handleAddToSyncQueue(event.data.data)
          } else if (event.data && event.data.type === "SYNC_PENDING_REQUESTS") {
            // El SW quiere sincronizar peticiones pendientes
            handleSyncPendingRequests()
          }
        })

        // Escuchar actualizaciones del SW
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("🔄 Nueva versión del Service Worker disponible")
                // Opcional: mostrar notificación al usuario para recargar
              }
            })
          }
        })

        // Verificar actualizaciones periódicamente
        setInterval(() => {
          registration.update()
        }, 60000) // Cada minuto

        // Si hay una actualización pendiente, activarla
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" })
        }
      } catch (error) {
        console.error("❌ Error registrando Service Worker:", error)
      }
    }

    // Esperar a que la página cargue completamente
    if (document.readyState === "complete") {
      registerSW()
    } else {
      window.addEventListener("load", registerSW)
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Manejar agregar a cola de sincronización desde el SW
  const handleAddToSyncQueue = async (requestData: any) => {
    try {
      // Importar dinámicamente para evitar problemas de SSR
      const { syncManager } = await import("@/lib/sync-manager")
      
      // Determinar el tipo de entidad basado en la URL
      let entity: "user" | "order" | "product" | "client" | "provider" | "store" = "user"
      if (requestData.url.includes("/orders")) entity = "order"
      else if (requestData.url.includes("/products")) entity = "product"
      else if (requestData.url.includes("/clients")) entity = "client"
      else if (requestData.url.includes("/providers")) entity = "provider"
      else if (requestData.url.includes("/stores")) entity = "store"

      // Determinar el tipo de operación
      let type: "create" | "update" | "delete" = "create"
      if (requestData.method === "PUT" || requestData.method === "PATCH") type = "update"
      else if (requestData.method === "DELETE") type = "delete"

      await syncManager.addToQueue({
        type,
        entity,
        entityId: "",
        data: requestData,
      })
    } catch (error) {
      console.error("Error agregando a cola desde SW:", error)
    }
  }

  // Manejar sincronización de peticiones pendientes
  const handleSyncPendingRequests = async () => {
    try {
      const { syncManager } = await import("@/lib/sync-manager")
      await syncManager.syncPendingOperations()
    } catch (error) {
      console.error("Error sincronizando desde SW:", error)
    }
  }

  return null // Este componente no renderiza nada
}

