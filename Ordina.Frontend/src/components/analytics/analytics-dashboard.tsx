"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Percent,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldAlert,
  BarChart3,
  Sparkles,
} from "lucide-react"
import {
  apiClient,
  type TrendDataPoint,
  type SaleTypeData,
  type TopSeller,
  type TopProduct,
  type PipelineSnapshot,
  type ExpiredLayawayAgeRange,
  type SalesForecastResponse,
} from "@/lib/api-client"
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react"
import { TrendChart } from "./trend-chart"
import { InvoicedVsCollectedChart } from "./invoiced-vs-collected-chart"
import { SaleTypeDonut } from "./sale-type-donut"
import { PipelineChart } from "./pipeline-chart"
import { TopSellersChart } from "./top-sellers-chart"
import { ExpiredAgeChart } from "./expired-age-chart"
import { TopProductsTable } from "./top-products-table"
import {
  TrendChartSkeleton,
  SaleTypeDonutSkeleton,
  InvoicedVsCollectedSkeleton,
  PipelineChartSkeleton,
  TopSellersSkeleton,
  ExpiredAgeSkeleton,
  TopProductsTableSkeleton,
} from "./chart-skeletons"

function KpiCardSkeleton({ accentClass }: { accentClass: string }) {
  return (
    <Card className="h-full border-border/70 shadow-sm overflow-hidden relative animate-pulse flex flex-col justify-between">
      <div className={`h-1 w-full ${accentClass} absolute top-0 left-0 opacity-40`} />
      <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-16 bg-muted/80 rounded" />
            <div className="w-6 h-6 rounded-md bg-muted/60" />
          </div>
          <div className="h-7 w-28 bg-muted/90 rounded font-mono" />
        </div>
        <div className="mt-2 min-h-[34px] flex flex-col justify-end">
          <div className="h-3 w-24 bg-muted/70 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

type Period = "day" | "week" | "month" | "year"

export function AnalyticsDashboard() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const canAccess =
    user?.role === "Super Administrator" || user?.role === "Administrator"

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState<Period>("month")
  const [isLoading, setIsLoading] = useState(true)

  // Data states
  const [metrics, setMetrics] = useState<any>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [forecastData, setForecastData] = useState<SalesForecastResponse | null>(null)
  const [saleTypeData, setSaleTypeData] = useState<SaleTypeData[]>([])
  const [topSellers, setTopSellers] = useState<TopSeller[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [pipelineData, setPipelineData] = useState<PipelineSnapshot | null>(null)
  const [expiredAging, setExpiredAging] = useState<ExpiredLayawayAgeRange[]>([])

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const trendDays = period === "year" ? 1095 : 180
      const [
        metricsRes,
        trendRes,
        forecastRes,
        saleTypeRes,
        topSellersRes,
        topProductsRes,
        pipelineRes,
        expiredAgingRes,
      ] = await Promise.allSettled([
        apiClient.getDashboardMetrics(period, signal),
        apiClient.getSalesTrend(trendDays, signal),
        apiClient.getSalesForecast(period, signal),
        apiClient.getBySaleType(period, signal),
        apiClient.getTopSellers(period, 10, signal),
        apiClient.getTopProducts(period, 10, signal),
        apiClient.getPipelineSnapshot(signal),
        apiClient.getExpiredLayawaysByAge(signal),
      ])

      // ponytail: if aborted by StrictMode cleanup or period change, do not overwrite state or clear loading
      if (signal?.aborted) return

      if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value)
      if (trendRes.status === "fulfilled") setTrendData(trendRes.value)
      if (forecastRes.status === "fulfilled") setForecastData(forecastRes.value)
      if (saleTypeRes.status === "fulfilled") setSaleTypeData(saleTypeRes.value)
      if (topSellersRes.status === "fulfilled") setTopSellers(topSellersRes.value)
      if (topProductsRes.status === "fulfilled") setTopProducts(topProductsRes.value)
      if (pipelineRes.status === "fulfilled") setPipelineData(pipelineRes.value)
      if (expiredAgingRes.status === "fulfilled") setExpiredAging(expiredAgingRes.value)
    } catch {
      // Handled by allSettled
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [period])

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  if (!isAuthLoading && !canAccess) {
    return (
      <div className="flex h-full bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 flex items-center justify-center p-6 min-w-0 overflow-hidden">
            <Card className="max-w-md w-full text-center border-border/70 shadow-xl">
              <CardHeader>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-2 ring-1 ring-rose-500/20">
                  <ShieldAlert className="w-7 h-7 text-rose-500" />
                </div>
                <CardTitle className="text-xl font-bold tracking-tight">Acceso Restringido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  El panel de estadísticas ejecutivas y análisis de ventas está reservado para perfiles de Dirección y Administración.
                </p>
                <Button variant="outline" asChild className="shadow-sm">
                  <a href="/">Volver a Operaciones (Home)</a>
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    )
  }

  // Calculations
  const totalSales = metrics?.totalInvoiced ?? metrics?.totalSalesUsd ?? 0
  const totalCollected = metrics?.totalCollected ?? metrics?.totalCollectedUsd ?? 0
  const casheaFinanced = metrics?.casheaFinancedAmount ?? 0
  const collectionRate = totalSales > 0 ? ((totalCollected / totalSales) * 100).toFixed(1) : "0.0"
  const totalOrders = metrics?.totalSalesCount ?? metrics?.completedOrders ?? metrics?.totalOrders ?? 0
  const averageTicket = metrics?.averageOrderValue ?? (totalOrders > 0 ? totalSales / totalOrders : 0)
  const activeLayawaysCount = metrics?.activeLayawaysCount ?? (totalOrders > 0 ? Math.round(totalOrders * 0.2) : 0)
  const activeLayawaysBalance = metrics?.pendingPayments ?? metrics?.activeLayawaysBalanceUsd ?? 0
  const expiredLayawaysCount = metrics?.expiredLayawaysCount ?? 0
  const expiredLayawaysBalance = metrics?.expiredLayawaysAmount ?? metrics?.expiredLayawaysBalanceUsd ?? 0

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
          <AppBreadcrumb />
          
          <div className="space-y-6 min-w-0 max-w-full">
            {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card/60 backdrop-blur-sm p-4 rounded-2xl border border-border/70 shadow-sm">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Dashboard de Rendimiento y Analítica
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Métricas clave de negocio, proyecciones estadísticas y salud operativa de pedidos.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap max-w-full overflow-x-auto no-scrollbar">
              {/* Period Selector Tabs */}
              <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 shadow-inner shrink-0">
                {(
                  [
                    { key: "day", label: "Hoy" },
                    { key: "week", label: "Esta Semana" },
                    { key: "month", label: "Este Mes" },
                    { key: "year", label: "Este Año" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${period === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={isLoading}
                className="h-9 gap-1.5 shadow-sm rounded-xl hover:bg-muted/80 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline text-xs font-medium">Actualizar</span>
              </Button>
            </div>
          </div>

          {/* Top KPI Cards (Curated Palette & Visual Weight) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-stretch">

            {/* Pedidos */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-orders"
              fallback={<KpiCardSkeleton accentClass="bg-amber-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-amber-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-amber-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Pedidos</span>
                      <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      {totalOrders}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground">Órdenes generadas</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Facturado */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-invoiced"
              fallback={<KpiCardSkeleton accentClass="bg-emerald-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Facturado</span>
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${totalSales.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground">Venta bruta del período</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Cobrado */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-collected"
              fallback={<KpiCardSkeleton accentClass="bg-blue-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-blue-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-blue-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Cobrado</span>
                      <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${totalCollected.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground">Recaudo real efectivo/banco</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Ratio Cobranza */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-collection-rate"
              fallback={<KpiCardSkeleton accentClass="bg-emerald-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-emerald-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">% Cobranza</span>
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Percent className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      {collectionRate}%
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(Number(collectionRate), 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Ticket Promedio */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-average-ticket"
              fallback={<KpiCardSkeleton accentClass="bg-indigo-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-indigo-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-indigo-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Ticket Prom.</span>
                      <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${averageTicket.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground">Promedio por orden</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* SA Activo */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-active-layaways"
              fallback={<KpiCardSkeleton accentClass="bg-cyan-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-cyan-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-cyan-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">SA Activos</span>
                      <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${activeLayawaysBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground font-medium">{activeLayawaysCount} apartados vigentes</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* SA Vencidos */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-expired-layaways"
              fallback={<KpiCardSkeleton accentClass="bg-rose-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/60 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-rose-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-rose-500 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider">SA Vencidos</span>
                      <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-500">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-rose-600 dark:text-rose-400 font-mono">
                      ${expiredLayawaysBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                        {expiredLayawaysCount} pedidos
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Excl. reservas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Cashea */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-collected"
              fallback={<KpiCardSkeleton accentClass="bg-yellow-500" />}
            >
              <Card className="h-full flex flex-col justify-between border-border/70 hover:border-yellow-500/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 shadow-sm overflow-hidden relative">
                <div className="h-1 w-full bg-yellow-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Cashea</span>
                      <div className="w-6 h-6 rounded-md bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      +${casheaFinanced.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <p className="text-[11px] text-muted-foreground">Financiado con cashea</p>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>
          </div>

          {/* Charts Row 1: Sales Trend & Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-2 h-full flex flex-col">
              {isLoading ? (
                <TrendChartSkeleton />
              ) : (
                <TrendChart
                  data={trendData}
                  forecast={forecastData}
                  period={period}
                  isLoading={isLoading}
                />
              )}
            </div>
            <div className="h-full flex flex-col">
              {isLoading ? (
                <SaleTypeDonutSkeleton />
              ) : (
                <SaleTypeDonut data={saleTypeData} isLoading={isLoading} />
              )}
            </div>
          </div>

          {/* Charts Row 2: Invoiced vs Collected & Production Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="h-full flex flex-col">
              {isLoading ? (
                <InvoicedVsCollectedSkeleton />
              ) : (
                <InvoicedVsCollectedChart data={trendData} isLoading={isLoading} />
              )}
            </div>
            <div className="h-full flex flex-col">
              {isLoading ? (
                <PipelineChartSkeleton />
              ) : (
                <PipelineChart data={pipelineData} isLoading={isLoading} />
              )}
            </div>
          </div>

          {/* Charts Row 3: Top Sellers & Expired Layaway Aging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="h-full flex flex-col">
              {isLoading ? (
                <TopSellersSkeleton />
              ) : (
                <TopSellersChart data={topSellers} isLoading={isLoading} />
              )}
            </div>
            <div className="h-full flex flex-col">
              {isLoading ? (
                <ExpiredAgeSkeleton />
              ) : (
                <ExpiredAgeChart data={expiredAging} isLoading={isLoading} />
              )}
            </div>
          </div>

          {/* Top Products Table */}
          <div>
            {isLoading ? (
              <TopProductsTableSkeleton />
            ) : (
              <TopProductsTable data={topProducts} isLoading={isLoading} />
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  )
}
