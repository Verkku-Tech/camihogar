import { useState, useEffect, useCallback, useRef } from "react"
import { getOrders, type Order, type GetOrdersOptions } from "@/lib/storage"

interface UseLazyOrdersOptions {
  /** Número de páginas iniciales a cargar (cada una 50 items). Default: 10 */
  initialPages?: number
  /** Si true, fuerza sync completa desde backend */
  forceFullSync?: boolean
  /** Si true, refresca desde backend */
  refreshFromBackend?: boolean
}

interface UseLazyOrdersResult {
  /** Pedidos cargados (inicialmente parciales, eventualmente completos) */
  orders: Order[]
  /** true mientras se carga el lote inicial */
  isLoadingInitial: boolean
  /** true mientras se está cargando el resto en background */
  isLoadingMore: boolean
  /** true cuando todas las páginas han sido cargadas */
  isFullyLoaded: boolean
  /** Recargar todos los pedidos (fuerza sync completa) */
  reload: () => void
}

/**
 * Hook que carga pedidos de forma lazy: primero un lote inicial (~10 páginas = 500 items)
 * y el resto se carga en background sin bloquear la UI.
 */
export function useLazyOrders(options: UseLazyOrdersOptions = {}): UseLazyOrdersResult {
  const { initialPages = 10, forceFullSync, refreshFromBackend } = options

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isFullyLoaded, setIsFullyLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const mountedRef = useRef(true)

  const loadOrders = useCallback(async () => {
    if (!mountedRef.current) return

    setIsLoadingInitial(true)
    setIsLoadingMore(false)
    setIsFullyLoaded(false)

    try {
      const opts: GetOrdersOptions = {
        initialPageLimit: initialPages,
        forceFullSync,
        refreshFromBackend,
      }

      // getOrders con initialPageLimit retorna el lote inicial rápido
      const initialOrders = await getOrders(opts)

      if (!mountedRef.current) return

      setOrders(initialOrders)
      setIsLoadingInitial(false)

      // Verificar si ya tenemos todos (modo offline o pocos datos)
      // Si initialOrders.length < expectedFromPages, probablemente ya tenemos todo
      const expectedMinimum = initialPages * 50 * 0.5 // Al menos 50% de lo esperado
      if (initialOrders.length < expectedMinimum) {
        // Pocos datos, probablemente ya está completo
        setIsFullyLoaded(true)
        setIsLoadingMore(false)
      } else {
        // Podría haber más datos cargándose en background
        setIsLoadingMore(true)

        // Poll para detectar cuando la carga background termine
        // Se verifica si IndexedDB tiene más datos que los iniciales
        const pollForMore = async () => {
          const { getAll } = await import("@/lib/indexeddb")
          let lastCount = initialOrders.length
          let stableCount = 0

          const check = async () => {
            if (!mountedRef.current) return
            try {
              const allOrders = await getAll<Order>("orders")
              const currentCount = allOrders.length

              if (currentCount > lastCount) {
                // Hay más datos disponibles
                setOrders(allOrders)
                lastCount = currentCount
                stableCount = 0
                // Seguir verificando
                setTimeout(check, 1000)
              } else if (stableCount < 3) {
                // Aún no estable, esperar un poco más
                stableCount++
                setTimeout(check, 1500)
              } else {
                // Datos estables, carga completa
                setOrders(allOrders)
                setIsLoadingMore(false)
                setIsFullyLoaded(true)
              }
            } catch {
              setIsLoadingMore(false)
              setIsFullyLoaded(true)
            }
          }

          // Empezar a verificar después de un breve delay
          setTimeout(check, 2000)
        }

        pollForMore()
      }
    } catch (error) {
      console.error("Error loading orders:", error)
      if (mountedRef.current) {
        setIsLoadingInitial(false)
        setIsLoadingMore(false)
      }
    }
  }, [initialPages, forceFullSync, refreshFromBackend, reloadKey])

  useEffect(() => {
    mountedRef.current = true
    loadOrders()
    return () => {
      mountedRef.current = false
    }
  }, [loadOrders])

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1)
  }, [])

  return {
    orders,
    isLoadingInitial,
    isLoadingMore,
    isFullyLoaded,
    reload,
  }
}
