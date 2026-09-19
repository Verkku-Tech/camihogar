import { useCallback, useEffect, useRef } from "react"

/**
 * Evita que un diálogo padre se cierre por error cuando un diálogo anidado
 * se cierra en dispositivos táctiles. Aplica dos mitigaciones:
 *  1. `closeNested`: difiere el cambio de estado un tick para que el evento
 *     táctil termine de procesarse antes de que el child se desmonte.
 *  2. `preventClose`: bloquea el cierre del padre mientras el anidado esté
 *     abierto y por un cooldown adicional (default 400ms) tras su cierre.
 */
export function useNestedModalGuard(
  nestedModalOpen: boolean,
  cooldownMs = 400,
) {
  const lastClosedAtRef = useRef(0)
  const prevOpenRef = useRef(nestedModalOpen)

  useEffect(() => {
    if (prevOpenRef.current && !nestedModalOpen) {
      lastClosedAtRef.current = Date.now()
    }
    prevOpenRef.current = nestedModalOpen
  }, [nestedModalOpen])

  const preventClose = useCallback(
    (e: Event) => {
      const withinCooldown =
        Date.now() - lastClosedAtRef.current < cooldownMs
      if (nestedModalOpen || withinCooldown) e.preventDefault()
    },
    [nestedModalOpen, cooldownMs],
  )

  const closeNested = useCallback((closeFn: () => void) => {
    lastClosedAtRef.current = Date.now()
    setTimeout(closeFn, 0)
  }, [])

  return { preventClose, closeNested }
}
