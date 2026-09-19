"use client"

import { useEffect } from "react"
import { registerForUpdates } from "@/lib/pwa-update"

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      console.warn("Service Workers no soportados en este navegador")
      return
    }

    const handleOnline = () => {
      window.dispatchEvent(new Event("online"))
    }

    const handleOffline = () => {
      console.log("Sin conexión - Modo offline activado")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const handleAddToSyncQueue = async (requestData: {
      url: string
      method: string
    }) => {
      try {
        const { syncManager } = await import("@/lib/sync-manager")

        let entity:
          | "user"
          | "order"
          | "product"
          | "client"
          | "provider"
          | "store" = "user"
        if (requestData.url.includes("/orders")) entity = "order"
        else if (requestData.url.includes("/products")) entity = "product"
        else if (requestData.url.includes("/clients")) entity = "client"
        else if (requestData.url.includes("/providers")) entity = "provider"
        else if (requestData.url.includes("/stores")) entity = "store"

        let type: "create" | "update" | "delete" = "create"
        if (requestData.method === "PUT" || requestData.method === "PATCH")
          type = "update"
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

    const handleSyncPendingRequests = async () => {
      try {
        const { syncManager } = await import("@/lib/sync-manager")
        await syncManager.syncPendingOperations()
      } catch (error) {
        console.error("Error sincronizando desde SW:", error)
      }
    }

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "ADD_TO_SYNC_QUEUE") {
        void handleAddToSyncQueue(event.data.data)
      } else if (event.data?.type === "SYNC_PENDING_REQUESTS") {
        void handleSyncPendingRequests()
      }
    }

    navigator.serviceWorker.addEventListener("message", onSwMessage)

    void registerForUpdates().then((registration) => {
      if (registration) {
        console.log("Service Worker registrado:", registration.scope)
      }
    })

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      navigator.serviceWorker.removeEventListener("message", onSwMessage)
    }
  }, [])

  return null
}
