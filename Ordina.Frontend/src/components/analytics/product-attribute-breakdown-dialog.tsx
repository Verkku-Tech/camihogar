"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SlidersHorizontal, Package, AlertCircle, Sparkles } from "lucide-react"
import { apiClient, type ProductAttributeBreakdownResponse } from "@/lib/api-client"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  category: string
  period?: string
}

const PERIOD_LABELS: Record<string, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  year: "Este año",
}

export function ProductAttributeBreakdownDialog({
  open,
  onOpenChange,
  productName,
  category,
  period = "month",
}: Props) {
  const [data, setData] = useState<ProductAttributeBreakdownResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !productName) {
      setData(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiClient
      .getProductAttributeBreakdown(productName, period, controller.signal)
      .then((res) => {
        setData(res)
        setIsLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error("Error fetching product attribute breakdown:", err)
        setError("No se pudo cargar el desglose de atributos.")
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [open, productName, period])

  const periodText = PERIOD_LABELS[period] || "Período actual"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                  {productName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                <span>Desglose de versiones y combinaciones más vendidas</span>
                {category && (
                  <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.2">
                    {category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.2 text-muted-foreground">
                  {periodText}
                </Badge>
              </DialogDescription>
            </div>

            {data && data.totalUnitsSold > 0 && (
              <div className="text-right shrink-0">
                <span className="text-xs text-muted-foreground block">Total Vendido</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {data.totalUnitsSold.toLocaleString("es-VE")} uds.
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-border/50 bg-card">
                  <CardHeader className="p-4 pb-2">
                    <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="space-y-1.5">
                        <div className="flex justify-between">
                          <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
                          <div className="h-4 w-12 bg-muted/50 rounded animate-pulse" />
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full animate-pulse" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : !data || data.attributes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Package className="w-6 h-6 text-muted-foreground/60" />
              <span>No hay registros de atributos vendidos para este producto en el período seleccionado.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.attributes.map((attr) => (
                <Card key={attr.attributeId} className="border-border/60 shadow-xs hover:border-border transition-colors">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 border-b border-border/30 bg-muted/10">
                    <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                      <span>{attr.attributeTitle}</span>
                    </CardTitle>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {attr.totalUnitsWithAttribute} {attr.totalUnitsWithAttribute === 1 ? "ud." : "uds."}
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 pt-3 space-y-3">
                    {attr.options.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin opciones registradas</p>
                    ) : (
                      attr.options.map((opt, idx) => (
                        <div key={opt.value} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              {idx === 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded shrink-0">
                                  <Sparkles className="w-2.5 h-2.5" /> #1
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-5">
                                  #{idx + 1}
                                </span>
                              )}
                              <span className="font-medium text-foreground truncate" title={opt.value}>
                                {opt.value}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-muted-foreground">{opt.unitsSold} uds.</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 w-11 text-right">
                                {opt.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                idx === 0 ? "bg-emerald-500" : "bg-emerald-500/70"
                              }`}
                              style={{ width: `${Math.max(opt.percentage, 2)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
