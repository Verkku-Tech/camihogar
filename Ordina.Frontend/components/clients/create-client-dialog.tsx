"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { addClient, getClients, type Client } from "@/lib/storage"

const tipoClienteOptions = [
  { value: "particular", label: "Particular" },
  { value: "empresa", label: "Empresa" },
]

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated?: (client: Client) => void
}

export function CreateClientDialog({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) {
  const [formData, setFormData] = useState({
    nombreRazonSocial: "",
    rutId: "",
    direccion: "",
    telefono: "",
    email: "",
    tipoCliente: "particular" as Client["tipoCliente"],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateClient = async () => {
    if (!formData.nombreRazonSocial || !formData.rutId) {
      toast.error("Por favor completa los campos obligatorios")
      return
    }

    try {
      setIsSubmitting(true)
      
      // Verificar si el RUT/ID ya existe
      const existingClients = await getClients()
      const documentExists = existingClients.some((c) => c.rutId === formData.rutId)
      
      if (documentExists) {
        toast.error("El RUT/ID ya existe en el sistema")
        setIsSubmitting(false)
        return
      }

      const newClient = await addClient({
        ...formData,
        estado: "activo" as const,
      })

      toast.success("Cliente creado exitosamente")
      
      // Resetear formulario
      resetForm()
      
      // Cerrar diálogo
      onOpenChange(false)
      
      // Notificar al componente padre
      if (onClientCreated) {
        onClientCreated(newClient)
      }
    } catch (error) {
      console.error("Error creating client:", error)
      toast.error("Error al crear el cliente")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      nombreRazonSocial: "",
      rutId: "",
      direccion: "",
      telefono: "",
      email: "",
      tipoCliente: "particular",
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoCliente">Tipo de Cliente *</Label>
            <Select
              value={formData.tipoCliente}
              onValueChange={(value: Client["tipoCliente"]) => setFormData({ ...formData, tipoCliente: value })}
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

