"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { AlertCircle } from "lucide-react"
import type { ExpiredLayawayAgeRange } from "@/lib/api-client"
import { CHART_THEME, AGING_COLORS } from "./chart-theme"

interface Props {
  data: ExpiredLayawayAgeRange[]
  isLoading?: boolean
  onSelectRange?: (range: string, label: string) => void
}

export function ExpiredAgeChart({ data, isLoading, onSelectRange }: Props) {
  const totalExpiredAmount = data.reduce((s, d) => s + d.totalUsd, 0)
  const totalExpiredOrders = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-rose-500/20 bg-rose-500/[0.015] shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-rose-500/10 bg-rose-500/[0.03]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Apartados Vencidos por Antigüedad
              </CardTitle>
              <p className="text-xs text-muted-foreground">Distribución temporal de apartados vencidos (+30 días sin liquidar)</p>
            </div>
          </div>
          {totalExpiredOrders > 0 && (
            <button
              onClick={() => onSelectRange?.("all", "Todos los rangos")}
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer font-mono"
              title="Ver listado completo de apartados vencidos"
            >
              ${totalExpiredAmount.toLocaleString("es-VE", { maximumFractionDigits: 0 })} por cobrar ({totalExpiredOrders} apartados) →
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-72 bg-muted/40 rounded-xl animate-pulse" />
        ) : data.every(d => d.count === 0) ? (
          <div className="h-72 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Excelente estado</span>
            <span>No hay apartados vencidos pendientes en el sistema</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 16, left: -10, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const entry = state.activePayload[0].payload as ExpiredLayawayAgeRange
                  if (entry) onSelectRange?.(entry.range, entry.label)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} stroke={CHART_THEME.gridStroke} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} width={35} stroke={CHART_THEME.gridStroke} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as ExpiredLayawayAgeRange
                  const color = payload[0].color || AGING_COLORS[data.indexOf(item) % AGING_COLORS.length] || AGING_COLORS[0]
                  const pct = totalExpiredOrders > 0 ? ((item.count / totalExpiredOrders) * 100).toFixed(1) : "0"
                  return (
                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
                      <div className="font-bold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold truncate">{item.label}</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold shrink-0" style={{ color }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Apartados:</span>
                          <span className="font-mono font-bold" style={{ color }}>{item.count}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Saldo Vencido:</span>
                          <span className="font-mono font-bold" style={{ color }}>
                            ${(item.totalUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-border/30 text-[11px] text-muted-foreground text-center">
                        Clic en la barra para ver detalle →
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40} className="cursor-pointer">
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={AGING_COLORS[i % AGING_COLORS.length]}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onSelectRange?.(d.range, d.label)}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(v: any) => (Number(v) > 0 ? `${v}` : "")}
                  style={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
