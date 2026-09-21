"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, TrendingUp, SlidersHorizontal } from "lucide-react"
import type { TopProduct } from "@/lib/api-client"
import { ProductAttributeBreakdownDialog } from "./product-attribute-breakdown-dialog"

interface Props {
  data: TopProduct[]
  isLoading?: boolean
  period?: string
}

export function TopProductsTable({ data, isLoading, period = "month" }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<TopProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const maxUnits = data.length > 0 ? Math.max(...data.map(p => p.unitsSold)) : 1

  const handleRowClick = (product: TopProduct) => {
    if (product.hasAttributes) {
      setSelectedProduct(product)
      setIsModalOpen(true)
    }
  }

  return (
    <>
      <Card className="border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                  Top Productos Más Vendidos
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Ranking por volumen de unidades y facturación generada (clic en productos con variantes para ver desglose)
                </p>
              </div>
            </div>
            {data.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Top {data.length} artículos estrella
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay registros de productos vendidos en el período seleccionado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4 text-center w-12">#</th>
                    <th className="py-3 px-4 text-left">Producto</th>
                    <th className="py-3 px-4 text-left">Categoría</th>
                    <th className="py-3 px-4 text-center w-40">Volumen Relativo</th>
                    <th className="py-3 px-4 text-right">Unidades</th>
                    <th className="py-3 px-4 text-right">Facturado ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.map((p, i) => {
                    const percentOfMax = maxUnits > 0 ? (p.unitsSold / maxUnits) * 100 : 0
                    const isClickable = Boolean(p.hasAttributes)

                    return (
                      <tr
                        key={i}
                        onClick={() => isClickable && handleRowClick(p)}
                        className={`transition-colors group ${
                          isClickable
                            ? "cursor-pointer hover:bg-emerald-500/5"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {i === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 font-bold text-xs border border-amber-500/30">
                              1
                            </span>
                          ) : i === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/15 text-slate-600 font-bold text-xs border border-slate-400/30">
                              2
                            </span>
                          ) : i === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/15 text-amber-700 font-bold text-xs border border-amber-700/30">
                              3
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground group-hover:text-primary transition-colors max-w-[260px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate" title={p.productName}>
                              {p.productName}
                            </span>
                            {isClickable && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0"
                                title="Ver versiones más vendidas"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                                <span className="hidden sm:inline">Versiones</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {p.category ? (
                            <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border/50">
                              {p.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(percentOfMax, 4)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                          {p.unitsSold.toLocaleString("es-VE")}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${p.totalUsd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProduct && (
        <ProductAttributeBreakdownDialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          productName={selectedProduct.productName}
          category={selectedProduct.category}
          period={period}
        />
      )}
    </>
  )
}

