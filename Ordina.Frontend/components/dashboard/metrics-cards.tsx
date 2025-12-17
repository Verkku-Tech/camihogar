"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { DashboardMetrics } from "@/lib/storage"
import { formatCurrency } from "@/lib/currency-utils"

interface MetricsCardsProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

export function MetricsCards({ metrics, isLoading = false }: MetricsCardsProps) {
  const metricsData = [
    {
      title: "Pedidos completados",
      value: metrics.completedOrders.toString(),
      subtitle: "items",
      change: metrics.completedOrdersChange,
      icon: AlertTriangle,
      iconColor: "text-yellow-500",
    },
    {
      title: "Abonos por recaudar",
      subtitle: "(total)",
      value: formatCurrency(metrics.pendingPayments, "Bs"),
      change: metrics.pendingPaymentsChange,
    },
    {
      title: "Productos por fabricar",
      value: metrics.productsToManufacture.toString(),
      change: metrics.productsToManufactureChange,
    },
    {
      title: "Pedidos completados",
      subtitle: "(promedio)",
      value: formatCurrency(metrics.averageOrderValue, "Bs"),
      change: null,
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((index) => (
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
