"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { getOrders, getClients, type Order, type Client } from "@/lib/storage"
import { buildOrderSearchValue } from "@/lib/order-client-search"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function clientContactLine(client?: Client): string | null {
  if (!client) return null
  const bits: string[] = []
  if (client.telefono?.trim()) bits.push(client.telefono.trim())
  if (client.rutId?.trim()) bits.push(`CI ${client.rutId.trim()}`)
  return bits.length > 0 ? bits.join(" · ") : null
}

type Preloaded = Order[] | null | undefined

type OrderSearchComboboxProps = {
  /**
   * undefined: carga getOrders + getClients (comportamiento legado).
   * null: el padre aún sincroniza pedidos; no llama a getOrders (solo clientes).
   * Order[]: pedidos ya cargados (p. ej. Dashboard).
   */
  preloadedOrders?: Preloaded
}

export function OrderSearchCombobox({ preloadedOrders }: OrderSearchComboboxProps = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [clientById, setClientById] = useState<Map<string, Client>>(new Map())
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const buildClientMap = (clientList: Client[]) => {
          const map = new Map<string, Client>()
          for (const c of clientList) {
            map.set(c.id, c)
          }
          setClientById(map)
        }
        if (preloadedOrders === null) {
          setOrders([])
          const clientList = await getClients()
          buildClientMap(clientList)
          return
        }
        if (preloadedOrders !== undefined) {
          const sorted = preloadedOrders
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 100)
          setOrders(sorted)
          const clientList = await getClients()
          buildClientMap(clientList)
          return
        }
        const [orderData, clientList] = await Promise.all([getOrders(), getClients()])
        const sorted = orderData.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setOrders(sorted.slice(0, 100))
        buildClientMap(clientList)
      } catch (error) {
        console.error("Error loading orders/clients for search:", error)
      }
    }
    void load()
  }, [preloadedOrders])

  const handleSelect = (orderNumber: string) => {
    setOpen(false)
    setSearchValue("")
    router.push(`/pedidos/${orderNumber}`)
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
              {searchValue ? searchValue : "Buscar orden"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar orden"
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {orders.map((order) => {
                  const client = clientById.get(order.clientId)
                  const searchItemValue = buildOrderSearchValue(order, client)
                  const contact = clientContactLine(client)
                  return (
                    <CommandItem
                      key={order.id}
                      value={searchItemValue}
                      onSelect={() => handleSelect(order.orderNumber)}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {order.orderNumber}
                          <Badge variant="outline" className="h-4 py-0 text-[10px] leading-none">
                            {order.type === "Budget" ? "Presupuesto" : "Pedido"}
                          </Badge>
                        </span>
                        <span className="w-[250px] truncate text-xs text-muted-foreground">
                          {order.clientName}
                          {contact ? ` · ${contact}` : ""}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
