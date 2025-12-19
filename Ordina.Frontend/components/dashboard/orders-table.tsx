"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { getOrders, Order } from "@/lib/storage"
import { formatCurrency } from "@/lib/currency-utils"

interface OrdersTableProps {
  limit?: number
}

export function OrdersTable({ limit = 10 }: OrdersTableProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const allOrders = await getOrders()
        // Ordenar por fecha de creación (más recientes primero) y limitar
        const sortedOrders = allOrders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit)
        setOrders(sortedOrders)
      } catch (error) {
        console.error("Error loading orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [limit])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TableRow key={index}>
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
          <p className="text-center text-muted-foreground">No hay pedidos disponibles</p>
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
                    {formatCurrency(order.subtotal, order.baseCurrency || "Bs")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                  <TableCell className="text-green-600 font-medium">{order.clientName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
