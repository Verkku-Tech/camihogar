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
import { Plus, Search, Edit, Power, PowerOff, Filter } from "lucide-react"
import { getProviders, addProvider, updateProvider, type Provider } from "@/lib/storage"

const tipoOptions = [
  { value: "materia-prima", label: "Materia Prima" },
  { value: "servicios", label: "Servicios" },
  { value: "productos-terminados", label: "Productos Terminados" },
]

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [deactivateProvider, setDeactivateProvider] = useState<Provider | null>(null)
  const [formData, setFormData] = useState({
    razonSocial: "",
    rif: "",
    direccion: "",
    telefono: "",
    email: "",
    contacto: "",
    tipo: "materia-prima" as Provider["tipo"],
  })

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true)
        const loadedProviders = await getProviders()
        setProviders(loadedProviders)
      } catch (error) {
        console.error("Error loading providers:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProviders()
  }, [])

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch =
      provider.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.rif.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.contacto.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTipo = filterTipo === "all" || provider.tipo === filterTipo
    const matchesEstado = filterEstado === "all" || provider.estado === filterEstado

    return matchesSearch && matchesTipo && matchesEstado
  })

  const handleCreateProvider = async () => {
    // Validate RIF is not duplicated
    const rifExists = providers.some((p) => p.rif === formData.rif)
    if (rifExists) {
      alert("El RIF ya existe en el sistema")
      return
    }

    try {
      const newProvider = await addProvider(formData)
      setProviders([...providers, newProvider])
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating provider:", error)
      alert("Error al crear el proveedor")
    }
  }

  const handleEditProvider = async () => {
    if (!selectedProvider) return

    // Validate RIF is not duplicated (excluding current provider)
    const rifExists = providers.some((p) => p.rif === formData.rif && p.id !== selectedProvider.id)
    if (rifExists) {
      alert("El RIF ya existe en el sistema")
      return
    }

    try {
      const updatedProvider = await updateProvider(selectedProvider.id, formData)
      setProviders(providers.map((p) => (p.id === selectedProvider.id ? updatedProvider : p)))
      setIsEditDialogOpen(false)
      setSelectedProvider(null)
      resetForm()
    } catch (error) {
      console.error("Error updating provider:", error)
      alert("Error al actualizar el proveedor")
    }
  }

  const handleToggleStatus = async (provider: Provider) => {
    try {
      const updatedProvider = await updateProvider(provider.id, {
        estado: provider.estado === "activo" ? "inactivo" : "activo",
      })
      setProviders(providers.map((p) => (p.id === provider.id ? updatedProvider : p)))
      setDeactivateProvider(null)
    } catch (error) {
      console.error("Error updating provider status:", error)
      alert("Error al actualizar el estado del proveedor")
    }
  }

  const resetForm = () => {
    setFormData({
      razonSocial: "",
      rif: "",
      direccion: "",
      telefono: "",
      email: "",
      contacto: "",
      tipo: "materia-prima",
    })
  }

  const openEditDialog = (provider: Provider) => {
    setSelectedProvider(provider)
    setFormData({
      razonSocial: provider.razonSocial,
      rif: provider.rif,
      direccion: provider.direccion,
      telefono: provider.telefono,
      email: provider.email,
      contacto: provider.contacto,
      tipo: provider.tipo,
    })
    setIsEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
          <p className="text-muted-foreground">Gestiona los proveedores de tu empresa</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Proveedor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="razonSocial">Razón Social / Nombre *</Label>
                  <Input
                    id="razonSocial"
                    value={formData.razonSocial}
                    onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rif">RIF *</Label>
                  <Input
                    id="rif"
                    value={formData.rif}
                    onChange={(e) => setFormData({ ...formData, rif: e.target.value })}
                    placeholder="J-12345678-9"
                  />
                </div>
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
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="+58 212 555-0123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contacto">Nombre de Contacto</Label>
                  <Input
                    id="contacto"
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="Nombre del contacto principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Proveedor *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: Provider["tipo"]) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateProvider}
                disabled={!formData.razonSocial || !formData.rif}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Crear Proveedor
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
                  placeholder="Buscar por nombre, RIF o contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {tipoOptions.map((option) => (
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

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Proveedores ({filteredProviders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando proveedores...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razón Social</TableHead>
                  <TableHead>RIF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{provider.razonSocial}</div>
                        <div className="text-sm text-muted-foreground">{provider.contacto}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{provider.rif}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoOptions.find((t) => t.value === provider.tipo)?.label}</Badge>
                    </TableCell>
                    <TableCell>{provider.telefono}</TableCell>
                    <TableCell>
                      <Badge
                        variant={provider.estado === "activo" ? "default" : "secondary"}
                        className={provider.estado === "activo" ? "bg-green-100 text-green-800" : ""}
                      >
                        {provider.estado === "activo" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(provider)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateProvider(provider)}
                          className={
                            provider.estado === "activo"
                              ? "text-red-600 hover:text-red-700"
                              : "text-green-600 hover:text-green-700"
                          }
                        >
                          {provider.estado === "activo" ? (
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

                {filteredProviders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron proveedores que coincidan con los filtros aplicados.
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-razonSocial">Razón Social / Nombre *</Label>
                <Input
                  id="edit-razonSocial"
                  value={formData.razonSocial}
                  onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rif">RIF *</Label>
                <Input
                  id="edit-rif"
                  value={formData.rif}
                  onChange={(e) => setFormData({ ...formData, rif: e.target.value })}
                  placeholder="J-12345678-9"
                />
              </div>
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
                <Label htmlFor="edit-telefono">Teléfono</Label>
                <Input
                  id="edit-telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="+58 212 555-0123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Correo Electrónico</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contacto">Nombre de Contacto</Label>
                <Input
                  id="edit-contacto"
                  value={formData.contacto}
                  onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                  placeholder="Nombre del contacto principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tipo">Tipo de Proveedor *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: Provider["tipo"]) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditProvider}
              disabled={!formData.razonSocial || !formData.rif}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateProvider} onOpenChange={() => setDeactivateProvider(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateProvider?.estado === "activo" ? "Desactivar" : "Reactivar"} Proveedor
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateProvider?.estado === "activo"
                ? `¿Estás seguro de que deseas desactivar a "${deactivateProvider?.razonSocial}"? Los proveedores inactivos no estarán disponibles para nuevas compras.`
                : `¿Estás seguro de que deseas reactivar a "${deactivateProvider?.razonSocial}"? El proveedor volverá a estar disponible para nuevas compras.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateProvider && handleToggleStatus(deactivateProvider)}
              className={
                deactivateProvider?.estado === "activo"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {deactivateProvider?.estado === "activo" ? "Desactivar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
