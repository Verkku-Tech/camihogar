"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { PieChart as PieIcon } from "lucide-react"
import type { SaleTypeData } from "@/lib/api-client"
import { SALE_TYPE_PALETTE } from "./chart-theme"

interface Props {
  data: SaleTypeData[]
  isLoading?: boolean
}

export function SaleTypeDonut({ data, isLoading }: Props) {
  const totalPeriod = data.reduce((s, d) => s + d.totalUsd, 0)

  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Distribución por Tipo de Venta
            </CardTitle>
            <p className="text-xs text-muted-foreground">Proporción de ingresos según canal comercial</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Sin ventas en el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <PieChart>
              <Pie
                data={data}
                dataKey="totalUsd"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                stroke="#fff"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SALE_TYPE_PALETTE[i % SALE_TYPE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  fontSize: 12,
                }}
                formatter={(v: number, n: string) => {
                  const pct = totalPeriod > 0 ? ((Number(v) / totalPeriod) * 100).toFixed(1) : "0"
                  return [
                    `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct}%)`,
                    n
                  ]
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                formatter={v => <span className="text-muted-foreground font-medium">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
