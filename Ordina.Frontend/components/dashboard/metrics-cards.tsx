"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Minus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Wallet,
  Calculator,
  Clock,
  Hammer,
} from "lucide-react"
import type { DashboardMetrics, MetricChange } from "@/lib/storage"
import { formatCurrency, getActiveExchangeRates } from "@/lib/currency-utils"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  isLoading?: boolean
  period?: "day" | "week" | "month" | "year"
}

function getComparisonLabel(period: string = "day"): string {
  switch (period) {
    case "week":
      return "vs sem. anterior"
    case "month":
      return "vs mes anterior"
    case "year":
      return "vs año anterior"
    case "day":
    default:
      return "vs ayer"
  }
}

/** Render elegante de la variación con contexto del período y colores de intención */
function MetricChangeBadge({
  change,
  period = "day",
  tooltip,
}: {
  change: MetricChange | null
  period?: string
  tooltip?: string
}) {
  if (!change) return null

  if (!change.hasBase) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
        title={tooltip ?? "Sin base de comparación previa"}
      >
        <Minus className="w-3 h-3" />
        <span>Sin datos previos</span>
      </span>
    )
  }

  if (change.value === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
        title={tooltip ?? "Sin variación respecto al período anterior"}
      >
        <Minus className="w-3 h-3" />
        <span>0% {getComparisonLabel(period)}</span>
      </span>
    )
  }

  const isPositive = change.value > 0
  const isGood =
    (change.direction === "higher_is_better" && isPositive) ||
    (change.direction === "lower_is_better" && !isPositive)
  const Icon = isPositive ? TrendingUp : TrendingDown
  const colorClasses = isGood
    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"

  const prefix = isPositive ? "+" : ""

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClasses}`}
      title={tooltip}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>
        {prefix}{change.value}% {getComparisonLabel(period)}
      </span>
    </span>
  )
}

export function MetricsCards({
  metrics,
  isLoading = false,
  period = "day",
}: MetricsCardsProps) {
  const [usdRate, setUsdRate] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadExchangeRates = async () => {
      try {
        const rates = await getActiveExchangeRates()
        if (!cancelled && rates.USD?.rate) {
          setUsdRate(rates.USD.rate)
        }
      } catch (error) {
        console.error("Error loading exchange rate in MetricsCards:", error)
      }
    }
    void loadExchangeRates()
    return () => {
      cancelled = true
    }
  }, [])

  const formatUsd = (amount: number) => formatCurrency(amount || 0, "USD")
  const formatBs = (amountUsd: number) => {
    if (!usdRate || usdRate <= 0) return null
    return `≈ ${formatCurrency((amountUsd || 0) * usdRate, "Bs")}`
  }

  const changeTooltip = (change: MetricChange | null) => {
    if (!change) return undefined
    if (!change.hasBase) {
      return "vs periodo anterior: sin datos previos para comparar"
    }
    return `Actual: ${change.current} · Anterior: ${change.previous}`
  }

  const cardsConfig = [
    {
      title: "Total Ventas",
      subtitle: "Pedidos generados",
      mainValue: (metrics.completedOrders || 0).toString(),
      secondaryValue: "En el período seleccionado",
      change: metrics.completedOrdersChange,
      tooltip: changeTooltip(metrics.completedOrdersChange),
      icon: ShoppingCart,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
    {
      title: "Total Facturado",
      subtitle: "Base imponible",
      mainValue: formatUsd(metrics.totalInvoiced || 0),
      secondaryValue: formatBs(metrics.totalInvoiced || 0),
      change: metrics.totalInvoicedChange,
      tooltip: changeTooltip(metrics.totalInvoicedChange),
      icon: Receipt,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-500/10",
    },
    {
      title: "Total Cobrado",
      subtitle: "Ingresos reales recibidos",
      mainValue: formatUsd(metrics.totalCollected || 0),
      secondaryValue: formatBs(metrics.totalCollected || 0),
      change: metrics.totalCollectedChange,
      tooltip: changeTooltip(metrics.totalCollectedChange),
      icon: Wallet,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
    {
      title: "Ticket Promedio",
      subtitle: "Promedio por pedido",
      mainValue: formatUsd(metrics.averageOrderValue || 0),
      secondaryValue: formatBs(metrics.averageOrderValue || 0),
      change: metrics.averageOrderValueChange,
      tooltip: changeTooltip(metrics.averageOrderValueChange),
      icon: Calculator,
      iconColor: "text-violet-500",
      iconBg: "bg-violet-500/10",
    },
    {
      title: "Abonos por Recaudar",
      subtitle: "Saldo pendiente total",
      mainValue: formatUsd(metrics.pendingPayments || 0),
      secondaryValue: formatBs(metrics.pendingPayments || 0),
      change: metrics.pendingPaymentsChange,
      tooltip: changeTooltip(metrics.pendingPaymentsChange),
      icon: Clock,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      customBadge: (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          En pedidos activos
        </span>
      ),
    },
    {
      title: "SA Vencidos",
      subtitle: "Antigüedad > 90 días",
      mainValue: formatUsd(metrics.expiredLayawaysAmount || 0),
      secondaryValue: formatBs(metrics.expiredLayawaysAmount || 0),
      change: null,
      icon: AlertTriangle,
      iconColor: (metrics.expiredLayawaysCount || 0) > 0 ? "text-rose-500" : "text-muted-foreground",
      iconBg: (metrics.expiredLayawaysCount || 0) > 0 ? "bg-rose-500/10" : "bg-muted/50",
      isWarning: (metrics.expiredLayawaysCount || 0) > 0,
      customBadge: (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            (metrics.expiredLayawaysCount || 0) > 0
              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>{metrics.expiredLayawaysCount || 0} apartados vencidos</span>
        </span>
      ),
    },
    {
      title: "Por Fabricar",
      subtitle: "Cola de taller",
      mainValue: (metrics.productsToManufacture || 0).toString(),
      secondaryValue: "Piezas pendientes de fabricación",
      change: metrics.productsToManufactureChange,
      tooltip: changeTooltip(metrics.productsToManufactureChange),
      icon: Hammer,
      iconColor: "text-cyan-500",
      iconBg: "bg-cyan-500/10",
      customBadge: (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          En taller
        </span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {Array.from({ length: 7 }).map((_, index) => (
          <Card key={index} className="relative overflow-hidden border-border/50">
            <CardContent className="p-5 flex flex-col justify-between h-[165px]">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-muted rounded w-24 animate-pulse" />
                  <div className="h-3 bg-muted/60 rounded w-16 animate-pulse" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-muted/50 animate-pulse" />
              </div>
              <div className="space-y-1.5 my-2">
                <div className="h-7 bg-muted rounded w-32 animate-pulse" />
                <div className="h-3 bg-muted/60 rounded w-24 animate-pulse" />
              </div>
              <div className="h-5 bg-muted/40 rounded-full w-28 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
      {cardsConfig.map((card, index) => (
        <Card
          key={index}
          className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${
            card.isWarning
              ? "border-rose-500/30 bg-rose-500/[0.02]"
              : "border-border/60 hover:border-border"
          }`}
        >
          <CardContent className="p-5 flex flex-col justify-between h-[165px]">
            {/* Header: Title + Subtitle + Icon */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {card.title}
                </h3>
                {card.subtitle && (
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <div
                className={`p-2 rounded-lg ${card.iconBg} shrink-0`}
              >
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>

            {/* Metric Value: Hero Number + Secondary Value */}
            <div className="my-1">
              <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {card.mainValue}
              </p>
              {card.secondaryValue && (
                <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                  {card.secondaryValue}
                </p>
              )}
            </div>

            {/* Footer: Trend / Context Badge */}
            <div className="pt-0.5 flex items-center min-h-[24px]">
              {card.change ? (
                <MetricChangeBadge
                  change={card.change}
                  period={period}
                  tooltip={card.tooltip}
                />
              ) : (
                card.customBadge ?? <div className="h-5" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
