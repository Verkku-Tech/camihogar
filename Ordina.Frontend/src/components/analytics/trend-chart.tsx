"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { TrendingUp, Sparkles, History } from "lucide-react"
import type { TrendDataPoint, SalesForecastResponse } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"
import { useMemo } from "react"

export interface TrendChartPoint {
  date: string
  label: string
  invoicedUsd?: number
  collectedUsd?: number
  projectedInvoiced?: number
  projectedCollected?: number
  benchmark3Yr?: number
}

interface ProjectionSummary {
  projectedInvoicedTotal: number
  projectedCollectedTotal: number
  benchmarkTotal?: number
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

function calculateProjection(
  data: TrendDataPoint[],
  period: "day" | "week" | "month" | "year" = "month"
): { points: TrendChartPoint[]; summary: ProjectionSummary } {
  if (!data || data.length === 0) {
    return {
      points: [],
      summary: { projectedInvoicedTotal: 0, projectedCollectedTotal: 0 }
    }
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-11
  const todayDateStr = now.toISOString().slice(0, 10)

  // ponytail: calculamos base histórica de 6 meses (180 días) con factor de moderación
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000).toISOString().slice(0, 10)
  const last6MonthsData = data.filter(d => d.date >= sixMonthsAgo && d.date <= todayDateStr)

  const total6MoInvoiced = last6MonthsData.reduce((s, d) => s + d.invoicedUsd, 0)
  const total6MoCollected = last6MonthsData.reduce((s, d) => s + d.collectedUsd, 0)

  // Tasa de cobranza histórica razonable de 6 meses (conservadora entre 30% y 85%)
  const rawCollectionRate = total6MoInvoiced > 0 ? total6MoCollected / total6MoInvoiced : 0.45
  const conservativeCollectionRate = Math.min(Math.max(rawCollectionRate, 0.30), 0.85)

  // Promedio diario razonable / no optimista (factor conservador 0.90)
  const activeDaysCount = Math.max(last6MonthsData.length, 1)
  const conservativeDailyInvoiced = (total6MoInvoiced / activeDaysCount) * 0.90
  const conservativeDailyCollected = conservativeDailyInvoiced * conservativeCollectionRate

  // --- CASO 1: RANGO ANUAL (period === "year") ---
  if (period === "year") {
    const threeYearsAgo = currentYear - 3
    const historicalByMonth: Record<number, number[]> = {}
    for (let m = 0; m < 12; m++) historicalByMonth[m] = []

    for (const d of data) {
      const yr = parseInt(d.date.slice(0, 4), 10)
      const mo = parseInt(d.date.slice(5, 7), 10) - 1
      if (yr >= threeYearsAgo && yr < currentYear && mo >= 0 && mo < 12) {
        historicalByMonth[mo].push(d.invoicedUsd)
      }
    }

    const benchmarkAvgByMonth: Record<number, number> = {}
    for (let m = 0; m < 12; m++) {
      const sum = historicalByMonth[m].reduce((a, b) => a + b, 0)
      benchmarkAvgByMonth[m] = Math.round(sum / 3)
    }

    const currentYearByMonth: Record<number, { invoiced: number; collected: number }> = {}
    for (let m = 0; m < 12; m++) currentYearByMonth[m] = { invoiced: 0, collected: 0 }

    for (const d of data) {
      const yr = parseInt(d.date.slice(0, 4), 10)
      const mo = parseInt(d.date.slice(5, 7), 10) - 1
      if (yr === currentYear && mo >= 0 && mo < 12) {
        currentYearByMonth[mo].invoiced += d.invoicedUsd
        currentYearByMonth[mo].collected += d.collectedUsd
      }
    }

    const recent6MoMonthlyRunRate = (total6MoInvoiced / 6) * 0.92

    const points: TrendChartPoint[] = []
    let totalProjInv = 0
    let totalProjCol = 0
    let totalBench = 0

    for (let m = 0; m < 12; m++) {
      const monthLabel = MONTH_NAMES[m]
      const bench = benchmarkAvgByMonth[m] || 0
      totalBench += bench

      if (m < currentMonth) {
        const inv = Math.round(currentYearByMonth[m].invoiced)
        const col = Math.round(currentYearByMonth[m].collected)
        totalProjInv += inv
        totalProjCol += col
        points.push({
          date: monthLabel,
          label: `${monthLabel} ${currentYear}`,
          invoicedUsd: inv,
          collectedUsd: col,
          benchmark3Yr: bench > 0 ? bench : undefined,
        })
      } else if (m === currentMonth) {
        const realInv = Math.round(currentYearByMonth[m].invoiced)
        const realCol = Math.round(currentYearByMonth[m].collected)
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
        const remainingDays = Math.max(daysInCurrentMonth - now.getDate(), 0)

        const estRemainingInv = Math.round(conservativeDailyInvoiced * remainingDays)
        const estRemainingCol = Math.round(conservativeDailyCollected * remainingDays)

        const fullMonthProjInv = realInv + estRemainingInv
        const fullMonthProjCol = realCol + estRemainingCol

        totalProjInv += fullMonthProjInv
        totalProjCol += fullMonthProjCol

        points.push({
          date: monthLabel,
          label: `${monthLabel} ${currentYear} (En curso)`,
          invoicedUsd: realInv,
          collectedUsd: realCol,
          projectedInvoiced: fullMonthProjInv,
          projectedCollected: fullMonthProjCol,
          benchmark3Yr: bench > 0 ? bench : undefined,
        })
      } else {
        const blendedProjInv = bench > 0
          ? Math.round(0.6 * recent6MoMonthlyRunRate + 0.4 * bench)
          : Math.round(recent6MoMonthlyRunRate)

        const blendedProjCol = Math.round(blendedProjInv * conservativeCollectionRate)

        totalProjInv += blendedProjInv
        totalProjCol += blendedProjCol

        points.push({
          date: monthLabel,
          label: `${monthLabel} ${currentYear} (Proyectado)`,
          projectedInvoiced: blendedProjInv,
          projectedCollected: blendedProjCol,
          benchmark3Yr: bench > 0 ? bench : undefined,
        })
      }
    }

    return {
      points,
      summary: {
        projectedInvoicedTotal: totalProjInv,
        projectedCollectedTotal: totalProjCol,
        benchmarkTotal: totalBench,
      },
    }
  }

  // --- CASO 2: RANGO MENSUAL / SEMANAL / DIARIO ---
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const currentDay = now.getDate()
  const remainingDaysInMonth = Math.max(daysInMonth - currentDay, 0)

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const recentRealDays = data
    .filter(d => d.date >= thirtyDaysAgo && d.date <= todayDateStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  const points: TrendChartPoint[] = []
  let monthRealInvoiced = 0
  let monthRealCollected = 0
  const currentMonthPrefix = todayDateStr.slice(0, 7)

  for (const d of recentRealDays) {
    const isToday = d.date === todayDateStr
    const inv = d.invoicedUsd
    const col = d.collectedUsd

    if (d.date.startsWith(currentMonthPrefix)) {
      monthRealInvoiced += inv
      monthRealCollected += col
    }

    points.push({
      date: d.date,
      label: d.date,
      invoicedUsd: inv,
      collectedUsd: col,
      projectedInvoiced: isToday ? inv : undefined,
      projectedCollected: isToday ? col : undefined,
    })
  }

  let projectedRestInvoiced = 0
  let projectedRestCollected = 0

  for (let i = 1; i <= remainingDaysInMonth; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth(), currentDay + i)
    const futureDateStr = futureDate.toISOString().slice(0, 10)

    const inv = Math.round(conservativeDailyInvoiced)
    const col = Math.round(conservativeDailyCollected)
    projectedRestInvoiced += inv
    projectedRestCollected += col

    points.push({
      date: futureDateStr,
      label: `${futureDateStr} (Proyectado)`,
      projectedInvoiced: inv,
      projectedCollected: col,
    })
  }

  return {
    points,
    summary: {
      projectedInvoicedTotal: monthRealInvoiced + projectedRestInvoiced,
      projectedCollectedTotal: monthRealCollected + projectedRestCollected,
    },
  }
}

interface Props {
  data?: TrendDataPoint[]
  forecast?: SalesForecastResponse | null
  period?: "day" | "week" | "month" | "year"
  isLoading?: boolean
}

export function TrendChart({ data = [], forecast, period = "month", isLoading }: Props) {
  const { points, summary, mapeScore } = useMemo(() => {
    if (forecast && forecast.points && forecast.points.length > 0) {
      return {
        points: forecast.points,
        summary: forecast.summary,
        mapeScore: forecast.summary.mapeScore,
      }
    }
    const local = calculateProjection(data, period)
    return {
      points: local.points,
      summary: local.summary,
      mapeScore: undefined,
    }
  }, [forecast, data, period])

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground truncate">
                Tendencia de Ventas y Recaudación
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {period === "year"
                  ? "Histórico anual y comparativa 3 años con proyección prudente de 6 meses"
                  : "Cifras reales continuas y proyección conservadora a fin de mes (base 6 meses)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* {mapeScore !== undefined && (
              <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border/60 text-[11px] py-0.5 px-2">
                Holt-Winters (MAPE: {mapeScore}%)
              </Badge>
            )} */}
            {summary.projectedInvoicedTotal > 0 && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-1 px-2.5 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Fact. Estimada: <strong className="font-bold font-mono">${Math.round(summary.projectedInvoicedTotal).toLocaleString("es-VE")}</strong>
              </Badge>
            )}
            {summary.projectedCollectedTotal > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 py-1 px-2.5 text-xs font-medium">
                Cobro Estimado: <strong className="font-bold font-mono">${Math.round(summary.projectedCollectedTotal).toLocaleString("es-VE")}</strong>
              </Badge>
            )}
            {period === "year" && summary.benchmarkTotal !== undefined && summary.benchmarkTotal > 0 && (
              <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 gap-1 py-1 px-2.5 text-xs font-medium">
                <History className="w-3.5 h-3.5" />
                Benchmark 3 Años: <strong className="font-bold font-mono">${Math.round(summary.benchmarkTotal).toLocaleString("es-VE")}</strong>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
        ) : points.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            No hay transacciones registradas para el período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={points} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.primary} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_THEME.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_THEME.blue} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_THEME.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                tickFormatter={d => {
                  if (period === "year") return d
                  if (d.length >= 10) {
                    const parts = d.split('-')
                    if (parts.length === 3) return `${parts[2]}-${parts[1]}`
                  }
                  return d
                }}
                stroke={CHART_THEME.gridStroke}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                width={56}
                stroke={CHART_THEME.gridStroke}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null
                  const point = payload[0]?.payload as TrendChartPoint
                  return (
                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
                      <div className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center justify-between">
                        <span>{point.label || label}</span>
                      </div>
                      <div className="space-y-1">
                        {point.invoicedUsd !== undefined && (
                          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 font-light">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" /> Facturado (Real):
                            </span>
                            <span className="font-mono font-bold text-emerald-500">${point.invoicedUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {point.projectedInvoiced !== undefined && (
                          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 font-light">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 border-b border-dashed border-purple-500 inline-block" /> Fact. Proyectada:
                            </span>
                            <span className="font-mono font-bold text-purple-500">${point.projectedInvoiced.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {point.collectedUsd !== undefined && (
                          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 font-light">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 bg-blue-500 inline-block" /> Cobrado (Real):
                            </span>
                            <span className="font-mono font-bold text-blue-500">${point.collectedUsd.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {point.projectedCollected !== undefined && (
                          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 font-light">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 border-b border-dashed border-orange-500 inline-block" /> Cobro Proyectado:
                            </span>
                            <span className="font-mono font-bold text-orange-500">${point.projectedCollected.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {point.benchmark3Yr !== undefined && (
                          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 font-light pt-1 border-t border-border/30">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-0.5 border-b border-dotted border-slate-500 inline-block" /> Benchmark 3 Años:
                            </span>
                            <span className="font-mono font-semibold">${point.benchmark3Yr.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 16, paddingRight: 8, fontSize: 11 }}
                formatter={v => {
                  switch (v) {
                    case "invoicedUsd": return "Facturado (Real)"
                    case "projectedInvoiced": return "Facturado (Proyectado)"
                    case "collectedUsd": return "Cobrado (Real)"
                    case "projectedCollected": return "Cobrado (Proyectado)"
                    case "benchmark3Yr": return "Benchmark 3 Años"
                    default: return v
                  }
                }}
              />

              {/* Facturado Real - Área */}
              <Area
                type="monotone"
                dataKey="invoicedUsd"
                name="invoicedUsd"
                stroke={CHART_THEME.primary}
                strokeWidth={2.5}
                fill="url(#colorInvoiced)"
                fillOpacity={1}
                dot={{ fill: CHART_THEME.primary, r: 2.5 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />

              {/* Cobrado Real - Área */}
              <Area
                type="monotone"
                dataKey="collectedUsd"
                name="collectedUsd"
                stroke={CHART_THEME.blue}
                strokeWidth={2}
                fill="url(#colorCollected)"
                fillOpacity={1}
                dot={{ fill: CHART_THEME.blue, r: 2 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />

              {/* Facturado Proyectado - Línea punteada */}
              <Line
                type="monotone"
                dataKey="projectedInvoiced"
                name="projectedInvoiced"
                stroke={CHART_THEME.purple}
                strokeWidth={2}
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                dot={{ fill: CHART_THEME.purple, r: 2, fillOpacity: 0.7, strokeOpacity: 0.7 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />

              {/* Cobrado Proyectado - Línea punteada */}
              <Line
                type="monotone"
                dataKey="projectedCollected"
                name="projectedCollected"
                stroke={CHART_THEME.orange}
                strokeWidth={1.8}
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                dot={{ fill: CHART_THEME.orange, r: 1.5, fillOpacity: 0.7, strokeOpacity: 0.7 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />

              {/* Benchmark 3 Años - Línea punteada gris (en vista anual) */}
              {period === "year" && (
                <Line
                  type="monotone"
                  dataKey="benchmark3Yr"
                  name="benchmark3Yr"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
