"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Edit, Power, PowerOff, Filter } from "lucide-react"

interface Client {
  id: string
  nombreRazonSocial: string
  rutId: string
  direccion: string
  telefono: string
  email?: string
  tipoCliente: "empresa" | "particular"
  estado: "activo" | "inactivo"
  fechaCreacion: string
  tieneNotasDespacho: boolean
}

const mockClients: Client[] = [
  {
    id: "1",
    nombreRazonSocial: "María González",
    rutId: "V-12345678",
    direccion: "Av. Libertador, Caracas",
    telefono: "+58 412 555-0123",
    email: "maria.gonzalez@email.com",
    tipoCliente: "particular",
    estado: "activo",
    fechaCreacion: "2024-01-15",
    tieneNotasDespacho: true,
  },
  {
    id: "2",
    nombreRazonSocial: "Constructora Los Andes C.A.",
    rutId: "J-98765432-1",
    direccion: "Zona Industrial, Valencia",
    telefono: "+58 241 555-0456",
    email: "ventas@constructoraandes.com",
    tipoCliente: "empresa",
    estado: "activo",
    fechaCreacion: "2024-02-20",
    tieneNotasDespacho: false,
  },
  {
    id: "3",
    nombreRazonSocial: "Carlos Rodríguez",
    rutId: "V-87654321",
    direccion: "Centro, Maracay",
    telefono: "+58 243 555-0789",
    email: "carlos.rodriguez@email.com",
    tipoCliente: "particular",
    estado: "inactivo",
    fechaCreacion: "2023-12-10",
    tieneNotasDespacho: false,
  },
]

const tipoClienteOptions = [
  { value: "particular", label: "Particular" },
  { value: "empresa", label: "Empresa" },
]

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(mockClients)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipoCliente, setFilterTipoCliente] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deactivateClient, setDeactivateClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    nombreRazonSocial: "",
    rutId: "",
    direccion: "",
    telefono: "",
    email: "",
    tipoCliente: "particular" as Client["tipoCliente"],
  })

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.nombreRazonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.rutId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesTipoCliente = filterTipoCliente === "all" || client.tipoCliente === filterTipoCliente
    const matchesEstado = filterEstado === "all" || client.estado === filterEstado

    return matchesSearch && matchesTipoCliente && matchesEstado
  })

  const handleCreateClient = () => {
    const documentExists = clients.some((c) => c.rutId === formData.rutId)
    if (documentExists) {
      alert("El RUT/ID ya existe en el sistema")
      return
    }

    const newClient: Client = {
      id: Date.now().toString(),
      ...formData,
      estado: "activo",
      fechaCreacion: new Date().toISOString().split("T")[0],
      tieneNotasDespacho: false,
    }

    setClients([...clients, newClient])
    setIsCreateDialogOpen(false)
    resetForm()
    alert("Cliente creado exitosamente")
  }

  const handleEditClient = () => {
    if (!selectedClient) return

    const documentExists = clients.some((c) => c.rutId === formData.rutId && c.id !== selectedClient.id)
    if (documentExists) {
      alert("El RUT/ID ya existe en el sistema")
      return
    }

    console.log(
      `[AUDIT LOG] Cliente ${selectedClient.nombreRazonSocial} modificado por usuario en ${new Date().toISOString()}`,
    )

    setClients(clients.map((c) => (c.id === selectedClient.id ? { ...c, ...formData } : c)))
    setIsEditDialogOpen(false)
    setSelectedClient(null)
    resetForm()
    alert("Cliente actualizado exitosamente")
  }

  const handleToggleStatus = (client: Client) => {
    if (client.estado === "activo" && client.tieneNotasDespacho) {
      alert("No se puede desactivar este cliente porque tiene Notas de Despacho asociadas")
      setDeactivateClient(null)
      return
    }

    setClients(
      clients.map((c) => (c.id === client.id ? { ...c, estado: c.estado === "activo" ? "inactivo" : "activo" } : c)),
    )
    setDeactivateClient(null)
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

  const openEditDialog = (client: Client) => {
    setSelectedClient(client)
    setFormData({
      nombreRazonSocial: client.nombreRazonSocial,
      rutId: client.rutId,
      direccion: client.direccion,
      telefono: client.telefono,
      email: client.email || "",
      tipoCliente: client.tipoCliente,
    })
    setIsEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gestiona los clientes de tu empresa</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cliente
            </Button>
          </DialogTrigger>
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
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={!formData.nombreRazonSocial || !formData.rutId}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Crear Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre, RUT o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={filterTipoCliente} onValueChange={setFilterTipoCliente}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {tipoClienteOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes ({filteredClients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RUT/ID</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Tipo de Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{client.nombreRazonSocial}</div>
                        {client.email && <div className="text-sm text-muted-foreground">{client.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{client.rutId}</TableCell>
                    <TableCell>{client.telefono}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tipoClienteOptions.find((t) => t.value === client.tipoCliente)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={client.estado === "activo" ? "default" : "secondary"}
                        className={client.estado === "activo" ? "bg-green-100 text-green-800" : ""}
                      >
                        {client.estado === "activo" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(client)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateClient(client)}
                          className={
                            client.estado === "activo"
                              ? "text-red-600 hover:text-red-700"
                              : "text-green-600 hover:text-green-700"
                          }
                          title={
                            client.tieneNotasDespacho && client.estado === "activo"
                              ? "Cliente con Notas de Despacho asociadas"
                              : ""
                          }
                        >
                          {client.estado === "activo" ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredClients.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron clientes que coincidan con los filtros aplicados.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nombreRazonSocial">Nombre o Razón Social *</Label>
              <Input
                id="edit-nombreRazonSocial"
                value={formData.nombreRazonSocial}
                onChange={(e) => setFormData({ ...formData, nombreRazonSocial: e.target.value })}
                placeholder="Nombre completo o razón social de la empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rutId">RUT o Número de Identificación *</Label>
              <Input
                id="edit-rutId"
                value={formData.rutId}
                onChange={(e) => setFormData({ ...formData, rutId: e.target.value })}
                placeholder="V-12345678 / J-12345678-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-direccion">Dirección</Label>
              <Textarea
                id="edit-direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Dirección completa"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">Teléfono de Contacto</Label>
                <Input
                  id="edit-telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+58 412 555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Correo Electrónico (opcional)</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tipoCliente">Tipo de Cliente *</Label>
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditClient}
              disabled={!formData.nombreRazonSocial || !formData.rutId}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateClient} onOpenChange={() => setDeactivateClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateClient?.estado === "activo" ? "Desactivar" : "Reactivar"} Cliente
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateClient?.estado === "activo"
                ? `¿Estás seguro de que deseas desactivar a "${deactivateClient?.nombreRazonSocial}"? Los clientes inactivos no aparecerán como opción en nuevas Notas de Despacho.`
                : `¿Estás seguro de que deseas reactivar a "${deactivateClient?.nombreRazonSocial}"? El cliente volverá a aparecer como opción en las Notas de Despacho.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateClient && handleToggleStatus(deactivateClient)}
              className={
                deactivateClient?.estado === "activo"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {deactivateClient?.estado === "activo" ? "Desactivar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
