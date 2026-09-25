"use client"

import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Truck,
  ArrowLeftRight,
  ArrowRight,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Loader2,
  Boxes,
  ArrowLeft
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { apiClient, type StockTransferDto } from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse } from "@/lib/storage"
import { RequestTransferDialog } from "./request-transfer-dialog"

export function StockTransfersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [transfers, setTransfers] = useState<StockTransferDto[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")

  // Action loaders
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [transfersData, storesData, warehousesData] = await Promise.all([
        apiClient.getStockTransfers(),
        getStores("active"),
        getWarehouses()
      ])
      setTransfers(transfersData)
      setStores(storesData)
      setWarehouses(warehousesData)
    } catch (err) {
      console.error("Error loading stock transfers:", err)
      toast.error("Error al cargar traslados de inventario")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleConfirm = async (transfer: StockTransferDto) => {
    if (!window.confirm(`¿Confirmar recepción de ${transfer.quantity} unid. de "${transfer.productName}" en ${transfer.destinationLocationName}?`)) {
      return
    }

    try {
      setConfirmingId(transfer.id)
      await apiClient.confirmStockTransfer(transfer.id, user?.name || "Operador")
      toast.success(`Traslado ${transfer.transferNumber} completado. Stock acreditado a ${transfer.destinationLocationName}.`)
      await loadData()
    } catch (err: any) {
      console.error("Error confirming transfer:", err)
      toast.error(err.message || "Error al confirmar la recepción del traslado")
    } finally {
      setConfirmingId(null)
    }
  }

  const handleCancel = async (transfer: StockTransferDto) => {
    if (!window.confirm(`¿Seguro que desea cancelar el traslado ${transfer.transferNumber}? La mercancía volverá a estar disponible en el origen.`)) {
      return
    }

    try {
      setCancellingId(transfer.id)
      await apiClient.cancelStockTransfer(transfer.id)
      toast.success(`Traslado ${transfer.transferNumber} cancelado. Stock liberado en el origen.`)
      await loadData()
    } catch (err: any) {
      console.error("Error cancelling transfer:", err)
      toast.error(err.message || "Error al cancelar el traslado")
    } finally {
      setCancellingId(null)
    }
  }

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false
      }
      if (locationFilter !== "all") {
        if (t.originLocationId !== locationFilter && t.destinationLocationId !== locationFilter) {
          return false
        }
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchNumber = t.transferNumber.toLowerCase().includes(query)
        const matchProduct = t.productName.toLowerCase().includes(query)
        const matchSku = t.sku?.toLowerCase().includes(query)
        const matchRequester = t.requestedBy.toLowerCase().includes(query)
        const matchOrigin = t.originLocationName.toLowerCase().includes(query)
        const matchDest = t.destinationLocationName.toLowerCase().includes(query)
        if (!matchNumber && !matchProduct && !matchSku && !matchRequester && !matchOrigin && !matchDest) {
          return false
        }
      }
      return true
    })
  }, [transfers, statusFilter, locationFilter, searchTerm])

  // KPIs
  const inTransitCount = useMemo(() => transfers.filter(t => t.status === "in_transit").length, [transfers])
  const inTransitUnits = useMemo(() => transfers.filter(t => t.status === "in_transit").reduce((acc, t) => acc + t.quantity, 0), [transfers])
  const completedCount = useMemo(() => transfers.filter(t => t.status === "transferred").length, [transfers])
  const cancelledCount = useMemo(() => transfers.filter(t => t.status === "cancelled").length, [transfers])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/inventario/existencias")}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Existencias
            </Button>
            <span className="text-muted-foreground">/</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Truck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Traspasos entre Sedes
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Gestión y seguimiento de movimientos de mercancía física entre tiendas y depósitos.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </Button>

          <RequestTransferDialog onSuccess={loadData} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-amber-300/60 shadow-sm bg-amber-50/20 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>En Tránsito Activo</span>
              <Truck className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {inTransitCount} <span className="text-sm font-normal text-muted-foreground">guías</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {inTransitUnits} unidades reservadas en traslado
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Recibidos / Completados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedCount} <span className="text-sm font-normal text-muted-foreground">guías</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Stock acreditado a destino</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Cancelados</span>
              <XCircle className="w-4 h-4 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {cancelledCount} <span className="text-sm font-normal text-muted-foreground">guías</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Existencias reintegradas al origen</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Total Histórico</span>
              <Boxes className="w-4 h-4 text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {transfers.length} <span className="text-sm font-normal text-muted-foreground">movimientos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registro total de traspasos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por guía TR-XXXX, producto, SKU, solicitante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Status Tabs */}
            <div className="sm:col-span-4 flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
              <Button
                variant={statusFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setStatusFilter("all")}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === "in_transit" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1 text-amber-700 dark:text-amber-300 font-semibold"
                onClick={() => setStatusFilter("in_transit")}
              >
                En Tránsito ({inTransitCount})
              </Button>
              <Button
                variant={statusFilter === "transferred" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1 text-emerald-700 dark:text-emerald-300 font-semibold"
                onClick={() => setStatusFilter("transferred")}
              >
                Recibidos
              </Button>
            </div>

            {/* Sede Filter */}
            <div className="sm:col-span-3">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Filtrar por sede..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas las Sedes</SelectItem>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      Tienda: {s.name}
                    </SelectItem>
                  ))}
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      Almacén: {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
            Guías de Traslado ({filteredTransfers.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Control de custodia y recepción</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-sm">Cargando guías de traspaso...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Truck className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
              <p className="font-semibold text-foreground">No hay traslados registrados con estos filtros</p>
              <p className="text-xs max-w-sm mx-auto text-muted-foreground">
                Puedes solicitar un traspaso de mercancía física para reponer el tope de exhibición o surtir una venta urgente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10">
                    <TableHead className="w-[120px]">Nº Guía</TableHead>
                    <TableHead>Producto & Especificaciones</TableHead>
                    <TableHead>Ruta (Origen ➔ Destino)</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead>Solicitud & Motivo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right pr-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map(t => {
                    const isInTransit = t.status === "in_transit"
                    const isTransferred = t.status === "transferred"
                    const isCancelled = t.status === "cancelled"

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {t.transferNumber}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-foreground">{t.productName}</span>
                            <div className="flex items-center gap-1.5">
                              {t.sku && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {t.sku}
                                </span>
                              )}
                              {t.attributes && Object.keys(t.attributes).length > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({Object.entries(t.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")})
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {t.originLocationType === "warehouse" ? (
                                <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                              )}
                              <span className="font-medium text-foreground">{t.originLocationName}</span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {t.destinationLocationType === "warehouse" ? (
                                <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              <span className="font-semibold text-foreground">{t.destinationLocationName}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-center font-bold text-sm">
                          <Badge variant="outline" className="text-xs px-2 py-0.5 font-bold">
                            {t.quantity}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="font-medium text-foreground">{t.requestedBy}</div>
                            {t.reason && (
                              <div className="text-[11px] text-muted-foreground italic truncate max-w-[200px]" title={t.reason}>
                                {t.reason}
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {isInTransit && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-[11px]">
                              <Truck className="w-3 h-3 animate-pulse" />
                              En Tránsito
                            </Badge>
                          )}
                          {isTransferred && (
                            <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Recibido
                            </Badge>
                          )}
                          {isCancelled && (
                            <Badge variant="outline" className="text-gray-500 border-gray-300 text-[11px]">
                              Cancelado
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          {isInTransit ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                                disabled={confirmingId === t.id || cancellingId === t.id}
                                onClick={() => handleConfirm(t)}
                              >
                                {confirmingId === t.id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                )}
                                Confirmar Recepción
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 h-8 px-2 text-xs"
                                disabled={confirmingId === t.id || cancellingId === t.id}
                                onClick={() => handleCancel(t)}
                                title="Cancelar traslado"
                              >
                                {cancellingId === t.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : isTransferred ? (
                            <div className="text-[11px] text-muted-foreground text-right">
                              Recibido por <span className="font-medium text-foreground">{t.transferredBy || "Operador"}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sin acciones</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
