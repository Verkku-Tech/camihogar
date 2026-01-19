"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Search, Edit, Trash2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { 
  getAccounts, 
  addAccount, 
  updateAccount, 
  deleteAccount, 
  getStores,
  type Account,
  type Store 
} from "@/lib/storage"

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    label: "",
    storeId: "",
    isForeign: false,
    accountType: "",
    email: "",
    wallet: "",
    isActive: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const [loadedAccounts, loadedStores] = await Promise.all([
          getAccounts(),
          getStores()
        ])
        setAccounts(loadedAccounts)
        setStores(loadedStores.filter(s => s.status === "active"))
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Error al cargar las cuentas")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // Filtrar cuentas
  const filteredAccounts = accounts.filter((account) => {
    const store = account.storeId === "all" ? null : stores.find(s => s.id === account.storeId)
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      account.code.toLowerCase().includes(searchLower) ||
      account.label.toLowerCase().includes(searchLower) ||
      (account.email ? account.email.toLowerCase().includes(searchLower) : false) ||
      (account.wallet ? account.wallet.toLowerCase().includes(searchLower) : false) ||
      (store?.name.toLowerCase().includes(searchLower) ?? false) ||
      (account.storeId === "all" && "todas las tiendas".includes(searchLower))
    return matchesSearch
  })

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    const isDigital = formData.accountType === "Cuentas Digitales"

    // Validaciones comunes
    if (!formData.code.trim()) {
      newErrors.code = "El código es requerido"
    }

    if (!formData.label.trim()) {
      newErrors.label = "La etiqueta o nombre es requerido"
    }

    if (!formData.storeId) {
      newErrors.storeId = "La tienda asociada es requerida"
    }

    if (!formData.accountType) {
      newErrors.accountType = "El tipo de cuenta es requerido"
    }

    if (isDigital) {
      // Validaciones para cuentas digitales
      if (!formData.email.trim()) {
        newErrors.email = "El correo es requerido"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "El correo no es válido"
      }

      if (!formData.wallet.trim()) {
        newErrors.wallet = "El wallet es requerido"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Crear cuenta
  const handleCreateAccount = async () => {
    if (!validateForm()) return

    try {
      const isDigital = formData.accountType === "Cuentas Digitales"
      const accountData = {
        ...formData,
        // Si no es digital, limpiar campos digitales
        email: isDigital ? formData.email : undefined,
        wallet: isDigital ? formData.wallet : undefined,
      }
      const newAccount = await addAccount(accountData)
      setAccounts([...accounts, newAccount])
      setIsCreateDialogOpen(false)
      resetForm()
      toast.success("Cuenta creada exitosamente")
    } catch (error) {
      console.error("Error creating account:", error)
      toast.error("Error al crear la cuenta")
    }
  }

  // Editar cuenta
  const handleEditAccount = async () => {
    if (!validateForm() || !editingAccount) return

    try {
      const isDigital = formData.accountType === "Cuentas Digitales"
      const accountData = {
        ...formData,
        // Si no es digital, limpiar campos digitales
        email: isDigital ? formData.email : undefined,
        wallet: isDigital ? formData.wallet : undefined,
      }
      const updatedAccount = await updateAccount(editingAccount.id, accountData)
      setAccounts(accounts.map(acc => acc.id === editingAccount.id ? updatedAccount : acc))
      setIsEditDialogOpen(false)
      setEditingAccount(null)
      resetForm()
      toast.success("Cuenta actualizada exitosamente")
    } catch (error) {
      console.error("Error updating account:", error)
      toast.error("Error al actualizar la cuenta")
    }
  }

  // Eliminar cuenta
  const handleDeleteAccount = async (account: Account) => {
    try {
      await deleteAccount(account.id)
      setAccounts(accounts.filter(acc => acc.id !== account.id))
      toast.success("Cuenta eliminada exitosamente")
    } catch (error) {
      console.error("Error deleting account:", error)
      toast.error("Error al eliminar la cuenta")
    }
  }

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      code: "",
      label: "",
      storeId: "",
      isForeign: false,
      accountType: "",
      email: "",
      wallet: "",
      isActive: true,
    })
    setErrors({})
  }

  // Abrir diálogo de edición
  const openEditDialog = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      code: account.code,
      label: account.label,
      storeId: account.storeId,
      isForeign: account.isForeign,
      accountType: account.accountType,
      email: account.email || "",
      wallet: account.wallet || "",
      isActive: account.isActive,
    })
    setIsEditDialogOpen(true)
  }

  // Obtener nombre de tienda
  const getStoreName = (storeId: string | "all"): string => {
    if (storeId === "all") {
      return "Todas las tiendas"
    }
    const store = stores.find(s => s.id === storeId)
    return store?.name ?? "N/A"
  }

  // Componente de formulario reutilizable
  const renderForm = (isEdit: boolean = false) => {
    const isDigital = formData.accountType === "Cuentas Digitales"
    
    return (
      <div className="grid gap-4 py-4">
        {/* Código - Siempre visible */}
        <div className="space-y-2">
          <Label htmlFor="code">Código *</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="Ej: Banesco_POS"
            className={errors.code ? "border-red-500" : ""}
          />
          {errors.code && <p className="text-sm text-red-500">{errors.code}</p>}
        </div>

        {/* Etiqueta o Nombre - Siempre visible */}
        <div className="space-y-2">
          <Label htmlFor="label">Etiqueta o Nombre *</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="Ej: Punto de Venta Banesco"
            className={errors.label ? "border-red-500" : ""}
          />
          {errors.label && <p className="text-sm text-red-500">{errors.label}</p>}
        </div>

        {/* Tipo de Cuenta */}
        <div className="space-y-2">
          <Label htmlFor="accountType">Tipo de Cuenta *</Label>
          <Select
            value={formData.accountType}
            onValueChange={(value) => {
              // Limpiar campos al cambiar tipo
              setFormData({ 
                ...formData, 
                accountType: value,
                email: "",
                wallet: "",
              })
            }}
          >
            <SelectTrigger className={errors.accountType ? "border-red-500" : ""}>
              <SelectValue placeholder="Seleccione el tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cuentas Digitales">Cuentas Digitales</SelectItem>
              <SelectItem value="Ahorro">Ahorro</SelectItem>
              <SelectItem value="Corriente">Corriente</SelectItem>
            </SelectContent>
          </Select>
          {errors.accountType && <p className="text-sm text-red-500">{errors.accountType}</p>}
        </div>

        {/* Tienda Asociada - Siempre visible con opción "Todas las tiendas" */}
        <div className="space-y-2">
          <Label htmlFor="storeId">Tienda Asociada *</Label>
          <Select
            value={formData.storeId}
            onValueChange={(value) => setFormData({ ...formData, storeId: value })}
          >
            <SelectTrigger className={errors.storeId ? "border-red-500" : ""}>
              <SelectValue placeholder="Seleccione una tienda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tiendas</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.storeId && <p className="text-sm text-red-500">{errors.storeId}</p>}
        </div>

        {/* Campos condicionales según tipo de cuenta */}
        {isDigital ? (
          <>
            {/* Para cuentas digitales: Correo */}
            <div className="space-y-2">
              <Label htmlFor="email">Correo *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            {/* Wallet */}
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet *</Label>
              <Input
                id="wallet"
                value={formData.wallet}
                onChange={(e) => setFormData({ ...formData, wallet: e.target.value })}
                placeholder="Dirección de wallet"
                className={errors.wallet ? "border-red-500" : ""}
              />
              {errors.wallet && <p className="text-sm text-red-500">{errors.wallet}</p>}
            </div>
          </>
        ) : (
          <>
            {/* Para cuentas tradicionales: Nacional / Extranjera */}
            <div className="space-y-2">
              <Label htmlFor="isForeign">Nacional / Extranjera *</Label>
              <Select
                value={formData.isForeign ? "foreign" : "national"}
                onValueChange={(value) => setFormData({ ...formData, isForeign: value === "foreign" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">Nacional</SelectItem>
                  <SelectItem value="foreign">Extranjera</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Activar/Desactivar cuenta */}
        <div className="flex items-center justify-between space-x-2 py-2">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">Estado de la cuenta</Label>
            <p className="text-sm text-muted-foreground">
              {formData.isActive ? "La cuenta está activa" : "La cuenta está inactiva"}
            </p>
          </div>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-foreground">Gestión de Cuentas</h1>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cuenta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Cuenta</DialogTitle>
            </DialogHeader>
            {renderForm(false)}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateAccount} className="bg-indigo-600 hover:bg-indigo-700">
                Crear Cuenta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por código, etiqueta, correo, wallet o tienda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Cuentas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cuentas ({filteredAccounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando cuentas...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron cuentas con los filtros aplicados" : "No hay cuentas registradas"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Etiqueta/Nombre</TableHead>
                    <TableHead>Tienda Asociada</TableHead>
                    <TableHead>{accounts.some(a => a.accountType === "Cuentas Digitales") ? "Correo/Wallet" : "Nacional/Extranjera"}</TableHead>
                    <TableHead>Tipo de Cuenta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">
                        {account.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.label}
                      </TableCell>
                      <TableCell>{getStoreName(account.storeId)}</TableCell>
                      <TableCell>
                        {account.accountType === "Cuentas Digitales" ? (
                          <div className="space-y-1">
                            {account.email && <div className="text-sm">{account.email}</div>}
                            {account.wallet && <div className="text-xs text-muted-foreground font-mono">{account.wallet}</div>}
                            {!account.email && !account.wallet && "-"}
                          </div>
                        ) : (
                          <Badge variant={account.isForeign ? "secondary" : "default"}>
                            {account.isForeign ? "Extranjera" : "Nacional"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.accountType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(account)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar Cuenta</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Está seguro que desea eliminar la cuenta "{account.label}" ({account.code})?
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAccount(account)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Diálogo de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
          </DialogHeader>
          {renderForm(true)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditAccount} className="bg-indigo-600 hover:bg-indigo-700">
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

