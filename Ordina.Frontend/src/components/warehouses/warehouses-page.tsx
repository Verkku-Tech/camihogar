"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Warehouse as WarehouseIcon, Plus, Search, Edit, Power, PowerOff, Building2, Package, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type Warehouse
} from "@/lib/storage"

export function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "central" | "satellite">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  // Modal states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Status toggle confirmation
  const [deactivatingWarehouse, setDeactivatingWarehouse] = useState<Warehouse | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    maxCapacity: 100,
    isCentral: false,
    status: "active" as "active" | "inactive"
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadWarehouses = async () => {
    try {
      setIsLoading(true)
      const data = await getWarehouses()
      setWarehouses(data)
    } catch (err) {
      console.error("Error loading warehouses:", err)
      toast.error("Error al cargar almacenes")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWarehouses()
  }, [])

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      phone: "",
      maxCapacity: 100,
      isCentral: false,
      status: "active"
    })
    setIsEditing(false)
    setEditingId(null)
    setErrors({})
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (w: Warehouse) => {
    setEditingId(w.id)
    setIsEditing(true)
    setFormData({
      name: w.name,
      code: w.code,
      address: w.address,
      phone: w.phone,
      maxCapacity: w.maxCapacity,
      isCentral: w.isCentral,
      status: w.status
    })
    setErrors({})
    setIsDialogOpen(true)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = "El nombre del almacén es obligatorio"
    if (!formData.code.trim()) newErrors.code = "El código es obligatorio"
    if (formData.maxCapacity <= 0) newErrors.maxCapacity = "La capacidad debe ser mayor a 0"

    // Check duplicate code
    const isDuplicate = warehouses.some(
      w => w.code.toUpperCase() === formData.code.trim().toUpperCase() && w.id !== editingId
    )
    if (isDuplicate) newErrors.code = "Ya existe un almacén con este código"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      if (isEditing && editingId) {
        const updated = await updateWarehouse(editingId, {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          maxCapacity: Number(formData.maxCapacity) || 100,
          isCentral: formData.isCentral,
          status: formData.status
        })
        setWarehouses(prev => prev.map(w => w.id === editingId ? updated : w))
        toast.success("Almacén actualizado correctamente")
      } else {
        const created = await createWarehouse({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          maxCapacity: Number(formData.maxCapacity) || 100,
          isCentral: formData.isCentral
        })
        setWarehouses(prev => [...prev, created])
        toast.success("Almacén creado correctamente")
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      console.error("Error saving warehouse:", err)
      toast.error("Error al guardar el almacén")
    }
  }

  const handleToggleStatus = async (warehouse: Warehouse) => {
    const newStatus = warehouse.status === "active" ? "inactive" : "active"
    try {
      if (newStatus === "inactive") {
        await deleteWarehouse(warehouse.id)
      } else {
        await updateWarehouse(warehouse.id, { status: "active" })
      }
      setWarehouses(prev =>
        prev.map(w => (w.id === warehouse.id ? { ...w, status: newStatus } : w))
      )
      toast.success(
        newStatus === "active"
          ? `Almacén "${warehouse.name}" activado`
          : `Almacén "${warehouse.name}" desactivado`
      )
    } catch (err) {
      console.error("Error updating warehouse status:", err)
      toast.error("Error al cambiar el estado del almacén")
    } finally {
      setDeactivatingWarehouse(null)
    }
  }

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      const matchSearch =
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.address && w.address.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchType =
        typeFilter === "all" ||
        (typeFilter === "central" && w.isCentral) ||
        (typeFilter === "satellite" && !w.isCentral)

      const matchStatus =
        statusFilter === "all" || w.status === statusFilter

      return matchSearch && matchType && matchStatus
    })
  }, [warehouses, searchTerm, typeFilter, statusFilter])

  // KPIs
  const activeCount = warehouses.filter(w => w.status === "active").length
  const centralWarehouse = warehouses.find(w => w.isCentral && w.status === "active")
  const totalCapacity = warehouses
    .filter(w => w.status === "active")
    .reduce((sum, w) => sum + (w.maxCapacity || 0), 0)
  const satellitesCount = warehouses.filter(w => !w.isCentral && w.status === "active").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <WarehouseIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestión de Almacenes</h1>
            <p className="text-sm text-muted-foreground">
              Configuración y control de depósitos centrales y centros de distribución propios
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Almacén
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <WarehouseIcon className="w-5 h-5 text-indigo-600" />
                {isEditing ? "Editar Almacén" : "Crear Nuevo Almacén"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="w-name">Nombre del Almacén *</Label>
                  <Input
                    id="w-name"
                    placeholder="Ej: Depósito Central Terrinca"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="w-code">Código Identificador *</Label>
                  <Input
                    id="w-code"
                    placeholder="Ej: TERR-01"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className={errors.code ? "border-red-500 font-mono" : "font-mono"}
                  />
                  {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="w-address">Dirección / Ubicación Física</Label>
                <Input
                  id="w-address"
                  placeholder="Ej: Zona Industrial Terrinca, Guatire, Galpón 4"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="w-phone">Teléfono de Contacto</Label>
                  <Input
                    id="w-phone"
                    placeholder="Ej: 0414-1234567"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="w-capacity">Capacidad Máxima (Muebles / Sets) *</Label>
                  <Input
                    id="w-capacity"
                    type="number"
                    min="1"
                    value={formData.maxCapacity}
                    onChange={e => setFormData({ ...formData, maxCapacity: Number(e.target.value) || 1 })}
                    className={errors.maxCapacity ? "border-red-500" : ""}
                  />
                  {errors.maxCapacity && <p className="text-xs text-red-500">{errors.maxCapacity}</p>}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3.5 space-y-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="w-central"
                    checked={formData.isCentral}
                    onChange={e => setFormData({ ...formData, isCentral: e.target.checked })}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="w-central" className="text-sm font-medium cursor-pointer">
                      ¿Es el Almacén Central Principal (Terrinca)?
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      El almacén central actúa como nodo de reposición principal y depósito base para todas las tiendas.
                    </p>
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-2 border-t flex items-center justify-between">
                    <Label htmlFor="w-status" className="text-xs">Estado operativo:</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: "active" | "inactive") => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isEditing ? "Guardar Cambios" : "Crear Almacén"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Total Almacenes Activos</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              <span>{activeCount}</span>
              <WarehouseIcon className="w-5 h-5 text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {satellitesCount} satélites registrados
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Almacén Central Principal</CardDescription>
            <CardTitle className="text-base font-semibold truncate text-indigo-600 dark:text-indigo-400">
              {centralWarehouse ? centralWarehouse.name : "No asignado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {centralWarehouse ? `Código: ${centralWarehouse.code}` : "Configure el depósito principal"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Capacidad Total Instalada</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              <span>{totalCapacity}</span>
              <Package className="w-5 h-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Muebles / Sets simultáneos
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Cobertura Multisede</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              <span>100%</span>
              <Building2 className="w-5 h-5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Integrado con tiendas y BI
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, código o dirección..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(val: "all" | "central" | "satellite") => setTypeFilter(val)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipo de almacén" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="central">Almacén Central</SelectItem>
                <SelectItem value="satellite">Satélites</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val: "all" | "active" | "inactive") => setStatusFilter(val)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Almacenes Registrados ({filteredWarehouses.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Cargando almacenes...</div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <WarehouseIcon className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <div className="text-sm font-medium">No se encontraron almacenes</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No hay almacenes que coincidan con los filtros aplicados. Agregue uno nuevo para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Almacén / Depósito</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Capacidad Máxima</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarehouses.map(w => (
                    <TableRow key={w.id} className={w.status === "inactive" ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          <WarehouseIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>{w.name}</span>
                        </div>
                        {w.address && (
                          <p className="text-xs text-muted-foreground pl-6 truncate max-w-xs">{w.address}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                          {w.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {w.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-sm">{w.maxCapacity}</span>
                        <span className="text-xs text-muted-foreground ml-1">unid.</span>
                      </TableCell>
                      <TableCell>
                        {w.isCentral ? (
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Central
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Satélite</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.status === "active" ? "default" : "secondary"}>
                          {w.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(w)}
                            title="Editar Almacén"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (w.status === "active") {
                                setDeactivatingWarehouse(w)
                              } else {
                                handleToggleStatus(w)
                              }
                            }}
                            title={w.status === "active" ? "Desactivar Almacén" : "Activar Almacén"}
                            className={w.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}
                          >
                            {w.status === "active" ? (
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

      {/* Deactivation Confirmation Modal */}
      <AlertDialog
        open={Boolean(deactivatingWarehouse)}
        onOpenChange={open => !open && setDeactivatingWarehouse(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar Almacén?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea desactivar el almacén{" "}
              <strong>"{deactivatingWarehouse?.name}"</strong>? El almacén ya no aparecerá como opción activa para recepciones ni consultas de existencias inmediatas, pero los datos históricos se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deactivatingWarehouse && handleToggleStatus(deactivatingWarehouse)}
            >
              Sí, Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
