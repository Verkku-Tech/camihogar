import type { JSX } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import type { StructuredAuditItem } from "@/lib/audit-log-labels";

interface AuditDiffRowProps {
  item: StructuredAuditItem;
}

export function AuditDiffRow({ item }: AuditDiffRowProps): JSX.Element {
  if (item.type === "payment_add") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/12 text-emerald-400 border border-emerald-500/30 font-mono shadow-sm">
          <Plus className="w-3 h-3 shrink-0" />
          Agregó pago: {item.paymentText}
        </span>
      </div>
    );
  }

  if (item.type === "payment_remove") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/12 text-rose-400 border border-rose-500/30 font-mono shadow-sm">
          <Minus className="w-3 h-3 shrink-0" />
          Eliminó pago: {item.paymentText}
        </span>
      </div>
    );
  }

  if (item.type === "creation_summary") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {item.paymentText ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/12 text-emerald-400 border border-emerald-500/30 font-mono shadow-sm">
            <Check className="w-3 h-3 shrink-0" />
            Pago inicial: {item.paymentText}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-medium">
            Registro inicial de pedido
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-sm leading-relaxed">
      {item.label && (
        <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
          {item.label}
        </span>
      )}

      {item.oldValue != null && item.oldValue !== "" ? (
        <div className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 line-through bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-mono">
            {item.oldValue}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
              item.type === "status"
                ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/35"
                : "text-foreground bg-foreground/10 border border-border/60"
            }`}
          >
            {item.newValue || "—"}
          </span>
        </div>
      ) : (
        <span className="text-xs text-foreground font-medium bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded font-mono">
          {item.newValue || "—"}
        </span>
      )}
    </div>
  );
}
