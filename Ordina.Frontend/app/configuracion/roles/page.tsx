"use client"

import { useState, useEffect } from "react"
import { apiClient, type RoleResponseDto } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Shield, Edit, Trash2 } from "lucide-react"
import { PermissionGuard } from "@/components/auth/permission-guard"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { RoleForm } from "./role-form"

export default function RolesPage() {
    const [roles, setRoles] = useState<RoleResponseDto[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<RoleResponseDto | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { toast } = useToast()

    const loadRoles = async () => {
        try {
            setIsLoading(true)
            const data = await apiClient.getRoles()
            setRoles(data)
        } catch (error) {
            console.error("Error loading roles:", error)
            toast({
                title: "Error",
                description: "No se pudieron cargar los roles",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadRoles()
    }, [])

    const handleCreate = () => {
        setEditingRole(null)
        setIsDialogOpen(true)
    }

    const handleEdit = (role: RoleResponseDto) => {
        setEditingRole(role)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este rol?")) return

        try {
            await apiClient.deleteRole(id)
            toast({
                title: "Éxito",
                description: "Rol eliminado correctamente",
            })
            loadRoles()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar el rol",
                variant: "destructive",
            })
        }
    }

    const handleSuccess = () => {
        setIsDialogOpen(false)
        loadRoles()
        toast({
            title: "Éxito",
            description: `Rol ${editingRole ? "actualizado" : "creado"} correctamente`,
        })
    }

    return (
        <div className="flex h-screen bg-background">
            <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="container mx-auto max-w-6xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Gestión de Roles</h1>
                                <p className="text-muted-foreground">Configura los roles y permisos del sistema</p>
                            </div>
                            <PermissionGuard permission="roles.create">
                                <Button onClick={handleCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nuevo Rol
                                </Button>
                            </PermissionGuard>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Permisos</TableHead>
                                        <TableHead>Sistema</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10">
                                                Cargando roles...
                                            </TableCell>
                                        </TableRow>
                                    ) : roles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10">
                                                No hay roles configurados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        roles.map((role) => (
                                            <TableRow key={role.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center">
                                                        <Shield className="mr-2 h-4 w-4 text-primary" />
                                                        {role.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="mr-2">
                                                        {role.permissions.length} permisos
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {role.isSystem ? (
                                                        <Badge variant="secondary">Sistema</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Personalizado</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <PermissionGuard permission="roles.update">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(role)}
                                                                disabled={role.name === "Super Administrator"} // Prevent editing Super Admin permissions easily
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </PermissionGuard>
                                                        <PermissionGuard permission="roles.delete">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(role.id)}
                                                                disabled={role.isSystem} // Prevent deleting system roles
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </PermissionGuard>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingRole ? "Editar Rol" : "Crear Nuevo Rol"}
                                    </DialogTitle>
                                </DialogHeader>
                                <RoleForm
                                    initialData={editingRole}
                                    onSuccess={handleSuccess}
                                    onCancel={() => setIsDialogOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </main>
            </div>
        </div>
    )
}
