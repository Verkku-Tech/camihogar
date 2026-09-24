import type { JSX } from "react";
import {
  CheckCircle2,
  DollarSign,
  Factory,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { formatAuditAction } from "@/lib/audit-log-labels";

interface AuditActionBadgeProps {
  action: string;
  hasPaymentChanges?: boolean;
}

export function AuditActionBadge({
  action,
  hasPaymentChanges = false,
}: AuditActionBadgeProps): JSX.Element {
  if (hasPaymentChanges || action === "payment_conciliated") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/25">
        <DollarSign className="w-3 h-3 shrink-0" />
        {action === "payment_conciliated"
          ? "Conciliación"
          : "Pagos Actualizados"}
      </span>
    );
  }

  switch (action) {
    case "created":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          <PackagePlus className="w-3 h-3 shrink-0" />
          Creado
        </span>
      );

    case "updated":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/25">
          <Sparkles className="w-3 h-3 shrink-0" />
          Actualizado
        </span>
      );

    case "deleted":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/25">
          <Trash2 className="w-3 h-3 shrink-0" />
          Eliminado
        </span>
      );

    case "order_declined":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/25">
          <XCircle className="w-3 h-3 shrink-0" />
          Declinado
        </span>
      );

    case "order_decline_reverted":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
          <RotateCcw className="w-3 h-3 shrink-0" />
          Revertido
        </span>
      );

    case "manufacturing_started":
    case "manufacturing_completed":
    case "manufacturing_queued":
    case "manufacturing_reverted":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
          <Factory className="w-3 h-3 shrink-0" />
          {formatAuditAction(action)}
        </span>
      );

    case "item_validated":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Ítem Validado
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <RefreshCw className="w-3 h-3 shrink-0" />
          {formatAuditAction(action)}
        </span>
      );
  }
}
