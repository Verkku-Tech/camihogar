"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useUsers } from "@/hooks/use-users";
import type { CreateUserDto, UpdateUserDto } from "@/lib/api-client";

// Helper para mapear roles entre el formato del componente y el formato de API
type ApiRole =
  | "Super Administrator"
  | "Administrator"
  | "Supervisor"
  | "Store Seller"
  | "Online Seller";
type DisplayRole =
  | "Super Administrador"
  | "Administrador"
  | "Supervisor"
  | "Vendedor de tienda"
  | "Vendedor Online";

const mapRoleToApi = (role: string): ApiRole => {
  const roleMap: Record<string, ApiRole> = {
    "Super Administrador": "Super Administrator",
    Administrador: "Administrator",
    Supervisor: "Supervisor",
    "Vendedor de tienda": "Store Seller",
    "Vendedor Online": "Online Seller",
  };
  return roleMap[role] || "Store Seller";
};

const mapRoleFromApi = (role: string): DisplayRole => {
  const roleMap: Record<string, DisplayRole> = {
    "Super Administrator": "Super Administrador",
    Administrator: "Administrador",
    Supervisor: "Supervisor",
    "Store Seller": "Vendedor de tienda",
    "Online Seller": "Vendedor Online",
  };
  return roleMap[role] || "Vendedor de tienda";
};

const mapStatusToApi = (status: string): "active" | "inactive" => {
  return status === "Activo" ? "active" : "inactive";
};

const mapStatusFromApi = (status: string): "Activo" | "Inactivo" => {
  return status === "active" ? "Activo" : "Inactivo";
};

interface UserDisplay {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role:
    | "Super Administrador"
    | "Administrador"
    | "Supervisor"
    | "Vendedor de tienda"
    | "Vendedor Online";
  status: "Activo" | "Inactivo";
  createdAt: string;
}

