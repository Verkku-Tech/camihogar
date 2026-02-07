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
import { AlertTriangle } from "lucide-react"

interface SelectProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: OrderProduct | null
  orderId: string
  onConfirm: (providerId: string, providerName: string, notes?: string, refabricationReason?: string) => void
  isRefabrication?: boolean // Indica si es una refabricación desde almacén
}

export function SelectProviderDialog({
  open,
  onOpenChange,
  product,
  orderId,
  onConfirm,
  isRefabrication = false,
}: SelectProviderDialogProps) {
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
    if (!selectedProviderId) {
      toast.error("Por favor selecciona un proveedor")
      return
    }

    // Validar razón de refabricación si es refabricación
    if (isRefabrication && !refabricationReason.trim()) {
      toast.error("Por favor indica la razón de la refabricación")
      return
    }

    const provider = providers.find(p => p.id === selectedProviderId)
    if (!provider) {
      toast.error("Proveedor no encontrado")
      return
    }

    onConfirm(
      provider.id, 
      provider.razonSocial, 
      notes, 
      isRefabrication ? refabricationReason.trim() : undefined
    )
  }

  // Textos dinámicos según el modo
  const dialogTitle = isRefabrication 
    ? "Reiniciar Fabricación" 
    : "Seleccionar Proveedor para Fabricación"
  
  const dialogDescription = isRefabrication
    ? product 
      ? <>El producto <strong>{product.name}</strong> será enviado nuevamente a fabricación.</>
      : <>Los productos seleccionados serán enviados nuevamente a fabricación.</>
    : product 
      ? <>Selecciona el proveedor que fabricará: <strong>{product.name}</strong></>
      : <>Selecciona el proveedor para los productos seleccionados</>

  const confirmButtonText = isRefabrication
    ? product ? "Confirmar Refabricación" : "Confirmar Refabricación Masiva"
    : product ? "Confirmar Fabricación" : "Confirmar Fabricación Masiva"

  // Deshabilitar botón si falta proveedor o (si es refabricación) falta razón
  const isConfirmDisabled = !selectedProviderId || isLoading || (isRefabrication && !refabricationReason.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className={isRefabrication ? "flex items-center gap-2 text-orange-600" : ""}>
            {isRefabrication && <AlertTriangle className="w-5 h-5" />}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Proveedor *</Label>
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
          {isRefabrication && (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirmDisabled}
            className={isRefabrication ? "bg-orange-600 hover:bg-orange-700" : ""}
          >
            {confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
