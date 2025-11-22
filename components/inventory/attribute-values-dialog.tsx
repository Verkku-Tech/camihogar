"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, X, Edit2, Check } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AttributeValue {
  id: string
  label: string
  isDefault?: boolean
  priceAdjustment?: number
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
  const [values, setValues] = useState<AttributeValue[]>([])
  const [maxSelections, setMaxSelections] = useState<string>("1")
  const [newValue, setNewValue] = useState({
    label: "",
    isDefault: false,
    priceAdjustment: "",
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const convertedValues = attribute.values.map((val) => {
      if (typeof val === "string") {
        return { id: Date.now().toString() + Math.random(), label: val, isDefault: false, priceAdjustment: 0 }
      }
      return val
    })
    setValues(convertedValues)
    setMaxSelections(attribute.maxSelections ? attribute.maxSelections.toString() : "1")
  }, [attribute])

  const handleAddValue = () => {
    if (!newValue.label.trim()) return

    const value: AttributeValue = {
      id: Date.now().toString() + Math.random(),
      label: newValue.label.trim(),
      isDefault: newValue.isDefault,
      priceAdjustment: newValue.priceAdjustment === "" ? 0 : parseFloat(newValue.priceAdjustment),
    }

    setValues([...values, value])
    setNewValue({ label: "", isDefault: false, priceAdjustment: "" })
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
    onSave(
      values,
      attribute.valueType === "Multiple select" ? parseInt(maxSelections) : undefined
    )
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
              <Input
                id="newValue"
                value={newValue.label}
                onChange={(e) => setNewValue({ ...newValue, label: e.target.value })}
                placeholder={getPlaceholder()}
                onKeyPress={(e) => e.key === "Enter" && handleAddValue()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceAdjustment">Ajuste de Precio ($)</Label>
              <Input
                id="priceAdjustment"
                type="number"
                step="0.01"
                value={newValue.priceAdjustment}
                onChange={(e) => setNewValue({ ...newValue, priceAdjustment: e.target.value })}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">Positivo aumenta, negativo disminuye</p>
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
                      <TableHead>Por Defecto</TableHead>
                      <TableHead>Ajuste de Precio</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((value) => (
                      <TableRow key={value.id}>
                        <TableCell className="font-medium">{value.label}</TableCell>
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
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                <Check className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span
                                className={value.priceAdjustment && value.priceAdjustment !== 0 ? "font-medium" : ""}
                              >
                                ${(value.priceAdjustment || 0).toFixed(2)}
                              </span>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(value.id)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveValue(value.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
