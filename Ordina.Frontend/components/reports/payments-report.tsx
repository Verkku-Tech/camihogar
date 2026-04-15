"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Wifi, WifiOff, Loader2 } from "lucide-react"
import { getOrders, getAccounts, type Order, type PartialPayment, type Account } from "@/lib/storage"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

interface PaymentReportRow {
  id: string
  fecha: string
  pedido: string
  cliente: string
  metodoPago: string
  montoOriginal: number
  monedaOriginal: string
  montoBs: number
  /** Equivalente USD para pagos en Bs (tasa del día del pedido), desde API o cálculo local */
  montoUsd?: number
  referencia: string
  cuenta: string
  orderId: string
  paymentIndex: number
  paymentType: "mixed" | "partial" | "main"
  isConciliated: boolean
}

/** USD equivalente para filas en Bs usando tasas guardadas en el pedido */
function computeMontoUsdForBsPayment(
  order: Order,
  monedaOriginal: string,
  montoBs: number,
): number | undefined {
  if (monedaOriginal !== "Bs") return undefined
  const ex = order.exchangeRatesAtCreation as
    | { USD?: { rate: number }; usd?: { rate: number } }
    | undefined
  if (!ex) return undefined
  const rate = ex.USD?.rate ?? ex.usd?.rate
  if (rate == null || rate <= 0) return undefined
  return Math.round((montoBs / rate) * 100) / 100
}

const PAYMENT_METHODS = [
  "Todos",
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Efectivo",
  "Efectivo Bs",
  "Efectivo USD",
  "Efectivo EUR",
  "Facebank",
  "Mercantil Panamá",
  "Pago Móvil",
  "Paypal",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
  "Zelle",
] as const

/** Filtros virtuales: solo afectan moneda en frontend; el API recibe `Efectivo`. */
function effectiveCashCurrencyFilter(
  selected: string,
): "Bs" | "USD" | "EUR" | null {
  if (selected === "Efectivo Bs") return "Bs"
  if (selected === "Efectivo USD") return "USD"
  if (selected === "Efectivo EUR") return "EUR"
  return null
}

function backendPaymentMethodForFilter(selected: string): string {
  if (
    selected === "Efectivo Bs" ||
    selected === "Efectivo USD" ||
    selected === "Efectivo EUR"
  ) {
    return "Efectivo"
  }
  return selected
}

