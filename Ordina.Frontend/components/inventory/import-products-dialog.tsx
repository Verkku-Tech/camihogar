"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, Loader2, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { apiClient, type ImportProductsResultDto } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface ImportProductsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: () => void
}

type DialogState = "idle" | "file-selected" | "importing" | "done"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function ImportProductsDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportProductsDialogProps) {
  const [state, setState] = useState<DialogState>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [currency, setCurrency] = useState<string>("USD")
  const [result, setResult] = useState<ImportProductsResultDto | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (f) {
      setFile(f)
      setState("file-selected")
      setResult(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: state === "importing",
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message ?? "Archivo no válido"
      toast.error("Error al seleccionar archivo", { description: msg })
    },
  })

  const handleImport = async () => {
    if (!file) return

    setState("importing")
    try {
      const res = await apiClient.importProducts(file, currency)
      setResult(res)
      setState("done")

      const errors = res.sheets.reduce((s, sh) => s + sh.errors.length, 0)
      const cats = res.totalCategoriesCreated + res.totalCategoriesUpdated
      if (errors > 0) {
        toast.warning("Importación completada con errores", {
          description: `${cats} categoría(s) procesada(s), ${res.totalValuesAdded} valor(es) agregado(s). ${errors} error(es).`,
        })
      } else {
        toast.success("Importación completada", {
          description: `${cats} categoría(s) procesada(s), ${res.totalValuesAdded} valor(es) agregado(s).`,
        })
      }
      onImportComplete?.()
    } catch (err) {
      setState("file-selected")
      toast.error("Error al importar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      })
    }
  }

  const handleClose = () => {
    setState("idle")
    setFile(null)
    setResult(null)
    onOpenChange(false)
  }

  const handleReset = () => {
    setState("idle")
    setFile(null)
    setResult(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) handleClose();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Categorías desde Excel</DialogTitle>
        </DialogHeader>

        {state === "done" && result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {result.totalCategoriesCreated + result.totalCategoriesUpdated} categoría(s) procesada(s) ·{" "}
              {result.totalValuesAdded} valor(es) agregado(s) ·{" "}
              {result.totalSheets} hoja(s)
            </p>
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hoja</TableHead>
                    <TableHead className="w-20">Categoría</TableHead>
                    <TableHead className="w-16">Valores</TableHead>
                    <TableHead className="w-16">Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.sheets.map((s) => (
                    <TableRow key={s.sheetName}>
                      <TableCell className="font-medium truncate max-w-[140px]" title={s.sheetName}>
                        {s.sheetName}
                      </TableCell>
                      <TableCell>
                        {s.categoryCreated ? (
                          <Badge variant="secondary">Nueva</Badge>
                        ) : s.categoryUpdated ? (
                          <Badge variant="outline">Actualizada</Badge>
                        ) : (
                          <Badge variant="outline">Sin cambios</Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.valuesAdded}</TableCell>
                      <TableCell>
                        {s.errors.length > 0 ? (
                          <Badge variant="destructive">{s.errors.length}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleReset}>
                Importar otro
              </Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div
              {...getRootProps()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm font-medium truncate max-w-full">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground text-center">
                    Arrastra tu archivo .xlsx aquí o haz clic para seleccionar
                  </span>
                  <span className="text-xs text-muted-foreground">Máx. 10 MB</span>
                </>
              )}
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
              <Button
                onClick={handleImport}
                disabled={!file || state === "importing"}
              >
                {state === "importing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
