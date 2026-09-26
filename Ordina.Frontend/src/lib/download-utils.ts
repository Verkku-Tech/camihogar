/**
 * Utilidades para manejo seguro de descargas y extracción de nombres de archivo.
 */

/**
 * Genera el sufijo de fecha DD-MM-YYYY para nombres de archivo de reportes descargados.
 */
export function formatReportDateSuffix(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Extrae limpiamente el nombre de archivo desde el encabezado Content-Disposition,
 * soportando filename*=UTF-8''... y filename="...", evitando que se incluyan parámetros
 * subsiguientes (como '; filename*=UTF-8''...').
 */
export function getFilenameFromContentDisposition(
  contentDisposition: string | null | undefined,
): string | null {
  if (!contentDisposition) return null

  // 1. filename*=UTF-8''... (RFC 5987 / RFC 6266)
  const utf8Match = contentDisposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i)
  if (utf8Match && utf8Match[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ""))
      if (decoded) return decoded
    } catch {
      return utf8Match[1].trim().replace(/^["']|["']$/g, "")
    }
  }

  // 2. filename="..." (quoted)
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim()
  }

  // 3. filename=... (hasta el siguiente punto y coma o fin de línea)
  const unquotedMatch = contentDisposition.match(/filename=([^;]+)/i)
  if (unquotedMatch && unquotedMatch[1]) {
    return unquotedMatch[1].trim().replace(/^["']|["']$/g, "")
  }

  return null
}

/**
 * Dispara la descarga de un Blob en el navegador con el nombre especificado o derivado de Content-Disposition.
 */
export function triggerFileDownload(
  blob: Blob,
  fallbackFilename: string,
  contentDisposition?: string | null,
): void {
  const parsedFilename = getFilenameFromContentDisposition(contentDisposition)
  const fileName = parsedFilename || fallbackFilename
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = downloadUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}
