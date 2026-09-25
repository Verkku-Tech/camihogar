"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  History,
  Sparkles,
  ArrowLeft,
  Calendar,
  DollarSign,
  Layers,
  Eye,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import {
  apiClient,
  type SalesForecastHistoryItem,
  type SalesForecastRecordDto,
} from "@/lib/api-client"
import { TrendChart } from "./trend-chart"

interface ForecastHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPeriod?: string
}

export function ForecastHistoryModal({
  open,
  onOpenChange,
  currentPeriod = "month",
}: ForecastHistoryModalProps) {
  const [historyList, setHistoryList] = useState<SalesForecastHistoryItem[]>([])
  const [selectedRecord, setSelectedRecord] = useState<SalesForecastRecordDto | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const loadHistory = useCallback(async (period?: string) => {
    setIsLoadingList(true)
    try {
      const filter = period && period !== "all" ? period : undefined
      const data = await apiClient.getSalesForecastHistory(filter)
      setHistoryList(data)
    } catch (err) {
      console.error("Error loading forecast history:", err)
      setHistoryList([])
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedRecord(null)
      loadHistory(selectedFilter)
    }
  }, [open, selectedFilter, loadHistory])

  const handleSelectRecord = async (item: SalesForecastHistoryItem) => {
    setIsLoadingDetail(true)
    try {
      const record = await apiClient.getSalesForecastHistoryById(item.id)
      if (record) {
        setSelectedRecord(record)
      }
    } catch (err) {
      console.error("Error loading forecast record detail:", err)
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return "$0"
    return `$${Math.round(val).toLocaleString("es-VE")}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Hoy"
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const getPeriodLabel = (p: string) => {
    switch (p) {
      case "day": return "Diario"
      case "week": return "Semanal"
      case "month": return "Mensual"
      case "year": return "Anual"
      default: return p
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
                  {selectedRecord ? selectedRecord.title : "Historial de Proyecciones de Venta"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedRecord
                    ? `Snapshot histórico fijado en ${formatDate(selectedRecord.generatedAtUtc || selectedRecord.createdAt || selectedRecord.startDate)}`
                    : "Registro de versiones de proyecciones con persistencia e idempotencia"}
                </DialogDescription>
              </div>
            </div>

            {selectedRecord && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="gap-1.5 h-8 text-xs font-medium self-start sm:self-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al listado
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {selectedRecord ? (
            /* --- VISTA DETALLE SNAPSHOT --- */
            <div className="space-y-5">
              {/* Snapshot Info Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Período</span>
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {getPeriodLabel(selectedRecord.period)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{selectedRecord.versionNumber}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                  <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Fact. Proyectada</span>
                  <div className="font-mono font-bold text-base text-purple-600 dark:text-purple-400">
                    {formatCurrency(selectedRecord.summary?.projectedInvoicedTotal)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Cobro Proyectado</span>
                  <div className="font-mono font-bold text-base text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedRecord.summary?.projectedCollectedTotal)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fecha Snapshot</span>
                  <div className="text-xs font-medium text-foreground flex items-center gap-1 pt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatDate(selectedRecord.generatedAtUtc || selectedRecord.createdAt || selectedRecord.startDate)}
                  </div>
                </div>
              </div>

              {/* Snapshot Chart */}
              <div className="min-h-[340px]">
                <TrendChart
                  data={[]}
                  forecast={{
                    points: selectedRecord.points,
                    summary: selectedRecord.summary,
                  }}
                  period={selectedRecord.period as any}
                  isSnapshot={true}
                />
              </div>
            </div>
          ) : (
            /* --- VISTA LISTADO DE VERSIONES --- */
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/50">
                  {[
                    { id: "all", label: "Todos" },
                    { id: "day", label: "Día" },
                    { id: "week", label: "Semana" },
                    { id: "month", label: "Mes" },
                    { id: "year", label: "Año" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedFilter(tab.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        selectedFilter === tab.id
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadHistory(selectedFilter)}
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>

              {/* Cards List */}
              {isLoadingList ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse border border-border/40" />
                  ))}
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border/60 rounded-xl space-y-2">
                  <Layers className="w-8 h-8 text-muted-foreground mx-auto stroke-1" />
                  <p className="text-sm font-medium text-foreground">No hay proyecciones registradas</p>
                  <p className="text-xs text-muted-foreground">
                    Las proyecciones se registran automáticamente cuando consultas los distintos períodos en el dashboard.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {historyList.map((item) => {
                    const realInv = item.realInvoicedTotal ?? item.actualInvoicedTotal ?? 0
                    const realCol = item.realCollectedTotal ?? item.actualCollectedTotal ?? 0
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectRecord(item)}
                        className="group p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/30 hover:border-purple-500/40 transition-all cursor-pointer shadow-xs hover:shadow-md space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] py-0 px-1.5 font-bold">
                                v{item.versionNumber}
                              </Badge>
                              <span className="font-semibold text-sm text-foreground truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(item.generatedAtUtc || item.createdAt || item.startDate)}
                            </p>
                          </div>

                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] shrink-0">
                            {getPeriodLabel(item.period)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground">Facturación</span>
                            <div className="font-mono text-xs">
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                {formatCurrency(item.projectedInvoicedTotal)}
                              </span>
                              {realInv > 0 && (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 ml-1">
                                  ({formatCurrency(realInv)} real)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground">Cobro</span>
                            <div className="font-mono text-xs">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {formatCurrency(item.projectedCollectedTotal)}
                              </span>
                              {realCol > 0 && (
                                <span className="text-[11px] text-blue-500 ml-1">
                                  ({formatCurrency(realCol)} real)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end text-[11px] text-purple-600 dark:text-purple-400 font-medium group-hover:translate-x-0.5 transition-transform">
                          <span>Ver gráfica snapshot →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
