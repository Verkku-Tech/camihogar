"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  Search,
  FileSpreadsheet,
  Clock,
  AlertCircle,
  ExternalLink,
  DollarSign,
  User,
  Store,
  RefreshCw,
  ShoppingBag,
} from "lucide-react"
import { apiClient, type AgingOrderDetail } from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"

interface AgingOrdersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "unliquidated" | "expired_layaways"
  initialRange?: string | null
  title?: string
}

const UNLIQUIDATED_RANGES = [
  { key: "all", label: "Todos los rangos" },
  { key: "0-15d", label: "0-15 días" },
  { key: "16-30d", label: "16-30 días" },
  { key: "31-60d", label: "31-60 días" },
  { key: "60d+", label: "+60 días" },
]

const EXPIRED_LAYAWAY_RANGES = [
  { key: "all", label: "Todos los rangos" },
  { key: "30-60d", label: "1-2 meses (Alerta)" },
  { key: "60-90d", label: "2-3 meses (Próximo)" },
  { key: "90-120d", label: "3-4 meses (Vencido)" },
  { key: "120-180d", label: "4-6 meses (Crítico)" },
  { key: "180d+", label: "+6 meses (Grave)" },
]

export function AgingOrdersModal({
  open,
  onOpenChange,
  type,
  initialRange,
  title,
}: AgingOrdersModalProps) {
  const { toast } = useToast()
  const isExpired = type === "expired_layaways"
  const availableRanges = isExpired ? EXPIRED_LAYAWAY_RANGES : UNLIQUIDATED_RANGES

  const [selectedRange, setSelectedRange] = useState<string>(initialRange || "all")
  const [orders, setOrders] = useState<AgingOrderDetail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Sincronizar initialRange al abrir
  useEffect(() => {
    if (open) {
      setSelectedRange(initialRange || "all")
      setSearchQuery("")
    }
  }, [open, initialRange])

  // Cargar pedidos desde el backend
  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    async function fetchOrders() {
      setIsLoading(true)
      try {
        const rangeParam = selectedRange === "all" ? undefined : selectedRange
        const data = await apiClient.getAgingOrders(type, rangeParam, controller.signal)
        setOrders(data)
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast({
            title: "Error al cargar pedidos",
            description: "No se pudieron obtener los pedidos para este rango.",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
    return () => controller.abort()
  }, [open, type, selectedRange, toast])

  // Filtrado reactivo en memoria por texto
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders
    const q = searchQuery.toLowerCase()
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.vendorName.toLowerCase().includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    )
  }, [orders, searchQuery])

  // Totales de pedidos filtrados
  const totalPendingBalance = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + o.pendingBalanceUsd, 0),
    [filteredOrders]
  )
  const totalInvoiced = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + o.totalUsd, 0),
    [filteredOrders]
  )
  const avgDays = useMemo(() => {
    if (filteredOrders.length === 0) return 0
    const sum = filteredOrders.reduce((s, o) => s + (isExpired ? o.daysExpired : o.daysElapsed), 0)
    return Math.round(sum / filteredOrders.length)
  }, [filteredOrders, isExpired])

  // Descarga nativa Excel
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const rangeParam = selectedRange === "all" ? undefined : selectedRange
      await apiClient.downloadAgingOrdersExcel(type, rangeParam)
      toast({
        title: "Excel descargado con éxito",
        description: `Se exportó el listado con ${filteredOrders.length} pedidos.`,
      })
    } catch (err: any) {
      toast({
        title: "Error al exportar",
        description: err.message || "Ocurrió un error al generar el archivo Excel.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const defaultTitle = isExpired
    ? "Apartados Vencidos por Antigüedad"
    : "Saldos Pendientes por Cobrar (Aging)"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl xl:max-w-7xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isExpired
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs"
                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-xs"
                }`}
              >
                {isExpired ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                  {title || defaultTitle}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isExpired
                    ? "Detalle de apartados pendientes con más de 30 días de antigüedad (excluye reservas)"
                    : "Detalle de pedidos terminados pendientes de liquidación y cobro (excluye reservas)"}
                </DialogDescription>
              </div>
            </div>

            <Button
              onClick={handleExportExcel}
              disabled={isExporting || isLoading || filteredOrders.length === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 h-9 shrink-0 shadow-sm transition-all"
            >
              {isExporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>{isExporting ? "Generando..." : "Descargar Excel"}</span>
            </Button>
          </div>

          {/* Rango Selector Pills */}
          <div className="flex items-center gap-2 flex-wrap mt-4 pt-3.5 border-t border-border/30">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Rango:</span>
            {availableRanges.map((r) => {
              const isSelected = selectedRange === r.key
              return (
                <button
                  key={r.key}
                  onClick={() => setSelectedRange(r.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? isExpired
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs font-semibold"
                        : "bg-orange-500 text-white border-orange-500 shadow-xs font-semibold"
                      : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </DialogHeader>

        {/* KPIs bar */}
        <div className="p-4 px-6 border-b border-border/40 bg-muted/10 grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
              Pedidos en Rango
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                {filteredOrders.length} {filteredOrders.length === 1 ? "pedido" : "pedidos"}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
              Saldo Pendiente Total
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <span
                className={`text-lg font-bold font-mono mt-0.5 block ${
                  isExpired ? "text-rose-600 dark:text-rose-400" : "text-orange-600 dark:text-orange-400"
                }`}
              >
                ${totalPendingBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
              Total Facturado
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-28 mt-1" />
            ) : (
              <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                ${totalInvoiced.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
              {isExpired ? "Promedio Días Vencido" : "Promedio Días Antigüedad"}
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                {avgDays} días
              </span>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 px-6 border-b border-border/40 bg-background flex items-center justify-between gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por Nº de pedido, cliente, vendedor o sede..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              className="h-9 pl-9 text-xs bg-muted/20 border-border/70 focus-visible:ring-emerald-500"
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-4 w-36" />
          ) : (
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
              Mostrando <span className="font-semibold text-foreground">{filteredOrders.length}</span> de {orders.length} pedidos
            </span>
          )}
        </div>

        {/* Table Content - fits 100% width without horizontal scrolling */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[320px] p-0">
          <Table className="w-full">
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-xs">
              <TableRow className="text-xs border-border/60">
                <TableHead className="w-[110px] pl-5 whitespace-nowrap">Nº Pedido</TableHead>
                <TableHead className="w-[95px] whitespace-nowrap">Fecha</TableHead>
                <TableHead className="min-w-[150px]">Cliente</TableHead>
                <TableHead className="min-w-[160px]">Vendedor / Sede</TableHead>
                <TableHead className="w-[105px] text-right whitespace-nowrap">Pagado</TableHead>
                <TableHead className="w-[125px] text-right whitespace-nowrap">Saldo Pendiente</TableHead>
                <TableHead className="w-[120px] text-center whitespace-nowrap">
                  {isExpired ? "Días Vencido" : "Antigüedad"}
                </TableHead>
                <TableHead className="w-[110px] text-center whitespace-nowrap pr-5">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30 hover:bg-transparent">
                    <TableCell className="pl-5 py-3.5">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-3.5 w-16" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <Skeleton className="h-4 w-14 ml-auto" />
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <Skeleton className="h-4 w-18 ml-auto" />
                    </TableCell>
                    <TableCell className="py-3.5 text-center">
                      <Skeleton className="h-5 w-24 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="py-3.5 text-center pr-5">
                      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Search className="w-7 h-7 text-muted-foreground/30" />
                      <span className="font-semibold text-sm text-foreground/80">No se encontraron pedidos</span>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {searchQuery
                          ? `No hay registros que coincidan con "${searchQuery}" en este rango.`
                          : "No hay pedidos pendientes en el rango de antigüedad seleccionado."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((ord) => {
                  const dateStr = ord.createdAt
                    ? new Date(ord.createdAt).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—"

                  return (
                    <TableRow
                      key={ord.orderId || ord.orderNumber}
                      className="hover:bg-muted/30 border-border/30 transition-colors text-xs"
                    >
                      <TableCell className="pl-5 font-mono font-bold whitespace-nowrap">
                        <a
                          href={`/pedidos/${ord.orderNumber.replace(/^#/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>{ord.orderNumber}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                        </a>
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        {dateStr}
                      </TableCell>

                      <TableCell className="font-semibold text-foreground max-w-[200px] truncate" title={ord.clientName}>
                        {ord.clientName}
                      </TableCell>

                      <TableCell className="text-muted-foreground max-w-[200px]">
                        <div className="truncate font-medium text-foreground/90" title={ord.vendorName}>
                          {ord.vendorName}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={ord.storeName}>
                          {ord.storeName}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">
                        ${ord.paidUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            isExpired
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          ${ord.pendingBalanceUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </TableCell>

                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-mono px-2 py-0.5 whitespace-nowrap ${
                            isExpired
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                              : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30"
                          }`}
                        >
                          {isExpired
                            ? `${ord.daysExpired}d vencido`
                            : `${ord.daysElapsed}d (${ord.rangeLabel})`}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center whitespace-nowrap pr-5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium px-2 py-0.5 whitespace-nowrap border border-border/50"
                        >
                          {ord.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-4 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2.5 font-mono">
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <>
                <span>Mostrando <strong className="text-foreground">{filteredOrders.length}</strong> pedidos</span>
                <span>•</span>
                <span className="font-semibold text-foreground">
                  Saldo Total: ${totalPendingBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="px-5">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
