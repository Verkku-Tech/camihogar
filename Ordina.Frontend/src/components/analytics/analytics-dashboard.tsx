"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useNavigation } from "@/contexts/navigation-context"
import { Sidebar } from "@/components/layout/sidebar"
import { HomeHeader as DashboardHeader } from "@/components/home/home-header"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
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
  Store,
  ChevronDown,
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
  type AovByBranch,
  type AgingReport,
  type PaymentMix,
  type ManufacturingLeadTime,
  type OtifMetrics,
  type StageDwellTime,
  type FulfillmentRatio,
  type ConversionRate,
  type ClosingVelocity,
  type ReplenishmentSuggestion,
  type StockTurnover,
  type StockoutRate,
  type StoreOccupancy,
} from "@/lib/api-client"
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react"
import { TrendChart } from "./trend-chart"
import { InvoicedVsCollectedChart } from "./invoiced-vs-collected-chart"
import { SaleTypeDonut } from "./sale-type-donut"
import { PipelineChart } from "./pipeline-chart"
import { TopSellersChart } from "./top-sellers-chart"
import { ExpiredAgeChart } from "./expired-age-chart"
import { TopProductsTable } from "./top-products-table"
import { PaymentMixDonut } from "./payment-mix-donut"
import { UnliquidatedAgingChart } from "./unliquidated-aging-chart"
import { AgingOrdersModal } from "./aging-orders-modal"
import { KpiDrillDownModal, type KpiDrillDownType } from "./kpi-drilldown-modal"
import { OperationsMetricsCard } from "./operations-metrics-card"
import { FunnelMetricsCard } from "./funnel-metrics-card"
import { InventoryIntelligenceCard } from "./inventory-intelligence-card"
import {
  TrendChartSkeleton,
  SaleTypeDonutSkeleton,
  InvoicedVsCollectedSkeleton,
  PipelineChartSkeleton,
  TopSellersSkeleton,
  ExpiredAgeSkeleton,
  TopProductsTableSkeleton,
  OperationsMetricsSkeleton,
  FunnelMetricsSkeleton,
  PaymentMixDonutSkeleton,
  UnliquidatedAgingSkeleton,
  InventoryIntelligenceSkeleton,
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
  const { isNavigationItemVisible, navigationItems } = useNavigation()

  const analyticsConfig = navigationItems.find((n) => n.id === "analytics")
  const hasCustomConfig =
    (analyticsConfig?.allowedRoles && analyticsConfig.allowedRoles.length > 0) ||
    analyticsConfig?.superAdminOnly
  const canAccess = hasCustomConfig
    ? isNavigationItemVisible("analytics", user?.role)
    : (user?.role === "Super Administrator" || user?.role === "Administrator")

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState<Period>("month")
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [availableStores, setAvailableStores] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiClient.getStores().then((stores) => {
      if (stores && Array.isArray(stores)) {
        setAvailableStores(stores.map(s => ({ id: s.id, name: s.name })))
      }
    }).catch(() => {})
  }, [])

  // Data states
  const [metrics, setMetrics] = useState<any>(null)
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([])
  const [forecastData, setForecastData] = useState<SalesForecastResponse | null>(null)
  const [saleTypeData, setSaleTypeData] = useState<SaleTypeData[]>([])
  const [topSellers, setTopSellers] = useState<TopSeller[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [pipelineData, setPipelineData] = useState<PipelineSnapshot | null>(null)
  const [expiredAging, setExpiredAging] = useState<ExpiredLayawayAgeRange[]>([])

  // BI Data states
  const [aovBranches, setAovBranches] = useState<AovByBranch[]>([])
  const [agingUnliquidated, setAgingUnliquidated] = useState<AgingReport[]>([])
  const [paymentMix, setPaymentMix] = useState<PaymentMix[]>([])
  const [leadTimes, setLeadTimes] = useState<ManufacturingLeadTime[]>([])
  const [otif, setOtif] = useState<OtifMetrics | null>(null)
  const [stageDwellTimes, setStageDwellTimes] = useState<StageDwellTime[]>([])
  const [fulfillment, setFulfillment] = useState<FulfillmentRatio | null>(null)
  const [conversion, setConversion] = useState<ConversionRate | null>(null)
  const [velocity, setVelocity] = useState<ClosingVelocity | null>(null)
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([])
  const [turnover, setStockTurnover] = useState<StockTurnover | null>(null)
  const [stockouts, setStockouts] = useState<StockoutRate | null>(null)
  const [occupancy, setOccupancy] = useState<StoreOccupancy[]>([])

  // Modal drill-down state
  const [agingModalOpen, setAgingModalOpen] = useState(false)
  const [agingModalType, setAgingModalType] = useState<"unliquidated" | "expired_layaways">("unliquidated")
  const [agingModalRange, setAgingModalRange] = useState<string | null>(null)
  const [agingModalTitle, setAgingModalTitle] = useState<string>("")

  const handleOpenUnliquidatedModal = (range: string, label: string) => {
    setAgingModalType("unliquidated")
    setAgingModalRange(range)
    setAgingModalTitle(range === "all" ? "Saldos Pendientes por Cobrar (Todos)" : `Saldos Pendientes (${label})`)
    setAgingModalOpen(true)
  }

  const handleOpenExpiredLayawaysModal = (range: string, label: string) => {
    setAgingModalType("expired_layaways")
    setAgingModalRange(range)
    setAgingModalTitle(range === "all" ? "Apartados Vencidos (Todos)" : `Apartados Vencidos (${label})`)
    setAgingModalOpen(true)
  }

  // Top KPI Drill-down modal state
  const [kpiModalOpen, setKpiModalOpen] = useState(false)
  const [kpiModalType, setKpiModalType] = useState<KpiDrillDownType>("orders")

  const handleOpenKpiModal = (kpiType: KpiDrillDownType) => {
    setKpiModalType(kpiType)
    setKpiModalOpen(true)
  }

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const trendDays = period === "year" ? 1095 : 180
      const storeFilter = selectedStoreIds.length > 0 ? selectedStoreIds : undefined
      const [
        metricsRes,
        trendRes,
        forecastRes,
        saleTypeRes,
        topSellersRes,
        topProductsRes,
        pipelineRes,
        expiredAgingRes,
        aovBranchesRes,
        agingUnliquidatedRes,
        paymentMixRes,
        leadTimesRes,
        otifRes,
        dwellTimesRes,
        fulfillmentRes,
        conversionRes,
        velocityRes,
        suggestionsRes,
        turnoverRes,
        stockoutsRes,
        occupancyRes,
      ] = await Promise.allSettled([
        apiClient.getDashboardMetrics(period, storeFilter, signal),
        apiClient.getSalesTrend(trendDays, storeFilter, signal),
        apiClient.getSalesForecast(period, signal),
        apiClient.getBySaleType(period, storeFilter, signal),
        apiClient.getTopSellers(period, 20, storeFilter, signal),
        apiClient.getTopProducts(period, 10, storeFilter, signal),
        apiClient.getPipelineSnapshot(storeFilter, signal),
        apiClient.getExpiredLayawaysByAge(signal),
        apiClient.getAovByBranch(period, signal),
        apiClient.getAgingUnliquidated(signal),
        apiClient.getPaymentMix(period, signal),
        apiClient.getManufacturingLeadTime(period, signal),
        apiClient.getOtif(period, signal),
        apiClient.getStageDwellTimes(signal),
        apiClient.getFulfillmentRatio(period, signal),
        apiClient.getConversionRate(period, signal),
        apiClient.getClosingVelocity(period, signal),
        apiClient.getReplenishmentSuggestions(signal),
        apiClient.getStockTurnover(signal),
        apiClient.getStockoutRate(signal),
        apiClient.getStoreOccupancy(signal),
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
      if (aovBranchesRes.status === "fulfilled") setAovBranches(aovBranchesRes.value)
      if (agingUnliquidatedRes.status === "fulfilled") setAgingUnliquidated(agingUnliquidatedRes.value)
      if (paymentMixRes.status === "fulfilled") setPaymentMix(paymentMixRes.value)
      if (leadTimesRes.status === "fulfilled") setLeadTimes(leadTimesRes.value)
      if (otifRes.status === "fulfilled") setOtif(otifRes.value)
      if (dwellTimesRes.status === "fulfilled") setStageDwellTimes(dwellTimesRes.value)
      if (fulfillmentRes.status === "fulfilled") setFulfillment(fulfillmentRes.value)
      if (conversionRes.status === "fulfilled") setConversion(conversionRes.value)
      if (velocityRes.status === "fulfilled") setVelocity(velocityRes.value)
      if (suggestionsRes.status === "fulfilled") setSuggestions(suggestionsRes.value)
      if (turnoverRes.status === "fulfilled") setStockTurnover(turnoverRes.value)
      if (stockoutsRes.status === "fulfilled") setStockouts(stockoutsRes.value)
      if (occupancyRes.status === "fulfilled") setOccupancy(occupancyRes.value)
    } catch {
      // Handled by allSettled
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [period, selectedStoreIds])

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
              {/* Multi-Store Selector Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    id="store-filter-trigger"
                    className="h-9 gap-2 shadow-sm rounded-xl hover:bg-muted/80 transition-colors text-xs font-medium border-border/70 bg-background/80"
                  >
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="truncate max-w-[140px] sm:max-w-[180px]">
                      {selectedStoreIds.length === 0
                        ? "Todas las tiendas"
                        : selectedStoreIds.length === 1
                        ? availableStores.find((s) => s.id === selectedStoreIds[0])?.name || "1 tienda"
                        : `${selectedStoreIds.length} tiendas`}
                    </span>
                    {selectedStoreIds.length > 1 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                        {selectedStoreIds.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3 shadow-lg border-border/80">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <span className="text-xs font-semibold text-foreground">Filtrar por Tienda</span>
                      {selectedStoreIds.length > 0 && (
                        <button
                          onClick={() => setSelectedStoreIds([])}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Ver todas
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      <label
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors text-xs"
                      >
                        <Checkbox
                          id="store-all"
                          checked={selectedStoreIds.length === 0}
                          onCheckedChange={() => setSelectedStoreIds([])}
                        />
                        <span className="flex-1 font-medium text-foreground select-none">
                          Todas las tiendas
                        </span>
                      </label>

                      {availableStores.map((store) => {
                        const isChecked = selectedStoreIds.includes(store.id)
                        return (
                          <label
                            key={store.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors text-xs"
                          >
                            <Checkbox
                              id={`store-${store.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (selectedStoreIds.length === 0) {
                                  setSelectedStoreIds([store.id])
                                } else if (!checked) {
                                  const next = selectedStoreIds.filter((id) => id !== store.id)
                                  setSelectedStoreIds(next)
                                } else {
                                  const next = [...selectedStoreIds, store.id]
                                  setSelectedStoreIds(next.length === availableStores.length ? [] : next)
                                }
                              }}
                            />
                            <span className="flex-1 text-muted-foreground hover:text-foreground select-none">
                              {store.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 items-stretch">

            {/* Pedidos */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-orders"
              fallback={<KpiCardSkeleton accentClass="bg-amber-500" />}
            >
              <Card
                onClick={() => handleOpenKpiModal("orders")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-amber-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver detalle de pedidos"
              >
                <div className="h-1 w-full bg-amber-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-amber-600 transition-colors">Pedidos</span>
                      <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      {totalOrders}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Órdenes generadas</span>
                      <span className="text-[10px] text-amber-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver lista →</span>
                    </div>
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
              <Card
                onClick={() => handleOpenKpiModal("invoiced")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-emerald-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver detalle de facturación"
              >
                <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-emerald-600 transition-colors">Facturado</span>
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${totalSales.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Venta bruta del período</span>
                      <span className="text-[10px] text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver pedidos →</span>
                    </div>
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
              <Card
                onClick={() => handleOpenKpiModal("collected")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-blue-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver abonos cobrados (ventas actuales vs cartera anterior)"
              >
                <div className="h-1 w-full bg-blue-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-blue-600 transition-colors">Cobrado</span>
                      <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${totalCollected.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Recaudo real efectivo/banco</span>
                      <span className="text-[10px] text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver 2 listas →</span>
                    </div>
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
              <Card
                onClick={() => handleOpenKpiModal("collection_rate")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-emerald-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver desglose de cobranza (ventas actuales vs cartera anterior)"
              >
                <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-emerald-600 transition-colors">% Cobranza</span>
                      <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
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
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Eficiencia cobro</span>
                      <span className="text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver abonos →</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Ticket Promedio (AOV) */}
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
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90">Ticket Prom. (AOV)</span>
                      <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${averageTicket.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    {aovBranches.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {aovBranches.slice(0, 2).map((b) => (
                          <span
                            key={b.branchId || b.branchName}
                            className="inline-flex items-center text-[10px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 font-mono text-muted-foreground"
                          >
                            <strong className="text-foreground mr-1">{b.branchName.replace("Sede ", "")}:</strong> ${b.averageOrderValue.toFixed(0)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Promedio por orden</p>
                    )}
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
              <Card
                onClick={() => handleOpenKpiModal("active_layaways")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-cyan-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver listado de apartados activos (< 90 días)"
              >
                <div className="h-1 w-full bg-cyan-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-cyan-600 transition-colors">SA Activos</span>
                      <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center text-cyan-500 group-hover:bg-cyan-500/20 transition-colors">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      ${activeLayawaysBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium">{activeLayawaysCount} apartados vigentes</span>
                      <span className="text-[10px] text-cyan-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver lista →</span>
                    </div>
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
              <Card
                onClick={() => handleOpenKpiModal("expired_layaways")}
                className="h-full flex flex-col justify-between border-rose-500/30 bg-rose-500/[0.02] hover:border-rose-500/80 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver listado de apartados vencidos (+90 días)"
              >
                <div className="h-1 w-full bg-rose-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-rose-500 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-600 transition-colors">SA Vencidos</span>
                      <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500/20 transition-colors">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-rose-600 dark:text-rose-400 font-mono">
                      ${expiredLayawaysBalance.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                          {expiredLayawaysCount} pedidos
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">Excl. reservas</span>
                      </div>
                      <span className="text-[10px] text-rose-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver lista →</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BoneyardSkeleton>

            {/* Cashea */}
            <BoneyardSkeleton
              className="h-full flex flex-col"
              loading={isLoading}
              name="kpi-cashea"
              fallback={<KpiCardSkeleton accentClass="bg-yellow-500" />}
            >
              <Card
                onClick={() => handleOpenKpiModal("cashea")}
                className="h-full flex flex-col justify-between border-border/70 hover:border-yellow-500/60 hover:-translate-y-0.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 shadow-sm overflow-hidden relative cursor-pointer group"
                title="Clic para ver detalle de pedidos Cashea"
              >
                <div className="h-1 w-full bg-yellow-500 absolute top-0 left-0" />
                <CardContent className="p-4 pt-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 group-hover:text-yellow-600 transition-colors">Cashea</span>
                      <div className="w-6 h-6 rounded-md bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:bg-yellow-500/20 transition-colors">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="text-xl font-black tracking-tight text-foreground font-mono">
                      +${casheaFinanced.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="mt-2 min-h-[34px] flex flex-col justify-end">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Financiado con cashea</span>
                      <span className="text-[10px] text-yellow-600 font-medium group-hover:translate-x-0.5 transition-transform">Ver detalle →</span>
                    </div>
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

          {/* Charts Row 2: Invoiced vs Collected & Payment Mix */}
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
                <PaymentMixDonutSkeleton />
              ) : (
                <PaymentMixDonut data={paymentMix} isLoading={isLoading} />
              )}
            </div>
          </div>

          {/* Charts Row 3: Aging Unliquidated & Expired Layaways Aging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="h-full flex flex-col">
              {isLoading ? (
                <UnliquidatedAgingSkeleton />
              ) : (
                <UnliquidatedAgingChart
                  data={agingUnliquidated}
                  isLoading={isLoading}
                  onSelectRange={handleOpenUnliquidatedModal}
                />
              )}
            </div>
            <div className="h-full flex flex-col">
              {isLoading ? (
                <ExpiredAgeSkeleton />
              ) : (
                <ExpiredAgeChart
                  data={expiredAging}
                  isLoading={isLoading}
                  onSelectRange={handleOpenExpiredLayawaysModal}
                />
              )}
            </div>
          </div>

          {/* Charts Row 4: Production Pipeline & Operations Lead Time / OTIF */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="h-full flex flex-col">
              {isLoading ? (
                <PipelineChartSkeleton />
              ) : (
                <PipelineChart data={pipelineData} isLoading={isLoading} />
              )}
            </div>
            <div className="h-full flex flex-col">
              {isLoading ? (
                <OperationsMetricsSkeleton />
              ) : (
                <OperationsMetricsCard
                  leadTimes={leadTimes}
                  otif={otif}
                  dwellTimes={stageDwellTimes}
                  fulfillment={fulfillment}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>

          {/* Charts Row 5: Top Sellers & Commercial Funnel */}
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
                <FunnelMetricsSkeleton />
              ) : (
                <FunnelMetricsCard
                  conversion={conversion}
                  velocity={velocity}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>

          {/* Charts Row 6: Inventory Intelligence & Replenishment Suggestions */}
          <div>
            {isLoading ? (
              <InventoryIntelligenceSkeleton />
            ) : (
              <InventoryIntelligenceCard
                suggestions={suggestions}
                turnover={turnover}
                stockouts={stockouts}
                occupancy={occupancy}
                isLoading={isLoading}
              />
            )}
          </div>

          {/* Charts Row 7: Top Products Table */}
          <div>
            {isLoading ? (
              <TopProductsTableSkeleton />
            ) : (
              <TopProductsTable data={topProducts} isLoading={isLoading} period={period} />
            )}
          </div>
        </div>
      </main>
      </div>

      {/* Drill-down modal for Aging and Expired Layaway Orders */}
      <AgingOrdersModal
        open={agingModalOpen}
        onOpenChange={setAgingModalOpen}
        type={agingModalType}
        initialRange={agingModalRange}
        title={agingModalTitle}
      />

      {/* Drill-down modal for Top 7 KPIs */}
      <KpiDrillDownModal
        open={kpiModalOpen}
        onOpenChange={setKpiModalOpen}
        type={kpiModalType}
        period={period}
      />
    </div>
  )
}
