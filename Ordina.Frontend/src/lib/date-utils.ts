/** yyyy-MM-dd en calendario local (alineado con toLocaleDateString de tablas). */
export function toLocalDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Comprueba si una fecha ISO cae en el rango [from, to] (días locales).
 * from/to vacíos = sin límite en ese extremo. Sin from ni to → true.
 * Con filtro activo y sin iso → false (p. ej. entregas legacy sin deliveredAt).
 */
export function matchesLocalDateRange(
  iso: string | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true
  if (!iso?.trim()) return false

  let rangeFrom = from
  let rangeTo = to
  if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
    ;[rangeFrom, rangeTo] = [rangeTo, rangeFrom]
  }

  const day = toLocalDateKey(iso)
  if (rangeFrom && day < rangeFrom) return false
  if (rangeTo && day > rangeTo) return false
  return true
}
