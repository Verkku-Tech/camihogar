"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Package, Search, ArrowLeft, Filter } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useRouter } from "next/navigation"
import { ProductWizardDialog } from "@/components/inventory/product-wizard-dialog"
import { DeleteProductDialog } from "@/components/inventory/delete-product-dialog"
import { EditProductDialog } from "@/components/inventory/edit-product-dialog"
import { getProducts, deleteProduct, type Product } from "@/lib/storage"
import { useCurrency } from "@/contexts/currency-context"
import { Currency } from "@/lib/currency-utils"

// Componente para mostrar precio con conversión
function ProductPrice({ 
  price, 
  currency 
}: { 
  price: number; 
  currency?: Currency 
}) {
  const { formatWithPreference } = useCurrency()
  const [displayPrice, setDisplayPrice] = useState("")
  
  useEffect(() => {
    formatWithPreference(price, currency || "Bs").then(setDisplayPrice)
  }, [price, currency, formatWithPreference])
  
  return <p className="font-medium">{displayPrice || "-"}</p>
}

export default function ProductosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProductWizard, setShowProductWizard] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [products, setProducts] = useState<Product[]>([])
  const router = useRouter()

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const loadedProducts = await getProducts()
        setProducts(loadedProducts)
      } catch (error) {
        console.error("Error loading products:", error)
      }
    }
    loadProducts()
  }, [])

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
    const matchesStatus = selectedStatus === "all" || product.status === selectedStatus

    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Disponible":
        return "bg-green-100 text-green-800"
      case "Agotado":
        return "bg-red-100 text-red-800"
      case "Descontinuado":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowDeleteDialog(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowEditDialog(true)
  }

  const confirmDelete = async () => {
    if (selectedProduct) {
      try {
        await deleteProduct(selectedProduct.id)
        const loadedProducts = await getProducts()
        setProducts(loadedProducts)
      } catch (error) {
        console.error("Error deleting product:", error)
        toast.error("Error al eliminar el producto")
      }
    }
    setShowDeleteDialog(false)
    setSelectedProduct(null)
  }

  const handleProductSaved = async () => {
    try {
      const loadedProducts = await getProducts()
      setProducts(loadedProducts)
      setShowProductWizard(false)
      setShowEditDialog(false)
    } catch (error) {
      console.error("Error loading products:", error)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto w-full">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Productos</span>
            </nav>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={() => router.back()} className="w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Productos</h1>
                <p className="text-muted-foreground">Gestiona tu inventario de productos</p>
              </div>
              <Button onClick={() => setShowProductWizard(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </div>

            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar productos..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    <SelectItem value="Camas">Camas</SelectItem>
                    <SelectItem value="Muebles">Muebles</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="Disponible">Disponible</SelectItem>
                    <SelectItem value="Agotado">Agotado</SelectItem>
                    <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>

                {(selectedCategory !== "all" || selectedStatus !== "all" || searchTerm) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("all")
                      setSelectedStatus("all")
                      setSearchTerm("")
                    }}
                    className="w-full sm:w-auto"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.length === 0 ? (
                <Card className="p-8 text-center sm:col-span-2 xl:col-span-3">
                  <CardContent>
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No se encontraron productos</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || selectedCategory !== "all" || selectedStatus !== "all"
                        ? "Intenta ajustar los filtros de búsqueda"
                        : "Comienza agregando tu primer producto"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center space-x-3">
                          <Package className="w-5 h-5 text-primary" />
                          <div>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            <CardDescription>SKU: {product.sku}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(product.status)}>{product.status}</Badge>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Categoría:</span>
                          <p className="font-medium break-words">{product.category}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio:</span>
                          <ProductPrice price={product.price} currency={product.priceCurrency} />
                        </div>
                        <div>
                          <span className="text-muted-foreground">Estado:</span>
                          <p className="font-medium">{product.status}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
      <ProductWizardDialog
        open={showProductWizard}
        onOpenChange={setShowProductWizard}
        onProductCreated={handleProductSaved}
      />
      <DeleteProductDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        product={selectedProduct}
        onConfirm={confirmDelete}
      />
      <EditProductDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        product={selectedProduct}
        onSave={handleProductSaved}
      />
    </div>
  )
}
