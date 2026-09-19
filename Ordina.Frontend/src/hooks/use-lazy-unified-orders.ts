import { useState, useEffect, useCallback, useRef } from "react"
import { getUnifiedOrders, type UnifiedOrder, type GetOrdersOptions } from "@/lib/storage"

interface UseLazyUnifiedOrdersOptions {
  /** Número de páginas iniciales a cargar (cada una 50 items). Default: 10 */
  initialPages?: number
  /** Si true, fuerza sync completa desde backend */
  forceFullSync?: boolean
  /** Si true, refresca desde backend */
  refreshFromBackend?: boolean
}

interface UseLazyUnifiedOrdersResult {
  /** Pedidos unificados cargados (inicialmente parciales, eventualmente completos) */
  orders: UnifiedOrder[]
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
 * Hook que carga pedidos unificados de forma lazy: primero un lote inicial (~10 páginas = 500 items)
 * y el resto se carga en background sin bloquear la UI.
 *
 * Online: Usa API paginada. El callback onBackgroundComplete notifica cuando termina.
 * Offline: IndexedDB como fallback.
 */
export function useLazyUnifiedOrders(options: UseLazyUnifiedOrdersOptions = {}): UseLazyUnifiedOrdersResult {
  const { initialPages = 10, forceFullSync, refreshFromBackend } = options

  const [orders, setOrders] = useState<UnifiedOrder[]>([])
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
        // Callback que se llama cuando la carga background de órdenes termina
        onBackgroundComplete: async () => {
          if (!mountedRef.current) return
          // Con los inflight guards, getOrders() y getBudgets() retornan
          // sus promesas ya resueltas → reutiliza datos sin re-fetchear API
          const finalOrders = await getUnifiedOrders()
          setOrders(finalOrders)
          setIsLoadingMore(false)
          setIsFullyLoaded(true)
        },
      }

      // getUnifiedOrders con initialPageLimit retorna el lote inicial rápido
      const initialOrders = await getUnifiedOrders(opts)

      if (!mountedRef.current) return

      setOrders(initialOrders)
      setIsLoadingInitial(false)

      // Verificar si ya tenemos todos (modo offline o pocos datos)
      const expectedMinimum = initialPages * 50 * 0.5
      if (initialOrders.length < expectedMinimum) {
        setIsFullyLoaded(true)
        setIsLoadingMore(false)
      } else {
        // Podría haber más datos cargándose en background via API
        // El callback onBackgroundComplete se encargará de actualizar
        setIsLoadingMore(true)
      }
    } catch (error) {
      console.error("Error loading unified orders:", error)
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
