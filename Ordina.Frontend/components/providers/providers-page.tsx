"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { Plus, Search, Edit, Power, PowerOff, Filter, Cloud, CloudOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { 
  getProviders, 
  addProvider, 
  updateProvider, 
  deleteProvider,
  syncProvidersFromBackend,
  providerFromBackendDto,
  providerToCreateDto,
  providerToUpdateDto,
  type Provider 
} from "@/lib/storage"
import { apiClient } from "@/lib/api-client"
import { syncManager } from "@/lib/sync-manager"
import * as db from "@/lib/indexeddb"

const tipoOptions = [
  { value: "materia-prima", label: "Materia Prima" },
  { value: "servicios", label: "Servicios" },
  { value: "productos-terminados", label: "Productos Terminados" },
]

export type ProvidersDataSource = "backend" | "indexeddb" | "syncing"

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dataSource, setDataSource] = useState<ProvidersDataSource>("syncing")
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const hadBeenOffline = useRef(false)
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

  // Escuchar conexión y marcar cuando hemos estado offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }
    const handleOffline = () => {
      setIsOnline(false)
      hadBeenOffline.current = true
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const refreshPendingCount = async () => {
    const pending = await syncManager.getPendingOperations()
    const providerPending = pending.filter((op) => op.entity === "provider")
    setPendingSyncCount(providerPending.length)
  }

  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 5000)
    return () => clearInterval(interval)
  }, [providers])

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true)
        setDataSource("syncing")
        // Intentar sincronizar desde el backend primero
        if (navigator.onLine) {
          try {
            const syncedProviders = await syncProvidersFromBackend()
            setProviders(syncedProviders)
            setDataSource("backend")
            return
          } catch (error) {
            console.warn("Error syncing from backend, using local storage:", error)
          }
        }
        // Si falla o está offline, usar IndexedDB
        const loadedProviders = await getProviders()
        setProviders(loadedProviders)
        setDataSource("indexeddb")
      } catch (error) {
        console.error("Error loading providers:", error)
        toast.error("Error al cargar proveedores")
        setDataSource("indexeddb")
      } finally {
        setIsLoading(false)
      }
    }
    loadProviders()
  }, [])

  // Al recuperar conexión (solo cuando pasamos de offline a online): sincronizar cola y refrescar desde backend
  useEffect(() => {
    if (!isOnline || !hadBeenOffline.current) return
    hadBeenOffline.current = false
    let cancelled = false
    const run = async () => {
      setDataSource("syncing")
      try {
        await syncManager.syncPendingOperations()
        if (cancelled) return
        const synced = await syncProvidersFromBackend()
        if (cancelled) return
        setProviders(synced)
        setDataSource("backend")
        await refreshPendingCount()
        toast.success("Proveedores sincronizados con el servidor")
      } catch (error) {
        if (!cancelled) {
          setDataSource("indexeddb")
          const loaded = await getProviders()
          setProviders(loaded)
          toast.error("No se pudo sincronizar. Se muestran datos locales.")
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [isOnline])

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
    if (formData.rif.trim() !== "") {
      const rifExists = providers.some((p) => p.rif === formData.rif)
      if (rifExists) {
        toast.error("El RIF ya existe en el sistema")
        return
      }
    }

    try {
      const providerData = {
        ...formData,
        estado: "activo" as const,
      }

      // Intentar crear en el backend primero
      if (navigator.onLine) {
        try {
          const createDto = providerToCreateDto(providerData)
          const backendProvider = await apiClient.createProvider(createDto)
          const newProvider = providerFromBackendDto(backendProvider)
          
          // Guardar en IndexedDB
          await db.add("providers", newProvider)
          
          setProviders([...providers, newProvider])
          setIsCreateDialogOpen(false)
          resetForm()
          toast.success("Proveedor creado exitosamente")
          return
        } catch (error: any) {
          const errorMessage = error?.message || "Error al crear el proveedor"
          if (errorMessage.includes("RIF") || errorMessage.includes("email")) {
            toast.error(errorMessage)
            return
          }
          console.warn("Error creating provider in backend, saving locally:", error)
        }
      }

      // Si falla o está offline, guardar en IndexedDB y encolar para sincronizar
      const newProvider = await addProvider(providerData)
      setProviders([...providers, newProvider])
      await syncManager.addToQueue({
        type: "create",
        entity: "provider",
        entityId: newProvider.id,
        data: newProvider,
      })
      setDataSource("indexeddb")
      refreshPendingCount()
      setIsCreateDialogOpen(false)
      resetForm()
      toast.success("Proveedor creado (modo offline). Se sincronizará al recuperar conexión.")
    } catch (error) {
      console.error("Error creating provider:", error)
      toast.error("Error al crear el proveedor")
    }
  }

  const handleEditProvider = async () => {
    if (!selectedProvider) return

    // Validate RIF is not duplicated (excluding current provider)
    if (formData.rif.trim() !== "") {
      const rifExists = providers.some((p) => p.rif === formData.rif && p.id !== selectedProvider.id)
      if (rifExists) {
        toast.error("El RIF ya existe en el sistema")
        return
      }
    }

    try {
      // Intentar actualizar en el backend primero
      if (navigator.onLine) {
        try {
          const updateDto = providerToUpdateDto(formData)
          const backendProvider = await apiClient.updateProvider(selectedProvider.id, updateDto)
          const updatedProvider = providerFromBackendDto(backendProvider)
          
          // Actualizar en IndexedDB
          await db.update("providers", updatedProvider)
          
          setProviders(providers.map((p) => (p.id === selectedProvider.id ? updatedProvider : p)))
          setIsEditDialogOpen(false)
          setSelectedProvider(null)
          resetForm()
          toast.success("Proveedor actualizado exitosamente")
          return
        } catch (error: any) {
          const errorMessage = error?.message || "Error al actualizar el proveedor"
          if (errorMessage.includes("RIF") || errorMessage.includes("email")) {
            toast.error(errorMessage)
            return
          }
          console.warn("Error updating provider in backend, updating locally:", error)
        }
      }

      // Si falla o está offline, actualizar en IndexedDB y encolar
      const updatedProvider = await updateProvider(selectedProvider.id, formData)
      setProviders(providers.map((p) => (p.id === selectedProvider.id ? updatedProvider : p)))
      await syncManager.addToQueue({
        type: "update",
        entity: "provider",
        entityId: selectedProvider.id,
        data: updatedProvider,
      })
      setDataSource("indexeddb")
      refreshPendingCount()
      setIsEditDialogOpen(false)
      setSelectedProvider(null)
      resetForm()
      toast.success("Proveedor actualizado (modo offline). Se sincronizará al recuperar conexión.")
    } catch (error) {
      console.error("Error updating provider:", error)
      toast.error("Error al actualizar el proveedor")
    }
  }

  const handleToggleStatus = async (provider: Provider) => {
    try {
      const newEstado = provider.estado === "activo" ? "inactivo" : "activo"
      
      // Intentar actualizar en el backend primero
      if (navigator.onLine) {
        try {
          const updateDto = providerToUpdateDto({ estado: newEstado })
          const backendProvider = await apiClient.updateProvider(provider.id, updateDto)
          const updatedProvider = providerFromBackendDto(backendProvider)
          
          // Actualizar en IndexedDB
          await db.update("providers", updatedProvider)
          
          setProviders(providers.map((p) => (p.id === provider.id ? updatedProvider : p)))
          setDeactivateProvider(null)
          toast.success(
            `Proveedor ${provider.estado === "activo" ? "desactivado" : "activado"} exitosamente`
          )
          return
        } catch (error) {
          console.warn("Error updating provider status in backend, updating locally:", error)
        }
      }

      // Si falla o está offline, actualizar en IndexedDB y encolar
      const updatedProvider = await updateProvider(provider.id, {
        estado: newEstado,
      })
      setProviders(providers.map((p) => (p.id === provider.id ? updatedProvider : p)))
      await syncManager.addToQueue({
        type: "update",
        entity: "provider",
        entityId: provider.id,
        data: updatedProvider,
      })
      setDataSource("indexeddb")
      refreshPendingCount()
      setDeactivateProvider(null)
      toast.success(
        `Proveedor ${provider.estado === "activo" ? "desactivado" : "activado"} (modo offline). Se sincronizará al recuperar conexión.`
      )
    } catch (error) {
      console.error("Error updating provider status:", error)
      toast.error("Error al actualizar el estado del proveedor")
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
            {/* Indicador de origen de datos */}
            {dataSource === "syncing" && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Sincronizando…
              </Badge>
            )}
            {dataSource === "backend" && (
              <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                <Cloud className="w-3 h-3" />
                Servidor
              </Badge>
            )}
            {dataSource === "indexeddb" && (
              <Badge variant="secondary" className="gap-1">
                <CloudOff className="w-3 h-3" />
                Sin conexión (datos locales)
              </Badge>
            )}
            {pendingSyncCount > 0 && (
              <Badge variant="outline" className="gap-1">
                {pendingSyncCount} pendiente{pendingSyncCount !== 1 ? "s" : ""} de sincronizar
              </Badge>
            )}
          </div>
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
              <DialogDescription>
                Completa los datos para registrar un nuevo proveedor. Los campos marcados con * son obligatorios.
              </DialogDescription>
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
                  <Label htmlFor="rif">RIF </Label>
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
                  <Label htmlFor="telefono">Teléfono *</Label>
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
                disabled={!formData.razonSocial.trim() || !formData.telefono.trim()}
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
          ) : filteredProviders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron proveedores que coincidan con los filtros aplicados.
            </div>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription>
              Modifica los datos del proveedor. Los campos marcados con * son obligatorios.
            </DialogDescription>
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
                <Label htmlFor="edit-rif">RIF </Label>
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
                <Label htmlFor="edit-telefono">Teléfono *</Label>
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
              disabled={!formData.razonSocial.trim() || !formData.telefono.trim()}
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
