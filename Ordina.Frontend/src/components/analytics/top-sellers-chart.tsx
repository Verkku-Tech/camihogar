"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { Trophy } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TopSeller } from "@/lib/api-client"
import { CHART_THEME } from "./chart-theme"

interface Props {
  data: TopSeller[]
  isLoading?: boolean
}

export type SellerMetricKey =
  | "total"
  | "ticket"
  | "orders"
  | "upt"
  | "discount"
  | "conversion"
  | "commission"

interface MetricDef {
  key: SellerMetricKey
  label: string
  shortLabel: string
  getValue: (s: TopSeller) => number
  formatAxis: (v: number) => string
  formatLabel: (v: number) => string
  formatTooltip: (v: number, item: any) => [string, string]
}

const METRICS: MetricDef[] = [
  {
    key: "total",
    label: "Facturación Total ($)",
    shortLabel: "Facturación Total",
    getValue: s => s.totalUsd,
    formatAxis: v => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0)}`,
    formatLabel: v => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`,
    formatTooltip: (v, item) => [
      `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${item.payload.commission ? ` (Comisión: $${Number(item.payload.commission).toLocaleString("es-VE", { minimumFractionDigits: 2 })})` : ""}`,
      "Facturado",
    ],
  },
  {
    key: "ticket",
    label: "Ticket Promedio ($)",
    shortLabel: "Ticket Promedio",
    getValue: s => s.averageTicketUsd ?? (s.ordersCount > 0 ? s.totalUsd / s.ordersCount : 0),
    formatAxis: v => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`,
    formatLabel: v => `$${Number(v).toFixed(0)}`,
    formatTooltip: v => [
      `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "Ticket Promedio",
    ],
  },
  {
    key: "orders",
    label: "Pedidos Concretados (#)",
    shortLabel: "Pedidos Concretados",
    getValue: s => s.ordersCount,
    formatAxis: v => String(Math.round(v)),
    formatLabel: v => `${Math.round(v)} ped.`,
    formatTooltip: v => [`${Math.round(v)} pedidos concretados`, "Pedidos Concretados"],
  },
  {
    key: "upt",
    label: "Unidades por Pedido (UPT)",
    shortLabel: "Unidades por Pedido",
    getValue: s => s.unitsPerOrder ?? 0,
    formatAxis: v => v.toFixed(1),
    formatLabel: v => `${v.toFixed(1)} uds`,
    formatTooltip: v => [`${Number(v).toFixed(2)} artículos por pedido`, "Unidades por Pedido (UPT)"],
  },
  {
    key: "discount",
    label: "Tasa de Descuento Promedio (%)",
    shortLabel: "Descuento Promedio",
    getValue: s => s.averageDiscountPercent ?? 0,
    formatAxis: v => `${v.toFixed(0)}%`,
    formatLabel: v => `${v.toFixed(1)}%`,
    formatTooltip: v => [`${Number(v).toFixed(1)}% descuento promedio`, "Tasa de Descuento"],
  },
  {
    key: "conversion",
    label: "Conversión de Reservas (%)",
    shortLabel: "Conversión de Reservas",
    getValue: s => s.reservationConversionRate ?? 0,
    formatAxis: v => `${v.toFixed(0)}%`,
    formatLabel: v => `${v.toFixed(1)}%`,
    formatTooltip: (v, item) => [
      `${Number(v).toFixed(1)}% (${item.payload.convertedReservations ?? 0} convertidas)`,
      "Tasa Conversión Reservas",
    ],
  },
  {
    key: "commission",
    label: "Comisión Estimada ($)",
    shortLabel: "Comisión Estimada",
    getValue: s => s.estimatedCommissionUsd ?? 0,
    formatAxis: v => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`,
    formatLabel: v => `$${Number(v).toFixed(0)}`,
    formatTooltip: v => [
      `$${Number(v).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "Comisión Estimada",
    ],
  },
]

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

