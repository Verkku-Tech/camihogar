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

interface SelectProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: OrderProduct | null
  orderId: string
  onConfirm: (providerId: string, providerName: string, notes?: string) => void
}

export function SelectProviderDialog({
  open,
  onOpenChange,
  product,
  orderId,
  onConfirm,
}: SelectProviderDialogProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
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
    }
  }, [open])

  const handleConfirm = () => {
    if (!selectedProviderId) {
      toast.error("Por favor selecciona un proveedor")
      return
    }

    const provider = providers.find(p => p.id === selectedProviderId)
    if (!provider) {
      toast.error("Proveedor no encontrado")
      return
    }

    onConfirm(provider.id, provider.razonSocial, notes)
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Proveedor para Fabricación</DialogTitle>
          <DialogDescription>
            Selecciona el proveedor que fabricará: <strong>{product.name}</strong>
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
                  providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.razonSocial} ({provider.tipo})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales sobre la fabricación..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedProviderId || isLoading}>
            Confirmar Fabricación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

