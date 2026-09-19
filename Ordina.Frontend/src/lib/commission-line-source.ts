export type CommissionLineSource =
  | "reservation_unchanged"
  | "store_modified"
  | "store_added"
  | "store_substitution";

const LABELS: Record<CommissionLineSource, string> = {
  reservation_unchanged: "Reserva sin cambios",
  store_modified: "Modificado en tienda",
  store_added: "Agregado en tienda",
  store_substitution: "Sustitución en tienda",
};

export function getCommissionLineSourceLabel(
  source?: string | null,
): string | null {
  if (!source) return null;
  return LABELS[source as CommissionLineSource] ?? null;
}

export function isCommissionLineSource(
  source?: string | null,
): source is CommissionLineSource {
  return !!source && source in LABELS;
}
