"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
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
  TrendingUp,
  CreditCard,
  Layers,
  ArrowDownLeft,
  History,
  CheckCircle2,
  Calendar,
} from "lucide-react"
import {
  apiClient,
  type AgingOrderDetail,
  type CollectedDrillDownResponse,
  type PaymentDrillDown,
  type CasheaDrillDownResponse,
  type CasheaDrillDownItem,
} from "@/lib/api-client"
import { useToast } from "@/components/ui/use-toast"

export type KpiDrillDownType =
  | "orders"
  | "invoiced"
  | "collected"
  | "collection_rate"
  | "active_layaways"
  | "expired_layaways"
  | "cashea"

interface KpiDrillDownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: KpiDrillDownType
  period: "day" | "today" | "week" | "month" | "year"
}

const PERIOD_LABELS: Record<string, string> = {
  day: "Hoy",
  today: "Hoy",
  week: "Esta Semana",
  month: "Este Mes",
  year: "Este Año",
}

export function KpiDrillDownModal({
  open,
  onOpenChange,
  type,
  period,
}: KpiDrillDownModalProps) {
  const { toast } = useToast()

  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Data states
  const [ordersData, setOrdersData] = useState<AgingOrderDetail[]>([])
  const [collectedData, setCollectedData] = useState<CollectedDrillDownResponse | null>(null)
  const [casheaData, setCasheaData] = useState<CasheaDrillDownResponse | null>(null)

  // Active tab for collected drill-down ("current" vs "prior")
  const [collectedTab, setCollectedTab] = useState<"current" | "prior">("current")

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearchQuery("")
      setCollectedTab("current")
    }
  }, [open, type])

  // Fetch data
  useEffect(() => {
    if (!open) return

    const controller = new AbortController()

    async function loadData() {
      setIsLoading(true)
      try {
        if (type === "orders" || type === "invoiced" || type === "active_layaways" || type === "expired_layaways") {
          const data = await apiClient.getOrdersDrilldown(type, period, controller.signal)
          setOrdersData(data)
        } else if (type === "collected" || type === "collection_rate") {
          const data = await apiClient.getCollectedDrilldown(period, controller.signal)
          setCollectedData(data)
        } else if (type === "cashea") {
          const data = await apiClient.getCasheaDrilldown(period, controller.signal)
          setCasheaData(data)
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast({
            title: "Error al cargar datos",
            description: "No se pudieron obtener los registros de esta métrica.",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [open, type, period, toast])

  // Handlers for Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      if (type === "orders" || type === "invoiced" || type === "active_layaways" || type === "expired_layaways") {
        await apiClient.downloadOrdersDrilldownExcel(type, period)
      } else if (type === "collected" || type === "collection_rate") {
        await apiClient.downloadCollectedDrilldownExcel(period, collectedTab)
      } else if (type === "cashea") {
        await apiClient.downloadCasheaDrilldownExcel(period)
      }
      toast({
        title: "Exportación exitosa",
        description: "El archivo Excel (.xlsx) ha sido descargado correctamente.",
      })
    } catch (err: any) {
      toast({
        title: "Error de exportación",
        description: err.message || "No se pudo generar el reporte Excel.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Reactive filters
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return ordersData
    const q = searchQuery.toLowerCase()
    return ordersData.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.vendorName.toLowerCase().includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    )
  }, [ordersData, searchQuery])

  const currentPayments = collectedData?.currentPeriodPayments ?? []
  const priorPayments = collectedData?.priorPeriodPayments ?? []
  const activePaymentsList = collectedTab === "current" ? currentPayments : priorPayments

  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return activePaymentsList
    const q = searchQuery.toLowerCase()
    return activePaymentsList.filter(
      (p) =>
        p.orderNumber.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.bank.toLowerCase().includes(q)
    )
  }, [activePaymentsList, searchQuery])

  const filteredCashea = useMemo(() => {
    const list = casheaData?.orders ?? []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (c) =>
        c.orderNumber.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.vendorName.toLowerCase().includes(q) ||
        c.storeName.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q)
    )
  }, [casheaData, searchQuery])

  // Title and metadata configuration
  const modalMeta = useMemo(() => {
    switch (type) {
      case "orders":
        return {
          title: "Detalle de Pedidos Generados",
          description: `Listado de órdenes registradas en el período (${PERIOD_LABELS[period] || period})`,
          badge: `${filteredOrders.length} pedidos`,
          badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
          icon: ShoppingBag,
        }
      case "invoiced":
        return {
          title: "Detalle de Ventas Facturadas",
          description: `Ventas totales y pedidos facturados (${PERIOD_LABELS[period] || period})`,
          badge: `${filteredOrders.length} pedidos`,
          badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          icon: DollarSign,
        }
      case "collected":
      case "collection_rate":
        return {
          title: "Detalle de Cobranza e Ingresos",
          description: `Desglose de abonos cobrados en ${PERIOD_LABELS[period] || period}: Ventas actuales vs. Cartera histórica`,
          badge: `$${(collectedData?.totalCollectedUsd ?? 0).toLocaleString()} cobrados`,
          badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          icon: TrendingUp,
        }
      case "active_layaways":
        return {
          title: "Detalle de Sistemas de Apartado Activos",
          description: "Apartados vigentes (< 90 días) con saldo pendiente por liquidar",
          badge: `${filteredOrders.length} apartados`,
          badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          icon: Clock,
        }
      case "expired_layaways":
        return {
          title: "Detalle de Sistemas de Apartado Vencidos",
          description: "Apartados que superan los 90 días sin liquidar (reservas excluidas)",
          badge: `${filteredOrders.length} vencidos`,
          badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
          icon: AlertCircle,
        }
      case "cashea":
        return {
          title: "Detalle de Operaciones Cashea",
          description: `Pedidos financiados con Cashea en ${PERIOD_LABELS[period] || period}: Inicial, financiado, cobrado y saldo`,
          badge: `${filteredCashea.length} pedidos`,
          badgeColor: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
          icon: CreditCard,
        }
      default:
        return {
          title: "Detalle de Métricas",
          description: "Desglose pormenorizado",
          badge: "",
          badgeColor: "",
          icon: Layers,
        }
    }
  }, [type, period, filteredOrders.length, filteredCashea.length, collectedData?.totalCollectedUsd])

  const IconComponent = modalMeta.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border-border/60">
        {/* Header */}
        <DialogHeader className="p-5 px-6 border-b border-border/40 bg-card/50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <IconComponent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                    {modalMeta.title}
                  </DialogTitle>
                  <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 ${modalMeta.badgeColor}`}>
                    {modalMeta.badge}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    {PERIOD_LABELS[period] || period}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {modalMeta.description}
                </DialogDescription>
              </div>
            </div>

            {/* Top actions: Search & Excel download */}
            <div className="flex items-center gap-2.5">
              <div className="relative w-56 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar en la lista..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs bg-background/50 border-border/60 focus-visible:ring-1"
                />
              </div>

              <Button
                onClick={handleExportExcel}
                disabled={isExporting || isLoading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 h-9 shrink-0 shadow-xs transition-all cursor-pointer"
              >
                {isExporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>{isExporting ? "Generando..." : "Descargar Excel"}</span>
              </Button>
            </div>
          </div>

          {/* Special 2-Tab bar for Collected metrics */}
          {(type === "collected" || type === "collection_rate") && collectedData && (
            <div className="mt-4 pt-3.5 border-t border-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCollectedTab("current")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-2 ${
                    collectedTab === "current"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-background text-muted-foreground border-border/60 hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Cobranza Ventas del Período ({currentPayments.length})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${collectedTab === "current" ? "bg-white/20 text-white" : "bg-muted text-foreground"}`}>
                    ${collectedData.currentPeriodCollectedUsd.toLocaleString()} ({collectedData.currentPeriodPercentage}%)
                  </span>
                </button>

                <button
                  onClick={() => setCollectedTab("prior")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-2 ${
                    collectedTab === "prior"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-background text-muted-foreground border-border/60 hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Cobranza Cartera Anterior ({priorPayments.length})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${collectedTab === "prior" ? "bg-white/20 text-white" : "bg-muted text-foreground"}`}>
                    ${collectedData.priorPeriodCollectedUsd.toLocaleString()} ({collectedData.priorPeriodPercentage}%)
                  </span>
                </button>
              </div>

              {/* Progress bar ratio */}
              <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                <span className="text-[11px] text-muted-foreground">Distribución:</span>
                <div className="w-32 h-2.5 rounded-full bg-muted/60 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${collectedData.currentPeriodPercentage}%` }}
                    title={`Ventas Período: ${collectedData.currentPeriodPercentage}%`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${collectedData.priorPeriodPercentage}%` }}
                    title={`Cartera Anterior: ${collectedData.priorPeriodPercentage}%`}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Top Summary Stats Cards */}
        <div className="p-4 px-6 border-b border-border/40 bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {(type === "orders" || type === "invoiced" || type === "active_layaways" || type === "expired_layaways") && (
            <>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Pedidos
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  {filteredOrders.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Total Facturado
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  ${filteredOrders.reduce((s, o) => s + o.totalUsd, 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-emerald-600 font-semibold block uppercase tracking-wider">
                  Total Pagado
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 mt-0.5 block">
                  ${filteredOrders.reduce((s, o) => s + o.paidUsd, 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-rose-600 font-semibold block uppercase tracking-wider">
                  Saldo Pendiente
                </span>
                <span className="text-lg font-bold font-mono text-rose-600 mt-0.5 block">
                  ${filteredOrders.reduce((s, o) => s + o.pendingBalanceUsd, 0).toLocaleString()}
                </span>
              </div>
            </>
          )}

          {(type === "collected" || type === "collection_rate") && collectedData && (
            <>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Abonos en Lista
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  {filteredPayments.length} abonos
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-emerald-600 font-semibold block uppercase tracking-wider">
                  Total Cobrado Período
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 mt-0.5 block">
                  ${collectedData.totalCollectedUsd.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Ventas Período ({collectedData.currentPeriodPercentage}%)
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  ${collectedData.currentPeriodCollectedUsd.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-indigo-600 font-semibold block uppercase tracking-wider">
                  Cartera Anterior ({collectedData.priorPeriodPercentage}%)
                </span>
                <span className="text-lg font-bold font-mono text-indigo-600 mt-0.5 block">
                  ${collectedData.priorPeriodCollectedUsd.toLocaleString()}
                </span>
              </div>
            </>
          )}

          {type === "cashea" && casheaData && (
            <>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Total Pedidos Cashea
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  {casheaData.totalOrdersCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Volumen Cashea ($)
                </span>
                <span className="text-lg font-bold font-mono text-foreground mt-0.5 block">
                  ${casheaData.totalOrdersVolumeUsd.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-emerald-600 font-semibold block uppercase tracking-wider">
                  Cashea Cobrado
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 mt-0.5 block">
                  ${casheaData.totalCollectedCasheaUsd.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] text-rose-600 font-semibold block uppercase tracking-wider">
                  Cashea Por Cobrar
                </span>
                <span className="text-lg font-bold font-mono text-rose-600 mt-0.5 block">
                  ${casheaData.totalPendingCasheaUsd.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto min-h-0 relative p-4 px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Cargando registros del dashboard...</p>
            </div>
          ) : (
            <>
              {/* Table for Orders & Invoiced & Layaways */}
              {(type === "orders" || type === "invoiced" || type === "active_layaways" || type === "expired_layaways") && (
                filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No se encontraron pedidos para este criterio.</p>
                  </div>
                ) : (
                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-2xs bg-card">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold py-3">Pedido</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Fecha</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Cliente</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Vendedor</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Tienda</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Estado</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Pagado ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Saldo Pend. ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.orderId || order.orderNumber} className="text-xs hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-foreground py-2.5">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                            </TableCell>
                            <TableCell className="font-medium text-foreground py-2.5 max-w-[160px] truncate" title={order.clientName}>
                              {order.clientName || "Sin cliente"}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground max-w-[130px] truncate" title={order.vendorName}>
                              {order.vendorName || "-"}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground max-w-[130px] truncate" title={order.storeName}>
                              {order.storeName || "-"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-emerald-600">
                              ${order.paidUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-rose-600">
                              ${order.pendingBalanceUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Link
                                href={`/pedidos/${order.orderId || order.orderNumber}`}
                                target="_blank"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                title="Ver pedido"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* Table for Collected & Collection Rate */}
              {(type === "collected" || type === "collection_rate") && (
                filteredPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No se encontraron abonos registrados en esta pestaña.</p>
                  </div>
                ) : (
                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-2xs bg-card">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold py-3">Pedido</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Fecha Abono</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Cliente</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Tienda / Vendedor</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Método / Banco</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Referencia</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Monto ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Bs / Tasa</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-center">Conciliado</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((p) => (
                          <TableRow key={p.paymentId || `${p.orderNumber}-${p.amountUsd}`} className="text-xs hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-foreground py-2.5">
                              {p.orderNumber}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground">
                              {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </TableCell>
                            <TableCell className="font-medium text-foreground py-2.5 max-w-[150px] truncate" title={p.clientName}>
                              {p.clientName || "Sin cliente"}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground max-w-[140px] truncate" title={`${p.storeName} - ${p.vendorName}`}>
                              <span className="font-medium block text-foreground truncate">{p.storeName}</span>
                              <span className="text-[10px] text-muted-foreground block truncate">{p.vendorName}</span>
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground max-w-[130px] truncate" title={`${p.method} - ${p.bank}`}>
                              <span className="font-medium block text-foreground truncate">{p.method}</span>
                              <span className="text-[10px] text-muted-foreground block truncate">{p.bank || "-"}</span>
                            </TableCell>
                            <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground max-w-[100px] truncate" title={p.reference}>
                              {p.reference || "-"}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-emerald-600">
                              ${p.amountUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono text-[11px] text-muted-foreground">
                              {p.amountBs > 0 ? (
                                <>
                                  <span className="block font-medium text-foreground">Bs {p.amountBs.toFixed(2)}</span>
                                  <span className="text-[10px] text-muted-foreground">T: {p.exchangeRate}</span>
                                </>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              {p.isConciliated ? (
                                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0">
                                  Conciliado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20 px-1.5 py-0">
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Link
                                href={`/pedidos/${p.orderId || p.orderNumber}`}
                                target="_blank"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                title="Ver pedido"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}

              {/* Table for Cashea */}
              {type === "cashea" && (
                filteredCashea.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No se encontraron pedidos con Cashea en este período.</p>
                  </div>
                ) : (
                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-2xs bg-card">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold py-3">Pedido</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Fecha</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Cliente</TableHead>
                          <TableHead className="text-xs font-semibold py-3">Tienda</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Total ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Inicial Tienda ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Cashea Financ. ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Cobrado ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-right">Por Cobrar ($)</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-center">Conciliado</TableHead>
                          <TableHead className="text-xs font-semibold py-3 text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCashea.map((c) => (
                          <TableRow key={c.orderId || c.orderNumber} className="text-xs hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-foreground py-2.5">
                              {c.orderNumber}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground">
                              {c.orderDate ? new Date(c.orderDate).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) : "-"}
                            </TableCell>
                            <TableCell className="font-medium text-foreground py-2.5 max-w-[150px] truncate" title={c.clientName}>
                              {c.clientName || "Sin cliente"}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground max-w-[130px] truncate" title={c.storeName}>
                              {c.storeName || "-"}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-foreground">
                              ${c.totalOrderUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-medium text-muted-foreground">
                              ${c.downPaymentUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-yellow-600">
                              ${c.financedCasheaUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-emerald-600">
                              ${c.collectedCasheaUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-semibold text-rose-600">
                              ${c.pendingCasheaUsd.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              {c.isFullyReconciled ? (
                                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0">
                                  Conciliado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20 px-1.5 py-0">
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Link
                                href={`/pedidos/${c.orderId || c.orderNumber}`}
                                target="_blank"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                title="Ver pedido"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
