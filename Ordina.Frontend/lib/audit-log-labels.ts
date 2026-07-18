import type { AuditChangeDto, OrderAuditLogDto } from "@/lib/api-client";
import { formatCurrency, type Currency } from "@/lib/currency-utils";
import { getSaleTypeLabel } from "@/components/orders/constants";
import { REPORTE_FABRICACION_LABEL } from "@/lib/manufacturing-labels";

const PAYMENT_CONDITION_LABELS: Record<string, string> = {
  cashea: "Cashea",
  pagara_en_tienda: "Pagará en Tienda",
  pago_a_entrega: "Pago a la entrega",
  pago_parcial: "Pago Parcial",
  todo_pago: "Todo Pago",
};

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
  "(ninguno)": "(ninguno)",
  "(sin descuento)": "(sin descuento)",
  "(sin condición)": "(sin condición)",
  "(vacío)": "(vacío)",
  "(sin atributos)": "(sin atributos)",
};

const FIELD_LABELS: Record<string, string> = {
  Status: "Estado del pedido",
  PaymentCondition: "Condición de pago",
  SaleType: "Tipo de venta",
  DispatchObservations: "Observaciones de despacho",
  ProductMarkups: "Sobreprecios",
  ProductDiscountTotal: "Descuento en productos",
  generalDiscount: "Descuento general",
  paymentDetails: "Detalle de pago",
  partialPayments: "Pagos parciales",
  mixedPayments: "Pagos mixtos",
  "mixedPayments[+]": "Pago agregado",
  "partialPayments[+]": "Pago agregado",
  "mixedPayments[-]": "Pago eliminado",
  "partialPayments[-]": "Pago eliminado",
  logisticStatus: "Estado logístico",
  manufacturingStatus: "Estado de fabricación",
  locationStatus: "Ubicación",
  cantidad: "Cantidad",
  fabricacion: "Fabricación",
  nombre: "Nombre",
  precio: "Precio",
  total: "Total línea",
  descuento: "Descuento",
  observaciones: "Observaciones",
  atributos: "Atributos",
};

const PRODUCT_FIELD_REGEX = /^producto\[(.+)\](?:\.(.+))?$/i;

