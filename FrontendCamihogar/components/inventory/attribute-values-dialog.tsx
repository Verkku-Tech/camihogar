"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X, Edit2, Check, Package } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductSearchCombobox } from "@/components/inventory/product-search-combobox"
import { getProducts, type Product } from "@/lib/storage"
import { toast } from "sonner"
import type { Currency } from "@/lib/currency-utils"
import { formatCurrency } from "@/lib/currency-utils"
import { useCurrency } from "@/contexts/currency-context"

interface AttributeValue {
  id: string
  label: string
  isDefault?: boolean
  priceAdjustment?: number
  priceAdjustmentCurrency?: Currency
  productId?: number
}

interface Attribute {
  id: string
  title: string
  description: string
  valueType: "Product" | "Number" | "Select" | "Multiple select"
  values: string[] | AttributeValue[]
  maxSelections?: number
}

interface AttributeValuesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attribute: Attribute
  onSave: (values: AttributeValue[], maxSelections?: number) => void
}

export function AttributeValuesDialog({ open, onOpenChange, attribute, onSave }: AttributeValuesDialogProps) {
  const { preferredCurrency } = useCurrency()
  const [values, setValues] = useState<AttributeValue[]>([])
  const [maxSelections, setMaxSelections] = useState<string>("1")
  const [newValue, setNewValue] = useState({
    label: "",
    isDefault: false,
    priceAdjustment: "",
    priceAdjustmentCurrency: preferredCurrency as Currency,
    productId: undefined as number | undefined,
    selectedProduct: null as Product | null,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

  // Cargar productos cuando el tipo es "Product"
  useEffect(() => {
    if (attribute.valueType === "Product" && open) {
      const loadProducts = async () => {
        try {
          const loadedProducts = await getProducts()
          setProducts(loadedProducts)
        } catch (error) {
          console.error("Error loading products:", error)
        }
      }
      loadProducts()
    }
  }, [attribute.valueType, open])

  useEffect(() => {
    const convertedValues = attribute.values.map((val) => {
      if (typeof val === "string") {
        return { id: Date.now().toString() + Math.random(), label: val, isDefault: false, priceAdjustment: 0 }
      }
      return val
    })
    setValues(convertedValues)
    // Solo establecer "1" si maxSelections es undefined y es Multiple select, de lo contrario usar el valor guardado
    if (attribute.valueType === "Multiple select") {
      // Preservar el valor de maxSelections si existe, de lo contrario usar "1" como defecto
      const maxSelectionsValue = attribute.maxSelections !== undefined && attribute.maxSelections !== null
        ? attribute.maxSelections.toString()
        : "1"
      setMaxSelections(maxSelectionsValue)
    } else {
      setMaxSelections("1")
    }
    // Resetear el formulario cuando cambia el atributo
    setNewValue({
      label: "",
      isDefault: false,
      priceAdjustment: "",
      priceAdjustmentCurrency: preferredCurrency,
      productId: undefined,
      selectedProduct: null,
    })
  }, [attribute, preferredCurrency])

  // Manejar selección de producto
  const handleProductSelect = (product: Product | null) => {
    if (product) {
      setNewValue({
        ...newValue,
        label: product.name,
        productId: product.id,
        priceAdjustment: product.price.toString(),
        priceAdjustmentCurrency: product.priceCurrency || "Bs",
        selectedProduct: product,
      })
    } else {
      setNewValue({
        ...newValue,
        label: "",
        productId: undefined,
        priceAdjustment: "",
        priceAdjustmentCurrency: preferredCurrency,
        selectedProduct: null,
      })
    }
  }

  const handleAddValue = () => {
    if (!newValue.label.trim()) {
      toast.error("Por favor selecciona o ingresa un valor")
      return
    }

    // Validar que no se duplique el producto si el tipo es "Product"
    if (attribute.valueType === "Product" && newValue.productId) {
      const productExists = values.some((v) => v.productId === newValue.productId)
      if (productExists) {
        toast.error("Este producto ya ha sido agregado")
        return
      }
    } else {
      // Para otros tipos, validar que no se duplique el label
      const labelExists = values.some((v) => v.label.toLowerCase() === newValue.label.trim().toLowerCase())
      if (labelExists) {
        toast.error("Este valor ya ha sido agregado")
        return
      }
    }

    const value: AttributeValue = {
      id: Date.now().toString() + Math.random(),
      label: newValue.label.trim(),
      isDefault: newValue.isDefault,
      priceAdjustment: newValue.priceAdjustment === "" ? 0 : parseFloat(newValue.priceAdjustment),
      priceAdjustmentCurrency: newValue.priceAdjustmentCurrency || "Bs",
      productId: newValue.productId,
    }

    setValues([...values, value])
    setNewValue({
      label: "",
      isDefault: false,
      priceAdjustment: "",
      priceAdjustmentCurrency: preferredCurrency,
      productId: undefined,
      selectedProduct: null,
    })
  }

  const handleRemoveValue = (id: string) => {
    setValues(values.filter((value) => value.id !== id))
  }

  const handleToggleDefault = (id: string) => {
    setValues(
      values.map((val) => ({
        ...val,
        isDefault: val.id === id ? !val.isDefault : val.isDefault,
      })),
    )
  }

  const handleUpdatePriceAdjustment = (id: string, adjustment: number) => {
    setValues(
      values.map((val) => ({
        ...val,
        priceAdjustment: val.id === id ? adjustment : val.priceAdjustment,
      })),
    )
  }

  const handleSave = () => {
    // Para Multiple select, siempre pasar maxSelections (incluso si es 1 por defecto)
    // Para otros tipos, pasar undefined
    if (attribute.valueType === "Multiple select") {
      const parsedMax = maxSelections && maxSelections.trim() !== "" 
        ? parseInt(maxSelections, 10) 
        : 1
      // Asegurar que sea un número válido
      const maxSelectionsValue = isNaN(parsedMax) || parsedMax < 1 ? 1 : parsedMax
      onSave(values, maxSelectionsValue)
    } else {
      onSave(values, undefined)
    }
  }

  const getPlaceholder = () => {
    switch (attribute.valueType) {
      case "Product":
        return "Ej: iPhone 14, Samsung Galaxy S23"
      case "Number":
        return "Ej: 100, 250, 500"
      case "Select":
      case "Multiple select":
        return "Ej: Rojo, Azul, Verde"
      default:
        return "Ingrese un valor"
    }
  }

  const getValueTypeDescription = () => {
    switch (attribute.valueType) {
      case "Product":
        return "Valores que representan productos específicos"
      case "Number":
        return "Valores numéricos (precios, cantidades, medidas)"
      case "Select":
        return "Opciones de selección única"
      case "Multiple select":
        return "Opciones de selección múltiple"
      default:
        return ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Valores - {attribute.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{attribute.description}</p>
          <p className="text-xs text-muted-foreground">Tipo: {getValueTypeDescription()}</p>
        </DialogHeader>

        <div className="space-y-4">
          {attribute.valueType === "Multiple select" && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <Label htmlFor="maxSelections">Cantidad Máxima de Selecciones</Label>
              <Input
                id="maxSelections"
                type="number"
                min="1"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
                className="mt-2 max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número máximo de opciones que se pueden seleccionar simultáneamente
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="newValue">Valor</Label>
              {attribute.valueType === "Product" ? (
                <ProductSearchCombobox
                  value={newValue.selectedProduct}
                  onSelect={handleProductSelect}
                  placeholder={getPlaceholder()}
                  excludedProductIds={values.filter((v) => v.productId).map((v) => v.productId!)}
                />
              ) : (
                <Input
                  id="newValue"
                  value={newValue.label}
                  onChange={(e) => setNewValue({ ...newValue, label: e.target.value })}
                  placeholder={getPlaceholder()}
                  onKeyPress={(e) => e.key === "Enter" && handleAddValue()}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceAdjustment">Ajuste de Precio</Label>
              <div className="flex gap-2">
                <Input
                  id="priceAdjustment"
                  type="number"
                  step="0.01"
                  value={newValue.priceAdjustment}
                  onChange={(e) => setNewValue({ ...newValue, priceAdjustment: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                  disabled={attribute.valueType === "Product" && !!newValue.selectedProduct}
                />
                <Select
                  value={newValue.priceAdjustmentCurrency || preferredCurrency}
                  onValueChange={(value: Currency) =>
                    setNewValue({ ...newValue, priceAdjustmentCurrency: value })
                  }
                  disabled={attribute.valueType === "Product" && !!newValue.selectedProduct}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bs">Bs.</SelectItem>
                    <SelectItem value="USD">$</SelectItem>
                    <SelectItem value="EUR">€</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {attribute.valueType === "Product" && newValue.selectedProduct
                  ? "Precio del producto (editable después de agregar)"
                  : "Positivo aumenta, negativo disminuye"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Opciones</Label>
              <div className="flex items-center space-x-2 h-10">
                <Checkbox
                  id="isDefault"
                  checked={newValue.isDefault}
                  onCheckedChange={(checked) => setNewValue({ ...newValue, isDefault: checked as boolean })}
                />
                <label htmlFor="isDefault" className="text-sm cursor-pointer">
                  Valor por defecto
                </label>
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddValue} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valores Actuales ({values.length})</Label>
            {values.length === 0 ? (
              <div className="border rounded-lg p-8">
                <p className="text-sm text-muted-foreground text-center">No hay valores agregados aún</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Valor</TableHead>
                      {attribute.valueType === "Product" && <TableHead>Información</TableHead>}
                      <TableHead>Por Defecto</TableHead>
                      <TableHead>Ajuste de Precio</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((value) => {
                      const product = attribute.valueType === "Product" && value.productId
                        ? products.find((p) => p.id === value.productId)
                        : null
                      
                      return (
                        <TableRow key={value.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {attribute.valueType === "Product" && (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                              {value.label}
                            </div>
                          </TableCell>
                          {attribute.valueType === "Product" && (
                            <TableCell>
                              {product ? (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <div>SKU: {product.sku}</div>
                                  <div>Categoría: {product.category}</div>
                                  {product.stock !== undefined && (
                                    <div>Stock: {product.stock}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Checkbox checked={value.isDefault} onCheckedChange={() => handleToggleDefault(value.id)} />
                          </TableCell>
                        <TableCell>
                          {editingId === value.id ? (
                            <div className="flex items-center space-x-2">
                              <Input
                                type="number"
                                step="0.01"
                                defaultValue={value.priceAdjustment && value.priceAdjustment !== 0 ? value.priceAdjustment.toString() : ""}
                                className="w-24"
                                placeholder="0.00"
                                onBlur={(e) => {
                                  handleUpdatePriceAdjustment(value.id, e.target.value === "" ? 0 : parseFloat(e.target.value))
                                  setEditingId(null)
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter") {
                                    handleUpdatePriceAdjustment(value.id, Number(e.currentTarget.value))
                                    setEditingId(null)
                                  }
                                }}
                                autoFocus
                              />
                              <Select
                                value={value.priceAdjustmentCurrency || preferredCurrency}
                                onValueChange={(currency: Currency) => {
                                  setValues(values.map(v => 
                                    v.id === value.id ? { ...v, priceAdjustmentCurrency: currency } : v
                                  ))
                                }}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Bs">Bs.</SelectItem>
                                  <SelectItem value="USD">$</SelectItem>
                                  <SelectItem value="EUR">€</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col space-y-1">
                              {attribute.valueType === "Product" && product && (
                                <div className="text-xs text-muted-foreground">
                                  Base: {formatCurrency(product.price, product.priceCurrency || "Bs")}
                                </div>
                              )}
                              <div className="flex items-center space-x-2">
                                <span
                                  className={value.priceAdjustment && value.priceAdjustment !== 0 ? "font-medium" : ""}
                                >
                                  {value.priceAdjustmentCurrency === "Bs" ? "Bs." : value.priceAdjustmentCurrency === "USD" ? "$" : "€"}
                                  {(value.priceAdjustment || 0).toFixed(2)}
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(value.id)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveValue(value.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar Valores</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
