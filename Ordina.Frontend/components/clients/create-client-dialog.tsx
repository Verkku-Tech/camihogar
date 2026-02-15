"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { apiClient, type ClientResponseDto, type CreateClientDto } from "@/lib/api-client"

const tipoClienteOptions = [
  { value: "particular", label: "Particular" },
  { value: "empresa", label: "Empresa" },
]

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated?: (client: ClientResponseDto) => void
}

export function CreateClientDialog({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) {
  const [formData, setFormData] = useState<CreateClientDto>({
    nombreRazonSocial: "",
    apodo: "",
    rutId: "",
    direccion: "",
    telefono: "",
    telefono2: "",
    email: "",
    tipoCliente: "particular",
    estado: "activo",
    tieneNotasDespacho: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateClient = async () => {
    if (!formData.nombreRazonSocial || !formData.rutId) {
      toast.error("Por favor completa los campos obligatorios")
      return
    }

    try {
      setIsSubmitting(true)

      // La verificación de duplicados la hace el backend y la captura el catch
      // pero para UX rápida, podríamos intentar buscar por RUT primero si tuviéramos endpoint específico
      // o confiar en el backend (mejor para consistencia)

      const newClient = await apiClient.createClient(formData)

      toast.success("Cliente creado exitosamente")

      // Resetear formulario
      resetForm()

      // Cerrar diálogo
      onOpenChange(false)

      // Notificar al componente padre
      if (onClientCreated) {
        onClientCreated(newClient)
      }
    } catch (error: any) {
      console.error("Error creating client:", error)
      // Mejorar mensaje de error si es posible
      const message = error.message || "Error desconocido"
      if (message.includes("409") || message.includes("duplicate") || message.includes("exists")) {
        toast.error("El RUT/ID ya existe en el sistema")
      } else {
        toast.error("Error al crear el cliente: " + message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nombreRazonSocial: "",
      apodo: "",
      rutId: "",
      direccion: "",
      telefono: "",
      telefono2: "",
      email: "",
      tipoCliente: "particular",
      estado: "activo",
      tieneNotasDespacho: false
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombreRazonSocial">Nombre o Razón Social *</Label>
            <Input
              id="nombreRazonSocial"
              value={formData.nombreRazonSocial}
              onChange={(e) => setFormData({ ...formData, nombreRazonSocial: e.target.value })}
              placeholder="Nombre completo o razón social de la empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apodo">Apodo (Código RRSS)</Label>
            <Input
              id="apodo"
              value={formData.apodo || ""}
              onChange={(e) => setFormData({ ...formData, apodo: e.target.value })}
              placeholder="Código identificador para herramientas de RRSS (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rutId">RUT o Número de Identificación *</Label>
            <Input
              id="rutId"
              value={formData.rutId}
              onChange={(e) => setFormData({ ...formData, rutId: e.target.value })}
              placeholder="V-12345678 / J-12345678-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Textarea
              id="direccion"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              placeholder="Dirección completa"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono de Contacto</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="+58 412 555-0123"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono2">Teléfono de Contacto 2 (opcional)</Label>
              <Input
                id="telefono2"
                value={formData.telefono2 || ""}
                onChange={(e) => setFormData({ ...formData, telefono2: e.target.value })}
                placeholder="+58 424 555-0123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoCliente">Tipo de Cliente *</Label>
            <Select
              value={formData.tipoCliente}
              onValueChange={(value) => setFormData({ ...formData, tipoCliente: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipoClienteOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateClient}
            disabled={!formData.nombreRazonSocial || !formData.rutId || isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? "Creando..." : "Crear Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

