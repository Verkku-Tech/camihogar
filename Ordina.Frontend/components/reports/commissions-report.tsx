"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getUsers,
  getStores,
  type User,
  type Store,
} from "@/lib/storage"
import {
  apiClient,
  type CommissionReportRowDto,
  type CommissionsReportQueryParams,
} from "@/lib/api-client"

interface CommissionReportRow {
  fecha: string
  cliente: string
  pedido: string
  vendedor: string
  descripcion: string
  cantidadArticulos: number
  tipoVenta: string
  comisionFamiliaUsdPorUnidad: number
  comisionVendedor: number
  comisionPostventa: number
  comisionReferido: number
  vendedorPostventa?: string
  vendedorReferido?: string
}

const TEAMS = [
  { value: "all", label: "Todos" },
  { value: "guatire", label: "Guatire (Lunes a Domingo)" },
  { value: "caracas", label: "Caracas (Sábado a Viernes)" },
  { value: "rrss", label: "RRSS (Mensual)" },
] as const

function isCommissionSeller(user: User) {
  return user.role === "Store Seller" || user.role === "Online Seller"
}

function filterSellersByStore(sellers: User[], storeFilter: string): User[] {
  if (storeFilter === "all") return sellers
  if (storeFilter === "unassigned") {
    return sellers.filter((u) => u.role === "Store Seller" && !u.storeId)
  }
  return sellers.filter((u) => u.storeId === storeFilter)
}

function mapDtoToTableRows(dtos: CommissionReportRowDto[]): CommissionReportRow[] {
  return dtos.map((row) => ({
    fecha: row.fecha,
    cliente: row.cliente,
    pedido: row.pedido,
    vendedor: row.vendedor,
    descripcion: row.descripcion,
    cantidadArticulos: row.cantidadArticulos,
    tipoVenta: row.tipoVenta,
    comisionFamiliaUsdPorUnidad: row.comisionFamiliaUsdPorUnidad,
    comisionVendedor: row.comision,
    comisionPostventa: row.comisionPostventa ?? 0,
    comisionReferido: row.comisionSecundaria ?? 0,
    vendedorPostventa: row.vendedorPostventa ?? undefined,
    vendedorReferido: row.vendedorSecundario ?? undefined,
  }))
}

function buildReportQueryParams(
  startDate: string,
  endDate: string,
  selectedTeam: string,
  selectedStoreId: string,
  selectedVendorId: string,
): CommissionsReportQueryParams {
  return {
    startDate,
    endDate,
    vendorId: selectedVendorId === "all" ? undefined : selectedVendorId,
    storeId: selectedStoreId === "all" ? undefined : selectedStoreId,
    team: selectedTeam === "all" ? undefined : selectedTeam,
  }
}

function CommissionPayoutCell({
  name,
  amount,
  formatUsd,
}: {
  name?: string
  amount: number
  formatUsd: (n: number) => string
}) {
  if (amount <= 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      {name ? (
        <span className="max-w-[120px] truncate text-xs text-muted-foreground" title={name}>
          {name}
        </span>
      ) : null}
      <span className="tabular-nums font-medium">{formatUsd(amount)}</span>
    </div>
  )
}

