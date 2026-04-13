"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getOrders, Order } from "@/lib/storage"
import { formatCurrency, formatCurrencyWithUsdPrimaryFromOrder, getActiveExchangeRates } from "@/lib/currency-utils"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface OrdersTableProps {
  limit?: number
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Validado":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
    case "Por Fabricar":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "En Fabricación":
    case "Fabricación":
    case "Fabricándose":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Almacén":
    case "En Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Despacho":
    case "Por despachar":
    case "En Ruta":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Entregado":
    case "Completada":
    case "Completado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Declinado":
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    case "Generado":
    case "Generada":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

function filterAndSortGeneratedOrders(allOrders: Order[], limit: number) {
  return allOrders
    .filter((o) => o.status === "Generado" || o.status === "Generada")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function OrdersTable({ limit = 10 }: OrdersTableProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formattedAmounts, setFormattedAmounts] = useState<Record<string, string>>({})
  const [validatingIds, setValidatingIds] = useState<Set<string>>(new Set())

  const reloadGeneratedOrders = useCallback(async () => {
    const allOrders = await getOrders()
    setOrders(filterAndSortGeneratedOrders(allOrders, limit))
  }, [limit])

  useEffect(() => {
    const loadOrders = async () => {
      try {
        await reloadGeneratedOrders()
      } catch (error) {
        console.error("Error loading orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [reloadGeneratedOrders])

  useEffect(() => {
    const formatAmounts = async () => {
      if (orders.length === 0) {
        setFormattedAmounts({})
        return
      }

      try {
        const formatted: Record<string, string> = {}
        const fallbackRates = await getActiveExchangeRates()

        for (const order of orders) {
          const formattedAmount = await formatCurrencyWithUsdPrimaryFromOrder(
            order.subtotal,
            order,
            fallbackRates
          )
          formatted[order.id] = formattedAmount
        }

        setFormattedAmounts(formatted)
      } catch (error) {
        console.error("Error formatting amounts:", error)
      }
    }

    formatAmounts()
  }, [orders])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const handleValidate = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation()
    const productsToValidate = order.products.filter(
      (p) => !p.logisticStatus || p.logisticStatus === "Generado"
    )
    if (productsToValidate.length === 0) {
      toast.info("Todos los productos ya están validados.")
      return
    }

    setValidatingIds((prev) => new Set(prev).add(order.id))
    try {
      for (const p of productsToValidate) {
        await apiClient.validateOrderItem(order.id, p.id)
      }
      await reloadGeneratedOrders()
      toast.success("Pedido validado exitosamente")
    } catch (error) {
      console.error("Error validando pedido:", error)
      toast.error("Error al validar el pedido")
    } finally {
      setValidatingIds((prev) => {
        const next = new Set(prev)
        next.delete(order.id)
        return next
      })
    }
  }

  const isGenerated = (order: Order) =>
    order.status === "Generado" || order.status === "Generada"

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Subtotal</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                  <TableHead className="font-medium text-muted-foreground text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TableRow key={index}>
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No hay pedidos pendientes de validación
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                <TableHead className="font-medium text-muted-foreground">Subtotal</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/pedidos/${order.orderNumber}`)}
                >
                  <TableCell className="font-medium text-green-600">{order.orderNumber}</TableCell>
                  <TableCell className="font-medium">
                    {formattedAmounts[order.id] || formatCurrency(order.subtotal, order.baseCurrency || "Bs")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-green-600 font-medium">{order.clientName}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {isGenerated(order) ? (
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={validatingIds.has(order.id)}
                        onClick={(e) => handleValidate(order, e)}
                      >
                        {validatingIds.has(order.id) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Validar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
