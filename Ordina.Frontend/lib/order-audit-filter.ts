/**
 * Alinea el valor del filtro de auditoría con los números almacenados
 * (`ORD-xxx` / `PRE-` / `PCF-` + 3 dígitos; ver backend OrderService.FormatOrderNumberWithPrefix).
 */
export function normalizeOrderNumberForAuditFilter(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const pad3 = (n: number) => n.toString().padStart(3, "0");

  const m = s.match(/^(ord|pre|pcf)\s*-\s*0*(\d+)$/i);
  if (m) {
    const kind = m[1].toUpperCase();
    const n = parseInt(m[2], 10);
    if (Number.isNaN(n) || n < 0) return s;
    if (kind === "ORD") return `ORD-${pad3(n)}`;
    if (kind === "PRE") return `PRE-${pad3(n)}`;
    if (kind === "PCF") return `PCF-${pad3(n)}`;
  }

  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isNaN(n) || n < 0) return s;
    return `ORD-${pad3(n)}`;
  }

  return s;
}
