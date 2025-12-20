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
import { 
  getAccounts, 
  addAccount, 
  updateAccount, 
  deleteAccount, 
  getStores,
  maskAccountNumber,
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
    accountNumber: "",
    storeId: "",
    responsible: "",
    bank: "",
    isForeign: false,
    accountType: "",
    email: "",
    wallet: "",
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
    const store = stores.find(s => s.id === account.storeId)
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      (account.accountNumber ? maskAccountNumber(account.accountNumber).toLowerCase().includes(searchLower) : false) ||
      (account.bank ? account.bank.toLowerCase().includes(searchLower) : false) ||
      account.responsible.toLowerCase().includes(searchLower) ||
      (account.email ? account.email.toLowerCase().includes(searchLower) : false) ||
      (account.wallet ? account.wallet.toLowerCase().includes(searchLower) : false) ||
      (store?.name.toLowerCase().includes(searchLower) ?? false)
    return matchesSearch
  })

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    const isDigital = formData.accountType === "Cuentas Digitales"

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
    } else {
      // Validaciones para cuentas tradicionales
      if (!formData.accountNumber.trim()) {
        newErrors.accountNumber = "El número de cuenta es requerido"
      } else if (formData.accountNumber.length < 8) {
        newErrors.accountNumber = "El número de cuenta debe tener al menos 8 dígitos"
      }

      if (!formData.bank.trim()) {
        newErrors.bank = "El banco es requerido"
      }
    }

    if (!formData.storeId) {
      newErrors.storeId = "La tienda asociada es requerida"
    }

    if (!formData.responsible.trim()) {
      newErrors.responsible = "El responsable es requerido"
    }

    if (!formData.accountType) {
      newErrors.accountType = "El tipo de cuenta es requerido"
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
        // Si es digital, limpiar campos tradicionales
        accountNumber: isDigital ? undefined : formData.accountNumber || undefined,
        bank: isDigital ? undefined : formData.bank || undefined,
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
        // Si es digital, limpiar campos tradicionales
        accountNumber: isDigital ? undefined : formData.accountNumber || undefined,
        bank: isDigital ? undefined : formData.bank || undefined,
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
      accountNumber: "",
      storeId: "",
      responsible: "",
      bank: "",
      isForeign: false,
      accountType: "",
      email: "",
      wallet: "",
    })
    setErrors({})
  }

  // Abrir diálogo de edición
  const openEditDialog = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      accountNumber: account.accountNumber || "",
      storeId: account.storeId,
      responsible: account.responsible,
      bank: account.bank || "",
      isForeign: account.isForeign,
      accountType: account.accountType,
      email: account.email || "",
      wallet: account.wallet || "",
    })
    setIsEditDialogOpen(true)
  }

  // Obtener nombre de tienda
  const getStoreName = (storeId: string): string => {
    const store = stores.find(s => s.id === storeId)
    return store?.name ?? "N/A"
  }

  // Componente de formulario reutilizable
  const renderForm = (isEdit: boolean = false) => {
    const isDigital = formData.accountType === "Cuentas Digitales"
    
    return (
      <div className="grid gap-4 py-4">
        {/* Tipo de Cuenta - Primero */}
        <div className="space-y-2">
          <Label htmlFor="accountType">Tipo de Cuenta *</Label>
          <Select
            value={formData.accountType}
            onValueChange={(value) => {
              // Limpiar campos al cambiar tipo
              setFormData({ 
                ...formData, 
                accountType: value,
                accountNumber: "",
                bank: "",
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

            {/* Responsable */}
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsable *</Label>
              <Input
                id="responsible"
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                className={errors.responsible ? "border-red-500" : ""}
              />
              {errors.responsible && <p className="text-sm text-red-500">{errors.responsible}</p>}
            </div>

            {/* Tienda Asociada */}
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
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.storeId && <p className="text-sm text-red-500">{errors.storeId}</p>}
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
            {/* Para cuentas tradicionales: Número de Cuenta */}
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Número de Cuenta *</Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, "") })}
                placeholder="Solo números"
                className={errors.accountNumber ? "border-red-500" : ""}
              />
              {errors.accountNumber && <p className="text-sm text-red-500">{errors.accountNumber}</p>}
            </div>

            {/* Tienda Asociada */}
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
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.storeId && <p className="text-sm text-red-500">{errors.storeId}</p>}
            </div>

            {/* Responsable */}
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsable *</Label>
              <Input
                id="responsible"
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                className={errors.responsible ? "border-red-500" : ""}
              />
              {errors.responsible && <p className="text-sm text-red-500">{errors.responsible}</p>}
            </div>

            {/* Banco */}
            <div className="space-y-2">
              <Label htmlFor="bank">Banco *</Label>
              <Input
                id="bank"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                className={errors.bank ? "border-red-500" : ""}
              />
              {errors.bank && <p className="text-sm text-red-500">{errors.bank}</p>}
            </div>

            {/* Nacional / Extranjera */}
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
              placeholder="Buscar por número de cuenta, correo, wallet, banco, responsable o tienda..."
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
                    <TableHead>{accounts.some(a => a.accountType === "Cuentas Digitales") ? "Cuenta/Correo" : "Número de Cuenta"}</TableHead>
                    <TableHead>Tienda Asociada</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>{accounts.some(a => a.accountType === "Cuentas Digitales") ? "Wallet/Banco" : "Banco"}</TableHead>
                    <TableHead>Nacional / Extranjera</TableHead>
                    <TableHead>Tipo de Cuenta</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className={account.accountType === "Cuentas Digitales" ? "" : "font-mono"}>
                        {account.accountType === "Cuentas Digitales" 
                          ? account.email || "-" 
                          : account.accountNumber 
                            ? maskAccountNumber(account.accountNumber) 
                            : "-"}
                      </TableCell>
                      <TableCell>{getStoreName(account.storeId)}</TableCell>
                      <TableCell>{account.responsible}</TableCell>
                      <TableCell>
                        {account.accountType === "Cuentas Digitales" 
                          ? account.wallet || "-" 
                          : account.bank || "-"}
                      </TableCell>
                      <TableCell>
                        {account.accountType === "Cuentas Digitales" ? (
                          <Badge variant="secondary">N/A</Badge>
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
                                  ¿Está seguro que desea eliminar la cuenta {account.accountType === "Cuentas Digitales" 
                                    ? account.email || "digital"
                                    : account.accountNumber 
                                      ? maskAccountNumber(account.accountNumber) 
                                      : "N/A"}?
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

