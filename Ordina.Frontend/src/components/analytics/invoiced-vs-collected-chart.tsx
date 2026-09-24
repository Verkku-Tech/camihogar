"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts"
import { BarChart2 } from "lucide-react"
import type { TrendDataPoint } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"

interface WeeklyDataPoint {
  week: string
  weekLabel: string
  invoiced: number
  collected: number
  total: number
  invoicedPct: number
  collectedPct: number
  invoicedPctStr: string
  collectedPctStr: string
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

function groupByWeek(data: TrendDataPoint[]): WeeklyDataPoint[] {
  const weeksMap: Record<string, {
    monday: Date
    sunday: Date
    invoiced: number
    collected: number
  }> = {}

  for (const d of data) {
    if (!d.date) continue
    const [year, month, day] = d.date.split("-").map(Number)
    const date = new Date(year, month - 1, day)

    // Find Monday of the current week (1 = Monday, 0 = Sunday)
    const dayOfWeek = date.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(year, month - 1, day + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const key = monday.toISOString().slice(0, 10)
    if (!weeksMap[key]) {
      weeksMap[key] = {
        monday,
        sunday,
        invoiced: 0,
        collected: 0,
      }
    }
    weeksMap[key].invoiced += d.invoicedUsd
    weeksMap[key].collected += d.collectedUsd
  }

  const sortedKeys = Object.keys(weeksMap).sort()
  const recentKeys = sortedKeys.slice(-6)

  return recentKeys.map(k => {
    const w = weeksMap[k]
    const inv = Math.round(w.invoiced * 100) / 100
    const col = Math.round(w.collected * 100) / 100
    const total = inv + col
    const invPct = total > 0 ? (inv / total) * 100 : 0
    const colPct = total > 0 ? (col / total) * 100 : 0

    // Human-friendly date format, e.g. "01 - 07 Sep" or "25 Ago - 31 Ago"
    const mMonth = MONTH_NAMES[w.monday.getMonth()]
    const sMonth = MONTH_NAMES[w.sunday.getMonth()]
    const mDay = String(w.monday.getDate()).padStart(2, "0")
    const sDay = String(w.sunday.getDate()).padStart(2, "0")

    const dateLabel =
      mMonth === sMonth
        ? `${mDay} - ${sDay} ${mMonth}`
        : `${mDay} ${mMonth} - ${sDay} ${sMonth}`

    return {
      week: dateLabel,
      weekLabel: dateLabel,
      invoiced: inv,
      collected: col,
      total,
      invoicedPct: invPct,
      collectedPct: colPct,
      invoicedPctStr: total > 0 ? `${invPct.toFixed(0)}%` : "0%",
      collectedPctStr: total > 0 ? `${colPct.toFixed(0)}%` : "0%",
    }
  })
}

interface Props {
  data: TrendDataPoint[]
  isLoading?: boolean
}

export function InvoicedVsCollectedChart({ data, isLoading }: Props) {
  const weekly = groupByWeek(data)
  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Facturado vs Cobrado por Semanas
              </CardTitle>
              <p className="text-xs text-muted-foreground">Comparación semanal con distribución porcentual sobre el total</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
        ) : weekly.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            Sin datos suficientes para calcular semanas
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={weekly} margin={{ top: 22, right: 20, left: 10, bottom: 0 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                stroke={CHART_THEME.gridStroke}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                width={55}
                stroke={CHART_THEME.gridStroke}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as WeeklyDataPoint
                  return (
                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[220px]">
                      <div className="font-bold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between">
                        <span className="font-semibold">{item.weekLabel}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Total: ${item.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                            Facturado:
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${item.invoiced.toLocaleString("es-VE", { minimumFractionDigits: 2 })}{" "}
                            <span className="font-bold text-[11px] opacity-85">
                              ({item.invoicedPct.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                            Cobrado:
                          </span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            ${item.collected.toLocaleString("es-VE", { minimumFractionDigits: 2 })}{" "}
                            <span className="font-bold text-[11px] opacity-85">
                              ({item.collectedPct.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-border/30 flex justify-between text-[11px] text-muted-foreground">
                          <span>% Cobro s/ Facturado:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {item.invoiced > 0 ? ((item.collected / item.invoiced) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 14, paddingRight: 8, fontSize: 12 }}
                formatter={v => (v === "invoiced" ? "Facturado (% total)" : "Cobrado (% total)")}
              />
              <Bar dataKey="invoiced" name="invoiced" fill={CHART_THEME.primary} radius={[5, 5, 0, 0]} maxBarSize={36}>
                <LabelList
                  dataKey="invoicedPctStr"
                  position="top"
                  style={{ fontSize: 10, fill: CHART_THEME.primary, fontWeight: 700 }}
                />
              </Bar>
              <Bar dataKey="collected" name="collected" fill={CHART_THEME.blue} radius={[5, 5, 0, 0]} maxBarSize={36}>
                <LabelList
                  dataKey="collectedPctStr"
                  position="top"
                  style={{ fontSize: 10, fill: CHART_THEME.blue, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
