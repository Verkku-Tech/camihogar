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
  BarChart3,
  ListOrdered,
  PieChart as PieIcon,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { apiClient, type ProductAttributeBreakdownResponse } from "@/lib/api-client"

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

type ViewMode = "list" | "chart"

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
  const [globalView, setGlobalView] = useState<ViewMode>("list")
  // Allows per-card view override: { [attributeId]: "list" | "chart" }
  const [cardViews, setCardViews] = useState<Record<string, ViewMode>>({})

  useEffect(() => {
    if (!open || !productName) {
      setData(null)
      setError(null)
      setCardViews({})
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiClient
      .getProductAttributeBreakdown(productName, period, controller.signal)
      .then((res) => {
        setData(res)
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

  const toggleCardView = (attrId: string) => {
    setCardViews((prev) => {
      const current = prev[attrId] ?? globalView
      return {
        ...prev,
        [attrId]: current === "list" ? "chart" : "list",
      }
    })
  }

  const handleGlobalViewChange = (mode: ViewMode) => {
    setGlobalView(mode)
    setCardViews({}) // Reset per-card overrides
  }

  const periodText = PERIOD_LABELS[period] || "Período actual"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                  {productName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                <span>Desglose de versiones y combinaciones más vendidas</span>
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

            <div className="flex items-center gap-4 self-end sm:self-center">
              {data && data.totalUnitsSold > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-muted-foreground block">Total Vendido</span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {data.totalUnitsSold.toLocaleString("es-VE")} uds.
                  </span>
                </div>
              )}

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/50 text-xs shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGlobalViewChange("list")}
                  className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all gap-1.5 ${
                    globalView === "list"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ranking</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleGlobalViewChange("chart")}
                  className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all gap-1.5 ${
                    globalView === "chart"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PieIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Gráficas</span>
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-border/50 bg-card h-[290px] flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2">
                    <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3 flex-1">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="space-y-1.5">
                        <div className="flex justify-between">
                          <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
                          <div className="h-4 w-12 bg-muted/50 rounded animate-pulse" />
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full animate-pulse" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : !data || data.attributes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Package className="w-6 h-6 text-muted-foreground/60" />
              <span>No hay registros de atributos vendidos para este producto en el período seleccionado.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.attributes.map((attr) => {
                const currentView = cardViews[attr.attributeId] ?? globalView
                const optionsWithCleanLabels = attr.options.map((opt) => ({
                  ...opt,
                  cleanValue: cleanOptionValue(opt.value),
                }))

                return (
                  <Card
                    key={attr.attributeId}
                    className="border-border/60 shadow-xs hover:border-border transition-colors flex flex-col h-[310px] overflow-hidden"
                  >
                    {/* Card Header */}
                    <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between space-y-0 border-b border-border/30 bg-muted/10 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-sm font-semibold tracking-tight text-foreground truncate">
                          {attr.attributeTitle}
                        </CardTitle>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          ({attr.totalUnitsWithAttribute} {attr.totalUnitsWithAttribute === 1 ? "ud." : "uds."})
                        </span>
                      </div>

                      {/* Mini Switch between List and Chart per card */}
                      {attr.options.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleCardView(attr.attributeId)}
                          title={currentView === "list" ? "Ver gráfica de pastel" : "Ver lista de ranking"}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md"
                        >
                          {currentView === "list" ? (
                            <PieIcon className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ListOrdered className="w-3.5 h-3.5 text-foreground" />
                          )}
                        </Button>
                      )}
                    </CardHeader>

                    {/* Card Content with scrollable list or chart */}
                    <CardContent className="p-3.5 flex-1 flex flex-col justify-center overflow-hidden">
                      {optionsWithCleanLabels.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-8">
                          Sin opciones registradas
                        </p>
                      ) : currentView === "chart" ? (
                        /* Chart View */
                        <div className="w-full h-full flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={210}>
                            <PieChart>
                              <Pie
                                data={optionsWithCleanLabels}
                                dataKey="unitsSold"
                                nameKey="cleanValue"
                                cx="50%"
                                cy="50%"
                                innerRadius={38}
                                outerRadius={66}
                                paddingAngle={3}
                                stroke="var(--background, #fff)"
                                strokeWidth={2}
                              >
                                {optionsWithCleanLabels.map((_, idx) => (
                                  <Cell
                                    key={idx}
                                    fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                                  />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: "rgba(15, 23, 42, 0.92)",
                                  color: "#fff",
                                  borderRadius: "8px",
                                  border: "1px solid rgba(255, 255, 255, 0.1)",
                                  fontSize: "12px",
                                  padding: "6px 10px",
                                }}
                                formatter={(value: any, name: any) => {
                                  const total = attr.totalUnitsWithAttribute || 1
                                  const pct = ((Number(value) / total) * 100).toFixed(1)
                                  return [`${value} uds. (${pct}%)`, name]
                                }}
                              />
                              <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                                formatter={(value) => (
                                  <span className="text-muted-foreground font-medium text-[11px] truncate max-w-[90px] inline-block align-bottom">
                                    {value}
                                  </span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        /* List View with max height and scroll */
                        <div className="h-full overflow-y-auto pr-1 space-y-2.5">
                          {optionsWithCleanLabels.map((opt, idx) => (
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
                                    title={opt.cleanValue}
                                  >
                                    {opt.cleanValue}
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
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
