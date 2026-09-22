"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, Zap, TrendingUp, Users, ArrowRight } from "lucide-react"
import type { ConversionRate, ClosingVelocity } from "@/lib/api-client"

interface Props {
  conversion: ConversionRate | null
  velocity: ClosingVelocity | null
  isLoading?: boolean
}

export function FunnelMetricsCard({ conversion, velocity, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-full min-h-[360px] bg-muted/40 rounded-2xl animate-pulse" />
  }

  const winRate = conversion?.winRatePercentage ?? 0
  const avgDays = velocity?.averageDaysToClose ?? 0
  const medianHours = velocity?.medianHoursToFirstPayment ?? 0

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Embudo Comercial y Conversión de Reservas
              </CardTitle>
              <p className="text-xs text-muted-foreground">Efectividad de cierre de apartados/presupuestos y velocidad de venta</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20">
            Funnel & CRM
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-stretch flex-1">
          {/* Win Rate */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-500" />
                  Win Rate de Reservas
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
                  {conversion?.convertedOrders ?? 0} de {conversion?.totalReservations ?? 0} cerradas
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-foreground">
                  {winRate}%
                </span>
                <span className="text-xs text-muted-foreground">tasa de conversión a pedido formalizado</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-3">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(winRate, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground flex justify-between pt-3 border-t border-border/40">
              <span>Volumen formalizado:</span>
              <span className="font-bold text-foreground font-mono">
                ${(conversion?.convertedVolumeUsd ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Lead to Order Time */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Velocidad de Cierre (Lead Time)
                </span>
                <span className="text-xs text-muted-foreground">Desde reserva a pago</span>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-3xl font-black font-mono tracking-tight text-foreground">
                    {avgDays}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">días promedio</span>
                </div>
                <span className="text-muted-foreground text-xs">•</span>
                <div>
                  <span className="text-xl font-bold font-mono text-muted-foreground">
                    {medianHours}h
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">mediana al 1er pago</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-3 border-t border-border/40 leading-relaxed">
              Tiempo de maduración comercial desde la cotización o apartado inicial hasta la confirmación del primer anticipo bancario.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