export function CommissionsReport() {
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all")
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all")
  const [commissionSellers, setCommissionSellers] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [reportData, setReportData] = useState<CommissionReportRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    Promise.all([getUsers(), getStores()])
      .then(([users, allStores]) => {
        setCommissionSellers(
          users.filter((u) => u.status === "active" && isCommissionSeller(u)),
        )
        setStores(allStores.filter((s) => s.status === "active"))
      })
      .catch(console.error)
  }, [])

  const sellersForStoreFilter = filterSellersByStore(
    commissionSellers,
    selectedStoreId,
  )

  const unassignedStoreSellersCount = commissionSellers.filter(
    (u) => u.role === "Store Seller" && !u.storeId,
  ).length

  useEffect(() => {
    const loadReportData = async () => {
      if (!startDate || !endDate) {
        setReportData([])
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        const rows = await apiClient.getCommissionsReportPreview(
          buildReportQueryParams(
            startDate,
            endDate,
            selectedTeam,
            selectedStoreId,
            selectedVendorId,
          ),
        )
        setReportData(mapDtoToTableRows(rows))
      } catch (error) {
        console.error("Error calculating commissions report:", error)
        toast.error("Error al calcular el reporte de comisiones")
        setHasError(true)
        setReportData([])
      } finally {
        setIsLoading(false)
      }
    }

    loadReportData()
  }, [startDate, endDate, selectedTeam, selectedStoreId, selectedVendorId])

  const handleDownloadExcel = async () => {
    if (!startDate || !endDate) {
      toast.error("Las fechas son obligatorias para descargar el reporte")
      return
    }

    setIsDownloading(true)

    try {
      const blob = await apiClient.downloadCommissionsReportExcel(
        buildReportQueryParams(
          startDate,
          endDate,
          selectedTeam,
          selectedStoreId,
          selectedVendorId,
        ),
      )

      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `Reporte_Comisiones_${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success("Reporte descargado exitosamente")
    } catch (error) {
      console.error("Error downloading report:", error)
      toast.error("Error al descargar el reporte")
    } finally {
      setIsDownloading(false)
    }
  }

  const formatCommissionUsd = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("es-VE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const totalVendedor = reportData.reduce((sum, row) => sum + row.comisionVendedor, 0)
  const totalPostventa = reportData.reduce((sum, row) => sum + row.comisionPostventa, 0)
  const totalReferido = reportData.reduce((sum, row) => sum + row.comisionReferido, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Parámetros del Reporte</CardTitle>
          <CardDescription>
            Las fechas son obligatorias. El reporte se calcula en el servidor (una sola
            consulta por carga). El filtro de equipo aplica al Excel descargado. El filtro
            de tienda agrupa vendedores por sede asignada en su perfil.
            {unassignedStoreSellersCount > 0 &&
              ` Hay ${unassignedStoreSellersCount} vendedor${unassignedStoreSellersCount === 1 ? "" : "es"} de tienda sin sede asignada.`}
            {" "}La comisión de post venta aplica en ventas compartidas con tipo Encargo o
            Sistema de apartado; en entrega o encargo/entrega suele ser $0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Fecha Desde <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                Fecha Hasta <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Equipo (Opcional)</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="team">
                  <SelectValue placeholder="Seleccionar equipo" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((team) => (
                    <SelectItem key={team.value} value={team.value}>
                      {team.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store">Tienda (Opcional)</Label>
              <Select
                value={selectedStoreId}
                onValueChange={(value) => {
                  setSelectedStoreId(value)
                  setSelectedVendorId("all")
                }}
              >
                <SelectTrigger id="store">
                  <SelectValue placeholder="Todas las tiendas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unassigned">Sin tienda asignada</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendedor (Opcional)</Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sellersForStoreFilter.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleDownloadExcel}
          disabled={!startDate || !endDate || isDownloading || isLoading}
          className="gap-2"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Descargando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Descargar Excel
            </>
          )}
        </Button>
      </div>

      {(!startDate || !endDate) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Por favor, selecciona las fechas de inicio y fin para ver el reporte
          </AlertDescription>
        </Alert>
      )}

      {startDate && endDate && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
            <CardDescription>
              {reportData.length} {reportData.length === 1 ? "registro" : "registros"} encontrados
              {selectedStoreId !== "all" &&
                (selectedStoreId === "unassigned"
                  ? " · filtro: sin tienda asignada"
                  : stores.find((s) => s.id === selectedStoreId) &&
                    ` · tienda: ${stores.find((s) => s.id === selectedStoreId)?.name}`)}
              {selectedVendorId !== "all" &&
                sellersForStoreFilter.find((u) => u.id === selectedVendorId) &&
                ` · vendedor: ${sellersForStoreFilter.find((u) => u.id === selectedVendorId)?.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Cargando reporte...</span>
              </div>
            ) : hasError ? (
              <div className="text-center py-8 text-destructive">
                Error al cargar el reporte. Por favor, intenta nuevamente.
              </div>
            ) : reportData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron registros para el rango de fechas seleccionado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Vendedor tienda</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead>Tipo venta</TableHead>
                      <TableHead className="text-right">USD/u familia</TableHead>
                      <TableHead className="text-right">Com. vendedor</TableHead>
                      <TableHead className="text-right">Post venta</TableHead>
                      <TableHead className="text-right">Referido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, index) => (
                      <TableRow key={`${row.pedido}-${index}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.fecha)}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.cliente}</TableCell>
                        <TableCell className="font-mono text-sm">{row.pedido}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{row.vendedor}</TableCell>
                        <TableCell className="max-w-[240px]">{row.descripcion}</TableCell>
                        <TableCell className="text-center">{row.cantidadArticulos}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{row.tipoVenta}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.comisionFamiliaUsdPorUnidad > 0
                            ? row.comisionFamiliaUsdPorUnidad.toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCommissionUsd(row.comisionVendedor)}
                        </TableCell>
                        <TableCell className="text-right">
                          <CommissionPayoutCell
                            name={row.vendedorPostventa}
                            amount={row.comisionPostventa}
                            formatUsd={formatCommissionUsd}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <CommissionPayoutCell
                            name={row.vendedorReferido}
                            amount={row.comisionReferido}
                            formatUsd={formatCommissionUsd}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {reportData.length > 0 && (
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={8} className="text-right">
                          Totales (USD):
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCommissionUsd(totalVendedor)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCommissionUsd(totalPostventa)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCommissionUsd(totalReferido)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
