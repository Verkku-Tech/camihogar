"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Wallet, ShieldCheck } from "lucide-react"
import type { PaymentMix } from "@/lib/api-client"

interface Props {
  data: PaymentMix[]
  isLoading?: boolean
}

const PAYMENT_PALETTE: Record<string, string> = {
  "Efectivo USD": "#10B981", // Emerald
  "Zelle": "#6366F1",        // Indigo
  "Cashea": "#F59E0B",       // Amber
  "Pago Móvil Bs": "#3B82F6", // Blue
  "Transferencia Bs": "#06B6D4", // Cyan
  "Punto de Venta / POS": "#8B5CF6", // Violet
  "Otro": "#94A3B8",        // Slate
}

const FALLBACK_COLORS = ["#10B981", "#6366F1", "#F59E0B", "#3B82F6", "#06B6D4", "#8B5CF6", "#94A3B8"]

export function PaymentMixDonut({ data, isLoading }: Props) {
  const totalAmount = data.reduce((s, d) => s + d.totalUsd, 0)

  // Compute foreign currency (USD/Zelle/Cashea) vs local currency (Bs) exposure
  const foreignUsd = data
    .filter(d => !d.method.includes("Bs"))
    .reduce((s, d) => s + d.totalUsd, 0)
  const foreignPct = totalAmount > 0 ? ((foreignUsd / totalAmount) * 100).toFixed(1) : "0.0"
  const localPct = totalAmount > 0 ? (100 - Number(foreignPct)).toFixed(1) : "0.0"

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-500">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Mix de Medios de Pago y Exposición
              </CardTitle>
              <p className="text-xs text-muted-foreground">Distribución de cobranza y balance cambiario (Divisas vs Bs)</p>
            </div>
          </div>
          {totalAmount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                {foreignPct}% Divisas
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                {localPct}% Bs
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
            Sin cobros registrados en el período
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
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={PAYMENT_PALETTE[entry.method] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const entry = payload[0].payload as PaymentMix
                  const color = payload[0].color || PAYMENT_PALETTE[entry.method] || FALLBACK_COLORS[0]
                  const pct = totalAmount > 0 ? ((entry.totalUsd / totalAmount) * 100).toFixed(1) : "0"
                  return (
                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
                      <div className="font-bold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold truncate">{entry.label}</span>
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground font-semibold shrink-0">
                          {entry.percentage ? `${entry.percentage.toFixed(1)}%` : `${pct}%`}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground font-medium">Monto Cobrado:</span>
                          <span className="font-mono font-bold text-foreground">
                            ${entry.totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {entry.count !== undefined && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground font-medium">Operaciones:</span>
                            <span className="font-mono font-semibold text-foreground">{entry.count}</span>
                          </div>
                        )}
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
