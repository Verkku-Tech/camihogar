"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Wifi, WifiOff, Loader2 } from "lucide-react"
import { getOrders, getAccounts, type Order, type PartialPayment, type Account } from "@/lib/storage"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface PaymentReportRow {
  id: string
  fecha: string
  pedido: string
  cliente: string
  metodoPago: string
  montoOriginal: number
  monedaOriginal: string
  montoBs: number
  referencia: string
  cuenta: string
  orderId: string
  paymentIndex: number
  paymentType: "mixed" | "partial" | "main"
}

const PAYMENT_METHODS = [
  "Todos",
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Efectivo",
  "Facebank",
  "Mercantil Panamá",
  "Pago Móvil",
  "Paypal",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
  "Zelle",
] as const

export function PaymentsReport() {
  const [orders, setOrders] = useState<Order[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("Todos")
  const [selectedAccount, setSelectedAccount] = useState<string>("Todos")
  const [reportData, setReportData] = useState<PaymentReportRow[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Detectar estado de conexión
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine)

      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)

      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  // Cargar pedidos y cuentas
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedOrders, loadedAccounts] = await Promise.all([
          getOrders(),
          getAccounts()
        ])
        setOrders(loadedOrders)
        setAccounts(loadedAccounts)
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Error al cargar los datos")
      }
    }
    loadData()
  }, [])

  // Cargar datos del reporte desde el backend
  useEffect(() => {
    const loadReportData = async () => {
      if (!isOnline) {
        // Si está offline, generar datos localmente como fallback
        generateLocalReportData()
        return
      }

      try {
        const token = localStorage.getItem("auth_token")
        if (!token) {
          toast.error("No hay sesión activa")
          generateLocalReportData()
          return
        }

        const params = new URLSearchParams()
        if (startDate) params.append("startDate", startDate)
        if (endDate) params.append("endDate", endDate)
        if (selectedPaymentMethod !== "Todos") {
          params.append("paymentMethod", selectedPaymentMethod)
        }
        if (selectedAccount !== "Todos") {
          params.append("accountId", selectedAccount)
        }

        const url = `/api/proxy/orders/api/Reports/Payments/Preview?${params.toString()}`
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
        // Mapear datos del backend al formato local
        const mappedData: PaymentReportRow[] = data.map((row: any) => ({
          id: `${row.pedido}-${row.fecha}-${row.metodoPago}`,
          fecha: row.fecha,
          pedido: row.pedido,
          cliente: row.cliente,
          metodoPago: row.metodoPago,
          montoOriginal: row.montoOriginal,
          monedaOriginal: row.monedaOriginal,
          montoBs: row.montoBs,
          referencia: row.referencia,
          cuenta: row.cuenta,
          orderId: "", // No disponible desde el backend
          paymentIndex: -1,
          paymentType: "main" as const,
        }))

        setReportData(mappedData)
      } catch (error) {
        console.error("Error loading report from backend:", error)
        // Fallback a datos locales
        generateLocalReportData()
      }
    }

    loadReportData()
  }, [orders, accounts, startDate, endDate, selectedPaymentMethod, selectedAccount, isOnline])

  // Función para generar datos localmente (fallback offline)
  const generateLocalReportData = () => {
    let filteredOrders = orders

    // Filtrar por fecha
    if (startDate || endDate) {
      filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt)
        if (startDate && orderDate < new Date(startDate)) return false
        if (endDate) {
          const endDateObj = new Date(endDate)
          endDateObj.setHours(23, 59, 59, 999) // Incluir todo el día final
          if (orderDate > endDateObj) return false
        }
        return true
      })
    }

    const rows: PaymentReportRow[] = []

      filteredOrders.forEach((order) => {
        // Procesar pagos mixtos si existen
        if (order.mixedPayments && order.mixedPayments.length > 0) {
          order.mixedPayments.forEach((payment, index) => {
            // Filtrar por método de pago
            if (selectedPaymentMethod !== "Todos" && payment.method !== selectedPaymentMethod) {
              return
            }

            // Filtrar por cuenta - solo si se especifica cuenta y el pago tiene accountId que coincida
            if (selectedAccount !== "Todos") {
              const paymentAccountId = payment.paymentDetails?.accountId
              if (!paymentAccountId || paymentAccountId !== selectedAccount) {
                return
              }
            }

            const referencia = getPaymentReference(payment, order)
            const cuenta = getAccountDisplay(payment)
            
            // Usar originalAmount y originalCurrency si están disponibles, sino usar amount y currency
            const montoOriginal = payment.paymentDetails?.originalAmount ?? payment.amount
            const monedaOriginal = payment.paymentDetails?.originalCurrency ?? payment.currency ?? "Bs"
            
            // Calcular monto en Bs: si la moneda original no es Bs, convertir usando exchangeRate
            const montoBs = monedaOriginal === "Bs" 
              ? montoOriginal 
              : montoOriginal * (payment.paymentDetails?.exchangeRate || 1)

            rows.push({
              id: `${order.id}-mixed-${index}`,
              fecha: formatDate(payment.date),
              pedido: order.orderNumber,
              cliente: order.clientName,
              metodoPago: payment.method,
              montoOriginal: montoOriginal,
              monedaOriginal: monedaOriginal,
              montoBs: montoBs,
              referencia: referencia,
              cuenta: cuenta,
              orderId: order.id,
              paymentIndex: index,
              paymentType: "mixed",
            })
          })
        }

        // Procesar pagos parciales si existen
        if (order.partialPayments && order.partialPayments.length > 0) {
          order.partialPayments.forEach((payment, index) => {
            // Filtrar por método de pago
            if (selectedPaymentMethod !== "Todos" && payment.method !== selectedPaymentMethod) {
              return
            }

            // Filtrar por cuenta - solo si se especifica cuenta y el pago tiene accountId que coincida
            if (selectedAccount !== "Todos") {
              const paymentAccountId = payment.paymentDetails?.accountId
              if (!paymentAccountId || paymentAccountId !== selectedAccount) {
                return
              }
            }

            const referencia = getPaymentReference(payment, order)
            const cuenta = getAccountDisplay(payment)
            
            // Usar originalAmount y originalCurrency si están disponibles, sino usar amount y currency
            const montoOriginal = payment.paymentDetails?.originalAmount ?? payment.amount
            const monedaOriginal = payment.paymentDetails?.originalCurrency ?? payment.currency ?? "Bs"
            
            // Calcular monto en Bs: si la moneda original no es Bs, convertir usando exchangeRate
            const montoBs = monedaOriginal === "Bs" 
              ? montoOriginal 
              : montoOriginal * (payment.paymentDetails?.exchangeRate || 1)

            rows.push({
              id: `${order.id}-partial-${index}`,
              fecha: formatDate(payment.date),
              pedido: order.orderNumber,
              cliente: order.clientName,
              metodoPago: payment.method,
              montoOriginal: montoOriginal,
              monedaOriginal: monedaOriginal,
              montoBs: montoBs,
              referencia: referencia,
              cuenta: cuenta,
              orderId: order.id,
              paymentIndex: index,
              paymentType: "partial",
            })
          })
        }

        // Si no hay pagos parciales ni mixtos, usar el pago principal
        if (
          (!order.partialPayments || order.partialPayments.length === 0) &&
          (!order.mixedPayments || order.mixedPayments.length === 0) &&
          order.paymentMethod
        ) {
          // Filtrar por método de pago
          if (selectedPaymentMethod !== "Todos" && order.paymentMethod !== selectedPaymentMethod) {
            return
          }

          // Filtrar por cuenta - solo si se especifica cuenta y el pago tiene accountId que coincida
          if (selectedAccount !== "Todos") {
            const paymentAccountId = order.paymentDetails?.accountId
            if (!paymentAccountId || paymentAccountId !== selectedAccount) {
              return
            }
          }

          const referencia = getMainPaymentReference(order)
          const cuenta = getMainAccountDisplay(order)
          
          // Usar originalAmount y originalCurrency si están disponibles
          const montoOriginal = order.paymentDetails?.originalAmount ?? order.total
          const monedaOriginal = order.paymentDetails?.originalCurrency ?? order.baseCurrency ?? "Bs"
          
          // Calcular monto en Bs: si la moneda original no es Bs, convertir usando exchangeRate
          const montoBs = monedaOriginal === "Bs" 
            ? montoOriginal 
            : montoOriginal * (order.paymentDetails?.exchangeRate || 1)

          rows.push({
            id: `${order.id}-main`,
            fecha: formatDate(order.createdAt),
            pedido: order.orderNumber,
            cliente: order.clientName,
            metodoPago: order.paymentMethod,
            montoOriginal: montoOriginal,
            monedaOriginal: monedaOriginal,
            montoBs: montoBs,
            referencia: referencia,
            cuenta: cuenta,
            orderId: order.id,
            paymentIndex: -1,
            paymentType: "main",
          })
        }
      })

      // Ordenar por fecha (más reciente primero)
      rows.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      setReportData(rows)
    }

  const getPaymentReference = (payment: PartialPayment, order: Order): string => {
    if (!order.paymentDetails && !payment.paymentDetails) return ""

    // Para Zelle, usar nombre del remitente (si está disponible)
    if (payment.method === "Zelle") {
      // Buscar en paymentDetails primero, luego en order.paymentDetails
      const ref = payment.paymentDetails?.transferenciaReference || order.paymentDetails?.transferenciaReference
      return ref || ""
    }

    // Para Pago Móvil
    if (payment.method === "Pago Móvil") {
      const ref = payment.paymentDetails?.pagomovilReference || order.paymentDetails?.pagomovilReference
      return ref || ""
    }

    // Para Transferencia
    if (payment.method === "Transferencia") {
      const ref = payment.paymentDetails?.transferenciaReference || order.paymentDetails?.transferenciaReference
      return ref || ""
    }

    return ""
  }

  const getMainPaymentReference = (order: Order): string => {
    if (!order.paymentDetails) return ""

    if (order.paymentMethod === "Zelle" && order.paymentDetails.transferenciaReference) {
      return order.paymentDetails.transferenciaReference
    }

    if (order.paymentMethod === "Pago Móvil" && order.paymentDetails.pagomovilReference) {
      return order.paymentDetails.pagomovilReference
    }

    if (order.paymentMethod === "Transferencia" && order.paymentDetails.transferenciaReference) {
      return order.paymentDetails.transferenciaReference
    }

    return ""
  }

  // Función para obtener el display de cuenta desde un pago parcial/mixto
  const getAccountDisplay = (payment: PartialPayment): string => {
    if (!payment.paymentDetails) return "-"
    
    // Si es cuenta digital, mostrar email
    if (payment.paymentDetails.email) {
      return payment.paymentDetails.email
    }
    
    // Si es cuenta bancaria, mostrar número enmascarado y banco
    if (payment.paymentDetails.accountNumber && payment.paymentDetails.bank) {
      return `${payment.paymentDetails.accountNumber} - ${payment.paymentDetails.bank}`
    }
    
    // Fallback: buscar en accounts por accountId
    if (payment.paymentDetails.accountId) {
      const account = accounts.find(acc => acc.id === payment.paymentDetails?.accountId)
      if (account) {
        if (account.accountType === "Cuentas Digitales") {
          return account.email || "-"
        } else {
          return `${account.label || account.code || ""}`
        }
      }
    }
    
    return "-"
  }

  // Función para obtener el display de cuenta desde el pago principal
  const getMainAccountDisplay = (order: Order): string => {
    if (!order.paymentDetails) return "-"
    
    // Si es cuenta digital, mostrar email
    if (order.paymentDetails.email) {
      return order.paymentDetails.email
    }
    
    // Si es cuenta bancaria, mostrar número enmascarado y banco
    if (order.paymentDetails.accountNumber && order.paymentDetails.bank) {
      return `${order.paymentDetails.accountNumber} - ${order.paymentDetails.bank}`
    }
    
    // Fallback: buscar en accounts por accountId
    if (order.paymentDetails.accountId) {
      const account = accounts.find(acc => acc.id === order.paymentDetails?.accountId)
      if (account) {
        if (account.accountType === "Cuentas Digitales") {
          return account.email || "-"
        } else {
          return `${account.label || account.code || ""}`
        }
      }
    }
    
    return "-"
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-VE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatCurrency = (amount: number, currency: string): string => {
    const currencyCode = currency === "Bs" ? "VES" : currency === "USD" ? "USD" : "EUR"
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const handleDownloadExcel = async () => {
    if (!isOnline) {
      toast.error("Se requiere conexión a internet para descargar el reporte")
      return
    }

    setIsDownloading(true)
    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        toast.error("No hay sesión activa")
        return
      }

      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      if (selectedPaymentMethod !== "Todos") {
        params.append("paymentMethod", selectedPaymentMethod)
      }
      if (selectedAccount !== "Todos") {
        params.append("accountId", selectedAccount)
      }

      const url = `/api/proxy/orders/api/Reports/Payments/Excel?${params.toString()}`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Error al generar el reporte")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `reporte_pagos_${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      toast.success("Reporte descargado correctamente")
    } catch (error) {
      console.error("Error downloading report:", error)
      toast.error("Error al descargar el reporte")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros del Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Fecha inicio */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Forma de Pago</Label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cuenta */}
            <div className="space-y-2">
              <Label htmlFor="account">Cuenta</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos</SelectItem>
                  {accounts
                    .filter((account) => account.id && account.id.trim() !== "")
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountType === "Cuentas Digitales"
                          ? account.email || "Cuenta Digital"
                          : `${account.label || account.code || ""}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón descargar */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={handleDownloadExcel}
              disabled={isDownloading || !isOnline}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
            {!isOnline && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <WifiOff className="h-4 w-4" />
                <span>Sin conexión</span>
              </div>
            )}
            {isOnline && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Wifi className="h-4 w-4" />
                <span>En línea</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de datos */}
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa del Reporte</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total de registros: {reportData.length}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Monto en Bs</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Referencia/Remitente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No hay datos para mostrar con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.fecha}</TableCell>
                      <TableCell className="font-medium">{row.pedido}</TableCell>
                      <TableCell>{row.cliente}</TableCell>
                      <TableCell>{row.metodoPago}</TableCell>
                      <TableCell>
                        {formatCurrency(row.montoOriginal, row.monedaOriginal)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(row.montoBs, "Bs")}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{row.cuenta}</span>
                      </TableCell>
                      <TableCell>
                        <span className="max-w-xs truncate">
                          {row.referencia || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

