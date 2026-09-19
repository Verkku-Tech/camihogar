import { ORDER_PREFIX_RESERVATION } from "./order-document-types";

/**
 * Alinea el valor del filtro de auditoría con los números almacenados
 * (`ORD-xxx` / `PRE-` / `RES-` (y PCF- legacy) + 3 dígitos).
 */
export function normalizeOrderNumberForAuditFilter(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const pad3 = (n: number) => n.toString().padStart(3, "0");

  const m = s.match(/^(ord|pre|res|pcf)\s*-\s*0*(\d+)$/i);
  if (m) {
    const kind = m[1].toUpperCase();
    const n = parseInt(m[2], 10);
    if (Number.isNaN(n) || n < 0) return s;
    if (kind === "ORD") return `ORD-${pad3(n)}`;
    if (kind === "PRE") return `PRE-${pad3(n)}`;
    if (kind === "RES" || kind === "PCF")
      return `${ORDER_PREFIX_RESERVATION}${pad3(n)}`;
  }

  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isNaN(n) || n < 0) return s;
    return `ORD-${pad3(n)}`;
  }

  return s;
}
