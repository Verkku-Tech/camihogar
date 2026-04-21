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
  getCategories,
  getProducts,
  getSaleTypeCommissionRules,
  getCommissionSaleTypeLabelForOrder,
  type Order,
  type Category,
  type Product,
  type OrderCommissionLine,
} from "@/lib/storage"

interface CommissionReportRow {
  fecha: string
  cliente: string
  pedido: string
  vendedor: string
  descripcion: string
  cantidadArticulos: number
  tipoVenta: string
  comisionVendedor: number
  comisionPostventa: number
  comisionReferido: number
  vendedorPostventa?: string
  vendedorReferido?: string
}

function aggregateCommissionsByProduct(lines: OrderCommissionLine[]) {
  const m = new Map<string, { vendor: number; postventa: number; referrer: number }>()
  for (const c of lines) {
    if (!m.has(c.productId)) {
      m.set(c.productId, { vendor: 0, postventa: 0, referrer: 0 })
    }
    const b = m.get(c.productId)!
    if (c.payoutRole === "vendor") b.vendor += c.commission
    else if (c.payoutRole === "postventa") b.postventa += c.commission
    else b.referrer += c.commission
  }
  return m
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
        const [orders, categories, products, saleTypeRules] = await Promise.all([
          getOrders(),
          getCategories(),
          getProducts(),
          getSaleTypeCommissionRules(),
        ])

        // 2. Filtrar pedidos por fecha
        const startDateObj = new Date(startDate)
        const endDateObj = new Date(endDate)
        endDateObj.setHours(23, 59, 59, 999) // Incluir todo el día final

        const filteredOrders = orders.filter((order) => {
          if (order.status === "Generado" || order.status === "Generada") {
            return false
          }
          const orderDate = new Date(order.createdAt)
          return orderDate >= startDateObj && orderDate <= endDateObj
        })

        // 3. Calcular comisiones para cada pedido
        const reportRows: CommissionReportRow[] = []

        for (const order of filteredOrders) {
          const tipoVenta = getCommissionSaleTypeLabelForOrder(order, saleTypeRules)
          const lines = await calculateOrderCommissions(order)
          const byProduct = aggregateCommissionsByProduct(lines)

          for (const product of order.products) {
            const agg = byProduct.get(product.id)
            if (!agg) continue
            if (agg.vendor === 0 && agg.postventa === 0 && agg.referrer === 0) continue

            const productDesc = await formatProductDescription(
              product,
              categories,
              products
            )

            reportRows.push({
              fecha: order.createdAt,
              cliente: order.clientName,
              pedido: order.orderNumber,
              vendedor: order.vendorName,
              descripcion: productDesc,
              cantidadArticulos: product.quantity,
              tipoVenta,
              comisionVendedor: agg.vendor,
              comisionPostventa: agg.postventa,
              comisionReferido: agg.referrer,
              vendedorPostventa:
                agg.postventa > 0 ? order.postventaName?.trim() || "Post venta" : undefined,
              vendedorReferido: agg.referrer > 0 ? order.referrerName : undefined,
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
          const attr = category.attributes.find((a) => a.id?.toString() === key || a.title === key)
          if (attr) {
            let valueLabel = ""
            if (Array.isArray(value)) {
              const labels = value
                .map((v) => {
                  const attrValue = attr.values?.find((av) => {
                    if (typeof av === "string") {
                      return av === v
                    }
                    return av.id === v || av.label === v
                  })
                  return typeof attrValue === "string" ? attrValue : (attrValue?.label || v)
                })
                .filter(Boolean)
              valueLabel = labels.join(", ")
            } else {
              const attrValue = attr.values?.find((av) => {
                if (typeof av === "string") {
                  return av === value
                }
                return av.id === value || av.label === value
              })
              valueLabel = typeof attrValue === "string" ? attrValue : (attrValue?.label || String(value))
            }
            if (valueLabel) {
              attributeStrings.push(`${attr.title || attr.id}: ${valueLabel}`)
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
      const [orders, categories, products, saleTypeRules] = await Promise.all([
        getOrders(),
        getCategories(),
        getProducts(),
        getSaleTypeCommissionRules(),
      ])

      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      endDateObj.setHours(23, 59, 59, 999)

      const filteredOrders = orders.filter((order) => {
        if (order.status === "Generado" || order.status === "Generada") {
          return false
        }
        const orderDate = new Date(order.createdAt)
        return orderDate >= startDateObj && orderDate <= endDateObj
      })

      const commissionData: Record<string, unknown>[] = []
      for (const order of filteredOrders) {
        const tipoVenta = getCommissionSaleTypeLabelForOrder(order, saleTypeRules)
        const lines = await calculateOrderCommissions(order)
        const byProduct = aggregateCommissionsByProduct(lines)

        for (const product of order.products) {
          const agg = byProduct.get(product.id)
          if (!agg) continue
          if (agg.vendor === 0 && agg.postventa === 0 && agg.referrer === 0) continue

          const productDesc = await formatProductDescription(
            product,
            categories,
            products
          )

          const shared = agg.referrer > 0 || agg.postventa > 0
          commissionData.push({
            fecha: order.createdAt,
            cliente: order.clientName,
            vendedor: order.vendorName,
            pedido: order.orderNumber,
            descripcion: productDesc,
            cantidadArticulos: product.quantity,
            tipoVenta,
            comision: agg.vendor,
            vendedorSecundario: agg.referrer > 0 ? order.referrerName ?? null : null,
            comisionSecundaria: agg.referrer > 0 ? agg.referrer : null,
            vendedorPostventa: agg.postventa > 0 ? order.postventaName?.trim() || "Post venta" : null,
            comisionPostventa: agg.postventa > 0 ? agg.postventa : null,
            sueldoBase: 0,
            tasaComisionBase: 0,
            tasaAplicadaVendedor: 0,
            tasaAplicadaReferido: null,
            tasaAplicadaPostventa: null,
            esVentaCompartida: shared,
            esVendedorExclusivo: false,
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
                      <TableHead>Pedido</TableHead>
                      <TableHead>Vendedor tienda</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead>Tipo venta</TableHead>
                      <TableHead className="text-right">Com. vendedor</TableHead>
                      <TableHead className="text-right">Post venta</TableHead>
                      <TableHead className="text-right">Referido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.fecha)}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.cliente}</TableCell>
                        <TableCell className="font-mono text-sm">{row.pedido}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{row.vendedor}</TableCell>
                        <TableCell className="max-w-[240px]">{row.descripcion}</TableCell>
                        <TableCell className="text-center">{row.cantidadArticulos}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{row.tipoVenta}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCommissionUsd(row.comisionVendedor)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.comisionPostventa > 0
                            ? formatCommissionUsd(row.comisionPostventa)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.comisionReferido > 0
                            ? formatCommissionUsd(row.comisionReferido)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {reportData.length > 0 && (
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={7} className="text-right">
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

