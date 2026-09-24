import { useState, useMemo, type JSX } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Factory,
  FileText,
  PackagePlus,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import type { OrderAuditLogDto } from "@/lib/api-client";
import {
  extractStructuredChanges,
  formatRelativeTime,
  type StructuredAuditItem,
} from "@/lib/audit-log-labels";
import { AuditActionBadge } from "./audit-action-badge";
import { AuditDiffRow } from "./audit-diff-row";

interface AuditTimelineItemProps {
  log: OrderAuditLogDto;
  onSelectOrder?: (orderNumber: string) => void;
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatExactTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString("es-VE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function AuditTimelineItem({
  log,
  onSelectOrder,
}: AuditTimelineItemProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const items: StructuredAuditItem[] = useMemo(
    () => extractStructuredChanges(log),
    [log],
  );

  const hasPaymentChanges = useMemo(
    () =>
      items.some(
        (it) => it.type === "payment_add" || it.type === "payment_remove",
      ),
    [items],
  );

  const INITIAL_COUNT = 3;
  const hasMore = items.length > INITIAL_COUNT;
  const visibleItems = isExpanded ? items : items.slice(0, INITIAL_COUNT);
  const remainingCount = items.length - INITIAL_COUNT;

  // Determine node styling and icon
  const nodeIcon = useMemo(() => {
    if (hasPaymentChanges || log.action === "payment_conciliated") {
      return {
        icon: <DollarSign className="w-3.5 h-3.5" />,
        className:
          "border-purple-500/80 text-purple-400 bg-background shadow-[0_0_10px_rgba(168,85,247,0.35)]",
      };
    }
    if (log.action === "created") {
      return {
        icon: <PackagePlus className="w-3.5 h-3.5" />,
        className:
          "border-emerald-500/80 text-emerald-400 bg-background shadow-[0_0_10px_rgba(28,181,105,0.35)]",
      };
    }
    if (log.action === "deleted" || log.action === "order_declined") {
      return {
        icon: <Trash2 className="w-3.5 h-3.5" />,
        className:
          "border-rose-500/80 text-rose-400 bg-background shadow-[0_0_10px_rgba(244,63,94,0.35)]",
      };
    }
    if (log.action === "order_decline_reverted") {
      return {
        icon: <RotateCcw className="w-3.5 h-3.5" />,
        className:
          "border-amber-500/80 text-amber-400 bg-background shadow-[0_0_10px_rgba(245,158,11,0.35)]",
      };
    }
    if (log.action.startsWith("manufacturing_")) {
      return {
        icon: <Factory className="w-3.5 h-3.5" />,
        className:
          "border-amber-500/80 text-amber-400 bg-background shadow-[0_0_10px_rgba(245,158,11,0.35)]",
      };
    }
    if (log.action === "item_validated") {
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        className:
          "border-emerald-500/80 text-emerald-400 bg-background shadow-[0_0_10px_rgba(28,181,105,0.35)]",
      };
    }
    return {
      icon: <Sparkles className="w-3.5 h-3.5" />,
      className:
        "border-sky-500/80 text-sky-400 bg-background shadow-[0_0_10px_rgba(56,189,248,0.35)]",
    };
  }, [log.action, hasPaymentChanges]);

  return (
    <div className="relative group">
      {/* Node on vertical timeline */}
      <div
        className={`absolute -left-8 top-3.5 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-transform duration-200 group-hover:scale-110 ${nodeIcon.className}`}
      >
        {nodeIcon.icon}
      </div>

      {/* Event Card */}
      <div className="rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-border transition-all duration-200 p-3.5 shadow-sm space-y-2.5">
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Clickable Order Number */}
            <button
              type="button"
              onClick={() => onSelectOrder?.(log.orderNumber)}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md hover:bg-emerald-500/20 hover:border-emerald-500/60 transition-all cursor-pointer shadow-sm"
              title={`Ver pedido ${log.orderNumber}`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              {log.orderNumber}
            </button>

            {/* Actor identity */}
            <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 border border-border/60 text-[10px] font-bold flex items-center justify-center shrink-0">
                {getInitials(log.userName)}
              </span>
              <span>{log.userName}</span>
            </div>

            {/* Action Badge */}
            <AuditActionBadge
              action={log.action}
              hasPaymentChanges={hasPaymentChanges}
            />
          </div>

          {/* Timestamp with tooltip */}
          <div
            className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono ml-auto"
            title={new Date(log.timestamp).toLocaleString("es-VE")}
          >
            <Clock className="w-3 h-3 text-muted-foreground/80 shrink-0" />
            <span>
              {formatRelativeTime(log.timestamp)}
              {formatExactTime(log.timestamp)
                ? ` · ${formatExactTime(log.timestamp)}`
                : ""}
            </span>
          </div>
        </div>

        {/* Changes list */}
        <div className="space-y-1.5 pt-0.5">
          {visibleItems.map((item, index) => (
            <AuditDiffRow key={`diff-${log.id}-${index}`} item={item} />
          ))}

          {/* In-place expansion button */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-2.5 py-1 rounded-md transition-all cursor-pointer"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
              <span>
                {isExpanded
                  ? "Ocultar cambios"
                  : `+ ${remainingCount} cambio${remainingCount === 1 ? "" : "s"} adicional${remainingCount === 1 ? "" : "es"}`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
