"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash2, Tags } from "lucide-react"
import { toast } from "sonner"
import { CategoryFormDialog } from "@/components/inventory/category-form-dialog"
import { DeleteCategoryDialog } from "@/components/inventory/delete-category-dialog"
import { BulkDeleteDialog } from "@/components/inventory/bulk-delete-dialog"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { getCategories, addCategory, updateCategory, deleteCategory, type Category } from "@/lib/storage"
import { apiClient } from "@/lib/api-client"
import * as db from "@/lib/indexeddb"

export default function CategoriasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const loadedCategories = await getCategories()
        setCategories(loadedCategories)
      } catch (error) {
        console.error("Error loading categories:", error)
      }
    }
    loadCategories()
  }, [])

  const handleNewCategory = () => {
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setShowCategoryForm(true)
  }

  const handleSaveCategory = async (categoryData: any) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData)
      } else {
        await addCategory(categoryData)
      }

      // Refresh categories
      const loadedCategories = await getCategories()
      setCategories(loadedCategories)
      setShowCategoryForm(false)
      setEditingCategory(null)
      toast.success(editingCategory ? "Categoría actualizada exitosamente" : "Categoría creada exitosamente")
    } catch (error: any) {
      console.error("Error saving category:", error)
      // Mostrar el mensaje de error específico si está disponible
      const errorMessage = error?.message || "Error al guardar la categoría"
      toast.error(errorMessage)
    }
  }

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      await deleteCategory(categoryToDelete.id)
      const loadedCategories = await getCategories()
      setCategories(loadedCategories)
      toast.success("Categoría eliminada exitosamente")
      setIsDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (error) {
      console.error("Error deleting category:", error)
      toast.error("Error al eliminar la categoría")
    }
  }

  const categoriesWithBackendId = categories.filter((c) => c.backendId)

  const toggleSelection = (backendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(backendId)) next.delete(backendId)
      else next.add(backendId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === categoriesWithBackendId.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(categoriesWithBackendId.map((c) => c.backendId!)))
    }
  }

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setIsBulkDeleting(true)
    try {
      const result = await apiClient.deleteCategoriesBulk(ids)

      for (const backendId of ids) {
        const cat = categories.find((c) => c.backendId === backendId)
        if (cat) {
          try {
            await db.remove("categories", cat.id.toString())
          } catch {
            // Ignore IndexedDB errors
          }
        }
      }

      const loadedCategories = await getCategories()
      setCategories(loadedCategories)
      setSelectedIds(new Set())
      setIsBulkDeleteDialogOpen(false)

      if (result.failed > 0) {
        toast.warning(
          `Eliminadas ${result.deleted} categoría(s). ${result.failed} no se pudieron eliminar.`,
          { description: result.errors.slice(0, 2).join("; ") }
        )
      } else {
        toast.success(`Eliminadas ${result.deleted} categoría(s) correctamente`)
      }
    } catch (error) {
      console.error("Error bulk deleting categories:", error)
      toast.error("Error al eliminar las categorías")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="w-full">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Categorías</span>
            </nav>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex-1 flex items-center gap-3">
                
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Categorías</h1>
                  <p className="text-muted-foreground">
                    Gestiona las categorías de productos
                  </p>
                </div>
                <br />
                
              </div>
            
              <PermissionGuard permission="products.create">
                <Button onClick={handleNewCategory} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Categoría
                </Button>
              </PermissionGuard>
            </div>
            {categoriesWithBackendId.length > 0 && (
                  <PermissionGuard permission="products.delete">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-categories"
                        checked={selectedIds.size === categoriesWithBackendId.length && categoriesWithBackendId.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <label htmlFor="select-all-categories" className="text-sm text-muted-foreground cursor-pointer">
                        Seleccionar todo
                      </label>
                    </div>
                  </PermissionGuard>
                )}
                <br />
                <br />
            {selectedIds.size > 0 && (
              <PermissionGuard permission="products.delete">
                <div className="flex items-center gap-3 p-3 mb-6 rounded-lg bg-muted/50 border">
                  <span className="text-sm font-medium">
                    {selectedIds.size} categoría(s) seleccionada(s)
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar seleccionadas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Cancelar selección
                  </Button>
                </div>
              </PermissionGuard>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center space-x-2">
                        {category.backendId && (
                          <PermissionGuard permission="products.delete">
                            <Checkbox
                              checked={selectedIds.has(category.backendId)}
                              onCheckedChange={() => toggleSelection(category.backendId!)}
                            />
                          </PermissionGuard>
                        )}
                        <Tags className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                      </div>
                      <div className="flex space-x-1">
                        <PermissionGuard permission="products.update">
                          <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="products.delete">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(category)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </div>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="text-muted-foreground">{category.products} productos</div>
                      <div className="text-muted-foreground">
                        Descuento máximo: ${category.maxDiscount}
                      </div>
                      <div className="text-muted-foreground">
                        {category.attributes.length} atributos
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div >

      <CategoryFormDialog
        open={showCategoryForm}
        onOpenChange={setShowCategoryForm}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

      <DeleteCategoryDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        category={categoryToDelete}
        onConfirm={handleDeleteCategory}
      />

      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        count={selectedIds.size}
        entityLabel="categorías"
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isBulkDeleting}
      />
    </div >
  )
}
