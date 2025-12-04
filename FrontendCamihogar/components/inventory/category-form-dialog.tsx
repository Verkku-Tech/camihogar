"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Settings } from "lucide-react"
import { AttributeValuesDialog } from "./attribute-values-dialog"
import { useCurrency } from "@/contexts/currency-context"

interface AttributeValue {
  id: string
  value: string
}

interface Attribute {
  id: string
  title: string
  description: string
  valueType: "Product" | "Number" | "Select" | "Multiple select"
  values: string[] | AttributeValue[]
  maxSelections?: number
}

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: any
  onSave: (category: any) => void
}

export function CategoryFormDialog({ open, onOpenChange, category, onSave }: CategoryFormDialogProps) {
  const { preferredCurrency } = useCurrency()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxDiscount: "",
    maxDiscountCurrency: preferredCurrency as "Bs" | "USD" | "EUR",
  })
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [newAttribute, setNewAttribute] = useState({
    title: "",
    description: "",
    valueType: "Product" as const,
  })
  const [showAttributeValues, setShowAttributeValues] = useState<string | null>(null)

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        description: category.description || "",
        maxDiscount: category.maxDiscount && category.maxDiscount !== 0 ? category.maxDiscount.toString() : "",
        maxDiscountCurrency: category.maxDiscountCurrency || preferredCurrency,
      })
      // Asegurar que los atributos se carguen con todos sus campos, incluyendo maxSelections
      const loadedAttributes = (category.attributes || []).map((attr: Attribute) => ({
        ...attr,
        maxSelections: attr.maxSelections !== undefined ? attr.maxSelections : undefined
      }))
      setAttributes(loadedAttributes)
    } else {
      setFormData({ name: "", description: "", maxDiscount: "", maxDiscountCurrency: preferredCurrency })
      setAttributes([])
    }
  }, [category, preferredCurrency])

  const handleAddAttribute = () => {
    if (!newAttribute.title.trim()) return

    const attribute: Attribute = {
      id: Date.now().toString(),
      title: newAttribute.title,
      description: newAttribute.description,
      valueType: newAttribute.valueType,
      values: [],
    }

    setAttributes([...attributes, attribute])
    setNewAttribute({ title: "", description: "", valueType: "Product" })
  }

  const handleRemoveAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id))
  }

  const handleUpdateAttributeValues = (attributeId: string, values: any[], maxSelections?: number) => {
    setAttributes(attributes.map((attr) => (attr.id === attributeId ? { ...attr, values, maxSelections } : attr)))
  }

  const handleSave = () => {
    const categoryData = {
      ...formData,
      maxDiscount: formData.maxDiscount === "" ? 0 : parseFloat(formData.maxDiscount),
      maxDiscountCurrency: formData.maxDiscountCurrency || preferredCurrency,
      attributes,
    }
    onSave(categoryData)
  }

  const getValueTypeLabel = (type: string) => {
    switch (type) {
      case "Product":
        return "Producto"
      case "Number":
        return "Número"
      case "Select":
        return "Selección"
      case "Multiple select":
        return "Selección múltiple"
      default:
        return type
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{category ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nombre de la categoría"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDiscount">Descuento Máximo Neto *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="maxDiscount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.maxDiscount}
                        onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                        placeholder="0.00"
                        className="flex-1"
                      />
                      <Select
                        value={formData.maxDiscountCurrency || preferredCurrency}
                        onValueChange={(value: "Bs" | "USD" | "EUR") =>
                          setFormData({ ...formData, maxDiscountCurrency: value })
                        }
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
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción de la categoría"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Attributes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Atributos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Attribute */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="attrTitle">Título del Atributo</Label>
                    <Input
                      id="attrTitle"
                      value={newAttribute.title}
                      onChange={(e) => setNewAttribute({ ...newAttribute, title: e.target.value })}
                      placeholder="Ej: Color, Talla, Marca"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attrDescription">Descripción</Label>
                    <Input
                      id="attrDescription"
                      value={newAttribute.description}
                      onChange={(e) => setNewAttribute({ ...newAttribute, description: e.target.value })}
                      placeholder="Descripción del atributo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attrType">Tipo de Valor</Label>
                    <Select
                      value={newAttribute.valueType}
                      onValueChange={(value: any) => setNewAttribute({ ...newAttribute, valueType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Product">Producto</SelectItem>
                        <SelectItem value="Number">Número</SelectItem>
                        <SelectItem value="Select">Selección</SelectItem>
                        <SelectItem value="Multiple select">Selección múltiple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddAttribute} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar
                    </Button>
                  </div>
                </div>

                {/* Attributes Table */}
                {attributes.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Valores</TableHead>
                          <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attributes.map((attribute) => (
                          <TableRow key={attribute.id}>
                            <TableCell className="font-medium">{attribute.title}</TableCell>
                            <TableCell>{attribute.description}</TableCell>
                            <TableCell>{getValueTypeLabel(attribute.valueType)}</TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{attribute.values.length} valor(es)</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button variant="ghost" size="sm" onClick={() => setShowAttributeValues(attribute.id)}>
                                  <Settings className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveAttribute(attribute.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{category ? "Actualizar" : "Crear"} Categoría</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attribute Values Dialog */}
      {showAttributeValues && (
        <AttributeValuesDialog
          open={!!showAttributeValues}
          onOpenChange={() => setShowAttributeValues(null)}
          attribute={attributes.find((attr) => attr.id === showAttributeValues)! as any}
          onSave={(values, maxSelections) => {
            handleUpdateAttributeValues(showAttributeValues, values, maxSelections)
            setShowAttributeValues(null)
          }}
        />
      )}
    </>
  )
}
