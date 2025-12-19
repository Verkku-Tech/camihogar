"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  getCommissions,
  addCommission,
  updateCommission,
  deleteCommission,
  type Commission,
  getUsers,
  type User,
} from "@/lib/storage";

// Mapeo de roles para display
const roleDisplayMap: Record<string, string> = {
  "Super Administrator": "Super Administrador",
  "Administrator": "Administrador",
  "Supervisor": "Supervisor",
  "Store Seller": "Vendedor de tienda",
  "Online Seller": "Vendedor Online",
};

export function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [formData, setFormData] = useState({
    commissionType: "role" as "role" | "user",
    role: "",
    userId: "",
    userName: "",
    commissionKind: "percentage" as "percentage" | "net",
    value: "",
    currency: "Bs" as "Bs" | "USD" | "EUR",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedCommissions, loadedUsers] = await Promise.all([
        getCommissions(),
        getUsers(),
      ]);
      setCommissions(loadedCommissions);
      setUsers(loadedUsers.filter((u) => u.status === "active"));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    }
  };

  const resetForm = () => {
    setFormData({
      commissionType: "role",
      role: "",
      userId: "",
      userName: "",
      commissionKind: "percentage",
      value: "",
      currency: "Bs",
    });
    setErrors({});
    setEditingCommission(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.commissionType === "role" && !formData.role) {
      newErrors.role = "Debe seleccionar un rol";
    }
    
    if (formData.commissionType === "user" && !formData.userId) {
      newErrors.userId = "Debe seleccionar un usuario";
    }
    
    if (!formData.value || parseFloat(formData.value) <= 0) {
      newErrors.value = "El valor debe ser mayor a 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateCommission = async () => {
    if (!validateForm()) return;

    try {
      const commissionData = {
        commissionType: formData.commissionType,
        role: formData.commissionType === "role" ? formData.role : undefined,
        userId: formData.commissionType === "user" ? formData.userId : undefined,
        userName: formData.commissionType === "user" ? formData.userName : undefined,
        commissionKind: formData.commissionKind,
        value: parseFloat(formData.value),
        currency: formData.currency,
      };

      await addCommission(commissionData);
      await loadData();
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success("Comisión creada exitosamente");
    } catch (error) {
      console.error("Error saving commission:", error);
      toast.error("Error al guardar la comisión");
    }
  };

  const handleUpdateCommission = async () => {
    if (!validateForm() || !editingCommission) return;

    try {
      const commissionData = {
        commissionType: formData.commissionType,
        role: formData.commissionType === "role" ? formData.role : undefined,
        userId: formData.commissionType === "user" ? formData.userId : undefined,
        userName: formData.commissionType === "user" ? formData.userName : undefined,
        commissionKind: formData.commissionKind,
        value: parseFloat(formData.value),
        currency: formData.currency,
      };

      await updateCommission(editingCommission.id, commissionData);
      await loadData();
      setIsEditDialogOpen(false);
      setEditingCommission(null);
      resetForm();
      toast.success("Comisión actualizada exitosamente");
    } catch (error) {
      console.error("Error updating commission:", error);
      toast.error("Error al actualizar la comisión");
    }
  };

  const openEditDialog = (commission: Commission) => {
    setEditingCommission(commission);
    setFormData({
      commissionType: commission.commissionType,
      role: commission.role || "",
      userId: commission.userId || "",
      userName: commission.userName || "",
      commissionKind: commission.commissionKind,
      value: commission.value.toString(),
      currency: commission.currency,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteCommission = async (commission: Commission) => {
    try {
      await deleteCommission(commission.id);
      await loadData();
      toast.success("Comisión eliminada exitosamente");
    } catch (error) {
      console.error("Error deleting commission:", error);
      toast.error("Error al eliminar la comisión");
    }
  };

  const handleUserChange = (userId: string) => {
    const selectedUser = users.find((u) => u.id === userId);
    setFormData({
      ...formData,
      userId,
      userName: selectedUser?.name || "",
    });
    setErrors({ ...errors, userId: "" });
  };

  // Componente de formulario reutilizable
  const renderForm = (isEdit: boolean = false) => {
    return (
      <div className="grid gap-4 py-4">
        {/* Tipo de comisión */}
        <div className="space-y-2">
          <Label htmlFor="commissionType">Tipo de Comisión *</Label>
          <Select
            value={formData.commissionType}
            onValueChange={(value: "role" | "user") => {
              setFormData({
                ...formData,
                commissionType: value,
                role: value === "role" ? formData.role : "",
                userId: value === "user" ? formData.userId : "",
                userName: value === "user" ? formData.userName : "",
              });
              setErrors({});
            }}
          >
            <SelectTrigger id="commissionType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role">Por Rol</SelectItem>
              <SelectItem value="user">Por Usuario</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rol o Usuario según el tipo */}
        {formData.commissionType === "role" ? (
          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => {
                setFormData({ ...formData, role: value });
                setErrors({ ...errors, role: "" });
              }}
            >
              <SelectTrigger id="role" className={errors.role ? "border-red-500" : ""}>
                <SelectValue placeholder="Seleccione un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Super Administrator">
                  Super Administrador
                </SelectItem>
                <SelectItem value="Administrator">Administrador</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="Store Seller">Vendedor de tienda</SelectItem>
                <SelectItem value="Online Seller">Vendedor Online</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-500">{errors.role}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="userId">Usuario *</Label>
            <Select
              value={formData.userId}
              onValueChange={handleUserChange}
            >
              <SelectTrigger id="userId" className={errors.userId ? "border-red-500" : ""}>
                <SelectValue placeholder="Seleccione un usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.userId && (
              <p className="text-sm text-red-500">{errors.userId}</p>
            )}
          </div>
        )}

        {/* Tipo de comisión (Porcentual o Neta) */}
        <div className="space-y-2">
          <Label htmlFor="commissionKind">Tipo de Comisión *</Label>
          <Select
            value={formData.commissionKind}
            onValueChange={(value: "percentage" | "net") =>
              setFormData({ ...formData, commissionKind: value })
            }
          >
            <SelectTrigger id="commissionKind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentual</SelectItem>
              <SelectItem value="net">Neta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="value">
              {formData.commissionKind === "percentage"
                ? "Porcentaje (%) *"
                : "Valor *"}
            </Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={formData.value}
              onChange={(e) => {
                setFormData({ ...formData, value: e.target.value });
                setErrors({ ...errors, value: "" });
              }}
              placeholder={
                formData.commissionKind === "percentage"
                  ? "Ej: 10"
                  : "Ej: 1000"
              }
              className={errors.value ? "border-red-500" : ""}
            />
            {errors.value && (
              <p className="text-sm text-red-500">{errors.value}</p>
            )}
          </div>

          {/* Moneda */}
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda *</Label>
            <Select
              value={formData.currency}
              onValueChange={(value: "Bs" | "USD" | "EUR") =>
                setFormData({ ...formData, currency: value })
              }
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bs">Bolívares (Bs)</SelectItem>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
                <SelectItem value="EUR">Euros (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comisiones</h1>
          <p className="text-muted-foreground">
            Gestiona las comisiones por rol o por usuario
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Comisión
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Comisión</DialogTitle>
            </DialogHeader>
            {renderForm(false)}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCommission}>
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabla de comisiones */}
      <Card>
        <CardHeader>
          <CardTitle>Comisiones Configuradas</CardTitle>
          <CardDescription>
            Lista de todas las comisiones configuradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay comisiones configuradas</p>
              <p className="text-sm">Agrega una comisión para comenzar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Rol/Usuario</TableHead>
                  <TableHead>Tipo de Comisión</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {commission.commissionType === "role" ? "Por Rol" : "Por Usuario"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {commission.commissionType === "role"
                        ? roleDisplayMap[commission.role || ""] || commission.role
                        : commission.userName || "Usuario"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {commission.commissionKind === "percentage" ? (
                          <Percent className="w-4 h-4" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                        <span>
                          {commission.commissionKind === "percentage"
                            ? "Porcentual"
                            : "Neta"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {commission.commissionKind === "percentage"
                        ? `${commission.value}%`
                        : commission.value.toFixed(2)}
                    </TableCell>
                    <TableCell>{commission.currency}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(commission)}
                        >
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
                              <AlertDialogTitle>Eliminar Comisión</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Está seguro que desea eliminar esta comisión? Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCommission(commission)}
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
          )}
        </CardContent>
      </Card>

      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Comisión</DialogTitle>
          </DialogHeader>
          {renderForm(true)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCommission}>
              Actualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

