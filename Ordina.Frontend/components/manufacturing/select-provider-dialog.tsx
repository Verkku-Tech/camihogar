"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getProviders, type Provider } from "@/lib/storage"
import { toast } from "sonner"
import type { OrderProduct } from "@/lib/storage"
import { AlertTriangle, Loader2 } from "lucide-react"
import { REPORTE_FABRICACION_LABEL } from "@/lib/manufacturing-labels"

export type ManufacturingProviderDialogMode =
  | "start" // por_fabricar → fabricando (proveedor obligatorio)
  | "queue" // debe_fabricar → por_fabricar (proveedor opcional)
  | "refabrication"

interface SelectProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: OrderProduct | null
  orderId: string
  onConfirm: (providerId: string, providerName: string, notes?: string, refabricationReason?: string) => void
  mode?: ManufacturingProviderDialogMode
  /** Bloquea confirmar/cancelar mientras el padre procesa la acción. */
  isSubmitting?: boolean
  /** @deprecated Usar mode="refabrication" */
  isRefabrication?: boolean
}

export function SelectProviderDialog({
  open,
  onOpenChange,
  product,
  orderId,
  onConfirm,
  mode: modeProp,
  isSubmitting = false,
  isRefabrication = false,
}: SelectProviderDialogProps) {
  const mode: ManufacturingProviderDialogMode =
    modeProp ?? (isRefabrication ? "refabrication" : "start")
  const providerOptional = mode === "queue"
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [refabricationReason, setRefabricationReason] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      const loadProviders = async () => {
        try {
          const allProviders = await getProviders()
          // Filtrar solo proveedores activos de servicios o productos terminados
          const relevant = allProviders.filter(
            p => p.estado === "activo" && 
            (p.tipo === "servicios" || p.tipo === "productos-terminados")
          )
          setProviders(relevant)
        } catch (error) {
          console.error("Error loading providers:", error)
          toast.error("Error al cargar los proveedores")
        }
      }
      loadProviders()
      // Reset
      setSelectedProviderId("")
      setNotes("")
      setRefabricationReason("")
    }
  }, [open])

  const handleConfirm = () => {
    if (isSubmitting) return
    if (!providerOptional && !selectedProviderId) {
      toast.error("Por favor selecciona un proveedor")
      return
    }

    if (mode === "refabrication" && !refabricationReason.trim()) {
      toast.error("Por favor indica la razón de la refabricación")
      return
    }

    let providerId = ""
    let providerName = ""
    if (selectedProviderId) {
      const provider = providers.find((p) => p.id === selectedProviderId)
      if (!provider) {
        toast.error("Proveedor no encontrado")
        return
      }
      providerId = provider.id
      providerName = provider.razonSocial
    }

    onConfirm(
      providerId,
      providerName,
      notes,
      mode === "refabrication" ? refabricationReason.trim() : undefined,
    )
  }

  const dialogTitle =
    mode === "refabrication"
      ? "Reiniciar Fabricación"
      : mode === "queue"
        ? "Enviar a fabricar"
        : "En fabricación"

  const dialogDescription =
    mode === "refabrication"
      ? product
        ? (
            <>
              El producto <strong>{product.name}</strong> será enviado nuevamente a
              fabricación.
            </>
          )
        : (
            <>Los productos seleccionados serán enviados nuevamente a fabricación.</>
          )
      : mode === "queue"
        ? product
          ? (
              <>
                El producto <strong>{product.name}</strong> pasará a{" "}
                {REPORTE_FABRICACION_LABEL} (lote semanal). El proveedor es opcional.
              </>
            )
          : (
              <>
                Los productos seleccionados pasarán a {REPORTE_FABRICACION_LABEL}. El
                proveedor es opcional.
              </>
            )
        : product
          ? (
              <>
                Inicia la fabricación de <strong>{product.name}</strong>. Selecciona el
                proveedor.
              </>
            )
          : (
              <>Selecciona el proveedor para iniciar la fabricación de los productos.</>
            )

  const confirmButtonText =
    mode === "refabrication"
      ? product
        ? "Confirmar Refabricación"
        : "Confirmar Refabricación Masiva"
      : mode === "queue"
        ? product
          ? "Enviar a fabricar"
          : "Enviar a fabricar (masivo)"
        : product
          ? "En fabricación"
          : "En fabricación (masivo)"

  const isConfirmDisabled =
    isLoading ||
    isSubmitting ||
    (mode === "refabrication" && !refabricationReason.trim()) ||
    (!providerOptional && !selectedProviderId)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className={mode === "refabrication" ? "flex items-center gap-2 text-orange-600" : ""}>
            {mode === "refabrication" && <AlertTriangle className="w-5 h-5" />}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">
              Proveedor{providerOptional ? " (opcional)" : " *"}
            </Label>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {providers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay proveedores disponibles
                  </SelectItem>
                ) : (
                  providers
                    .filter((provider) => provider.id && provider.id.trim() !== "")
                    .map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.razonSocial} ({provider.tipo})
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas al proveedor (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales sobre la fabricación..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Campo de razón de refabricación - solo visible cuando isRefabrication es true */}
          {mode === "refabrication" && (
            <div className="space-y-2">
              <Label htmlFor="refabricationReason" className="flex items-center gap-1">
                <span className="text-orange-600">*</span>
                Razón de la refabricación
              </Label>
              <Textarea
                id="refabricationReason"
                placeholder="Ej: Defecto en acabado, cliente rechazó producto, daño en transporte..."
                value={refabricationReason}
                onChange={(e) => setRefabricationReason(e.target.value)}
                rows={3}
                className="border-orange-200 focus:border-orange-400 focus:ring-orange-400"
              />
              <p className="text-xs text-muted-foreground">
                Este campo es obligatorio. Indica por qué el producto debe ser refabricado.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirmDisabled}
            className={mode === "refabrication" ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              confirmButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