export function PaymentsReport() {
  const { hasPermission } = useAuth()
  const canConciliate = hasPermission("finance.conciliate")
  const [orders, setOrders] = useState<Order[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("Todos")
  const [selectedAccount, setSelectedAccount] = useState<string>("Todos")
  const [reportData, setReportData] = useState<PaymentReportRow[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [conciliatingId, setConciliatingId] = useState<string | null>(null)
  const [conciliatingBulk, setConciliatingBulk] = useState(false)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set())

  const effectiveCurrencyFilter = effectiveCashCurrencyFilter(selectedPaymentMethod)

  const filteredReportData = useMemo(() => {
    if (!effectiveCurrencyFilter) return reportData
    return reportData.filter((r) => r.monedaOriginal === effectiveCurrencyFilter)
  }, [reportData, effectiveCurrencyFilter])

  const reportTotals = useMemo(() => {
    const rows = filteredReportData
    return {
      montoBs: rows.reduce((s, r) => s + r.montoBs, 0),
      montoUsd: rows
        .filter((r) => r.monedaOriginal === "USD")
        .reduce((s, r) => s + r.montoOriginal, 0),
      montoEur: rows
        .filter((r) => r.monedaOriginal === "EUR")
        .reduce((s, r) => s + r.montoOriginal, 0),
      montoBsOriginal: rows
        .filter((r) => r.monedaOriginal === "Bs")
        .reduce((s, r) => s + r.montoOriginal, 0),
    }
  }, [filteredReportData])

  const selectableRows = useMemo(
    () => filteredReportData.filter((r) => r.orderId),
    [filteredReportData],
  )
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedRowIds.has(r.id))
  const selectedCount = selectedRowIds.size

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllSelectable = useCallback(() => {
    setSelectedRowIds(new Set(selectableRows.map((r) => r.id)))
  }, [selectableRows])

  const clearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set())
  }, [])

  // Limpiar selección al cambiar filtros (nueva consulta)
  useEffect(() => {
    setSelectedRowIds(new Set())
  }, [startDate, endDate, selectedPaymentMethod, selectedAccount])

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
        const backendPm = backendPaymentMethodForFilter(selectedPaymentMethod)
        if (backendPm !== "Todos") {
          params.append("paymentMethod", backendPm)
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
        // Mapear datos del backend (camelCase desde ASP.NET)
        const mappedData: PaymentReportRow[] = data.map((row: Record<string, unknown>) => {
          const orderId = String(row.orderId ?? "")
          const paymentType = (row.paymentType as string) || "main"
          const paymentIndex =
            typeof row.paymentIndex === "number" ? row.paymentIndex : -1
          return {
            id: `${orderId}-${paymentType}-${paymentIndex}`,
            fecha: String(row.fecha ?? ""),
            pedido: String(row.pedido ?? ""),
            cliente: String(row.cliente ?? ""),
            metodoPago: String(row.metodoPago ?? ""),
            montoOriginal: Number(row.montoOriginal ?? 0),
            monedaOriginal: String(row.monedaOriginal ?? ""),
            montoBs: Number(row.montoBs ?? 0),
            montoUsd: (() => {
              const raw =
                row.montoUsd ??
                (row as Record<string, unknown>).MontoUsd
              if (raw == null || raw === "") return undefined
              const n = Number(raw)
              return Number.isFinite(n) ? n : undefined
            })(),
            referencia: String(row.referencia ?? ""),
            cuenta: String(row.cuenta ?? ""),
            orderId,
            paymentIndex,
            paymentType: paymentType as "mixed" | "partial" | "main",
            isConciliated: Boolean(row.isConciliated),
          }
        })

        setReportData(mappedData)
      } catch (error) {
        console.error("Error loading report from backend:", error)
        // Fallback a datos locales
        generateLocalReportData()
      }
    }

    loadReportData()
  }, [orders, accounts, startDate, endDate, selectedPaymentMethod, selectedAccount, isOnline])

  // Función helper para obtener el monto original del pago en su moneda
  const getOriginalPaymentAmount = (
    payment: PartialPayment
  ): { amount: number; currency: string } => {
    const details = payment.paymentDetails;
    const detailsHasValues =
      details &&
      Object.values(details).some(
        (v) => v !== undefined && v !== null && v !== "" && v !== false,
      );

    // Para Efectivo, el monto original está en cashReceived
    if (
      payment.method === "Efectivo" &&
      details &&
      detailsHasValues &&
      details.cashReceived != null &&
      details.cashReceived > 0
    ) {
      return {
        amount: details.cashReceived,
        currency: details.cashCurrency || payment.currency || "Bs",
      };
    }

    // Si hay monto original guardado (para Pago Móvil y Transferencia)
    if (details && detailsHasValues && details.originalAmount !== undefined) {
      return {
        amount: details.originalAmount,
        currency: details.originalCurrency || payment.currency || "Bs",
      };
    }

    // Fallback: usar amount y currency directamente
    return {
      amount: payment.amount,
      currency: payment.currency || "Bs",
    };
  };

  // Función para generar datos localmente (fallback offline)
  const generateLocalReportData = () => {
    const backendPm = backendPaymentMethodForFilter(selectedPaymentMethod)

    const rows: PaymentReportRow[] = []
    const startDateObj = startDate ? new Date(startDate) : null
    const endDateObj = endDate ? new Date(endDate) : null
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999)

    orders.forEach((order) => {
        if (order.type?.toLowerCase() === "budget") return

        // Procesar pagos mixtos si existen
        if (order.mixedPayments && order.mixedPayments.length > 0) {
          order.mixedPayments.forEach((payment, index) => {
            const paymentDate = new Date(payment.date)
            
            // Filtrar por rango de fechas del pago
            if (startDateObj && paymentDate < startDateObj) return
            if (endDateObj && paymentDate > endDateObj) return

            // Filtrar por método de pago
            if (backendPm !== "Todos" && payment.method !== backendPm) {
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
            
            // Usar la función helper para obtener el monto original
            const originalPayment = getOriginalPaymentAmount(payment)
            const montoOriginal = originalPayment.amount
            const monedaOriginal = originalPayment.currency
            
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
              montoUsd: computeMontoUsdForBsPayment(order, monedaOriginal, montoBs),
              referencia: referencia,
              cuenta: cuenta,
              orderId: order.id,
              paymentIndex: index,
              paymentType: "mixed",
              isConciliated: Boolean(payment.paymentDetails?.isConciliated),
            })
          })
        }

        // Procesar pagos parciales si existen
        if (order.partialPayments && order.partialPayments.length > 0) {
          order.partialPayments.forEach((payment, index) => {
            const paymentDate = new Date(payment.date)
            
            // Filtrar por rango de fechas del pago
            if (startDateObj && paymentDate < startDateObj) return
            if (endDateObj && paymentDate > endDateObj) return

            // Filtrar por método de pago
            if (backendPm !== "Todos" && payment.method !== backendPm) {
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
            
            // Usar la función helper para obtener el monto original
            const originalPayment = getOriginalPaymentAmount(payment)
            const montoOriginal = originalPayment.amount
            const monedaOriginal = originalPayment.currency
            
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
              montoUsd: computeMontoUsdForBsPayment(order, monedaOriginal, montoBs),
              referencia: referencia,
              cuenta: cuenta,
              orderId: order.id,
              paymentIndex: index,
              paymentType: "partial",
              isConciliated: Boolean(payment.paymentDetails?.isConciliated),
            })
          })
        }

        // Si no hay pagos parciales ni mixtos, usar el pago principal
        if (
          (!order.partialPayments || order.partialPayments.length === 0) &&
          (!order.mixedPayments || order.mixedPayments.length === 0) &&
          order.paymentMethod
        ) {
          const orderDate = new Date(order.createdAt)
          
          // Filtrar por rango de fechas de la orden (para el pago principal)
          if (startDateObj && orderDate < startDateObj) return
          if (endDateObj && orderDate > endDateObj) return

          // Filtrar por método de pago
          if (backendPm !== "Todos" && order.paymentMethod !== backendPm) {
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
          
          // Para el pago principal, manejar especialmente pagos en efectivo
          let montoOriginal: number
          let monedaOriginal: string
          
          if (order.paymentMethod === "Efectivo" && order.paymentDetails?.cashReceived) {
            // Para Efectivo, usar cashReceived y cashCurrency
            montoOriginal = order.paymentDetails.cashReceived
            monedaOriginal = order.paymentDetails.cashCurrency || order.baseCurrency || "Bs"
          } else {
            // Para otros métodos, usar originalAmount y originalCurrency si están disponibles
            montoOriginal = order.paymentDetails?.originalAmount ?? order.total
            monedaOriginal = order.paymentDetails?.originalCurrency ?? order.baseCurrency ?? "Bs"
          }
          
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
            montoUsd: computeMontoUsdForBsPayment(order, monedaOriginal, montoBs),
            referencia: referencia,
            cuenta: cuenta,
            orderId: order.id,
            paymentIndex: -1,
            paymentType: "main",
            isConciliated: Boolean(order.paymentDetails?.isConciliated),
          })
        }
      })

      const currF = effectiveCashCurrencyFilter(selectedPaymentMethod)
      let finalRows = rows
      if (currF) {
        finalRows = rows.filter((r) => r.monedaOriginal === currF)
      }

      // Ordenar por fecha (más reciente primero)
      finalRows.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      setReportData(finalRows)
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

  const handleToggleConciliation = async (row: PaymentReportRow) => {
    if (conciliatingBulk) return
    if (!isOnline || !row.orderId) {
      toast.error("No se puede actualizar la conciliación en este momento.")
      return
    }
    setConciliatingId(row.id)
    try {
      const updated = await apiClient.conciliatePayments([
        {
          orderId: row.orderId,
          paymentType: row.paymentType,
          paymentIndex: row.paymentIndex,
          isConciliated: !row.isConciliated,
        },
      ])
      if (!updated) {
        toast.warning(
          "No se pudo actualizar. El pago podría no tener detalle guardado aún.",
        )
        return
      }
      toast.success(
        row.isConciliated
          ? "Conciliación desmarcada"
          : "Pago marcado como conciliado",
      )
      setReportData((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, isConciliated: !r.isConciliated } : r,
        ),
      )
    } catch (e) {
      console.error(e)
      toast.error(
        e instanceof Error ? e.message : "Error al actualizar conciliación",
      )
    } finally {
      setConciliatingId(null)
    }
  }

  const handleBulkSetConciliated = async (targetConciliated: boolean) => {
    if (!isOnline || conciliatingBulk || conciliatingId !== null) return
    const selected = filteredReportData.filter(
      (r) => selectedRowIds.has(r.id) && r.orderId,
    )
    const toUpdate = targetConciliated
      ? selected.filter((r) => !r.isConciliated)
      : selected.filter((r) => r.isConciliated)
    if (toUpdate.length === 0) {
      toast.info(
        targetConciliated
          ? "No hay pagos pendientes de conciliar en la selección."
          : "No hay pagos conciliados para desmarcar en la selección.",
      )
      return
    }
    setConciliatingBulk(true)
    try {
      const requests = toUpdate.map((r) => ({
        orderId: r.orderId,
        paymentType: r.paymentType,
        paymentIndex: r.paymentIndex,
        isConciliated: targetConciliated,
      }))
      const updated = await apiClient.conciliatePayments(requests)
      if (!updated) {
        toast.warning(
          "No se pudieron aplicar todos los cambios. Revisa que cada pago tenga detalle guardado.",
        )
        return
      }
      const ids = new Set(toUpdate.map((r) => r.id))
      setReportData((prev) =>
        prev.map((r) =>
          ids.has(r.id) ? { ...r, isConciliated: targetConciliated } : r,
        ),
      )
      setSelectedRowIds(new Set())
      toast.success(
        targetConciliated
          ? `${toUpdate.length} pago(s) marcado(s) como conciliado(s)`
          : `${toUpdate.length} pago(s) desmarcado(s)`,
      )
    } catch (e) {
      console.error(e)
      toast.error(
        e instanceof Error ? e.message : "Error en conciliación masiva",
      )
    } finally {
      setConciliatingBulk(false)
    }
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
      const excelBackendPm = backendPaymentMethodForFilter(selectedPaymentMethod)
      if (excelBackendPm !== "Todos") {
        params.append("paymentMethod", excelBackendPm)
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div>
            <CardTitle>Vista Previa del Reporte</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Total de registros: {filteredReportData.length}
            </p>
          </div>
          {canConciliate && filteredReportData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {selectedCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedCount} seleccionado(s)
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={
                  !isOnline ||
                  conciliatingBulk ||
                  conciliatingId !== null ||
                  selectedCount === 0
                }
                onClick={() => handleBulkSetConciliated(true)}
              >
                {conciliatingBulk ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aplicando…
                  </>
                ) : (
                  "Conciliar seleccionados"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  !isOnline ||
                  conciliatingBulk ||
                  conciliatingId !== null ||
                  selectedCount === 0
                }
                onClick={() => handleBulkSetConciliated(false)}
              >
                Desmarcar seleccionados
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canConciliate && (
                    <TableHead className="w-10 pr-2">
                      <Checkbox
                        checked={
                          allSelectableSelected
                            ? true
                            : selectedCount > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => {
                          if (checked === true) selectAllSelectable()
                          else clearRowSelection()
                        }}
                        disabled={
                          conciliatingBulk ||
                          conciliatingId !== null ||
                          selectableRows.length === 0
                        }
                        aria-label="Seleccionar todos los pagos conciliables"
                      />
                    </TableHead>
                  )}
                  <TableHead>Fecha</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Monto en Bs</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Referencia/Remitente</TableHead>
                  <TableHead>Conciliado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReportData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canConciliate ? 11 : 10}
                      className="text-center text-muted-foreground py-8"
                    >
                      No hay datos para mostrar con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                  {filteredReportData.map((row) => (
                    <TableRow key={row.id}>
                      {canConciliate && (
                        <TableCell className="w-10 pr-2">
                          {row.orderId ? (
                            <Checkbox
                              checked={selectedRowIds.has(row.id)}
                              onCheckedChange={() => toggleRowSelection(row.id)}
                              disabled={conciliatingBulk || conciliatingId !== null}
                              aria-label={`Seleccionar pago ${row.pedido}`}
                            />
                          ) : null}
                        </TableCell>
                      )}
                      <TableCell>{row.fecha}</TableCell>
                      <TableCell className="font-medium">{row.pedido}</TableCell>
                      <TableCell>{row.cliente}</TableCell>
                      <TableCell>
                        {row.metodoPago}
                        {row.monedaOriginal && row.monedaOriginal !== "Bs" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({row.monedaOriginal})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {row.monedaOriginal === "Bs" &&
                        row.montoUsd != null &&
                        Number.isFinite(row.montoUsd) &&
                        row.montoUsd > 0 ? (
                          <div>
                            <div className="font-medium">
                              {formatCurrency(row.montoUsd, "USD")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(row.montoOriginal, "Bs")}
                            </div>
                          </div>
                        ) : (
                          formatCurrency(row.montoOriginal, row.monedaOriginal)
                        )}
                      </TableCell>
                      <TableCell>
                        {row.monedaOriginal !== "Bs" &&
                        row.metodoPago === "Efectivo" ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          formatCurrency(row.montoBs, "Bs")
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{row.cuenta}</span>
                      </TableCell>
                      <TableCell>
                        <span className="max-w-xs truncate">
                          {row.referencia || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isConciliated ? "default" : "secondary"}>
                          {row.isConciliated ? "Sí" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canConciliate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              conciliatingBulk ||
                              (conciliatingId !== null &&
                                conciliatingId !== row.id)
                            }
                            onClick={() => handleToggleConciliation(row)}
                          >
                            {conciliatingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : row.isConciliated ? (
                              "Desmarcar"
                            ) : (
                              "Conciliar"
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/50 font-semibold">
                    {canConciliate && <TableCell aria-hidden />}
                    <TableCell colSpan={4}>Totales</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="space-y-0.5 text-xs">
                        {reportTotals.montoBsOriginal > 0 && (
                          <div>{formatCurrency(reportTotals.montoBsOriginal, "Bs")}</div>
                        )}
                        {reportTotals.montoUsd > 0 && (
                          <div>{formatCurrency(reportTotals.montoUsd, "USD")}</div>
                        )}
                        {reportTotals.montoEur > 0 && (
                          <div>{formatCurrency(reportTotals.montoEur, "EUR")}</div>
                        )}
                        {reportTotals.montoBsOriginal === 0 &&
                          reportTotals.montoUsd === 0 &&
                          reportTotals.montoEur === 0 && (
                          <span className="text-muted-foreground font-normal">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(reportTotals.montoBs, "Bs")}
                    </TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground text-xs font-normal">
                      Suma de la vista filtrada (conciliación con caja / POS / extractos)
                    </TableCell>
                  </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

