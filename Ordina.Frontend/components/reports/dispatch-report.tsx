"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DELIVERY_ZONES } from "@/components/orders/new-order-dialog"

interface DispatchReportRow {
  fecha: string
  notaDespacho: string
  cliente: string
  telefono1: string
  telefono2: string
  cantidadTotal: number
  descripcion: string
  zona: string
  direccion: string
  observaciones: string
  estadoPago: string
  importeTotal: number
}

export function DispatchReport() {
  const [selectedZone, setSelectedZone] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [reportData, setReportData] = useState<DispatchReportRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Cargar datos del reporte desde el backend
  useEffect(() => {
    const loadReportData = async () => {
      setIsLoading(true)

      try {
        const token = localStorage.getItem("auth_token")
        if (!token) {
          toast.error("No hay sesión activa")
          setIsLoading(false)
          return
        }

        const params = new URLSearchParams()
        if (selectedZone && selectedZone !== "all") {
          params.append("deliveryZone", selectedZone)
        }
        if (startDate) {
          params.append("startDate", startDate)
        }
        if (endDate) {
          params.append("endDate", endDate)
        }

        const url = `/api/proxy/orders/api/Reports/Dispatch/Preview?${params.toString()}`
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Error al cargar el reporte")
        }

        const data = await response.json()
        setReportData(data)
      } catch (error) {
        console.error("Error loading report from backend:", error)
        toast.error("Error al cargar el reporte de despacho")
        setReportData([])
      } finally {
        setIsLoading(false)
      }
    }

    loadReportData()
  }, [selectedZone, startDate, endDate])

  const handleDownloadExcel = async () => {
    setIsDownloading(true)

    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        toast.error("No hay sesión activa")
        return
      }

        const params = new URLSearchParams()
        if (selectedZone && selectedZone !== "all") {
          params.append("deliveryZone", selectedZone)
        }
      if (startDate) {
        params.append("startDate", startDate)
      }
      if (endDate) {
        params.append("endDate", endDate)
      }

      const url = `/api/proxy/orders/api/Reports/Dispatch/Excel?${params.toString()}`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Error al descargar el reporte")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `Reporte_Despacho_${new Date().toISOString().split("T")[0]}.xlsx`
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("es-VE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  // Calcular totales
  const totalImporte = reportData.reduce((sum, row) => sum + row.importeTotal, 0)

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros del Reporte</CardTitle>
          <CardDescription>
            Filtro principal por Zona para organizar los pedidos por ruta. Las fechas son opcionales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zone">
                Zona (Recomendado)
              </Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger id="zone">
                  <SelectValue placeholder="Todas las zonas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las zonas</SelectItem>
                  {DELIVERY_ZONES.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Desde (Opcional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Hasta (Opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón de descarga */}
      <div className="flex justify-end">
        <Button
          onClick={handleDownloadExcel}
          disabled={isDownloading || isLoading}
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

      {/* Tabla de resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados del Reporte</CardTitle>
          <CardDescription>
            {reportData.length} {reportData.length === 1 ? "pedido" : "pedidos"} encontrados
            {selectedZone && selectedZone !== "all" && ` en zona: ${DELIVERY_ZONES.find(z => z.value === selectedZone)?.label || selectedZone}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando reporte...</span>
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron pedidos para los filtros seleccionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nota de despacho</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefono1</TableHead>
                    <TableHead>Telefono2</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead>Estado de Pago</TableHead>
                    <TableHead className="text-right">Importe Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.fecha)}
                      </TableCell>
                      <TableCell className="font-medium">{row.notaDespacho}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.cliente}</TableCell>
                      <TableCell>{row.telefono1}</TableCell>
                      <TableCell>{row.telefono2}</TableCell>
                      <TableCell className="text-center">{row.cantidadTotal}</TableCell>
                      <TableCell className="max-w-[300px]">{row.descripcion}</TableCell>
                      <TableCell>{row.zona}</TableCell>
                      <TableCell className="max-w-[200px]">{row.direccion}</TableCell>
                      <TableCell className="max-w-[200px]">{row.observaciones}</TableCell>
                      <TableCell>{row.estadoPago}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.importeTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {reportData.length > 0 && (
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={11} className="text-right">
                        Total Importe:
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(totalImporte)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

