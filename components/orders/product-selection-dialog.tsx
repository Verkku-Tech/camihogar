"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus } from "lucide-react"
import { getProducts, type OrderProduct, type Product } from "@/lib/storage"
import { ProductEditDialog } from "@/components/orders/product-edit-dialog"

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
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<OrderProduct | null>(null)

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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar Productos</DialogTitle>
          </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-x-auto">
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
                {filteredProducts.map((product) => (
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
                        value={quantities[product.id.toString()] || 1}
                        onChange={(e) =>
                          handleQuantityChange(
                            product.id.toString(),
                            Number.parseInt(e.target.value) || 1,
                          )
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      {isProductSelected(product.id.toString()) && (
                        <Badge className="bg-green-100 text-green-800">
                          {getSelectedQuantity(product.id.toString())} unidades
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAddProduct(product)}
                        variant={isProductSelected(product.id.toString()) ? "outline" : "default"}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {isProductSelected(product.id.toString()) ? "Actualizar" : "Agregar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {products.length === 0 ? "No hay productos en inventario" : "No se encontraron productos"}
            </div>
          )}

          {selectedProducts.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Productos seleccionados: {selectedProducts.length}</div>
              <div className="text-lg font-semibold">
                Total: ${selectedProducts.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
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
