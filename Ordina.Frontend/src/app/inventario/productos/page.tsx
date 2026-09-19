"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash2, Package, Search, ArrowLeft, Filter, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, Download } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { useRouter } from "next/navigation"
import { ProductWizardDialog } from "@/components/inventory/product-wizard-dialog"
import { DeleteProductDialog } from "@/components/inventory/delete-product-dialog"
import { EditProductDialog } from "@/components/inventory/edit-product-dialog"
import { ImportProductsDialog } from "@/components/inventory/import-products-dialog"
import { DownloadFormatDialog } from "@/components/inventory/download-format-dialog"
import { BulkDeleteDialog } from "@/components/inventory/bulk-delete-dialog"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { getCategories, productListItemDtoToProduct, type Product, type Category } from "@/lib/storage"
import { apiClient, type ProductListItemDto, type PaginatedResultDto } from "@/lib/api-client"
import { useCurrency } from "@/contexts/currency-context"
import { Currency } from "@/lib/currency-utils"

const PAGE_SIZE = 20

function ProductPrice({ price, currency }: { price: number; currency?: Currency }) {
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
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedBackendId, setSelectedBackendId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [categories, setCategories] = useState<Category[]>([])

  const [products, setProducts] = useState<ProductListItemDto[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Cargar categorias para el filtro dinamico
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error)
  }, [])

  const fetchProducts = useCallback(async (p: number, search: string, catId: string, status: string) => {
    setIsLoading(true)
    try {
      const result: PaginatedResultDto<ProductListItemDto> = await apiClient.getProductsPaginated({
        page: p,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        categoryId: catId !== "all" ? catId : undefined,
        status: status !== "all" ? status : undefined,
      })
      setProducts(result.items)
      setTotalPages(result.totalPages)
      setTotalCount(result.totalCount)
      setPage(result.page)
    } catch (error) {
      console.error("Error loading products:", error)
      toast.error("Error al cargar productos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch con debounce para busqueda
  useEffect(() => {
    setSelectedIds(new Set())
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProducts(1, searchTerm, selectedCategory, selectedStatus)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchTerm, selectedCategory, selectedStatus, fetchProducts])

  const handlePageChange = (newPage: number) => {
    setSelectedIds(new Set())
    fetchProducts(newPage, searchTerm, selectedCategory, selectedStatus)
  }

  const toggleSelection = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setIsBulkDeleting(true)
    try {
      const result = await apiClient.deleteProductsBulk(ids)
      fetchProducts(page, searchTerm, selectedCategory, selectedStatus)
      setSelectedIds(new Set())
      setIsBulkDeleteDialogOpen(false)

      if (result.failed > 0) {
        toast.warning(
          `Eliminados ${result.deleted} producto(s). ${result.failed} no se pudieron eliminar.`,
          { description: result.errors.slice(0, 2).join("; ") }
        )
      } else {
        toast.success(`Eliminados ${result.deleted} producto(s) correctamente`)
      }
    } catch (error) {
      console.error("Error bulk deleting products:", error)
      toast.error("Error al eliminar los productos")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Disponible": case "active": return "bg-green-100 text-green-800"
      case "Agotado": case "out_of_stock": return "bg-red-100 text-red-800"
      case "Descontinuado": case "inactive": return "bg-gray-100 text-gray-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const handleDeleteProduct = (product: ProductListItemDto) => {
    setSelectedProduct(productListItemDtoToProduct(product))
    setSelectedBackendId(product.id)
    setShowDeleteDialog(true)
  }

  const handleEditProduct = (product: ProductListItemDto) => {
    setSelectedProduct(productListItemDtoToProduct(product))
    setSelectedBackendId(product.id)
    setShowEditDialog(true)
  }

  const confirmDelete = async () => {
    if (selectedBackendId) {
      try {
        await apiClient.deleteProduct(selectedBackendId)
        fetchProducts(page, searchTerm, selectedCategory, selectedStatus)
        toast.success("Producto eliminado correctamente")
      } catch (error) {
        console.error("Error deleting product:", error)
        toast.error("Error al eliminar el producto")
      }
    }
    setShowDeleteDialog(false)
    setSelectedProduct(null)
    setSelectedBackendId(null)
  }

  const handleProductSaved = async () => {
    fetchProducts(page, searchTerm, selectedCategory, selectedStatus)
    setShowProductWizard(false)
    setShowEditDialog(false)
  }

  const handleNewProduct = async () => {
    try {
      const cats = await getCategories()
      if (cats.length === 0) {
        toast.error("No hay categorías disponibles", {
          description: "Debes crear al menos una categoría antes de crear un producto.",
          duration: 5000,
        })
        return
      }
      setShowProductWizard(true)
    } catch (error) {
      console.error("Error checking categories:", error)
      toast.error("Error al verificar categorías", {
        description: "No se pudo verificar si hay categorías disponibles.",
        duration: 5000,
      })
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="w-full">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Inventario</span>
              <span>/</span>
              <span>Productos</span>
            </nav>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-start gap-4">
                <Button variant="ghost" onClick={() => router.back()} className="w-full sm:w-auto shrink-0">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Productos</h1>
                    <p className="text-muted-foreground">
                      Gestiona tu inventario de productos
                      {totalCount > 0 && <span className="ml-1">({totalCount})</span>}
                    </p>
                  </div>
              </div>
              <PermissionGuard permission="products.create">
                <div className="flex flex-wrap gap-2 justify-start">
                <Button onClick={handleNewProduct} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Producto
                </Button>
                <Button variant="outline" onClick={() => setShowImportDialog(true)} className="w-full sm:w-auto">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Importar Excel
                </Button>
                <Button variant="outline" onClick={() => setShowDownloadDialog(true)} className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Formato
                </Button>
                </div>
              </PermissionGuard>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, SKU o categoría..."
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
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
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
            <div className="flex-1 min-w-0 text-left flex items-center gap-3">
                  {products.length > 0 && (
                    <PermissionGuard permission="products.delete">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-products"
                          checked={selectedIds.size === products.length && products.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                        <label htmlFor="select-all-products" className="text-sm text-muted-foreground cursor-pointer">
                          Seleccionar página a Eliminar
                        </label>
                      </div>
                    </PermissionGuard>
                  )}
                  
                </div>
          </div>

          {selectedIds.size > 0 && (
            <PermissionGuard permission="products.delete">
              <div className="flex items-center gap-3 p-3 mb-6 rounded-lg bg-muted/50 border">
                <span className="text-sm font-medium">
                  {selectedIds.size} producto(s) seleccionado(s)
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar seleccionados
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

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Cargando productos...</span>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.length === 0 ? (
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
                  products.map((product) => (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-center space-x-3">
                            <PermissionGuard permission="products.delete">
                              <Checkbox
                                checked={selectedIds.has(product.id)}
                                onCheckedChange={() => toggleSelection(product.id)}
                              />
                            </PermissionGuard>
                            <Package className="w-5 h-5 text-primary" />
                            <div>
                              <CardTitle className="text-lg">{product.name}</CardTitle>
                              <CardDescription>SKU: {product.sku}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(product.status)}>{product.status}</Badge>
                            <div className="flex space-x-1">
                              <PermissionGuard permission="products.update">
                                <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </PermissionGuard>
                              <PermissionGuard permission="products.delete">
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </PermissionGuard>
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
                            <ProductPrice price={product.price} currency={product.priceCurrency as Currency | undefined} />
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

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
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
      <ImportProductsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={handleProductSaved}
      />
      <DownloadFormatDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
      />
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        count={selectedIds.size}
        entityLabel="productos"
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isBulkDeleting}
      />
    </div>
  )
}
