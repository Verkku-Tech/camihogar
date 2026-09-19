/** Etiqueta UI para el estado/cola `por_fabricar` (el código interno no cambia). */
export const REPORTE_FABRICACION_LABEL = "Reporte de fabricación"

export function getManufacturingStatusLabel(
  status: string | undefined | null,
): string {
  switch (status?.toLowerCase()) {
    case "debe_fabricar":
      return "Debe fabricar"
    case "por_fabricar":
      return REPORTE_FABRICACION_LABEL
    case "fabricando":
      return "Fabricando"
    case "almacen_no_fabricado":
    case "fabricado":
      return "En almacén"
    default:
      return status ?? ""
  }
}

/** Normaliza etiquetas legadas o de API al texto UI actual. */
export function normalizeManufacturingStatusLabel(
  label: string | undefined | null,
): string {
  if (!label) return ""
  if (label.trim().toLowerCase() === "por fabricar") {
    return REPORTE_FABRICACION_LABEL
  }
  return label
}
