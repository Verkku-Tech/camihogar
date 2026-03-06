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
import { Upload, Loader2, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface ImportClientsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportComplete?: () => void
}

type DialogState = "idle" | "file-selected" | "importing" | "done"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function ImportClientsDialog({
    open,
    onOpenChange,
    onImportComplete,
}: ImportClientsDialogProps) {
    const [state, setState] = useState<DialogState>("idle")
    const [file, setFile] = useState<File | null>(null)
    const [result, setResult] = useState<{ message: string; rowsProcessed: number; errors: number; total: number } | null>(null)

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
            "text/csv": [".csv"],
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
            // Método "importClients" será añadido a apiClient.ts en breve
            const res = await apiClient.importClients(file)
            setResult(res)
            setState("done")

            if (res.errors > 0) {
                toast.warning("Importación completada con errores", {
                    description: `Se procesaron ${res.rowsProcessed} filas. ${res.errors} tuvieron errores.`,
                })
            } else {
                toast.success("Importación completada exitosamente", {
                    description: `Se procesaron ${res.rowsProcessed} clientes.`,
                })
            }
            onImportComplete?.()
        } catch (err) {
            setState("file-selected")
            toast.error("Error al importar el CSV", {
                description: err instanceof Error ? err.message : "Error desconocido con el backend",
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
                if (!newOpen) handleClose()
                onOpenChange(newOpen)
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Importar Clientes Massivamente</DialogTitle>
                </DialogHeader>

                {state === "done" && result ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg flex flex-col gap-2">
                            <p className="font-medium text-foreground">{result.message}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                <div className="bg-background rounded-md border p-3">
                                    <span className="text-muted-foreground block mb-1">Filas Procesadas</span>
                                    <span className="text-2xl font-semibold text-green-600">{result.rowsProcessed}</span>
                                </div>
                                <div className="bg-background rounded-md border p-3">
                                    <span className="text-muted-foreground block mb-1">Errores</span>
                                    <span className="text-2xl font-semibold text-red-600">{result.errors}</span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-6">
                            <Button variant="outline" onClick={handleReset}>
                                Importar otro archivo
                            </Button>
                            <Button onClick={handleClose}>Cerrar</Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <>
                        <div
                            {...getRootProps()}
                            className={cn(
                                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors mt-2",
                                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                            )}
                        >
                            <input {...getInputProps()} />
                            {file ? (
                                <>
                                    <FileSpreadsheet className="h-10 w-10 text-primary mb-2" />
                                    <span className="text-sm font-medium truncate max-w-[250px]">{file.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                    <span className="text-sm text-foreground text-center font-medium">
                                        Haz clic para seleccionar o arrastra tu archivo CSV aquí
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        Solo archivos .csv hasta 10 MB
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-3 rounded-md text-sm mt-4">
                            <strong>Formato esperado:</strong> El archivo debe ser un CSV y contener columnas como <code>Nombre del tercero</code> y <code>RIF / C.I</code>. El sistema descartará automáticamente las columnas no requeridas.
                        </div>

                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={handleClose} disabled={state === "importing"}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!file || state === "importing"}
                            >
                                {state === "importing" ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Subiendo archivo...
                                    </>
                                ) : (
                                    "Iniciar Importación"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
