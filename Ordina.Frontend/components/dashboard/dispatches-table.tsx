"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getUnifiedOrders, type UnifiedOrder } from "@/lib/storage"
import { formatCurrency, formatCurrencyWithUsdPrimaryFromOrder, getActiveExchangeRates } from "@/lib/currency-utils"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function DispatchesTable() {
  const router = useRouter()
  const [dispatches, setDispatches] = useState<UnifiedOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formattedAmounts, setFormattedAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadDispatches = async () => {
      try {
        const allOrders = await getUnifiedOrders()
        // Filtrar solo pedidos completados (status === "Completada")
        const completedOrders = allOrders
          .filter((order) => order.status === "Completada" && order.type === "order")
          // Ordenar por fecha de despacho (más recientes primero)
          .sort((a, b) => {
            const dateA = a.dispatchDate ? new Date(a.dispatchDate).getTime() : 0
            const dateB = b.dispatchDate ? new Date(b.dispatchDate).getTime() : 0
            return dateB - dateA
          })
        setDispatches(completedOrders)
      } catch (error) {
        console.error("Error loading dispatches:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDispatches()
  }, [])

  // Formatear montos en USD cuando cambien los despachos
  useEffect(() => {
    const formatAmounts = async () => {
      if (dispatches.length === 0) {
        setFormattedAmounts({})
        return
      }

      try {
        const formatted: Record<string, string> = {}
        const fallbackRates = await getActiveExchangeRates()
        
        for (const dispatch of dispatches) {
          const formattedAmount = await formatCurrencyWithUsdPrimaryFromOrder(
            dispatch.total,
            dispatch,
            fallbackRates
          )
          formatted[dispatch.id] = formattedAmount
        }
        
        setFormattedAmounts(formatted)
      } catch (error) {
        console.error("Error formatting amounts:", error)
      }
    }
    
    formatAmounts()
  }, [dispatches])

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const handleView = (orderNumber: string) => {
    router.push(`/pedidos/${orderNumber}`)
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
                  <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Total</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Fecha Despacho</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Acciones</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (dispatches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No hay notas de despacho disponibles</p>
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
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Total</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fecha Despacho</TableHead>
                <TableHead className="font-medium text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatches.map((dispatch) => (
                <TableRow key={dispatch.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">
                    {dispatch.orderNumber}
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {dispatch.clientName}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formattedAmounts[dispatch.id] || formatCurrency(dispatch.total, dispatch.baseCurrency || "Bs")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(dispatch.dispatchDate)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(dispatch.orderNumber)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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

