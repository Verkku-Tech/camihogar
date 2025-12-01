"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCategories, updateProduct, type Category, type AttributeValue } from "@/lib/storage";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSave?: () => void;
}

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: EditProductDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    status: "",
    stock: "",
    sku: "",
    attributes: {} as Record<string, any>,
  });

  const [categories, setCategories] = useState<Category[]>([]);

  // Cargar categorías reales desde IndexedDB
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const loadedCategories = await getCategories();
        setCategories(loadedCategories);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    loadCategories();
  }, []);

  // Cargar datos del producto cuando se abre el diálogo
  useEffect(() => {
    if (product && open && categories.length > 0) {
      const currentCategory = categories.find((cat) => cat.name === product.category);
      
      // Normalizar atributos usando las claves correctas
      let normalizedAttributes: Record<string, any> = {};
      
      if (currentCategory && product.attributes) {
        // Primero, buscar atributos por id o title
        currentCategory.attributes?.forEach((attr: any) => {
          const attrKey = attr?.id !== undefined ? attr.id.toString() : attr.title ?? "";
          if (!attrKey) return;

          const value =
            product.attributes?.[attrKey] ??
            (attr.title ? product.attributes?.[attr.title] : undefined);

          if (value !== undefined) {
            normalizedAttributes[attrKey] = value;
          }
        });

        // Agregar cualquier atributo que no esté en la categoría
        Object.entries(product.attributes || {}).forEach(([key, value]) => {
          if (normalizedAttributes[key] === undefined) {
            normalizedAttributes[key] = value;
          }
        });
      } else {
        normalizedAttributes = product.attributes || {};
      }

      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price && product.price !== 0 ? product.price.toString() : "",
        category: product.category || "",
        status: product.status || "",
        stock: product.stock && product.stock !== 0 ? product.stock.toString() : "",
        sku: product.sku || "",
        attributes: normalizedAttributes,
      });
    } else if (product && open) {
      // Si no hay categorías cargadas aún, usar atributos directos
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price && product.price !== 0 ? product.price.toString() : "",
        category: product.category || "",
        status: product.status || "",
        stock: product.stock && product.stock !== 0 ? product.stock.toString() : "",
        sku: product.sku || "",
        attributes: product.attributes || {},
      });
    }
  }, [product, open, categories]);

  const selectedCategory = categories.find(
    (cat) => cat.name === formData.category
  );

  // Helper functions para manejar AttributeValue
  const getValueString = (value: string | AttributeValue): string => {
    return typeof value === "string" ? value : value.id || value.label;
  };

  const getValueLabel = (value: string | AttributeValue): string => {
    return typeof value === "string" ? value : value.label || value.id;
  };

  const handleSave = async () => {
    if (!product?.id) {
      console.error("Product ID is required");
      return;
    }

    try {
      // Convertir strings vacíos a números o 0
      const price = formData.price === "" ? 0 : parseFloat(formData.price);
      const stock = formData.stock === "" ? 0 : parseInt(formData.stock);

      await updateProduct(product.id, {
        name: formData.name,
        price: price,
        stock: stock,
        category: formData.category,
        status: formData.status,
        sku: formData.sku,
        attributes: formData.attributes,
      });

      // Llamar callback para refrescar la lista
      if (onSave) {
        onSave();
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto");
    }
  };

  const handleAttributeChange = (attributeKey: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attributeKey]: value,
      },
    }));
  };

  if (!product) return null;

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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ej: Cama King Size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  placeholder="Ej: CAMA001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stock: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
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
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
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
          {selectedCategory && selectedCategory.attributes && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Atributos de {selectedCategory.name}
              </h3>
              {selectedCategory.attributes.map((attribute) => {
                const attrKey = attribute.id?.toString() || attribute.title;
                const currentValue = formData.attributes[attrKey] || formData.attributes[attribute.title] || "";

                return (
                  <div key={attribute.id || attribute.title} className="space-y-2">
                    <Label>{attribute.title}</Label>
                    <p className="text-sm text-muted-foreground">
                      {attribute.description}
                    </p>

                    {(attribute.valueType === "Select" || attribute.valueType === "select") && (
                      <Select
                        value={typeof currentValue === "string" ? currentValue : getValueString(currentValue)}
                        onValueChange={(value) => handleAttributeChange(attrKey, value)}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={`Seleccionar ${attribute.title.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {attribute.values && attribute.values.length > 0 ? (
                            attribute.values.map((value) => {
                              const valueStr = getValueString(value);
                              const valueLabel = getValueLabel(value);
                              return (
                                <SelectItem key={valueStr} value={valueStr}>
                                  {valueLabel}
                                </SelectItem>
                              );
                            })
                          ) : (
                            <SelectItem value="" disabled>
                              No hay valores disponibles
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {(attribute.valueType === "Number" || attribute.valueType === "number") && (
                      <Input
                        type="number"
                        value={currentValue === "" ? "" : currentValue.toString()}
                        onChange={(e) =>
                          handleAttributeChange(
                            attrKey,
                            e.target.value === "" ? "" : parseFloat(e.target.value)
                          )
                        }
                        placeholder="0"
                      />
                    )}

                    {attribute.valueType === "Product" && (
                      <Input
                        value={typeof currentValue === "string" ? currentValue : getValueString(currentValue)}
                        onChange={(e) => handleAttributeChange(attrKey, e.target.value)}
                        placeholder={`Ingrese ${attribute.title.toLowerCase()}`}
                      />
                    )}

                    {attribute.valueType === "Multiple select" && (
                      <div className="space-y-2">
                        {attribute.values.map((value) => {
                          const valueStr = getValueString(value);
                          const valueLabel = getValueLabel(value);
                          const isSelected = Array.isArray(currentValue)
                            ? currentValue.includes(valueStr)
                            : false;

                          return (
                            <label key={valueStr} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentArray = Array.isArray(currentValue) ? currentValue : [];
                                  if (e.target.checked) {
                                    handleAttributeChange(attrKey, [...currentArray, valueStr]);
                                  } else {
                                    handleAttributeChange(
                                      attrKey,
                                      currentArray.filter((v) => v !== valueStr)
                                    );
                                  }
                                }}
                                className="rounded"
                              />
                              <span>{valueLabel}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
  );
}