function extractSemicolonField(raw: string, label: string): string | null {
  const re = new RegExp(`(?:^|;\\s*)${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`, "i");
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

function normalizePaymentCurrency(currency: string): Currency {
  const cur = currency.trim().toUpperCase();
  if (cur === "USD") return "USD";
  if (cur === "EUR") return "EUR";
  return "Bs";
}

function resolvePaymentDisplayFromRaw(raw: string): {
  amountStr: string | null;
  currency: string;
} {
  const explicitCurrency = extractSemicolonField(raw, "Moneda");
  const explicitAmount = extractSemicolonField(raw, "Monto");

  if (explicitCurrency && explicitAmount) {
    return { amountStr: explicitAmount, currency: explicitCurrency };
  }

  const origCurr = extractSemicolonField(raw, "Orig curr");
  const origAmt = extractSemicolonField(raw, "Orig amt");
  const cashCurr = extractSemicolonField(raw, "Cash curr");
  const cashAmt = extractSemicolonField(raw, "CashReceived");

  if (origCurr && origAmt) {
    return { amountStr: origAmt, currency: origCurr };
  }
  if (cashCurr && cashAmt) {
    return { amountStr: cashAmt, currency: cashCurr };
  }

  return { amountStr: explicitAmount, currency: explicitCurrency ?? "Bs" };
}

function formatPaymentShort(
  method: string,
  amount: number,
  currency: string,
): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${method} ${formatCurrency(rounded, normalizePaymentCurrency(currency))}`;
}

function formatPaymentListValueForDisplay(raw: string): string {
  const method = extractSemicolonField(raw, "Método") ?? "?";
  const { amountStr, currency } = resolvePaymentDisplayFromRaw(raw);

  if (!amountStr) {
    return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
  }

  const amount = parseFloat(amountStr);
  if (Number.isNaN(amount)) {
    return `${method} ${amountStr}`;
  }

  return formatPaymentShort(method, amount, currency);
}

export function formatAuditField(field: string): string {
  if (field in FIELD_LABELS) return FIELD_LABELS[field];
  if (
    field.startsWith("mixedPayments[") ||
    field.startsWith("partialPayments[")
  ) {
    return "Pago modificado";
  }

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

  if (field === "PaymentCondition") {
    return PAYMENT_CONDITION_LABELS[value.trim()] ?? value;
  }

  if (field === "SaleType") {
    return getSaleTypeLabel(value) || value;
  }

  if (
    field.startsWith("mixedPayments") ||
    field.startsWith("partialPayments")
  ) {
    return formatPaymentListValueForDisplay(value);
  }

  if (value.includes(" / ")) {
    const [a, b] = value.split(" / ", 2);
    return `${formatAuditSingleValue(a)} / ${formatAuditSingleValue(b)}`;
  }
  return formatAuditSingleValue(value);
}

function formatAuditSingleValue(value: string): string {
  const key = value.trim().toLowerCase();
  if (PAYMENT_CONDITION_LABELS[value.trim()]) {
    return PAYMENT_CONDITION_LABELS[value.trim()];
  }
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

const CASHEA_FINANCED_METHOD = "Cashea (financiación)";
const PAYMENT_AMOUNT_EPSILON = 0.02;

function isCasheaFinancingPaymentRaw(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const method = extractSemicolonField(raw, "Método");
  return (
    method === CASHEA_FINANCED_METHOD ||
    /casheaFinancedPortion\s*=\s*true/i.test(raw)
  );
}

function getPaymentAmountFromRaw(raw: string): number | null {
  const { amountStr } = resolvePaymentDisplayFromRaw(raw);
  if (!amountStr) return null;
  const amount = parseFloat(amountStr);
  return Number.isNaN(amount) ? null : amount;
}

/** Suprime +/- de stub Cashea financiación con mismo monto (IDs regenerados al guardar). */
export function filterRedundantCasheaPaymentAuditChanges(
  changes: AuditChangeDto[],
): AuditChangeDto[] {
  const added = changes.filter(
    (c) => c.field === "mixedPayments[+]" || c.field === "partialPayments[+]",
  );
  const removed = changes.filter(
    (c) => c.field === "mixedPayments[-]" || c.field === "partialPayments[-]",
  );
  const suppressed = new Set<AuditChangeDto>();

  for (const r of removed) {
    if (!isCasheaFinancingPaymentRaw(r.oldValue)) continue;
    const removedAmount = getPaymentAmountFromRaw(r.oldValue!);
    if (removedAmount == null) continue;

    for (const a of added) {
      if (suppressed.has(a)) continue;
      if (!isCasheaFinancingPaymentRaw(a.newValue)) continue;
      const addedAmount = getPaymentAmountFromRaw(a.newValue!);
      if (addedAmount == null) continue;
      if (Math.abs(removedAmount - addedAmount) <= PAYMENT_AMOUNT_EPSILON) {
        suppressed.add(r);
        suppressed.add(a);
        break;
      }
    }
  }

  return changes.filter((c) => !suppressed.has(c));
}

export function getSummaryPreview(log: OrderAuditLogDto): string | null {
  if (!log.changes?.length) return null;
  if (!isGenericAuditSummary(log.summary)) return null;

  const first = log.changes[0];
  const field = getDisplayField(first);
  return `${field}: ${getDisplayOldValue(first)} → ${getDisplayNewValue(first)}`;
}

/** Resumen legible recalculado desde los cambios (corrige montos/monedas en logs históricos). */
export function getDisplaySummary(log: OrderAuditLogDto): string {
  if (!log.changes?.length) return log.summary;

  const changes = filterRedundantCasheaPaymentAuditChanges(log.changes);
  const parts: string[] = [];

  for (const c of changes.filter((ch) => ch.field.includes(".fabricacion"))) {
    const name = extractProductName(c.field);
    if (name) {
      parts.push(
        `Fabricación ${name}: ${getDisplayOldValue(c)} → ${getDisplayNewValue(c)}`,
      );
    }
  }

  const paymentCondition = changes.find((c) => c.field === "PaymentCondition");
  if (paymentCondition) {
    parts.push(
      `Condición de pago: ${getDisplayOldValue(paymentCondition)} → ${getDisplayNewValue(paymentCondition)}`,
    );
  }

  const saleType = changes.find((c) => c.field === "SaleType");
  if (saleType) {
    parts.push(
      `Tipo de venta: ${getDisplayOldValue(saleType)} → ${getDisplayNewValue(saleType)}`,
    );
  }

  for (const c of changes.filter(
    (ch) => ch.field === "mixedPayments[+]" || ch.field === "partialPayments[+]",
  )) {
    parts.push(`Agregó pago: ${getDisplayNewValue(c)}`);
  }

  for (const c of changes.filter(
    (ch) => ch.field === "mixedPayments[-]" || ch.field === "partialPayments[-]",
  )) {
    parts.push(`Eliminó pago: ${getDisplayOldValue(c)}`);
  }

  const status = changes.find((c) => c.field === "Status");
  if (status) {
    parts.push(
      `Estado del pedido: ${getDisplayOldValue(status)} → ${getDisplayNewValue(status)}`,
    );
  }

  if (parts.length > 0) return parts.join(" — ");

  if (changes.some((c) => c.field.startsWith("conciliación."))) {
    return `Conciliación de pagos en pedido ${log.orderNumber}`;
  }

  const priceChange = changes.find((c) => c.field.includes(".precio"));
  if (priceChange && changes.length === 1) {
    const name = extractProductName(priceChange.field) ?? "producto";
    return `Precio ${name}: ${getDisplayOldValue(priceChange)} → ${getDisplayNewValue(priceChange)}`;
  }

  if (changes.length === 1) {
    const c = changes[0];
    return `Actualizó ${getDisplayField(c)}: ${getDisplayOldValue(c)} → ${getDisplayNewValue(c)}`;
  }

  const preview = changes
    .slice(0, 2)
    .map(
      (c) =>
        `${getDisplayField(c)}: ${getDisplayOldValue(c)} → ${getDisplayNewValue(c)}`,
    )
    .join("; ");
  const suffix = changes.length > 2 ? ` y ${changes.length - 2} más` : "";
  return `Actualizó el pedido ${log.orderNumber} (${preview}${suffix})`;
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
