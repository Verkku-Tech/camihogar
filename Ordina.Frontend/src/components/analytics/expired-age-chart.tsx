"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { AlertCircle } from "lucide-react"
import type { ExpiredLayawayAgeRange } from "@/lib/api-client"
import { CHART_THEME, AGING_COLORS } from "./chart-theme"

interface Props {
  data: ExpiredLayawayAgeRange[]
  isLoading?: boolean
}

export function ExpiredAgeChart({ data, isLoading }: Props) {
  const totalExpiredAmount = data.reduce((s, d) => s + d.totalUsd, 0)
  const totalExpiredOrders = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card className="h-full flex flex-col justify-between border-rose-500/20 bg-rose-500/[0.015] shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-3 border-b border-rose-500/10 bg-rose-500/[0.03]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Apartados Vencidos por Antigüedad
              </CardTitle>
              <p className="text-xs text-muted-foreground">Distribución temporal de apartados vencidos (+90 días sin liquidar)</p>
            </div>
          </div>
          {totalExpiredOrders > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              ${totalExpiredAmount.toLocaleString("es-VE", { maximumFractionDigits: 0 })} por cobrar
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
        ) : data.every(d => d.count === 0) ? (
          <div className="h-56 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Excelente estado</span>
            <span>No hay apartados vencidos pendientes en el sistema</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} stroke={CHART_THEME.gridStroke} />
              <YAxis tick={{ fontSize: 11, fill: CHART_THEME.axisTick }} width={35} stroke={CHART_THEME.gridStroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  fontSize: 12,
                }}
                formatter={(v: number, n: string) => [
                  n === "count" ? `${v} apartados` : `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
                  n === "count" ? "Cantidad" : "Saldo Pendiente"
                ]}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                {data.map((_, i) => (
                  <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
