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
} from "recharts"
import { apiClient, type ProductAttributeBreakdownResponse, type AttributeBreakdown } from "@/lib/api-client"

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

  useEffect(() => {
    if (!open || !productName) {
      setData(null)
      setError(null)
      setSelectedAttributeId(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiClient
      .getProductAttributeBreakdown(productName, period, controller.signal)
      .then((res) => {
        setData(res)
        if (res.attributes && res.attributes.length > 0) {
          setSelectedAttributeId(res.attributes[0].attributeId)
        }
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
    (a) => a.attributeId === selectedAttributeId
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

  return (
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

                {/* Configured Attributes */}
                <Card className="border-border/60 bg-card p-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Variantes Activas</span>
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-foreground">
                      {data.attributes.length}
                    </span>
                    <span className="text-xs text-muted-foreground">dimensiones</span>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block mt-0.5 truncate">
                    {topOption ? `Líder: ${topOption.name}` : "Personalizable"}
                  </span>
                </Card>
              </div>

              {/* 2. Visual Analytics Explorer (Diferentes Gráficas por Atributo) */}
              <Card className="border-border/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                      <span>Explorador Visual de Atributos</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gráficas adaptadas según la naturaleza de cada atributo (Dona para opciones estructurales, Barras para alta variedad)
                    </p>
                  </div>

                  {/* Attribute Selector Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {data.attributes.map((a) => (
                      <Button
                        key={a.attributeId}
                        type="button"
                        variant={selectedAttributeId === a.attributeId ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedAttributeId(a.attributeId)}
                        className={`h-7 px-3 text-xs font-medium rounded-lg transition-all ${
                          selectedAttributeId === a.attributeId
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {a.attributeTitle}
                        <span className="ml-1.5 text-[10px] opacity-80 font-mono">
                          {a.totalUnitsWithAttribute}
                        </span>
                      </Button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  {selectedAttr && cleanOptions.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Left: Chart Area (Donut or Horizontal Bar Chart based on option count) */}
                      <div className="lg:col-span-7 flex flex-col items-center justify-center">
                        <div className="w-full h-56 flex items-center justify-center">
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
                                    backgroundColor: "rgba(15, 23, 42, 0.94)",
                                    color: "#fff",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                  }}
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
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart
                                data={cleanOptions}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                              >
                                <XAxis type="number" hide />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  axisLine={false}
                                  tickLine={false}
                                  width={110}
                                  tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.94)",
                                    color: "#fff",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    fontSize: "12px",
                                  }}
                                  formatter={(val: any) => [`${val} uds.`, "Volumen"]}
                                />
                                <Bar dataKey="units" radius={[0, 6, 6, 0]}>
                                  {cleanOptions.map((_, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                                    />
                                  ))}
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
  )
}
