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
import { Textarea } from "@/components/ui/textarea";
import {
  getCategories,
  type AttributeValue,
  type OrderProduct,
  calculateProductTotalWithAttributes,
  calculateProductUnitPriceWithAttributes,
} from "@/lib/storage";

interface ProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: OrderProduct | null;
  onProductUpdate: (product: OrderProduct) => void;
  mode?: "add" | "edit";
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
  mode = "edit",
}: ProductEditDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [attributes, setAttributes] = useState<Record<string, string | number>>(
    {}
  );
  const [observations, setObservations] = useState("");
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
      setObservations(product.observations || "");
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;

    const currentCategory = categories.find(
      (cat) => cat.name === product.category
    );

    if (!currentCategory) {
      setAttributes(product.attributes || {});
      return;
    }

    const normalizedAttributes: Record<string, string | number> = {};
    currentCategory.attributes?.forEach((attr: any) => {
      const attrKey =
        attr?.id !== undefined ? attr.id.toString() : attr.title ?? "";
      if (!attrKey) return;

      const value =
        product.attributes?.[attrKey] ??
        (attr.title ? product.attributes?.[attr.title] : undefined);

      if (value !== undefined) {
        normalizedAttributes[attrKey] = value;
      }
    });

    Object.entries(product.attributes || {}).forEach(([key, value]) => {
      if (normalizedAttributes[key] === undefined) {
        normalizedAttributes[key] = value;
      }
    });

    setAttributes(normalizedAttributes);
  }, [product, categories]);

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
    // Calcular el total considerando los ajustes de atributos
    const total = calculateProductTotalWithAttributes(
      product.price,
      quantity,
      attributes,
      currentCategory
    );

    // Asegurar que stock tenga un valor por defecto si no está presente
    const updatedProduct: OrderProduct = {
      ...product,
      quantity,
      total,
      attributes,
      stock: product.stock ?? 0, // Usar 0 como valor por defecto si stock no existe
      observations: observations.trim() || undefined,
    };
    onProductUpdate(updatedProduct);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Agregar Producto" : "Editar Producto"}</DialogTitle>
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
              value={quantity === 0 ? "" : quantity}
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
              {categoryAttrs.map((attr: any) => {
                const attrKey =
                  attr?.id !== undefined ? attr.id.toString() : attr.title;
                if (!attrKey) {
                  return null;
                }
                const inputId = `attr-${attrKey}`;
                const attrValue =
                  attributes[attrKey] ??
                  (attr.title ? attributes[attr.title] : undefined);

                // Función helper para obtener el ajuste de precio de un valor
                const getPriceAdjustment = (value: string | AttributeValue): number => {
                  if (typeof value === "object" && "priceAdjustment" in value) {
                    return value.priceAdjustment || 0;
                  }
                  return 0;
                };

                // Obtener el valor seleccionado para mostrar su ajuste
                const selectedValue = attr.values?.find((val) => {
                  const valStr = getValueString(val);
                  return valStr === attrValue?.toString();
                });
                const selectedAdjustment = selectedValue ? getPriceAdjustment(selectedValue) : 0;

                return (
                  <div key={attr.id ?? attr.title} className="space-y-2">
                    <Label htmlFor={inputId}>{attr.title}</Label>
                    {attr.valueType === "Select" ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={
                            attrValue !== undefined ? attrValue.toString() : ""
                          }
                          onValueChange={(value) =>
                            handleAttributeChange(attrKey, value)
                          }
                        >
                          <SelectTrigger className="flex-1">
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
                        {selectedAdjustment !== 0 && (
                          <span
                            className={`text-sm font-medium whitespace-nowrap ${
                              selectedAdjustment > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {selectedAdjustment > 0 ? "+" : ""}
                            ${selectedAdjustment.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Input
                        id={inputId}
                        type="number"
                        min="0"
                        value={attrValue ?? ""}
                        onChange={(e) =>
                          handleAttributeChange(
                            attrKey,
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        placeholder={`Ingrese ${
                          attr.title ? attr.title.toLowerCase() : "valor"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Observaciones del Producto */}
          <div className="space-y-2">
            <Label htmlFor="productObservations">Observaciones</Label>
            <Textarea
              id="productObservations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Agregar observaciones para este producto (opcional)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Notas específicas sobre este producto
            </p>
          </div>

          {/* Total */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            {(() => {
              const unitPrice = calculateProductUnitPriceWithAttributes(
                product.price,
                attributes,
                currentCategory
              );
              const adjustment = unitPrice - product.price;
              const total = calculateProductTotalWithAttributes(
                product.price,
                quantity,
                attributes,
                currentCategory
              );

              return (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total:</span>
                    <span className="text-lg font-semibold">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Precio base:</span>
                      <span>${product.price.toFixed(2)}</span>
                    </div>
                    {adjustment !== 0 && (
                      <div className="flex justify-between">
                        <span>Ajuste de atributos:</span>
                        <span
                          className={
                            adjustment > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {adjustment > 0 ? "+" : ""}
                          ${adjustment.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t border-border">
                      <span>Precio unitario:</span>
                      <span>${unitPrice.toFixed(2)}</span>
                    </div>
                    {quantity > 1 && (
                      <div className="flex justify-between text-xs pt-1">
                        <span>Cantidad:</span>
                        <span>{quantity} × ${unitPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {mode === "add" ? "Agregar" : "Guardar Cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
