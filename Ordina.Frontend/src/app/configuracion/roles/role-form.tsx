"use client"

import { useState, useEffect } from "react"
import { apiClient, type RoleResponseDto, type CreateRoleDto } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"

interface RoleFormProps {
    initialData?: RoleResponseDto | null
    onSuccess: () => void
    onCancel: () => void
}

export function RoleForm({ initialData, onSuccess, onCancel }: RoleFormProps) {
    const [name, setName] = useState(initialData?.name || "")
    const [permissions, setPermissions] = useState<string[]>([])
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(initialData?.permissions || [])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const { toast } = useToast()

    // Load available permissions
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                setIsLoading(true)
                const allPermissions = await apiClient.getAllPermissions()
                setPermissions(allPermissions)
            } catch (error) {
                console.error("Error loading permissions:", error)
                toast({
                    title: "Error",
                    description: "No se pudieron cargar los permisos disponibles",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }

        loadPermissions()
    }, [])

    // Update selected permissions if initialData changes
    useEffect(() => {
        if (initialData) {
            setName(initialData.name)
            setSelectedPermissions(initialData.permissions)
        } else {
            setName("")
            setSelectedPermissions([])
        }
    }, [initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            toast({
                title: "Error",
                description: "El nombre del rol es requerido",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSaving(true)
            const roleData: CreateRoleDto = {
                name,
                permissions: selectedPermissions,
            }

            if (initialData) {
                await apiClient.updateRole(initialData.id, roleData)
            } else {
                await apiClient.createRole(roleData)
            }

            onSuccess()
        } catch (error: any) {
            console.error("Error saving role:", error)
            toast({
                title: "Error",
                description: error.message || "No se pudo guardar el rol",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const togglePermission = (permission: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permission)
                ? prev.filter(p => p !== permission)
                : [...prev, permission]
        )
    }

    const toggleGroup = (groupPermissions: string[]) => {
        const allSelected = groupPermissions.every(p => selectedPermissions.includes(p))

        if (allSelected) {
            // Uncheck all
            setSelectedPermissions(prev => prev.filter(p => !groupPermissions.includes(p)))
        } else {
            // Check all
            const newPermissions = [...selectedPermissions]
            groupPermissions.forEach(p => {
                if (!newPermissions.includes(p)) {
                    newPermissions.push(p)
                }
            })
            setSelectedPermissions(newPermissions)
        }
    }

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, perm) => {
        const [module, action] = perm.split(".")
        // Standardize module names for display
        const moduleName = module.charAt(0).toUpperCase() + module.slice(1)

        if (!acc[moduleName]) {
            acc[moduleName] = []
        }
        acc[moduleName].push({ id: perm, label: action || perm })
        return acc
    }, {} as Record<string, { id: string, label: string }[]>)

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Nombre del Rol</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Editor de Contenido"
                    disabled={initialData?.isSystem && initialData.name === "Super Administrator"}
                />
                {initialData?.isSystem && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Los roles del sistema tienen algunas restricciones de edición.
                    </p>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Permisos</Label>
                    <div className="space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPermissions(permissions)}
                        >
                            Seleccionar Todos
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPermissions([])}
                        >
                            Deseleccionar Todos
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto p-1">
                    {Object.entries(groupedPermissions).map(([module, perms]) => {
                        const groupIds = perms.map(p => p.id)
                        const isAllSelected = groupIds.every(id => selectedPermissions.includes(id))
                        const isSomeSelected = groupIds.some(id => selectedPermissions.includes(id)) && !isAllSelected

                        return (
                            <Card key={module} className="h-full">
                                <CardHeader className="py-3 px-4 bg-muted/50">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`group-${module}`}
                                            checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                            onCheckedChange={() => toggleGroup(groupIds)}
                                        />
                                        <CardTitle className="text-base font-medium cursor-pointer" onClick={() => toggleGroup(groupIds)}>
                                            {module}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="py-3 px-4 grid gap-2">
                                    {perms.map((perm) => (
                                        <div key={perm.id} className="flex items-start space-x-2">
                                            <Checkbox
                                                id={perm.id}
                                                checked={selectedPermissions.includes(perm.id)}
                                                onCheckedChange={() => togglePermission(perm.id)}
                                            />
                                            <Label
                                                htmlFor={perm.id}
                                                className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 pt-0.5"
                                            >
                                                {perm.label.replace(/_/g, " ")}
                                            </Label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? "Guardar Cambios" : "Crear Rol"}
                </Button>
            </div>
        </form>
    )
}
