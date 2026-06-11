"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Minus, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import type { DashboardMetrics, MetricChange } from "@/lib/storage"
import { formatCurrency, getActiveExchangeRates } from "@/lib/currency-utils"
import {
  commercialRatesToExchangeRatesInput,
  formatCommercialDualDisplay,
} from "@/lib/order-currency-display"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

/** Monto ya en USD comercial (pendientes, ticket promedio, SA vencidos). */
function formatMetricUsdAmount(
  amountUsd: number,
  liveRates?: { USD?: { rate: number }; EUR?: { rate: number } },
): string {
  return formatCommercialDualDisplay(amountUsd, "USD", {
    commercialRates: liveRates,
    liveRates,
  })
}

/** Render compacto de la variación; gris si 0%/sin base. */
function MetricChangeBadge({
  change,
  tooltip,
}: {
  change: MetricChange | null
  tooltip?: string
}) {
  if (!change) return null

  if (!change.hasBase) {
    return (
      <div
        className="flex items-center mt-2 text-muted-foreground"
        title={tooltip ?? "Sin base de comparación"}
      >
        <Minus className="w-4 h-4 mr-1" />
        <span className="text-sm font-medium">—</span>
      </div>
    )
  }

  if (change.value === 0) {
    return (
      <div
        className="flex items-center mt-2 text-muted-foreground"
        title={tooltip ?? "Sin variación"}
      >
        <Minus className="w-4 h-4 mr-1" />
        <span className="text-sm font-medium">0%</span>
      </div>
    )
  }

  const isPositive = change.value > 0
  const isGood =
    (change.direction === "higher_is_better" && isPositive) ||
    (change.direction === "lower_is_better" && !isPositive)
  const Icon = isPositive ? TrendingUp : TrendingDown
  const color = isGood ? "text-green-500" : "text-red-500"

  return (
    <div className={`flex items-center mt-2 ${color}`} title={tooltip}>
      <Icon className="w-4 h-4 mr-1" />
      <span className="text-sm font-medium">{Math.abs(change.value)}%</span>
    </div>
  )
}

export function MetricsCards({ metrics, isLoading = false }: MetricsCardsProps) {
  const [liveRatesInput, setLiveRatesInput] = useState<
    { USD?: { rate: number }; EUR?: { rate: number } } | undefined
  >()
  const [formattedPendingPayments, setFormattedPendingPayments] = useState<string>("")
  const [formattedAverageOrderValue, setFormattedAverageOrderValue] = useState<string>("")

  useEffect(() => {
    const loadExchangeRates = async () => {
      const rates = await getActiveExchangeRates()
      setLiveRatesInput(
        commercialRatesToExchangeRatesInput({
          USD: rates.USD,
          EUR: rates.EUR,
        }),
      )
    }
    void loadExchangeRates()
  }, [])

  useEffect(() => {
    if (!liveRatesInput) return
    setFormattedPendingPayments(
      formatMetricUsdAmount(metrics.pendingPayments, liveRatesInput),
    )
    setFormattedAverageOrderValue(
      formatMetricUsdAmount(metrics.averageOrderValue, liveRatesInput),
    )
  }, [metrics.pendingPayments, metrics.averageOrderValue, liveRatesInput])

  const formatUsdAmount = (amount: number) =>
    liveRatesInput
      ? formatMetricUsdAmount(amount, liveRatesInput)
      : formatCurrency(amount, "USD")

  const changeTooltip = (change: MetricChange | null) => {
    if (!change) return undefined
    if (!change.hasBase) {
      return "vs periodo anterior: sin datos previos para comparar"
    }
    return `Actual: ${change.current} · Anterior: ${change.previous}`
  }

  const metricsData: Array<{
    title: string
    subtitle?: string
    value: string
    change: MetricChange | null
    icon?: typeof TrendingUp
    iconColor?: string
  }> = [
    {
      title: "Total Ventas",
      subtitle: "facturas generadas",
      value: metrics.completedOrders.toString(),
      change: metrics.completedOrdersChange,
      icon: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      title: "Total Facturado",
      subtitle: "(base imponible)",
      value: formatUsdAmount(metrics.totalInvoiced || 0),
      change: metrics.totalInvoicedChange,
    },
    {
      title: "Total Cobrado",
      subtitle: "(ingresos reales)",
      value: formatUsdAmount(metrics.totalCollected || 0),
      change: metrics.totalCollectedChange,
      icon: TrendingUp,
      iconColor: "text-green-500",
    },
    {
      title: "Ticket Promedio",
      value:
        formattedAverageOrderValue ||
        formatCurrency(metrics.averageOrderValue, "USD"),
      change: metrics.averageOrderValueChange,
    },
    {
      title: "Abonos por recaudar",
      subtitle: "(total pendiente)",
      value:
        formattedPendingPayments ||
        formatCurrency(metrics.pendingPayments, "USD"),
      change: metrics.pendingPaymentsChange,
    },
    {
      title: "SA Vencidos",
      subtitle: `${metrics.expiredLayawaysCount || 0} apartados vencidos`,
      value: formatUsdAmount(metrics.expiredLayawaysAmount || 0),
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
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </h3>
                  {metric.icon && (
                    <metric.icon className={`w-4 h-4 ${metric.iconColor}`} />
                  )}
                </div>
                {metric.subtitle && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {metric.subtitle}
                  </p>
                )}
                <p className="text-2xl font-bold text-foreground">
                  {metric.value}
                </p>
                <MetricChangeBadge
                  change={metric.change}
                  tooltip={changeTooltip(metric.change)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
