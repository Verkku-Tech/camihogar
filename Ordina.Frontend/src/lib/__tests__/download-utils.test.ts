import { describe, it, expect } from "bun:test"
import {
  formatReportDateSuffix,
  getFilenameFromContentDisposition,
} from "../download-utils"

describe("download-utils", () => {
  it("formatReportDateSuffix formats date as DD-MM-YYYY", () => {
    const fixedDate = new Date(2026, 8, 26) // September 26, 2026
    expect(formatReportDateSuffix(fixedDate)).toBe("26-09-2026")
  })

  it("extracts clean filename from ASP.NET Core dual filename header", () => {
    const header =
      "attachment; filename=ReporteFabricacion_26-09-2026.xlsx; filename*=UTF-8''ReporteFabricacion_26-09-2026.xlsx"
    expect(getFilenameFromContentDisposition(header)).toBe(
      "ReporteFabricacion_26-09-2026.xlsx",
    )
  })

  it("extracts filename from quoted header", () => {
    const header = 'attachment; filename="ReportePagos_26-09-2026.xlsx"'
    expect(getFilenameFromContentDisposition(header)).toBe(
      "ReportePagos_26-09-2026.xlsx",
    )
  })

  it("extracts filename from unquoted header with trailing params", () => {
    const header = "attachment; filename=ReporteDespachos_26-09-2026.xlsx; size=12345"
    expect(getFilenameFromContentDisposition(header)).toBe(
      "ReporteDespachos_26-09-2026.xlsx",
    )
  })

  it("returns null for null or empty header", () => {
    expect(getFilenameFromContentDisposition(null)).toBeNull()
    expect(getFilenameFromContentDisposition("")).toBeNull()
  })
})
