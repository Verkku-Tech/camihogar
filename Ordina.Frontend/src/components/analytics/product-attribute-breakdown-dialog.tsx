"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  SlidersHorizontal,
  Package,
  AlertCircle,
  Sparkles,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Award,
  ShieldCheck,
  RefreshCw,
  Eye,
  ExternalLink,
  Search,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from "recharts"
import {
  apiClient,
  type ProductAttributeBreakdownResponse,
  type AttributeBreakdown,
  type ProductVariantStat,
} from "@/lib/api-client"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  category: string
  period?: string
}

const PERIOD_LABELS: Record<string, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
}

const CHART_PALETTE = [
  "#1CB569", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#64748B", // Slate
]

function cleanOptionValue(value: string): string {
  if (!value || value.includes("System.Object") || value.toLowerCase() === "object") {
    return "Estándar / Por defecto"
  }
  return value
}

export function ProductAttributeBreakdownDialog({
  open,
  onOpenChange,
  productName,
  category,
  period = "month",
}: Props) {
  const [data, setData] = useState<ProductAttributeBreakdownResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null)
  const [selectedGroupingAttributeIds, setSelectedGroupingAttributeIds] = useState<string[]>([])
  const [isRecalculatingVariants, setIsRecalculatingVariants] = useState(false)
  const [expandedVariantOrders, setExpandedVariantOrders] = useState<Record<number, boolean>>({})
  const [selectedVariantForOrders, setSelectedVariantForOrders] = useState<ProductVariantStat | null>(null)
  const [ordersFilterText, setOrdersFilterText] = useState("")

  const toggleExpandOrders = (rank: number) => {
    setExpandedVariantOrders((prev) => ({
      ...prev,
      [rank]: !prev[rank],
    }))
  }

  const handleToggleGroupingAttribute = (attrKey: string) => {
    setSelectedGroupingAttributeIds((prev) => {
      const attr = data?.attributes?.find(
        (a) => (a.attributeId || a.attributeTitle) === attrKey || a.attributeTitle === attrKey
      )
      const keysToMatch = new Set(
        [
          attrKey.toLowerCase(),
          attr?.attributeId?.toLowerCase(),
          attr?.attributeTitle?.toLowerCase(),
        ].filter(Boolean) as string[]
      )

      const isCurrentlyChecked = prev.some((id) => keysToMatch.has(id.toLowerCase()))

      if (isCurrentlyChecked) {
        if (prev.length <= 1) return prev
        return prev.filter((id) => !keysToMatch.has(id.toLowerCase()))
      } else {
        return [...prev, attrKey]
      }
    })
  }

  const handleRecalculateVariants = async () => {
    if (!productName || selectedGroupingAttributeIds.length === 0) return
    setIsRecalculatingVariants(true)
    try {
      const res = await apiClient.getProductAttributeBreakdown(
        productName,
        period,
        selectedGroupingAttributeIds
      )
      setData((prev) => (prev ? {
        ...prev,
        topVariants: res.topVariants,
        totalUniqueVariantsCount: res.totalUniqueVariantsCount,
        activeAttributeIds: res.activeAttributeIds,
      } : res))
    } catch (err) {
      console.error("Error recalculating variants:", err)
    } finally {
      setIsRecalculatingVariants(false)
    }
  }

  useEffect(() => {
    if (!open || !productName) {
      setData(null)
      setError(null)
      setSelectedAttributeId(null)
      setSelectedGroupingAttributeIds([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiClient
      .getProductAttributeBreakdown(productName, period, undefined, controller.signal)
      .then((res) => {
        setData(res)
        if (res.attributes && res.attributes.length > 0) {
          setSelectedAttributeId(res.attributes[0].attributeId || res.attributes[0].attributeTitle)
        }
        const suggested = res.attributes
          ?.filter((a) => a.isSuggestedForGrouping)
          .map((a) => a.attributeId || a.attributeTitle)
          .filter(Boolean)
        const validActiveIds = (res.activeAttributeIds || [])
          .filter((id) => id && id.trim().length > 0)

        const initialSelected =
          validActiveIds.length > 0
            ? validActiveIds
            : suggested && suggested.length > 0
            ? suggested
            : res.attributes?.map((a) => a.attributeId || a.attributeTitle).slice(0, 2) || []

        setSelectedGroupingAttributeIds(initialSelected)
        setIsLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("Error fetching product attribute breakdown:", err)
        setError("No se pudo cargar el desglose de atributos.")
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [open, productName, period])

  const periodText = PERIOD_LABELS[period] || "Período actual"

  const selectedAttr: AttributeBreakdown | undefined = data?.attributes?.find(
    (a) => {
      const key = a.attributeId || a.attributeTitle
      return (
        key === selectedAttributeId ||
        (Boolean(a.attributeId) && a.attributeId === selectedAttributeId) ||
        (Boolean(a.attributeTitle) && a.attributeTitle === selectedAttributeId)
      )
    }
  ) ?? data?.attributes?.[0]

  const cleanOptions = selectedAttr?.options?.map((opt) => ({
    ...opt,
    name: cleanOptionValue(opt.value),
    units: opt.unitsSold,
    pct: opt.percentage,
  })) ?? []

  const topOption = cleanOptions[0]
  const top2Pct = cleanOptions.slice(0, 2).reduce((acc, o) => acc + o.percentage, 0)
  const isDonut = cleanOptions.length <= 4

  const topVariants: ProductVariantStat[] = data?.topVariants ?? []
  const totalVariantsCount = data?.totalUniqueVariantsCount ?? topVariants.length

  const topVariantsUnits = topVariants.reduce((sum, v) => sum + v.unitsSold, 0)
  const otherUnits = Math.max(0, (data?.totalUnitsSold ?? 0) - topVariantsUnits)
  const top3Concentration = topVariants.reduce((acc, v) => acc + v.percentage, 0)
  const otherPct = Math.max(0, 100 - top3Concentration)

  const VARIANT_COLORS = ["#10B981", "#3B82F6", "#8B5CF6"]

  const variantChartData = [
    ...topVariants.map((v, idx) => ({
      name: `#${v.rank} ${v.variantName}`,
      shortName: `Top #${v.rank}`,
      units: v.unitsSold,
      percentage: v.percentage,
      usd: v.totalInvoicedUsd,
      fill: VARIANT_COLORS[idx % VARIANT_COLORS.length],
    })),
    ...(otherUnits > 0
      ? [
          {
            name: "Otras combinaciones",
            shortName: "Otras",
            units: otherUnits,
            percentage: otherPct,
            usd: Math.max(
              0,
              (data?.totalInvoicedUsd ?? 0) -
                topVariants.reduce((sum, v) => sum + v.totalInvoicedUsd, 0)
            ),
            fill: "#64748B",
          },
        ]
      : []),
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {productName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                <span>Micro Dashboard de Rendimiento y Atributos</span>
                {category && (
                  <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.2">
                    {category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.2 text-muted-foreground">
                  {periodText}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 bg-muted/40 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
            </div>
          ) : !data || data.attributes.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-muted-foreground/60" />
              <span className="font-medium text-base text-foreground">Sin atributos configurados</span>
              <span className="text-xs max-w-sm text-muted-foreground">
                Este producto no posee atributos registrados en su categoría o no cuenta con ventas de variantes en este período.
              </span>
            </div>
          ) : (
            <>
              {/* 1. Micro KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Units Sold */}
                <Card className="border-border/60 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Unidades Vendidas</span>
                    <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-foreground">
                      {data.totalUnitsSold.toLocaleString("es-VE")}
                    </span>
                    <span className="text-xs text-muted-foreground">uds.</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {data.ordersCount ? `${data.ordersCount} pedidos registrados` : "En el período"}
                  </span>
                </Card>

                {/* Total Invoiced */}
                <Card className="border-border/60 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Facturación Total</span>
                    <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      ${(data.totalInvoicedUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Ingreso neto atribuido
                  </span>
                </Card>

                {/* Average Unit Price */}
                <Card className="border-border/60 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Precio Promedio</span>
                    <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-foreground">
                      ${(data.averageUnitPriceUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-muted-foreground">/ ud.</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Ticket promedio ponderado
                  </span>
                </Card>

                {/* Unique Real Variants */}
                <Card className="border-border/60 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Variantes Reales</span>
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-foreground">
                      {totalVariantsCount}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {totalVariantsCount === 1 ? "combinación" : "combinaciones"}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block mt-0.5 truncate">
                    {topVariants[0]
                      ? `Líder: ${topVariants[0].percentage.toFixed(0)}% del volumen`
                      : `${data.attributes.length} dimensiones`}
                  </span>
                </Card>
              </div>

              {/* 1. Top 3 Full Variants (Conjunto Completo de Atributos con Data Real de Pedidos) */}
              <Card className="border-border/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Top 3 Variantes Más Vendidas</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Combinaciones auditadas con pedidos reales según las dimensiones seleccionadas.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground shrink-0 self-start sm:self-auto">
                    {totalVariantsCount} {totalVariantsCount === 1 ? "combinación registrada" : "combinaciones registradas"}
                  </Badge>
                </CardHeader>

                {/* Interactive Dimension Selector Bar (Option B + C) */}
                {data.attributes && data.attributes.length > 0 && (
                  <div className="p-3 bg-muted/20 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 mr-1">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        Dimensiones:
                      </span>
                      {data.attributes.map((attr) => {
                        const attrKey = attr.attributeId || attr.attributeTitle
                        const isChecked = selectedGroupingAttributeIds.some(
                          (id) =>
                            id.toLowerCase() === attrKey.toLowerCase() ||
                            (attr.attributeId && id.toLowerCase() === attr.attributeId.toLowerCase()) ||
                            (attr.attributeTitle && id.toLowerCase() === attr.attributeTitle.toLowerCase())
                        )
                        return (
                          <button
                            key={attrKey}
                            type="button"
                            onClick={() => handleToggleGroupingAttribute(attrKey)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                              isChecked
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                isChecked ? "bg-white/25 text-white font-bold" : "border border-muted-foreground/40"
                              }`}
                            >
                              {isChecked ? "✓" : ""}
                            </span>
                            <span>{attr.attributeTitle}</span>
                            {attr.isSuggestedForGrouping && (
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                  isChecked ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                }`}
                              >
                                Estructural
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {(() => {
                      const isDirty =
                        [...selectedGroupingAttributeIds].sort().join(",") !==
                        [...(data?.activeAttributeIds || [])].sort().join(",")
                      return (
                        <Button
                          variant={isDirty ? "default" : "outline"}
                          size="sm"
                          disabled={isRecalculatingVariants || selectedGroupingAttributeIds.length === 0}
                          onClick={handleRecalculateVariants}
                          className={`h-7 px-2.5 text-xs gap-1.5 shrink-0 ${isDirty ? "ring-2 ring-primary/40" : ""}`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRecalculatingVariants ? "animate-spin" : ""}`} />
                          <span>{isRecalculatingVariants ? "Calculando..." : "Actualizar"}</span>
                        </Button>
                      )
                    })()}
                  </div>
                )}

                <CardContent className="p-5">
                  {topVariants.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                      <Layers className="w-5 h-5 text-muted-foreground/60" />
                      <span>No se registraron variantes completas con todos los atributos requeridos en este período.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Left: Donut Chart Distribution */}
                      <div className="lg:col-span-5 flex flex-col items-center justify-center">
                        <div className="w-full h-52 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={210}>
                            <PieChart>
                              <Pie
                                data={variantChartData}
                                dataKey="units"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={78}
                                paddingAngle={3}
                                stroke="var(--background, #fff)"
                                strokeWidth={2}
                              >
                                {variantChartData.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.fill} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: "rgba(15, 23, 42, 0.96)",
                                  color: "#ffffff",
                                  borderRadius: "8px",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  fontSize: "12px",
                                  padding: "6px 10px",
                                }}
                                itemStyle={{ color: "#ffffff" }}
                                labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                                formatter={(val: any, name: any, item: any) => {
                                  const total = data.totalUnitsSold || 1
                                  const pct = ((Number(val) / total) * 100).toFixed(1)
                                  const usd = item?.payload?.usd
                                    ? ` • $${Number(item.payload.usd).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : ""
                                  return [`${val} uds. (${pct}%)${usd}`, name]
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Legend and Concentration Indicator */}
                        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                          {variantChartData.map((entry, idx) => (
                            <span key={idx} className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.fill }} />
                              <span className="font-medium text-foreground text-[11px]">{entry.shortName}:</span>
                              <span className="font-mono text-[11px]">{entry.percentage.toFixed(1)}%</span>
                            </span>
                          ))}
                        </div>

                        <div className="w-full mt-3.5 p-2.5 bg-muted/20 border border-border/40 rounded-lg text-center">
                          <span className="text-[11px] text-muted-foreground">
                            Concentración Top 3: <strong className="text-foreground font-mono">{top3Concentration.toFixed(1)}%</strong> del volumen total
                          </span>
                        </div>
                      </div>

                      {/* Right: Top 3 Variant Cards */}
                      <div className="lg:col-span-7 space-y-3">
                        {topVariants.map((v) => {
                          const isRank1 = v.rank === 1
                          const isRank2 = v.rank === 2
                          const isRank3 = v.rank === 3
                          const isExpanded = !!expandedVariantOrders[v.rank]
                          const orderList = v.orderNumbers ?? []
                          const visibleOrders = isExpanded ? orderList : orderList.slice(0, 5)

                          return (
                            <div
                              key={v.rank}
                              className={`p-3.5 rounded-xl border transition-all ${
                                isRank1
                                  ? "bg-amber-500/5 border-amber-500/30 shadow-xs"
                                  : isRank2
                                  ? "bg-blue-500/5 border-blue-500/25"
                                  : "bg-purple-500/5 border-purple-500/25"
                              }`}
                            >
                              {/* Header: Rank, Units, Revenue */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                      isRank1
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                        : isRank2
                                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                                        : "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                    }`}
                                  >
                                    {isRank1 && <Sparkles className="w-3 h-3" />}
                                    {isRank2 && <Award className="w-3 h-3" />}
                                    {isRank3 && <Award className="w-3 h-3" />}
                                    Top #{v.rank}
                                  </span>
                                  <span className="text-xs font-semibold text-foreground">
                                    {v.unitsSold} {v.unitsSold === 1 ? "ud." : "uds."}
                                    <span className="text-muted-foreground font-normal ml-1">
                                      ({v.percentage.toFixed(1)}%)
                                    </span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    ${v.totalInvoicedUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedVariantForOrders(v)}
                                    className="h-6 px-2 text-[11px] font-semibold gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Ver pedidos ({orderList.length})</span>
                                  </Button>
                                </div>
                              </div>

                              {/* Attribute Combination Badges */}
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {Object.entries(v.attributes).map(([attrKey, attrVal]) => (
                                  <Badge
                                    key={attrKey}
                                    variant="outline"
                                    className="text-[11px] bg-background/80 border-border/70 py-0.5 px-2 font-normal"
                                  >
                                    <span className="font-semibold text-foreground mr-1">{attrKey}:</span>
                                    <span className="text-muted-foreground">{cleanOptionValue(attrVal)}</span>
                                  </Badge>
                                ))}
                              </div>

                              {/* Real Certified Order Numbers */}
                              <div className="mt-2.5 pt-2 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-muted-foreground flex items-center gap-1 font-medium text-[10px]">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                    <span>Pedidos reales ({orderList.length}):</span>
                                  </span>
                                  {orderList.length === 0 ? (
                                    <span className="text-[10px] text-muted-foreground italic">Sin pedidos registrados</span>
                                  ) : (
                                    <>
                                      {visibleOrders.map((ord) => (
                                        <a
                                          key={ord}
                                          href={`/pedidos/${ord.replace(/^#/, "")}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={`Abrir pedido #${ord.replace(/^#/, "")} en nueva pestaña`}
                                          className="inline-flex items-center text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-muted/60 text-foreground border border-border/50 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                          #{ord.replace(/^#/, "")}
                                        </a>
                                      ))}
                                      {orderList.length > 5 && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedVariantForOrders(v)}
                                          className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline px-1 cursor-pointer"
                                        >
                                          +{orderList.length - 5} más (ver todos)
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Visual Analytics Explorer (Diferentes Gráficas por Atributo Individual) */}
              <Card className="border-border/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                      <span>Desglose por Atributo Individual</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gráficas adaptadas según la naturaleza de cada atributo (Dona para opciones estructurales, Barras para alta variedad)
                    </p>
                  </div>

                  {/* Attribute Selector Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {data.attributes.map((a) => {
                      const attrKey = a.attributeId || a.attributeTitle
                      const isSelected =
                        selectedAttributeId === attrKey ||
                        (Boolean(a.attributeId) && selectedAttributeId === a.attributeId) ||
                        (Boolean(a.attributeTitle) && selectedAttributeId === a.attributeTitle)
                      return (
                        <Button
                          key={attrKey}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedAttributeId(attrKey)}
                          className={`h-7 px-3 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {a.attributeTitle}
                          <span className="ml-1.5 text-[10px] opacity-80 font-mono">
                            {a.totalUnitsWithAttribute}
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  {selectedAttr && cleanOptions.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Left: Chart Area (Donut or Horizontal Bar Chart based on option count) */}
                      <div className="lg:col-span-7 flex flex-col items-center justify-center">
                        <div className={`w-full flex items-center justify-center ${isDonut ? "h-56" : "max-h-72 overflow-y-auto pr-1"}`}>
                          {isDonut ? (
                            /* Donut Chart for discrete options (<= 4 options) */
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie
                                  data={cleanOptions}
                                  dataKey="units"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={46}
                                  outerRadius={75}
                                  paddingAngle={4}
                                  stroke="var(--background, #fff)"
                                  strokeWidth={2}
                                >
                                  {cleanOptions.map((_, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.96)",
                                    color: "#ffffff",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                  }}
                                  itemStyle={{ color: "#ffffff" }}
                                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                                  formatter={(val: any, name: any) => {
                                    const total = selectedAttr.totalUnitsWithAttribute || 1
                                    const pct = ((Number(val) / total) * 100).toFixed(1)
                                    return [`${val} uds. (${pct}%)`, name]
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            /* Horizontal Bar Chart for high variety (>= 5 options like colors, fabrics) */
                            <ResponsiveContainer width="100%" height={Math.max(220, cleanOptions.length * 32)}>
                              <BarChart
                                data={cleanOptions}
                                layout="vertical"
                                margin={{ top: 6, right: 45, left: 10, bottom: 6 }}
                                barCategoryGap={8}
                              >
                                <XAxis type="number" hide domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2) || 1]} />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  axisLine={false}
                                  tickLine={false}
                                  width={125}
                                  interval={0}
                                  tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.96)",
                                    color: "#ffffff",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    fontSize: "12px",
                                  }}
                                  itemStyle={{ color: "#ffffff" }}
                                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                                  formatter={(val: any) => [`${val} uds.`, "Volumen"]}
                                />
                                <Bar dataKey="units" radius={[0, 6, 6, 0]} barSize={16}>
                                  {cleanOptions.map((_, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                                    />
                                  ))}
                                  <LabelList
                                    dataKey="units"
                                    position="right"
                                    style={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }}
                                    formatter={(val: any) => `${val} uds.`}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            {isDonut ? (
                              <>
                                <PieIcon className="w-3.5 h-3.5 text-emerald-500" />
                                Proporción estructural
                              </>
                            ) : (
                              <>
                                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                                Ranking comparativo de alta variedad
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span>{selectedAttr.totalUnitsWithAttribute} unidades configuradas</span>
                        </div>
                      </div>

                      {/* Right: Insight & Concentration Panel */}
                      <div className="lg:col-span-5 bg-muted/20 border border-border/40 rounded-xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Análisis de Concentración
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {cleanOptions.length} variantes
                          </span>
                        </div>

                        {topOption && (
                          <div className="p-3 bg-card border border-border/60 rounded-lg space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Opción Líder #1
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {topOption.percentage.toFixed(1)}% cuota
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-foreground truncate" title={topOption.name}>
                              {topOption.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {topOption.unitsSold} unidades vendidas de {selectedAttr.totalUnitsWithAttribute}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2 text-xs">
                          {cleanOptions.length > 1 && (
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span>Concentración Top 2:</span>
                              <span className="font-semibold text-foreground font-mono">
                                {top2Pct.toFixed(1)}% del volumen
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Tipo de Atributo:</span>
                            <span className="font-medium text-foreground">
                              {isDonut ? "Opciones Directas" : "Catálogo Extendido"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Sin opciones para este atributo en el período
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 3. Detailed Variant Cards Grid (With Uniform Height & Clean Scroll) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" />
                      <span>Detalle Completo de Variantes</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Auditoría descendente de cada opción por atributo (desplázate dentro de la tarjeta para ver todas las opciones)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.attributes.map((attr) => {
                    const opts = attr.options.map((opt) => ({
                      ...opt,
                      cleanName: cleanOptionValue(opt.value),
                    }))

                    return (
                      <Card
                        key={attr.attributeId}
                        className="border-border/60 shadow-xs hover:border-border transition-colors h-[260px] flex flex-col overflow-hidden"
                      >
                        {/* Card Header */}
                        <CardHeader className="p-3.5 pb-2.5 flex flex-row items-center justify-between space-y-0 border-b border-border/30 bg-muted/15 shrink-0">
                          <CardTitle className="text-sm font-semibold tracking-tight text-foreground truncate">
                            {attr.attributeTitle}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[10px] font-mono font-medium px-2 py-0.5">
                            {attr.totalUnitsWithAttribute} {attr.totalUnitsWithAttribute === 1 ? "ud." : "uds."}
                          </Badge>
                        </CardHeader>

                        {/* Card Content with Fixed Max Height and Internal Scroll */}
                        <CardContent className="p-3.5 flex-1 overflow-y-auto space-y-2.5 pr-2">
                          {opts.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-8">
                              Sin opciones registradas
                            </p>
                          ) : (
                            opts.map((opt, idx) => (
                              <div key={opt.value + idx} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                    {idx === 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded shrink-0">
                                        <Sparkles className="w-2.5 h-2.5" /> #1
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-5">
                                        #{idx + 1}
                                      </span>
                                    )}
                                    <span
                                      className="font-medium text-foreground truncate"
                                      title={opt.cleanName}
                                    >
                                      {opt.cleanName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                    <span className="text-muted-foreground">{opt.unitsSold} uds.</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 w-11 text-right">
                                      {opt.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      idx === 0 ? "bg-emerald-500" : "bg-emerald-500/70"
                                    }`}
                                    style={{ width: `${Math.max(opt.percentage, 2)}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal for Certified Variant Orders */}
    <Dialog
      open={!!selectedVariantForOrders}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSelectedVariantForOrders(null)
          setOrdersFilterText("")
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border/40 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    selectedVariantForOrders?.rank === 1
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : selectedVariantForOrders?.rank === 2
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                      : "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Top #{selectedVariantForOrders?.rank}
                </Badge>
                <DialogTitle className="text-base font-bold text-foreground">
                  Pedidos Certificados de la Variante
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Producto: <strong className="text-foreground">{data?.productName}</strong> ({data?.category})
              </DialogDescription>
            </div>
          </div>

          {/* Badges of the chosen combination */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {selectedVariantForOrders &&
              Object.entries(selectedVariantForOrders.attributes).map(([attrKey, attrVal]) => (
                <Badge
                  key={attrKey}
                  variant="outline"
                  className="text-xs bg-background/90 border-border/80 py-0.5 px-2 font-normal"
                >
                  <span className="font-semibold text-foreground mr-1">{attrKey}:</span>
                  <span className="text-muted-foreground">{cleanOptionValue(attrVal)}</span>
                </Badge>
              ))}
          </div>

          {/* KPI Strip */}
          {selectedVariantForOrders && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/40">
              <div className="p-2.5 rounded-lg bg-background border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Pedidos Reales
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {selectedVariantForOrders.orders?.length || selectedVariantForOrders.orderNumbers.length}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Unidades Vendidas
                </span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {selectedVariantForOrders.unitsSold} uds. ({selectedVariantForOrders.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border/50 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                  Total Facturado
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  ${selectedVariantForOrders.totalInvoicedUsd.toLocaleString("es-VE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="p-3.5 px-5 border-b border-border/40 bg-background flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por Nº de pedido o cliente..."
              value={ordersFilterText}
              onChange={(e) => setOrdersFilterText(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/20 border-border/70"
            />
          </div>
          {selectedVariantForOrders && (
            <span className="text-xs text-muted-foreground font-mono">
              {(() => {
                const rawList = selectedVariantForOrders.orders && selectedVariantForOrders.orders.length > 0
                  ? selectedVariantForOrders.orders
                  : selectedVariantForOrders.orderNumbers.map((num) => ({
                      orderNumber: num,
                      clientName: "Consumidor",
                      createdAt: "",
                      quantity: 1,
                      totalUsd: selectedVariantForOrders.totalInvoicedUsd / Math.max(1, selectedVariantForOrders.orderNumbers.length),
                      status: "Registrado",
                    }))
                const filtered = rawList.filter((ord) => {
                  if (!ordersFilterText.trim()) return true
                  const q = ordersFilterText.toLowerCase()
                  return ord.orderNumber.toLowerCase().includes(q) || (ord.clientName && ord.clientName.toLowerCase().includes(q))
                })
                return `${filtered.length} de ${rawList.length} pedidos`
              })()}
            </span>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto p-0 min-h-[220px]">
          {selectedVariantForOrders && (() => {
            const rawList = selectedVariantForOrders.orders && selectedVariantForOrders.orders.length > 0
              ? selectedVariantForOrders.orders
              : selectedVariantForOrders.orderNumbers.map((num) => ({
                  orderNumber: num,
                  clientName: "Consumidor",
                  createdAt: "",
                  quantity: 1,
                  totalUsd: selectedVariantForOrders.totalInvoicedUsd / Math.max(1, selectedVariantForOrders.orderNumbers.length),
                  status: "Registrado",
                }))
            const filtered = rawList.filter((ord) => {
              if (!ordersFilterText.trim()) return true
              const q = ordersFilterText.toLowerCase()
              return ord.orderNumber.toLowerCase().includes(q) || (ord.clientName && ord.clientName.toLowerCase().includes(q))
            })

            if (filtered.length === 0) {
              return (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
                  <Search className="w-5 h-5 text-muted-foreground/50" />
                  <span>No se encontraron pedidos que coincidan con &quot;{ordersFilterText}&quot;</span>
                </div>
              )
            }

            return (
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow className="text-[11px] border-border/50">
                    <TableHead className="w-32">Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-20 text-center">Cant.</TableHead>
                    <TableHead className="w-28 text-right">Monto</TableHead>
                    <TableHead className="w-28 text-center">Estado</TableHead>
                    <TableHead className="w-16 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ord) => (
                    <TableRow key={ord.orderNumber} className="hover:bg-muted/20 border-border/30 transition-colors">
                      <TableCell className="font-mono font-semibold text-xs">
                        <a
                          href={`/pedidos/${ord.orderNumber.replace(/^#/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>#{ord.orderNumber.replace(/^#/, "")}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {ord.clientName || "Consumidor Final"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {ord.createdAt
                          ? new Date(ord.createdAt).toLocaleDateString("es-VE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-center font-mono">
                        {ord.quantity} ud{ord.quantity > 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-right font-mono text-emerald-600 dark:text-emerald-400">
                        ${ord.totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0.2 px-1.5 font-medium border-border/60"
                        >
                          {ord.status || "Registrado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <a
                          href={`/pedidos/${ord.orderNumber.replace(/^#/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Abrir pedido en nueva pestaña"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          })()}
        </div>
      </DialogContent>
    </Dialog>
  </>
  )
}
