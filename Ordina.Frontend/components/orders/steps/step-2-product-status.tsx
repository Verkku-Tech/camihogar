"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import type { UseOrderFormReturn } from "../hooks/use-order-form";
import type { AttributeValue } from "@/lib/storage";

interface Step2ProductStatusProps {
  orderForm: UseOrderFormReturn;
}

export function Step2ProductStatus({ orderForm }: Step2ProductStatusProps) {
  // Función helper para obtener el label de un valor de atributo
  const getValueLabel = (value: string | AttributeValue): string => {
    if (typeof value === "string") return value;
    return value.label || value.id || String(value);
  };

  // Función para procesar y obtener el label del valor de un atributo
  // includeNameForNumeric: si es true, para atributos numéricos incluye el nombre del atributo
  const getAttributeValueLabel = (
    selectedValue: any,
    categoryAttribute: { valueType?: string; values?: (string | AttributeValue)[]; title?: string } | undefined,
    includeNameForNumeric: boolean = true
  ): string => {
    if (!categoryAttribute) {
      return String(selectedValue);
    }

    // Si es un atributo numérico, mostrar nombre + valor (ej: "Patas 3")
    if (categoryAttribute.valueType === "Number") {
      const numValue = selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
        ? selectedValue.toString()
        : "";
      if (!numValue) return "";
      // Para concatenación, incluir el nombre del atributo
      if (includeNameForNumeric && categoryAttribute.title) {
        return `${categoryAttribute.title} ${numValue}`;
      }
      return numValue;
    }

    // Si no tiene values, mostrar el valor tal cual
    if (!categoryAttribute.values || categoryAttribute.values.length === 0) {
      return String(selectedValue);
    }

    // Buscar el valor en los values del atributo
    if (Array.isArray(selectedValue)) {
      const labels: string[] = [];
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values!.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") {
              return val === valStr;
            }
            return val.id === valStr || val.label === valStr;
          }
        );
        if (attributeValue) {
          labels.push(getValueLabel(attributeValue));
        } else {
          labels.push(String(valStr));
        }
      });
      return labels.join(", ");
    } else {
      const selectedValueStr = selectedValue?.toString();
      if (selectedValueStr) {
        const attributeValue = categoryAttribute.values.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") {
              return val === selectedValueStr;
            }
            return val.id === selectedValueStr || val.label === selectedValueStr;
          }
        );
        if (attributeValue) {
          return getValueLabel(attributeValue);
        }
      }
      return String(selectedValue);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Estado de Productos</CardTitle>
          <CardDescription>
            Indica si cada producto está en tienda o debe mandarse a fabricar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="space-y-6">
            {orderForm.selectedProducts.map((product) => {
              const category = orderForm.categories.find((c) => c.name === product.category);

              return (
                <div key={product.id} className="border rounded-lg p-4 space-y-4">
                  {/* Header del producto con select */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold">{product.name}</h3>
                      </div>
                      <Badge variant="outline">{product.category}</Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cantidad: {product.quantity}
                      </p>
                    </div>

                    {/* Select de estado */}
                    <div className="w-full sm:w-48">
                      <Label>Estado de Ubicación</Label>
                      <Select
                        value={product.locationStatus ?? "SIN DEFINIR"}
                        onValueChange={(value: "SIN DEFINIR" | "EN TIENDA" | "FABRICACION") => {
                          orderForm.setSelectedProducts((products) =>
                            products.map((p) =>
                              p.id === product.id
                                ? { ...p, locationStatus: value }
                                : p
                            )
                          );
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SIN DEFINIR">SIN DEFINIR</SelectItem>
                          <SelectItem value="EN TIENDA">EN TIENDA</SelectItem>
                          <SelectItem value="FABRICACION">FABRICACION</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Atributos del producto */}
                  {product.attributes && Object.keys(product.attributes).length > 0 && (
                    <div className="space-y-2 pt-4 border-t">
                      <p className="text-sm font-medium">Atributos</p>
                      <div className="text-sm">
                        {Object.entries(product.attributes)
                          .map(([key, value]) => {
                            const categoryAttribute = category?.attributes?.find(
                              (attr) => attr.id?.toString() === key || attr.title === key
                            );
                            const valueLabel = getAttributeValueLabel(value, categoryAttribute);
                            return valueLabel || "-";
                          })
                          .filter((label) => label !== "-")
                          .join(" + ")}
                      </div>
                    </div>
                  )}

                  {/* Observaciones */}
                  {product.observations && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-1">Observaciones</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {product.observations}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
