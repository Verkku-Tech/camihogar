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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCategories,
  type AttributeValue,
  type OrderProduct,
} from "@/lib/storage";

interface ProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: OrderProduct | null;
  onProductUpdate: (product: OrderProduct) => void;
}

// Helper functions to normalize attribute values
const getValueString = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.id || value.label;
};

const getValueLabel = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.label || value.id;
};

export function ProductEditDialog({
  open,
  onOpenChange,
  product,
  onProductUpdate,
}: ProductEditDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [attributes, setAttributes] = useState<Record<string, string | number>>(
    {}
  );
  const [categories, setCategories] = useState<any[]>([]);

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

  useEffect(() => {
    if (product) {
      setQuantity(product.quantity);
      setAttributes(product.attributes || {});
    }
  }, [product]);

  if (!product) return null;

  const currentCategory = categories.find(
    (cat) => cat.name === product.category
  );
  const categoryAttrs = currentCategory?.attributes || [];

  const handleAttributeChange = (attrName: string, value: string | number) => {
    setAttributes((prev) => ({
      ...prev,
      [attrName]: value,
    }));
  };

  const handleSave = () => {
    // Asegurar que stock tenga un valor por defecto si no está presente
    const updatedProduct: OrderProduct = {
      ...product,
      quantity,
      total: product.price * quantity,
      attributes,
      stock: product.stock ?? 0, // Usar 0 como valor por defecto si stock no existe
    };
    onProductUpdate(updatedProduct);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium">{product.name}</h3>
            <p className="text-sm text-muted-foreground">
              Categoría: {product.category}
            </p>
            <p className="text-sm text-muted-foreground">
              Precio: ${product.price.toFixed(2)}
            </p>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(Number.parseInt(e.target.value) || 1)
              }
            />
          </div>

          {/* Category Attributes */}
          {categoryAttrs.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Atributos Personalizados
              </Label>
              {categoryAttrs.map((attr: any) => (
                <div key={attr.id} className="space-y-2">
                  <Label htmlFor={attr.id}>{attr.title}</Label>
                  {attr.valueType === "Select" ? (
                    <Select
                      value={attributes[attr.title]?.toString() || ""}
                      onValueChange={(value) =>
                        handleAttributeChange(attr.title, value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={`Seleccionar ${
                            attr.title ? attr.title.toLowerCase() : "atributo"
                          }`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {attr.values?.map((value: string | AttributeValue) => {
                          const optionValue = getValueString(value);
                          const optionLabel = getValueLabel(value);
                          return (
                            <SelectItem key={optionValue} value={optionValue}>
                              {optionLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={attr.id}
                      type="number"
                      min="0"
                      value={attributes[attr.title] || ""}
                      onChange={(e) =>
                        handleAttributeChange(
                          attr.title,
                          Number.parseInt(e.target.value) || 0
                        )
                      }
                      placeholder={`Ingrese ${
                        attr.title ? attr.title.toLowerCase() : "valor"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total:</span>
              <span className="text-lg font-semibold">
                ${(product.price * quantity).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
