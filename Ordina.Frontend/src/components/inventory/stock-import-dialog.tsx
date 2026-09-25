"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiClient, type StockImportSummaryDto } from "@/lib/api-client"

interface StockImportDialogProps {
  onSuccess?: () => void
}

export function StockImportDialog({ onSuccess }: StockImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [summary, setSummary] = useState<StockImportSummaryDto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true)
      const blob = await apiClient.downloadStockTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "plantilla_inventario_camihogar.xlsx"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Plantilla descargada")
    } catch (err) {
      console.error("Error downloading template:", err)
      toast.error("Error al descargar la plantilla de inventario")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setSummary(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Seleccione un archivo de Excel (.xlsx)")
      return
    }

    try {
      setIsUploading(true)
      const result = await apiClient.importStockExcel(file)
      setSummary(result)
      toast.success(`Importación completada: ${result.createdCount} creados, ${result.updatedCount} actualizados`)
      onSuccess?.()
    } catch (err: any) {
      console.error("Error importing stock:", err)
      toast.error(err.message || "Error al procesar el archivo Excel")
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) handleReset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50">
          <Upload className="w-4 h-4 mr-2" />
          Carga Masiva Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Importación Masiva de Existencias Físicas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Download Template */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40 text-sm">
            <div>
              <p className="font-semibold text-foreground">1. Descarga la plantilla oficial</p>
              <p className="text-xs text-muted-foreground">Formato XLSX con columnas de SKU, sede, cantidades y atributos.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Plantilla
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-muted/20 text-center space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="stock-excel-upload"
              onChange={handleFileChange}
            />
            <label
              htmlFor="stock-excel-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2 py-4"
            >
              <FileSpreadsheet className="w-10 h-10 text-emerald-500 hover:scale-105 transition-transform" />
              <div className="text-sm">
                {file ? (
                  <span className="font-semibold text-emerald-600">{file.name}</span>
                ) : (
                  <span>Haz clic aquí para seleccionar o arrastra el archivo Excel</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Solo archivos de Microsoft Excel (.xlsx)</p>
            </label>

            {file && (
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={isUploading}>
                  Cambiar archivo
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {isUploading ? "Procesando..." : "Iniciar Carga Masiva"}
                </Button>
              </div>
            )}
          </div>

          {/* Result Summary */}
          {summary && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Resumen de la Importación
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-background border">
                  <p className="text-xs text-muted-foreground">Total Filas</p>
                  <p className="text-lg font-bold">{summary.totalRows}</p>
                </div>
                <div className="p-2 rounded bg-background border">
                  <p className="text-xs text-muted-foreground">Creados</p>
                  <p className="text-lg font-bold text-emerald-600">{summary.createdCount}</p>
                </div>
                <div className="p-2 rounded bg-background border">
                  <p className="text-xs text-muted-foreground">Actualizados</p>
                  <p className="text-lg font-bold text-indigo-600">{summary.updatedCount}</p>
                </div>
              </div>

              {summary.errors && summary.errors.length > 0 && (
                <div className="mt-3 p-3 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Advertencias ({summary.errors.length})
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto text-amber-700 dark:text-amber-400">
                    {summary.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
