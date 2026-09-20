"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Trophy } from "lucide-react"
import type { TopSeller } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"

interface Props {
  data: TopSeller[]
  isLoading?: boolean
}

// Colors by podium ranking
const RANK_COLORS = [
  "#1CB569", // 1st - Camihogar Emerald
  "#10B981", // 2nd
  "#06B6D4", // 3rd - Cyan
  "#3B82F6", // 4th - Blue
  "#6366F1", // 5th - Indigo
  "#8B5CF6", // 6th - Violet
  "#A855F7", // 7th
  "#94A3B8", // 8th+
]

export function TopSellersChart({ data, isLoading }: Props) {
  const chartData = data.map((s, idx) => ({
    name: s.vendorName.trim() ? s.vendorName.split(" ").slice(0, 2).join(" ") : `Vendedor ${idx + 1}`,
    total: s.totalUsd,
    orders: s.ordersCount,
    rank: idx + 1,
  }))

  return (
    <Card className="h-full min-h-[325px] flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Ranking de Vendedores
            </CardTitle>
            <p className="text-xs text-muted-foreground">Volumen total facturado y cantidad de pedidos cerrados</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center min-h-[260px]">
        {isLoading ? (
          <div className="h-56 bg-muted/40 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            Sin datos de vendedores en el período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                stroke={CHART_THEME.gridStroke}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569" }}
                width={85}
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
                formatter={(v: number, n: string) => [
                  n === "total"
                    ? `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `${v} órdenes`,
                  n === "total" ? "Facturado" : "Pedidos"
                ]}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
