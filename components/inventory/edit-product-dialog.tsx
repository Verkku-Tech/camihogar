"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EditProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: any
}

export function EditProductDialog({ open, onOpenChange, product }: EditProductDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    status: "",
    stock: "",
    sku: "",
    attributes: {} as Record<string, any>,
  })

  // Mock categories with attributes (same as in wizard)
  const categories = [
    {
      id: 1,
      name: "Camas",
      attributes: [
        {
          id: 1,
          title: "Madera",
          description: "Tipo de madera utilizada",
          valueType: "select",
          values: ["Roble", "Pino", "Cedro", "Caoba", "Nogal"],
        },
        {
          id: 2,
          title: "Tela",
          description: "Tipo de tela del tapizado",
          valueType: "select",
          values: ["Algodón", "Lino", "Terciopelo", "Cuero", "Microfibra"],
        },
        {
          id: 3,
          title: "Pillows",
          description: "Número de almohadas incluidas",
          valueType: "number",
          values: [],
        },
      ],
    },
    {
      id: 2,
      name: "Muebles",
      attributes: [
        {
          id: 1,
          title: "Madera",
          description: "Tipo de madera utilizada",
          valueType: "select",
          values: ["Roble", "Pino", "Cedro", "Caoba", "Nogal"],
        },
        {
          id: 2,
          title: "Tela",
          description: "Tipo de tela del tapizado",
          valueType: "select",
          values: ["Algodón", "Lino", "Terciopelo", "Cuero", "Microfibra"],
        },
        {
          id: 3,
          title: "Modular",
          description: "¿Es un mueble modular?",
          valueType: "select",
          values: ["Sí", "No"],
        },
      ],
    },
  ]

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        category: product.category || "",
        status: product.status || "",
        stock: product.stock?.toString() || "",
        sku: product.sku || "",
        attributes: product.attributes || {},
      })
    }
  }, [product])

  const selectedCategory = categories.find((cat) => cat.name === formData.category)

  const handleSave = () => {
    console.log("[v0] Saving product:", formData)
    onOpenChange(false)
  }

  const handleAttributeChange = (attributeTitle: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attributeTitle]: value,
      },
    }))
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Producto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Cama King Size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder="Ej: CAMA001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción del producto..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponible">Disponible</SelectItem>
                    <SelectItem value="Stock Bajo">Stock Bajo</SelectItem>
                    <SelectItem value="Agotado">Agotado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category Attributes */}
          {selectedCategory && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Atributos de {selectedCategory.name}</h3>
              {selectedCategory.attributes.map((attribute) => (
                <div key={attribute.id} className="space-y-2">
                  <Label>{attribute.title}</Label>
                  <p className="text-sm text-muted-foreground">{attribute.description}</p>

                  {attribute.valueType === "select" && (
                    <Select
                      value={formData.attributes[attribute.title] || ""}
                      onValueChange={(value) => handleAttributeChange(attribute.title, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Seleccionar ${attribute.title.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {attribute.values.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {attribute.valueType === "number" && (
                    <Input
                      type="number"
                      value={formData.attributes[attribute.title] || ""}
                      onChange={(e) => handleAttributeChange(attribute.title, e.target.value)}
                      placeholder="0"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar Cambios</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
