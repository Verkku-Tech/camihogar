"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { getOrders, getClients, type Order, type Client } from "@/lib/storage"
import { useOnlineSellerVisibility } from "@/hooks/use-online-seller-visibility"
import { buildOrderSearchValue } from "@/lib/order-client-search"
import { textIncludesForSearch } from "@/lib/text-search"
import { isReservationOrder, isReservationType } from "@/lib/order-document-types"
import { apiClient, type OrderSearchResultDto } from "@/lib/api-client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type SearchRow = {
  id: string
  orderNumber: string
  clientName: string
  type: string
  contactLine: string | null
}

function clientContactLine(
  clientPhone?: string | null,
  clientRutId?: string | null,
  client?: Client,
): string | null {
  const bits: string[] = []
  const phone = clientPhone?.trim() || client?.telefono?.trim()
  const phone2 = client?.telefono2?.trim()
  const rut = clientRutId?.trim() || client?.rutId?.trim()
  if (phone) bits.push(phone)
  else if (phone2) bits.push(phone2)
  if (rut) bits.push(`CI ${rut}`)
  return bits.length > 0 ? bits.join(" · ") : null
}

function mapApiRow(row: OrderSearchResultDto): SearchRow {
  return {
    id: row.orderId,
    orderNumber: row.orderNumber,
    clientName: row.clientName,
    type: row.type,
    contactLine: clientContactLine(row.clientPhone, row.clientRutId),
  }
}

function filterOrdersOffline(
  query: string,
  orders: Order[],
  clientById: Map<string, Client>,
  onlineSellerFilter: boolean,
  isTeamOrder: (order: Order) => boolean,
  limit: number,
): SearchRow[] {
  const q = query.trim()
  if (q.length < 2) return []

  const filtered = orders.filter((order) => {
    if (onlineSellerFilter && !isTeamOrder(order)) return false
    const client = clientById.get(order.clientId)
    const haystack = buildOrderSearchValue(order, client)
    return textIncludesForSearch(haystack, q)
  })

  return filtered
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit)
    .map((order) => {
      const client = clientById.get(order.clientId)
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        type: order.type === "Budget"
          ? "Budget"
          : isReservationOrder(order)
            ? "Reservation"
            : "Order",
        contactLine: clientContactLine(undefined, undefined, client),
      }
    })
}

export function OrderSearchCombobox() {
  const router = useRouter()
  const { applies: onlineSellerFilter, isTeamOrder } = useOnlineSellerVisibility()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SearchRow[]>([])
  const [searchValue, setSearchValue] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offlineCacheRef = useRef<{
    orders: Order[]
    clientById: Map<string, Client>
  } | null>(null)

  const isBrowserOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true

  const runSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim()
      if (trimmed.length < 2) {
        setRows([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        if (isBrowserOnline) {
          const results = await apiClient.searchOrders(trimmed, 20)
          setRows(results.map(mapApiRow))
          return
        }

        if (!offlineCacheRef.current) {
          const [orderData, clientList] = await Promise.all([
            getOrders(),
            getClients(),
          ])
          const clientById = new Map<string, Client>()
          for (const c of clientList) {
            clientById.set(c.id, c)
          }
          offlineCacheRef.current = { orders: orderData, clientById }
        }

        const { orders, clientById } = offlineCacheRef.current
        setRows(
          filterOrdersOffline(
            trimmed,
            orders,
            clientById,
            onlineSellerFilter,
            isTeamOrder,
            20,
          ),
        )
      } catch (error) {
        console.error("Error searching orders:", error)
        setRows([])
      } finally {
        setIsSearching(false)
      }
    },
    [isBrowserOnline, onlineSellerFilter, isTeamOrder],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (searchValue.trim().length < 2) {
      setRows([])
      setIsSearching(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(searchValue)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchValue, runSearch])

  const handleSelect = (orderNumber: string) => {
    setOpen(false)
    setSearchValue("")
    setRows([])
    router.push(`/pedidos/${orderNumber}`)
  }

  const typeBadge = (type: string) => {
    if (type === "Budget") return "Presupuesto"
    if (type === "Reservation" || type === "PendingConfirmation") return "Reserva"
    return "Pedido"
  }

  return (
    <div className="relative hidden sm:block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-64 justify-start gap-2 px-3 font-normal text-muted-foreground"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">
              {searchValue ? searchValue : "Buscar orden o reserva"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar orden o reserva"
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </div>
              ) : searchValue.trim().length < 2 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Escribe al menos 2 caracteres
                </div>
              ) : rows.length === 0 ? (
                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {rows.map((row) => (
                    <CommandItem
                      key={row.id}
                      value={row.orderNumber}
                      onSelect={() => handleSelect(row.orderNumber)}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {row.orderNumber}
                          <Badge
                            variant="outline"
                            className="h-4 py-0 text-[10px] leading-none"
                          >
                            {typeBadge(row.type)}
                          </Badge>
                        </span>
                        <span className="w-[250px] truncate text-xs text-muted-foreground">
                          {row.clientName}
                          {row.contactLine ? ` · ${row.contactLine}` : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
