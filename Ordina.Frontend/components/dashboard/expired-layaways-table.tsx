"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { type Order } from "@/lib/storage"
import {
  getActivePaymentsList,
  getOrderPendingTotal,
  PAYMENT_BALANCE_EPSILON_BS,
  PAYMENT_BALANCE_EPSILON_USD,
} from "@/lib/order-payments"
import { isUsdBaseOrder } from "@/lib/order-line-pricing"
import { SA_LAYAWAY_DAYS, getDaysSinceOrder, getLayawayDaysPastWindow } from "@/lib/order-sa"
import { formatCurrency, getActiveExchangeRates } from "@/lib/currency-utils"
import {
  commercialRatesToExchangeRatesInput,
  formatOrderAmountForDisplay,
} from "@/lib/order-currency-display"
import { Eye, Download, AlertTriangle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

type ExpiredLayawayOrder = Order & { daysExpired: number; pendingAmount: number }

interface ExpiredLayawaysTableProps {
  prefetchedOrders?: Order[] | null
}

const DEFAULT_ITEMS_PER_PAGE = 10

export function ExpiredLayawaysTable({ prefetchedOrders }: ExpiredLayawaysTableProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(!prefetchedOrders)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [formattedAmounts, setFormattedAmounts] = useState<Record<string, string>>({})
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

  const expiredLayaways = useMemo(() => {
    const orders = prefetchedOrders ?? []
    const now = new Date()
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

    return orders
      .filter((order) => {
        if (order.type && order.type.toLowerCase() !== "order") return false
        if (order.saleType !== "sistema_apartado") return false
        const status = (order.status as string) || ""
        if (
          status === "Cancelado" ||
          status === "Declinado" ||
          status === "Entregado" ||
          status === "Completado" ||
          status === "Completada"
        ) {
          return false
        }
        const pendingAmount = getOrderPendingTotal(order)
        const epsilon = isUsdBaseOrder(order)
          ? PAYMENT_BALANCE_EPSILON_USD
          : PAYMENT_BALANCE_EPSILON_BS
        if (pendingAmount <= epsilon) return false

        const orderTime = new Date(order.createdAt).getTime()
        return now.getTime() - orderTime >= ninetyDaysMs
      })
      .map((order) => {
        const orderTime = new Date(order.createdAt).getTime()
        const exactDays = (now.getTime() - orderTime) / (1000 * 60 * 60 * 24)
        const daysPast = Math.max(1, Math.ceil(exactDays - 90))
        return {
          ...order,
          daysExpired: daysPast,
          pendingAmount: getOrderPendingTotal(order),
        }
      })
      .sort((a, b) => b.daysExpired - a.daysExpired)
  }, [prefetchedOrders])

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedExpiredLayaways,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({ data: expiredLayaways, itemsPerPage })

  useEffect(() => {
    if (prefetchedOrders !== undefined) {
      setIsLoading(false)
    }
  }, [prefetchedOrders])

  // Formatear montos en USD cuando cambien los apartados vencidos
  useEffect(() => {
    const formatAmounts = async () => {
      if (expiredLayaways.length === 0) {
        setFormattedAmounts({})
        return
      }

      try {
        const rates = await getActiveExchangeRates()
        const live = commercialRatesToExchangeRatesInput({
          USD: rates.USD,
          EUR: rates.EUR,
        })
        const formatted: Record<string, string> = {}

        for (const order of expiredLayaways) {
          formatted[order.id] = formatOrderAmountForDisplay(
            order.pendingAmount,
            order,
            live,
          )
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

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true)
    const toastId = toast.loading("Generando reporte Excel...")
    try {
      const blob = await apiClient.downloadExpiredLayawaysReportExcel()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `SA_Vencidos_${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      toast.success("Reporte Excel descargado exitosamente", { id: toastId })
    } catch (error) {
      console.error("Error downloading expired layaways excel report:", error)
      toast.error("Error al generar el reporte Excel", { id: toastId })
    } finally {
      setIsExportingExcel(false)
    }
  }

  /** `days` = días de mora después de los 90 días de plazo (mismo valor que en métricas). */
  const getDaysExpiredBadge = (days: number) => {
    if (days >= 60) {
      return <Badge className="bg-red-500 text-white">+{days} días</Badge>
    } else if (days >= 30) {
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
                  <TableHead className="font-medium text-muted-foreground">Días vencidos (post 90 d)</TableHead>
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
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="gap-2"
          >
            {isExportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
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
                <TableHead className="font-medium text-muted-foreground">Días vencidos (post 90 d)</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="font-medium text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpiredLayaways.map((order) => (
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
        <div className="border-t px-4 py-3">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={goToPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </CardContent>
    </Card>
  )
}

