"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2, FileSpreadsheet, Database } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface DownloadFormatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DownloadMode = "empty" | "with-data"

export function DownloadFormatDialog({
  open,
  onOpenChange,
}: DownloadFormatDialogProps) {
  const [mode, setMode] = useState<DownloadMode>("empty")
  const [currency, setCurrency] = useState<string>("USD")
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await apiClient.exportProducts(mode === "with-data", currency)
      toast.success("Archivo descargado", {
        description:
          mode === "with-data"
            ? "El formato fue descargado con los datos actuales."
            : "La plantilla vacía fue descargada.",
      })
      onOpenChange(false)
    } catch (err) {
      toast.error("Error al descargar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descargar Formato</DialogTitle>
          <DialogDescription>
            Elige qué tipo de archivo deseas descargar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("empty")}
            className={cn(
              "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
              mode === "empty"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            <FileSpreadsheet className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Formato vacío</p>
              <p className="text-xs text-muted-foreground">
                Solo los headers de las 3 hojas (ESQUEMA_CATEGORIAS, VALORES_Y_PRECIOS, PRODUCTOS_FINALES). Ideal para importar desde cero.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("with-data")}
            className={cn(
              "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
              mode === "with-data"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            <Database className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Con datos actuales</p>
              <p className="text-xs text-muted-foreground">
                Incluye las categorías, valores y productos existentes. Ideal para editar precios masivamente y reimportar.
              </p>
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Moneda de precios</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="Bs">Bs</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
