import type { AuditChangeDto, OrderAuditLogDto } from "@/lib/api-client";
import { REPORTE_FABRICACION_LABEL } from "@/lib/manufacturing-labels";

const VALUE_LABELS: Record<string, string> = {
  debe_fabricar: "Debe fabricar",
  por_fabricar: REPORTE_FABRICACION_LABEL,
  fabricando: "Fabricando",
  almacen_no_fabricado: "En almacén",
  fabricado: "En almacén",
  generado: "Generado",
  pendiente: "Pendiente",
  validado: "Validado",
  "fabricándose": "Fabricándose",
  "en almacén": "En almacén",
  "en ruta": "En Ruta",
  completado: "Completado",
  fabricacion: "Fabricación",
  "(sin estado)": "(sin estado)",
  "(previo)": "(previo)",
  "(eliminado)": "(eliminado)",
};

const FIELD_LABELS: Record<string, string> = {
  Status: "Estado del pedido",
  paymentDetails: "Detalle de pago",
  partialPayments: "Pagos parciales",
  mixedPayments: "Pagos mixtos",
  logisticStatus: "Estado logístico",
  manufacturingStatus: "Estado de fabricación",
  locationStatus: "Ubicación",
  cantidad: "Cantidad",
  fabricacion: "Fabricación",
};

const PRODUCT_FIELD_REGEX = /^producto\[(.+)\](?:\.(.+))?$/i;

export function formatAuditField(field: string): string {
  const match = field.trim().match(PRODUCT_FIELD_REGEX);
  if (match) {
    const suffix = match[2] ?? "";
    if (suffix && FIELD_LABELS[suffix]) return FIELD_LABELS[suffix];
    if (suffix === "fabricacion") return "Fabricación";
    return suffix ? suffix : "Producto";
  }
  if (field.startsWith("conciliación.")) {
    return field.slice("conciliación.".length);
  }
  return FIELD_LABELS[field] ?? field;
}

export function formatAuditValue(field: string, value?: string | null): string {
  if (value == null || value === "") return "—";
  if (value.includes(" / ")) {
    const [a, b] = value.split(" / ", 2);
    return `${formatAuditSingleValue(a)} / ${formatAuditSingleValue(b)}`;
  }
  return formatAuditSingleValue(value);
}

function formatAuditSingleValue(value: string): string {
  const key = value.trim().toLowerCase();
  return VALUE_LABELS[key] ?? value;
}

export function extractProductName(field: string): string | null {
  const match = field.trim().match(PRODUCT_FIELD_REGEX);
  return match ? match[1] : null;
}

export function getDisplayField(change: AuditChangeDto): string {
  return change.displayField ?? formatAuditField(change.field);
}

export function getDisplayOldValue(change: AuditChangeDto): string {
  return change.displayOldValue ?? formatAuditValue(change.field, change.oldValue);
}

export function getDisplayNewValue(change: AuditChangeDto): string {
  return change.displayNewValue ?? formatAuditValue(change.field, change.newValue);
}

export type AuditChangeGroup = {
  key: string;
  productName: string | null;
  changes: AuditChangeDto[];
};

export function groupChangesByProduct(changes: AuditChangeDto[]): AuditChangeGroup[] {
  const groups = new Map<string, AuditChangeGroup>();

  for (const change of changes) {
    const productName =
      change.productName ?? extractProductName(change.field) ?? null;
    const key = productName ?? "__order__";
    const existing = groups.get(key);
    if (existing) {
      existing.changes.push(change);
    } else {
      groups.set(key, { key, productName, changes: [change] });
    }
  }

  return Array.from(groups.values());
}

const GENERIC_SUMMARY_REGEX =
  /^Actualizó el pedido .+ \(\d+ cambio\(s\)(?:\s*—\s*estado:.*)?$/i;

export function isGenericAuditSummary(summary: string): boolean {
  return GENERIC_SUMMARY_REGEX.test(summary.trim());
}

export function getSummaryPreview(log: OrderAuditLogDto): string | null {
  if (!log.changes?.length) return null;
  if (!isGenericAuditSummary(log.summary)) return null;

  const first = log.changes[0];
  const field = getDisplayField(first);
  return `${field}: ${getDisplayOldValue(first)} → ${getDisplayNewValue(first)}`;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  deleted: "Eliminado",
  payment_conciliated: "Conciliación pagos",
  item_validated: "Ítem validado",
  manufacturing_queued: "Enviado a reporte de fabricación",
  manufacturing_started: "Inició fabricación",
  manufacturing_completed: "Completó fabricación",
  manufacturing_reverted: "Devuelto a reporte de fabricación",
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
