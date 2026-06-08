/** Parsea yyyy-MM-dd del input type=date en inicio/fin del día local. */
export function parseReportDateRange(startDate: string, endDate: string) {
  const [ys, ms, ds] = startDate.split("-").map(Number)
  const [ye, me, de] = endDate.split("-").map(Number)
  const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0)
  const end = new Date(ye, me - 1, de, 23, 59, 59, 999)
  return { start, end }
}

export function isDateInReportRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= end.getTime()
}