export function UsersPage() {
  const {
    users: apiUsers,
    isLoading,
    isSyncing,
    isOnline,
    createUser,
    updateUser,
    deleteUser,
    refresh,
  } = useUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplay | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
    status: "Activo" as "Activo" | "Inactivo",
  });

  // Convertir usuarios de API a formato display
  const users: UserDisplay[] = apiUsers.map((u) => ({
    id: u.id,
    fullName: u.name,
    username: u.username,
    email: u.email,
    role: mapRoleFromApi(u.role) as UserDisplay["role"],
    status: mapStatusFromApi(u.status) as UserDisplay["status"],
    createdAt: u.createdAt || new Date().toISOString(),
  }));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleCreateUser = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    const existingUser = users.find(
      (u) => u.email === formData.email || u.username === formData.username
    );
    if (existingUser) {
      toast.error("El correo electrónico o nombre de usuario ya existe");
      return;
    }

    try {
      const createUserDto: CreateUserDto = {
        name: formData.fullName,
        username: formData.username,
        email: formData.email,
        role: mapRoleToApi(formData.role),
        status: mapStatusToApi(formData.status) || "active", // Por defecto "active" si no se especifica
        password: formData.password,
      };
      await createUser(createUserDto);
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success("Usuario creado exitosamente");
      if (!isOnline) {
        toast.info(
          "Usuario creado localmente. Se sincronizará cuando vuelva la conexión."
        );
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Error al crear el usuario");
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    const existingUser = users.find(
      (u) =>
        (u.email === formData.email || u.username === formData.username) &&
        u.id !== editingUser.id
    );
    if (existingUser) {
      toast.error("El correo electrónico o nombre de usuario ya existe");
      return;
    }

    try {
      const updateUserDto: UpdateUserDto = {
        name: formData.fullName,
        username: formData.username,
        email: formData.email,
        role: mapRoleToApi(formData.role),
        status: mapStatusToApi(formData.status),
        ...(formData.password && { password: formData.password }),
      };
      await updateUser(editingUser.id, updateUserDto);
      setIsEditDialogOpen(false);
      setEditingUser(null);
      resetForm();
      toast.success("Usuario actualizado exitosamente");
      if (!isOnline) {
        toast.info(
          "Usuario actualizado localmente. Se sincronizará cuando vuelva la conexión."
        );
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error al actualizar el usuario");
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const updateUserDto: UpdateUserDto = {
        status:
          mapStatusToApi(user.status) === "active" ? "inactive" : "active",
      };
      await updateUser(userId, updateUserDto);
      toast.success(
        `Usuario ${
          mapStatusToApi(user.status) === "active" ? "desactivado" : "activado"
        } exitosamente`
      );
    } catch (error: any) {
      console.error("Error updating user status:", error);
      toast.error(error.message || "Error al actualizar el estado del usuario");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast.success("Usuario eliminado exitosamente");
      if (!isOnline) {
        toast.info(
          "Usuario eliminado localmente. Se sincronizará cuando vuelva la conexión."
        );
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error al eliminar el usuario");
    }
  };

  const openEditDialog = (user: UserDisplay) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: "",
      confirmPassword: "",
      role: user.role,
      status: user.status,
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "",
      status: "Activo" as "Activo" | "Inactivo",
    });
    setShowPassword(false);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Super Administrador":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Administrador":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "Supervisor":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Vendedor de tienda":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Vendedor Online":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header y Filtros en la misma fila */}
      <div className="flex flex-col  gap-6">
        {/* Gestión de Usuarios - Izquierda */}
        <div className="flex-1 px-[50px]">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-foreground">
              Gestión de Usuarios
            </h1>
            {isSyncing && (
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            )}
            {!isOnline && (
              <Badge
                variant="outline"
                className="text-orange-600 border-orange-600"
              >
                Modo Offline
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mb-4">
            Administra los usuarios del sistema
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refresh()}
              disabled={isLoading || isSyncing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (open) {
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Crear Usuario</DialogTitle>
                  <DialogDescription>
                    Completa los datos para crear un nuevo usuario
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Nombre Completo *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      placeholder="Ingresa el nombre completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Nombre de Usuario *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      placeholder="Ingresa el nombre de usuario"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Correo Electrónico *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="Ingresa el correo electrónico"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Rol *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Super Administrador">
                          Super Administrador
                        </SelectItem>
                        <SelectItem value="Administrador">
                          Administrador
                        </SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                        <SelectItem value="Vendedor de tienda">
                          Vendedor de tienda
                        </SelectItem>
                        <SelectItem value="Vendedor Online">
                          Vendedor Online
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="password">Contraseña *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Ingresa la contraseña"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">
                      Confirmar Contraseña *
                    </Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Confirma la contraseña"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateUser}>Crear Usuario</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtros - Derecha */}
        <div className="w-full">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por nombre, usuario o correo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-col flex-row gap-6">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      <SelectItem value="Super Administrador">
                        Super Administrador
                      </SelectItem>
                      <SelectItem value="Administrador">
                        Administrador
                      </SelectItem>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                      <SelectItem value="Vendedor de tienda">
                        Vendedor de tienda
                      </SelectItem>
                      <SelectItem value="Vendedor Online">
                        Vendedor Online
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="Activo">Activo</SelectItem>
                      <SelectItem value="Inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Lista de todos los usuarios del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando usuarios...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.fullName}
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "Activo" ? "default" : "secondary"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {user.status === "Activo" ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {user.status === "Activo"
                                    ? "Desactivar"
                                    : "Activar"}{" "}
                                  Usuario
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que deseas{" "}
                                  {user.status === "Activo"
                                    ? "desactivar"
                                    : "activar"}{" "}
                                  al usuario {user.fullName}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleStatus(user.id)}
                                >
                                  {user.status === "Activo"
                                    ? "Desactivar"
                                    : "Activar"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Eliminar Usuario
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que deseas eliminar al
                                  usuario {user.fullName}? Esta acción no se
                                  puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editFullName">Nombre Completo *</Label>
              <Input
                id="editFullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="Ingresa el nombre completo"
              />
            </div>
            <div>
              <Label htmlFor="editUsername">Nombre de Usuario *</Label>
              <Input
                id="editUsername"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Ingresa el nombre de usuario"
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Correo Electrónico *</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="Ingresa el correo electrónico"
              />
            </div>
            <div>
              <Label htmlFor="editRole">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Super Administrador">
                    Super Administrador
                  </SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Vendedor de tienda">
                    Vendedor de tienda
                  </SelectItem>
                  <SelectItem value="Vendedor Online">
                    Vendedor Online
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editStatus">Estado *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "Activo" | "Inactivo") =>
                  setFormData({
                    ...formData,
                    status: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editPassword">Nueva Contraseña (opcional)</Label>
              <div className="relative">
                <Input
                  id="editPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Dejar vacío para mantener la actual"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditUser}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
