"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, Package, StoreIcon, Tag } from "lucide-react"
import { getCategories, addProduct, getProducts, type Category, type AttributeValue } from "@/lib/storage"

interface ProductWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductCreated?: () => void
}

interface ProductFormData {
  name: string
  sku: string
  description: string
  price: string
  category: string
  status: string
  stockByStore: { [storeId: string]: number }
  attributes: { [attributeId: string]: any }
}

interface CategoryAttribute {
  id: string
  title: string
  description: string
  valueType: "Product" | "Number" | "Select" | "Multiple select"
  values: string[] | AttributeValue[]
  required?: boolean
}

// Helper functions to normalize attribute values
const getValueString = (value: string | AttributeValue): string => {
  return typeof value === 'string' ? value : value.id || value.label
}

const getValueLabel = (value: string | AttributeValue): string => {
  return typeof value === 'string' ? value : value.label || value.id
}

export function ProductWizardDialog({ open, onOpenChange, onProductCreated }: ProductWizardDialogProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    sku: "",
    description: "",
    price: "",
    category: "",
    status: "Disponible",
    stockByStore: {},
    attributes: {},
  })

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

  // Generar SKU automático cuando se abre el diálogo
  useEffect(() => {
    const generateSKU = async () => {
      try {
        const products = await getProducts()
        const nextNumber = products.length + 1
        const sku = `PROD-${String(nextNumber).padStart(4, "0")}`
        setFormData((prev) => ({ ...prev, sku }))
      } catch (error) {
        console.error("Error generating SKU:", error)
      }
    }

    if (open) {
      generateSKU()
    }
  }, [open])

  const stores = [
    { id: "1", name: "Tienda Principal" },
    { id: "2", name: "Sucursal Norte" },
    { id: "3", name: "Sucursal Sur" },
  ]

  const selectedCategory = categories.find((cat) => cat.id.toString() === formData.category)

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleStockChange = (storeId: string, stock: number) => {
    setFormData((prev) => ({
      ...prev,
      stockByStore: { ...prev.stockByStore, [storeId]: stock },
    }))
  }

  const handleAttributeChange = (attributeId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [attributeId]: value },
    }))
  }

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      const totalStock = Object.values(formData.stockByStore).reduce((sum, stock) => sum + stock, 0)
      const categoryName = categories.find((cat) => cat.id.toString() === formData.category)?.name || ""

      // Si el SKU está vacío, generarlo automáticamente
      let skuToUse = formData.sku
      if (!skuToUse || skuToUse.trim() === "") {
        const products = await getProducts()
        const nextNumber = products.length + 1
        skuToUse = `PROD-${String(nextNumber).padStart(4, "0")}`
      }

      await addProduct({
        name: formData.name,
        sku: skuToUse,
        category: categoryName,
        price: Number.parseFloat(formData.price) || 0,
        stock: totalStock,
        status: formData.status,
        attributes: formData.attributes,
      })

      onProductCreated?.()
    } catch (error) {
      console.error("Error saving product:", error)
      alert("Error al guardar el producto")
    }

    onOpenChange(false)
    setCurrentStep(1)
    // Al resetear, generar nuevo SKU para el siguiente producto
    const generateNewSKU = async () => {
      try {
        const products = await getProducts()
        const nextNumber = products.length + 1
        const sku = `PROD-${String(nextNumber).padStart(4, "0")}`
        setFormData({
          name: "",
          sku,
          description: "",
          price: "",
          category: "",
          status: "Disponible",
          stockByStore: {},
          attributes: {},
        })
      } catch (error) {
        console.error("Error generating SKU:", error)
        setFormData({
          name: "",
          sku: "",
          description: "",
          price: "",
          category: "",
          status: "Disponible",
          stockByStore: {},
          attributes: {},
        })
      }
    }
    generateNewSKU()
  }

  const renderAttributeInput = (attribute: CategoryAttribute) => {
    const value = formData.attributes[attribute.id]

    switch (attribute.valueType) {
      case "Number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => handleAttributeChange(attribute.id, e.target.value)}
            placeholder="Ingrese un número"
          />
        )

      case "Select":
        return (
          <Select value={value || ""} onValueChange={(val) => handleAttributeChange(attribute.id, val)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent>
              {attribute.values.map((option) => {
                const optionValue = getValueString(option)
                const optionLabel = getValueLabel(option)
                return (
                  <SelectItem key={optionValue} value={optionValue}>
                    {optionLabel}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )

      case "Multiple select":
        const selectedValues = value || []
        return (
          <div className="space-y-2">
            <Select
              onValueChange={(val) => {
                if (!selectedValues.includes(val)) {
                  handleAttributeChange(attribute.id, [...selectedValues, val])
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione opciones" />
              </SelectTrigger>
              <SelectContent>
                {attribute.values
                  .map(getValueString)
                  .filter((optionValue) => !selectedValues.includes(optionValue))
                  .map((optionValue) => {
                    const option = attribute.values.find(v => getValueString(v) === optionValue)
                    const optionLabel = option ? getValueLabel(option) : optionValue
                    return (
                      <SelectItem key={optionValue} value={optionValue}>
                        {optionLabel}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((val: string) => {
                  const option = attribute.values.find(v => getValueString(v) === val)
                  const displayLabel = option ? getValueLabel(option) : val
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        handleAttributeChange(
                          attribute.id,
                          selectedValues.filter((v: string) => v !== val),
                        )
                      }}
                    >
                      {displayLabel} ×
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )

      case "Product":
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleAttributeChange(attribute.id, e.target.value)}
            placeholder="Ingrese el valor del producto"
          />
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Nuevo Producto - Paso {currentStep} de 2
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <div
              className={`flex items-center space-x-2 ${currentStep >= 1 ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                1
              </div>
              <span className="text-sm font-medium">Información Básica</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div
              className={`flex items-center space-x-2 ${currentStep >= 2 ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                2
              </div>
              <span className="text-sm font-medium">Atributos</span>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Producto *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Ej: iPhone 14 Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    placeholder="Se generará automáticamente"
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    El código del producto se genera automáticamente
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Descripción del producto..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No hay categorías disponibles
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponible">Disponible</SelectItem>
                    <SelectItem value="Stock Bajo">Stock Bajo</SelectItem>
                    <SelectItem value="Agotado">Agotado</SelectItem>
                    <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <StoreIcon className="w-4 h-4" />
                    Stock por Tienda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stores.map((store) => (
                    <div key={store.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <Label htmlFor={`stock-${store.id}`}>{store.name}</Label>
                      <Input
                        id={`stock-${store.id}`}
                        type="number"
                        min="0"
                        value={formData.stockByStore[store.id] || ""}
                        onChange={(e) => handleStockChange(store.id, Number.parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {selectedCategory ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-4 h-4" />
                    <h3 className="text-lg font-semibold">Atributos de {selectedCategory.name}</h3>
                  </div>

                  {selectedCategory.attributes.length > 0 ? (
                    <div className="space-y-4">
                      {selectedCategory.attributes.map((attribute) => (
                        <div key={attribute.id} className="space-y-2">
                          <Label htmlFor={`attr-${attribute.id}`}>{attribute.title}</Label>
                          <p className="text-sm text-muted-foreground">{attribute.description}</p>
                          {renderAttributeInput({
                            id: attribute.id.toString(),
                            title: attribute.title,
                            description: attribute.description,
                            valueType: attribute.valueType as "Product" | "Number" | "Select" | "Multiple select",
                            values: attribute.values,
                          })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Esta categoría no tiene atributos configurados.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Seleccione una categoría en el paso anterior para ver los atributos.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            {currentStep < 2 ? (
              <Button
                onClick={handleNext}
                disabled={!formData.name || !formData.price || !formData.category}
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>Crear Producto</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
