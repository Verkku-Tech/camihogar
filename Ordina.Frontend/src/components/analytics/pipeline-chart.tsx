"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { Layers } from "lucide-react"
import type { PipelineSnapshot } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"

interface Props {
  data: PipelineSnapshot | null
  isLoading?: boolean
}

const STAGES = [
  { stage: "Fabricación", key: "manufacturing", color: CHART_THEME.amber },
  { stage: "Almacén", key: "warehouse", color: CHART_THEME.cyan },
  { stage: "Despacho", key: "dispatch", color: CHART_THEME.purple },
  { stage: "Entregado", key: "delivered", color: CHART_THEME.emerald },
]

export function PipelineChart({ data, isLoading }: Props) {
  const chartData = data ? [
    { stage: "Fabricación", value: data.manufacturing, usd: data.manufacturingUsd ?? 0, color: CHART_THEME.amber },
    { stage: "Almacén", value: data.warehouse, usd: data.warehouseUsd ?? 0, color: CHART_THEME.cyan },
    { stage: "Despacho", value: data.dispatch, usd: data.dispatchUsd ?? 0, color: CHART_THEME.purple },
    { stage: "Entregado", value: data.delivered, usd: data.deliveredUsd ?? 0, color: CHART_THEME.emerald },
  ] : []

  const totalPieces = chartData.reduce((s, d) => s + d.value, 0)
  const totalUsd = chartData.reduce((s, d) => s + d.usd, 0)

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Pipeline Operativo de Piezas y Valor
              </CardTitle>
              <p className="text-xs text-muted-foreground">Estado y monto valorizado en el flujo de producción y entrega</p>
            </div>
          </div>
          {totalPieces > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/60">
                {totalPieces} piezas
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                ${totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 65, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} stroke={CHART_THEME.gridStroke} />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fontSize: 11, fill: "#475569" }}
                width={85}
                interval={0}
                stroke={CHART_THEME.gridStroke}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  fontSize: 12,
                }}
                formatter={(v: number, name: string, item: any) => [
                  `${v} unidades ($${(item.payload.usd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })})`,
                  "En Etapa"
                ]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: any, entry: any) => `${v}p ($${((chartData.find(d => d.value === v)?.usd ?? 0) / 1000).toFixed(1)}k)`}
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
