"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Search, Plus, Package, DollarSign, Layers, Filter } from "lucide-react"
import { getProducts, getOrders, getCategories, type OrderProduct, type Product, type Category } from "@/lib/storage"
import { ProductEditDialog } from "@/components/orders/product-edit-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProductSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductsSelect: (products: OrderProduct[]) => void
  selectedProducts: OrderProduct[]
}

export function ProductSelectionDialog({
  open,
  onOpenChange,
  onProductsSelect,
  selectedProducts,
}: ProductSelectionDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productSales, setProductSales] = useState<Record<string, number>>({})
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<OrderProduct | null>(null)

  // Cargar productos y calcular ventas
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar productos y categorías
        const [loadedProducts, loadedCategories, loadedOrders] = await Promise.all([
          getProducts(),
          getCategories(),
          getOrders(),
        ])
        
        setProducts(loadedProducts)
        setCategories(loadedCategories)

        // Calcular ventas por producto (suma de cantidades vendidas en todas las órdenes)
        const sales: Record<string, number> = {}
        loadedOrders.forEach((order) => {
          order.products.forEach((orderProduct) => {
            const productId = orderProduct.id.toString()
            sales[productId] = (sales[productId] || 0) + orderProduct.quantity
          })
        })
        setProductSales(sales)
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }
    loadData()
  }, [])

  // Filtrar y ordenar productos
  const filteredAndSortedProducts = products
    .filter((product) => {
      // Filtro por búsqueda
      const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Filtro por categoría
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      // Ordenar por ventas (mayor a menor)
      const salesA = productSales[a.id.toString()] || 0
      const salesB = productSales[b.id.toString()] || 0
      return salesB - salesA
    })

  const handleQuantityChange = (productId: string, quantity: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(
        0,
        Math.min(
          quantity,
          products.find((p) => p.id.toString() === productId)?.stock || 0,
        ),
      ),
    }))
  }

  const handleAddProduct = (product: Product) => {
    const productKey = product.id.toString()
    const quantity = quantities[productKey] || 1
    const existingProduct = selectedProducts.find((p) => p.id === productKey)
    const cloneAttributes = (attrs?: Record<string, any>) => {
      if (!attrs) return {}
      const cloned: Record<string, any> = {}
      Object.entries(attrs).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          cloned[key] = [...value]
        } else if (value && typeof value === "object") {
          cloned[key] = { ...value }
        } else {
          cloned[key] = value
        }
      })
      return cloned
    }
    const mergedAttributes =
      existingProduct?.attributes !== undefined
        ? cloneAttributes(existingProduct.attributes)
        : cloneAttributes(product.attributes)
    
    // Preparar producto y abrir modal de edición
    const newProduct: OrderProduct = {
      id: productKey,
      name: product.name,
      price: product.price,
      quantity,
      total: product.price * quantity,
      category: product.category,
      stock: product.stock,
      attributes: mergedAttributes,
      discount: existingProduct?.discount ?? 0,
    }
    
    setProductToEdit(newProduct)
    setIsEditDialogOpen(true)
  }

  const handleConfirmAdd = (product: OrderProduct) => {
    const existingProductIndex = selectedProducts.findIndex((p) => p.id === product.id)
    let updatedProducts: OrderProduct[]

    if (existingProductIndex >= 0) {
      updatedProducts = selectedProducts.map((p, index) =>
        index === existingProductIndex ? product : p,
      )
    } else {
      updatedProducts = [...selectedProducts, product]
    }

    onProductsSelect(updatedProducts)
    setIsEditDialogOpen(false)
    setProductToEdit(null)
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }))
  }

  const isProductSelected = (productId: string) => {
    return selectedProducts.some((p) => p.id === productId)
  }

  const getSelectedQuantity = (productId: string) => {
    const selected = selectedProducts.find((p) => p.id === productId)
    return selected?.quantity || 0
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none sm:w-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6 rounded-none sm:rounded-lg m-0 sm:m-4">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl">Seleccionar Productos</DialogTitle>
          </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Filtros: Búsqueda y Categoría */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full pl-10">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Vista de tarjetas para móvil */}
          <div className="space-y-3 sm:hidden">
            {filteredAndSortedProducts.map((product) => {
              const productId = product.id.toString()
              const quantity = quantities[productId] || 1
              const isSelected = isProductSelected(productId)
              const selectedQty = getSelectedQuantity(productId)
              
              return (
                <Card key={product.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-base mb-1">{product.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      </div>
                      {isSelected && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {selectedQty} unidades
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>${product.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>Stock: {product.stock}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`qty-${productId}`} className="text-sm">
                        Cantidad
                      </Label>
                      <Input
                        id={`qty-${productId}`}
                        type="number"
                        min="1"
                        max={product.stock}
                        value={quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            productId,
                            Number.parseInt(e.target.value) || 1,
                          )
                        }
                        className="w-full"
                      />
                    </div>

                    <Button
                      onClick={() => handleAddProduct(product)}
                      variant={isSelected ? "outline" : "default"}
                      className="w-full"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isSelected ? "Actualizar" : "Agregar"}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Vista de tabla para desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Seleccionado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedProducts.map((product) => {
                  const productId = product.id.toString()
                  const isSelected = isProductSelected(productId)
                  const selectedQty = getSelectedQuantity(productId)
                  
                  return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>${product.price.toFixed(2)}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max={product.stock}
                          value={quantities[productId] || 1}
                        onChange={(e) =>
                          handleQuantityChange(
                              productId,
                            Number.parseInt(e.target.value) || 1,
                          )
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                        {isSelected && (
                        <Badge className="bg-green-100 text-green-800">
                            {selectedQty} unidades
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAddProduct(product)}
                          variant={isSelected ? "outline" : "default"}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                          {isSelected ? "Actualizar" : "Agregar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedProducts.length === 0 && (
            <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
              {products.length === 0 ? "No hay productos en inventario" : "No se encontraron productos"}
            </div>
          )}

          {selectedProducts.length > 0 && (
            <div className="p-3 sm:p-4 bg-muted rounded-lg">
              <div className="text-xs sm:text-sm font-medium mb-2">
                Productos seleccionados: {selectedProducts.length}
              </div>
              <div className="text-base sm:text-lg font-semibold">
                Total: ${selectedProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>

          <div className="flex justify-end pt-3 sm:pt-4 border-t">
            <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProductEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        product={productToEdit}
        onProductUpdate={handleConfirmAdd}
        mode="add"
      />
    </>
  )
}
