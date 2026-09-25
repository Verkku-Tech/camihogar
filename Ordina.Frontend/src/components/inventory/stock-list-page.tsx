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
  Boxes,
  Search,
  Building2,
  Warehouse,
  CheckCircle2,
  Clock,
  Unlock,
  ShoppingCart,
  Layers,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Loader2,
  Truck,
  ArrowLeftRight
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import {
  apiClient,
  type PhysicalStockDto,
  type StockReservationDto
} from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse as WarehouseType } from "@/lib/storage"
import { ReservationCountdownPill } from "./reservation-countdown-pill"
import { ManualEntryDialog } from "./manual-entry-dialog"
import { StockImportDialog } from "./stock-import-dialog"
import { RequestTransferDialog } from "./request-transfer-dialog"

export function StockListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stockItems, setStockItems] = useState<PhysicalStockDto[]>([])
  const [activeReservations, setActiveReservations] = useState<StockReservationDto[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all")
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [reservingStockId, setReservingStockId] = useState<string | null>(null)
  const [releasingResId, setReleasingResId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [items, reservations, storesData, warehousesData] = await Promise.all([
        apiClient.getStockList(),
        apiClient.getActiveReservations(),
        getStores("active"),
        getWarehouses()
      ])
      setStockItems(items)
      setActiveReservations(reservations)
      setStores(storesData)
      setWarehouses(warehousesData)
    } catch (err) {
      console.error("Error loading stock data:", err)
      toast.error("Error al cargar existencias de inventario")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Map of active reservations by stockId
  const reservationsByStockId = useMemo(() => {
    const map = new Map<string, StockReservationDto>()
    for (const r of activeReservations) {
      if (r.status === "active") {
        map.set(r.stockId, r)
      }
    }
    return map
  }, [activeReservations])

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      if (selectedLocationId !== "all" && item.locationId !== selectedLocationId) {
        return false
      }
      if (onlyAvailable && item.availableQuantity <= 0) {
        return false
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchesName = item.productName.toLowerCase().includes(term)
        const matchesSku = item.sku.toLowerCase().includes(term)
        const matchesVariant = item.variantKey.toLowerCase().includes(term)
        const matchesLocation = item.locationName.toLowerCase().includes(term)
        if (!matchesName && !matchesSku && !matchesVariant && !matchesLocation) {
          return false
        }
      }
      return true
    })
  }, [stockItems, selectedLocationId, onlyAvailable, searchTerm])

  // Metrics calculations
  const totalPhysicalUnits = useMemo(() => {
    return stockItems.reduce((acc, curr) => acc + curr.quantity, 0)
  }, [stockItems])

  const totalAvailableUnits = useMemo(() => {
    return stockItems.reduce((acc, curr) => acc + curr.availableQuantity, 0)
  }, [stockItems])

  const totalReservedUnits = useMemo(() => {
    return stockItems.reduce((acc, curr) => acc + curr.reservedQuantity, 0)
  }, [stockItems])

  // Actions
  const handleReserveCounter = async (stockItem: PhysicalStockDto) => {
    if (!user) {
      toast.error("Inicie sesión para apartar artículos")
      return
    }

    try {
      setReservingStockId(stockItem.id)
      const reservation = await apiClient.reserveStockItem({
        stockId: stockItem.id,
        vendorId: user.id,
        vendorName: user.name || user.username,
        quantity: 1,
        reservationType: "counter"
      })

      // Update state optimistically / reload
      toast.success(`¡Apartado por 10 minutos! Mostrador protegido para ${stockItem.productName}`)
      await loadData()
    } catch (err: any) {
      console.error("Error reserving stock:", err)
      toast.error(err.message || "No se pudo apartar el artículo (posiblemente apartado por otro vendedor)")
    } finally {
      setReservingStockId(null)
    }
  }

  const handleReleaseReservation = async (reservationId: string) => {
    try {
      setReleasingResId(reservationId)
      await apiClient.releaseStockReservation(reservationId)
      toast.success("Reserva liberada. El artículo vuelve a estar disponible.")
      await loadData()
    } catch (err: any) {
      console.error("Error releasing reservation:", err)
      toast.error(err.message || "Error al liberar la reserva")
    } finally {
      setReleasingResId(null)
    }
  }

  const handleContinueToOrder = (stockItem: PhysicalStockDto, reservation: StockReservationDto) => {
    // Navigate to order creation with query params prefilled
    navigate(`/pedidos?newOrder=true&stockId=${stockItem.id}&productId=${stockItem.productId}&reservationId=${reservation.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Existencias Físicas Inmediatas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Inventario multisede por variante y apartado temporal anti-duplicidad en mostrador
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-gray-200 dark:border-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/inventario/transferencias")}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-400 gap-1.5"
          >
            <Truck className="w-4 h-4" />
            Traspasos
          </Button>
          <RequestTransferDialog onSuccess={loadData} />
          <StockImportDialog onSuccess={loadData} />
          <ManualEntryDialog onSuccess={loadData} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Existencias Físicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPhysicalUnits} <span className="text-sm font-normal text-muted-foreground">unid.</span></div>
            <p className="text-xs text-muted-foreground mt-1">Sedes físicas registradas</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Disponibilidad Inmediata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalAvailableUnits} <span className="text-sm font-normal text-muted-foreground">unid.</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Listas para venta o entrega</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Apartados Activos (Mostrador)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalReservedUnits} <span className="text-sm font-normal text-muted-foreground">unid.</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bloqueados temporalmente</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sedes Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stores.length + warehouses.length} <span className="text-sm font-normal text-muted-foreground">puntos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stores.length} tiendas · {warehouses.length} almacenes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por mueble, SKU, tela, color, sede..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {/* Sede Select */}
            <div className="sm:col-span-4">
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Filtrar por sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      🏢 {w.name} {w.isCentral ? "(Central Terrinca)" : ""}
                    </SelectItem>
                  ))}
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      🏬 {s.name} (Exhibición)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Only Available Toggle */}
            <div className="sm:col-span-2 flex items-center justify-end">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={e => setOnlyAvailable(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Solo Disponibles
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Items Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            Catálogo de Existencias Inmediatas ({filteredItems.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Actualización en tiempo real</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-sm">Consultando existencias físicas multisede...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Boxes className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700" />
              <p className="font-semibold text-foreground">No se encontraron existencias físicas</p>
              <p className="text-xs max-w-sm mx-auto text-muted-foreground">
                Utiliza el botón "Alta de Taller" o "Carga Masiva Excel" para registrar las existencias de exhibición y almacén Terrinca.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10">
                    <TableHead className="w-[280px]">Mueble / Producto</TableHead>
                    <TableHead>Sede Física</TableHead>
                    <TableHead>Variante (Atributos)</TableHead>
                    <TableHead className="text-center">Existencia</TableHead>
                    <TableHead className="text-center">Apartado</TableHead>
                    <TableHead className="text-center">Disponible</TableHead>
                    <TableHead className="text-right">Precio USD</TableHead>
                    <TableHead className="text-right pr-4">Anti-Duplicidad / Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const activeRes = reservationsByStockId.get(item.id)
                    const isOwnReservation = activeRes && user && activeRes.vendorId === user.id
                    const isLockedByOther = activeRes && (!user || activeRes.vendorId !== user.id)

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-foreground">{item.productName}</span>
                            <div className="flex items-center gap-2">
                              {item.sku && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {item.sku}
                                </span>
                              )}
                              {item.categoryName && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                  {item.categoryName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs">
                            {item.locationType === "warehouse" ? (
                              <Warehouse className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="font-medium">{item.locationName}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {item.attributes && Object.keys(item.attributes).length > 0 ? (
                              Object.entries(item.attributes).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-secondary text-secondary-foreground font-mono"
                                >
                                  {key}: {val}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Estándar</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center font-medium">
                          {item.quantity}
                        </TableCell>

                        <TableCell className="text-center">
                          {item.reservedQuantity > 0 ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {item.reservedQuantity}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {item.availableQuantity > 0 ? (
                            <Badge className="bg-emerald-600 text-white dark:bg-emerald-700">
                              {item.availableQuantity}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-500">
                              Agotado
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right font-semibold text-sm">
                          ${item.priceUsd.toFixed(2)}
                        </TableCell>

                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOwnReservation ? (
                              <div className="flex items-center gap-2">
                                <ReservationCountdownPill
                                  expiresAt={activeRes.expiresAt}
                                  initialSeconds={activeRes.remainingSeconds}
                                  isOwnReservation={true}
                                  onExpired={loadData}
                                />
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium"
                                  onClick={() => handleContinueToOrder(item, activeRes)}
                                >
                                  <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                                  Facturar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 h-8 px-2 text-xs"
                                  disabled={releasingResId === activeRes.id}
                                  onClick={() => handleReleaseReservation(activeRes.id)}
                                  title="Liberar apartado"
                                >
                                  {releasingResId === activeRes.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Unlock className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            ) : isLockedByOther ? (
                              <div className="flex items-center gap-1.5">
                                <ReservationCountdownPill
                                  expiresAt={activeRes.expiresAt}
                                  initialSeconds={activeRes.remainingSeconds}
                                  vendorName={activeRes.vendorName}
                                  onExpired={loadData}
                                />
                                <Button size="sm" variant="ghost" disabled className="h-8 text-xs text-muted-foreground opacity-60">
                                  Bloqueado
                                </Button>
                              </div>
                            ) : item.availableQuantity > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40 h-8 text-xs font-semibold"
                                  disabled={reservingStockId === item.id}
                                  onClick={() => handleReserveCounter(item)}
                                >
                                  {reservingStockId === item.id ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                                  )}
                                  Apartar (10m)
                                </Button>
                                <RequestTransferDialog
                                  initialItem={item}
                                  triggerButton={
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 h-8 px-2 text-xs"
                                      title="Solicitar Traslado a otra sede"
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5" />
                                    </Button>
                                  }
                                  onSuccess={loadData}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic pr-2">Sin stock</span>
                            )}
                          </div>
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
