"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { DashboardMetrics } from "@/lib/storage"
import { formatCurrency, getActiveExchangeRates, type ExchangeRate } from "@/lib/currency-utils"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

// Función helper para formatear moneda siempre en USD como principal, Bs como secundario
const formatCurrencyWithUsdPrimary = (
  amountInBs: number,
  exchangeRates?: { USD?: ExchangeRate; EUR?: ExchangeRate }
): string => {
  // Intentar convertir a USD si hay tasa disponible
  const usdRate = exchangeRates?.USD?.rate

  if (usdRate && usdRate > 0) {
    const amountInUsd = amountInBs / usdRate
    const usdFormatted = formatCurrency(amountInUsd, "USD")
    const bsFormatted = formatCurrency(amountInBs, "Bs")
    return `${usdFormatted} (${bsFormatted})`
  }

  // Si no hay tasa USD, mostrar solo en Bs
  return formatCurrency(amountInBs, "Bs")
}

export function MetricsCards({ metrics, isLoading = false }: MetricsCardsProps) {
  const [exchangeRates, setExchangeRates] = useState<{ USD?: ExchangeRate; EUR?: ExchangeRate }>({})
  const [formattedPendingPayments, setFormattedPendingPayments] = useState<string>("")
  const [formattedAverageOrderValue, setFormattedAverageOrderValue] = useState<string>("")

  // Cargar tasas de cambio
  useEffect(() => {
    const loadExchangeRates = async () => {
      const rates = await getActiveExchangeRates()
      setExchangeRates(rates)
    }
    loadExchangeRates()
  }, [])

  // Formatear valores monetarios cuando cambien las métricas o las tasas
  useEffect(() => {
    setFormattedPendingPayments(formatCurrencyWithUsdPrimary(metrics.pendingPayments, exchangeRates))
    setFormattedAverageOrderValue(formatCurrencyWithUsdPrimary(metrics.averageOrderValue, exchangeRates))
  }, [metrics.pendingPayments, metrics.averageOrderValue, exchangeRates])

  const formatAmount = (amount: number) => formatCurrencyWithUsdPrimary(amount, exchangeRates)

  const metricsData = [
    {
      title: "Total Ventas",
      value: metrics.completedOrders.toString(),
      subtitle: "facturas generadas",
      change: metrics.completedOrdersChange,
      icon: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      title: "Total Facturado",
      subtitle: "(base imponible)",
      value: formatAmount(metrics.totalInvoiced || 0),
      change: null, // TODO: Calcular histórico
    },
    {
      title: "Total Cobrado",
      subtitle: "(ingresos reales)",
      value: formatAmount(metrics.totalCollected || 0),
      change: null, // TODO: Calcular histórico
      icon: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      title: "Ticket Promedio",
      value: formattedAverageOrderValue || formatCurrency(metrics.averageOrderValue, "Bs"),
      change: null,
    },
    {
      title: "Abonos por recaudar",
      subtitle: "(total pendiente)",
      value: formattedPendingPayments || formatCurrency(metrics.pendingPayments, "Bs"),
      change: metrics.pendingPaymentsChange,
    },
    {
      title: "SA Vencidos",
      subtitle: `${metrics.expiredLayawaysCount || 0} apartados vencidos`,
      value: formatAmount(metrics.expiredLayawaysAmount || 0),
      change: null,
      icon: AlertTriangle,
      iconColor: "text-red-500",
    },
    {
      title: "Productos por fabricar",
      value: metrics.productsToManufacture.toString(),
      change: metrics.productsToManufactureChange,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="relative">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-24 mb-4 animate-pulse" />
                  <div className="h-8 bg-muted rounded w-16 mb-2 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricsData.map((metric, index) => (
        <Card key={index} className="relative">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
                  {metric.icon && <metric.icon className={`w-4 h-4 ${metric.iconColor}`} />}
                </div>
                {metric.subtitle && <p className="text-xs text-muted-foreground mb-2">{metric.subtitle}</p>}
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                {metric.change !== null && (
                  <div className="flex items-center mt-2">
                    {metric.change > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${metric.change > 0 ? "text-green-500" : "text-red-500"}`}>
                      {Math.abs(metric.change)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
