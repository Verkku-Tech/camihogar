"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Hammer,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Loader2,
  Boxes,
  Play
} from "lucide-react"
import { toast } from "sonner"
import { apiClient, type ManufacturingOrderDto } from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse } from "@/lib/storage"
import { NewStockOrderDialog } from "./new-stock-order-dialog"

export function StockOrdersTab() {
  const [orders, setOrders] = useState<ManufacturingOrderDto[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")

  // Action loaders
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [ordersData, storesData, warehousesData] = await Promise.all([
        apiClient.getManufacturingOrders(),
        getStores("active"),
        getWarehouses()
      ])
      setOrders(ordersData)
      setStores(storesData)
      setWarehouses(warehousesData)
    } catch (err) {
      console.error("Error loading manufacturing orders:", err)
      toast.error("Error al cargar órdenes de fabricación para stock")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleStartProduction = async (order: ManufacturingOrderDto) => {
    try {
      setUpdatingId(order.id)
      await apiClient.updateManufacturingOrderStatus(order.id, { status: "En Produccion" })
      toast.success(`Orden ${order.orderNumber} pasó a estado "En Producción"`)
      await loadData()
    } catch (err: any) {
      console.error("Error starting production:", err)
      toast.error(err.message || "Error al iniciar producción")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleMarkFabricated = async (order: ManufacturingOrderDto) => {
    if (!window.confirm(`¿Confirmar que la orden ${order.orderNumber} ha sido fabricada? Se ingresarán automáticamente ${order.quantity} unidades al inventario de ${order.destinationLocationName}.`)) {
      return
    }

    try {
      setUpdatingId(order.id)
      await apiClient.updateManufacturingOrderStatus(order.id, { status: "Fabricado" })
      toast.success(`Orden ${order.orderNumber} completada. ¡${order.quantity} unid. ingresadas a stock en ${order.destinationLocationName}!`)
      await loadData()
    } catch (err: any) {
      console.error("Error marking fabricated:", err)
      toast.error(err.message || "Error al marcar como fabricado")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCancel = async (order: ManufacturingOrderDto) => {
    if (!window.confirm(`¿Seguro que desea cancelar la orden de fabricación ${order.orderNumber}?`)) {
      return
    }

    try {
      setUpdatingId(order.id)
      await apiClient.cancelManufacturingOrder(order.id)
      toast.success(`Orden ${order.orderNumber} cancelada`)
      await loadData()
    } catch (err: any) {
      console.error("Error cancelling manufacturing order:", err)
      toast.error(err.message || "Error al cancelar la orden")
    } finally {
      setUpdatingId(null)
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
      if (locationFilter !== "all" && o.destinationLocationId !== locationFilter) {
        return false
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const matchNumber = o.orderNumber.toLowerCase().includes(query)
        const matchProduct = o.productName.toLowerCase().includes(query)
        const matchSku = o.sku?.toLowerCase().includes(query)
        const matchRequester = o.requestedBy.toLowerCase().includes(query)
        const matchDest = o.destinationLocationName.toLowerCase().includes(query)
        const matchProvider = o.providerName?.toLowerCase().includes(query)
        if (!matchNumber && !matchProduct && !matchSku && !matchRequester && !matchDest && !matchProvider) {
          return false
        }
      }
      return true
    })
  }, [orders, statusFilter, locationFilter, searchTerm])

  // KPIs
  const pendingCount = useMemo(() => orders.filter(o => o.status === "Pendiente").length, [orders])
  const inProductionCount = useMemo(() => orders.filter(o => o.status === "En Produccion").length, [orders])
  const completedCount = useMemo(() => orders.filter(o => o.status === "Fabricado").length, [orders])

  return (
    <div className="space-y-6">
      {/* Top Bar Actions & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Hammer className="w-5 h-5 text-indigo-600" />
            Órdenes de Fabricación Interna para Stock
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Producción orientada a reponer topes de exhibición o stock central Terrinca (aisladas de facturación a clientes).
          </p>
        </div>

        <div className="flex items-center gap-2">
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
          <NewStockOrderDialog onSuccess={loadData} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Pendientes de Inicio</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pendingCount} <span className="text-sm font-normal text-muted-foreground">órdenes</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">En espera de asignación de taller</p>
          </CardContent>
        </Card>

        <Card className="border border-indigo-200/60 shadow-sm bg-indigo-50/20 dark:bg-indigo-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center justify-between">
              <span>En Producción Activa</span>
              <Hammer className="w-4 h-4 text-indigo-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              {inProductionCount} <span className="text-sm font-normal text-muted-foreground">órdenes</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Actualmente en fabricación en taller</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Fabricadas (En Stock)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedCount} <span className="text-sm font-normal text-muted-foreground">órdenes</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Acreditadas al inventario físico</p>
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
                placeholder="Buscar por OF-XXXX, modelo, solicitante, taller..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Status Select */}
            <div className="sm:col-span-4 flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
              <Button
                variant={statusFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => setStatusFilter("all")}
              >
                Todas
              </Button>
              <Button
                variant={statusFilter === "Pendiente" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1 text-amber-700 dark:text-amber-300 font-semibold"
                onClick={() => setStatusFilter("Pendiente")}
              >
                Pendiente
              </Button>
              <Button
                variant={statusFilter === "En Produccion" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1 text-indigo-700 dark:text-indigo-300 font-semibold"
                onClick={() => setStatusFilter("En Produccion")}
              >
                Producción
              </Button>
              <Button
                variant={statusFilter === "Fabricado" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs flex-1 text-emerald-700 dark:text-emerald-300 font-semibold"
                onClick={() => setStatusFilter("Fabricado")}
              >
                Fabricado
              </Button>
            </div>

            {/* Sede Destino */}
            <div className="sm:col-span-3">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Filtrar por sede destino..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todas las Sedes</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      🏢 {w.name}
                    </SelectItem>
                  ))}
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      🏬 {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-500" />
            Listado de Órdenes de Fabricación ({filteredOrders.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Flujo taller ➔ inventario físico</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-sm">Cargando órdenes de fabricación...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Hammer className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
              <p className="font-semibold text-foreground">No se encontraron órdenes de fabricación para stock</p>
              <p className="text-xs max-w-sm mx-auto text-muted-foreground">
                Usa el botón "Nueva Orden de Stock" para solicitar la confección de muebles para exhibición en tiendas o almacén Terrinca.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10">
                    <TableHead className="w-[120px]">Nº Orden</TableHead>
                    <TableHead>Producto & Especificaciones</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Solicitante & Taller</TableHead>
                    <TableHead className="text-right">Costo Est.</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right pr-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(ord => {
                    const isPending = ord.status === "Pendiente"
                    const inProd = ord.status === "En Produccion"
                    const isDone = ord.status === "Fabricado"
                    const isCancelled = ord.status === "Cancelado"

                    return (
                      <TableRow key={ord.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {ord.orderNumber}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-foreground">{ord.productName}</span>
                            <div className="flex items-center gap-1.5">
                              {ord.sku && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {ord.sku}
                                </span>
                              )}
                              {ord.attributes && Object.keys(ord.attributes).length > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  ({Object.entries(ord.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")})
                                </span>
                              )}
                            </div>
                            {ord.notes && (
                              <p className="text-[11px] text-muted-foreground italic truncate max-w-[220px]" title={ord.notes}>
                                Nota: {ord.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center font-bold text-sm">
                          <Badge variant="outline" className="text-xs px-2 py-0.5 font-bold">
                            {ord.quantity}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            {ord.destinationLocationType === "warehouse" ? (
                              <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="font-medium text-foreground">{ord.destinationLocationName}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div className="font-medium text-foreground">
                              Por: <span className="font-semibold">{ord.requestedBy}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Taller: {ord.providerName || <span className="italic">Por asignar</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(ord.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-medium text-xs">
                          {ord.costUsd > 0 ? `$${ord.costUsd.toFixed(2)}` : "—"}
                        </TableCell>

                        <TableCell className="text-center">
                          {isPending && (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </Badge>
                          )}
                          {inProd && (
                            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-[11px]">
                              <Hammer className="w-3 h-3 animate-bounce" />
                              En Producción
                            </Badge>
                          )}
                          {isDone && (
                            <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Fabricado
                            </Badge>
                          )}
                          {isCancelled && (
                            <Badge variant="outline" className="text-gray-500 border-gray-300 text-[11px]">
                              Cancelado
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          {isPending && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold"
                                disabled={updatingId === ord.id}
                                onClick={() => handleStartProduction(ord)}
                              >
                                {updatingId === ord.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 mr-1" />
                                )}
                                Iniciar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 h-8 px-2 text-xs"
                                disabled={updatingId === ord.id}
                                onClick={() => handleCancel(ord)}
                                title="Cancelar orden"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}

                          {inProd && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                                disabled={updatingId === ord.id}
                                onClick={() => handleMarkFabricated(ord)}
                              >
                                {updatingId === ord.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                )}
                                Fabricado (Stock)
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 h-8 px-2 text-xs"
                                disabled={updatingId === ord.id}
                                onClick={() => handleCancel(ord)}
                                title="Cancelar orden"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}

                          {isDone && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium text-right">
                              ✓ En inventario físico
                            </div>
                          )}

                          {isCancelled && (
                            <span className="text-xs text-muted-foreground italic">Cancelada</span>
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
