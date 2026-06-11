"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getUnifiedOrders,
  isDispatchNoteOrder,
  getOrderDispatchDisplayDate,
  type UnifiedOrder,
} from "@/lib/storage"
import { isSistemaApartado } from "@/lib/order-sa"
import { formatCurrency, getActiveExchangeRates } from "@/lib/currency-utils"
import {
  commercialRatesToExchangeRatesInput,
  formatOrderAmountForDisplay,
} from "@/lib/order-currency-display"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { usePagination } from "@/hooks/use-pagination"
import { TablePagination } from "@/components/ui/table-pagination"

const DEFAULT_ITEMS_PER_PAGE = 10

function sortDispatchOrders(orders: UnifiedOrder[]): UnifiedOrder[] {
  return [...orders].sort((a, b) => {
    const dateA = getOrderDispatchDisplayDate(a)?.getTime() ?? 0
    const dateB = getOrderDispatchDisplayDate(b)?.getTime() ?? 0
    return dateB - dateA
  })
}

export function DispatchesTable() {
  const router = useRouter()
  const [dispatches, setDispatches] = useState<UnifiedOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formattedAmounts, setFormattedAmounts] = useState<Record<string, string>>({})
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

  useEffect(() => {
    const loadDispatches = async () => {
      try {
        const allOrders = await getUnifiedOrders()
        const completedOrders = sortDispatchOrders(
          allOrders.filter((order) => isDispatchNoteOrder(order)),
        )
        setDispatches(completedOrders)
      } catch (error) {
        console.error("Error loading dispatches:", error)
      } finally {
        setIsLoading(false)
      }
    }

    void loadDispatches()
  }, [])

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedDispatches,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({ data: dispatches, itemsPerPage })

  const pageIds = useMemo(
    () => paginatedDispatches.map((d) => d.id).join("|"),
    [paginatedDispatches],
  )

  useEffect(() => {
    const formatAmounts = async () => {
      if (paginatedDispatches.length === 0) {
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

        for (const dispatch of paginatedDispatches) {
          formatted[dispatch.id] = formatOrderAmountForDisplay(
            dispatch.total,
            dispatch,
            live,
          )
        }

        setFormattedAmounts(formatted)
      } catch (error) {
        console.error("Error formatting amounts:", error)
      }
    }

    void formatAmounts()
  }, [pageIds, paginatedDispatches])

  const formatDate = (order: UnifiedOrder) => {
    const date = getOrderDispatchDisplayDate(order)
    if (!date) return "N/A"
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
              {paginatedDispatches.map((dispatch) => (
                <TableRow key={dispatch.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{dispatch.orderNumber}</span>
                      {isSistemaApartado(dispatch) && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-600/50 text-amber-900 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-500/50 text-xs"
                          title="Sistema de Apartado"
                        >
                          SA
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {dispatch.clientName}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formattedAmounts[dispatch.id] ||
                      formatCurrency(
                        dispatch.total,
                        dispatch.baseCurrency || "Bs",
                      )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(dispatch)}
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
