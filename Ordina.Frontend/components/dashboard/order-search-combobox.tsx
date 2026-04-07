"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { getOrders, type Order } from "@/lib/storage"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function OrderSearchCombobox() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    // Cargar los pedidos al inicializar para el autocompletado
    const loadOrders = async () => {
      try {
        const data = await getOrders()
        // Limitar a los 100 más recientes para no sobrecargar el dom
        const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setOrders(sorted.slice(0, 100))
      } catch (error) {
        console.error("Error loading orders for search:", error)
      }
    }
    loadOrders()
  }, [])

  const handleSelect = (orderNumber: string) => {
    setOpen(false)
    setSearchValue("")
    router.push(`/dashboard/pedidos/${orderNumber}`)
  }

  return (
    <div className="relative hidden sm:block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-64 justify-start text-muted-foreground font-normal relative h-10 px-3 pl-10"
          >
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchValue ? searchValue : "Buscar orden..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar por número o cliente..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {orders.map((order) => (
                  <CommandItem
                    key={order.id}
                    value={`${order.orderNumber} ${order.clientName}`}
                    onSelect={() => handleSelect(order.orderNumber)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm flex items-center gap-2">
                        {order.orderNumber}
                        <Badge variant="outline" className="text-[10px] h-4 leading-none py-0">
                          {order.type === "Budget" ? "Presupuesto" : "Pedido"}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-[250px]">
                        {order.clientName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