function formatVendorName(rawName: string, idx: number): string {
  if (!rawName || !rawName.trim()) return `Vendedor ${idx + 1}`
  const words = rawName.trim().split(/\s+/).slice(0, 2)
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

export type SellerTypeFilter = "all" | "store" | "online"

export function TopSellersChart({ data, isLoading }: Props) {
  const [metricKey, setMetricKey] = useState<SellerMetricKey>("total")
  const [sellerTypeFilter, setSellerTypeFilter] = useState<SellerTypeFilter>("all")

  const currentMetric = useMemo(
    () => METRICS.find(m => m.key === metricKey) ?? METRICS[0],
    [metricKey]
  )

  const filteredData = useMemo(() => {
    if (sellerTypeFilter === "all") return data
    return data.filter(s => (s.sellerType ?? "store") === sellerTypeFilter)
  }, [data, sellerTypeFilter])

  const chartData = useMemo(() => {
    return [...filteredData]
      .map((s, idx) => ({
        name: formatVendorName(s.vendorName, idx),
        value: currentMetric.getValue(s),
        total: s.totalUsd,
        orders: s.ordersCount,
        commission: s.estimatedCommissionUsd ?? 0,
        ticket: s.averageTicketUsd ?? (s.ordersCount > 0 ? s.totalUsd / s.ordersCount : 0),
        upt: s.unitsPerOrder ?? 0,
        discount: s.averageDiscountPercent ?? 0,
        conversion: s.reservationConversionRate ?? 0,
        convertedReservations: s.convertedReservationsCount ?? 0,
        sellerType: s.sellerType ?? "store",
        storeName: s.storeName,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((item, rankIdx) => ({
        ...item,
        rank: rankIdx + 1,
      }))
  }, [filteredData, currentMetric])

  const chartHeight = Math.max(280, Math.min(chartData.length * 32, 330))

  return (
    <Card className="h-full flex-1 flex flex-col justify-between border-border/70 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
                Ranking de Vendedores
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {currentMetric.shortLabel} en pedidos concretados
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sellerTypeFilter} onValueChange={(val: SellerTypeFilter) => setSellerTypeFilter(val)}>
              <SelectTrigger
                id="seller-type-selector"
                className="h-8 text-xs w-full sm:w-[155px] bg-background/80 border-border/70 shadow-none font-medium"
              >
                <SelectValue placeholder="Tipo de vendedor" />
              </SelectTrigger>
              <SelectContent align="end" className="text-xs">
                <SelectItem value="all" className="text-xs">
                  Ambos (Tienda y Online)
                </SelectItem>
                <SelectItem value="store" className="text-xs">
                  Vendedores de tienda
                </SelectItem>
                <SelectItem value="online" className="text-xs">
                  Vendedores online
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={metricKey} onValueChange={(val: SellerMetricKey) => setMetricKey(val)}>
              <SelectTrigger
                id="seller-metric-selector"
                className="h-8 text-xs w-full sm:w-[185px] bg-background/80 border-border/70 shadow-none font-medium"
              >
                <SelectValue placeholder="Métrica" />
              </SelectTrigger>
              <SelectContent align="end" className="text-xs">
                {METRICS.map(m => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="h-72 bg-muted/40 rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
            Sin datos de vendedores en el período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 65, left: 10, bottom: 0 }}
              barCategoryGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridStroke} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: CHART_THEME.axisTick }}
                tickFormatter={currentMetric.formatAxis}
                stroke={CHART_THEME.gridStroke}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                width={130}
                interval={0}
                stroke={CHART_THEME.gridStroke}
                axisLine={false}
                tickLine={false}
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
                formatter={(v: any, _name: string, item: any) =>
                  currentMetric.formatTooltip(Number(v), item)
                }
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)]} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: any) => currentMetric.formatLabel(Number(v))}
                  style={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                  offset={8}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
