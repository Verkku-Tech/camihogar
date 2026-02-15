"use client"

import { useState, useEffect } from "react"
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
import { Plus, Search, Edit, Power, PowerOff, Filter, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { apiClient, type ClientResponseDto, type CreateClientDto } from "@/lib/api-client"

const tipoClienteOptions = [
  { value: "particular", label: "Particular" },
  { value: "empresa", label: "Empresa" },
]

export function ClientsPage() {
  const [clients, setClients] = useState<ClientResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [filterTipoCliente, setFilterTipoCliente] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientResponseDto | null>(null)
  const [deactivateClient, setDeactivateClient] = useState<ClientResponseDto | null>(null)

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

  // Load clients when page or search changes
  useEffect(() => {
    loadClients()
  }, [page, pageSize])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        loadClients()
      } else {
        setPage(1) // This will trigger loadClients via the page effect
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadClients = async () => {
    try {
      setIsLoading(true)
      // Pass search term only if it's not empty
      const search = searchTerm.trim() !== "" ? searchTerm : undefined
      const result = await apiClient.getClientsPaged(page, pageSize, search)

      setClients(result.items)
      setTotalPages(result.totalPages)
      setTotalCount(result.totalCount)
    } catch (error) {
      console.error("Error loading clients:", error)
      toast.error("Error al cargar clientes. Verifique su conexión.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateClient = async () => {
    if (!formData.nombreRazonSocial || !formData.rutId) {
      toast.error("Nombre y RUT son obligatorios")
      return
    }

    try {
      await apiClient.createClient(formData)
      toast.success("Cliente creado exitosamente (sincronizando...)")
      setIsCreateDialogOpen(false)
      resetForm()
      loadClients() // Refresh list
    } catch (error: any) {
      console.error("Error creating client:", error)
      toast.error("Error al crear el cliente: " + (error.message || "Error desconocido"))
    }
  }

  const handleEditClient = async () => {
    if (!selectedClient) return

    try {
      await apiClient.updateClient(selectedClient.id, formData)
      toast.success("Cliente actualizado exitosamente")
      setIsEditDialogOpen(false)
      setSelectedClient(null)
      resetForm()
      loadClients() // Refresh list
    } catch (error) {
      console.error("Error updating client:", error)
      toast.error("Error al actualizar el cliente")
    }
  }

  const handleToggleStatus = async (client: ClientResponseDto) => {
    if (client.estado === "activo" && client.tieneNotasDespacho) {
      toast.error("No se puede desactivar este cliente porque tiene Notas de Despacho asociadas")
      setDeactivateClient(null)
      return
    }

    try {
      const newState = client.estado === "activo" ? "inactivo" : "activo"
      await apiClient.updateClient(client.id, {
        ...client,
        estado: newState
      })

      toast.success(
        `Cliente ${newState === "inactivo" ? "desactivado" : "activado"} exitosamente`
      )
      setDeactivateClient(null)
      loadClients() // Refresh list
    } catch (error) {
      console.error("Error updating client status:", error)
      toast.error("Error al actualizar el estado del cliente")
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

  const openEditDialog = (client: ClientResponseDto) => {
    setSelectedClient(client)
    setFormData({
      nombreRazonSocial: client.nombreRazonSocial,
      apodo: client.apodo || "",
      rutId: client.rutId,
      direccion: client.direccion,
      telefono: client.telefono,
      telefono2: client.telefono2 || "",
      email: client.email || "",
      tipoCliente: client.tipoCliente,
      estado: client.estado,
      tieneNotasDespacho: client.tieneNotasDespacho
    })
    setIsEditDialogOpen(true)
  }

  // Frontend filtering for visual indicators only (real filtering happens at API/DB level now)
  // We keep this just in case we want to filter the VIEWED page locally, but usually with server-side pagination
  // we filter at the source.
  // However, for "Tipo" and "Estado" filters, we might want to send them to the API too if the API supported them.
  // Since our API currently only supports generic "search text", we rely on that or we should implement specific filters in the backend.
  // For now, let's assume the "Search" covers everything or we might need to add specific filters to the API later.
  // BUT: The current API implementation only filters by text regex on multiple fields.
  // Let's filter the CURRENT PAGE results for now if the user uses the dropdowns, 
  // OR better: treating them as part of the search term implies a backend change.
  // Strategy: For this iteration, basic search is server-side. Dropdown filters will filter CLIENT-SIDE on the current page
  // (which is suboptimal but safe) OR we assume the user searches for "Empresa" text for type.

  // Let's modify filter behavior: if we filter client-side on a paginated result, it's confusing.
  // Correct approach: Send these as params to backend.
  // BUT backend update was: search regex on multiple fields.
  // Let's implement client-side filtering on the fetched page for now to keep UI consistent, 
  // but acknowledging it only filters the current page.

  const filteredClients = clients.filter((client) => {
    const matchesTipoCliente = filterTipoCliente === "all" || client.tipoCliente === filterTipoCliente
    const matchesEstado = filterEstado === "all" || client.estado === filterEstado
    return matchesTipoCliente && matchesEstado
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gestiona los clientes de tu empresa (Total: {totalCount})</p>
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
                  placeholder="Buscar por nombre, apodo, RUT... (Enter para buscar)"
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

              <Button variant="outline" size="icon" onClick={() => loadClients()} title="Recargar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron clientes con esa búsqueda." : "No hay clientes registrados."}
            </div>
          ) : (
            <div className="space-y-4">
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
                            {client.apodo && <div className="text-xs text-muted-foreground">Apodo: {client.apodo}</div>}
                            {client.email && <div className="text-sm text-muted-foreground">{client.email}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{client.rutId}</TableCell>
                        <TableCell>
                          <div>
                            <div>{client.telefono}</div>
                            {client.telefono2 && <div className="text-sm text-muted-foreground">{client.telefono2}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tipoClienteOptions.find((t) => t.value === client.tipoCliente)?.label || client.tipoCliente}
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
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  Página {page} de {totalPages || 1}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0 || isLoading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
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
              <Label htmlFor="edit-apodo">Apodo (Código RRSS)</Label>
              <Input
                id="edit-apodo"
                value={formData.apodo || ""}
                onChange={(e) => setFormData({ ...formData, apodo: e.target.value })}
                placeholder="Código identificador para herramientas de RRSS (opcional)"
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
                <Label htmlFor="edit-telefono2">Teléfono de Contacto 2 (opcional)</Label>
                <Input
                  id="edit-telefono2"
                  value={formData.telefono2 || ""}
                  onChange={(e) => setFormData({ ...formData, telefono2: e.target.value })}
                  placeholder="+58 424 555-0123"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Correo Electrónico (opcional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tipoCliente">Tipo de Cliente *</Label>
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
