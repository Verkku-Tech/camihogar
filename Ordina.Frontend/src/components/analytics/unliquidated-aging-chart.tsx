"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { DollarSign, Clock } from "lucide-react"
import type { AgingReport } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"

interface Props {
  data: AgingReport[]
  isLoading?: boolean
  onSelectRange?: (range: string, label: string) => void
}

const AGING_PALETTE = [
  "#10B981", // 0-15d (Normal)
  "#3B82F6", // 16-30d (En seguimiento)
  "#F59E0B", // 31-60d (Atención)
  "#EF4444", // 60d+ (Crítico)
]

export function UnliquidatedAgingChart({ data, isLoading, onSelectRange }: Props) {
  const totalBalance = data.reduce((s, d) => s + d.totalBalanceUsd, 0)
  const totalOrders = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Saldos Pendientes por Cobrar (Aging)
              </CardTitle>
              <p className="text-xs text-muted-foreground">Antigüedad de pedidos terminados no liquidados</p>
            </div>
          </div>
          {totalOrders > 0 && (
            <button
              onClick={() => onSelectRange?.("all", "Todos los rangos")}
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-mono hover:bg-orange-500/20 transition-colors cursor-pointer"
              title="Ver listado completo de pedidos"
            >
              ${totalBalance.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} por cobrar ({totalOrders} órdenes) →
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
        ) : data.length === 0 || data.every(d => d.count === 0) ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No hay saldos pendientes de liquidación en pedidos terminados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 16, left: -10, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const entry = state.activePayload[0].payload as AgingReport
                  if (entry) onSelectRange?.(entry.range, entry.label)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} stroke={CHART_THEME.gridStroke} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} width={45} stroke={CHART_THEME.gridStroke} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as AgingReport
                  const color = payload[0].color || AGING_PALETTE[data.indexOf(item) % AGING_PALETTE.length] || AGING_PALETTE[0]
                  const pct = totalBalance > 0 ? ((item.totalBalanceUsd / totalBalance) * 100).toFixed(1) : "0"
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
                          <span className="text-muted-foreground font-medium">Saldo Pendiente:</span>
                          <span className="font-mono font-bold" style={{ color }}>
                            ${item.totalBalanceUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Pedidos:</span>
                          <span className="font-mono font-semibold text-foreground">{item.count} órdenes</span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-border/30 text-[11px] text-muted-foreground text-center">
                        Clic en la barra para ver detalle →
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="totalBalanceUsd" radius={[5, 5, 0, 0]} maxBarSize={36} className="cursor-pointer">
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={AGING_PALETTE[i % AGING_PALETTE.length]}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onSelectRange?.(d.range, d.label)}
                  />
                ))}
                <LabelList
                  dataKey="totalBalanceUsd"
                  position="top"
                  formatter={(v: any) => (Number(v) > 0 ? `$${(Number(v) / 1000).toFixed(1)}k` : "")}
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
