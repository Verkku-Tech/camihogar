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
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
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
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SALE_TYPE_PALETTE[i % SALE_TYPE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const entry = payload[0].payload as SaleTypeData
                  const color = payload[0].color || SALE_TYPE_PALETTE[0]
                  const pct = totalPeriod > 0 ? ((entry.totalUsd / totalPeriod) * 100).toFixed(1) : "0"
                  return (
                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
                      <div className="font-bold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold truncate">{entry.label}</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold shrink-0" style={{ color }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Facturado:</span>
                          <span className="font-mono font-bold" style={{ color }}>
                            ${entry.totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Pedidos:</span>
                          <span className="font-mono font-semibold text-foreground">{entry.count}</span>
                        </div>
                      </div>
                    </div>
                  )
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
