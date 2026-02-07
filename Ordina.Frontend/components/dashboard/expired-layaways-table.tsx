"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getExpiredLayaways, type Order } from "@/lib/storage"
import { formatCurrency, formatCurrencyWithUsdPrimaryFromOrder, getActiveExchangeRates } from "@/lib/currency-utils"
import { Eye, Download, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type ExpiredLayawayOrder = Order & { daysExpired: number; pendingAmount: number }

export function ExpiredLayawaysTable() {
  const router = useRouter()
  const [expiredLayaways, setExpiredLayaways] = useState<ExpiredLayawayOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formattedAmounts, setFormattedAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadExpiredLayaways = async () => {
      try {
        const expired = await getExpiredLayaways()
        setExpiredLayaways(expired)
      } catch (error) {
        console.error("Error loading expired layaways:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExpiredLayaways()
  }, [])

  // Formatear montos en USD cuando cambien los apartados vencidos
  useEffect(() => {
    const formatAmounts = async () => {
      if (expiredLayaways.length === 0) {
        setFormattedAmounts({})
        return
      }

      try {
        const formatted: Record<string, string> = {}
        const fallbackRates = await getActiveExchangeRates()
        
        for (const order of expiredLayaways) {
          const formattedAmount = await formatCurrencyWithUsdPrimaryFromOrder(
            order.pendingAmount,
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
  }, [expiredLayaways])

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

  const exportToCSV = () => {
    const headers = [
      "Pedido",
      "Cliente",
      "Total Pedido",
      "Monto Cobrado",
      "Deuda Pendiente",
      "Fecha Creación",
      "Días Vencidos",
      "Estado"
    ]

    const rows = expiredLayaways.map(order => {
      const paidAmount = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const totalFormatted = `${formatCurrency(order.total, order.baseCurrency || "Bs")}`
      const paidFormatted = `${formatCurrency(paidAmount, order.baseCurrency || "Bs")}`
      const pendingFormatted = `${formatCurrency(order.pendingAmount, order.baseCurrency || "Bs")}`
      
      return [
        order.orderNumber,
        order.clientName,
        totalFormatted,
        paidFormatted,
        pendingFormatted,
        formatDate(order.createdAt),
        order.daysExpired.toString(),
        order.status
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `SA_Vencidos_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getDaysExpiredBadge = (days: number) => {
    if (days >= 90) {
      return <Badge className="bg-red-500 text-white">+{days} días</Badge>
    } else if (days >= 60) {
      return <Badge className="bg-orange-500 text-white">{days} días</Badge>
    } else {
      return <Badge className="bg-yellow-500 text-white">{days} días</Badge>
    }
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
                  <TableHead className="font-medium text-muted-foreground">Deuda Pendiente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Días Vencidos</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
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

  if (expiredLayaways.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No hay Sistemas de Apartado vencidos</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold">Sistemas de Apartado Vencidos ({expiredLayaways.length})</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Deuda Pendiente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                <TableHead className="font-medium text-muted-foreground">Días Vencidos</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiredLayaways.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {order.clientName}
                  </TableCell>
                  <TableCell className="font-medium text-red-600">
                    {formattedAmounts[order.id] || formatCurrency(order.pendingAmount, order.baseCurrency || "Bs")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    {getDaysExpiredBadge(order.daysExpired)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{order.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(order.orderNumber)}
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

