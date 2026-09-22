"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, PackageCheck, AlertOctagon, Store, ArrowRight } from "lucide-react"
import type { ReplenishmentSuggestion, StockTurnover, StockoutRate, StoreOccupancy } from "@/lib/api-client"

interface Props {
  suggestions: ReplenishmentSuggestion[]
  turnover: StockTurnover | null
  stockouts: StockoutRate | null
  occupancy: StoreOccupancy[]
  isLoading?: boolean
}

export function InventoryIntelligenceCard({
  suggestions,
  turnover,
  stockouts,
  occupancy,
  isLoading,
}: Props) {
  if (isLoading) {
    return <div className="h-72 bg-muted/40 rounded-2xl animate-pulse" />
  }

  return (
    <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Inteligencia de Inventario y Reposición Prioritaria
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Cruce de demanda real (Top Variantes) contra existencias para sugerencias automáticas
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            Stock Intelligence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-6">

        {/* Top 3 Variantes - Sugerencias de Reposición */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-500" />
              Sugerencias de Reposición Prioritaria (Variantes Más Vendidas)
            </h3>
            <span className="text-xs text-muted-foreground">Basado en ranking de ventas reales</span>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No hay variantes con alerta de reposición urgente en este momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestions.slice(0, 3).map((s, idx) => (
                <div
                  key={idx}
                  className="bg-card border border-border/70 p-3.5 rounded-xl flex flex-col justify-between space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                          #{s.salesRank} en ventas
                        </Badge>
                        <Badge
                          variant={s.priority === "Alta" ? "destructive" : "outline"}
                          className="text-[10px] px-1.5 py-0 font-bold"
                        >
                          Prioridad {s.priority}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-xs text-foreground leading-tight">
                        {s.productName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px]">
                        {s.variantName}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-muted/30 p-1.5 rounded-lg text-center">
                      <span className="text-muted-foreground block text-[10px]">Stock Terrinca</span>
                      <span className="font-bold font-mono text-foreground">{s.currentStockTerrinca} un</span>
                    </div>
                    <div className="bg-muted/30 p-1.5 rounded-lg text-center">
                      <span className="text-muted-foreground block text-[10px]">Fabricar sugerido</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        +{s.suggestedQuantity} un
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sección de Métricas Operativas & Wireframes con Aviso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/40">

          {/* Rotación de Stock Terminado */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rotación en Almacén
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {turnover?.averageDaysInWarehouse ?? 21}
              </span>
              <span className="text-xs text-muted-foreground">días promedio en stock</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {turnover?.slowMovingItemsCount ?? 0} piezas con rotación lenta (+45d sin despacho).
            </p>
          </div>

          {/* Wireframe: Quiebre de Stock */}
          <div className="bg-muted/20 border border-dashed border-border p-4 rounded-xl space-y-2 relative group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
                Quiebre de Stock (Stockouts)
              </span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Próximamente
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed pt-1">
              {stockouts?.statusNote ?? "Esta métrica estará disponible al implementar el registro de consultas en mostrador sin disponibilidad inmediata."}
            </div>
          </div>

          {/* Wireframe: Ocupación Física de Tiendas */}
          <div className="bg-muted/20 border border-dashed border-border p-4 rounded-xl space-y-2 relative group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-blue-500" />
                Ocupación Física de Tiendas
              </span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-blue-600 dark:text-blue-400 border-blue-500/30">
                Próximamente
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed pt-1">
              Esta métrica estará disponible al configurar los topes físicos y capacidad máxima de exhibición por sede (Guatire y Caracas).
            </div>
          </div>

        </div>

      </CardContent>
    </Card>
  )
}
