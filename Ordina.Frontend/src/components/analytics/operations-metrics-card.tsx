"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Hammer, CheckCircle2, Clock, Truck, Flame, SlidersHorizontal } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { ManufacturingLeadTime, OtifMetrics, StageDwellTime, FulfillmentRatio } from "@/lib/api-client"
import {
  getLeadTimeStatus,
  getOtifStatus,
  getDwellTimeStatus,
  type OperationsMetricsSettings
} from "@/lib/metrics-thresholds"
import { OperationsThresholdDialog } from "./operations-threshold-dialog"

interface Props {
  leadTimes: ManufacturingLeadTime[]
  otif: OtifMetrics | null
  dwellTimes: StageDwellTime[]
  fulfillment: FulfillmentRatio | null
  isLoading?: boolean
}

export function OperationsMetricsCard({ leadTimes, otif, dwellTimes, fulfillment, isLoading }: Props) {
  const [settings, setSettings] = useState<OperationsMetricsSettings | null>(null)
  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    apiClient.getOperationsMetricsSettings()
      .then(res => {
        if (isMounted && res) setSettings(res)
      })
      .catch(() => {
        // ponytail: fallback gracefully to defaults if settings endpoint not reachable offline
      })
    return () => { isMounted = false }
  }, [])

  if (isLoading) {
    return <div className="h-full min-h-[360px] bg-muted/40 rounded-2xl animate-pulse" />
  }

  const otifRate = otif?.otifRate ?? 100
  const maxDwell = dwellTimes.length > 0 ? Math.max(...dwellTimes.map(d => d.averageDays)) : 5
  const otifStatus = getOtifStatus(otifRate, settings?.otif)

  const immediatePct = fulfillment?.immediatePercentage ?? 0
  const fulfillTarget = settings?.fulfillment?.targetImmediatePercentage ?? 60
  const fulfillWarn = settings?.fulfillment?.warningImmediatePercentage ?? 50
  const fulfillCrit = settings?.fulfillment?.criticalImmediatePercentage ?? 40

  let fulfillBarClass = "bg-emerald-500"
  let fulfillTextClass = "text-emerald-600 dark:text-emerald-400"
  if (immediatePct < fulfillCrit) {
    fulfillBarClass = "bg-rose-500"
    fulfillTextClass = "text-rose-500 dark:text-rose-400"
  } else if (immediatePct < fulfillWarn) {
    fulfillBarClass = "bg-amber-500"
    fulfillTextClass = "text-amber-500 dark:text-amber-400"
  } else if (immediatePct < fulfillTarget) {
    fulfillBarClass = "bg-blue-500"
    fulfillTextClass = "text-blue-500 dark:text-blue-400"
  }

  return (
    <>
      <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Hammer className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  BI de Operaciones y Cadena de Suministro
                </CardTitle>
                <p className="text-xs text-muted-foreground">Tiempos de fabricación, cumplimiento OTIF y cuellos de botella</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                onClick={() => setIsThresholdDialogOpen(true)}
                title="Configurar umbrales de métricas operativas"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Configurar Umbrales</span>
              </Button>
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20">
                Taller & Despacho
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">

          {/* 1. Manufacturing Lead Time */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Lead Time Taller
                </span>
                <span className="text-[11px] text-muted-foreground">Días promedio</span>
              </div>
              <div className="space-y-2">
                {leadTimes.map((lt, idx) => {
                  const status = getLeadTimeStatus(lt.averageDays, settings?.categoryLeadTimes?.[lt.category])
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-medium text-foreground">{lt.category}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold font-mono ${status.textClass}`}>{lt.averageDays} d</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${status.barClass}`}
                          style={{ width: `${Math.min(lt.averageDays * 10, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 2. OTIF Delivery Compliance */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Cumplimiento OTIF
                </span>
                <span className="text-[11px] text-muted-foreground">A tiempo y completo</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black font-mono tracking-tight ${otifStatus.textClass}`}>
                  {otifRate}%
                </span>
                <span className="text-xs text-muted-foreground">efectividad</span>
                <Badge variant="outline" className={`ml-auto text-[10px] py-0 px-1.5 ${otifStatus.textClass}`}>
                  {otifStatus.label}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Órdenes a tiempo:</span>
                <span className="font-semibold text-emerald-600 font-mono">{otif?.onTimeOrders ?? 0}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Órdenes retrasadas:</span>
                <span className="font-semibold text-rose-500 font-mono">{otif?.delayedOrders ?? 0}</span>
              </div>
            </div>
          </div>

          {/* 3. Cuellos de Botella (Dwell Times) */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Permanencia x Etapa
                </span>
                <span className="text-[11px] text-muted-foreground">Cuello de botella</span>
              </div>
              <div className="space-y-2">
                {dwellTimes.map((st, idx) => {
                  const maxStandard = settings?.stageMaxStandardDays?.[st.stageName] ?? 5
                  const dwellStatus = getDwellTimeStatus(st.averageDays, maxStandard)
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-medium text-foreground truncate max-w-[130px]">{st.stageName}</span>
                        <span className={`font-bold font-mono ${dwellStatus.textClass}`}>
                          {st.averageDays} d
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${dwellStatus.barClass}`}
                          style={{ width: `${Math.min((st.averageDays / maxDwell) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 4. Tasa Despacho Inmediato vs Fabricación */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-500" />
                  Abastecimiento
                </span>
                <span className="text-[11px] text-muted-foreground">Origen de entrega</span>
              </div>
              <div className="space-y-2 mt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Stock Inmediato:</span>
                    <span className={`font-bold font-mono ${fulfillTextClass}`}>
                      {fulfillment?.immediatePercentage ?? 0}% ({fulfillment?.immediateCount ?? 0} pz)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`${fulfillBarClass} h-full rounded-full transition-all duration-300`} style={{ width: `${fulfillment?.immediatePercentage ?? 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Fabricado a Medida:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                      {fulfillment?.madeToOrderPercentage ?? 0}% ({fulfillment?.madeToOrderCount ?? 0} pz)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${fulfillment?.madeToOrderPercentage ?? 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <OperationsThresholdDialog
        open={isThresholdDialogOpen}
        onOpenChange={setIsThresholdDialogOpen}
        currentSettings={settings}
        onSettingsUpdated={setSettings}
      />
    </>
  )
}
