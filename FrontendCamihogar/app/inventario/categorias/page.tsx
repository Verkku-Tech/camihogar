"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Tags } from "lucide-react"
import { toast } from "sonner"
import { CategoryFormDialog } from "@/components/inventory/category-form-dialog"
import { DeleteCategoryDialog } from "@/components/inventory/delete-category-dialog"
import { getCategories, addCategory, updateCategory, deleteCategory, type Category } from "@/lib/storage"

export default function CategoriasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

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
    } catch (error) {
      console.error("Error saving category:", error)
      toast.error("Error al guardar la categoría")
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto w-full">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Categorías</span>
            </nav>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Categorías</h1>
                <p className="text-muted-foreground">
                  Gestiona las categorías de productos
                </p>
              </div>
              <Button onClick={handleNewCategory} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Categoría
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center space-x-2">
                        <Tags className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(category)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
      </div>

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
    </div>
  )
}
