import type { JSX } from "react";

interface AuditTimelineSkeletonProps {
  count?: number;
}

export function AuditTimelineSkeleton({
  count = 4,
}: AuditTimelineSkeletonProps): JSX.Element {
  return (
    <div
      className="relative pl-8 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60"
      aria-label="Cargando historial de auditoría"
      role="status"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={`skel-${index}`} className="relative">
          {/* Timeline node skeleton */}
          <div className="absolute -left-8 top-3.5 w-6 h-6 rounded-full bg-card border border-border/60 animate-pulse" />

          {/* Event Card skeleton */}
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 bg-muted/70 rounded-md animate-pulse" />
                <div className="h-5 w-5 bg-muted/50 rounded-full animate-pulse" />
                <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
                <div className="h-5 w-24 bg-muted/50 rounded-md animate-pulse" />
              </div>
              <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
            </div>

            <div className="space-y-2 pt-1">
              <div className="h-5 w-3/4 bg-muted/40 rounded animate-pulse" />
              <div className="h-5 w-1/2 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
