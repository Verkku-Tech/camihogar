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
  getOrders,
  calculateOrderCommissions,
  getPurchaseType,
  getCategories,
  getProducts,
  type Order,
  type Category,
  type Product,
} from "@/lib/storage"

interface CommissionReportRow {
  fecha: string
  cliente: string
  vendedor: string
  descripcion: string
  cantidadArticulos: number
  tipoCompra: string
  comision: number
  vendedorSecundario?: string
  comisionSecundaria?: number
}

const TEAMS = [
  { value: "all", label: "Todos" },
  { value: "guatire", label: "Guatire (Lunes a Domingo)" },
  { value: "caracas", label: "Caracas (Sábado a Viernes)" },
  { value: "rrss", label: "RRSS (Mensual)" },
] as const

export function CommissionsReport() {
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [reportData, setReportData] = useState<CommissionReportRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Calcular datos del reporte desde IndexedDB (frontend-first)
  useEffect(() => {
    const loadReportData = async () => {
      // Las fechas son obligatorias
      if (!startDate || !endDate) {
        setReportData([])
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        // 1. Cargar pedidos desde IndexedDB (fuente de verdad)
        const orders = await getOrders()
        const categories = await getCategories()
        const products = await getProducts()

        // 2. Filtrar pedidos por fecha
        const startDateObj = new Date(startDate)
        const endDateObj = new Date(endDate)
        endDateObj.setHours(23, 59, 59, 999) // Incluir todo el día final

        const filteredOrders = orders.filter((order) => {
          const orderDate = new Date(order.createdAt)
          return orderDate >= startDateObj && orderDate <= endDateObj
        })

        // 3. Calcular comisiones para cada pedido
        const reportRows: CommissionReportRow[] = []

        for (const order of filteredOrders) {
          // Calcular comisiones del pedido
          const commissions = await calculateOrderCommissions(order)

          for (const comm of commissions) {
            const product = order.products.find((p) => p.id === comm.productId)
            if (!product) continue

            // Formatear descripción del producto
            const productDesc = await formatProductDescription(
              product,
              categories,
              products
            )

            reportRows.push({
              fecha: order.createdAt,
              cliente: order.clientName,
              vendedor: comm.sellerName,
              descripcion: productDesc,
              cantidadArticulos: product.quantity,
              tipoCompra: getPurchaseType(order),
              comision: comm.commission,
              vendedorSecundario: comm.isShared
                ? comm.sellerId === order.vendorId
                  ? order.referrerName
                  : order.vendorName
                : undefined,
              comisionSecundaria: comm.isShared ? comm.commission : undefined,
            })
          }
        }

        // 4. Ordenar por fecha (más reciente primero)
        reportRows.sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        )

        setReportData(reportRows)
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
  }, [startDate, endDate, selectedTeam])

  // Función para formatear descripción del producto
  const formatProductDescription = async (
    product: any,
    categories: Category[],
    allProducts: Product[]
  ): Promise<string> => {
    const parts = [product.name]

    // Agregar atributos si existen
    if (product.attributes && Object.keys(product.attributes).length > 0) {
      const category = categories.find((c) => c.name === product.category)
      if (category && category.attributes) {
        const attributeStrings: string[] = []

        for (const [key, value] of Object.entries(product.attributes)) {
          const attr = category.attributes.find((a) => a.id === key)
          if (attr) {
            let valueLabel = ""
            if (Array.isArray(value)) {
              const labels = value
                .map((v) => {
                  const attrValue = attr.values?.find((av) => av.id === v || av.label === v)
                  return attrValue?.label || v
                })
                .filter(Boolean)
              valueLabel = labels.join(", ")
            } else {
              const attrValue = attr.values?.find(
                (av) => av.id === value || av.label === value
              )
              valueLabel = attrValue?.label || String(value)
            }
            if (valueLabel) {
              attributeStrings.push(`${attr.name}: ${valueLabel}`)
            }
          }
        }

        if (attributeStrings.length > 0) {
          parts.push(attributeStrings.join(", "))
        }
      }
    }

    return parts.join(" | ")
  }

  const handleDownloadExcel = async () => {
    if (!startDate || !endDate) {
      toast.error("Las fechas son obligatorias para descargar el reporte")
      return
    }

    setIsDownloading(true)

    try {
      // Calcular datos desde IndexedDB (frontend-first)
      const orders = await getOrders()
      const categories = await getCategories()
      const products = await getProducts()

      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)

      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= startDateObj && orderDate <= endDateObj
      })

      // Calcular comisiones
      const commissionData: any[] = []
      for (const order of filteredOrders) {
        const commissions = await calculateOrderCommissions(order)
        for (const comm of commissions) {
          const product = order.products.find((p) => p.id === comm.productId)
          if (!product) continue

          const productDesc = await formatProductDescription(
            product,
            categories,
            products
          )

          commissionData.push({
            fecha: order.createdAt,
            cliente: order.clientName,
            vendedor: comm.sellerName,
            descripcion: productDesc,
            cantidadArticulos: product.quantity,
            tipoCompra: getPurchaseType(order),
            comision: comm.commission,
            vendedorSecundario: comm.isShared
              ? comm.sellerId === order.vendorId
                ? order.referrerName
                : order.vendorName
              : null,
            comisionSecundaria: comm.isShared ? comm.commission : null,
          })
        }
      }

      // Enviar datos calculados al backend para generar Excel
      const token = localStorage.getItem("auth_token")
      if (!token) {
        toast.error("No hay sesión activa")
        return
      }

      // Enviar datos al backend para generar Excel
      const response = await fetch(
        `/api/proxy/orders/api/Reports/Commissions/Excel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            startDate,
            endDate,
            team: selectedTeam === "all" ? null : selectedTeam,
            data: commissionData,
          }),
        }
      )

      if (!response.ok) {
        throw new Error("Error al generar el Excel")
      }

      const blob = await response.blob()
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: "VES",
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
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  // Calcular totales
  const totalComision = reportData.reduce((sum, row) => sum + row.comision, 0)
  const totalComisionSecundaria = reportData.reduce(
    (sum, row) => sum + (row.comisionSecundaria || 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros del Reporte</CardTitle>
          <CardDescription>
            Las fechas son obligatorias debido a los diferentes cortes de pago por equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Botón de descarga */}
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

      {/* Alerta si faltan fechas */}
      {(!startDate || !endDate) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Por favor, selecciona las fechas de inicio y fin para ver el reporte
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla de resultados */}
      {startDate && endDate && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
            <CardDescription>
              {reportData.length} {reportData.length === 1 ? "registro" : "registros"} encontrados
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
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Cant. Artículos</TableHead>
                      <TableHead>Tipo de compra</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.fecha)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.cliente}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.vendedor}</TableCell>
                        <TableCell className="max-w-[300px]">{row.descripcion}</TableCell>
                        <TableCell className="text-center">{row.cantidadArticulos}</TableCell>
                        <TableCell>{row.tipoCompra}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.comision)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {reportData.length > 0 && (
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={6} className="text-right">
                          Total Comisiones:
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totalComision)}
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

