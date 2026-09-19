"use client"

import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"
import { filterClientsLocal } from "@/lib/order-client-search"
import { getClients } from "@/lib/storage"

const CLIENT_SEARCH_PAGE_SIZE = 100

export type UseClientSearchIdsResult = {
  /** null = sin filtro de cliente; Set vacío = búsqueda sin coincidencias */
  matchingClientIds: Set<string> | null
  isLoading: boolean
  isTruncated: boolean
  totalCount: number
}

export function useClientSearchIds(
  searchTerm: string,
  debounceMs = 400,
): UseClientSearchIdsResult {
  const [matchingClientIds, setMatchingClientIds] =
    useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed) {
      setMatchingClientIds(null)
      setIsLoading(false)
      setIsTruncated(false)
      setTotalCount(0)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading(true)
        try {
          const online =
            typeof navigator !== "undefined" ? navigator.onLine : true

          if (!online) {
            const cached = await getClients()
            const matched = filterClientsLocal(cached, trimmed)
            if (cancelled) return
            setMatchingClientIds(new Set(matched.map((c) => c.id)))
            setTotalCount(matched.length)
            setIsTruncated(false)
            return
          }

          const result = await apiClient.getClientsPaged(
            1,
            CLIENT_SEARCH_PAGE_SIZE,
            trimmed,
          )
          if (cancelled) return
          const ids = new Set((result.items ?? []).map((c) => c.id))
          setMatchingClientIds(ids)
          setTotalCount(result.totalCount ?? ids.size)
          setIsTruncated((result.totalCount ?? 0) > CLIENT_SEARCH_PAGE_SIZE)
        } catch (error) {
          console.error("Error buscando clientes:", error)
          if (!cancelled) {
            setMatchingClientIds(new Set())
            setTotalCount(0)
            setIsTruncated(false)
          }
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      })()
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm, debounceMs])

  return { matchingClientIds, isLoading, isTruncated, totalCount }
}
