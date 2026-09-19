"use client";

import { Badge } from "@/components/ui/badge";
import { getCommissionLineSourceLabel } from "@/lib/commission-line-source";

export function CommissionLineSourceBadge({
  source,
}: {
  source?: string | null;
}) {
  const label = getCommissionLineSourceLabel(source);
  if (!label) return null;

  const variant =
    source === "reservation_unchanged"
      ? "secondary"
      : source === "store_added"
        ? "default"
        : "outline";

  return (
    <Badge variant={variant} className="text-xs font-normal">
      {label}
    </Badge>
  );
}
