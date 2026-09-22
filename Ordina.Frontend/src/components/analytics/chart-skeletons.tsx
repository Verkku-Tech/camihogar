import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function TrendChartSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              <div className="h-3 w-64 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-6 w-36 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-64 flex flex-col justify-between py-2">
          {/* Simulated horizontal grid lines with pulsing bars/wave */}
          <div className="w-full border-b border-border/30 pb-2 flex items-end gap-2 h-44">
            {[35, 60, 45, 80, 55, 90, 70, 85, 65, 95, 80, 75, 90, 85, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-500/20 rounded-t animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          <div className="flex justify-between pt-2">
            {[1, 5, 10, 15, 20, 25, 30].map(d => (
              <div key={d} className="h-2.5 w-6 bg-muted/60 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SaleTypeDonutSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted/60 animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          {/* Simulated hollow donut ring */}
          <div className="relative w-36 h-36 rounded-full border-[14px] border-muted animate-pulse flex items-center justify-center">
            <div className="w-8 h-4 bg-muted/60 rounded" />
          </div>
          {/* Legend chips */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-12 bg-muted/70 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function InvoicedVsCollectedSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            <div className="h-3 w-56 bg-muted/60 animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-56 flex flex-col justify-between">
          <div className="flex items-end justify-around gap-4 h-44 border-b border-border/30 pb-2">
            {[
              { a: 60, b: 45 },
              { a: 80, b: 70 },
              { a: 95, b: 85 },
              { a: 75, b: 60 },
            ].map((col, i) => (
              <div key={i} className="flex items-end gap-1.5 flex-1 max-w-[60px] h-full justify-center">
                <div className="w-5 bg-emerald-500/25 rounded-t animate-pulse" style={{ height: `${col.a}%` }} />
                <div className="w-5 bg-blue-500/25 rounded-t animate-pulse" style={{ height: `${col.b}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-around pt-2">
            {[1, 2, 3, 4].map(w => (
              <div key={w} className="h-2.5 w-12 bg-muted/60 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PipelineChartSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-muted animate-pulse rounded" />
              <div className="h-3 w-52 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        {[85, 65, 45, 30, 20].map((w, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <div className="h-3 w-20 bg-muted/80 animate-pulse rounded" />
              <div className="h-3 w-8 bg-muted/60 animate-pulse rounded" />
            </div>
            <div className="w-full bg-muted/40 rounded-full h-3.5 overflow-hidden">
              <div
                className="bg-indigo-500/25 h-full rounded-full animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function TopSellersSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-muted animate-pulse rounded" />
            <div className="h-3 w-56 bg-muted/60 animate-pulse rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        {[90, 75, 60, 45, 30].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="h-3.5 w-24 bg-muted/80 animate-pulse rounded flex-shrink-0" />
            <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
              <div
                className="bg-amber-500/30 h-full rounded-full animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 50}ms` }}
              />
            </div>
            <div className="h-3 w-12 bg-muted/60 animate-pulse rounded flex-shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ExpiredAgeSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-rose-500/10 bg-rose-500/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              <div className="h-3 w-60 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-28 bg-rose-500/15 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-56 flex flex-col justify-between">
          <div className="flex items-end justify-around gap-4 h-44 border-b border-border/30 pb-2">
            {[40, 70, 95, 55].map((h, i) => (
              <div key={i} className="flex-1 max-w-[60px] h-full flex items-end justify-center">
                <div
                  className="w-full bg-rose-500/25 rounded-t animate-pulse"
                  style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-around pt-2">
            {["1-30 días", "31-60 días", "61-90 días", "+90 días"].map((r, i) => (
              <div key={i} className="h-2.5 w-14 bg-muted/60 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TopProductsTableSkeleton() {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-3 w-60 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-32 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 space-y-3">
          <div className="h-8 bg-muted/50 rounded-lg animate-pulse" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse flex items-center px-4 gap-4">
              <div className="w-5 h-5 rounded-full bg-muted/60" />
              <div className="w-48 h-3.5 bg-muted/70 rounded" />
              <div className="w-24 h-3 bg-muted/50 rounded" />
              <div className="flex-1 h-2 bg-muted/40 rounded" />
              <div className="w-12 h-3 bg-muted/60 rounded" />
              <div className="w-16 h-3.5 bg-muted/80 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function OperationsMetricsSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              <div className="h-3 w-60 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-24 bg-blue-500/10 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-stretch">
        {[
          { title: "Lead Time Taller", color: "bg-amber-500/20" },
          { title: "Cumplimiento OTIF", color: "bg-emerald-500/20" },
          { title: "Permanencia x Etapa", color: "bg-rose-500/20" },
          { title: "Abastecimiento", color: "bg-indigo-500/20" },
        ].map((box, i) => (
          <div key={i} className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="h-3.5 w-24 bg-muted/80 animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="space-y-2 mt-2">
                <div className="h-3 w-full bg-muted/40 animate-pulse rounded" />
                <div className="w-full bg-muted/40 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${box.color} animate-pulse`} style={{ width: `${60 + i * 10}%` }} />
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-border/30 flex justify-between">
              <div className="h-2.5 w-16 bg-muted/50 animate-pulse rounded" />
              <div className="h-2.5 w-8 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function FunnelMetricsSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              <div className="h-3 w-60 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-24 bg-purple-500/10 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-stretch flex-1">
          {/* Win Rate */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="h-3.5 w-28 bg-muted/80 animate-pulse rounded" />
                <div className="h-4 w-20 bg-purple-500/10 animate-pulse rounded-full" />
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <div className="h-8 w-20 bg-muted animate-pulse rounded font-mono" />
                <div className="h-3 w-32 bg-muted/60 animate-pulse rounded" />
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-3">
                <div className="bg-purple-500/30 h-full rounded-full animate-pulse" style={{ width: "45%" }} />
              </div>
            </div>
            <div className="pt-3 border-t border-border/40 flex justify-between">
              <div className="h-3 w-24 bg-muted/60 animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted/80 animate-pulse rounded" />
            </div>
          </div>

          {/* Lead Time */}
          <div className="h-full flex flex-col justify-between space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="h-3.5 w-32 bg-muted/80 animate-pulse rounded" />
                <div className="h-3 w-20 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="flex items-baseline gap-3 my-2">
                <div className="h-8 w-14 bg-muted animate-pulse rounded font-mono" />
                <div className="h-3 w-16 bg-muted/60 animate-pulse rounded" />
                <div className="h-6 w-12 bg-muted/70 animate-pulse rounded font-mono" />
                <div className="h-3 w-16 bg-muted/60 animate-pulse rounded" />
              </div>
            </div>
            <div className="pt-3 border-t border-border/40 space-y-1.5">
              <div className="h-2.5 w-full bg-muted/50 animate-pulse rounded" />
              <div className="h-2.5 w-3/4 bg-muted/40 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PaymentMixDonutSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-muted animate-pulse rounded" />
              <div className="h-3 w-52 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="h-5 w-16 bg-emerald-500/10 animate-pulse rounded-full" />
            <div className="h-5 w-14 bg-blue-500/10 animate-pulse rounded-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <div className="relative w-36 h-36 rounded-full border-[14px] border-teal-500/20 animate-pulse flex items-center justify-center">
            <div className="w-8 h-4 bg-muted/60 rounded" />
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-12 bg-muted/70 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function UnliquidatedAgingSkeleton() {
  return (
    <Card className="h-full flex flex-col justify-between border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              <div className="h-3 w-60 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-28 bg-orange-500/15 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        <div className="h-56 flex flex-col justify-between">
          <div className="flex items-end justify-around gap-4 h-44 border-b border-border/30 pb-2">
            {[35, 65, 80, 50].map((h, i) => (
              <div key={i} className="flex-1 max-w-[60px] h-full flex items-end justify-center">
                <div
                  className="w-full bg-orange-500/25 rounded-t animate-pulse"
                  style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-around pt-2">
            {["0-15 días", "16-30 días", "31-60 días", "+60 días"].map((r, i) => (
              <div key={i} className="h-2.5 w-14 bg-muted/60 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function InventoryIntelligenceSkeleton() {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-52 bg-muted animate-pulse rounded" />
              <div className="h-3 w-72 bg-muted/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-5 w-32 bg-emerald-500/10 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-muted/80 animate-pulse rounded-full" />
                <div className="h-4 w-20 bg-muted/50 animate-pulse rounded" />
              </div>
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted/60 animate-pulse rounded" />
              <div className="pt-2 border-t border-border/30 flex justify-between">
                <div className="h-3 w-16 bg-muted/50 animate-pulse rounded" />
                <div className="h-3 w-12 bg-muted/70 animate-pulse rounded font-mono" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-28 bg-muted/20 border border-dashed border-border rounded-xl animate-pulse" />
          <div className="h-28 bg-muted/20 border border-dashed border-border rounded-xl animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
