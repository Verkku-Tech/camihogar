"use client";

import { useState, useEffect, useMemo } from "react";
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
  getProducts,
  type AttributeValue,
  type OrderProduct,
  type Product,
  type Category,
  calculateProductTotalWithAttributes,
  calculateProductUnitPriceWithAttributes,
} from "@/lib/storage";
import { toast } from "sonner";
import { getActiveExchangeRates, formatCurrency, convertProductPriceToBs, type Currency } from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Settings, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: OrderProduct | null;
  onProductUpdate: (product: OrderProduct) => void;
  mode?: "add" | "edit";
}

// Helper functions to normalize attribute values
// IMPORTANTE: Ahora priorizamos label sobre id para guardar el nombre directamente
const getValueString = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.label || value.id;
};

const getValueLabel = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.label || value.id;
};

// Función para calcular ajustes detallados por atributo
const calculateDetailedAttributeAdjustments = (
  productAttributes: Record<string, any>,
  category: Category | undefined,
  exchangeRates?: { USD?: any; EUR?: any }
): Array<{ 
  attributeName: string; 
  selectedValueLabel: string;
  adjustment: number; 
  adjustmentInOriginalCurrency: number; 
  originalCurrency: string 
}> => {
  if (!productAttributes || !category || !category.attributes) {
    return [];
  }

  const adjustments: Array<{ 
    attributeName: string; 
    selectedValueLabel: string;
    adjustment: number; 
    adjustmentInOriginalCurrency: number; 
    originalCurrency: string 
  }> = [];

  // Función helper para convertir ajuste a Bs
  const convertAdjustmentToBs = (adjustment: number, currency?: string): number => {
    if (!currency || currency === "Bs") return adjustment;
    if (currency === "USD" && exchangeRates?.USD?.rate) {
      return adjustment * exchangeRates.USD.rate;
    }
    if (currency === "EUR" && exchangeRates?.EUR?.rate) {
      return adjustment * exchangeRates.EUR.rate;
    }
    return adjustment;
  };

  // Helper para obtener el label de un valor
  const getValueLabel = (value: string | AttributeValue): string => {
    return typeof value === "string" ? value : value.label || value.id;
  };

  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    const categoryAttribute = category.attributes.find(
      (attr) => attr.id?.toString() === attrKey || attr.title === attrKey
    );

    if (!categoryAttribute || !categoryAttribute.values || categoryAttribute.valueType === "Product") {
      return;
    }

    let attributeAdjustment = 0;
    let adjustmentInOriginalCurrency = 0;
    let originalCurrency = "Bs";
    const selectedLabels: string[] = [];

    // Manejar arrays para selección múltiple
    if (Array.isArray(selectedValue)) {
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values.find((val: string | AttributeValue) => {
          if (typeof val === "string") {
            return val === valStr;
          }
          return val.id === valStr || val.label === valStr;
        });

        if (attributeValue) {
          selectedLabels.push(getValueLabel(attributeValue));
          
          if (
            typeof attributeValue === "object" &&
            "priceAdjustment" in attributeValue
          ) {
            const adjustment = attributeValue.priceAdjustment || 0;
            const currency = attributeValue.priceAdjustmentCurrency || "Bs";
            adjustmentInOriginalCurrency += adjustment;
            originalCurrency = currency;
            attributeAdjustment += convertAdjustmentToBs(adjustment, currency);
          }
        }
      });
    } else {
      // Manejar valores simples (selección única)
      const selectedValueStr = selectedValue?.toString();
      if (selectedValueStr) {
        const attributeValue = categoryAttribute.values.find((val: string | AttributeValue) => {
          if (typeof val === "string") {
            return val === selectedValueStr;
          }
          return val.id === selectedValueStr || val.label === selectedValueStr;
        });

        if (attributeValue) {
          selectedLabels.push(getValueLabel(attributeValue));
          
          if (
            typeof attributeValue === "object" &&
            "priceAdjustment" in attributeValue
          ) {
            const adjustment = attributeValue.priceAdjustment || 0;
            const currency = attributeValue.priceAdjustmentCurrency || "Bs";
            adjustmentInOriginalCurrency = adjustment;
            originalCurrency = currency;
            attributeAdjustment = convertAdjustmentToBs(adjustment, currency);
          }
        }
      }
    }

    // Siempre agregar el atributo, incluso si no tiene ajuste de precio
    // Esto asegura transparencia mostrando todos los atributos seleccionados
    adjustments.push({
      attributeName: categoryAttribute.title || attrKey,
      selectedValueLabel: selectedLabels.join(", ") || "",
      adjustment: attributeAdjustment,
      adjustmentInOriginalCurrency,
      originalCurrency,
    });
  });

  return adjustments;
};

// Componente para editar atributos del producto seleccionado
interface ProductAttributesEditorProps {
  product: Product;
  category: Category;
  initialAttributes: Record<string, any>;
  onSave: (attributes: Record<string, any>) => void;
  onCancel: () => void;
}

function ProductAttributesEditor({
  product,
  category,
  initialAttributes,
  onSave,
  onCancel,
}: ProductAttributesEditorProps) {
  const { formatWithPreference, exchangeRates } = useCurrency();
  const [attributes, setAttributes] = useState<Record<string, any>>(initialAttributes);
  const [productPriceFormatted, setProductPriceFormatted] = useState<string>("");
  const [formattedAttributeAdjustments, setFormattedAttributeAdjustments] = useState<Record<string, string>>({});

  useEffect(() => {
    const updatePrice = async () => {
      const formatted = await formatWithPreference(product.price, product.priceCurrency || "Bs");
      setProductPriceFormatted(formatted);
    };
    updatePrice();
  }, [product.price, product.priceCurrency, formatWithPreference]);

  // Calcular y formatear ajustes de precio cuando cambian los atributos
  useEffect(() => {
    const calculateAndFormatAdjustments = async () => {
      if (!category || !category.attributes) return;

      const adjustments: Record<string, string> = {};

      // Función helper para convertir ajuste a Bs
      const convertAdjustmentToBs = (adjustment: number, currency?: string): number => {
        if (!currency || currency === "Bs") return adjustment;
        if (currency === "USD" && exchangeRates?.USD?.rate) {
          return adjustment * exchangeRates.USD.rate;
        }
        if (currency === "EUR" && exchangeRates?.EUR?.rate) {
          return adjustment * exchangeRates.EUR.rate;
        }
        return adjustment;
      };

      // Función helper para obtener el ajuste de precio de un valor
      const getPriceAdjustment = (value: string | AttributeValue): number => {
        if (typeof value === "object" && "priceAdjustment" in value) {
          const adjustment = value.priceAdjustment || 0;
          const currency = value.priceAdjustmentCurrency || "Bs";
          return convertAdjustmentToBs(adjustment, currency);
        }
        return 0;
      };

      // Calcular ajustes para cada atributo
      for (const attribute of category.attributes) {
        if (attribute.valueType === "Product" || !attribute.values) continue;

        // IMPORTANTE: Usar título como clave
        const attrKey = attribute.title || attribute.id?.toString();
        if (!attrKey) continue;

        // Buscar por título primero, luego por ID (compatibilidad)
        const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);

        // Calcular ajuste total
        let totalAdjustment = 0;
        if (Array.isArray(attrValue)) {
          totalAdjustment = attrValue.reduce((total, valStr) => {
            const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
              const valStr2 = getValueString(val);
              return valStr2 === valStr;
            });
            return total + (selectedValue ? getPriceAdjustment(selectedValue) : 0);
          }, 0);
        } else if (attrValue !== undefined) {
          const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
            const valStr = getValueString(val);
            return valStr === attrValue?.toString();
          });
          totalAdjustment = selectedValue ? getPriceAdjustment(selectedValue) : 0;
        }

        // Formatear el ajuste
        if (totalAdjustment !== 0) {
          const formatted = await formatWithPreference(Math.abs(totalAdjustment), "Bs");
          adjustments[attrKey] = formatted;
        }
      }

      setFormattedAttributeAdjustments(adjustments);
    };

    calculateAndFormatAdjustments();
  }, [attributes, category, exchangeRates, formatWithPreference]);

  const handleAttributeChange = (attrKey: string, value: any) => {
    setAttributes((prev) => ({
      ...prev,
      [attrKey]: value,
    }));
  };

  const renderAttributeInput = (attribute: any, attrKey: string) => {
    // Buscar por título primero (clave actual), luego por ID (compatibilidad)
    const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);

    switch (attribute.valueType) {
      case "Number":
        const numValue = attrValue ? parseFloat(attrValue.toString()) : undefined;
        const minValue = attribute.minValue !== undefined ? attribute.minValue : undefined;
        const maxValue = attribute.maxValue !== undefined ? attribute.maxValue : undefined;
        
        return (
          <Input
            type="number"
            value={attrValue || ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === "") {
                handleAttributeChange(attrKey, "");
                return;
              }
              
              const parsedValue = parseFloat(inputValue);
              if (isNaN(parsedValue)) {
                return;
              }
              
              // Validar rango
              if (minValue !== undefined && parsedValue < minValue) {
                toast.error(`El valor debe ser mayor o igual a ${minValue}`);
                return;
              }
              if (maxValue !== undefined && parsedValue > maxValue) {
                toast.error(`El valor debe ser menor o igual a ${maxValue}`);
                return;
              }
              
              handleAttributeChange(attrKey, parsedValue);
            }}
            placeholder="0"
            min={minValue !== undefined ? minValue : undefined}
            max={maxValue !== undefined ? maxValue : undefined}
          />
        );

      case "Select":
        // Función helper para convertir ajuste a Bs
        const convertAdjustmentToBs = (adjustment: number, currency?: string): number => {
          if (!currency || currency === "Bs") return adjustment;
          if (currency === "USD" && exchangeRates?.USD?.rate) {
            return adjustment * exchangeRates.USD.rate;
          }
          if (currency === "EUR" && exchangeRates?.EUR?.rate) {
            return adjustment * exchangeRates.EUR.rate;
          }
          return adjustment;
        };

        // Función helper para obtener el ajuste de precio de un valor
        const getPriceAdjustment = (value: string | AttributeValue): number => {
          if (typeof value === "object" && "priceAdjustment" in value) {
            const adjustment = value.priceAdjustment || 0;
            const currency = value.priceAdjustmentCurrency || "Bs";
            return convertAdjustmentToBs(adjustment, currency);
          }
          return 0;
        };

        // Calcular ajuste para el valor seleccionado
        const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
          const valStr = getValueString(val);
          return valStr === attrValue?.toString();
        });
        const selectedAdjustment = selectedValue ? getPriceAdjustment(selectedValue) : 0;

        return (
          <div className="flex items-center gap-2">
            <Select
              value={attrValue || ""}
              onValueChange={(val) => handleAttributeChange(attrKey, val)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={`Seleccione ${attribute.title?.toLowerCase() || "opción"}`} />
              </SelectTrigger>
              <SelectContent>
                {attribute.values?.map((option: string | AttributeValue) => {
                  // IMPORTANTE: Guardar label directamente en lugar de ID
                  const optionValue = typeof option === "string" ? option : option.label || option.id;
                  const optionLabel = typeof option === "string" ? option : option.label || option.id;
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
                {formattedAttributeAdjustments[attrKey] || formatCurrency(selectedAdjustment, "Bs")}
              </span>
            )}
          </div>
        );

      case "Multiple select":
        const selectedValues = Array.isArray(attrValue) ? attrValue : [];
        const maxSelections = attribute.maxSelections !== undefined ? attribute.maxSelections : Infinity;
        const isMaxReached = maxSelections !== Infinity && selectedValues.length >= maxSelections;

        // Función helper para convertir ajuste a Bs
        const convertAdjustmentToBsMultiple = (adjustment: number, currency?: string): number => {
          if (!currency || currency === "Bs") return adjustment;
          if (currency === "USD" && exchangeRates?.USD?.rate) {
            return adjustment * exchangeRates.USD.rate;
          }
          if (currency === "EUR" && exchangeRates?.EUR?.rate) {
            return adjustment * exchangeRates.EUR.rate;
          }
          return adjustment;
        };

        // Función helper para obtener el ajuste de precio de un valor
        const getPriceAdjustmentMultiple = (value: string | AttributeValue): number => {
          if (typeof value === "object" && "priceAdjustment" in value) {
            const adjustment = value.priceAdjustment || 0;
            const currency = value.priceAdjustmentCurrency || "Bs";
            return convertAdjustmentToBsMultiple(adjustment, currency);
          }
          return 0;
        };

        // Calcular ajuste total para selección múltiple
        const totalAdjustment = selectedValues.reduce((total, valStr) => {
          const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
            const valStr2 = getValueString(val);
            return valStr2 === valStr;
          });
          return total + (selectedValue ? getPriceAdjustmentMultiple(selectedValue) : 0);
        }, 0);

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value=""
                disabled={isMaxReached}
                onValueChange={(val) => {
                  if (!selectedValues.includes(val)) {
                    if (maxSelections !== Infinity && selectedValues.length >= maxSelections) {
                      toast.error(`Solo puedes seleccionar máximo ${maxSelections} opción${maxSelections > 1 ? "es" : ""}`);
                      return;
                    }
                    handleAttributeChange(attrKey, [...selectedValues, val]);
                  }
                }}
              >
                <SelectTrigger className={`flex-1 ${isMaxReached ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <SelectValue
                    placeholder={
                      isMaxReached
                        ? `Máximo alcanzado (${maxSelections})`
                        : "Seleccione opciones"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {attribute.values
                    ?.map((v: string | AttributeValue) => typeof v === "string" ? v : v.id || v.label)
                    .filter((optionValue: string) => !selectedValues.includes(optionValue))
                    .map((optionValue: string) => {
                      const option = attribute.values?.find(
                        (v: string | AttributeValue) => {
                          const valStr = typeof v === "string" ? v : v.id || v.label;
                          return valStr === optionValue;
                        }
                      );
                      const optionLabel = option 
                        ? (typeof option === "string" ? option : option.label || option.id)
                        : optionValue;
                      return (
                        <SelectItem key={optionValue} value={optionValue}>
                          {optionLabel}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              {totalAdjustment !== 0 && (
                <span
                  className={`text-sm font-medium whitespace-nowrap ${
                    totalAdjustment > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalAdjustment > 0 ? "+" : ""}
                  {formattedAttributeAdjustments[attrKey] || formatCurrency(totalAdjustment, "Bs")}
                </span>
              )}
            </div>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((val: string) => {
                  const option = attribute.values?.find(
                    (v: string | AttributeValue) => {
                      const valStr = typeof v === "string" ? v : v.id || v.label;
                      return valStr === val;
                    }
                  );
                  const displayLabel = option 
                    ? (typeof option === "string" ? option : option.label || option.id)
                    : val;
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        handleAttributeChange(
                          attrKey,
                          selectedValues.filter((v: string) => v !== val)
                        );
                      }}
                    >
                      {displayLabel} ×
                    </Badge>
                  );
                })}
              </div>
            )}
            {maxSelections !== Infinity && (
              <p className="text-xs text-muted-foreground">
                Máximo {maxSelections} selección{maxSelections > 1 ? "es" : ""} permitida{maxSelections > 1 ? "s" : ""}
                {selectedValues.length > 0 && ` (${selectedValues.length}/${maxSelections})`}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Información del producto */}
      <div className="p-3 bg-muted rounded-lg">
        <h3 className="font-medium text-sm">{product.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          SKU: {product.sku} • Precio: {productPriceFormatted || formatCurrency(product.price, product.priceCurrency || "Bs")}
        </p>
      </div>

      {/* Atributos de la categoría del producto */}
      {category.attributes && category.attributes.length > 0 ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Atributos del Producto</Label>
          {category.attributes.map((attribute: any) => {
            // IMPORTANTE: Usar título como clave, no ID
            const attrKey = attribute.title || attribute.id?.toString();
            if (!attrKey) return null;

            return (
              <div key={attrKey} className="space-y-1.5">
                <Label htmlFor={`edit-attr-${attrKey}`} className="text-sm">
                  {attribute.title}
                  {/* Indicador visual de campo obligatorio */}
                  {(attribute.valueType === "Select" || 
                    attribute.valueType === "Multiple select" ||
                    attribute.valueType === "Number") && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                {attribute.description && (
                  <p className="text-xs text-muted-foreground">{attribute.description}</p>
                )}
                
                {/* Mostrar mensaje de advertencia si el atributo está vacío */}
                {(() => {
                  // Buscar por título primero (clave actual), luego por ID (compatibilidad)
    const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);
                  const isEmpty = 
                    (attribute.valueType === "Select" && (attrValue === undefined || attrValue === "" || attrValue === null)) ||
                    (attribute.valueType === "Multiple select" && (!Array.isArray(attrValue) || attrValue.length === 0));
                  
                  return isEmpty ? (
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      ⚠️ Este atributo es obligatorio
                    </p>
                  ) : null;
                })()}
                
                {renderAttributeInput(attribute, attrKey)}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          Esta categoría no tiene atributos configurados.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          size="sm" 
          onClick={() => {
            // Validar que todos los atributos requeridos estén seleccionados
            const missingAttributes: string[] = [];
            
            if (category.attributes && category.attributes.length > 0) {
              for (const attribute of category.attributes) {
                // IMPORTANTE: Usar título como clave
                const attrKey = attribute.title || attribute.id?.toString();
                if (!attrKey) continue;
                
                // Buscar por título primero, luego por ID (compatibilidad)
                const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);
                
                // Validar atributos de tipo "Select" (selección única)
                if (attribute.valueType === "Select") {
                  if (attrValue === undefined || attrValue === "" || attrValue === null) {
                    missingAttributes.push(attribute.title || attrKey);
                  }
                }
                
                // Validar atributos de tipo "Multiple select" (selección múltiple)
                if (attribute.valueType === "Multiple select") {
                  if (!Array.isArray(attrValue) || attrValue.length === 0) {
                    missingAttributes.push(attribute.title || attrKey);
                  }
                }
              }
            }
            
            // Si hay atributos faltantes, mostrar alert y NO guardar
            if (missingAttributes.length > 0) {
              const missingList = missingAttributes.join(", ");
              toast.error(
                `Debe seleccionar una opción para los siguientes atributos: ${missingList}`,
                {
                  duration: 5000,
                }
              );
              return; // Detener aquí, no guardar los atributos
            }
            
            // Si todo está bien, guardar
            onSave(attributes);
          }}
        >
          Guardar Atributos
        </Button>
      </div>
    </div>
  );
}

export function ProductEditDialog({
  open,
  onOpenChange,
  product,
  onProductUpdate,
  mode = "edit",
}: ProductEditDialogProps) {
  const { formatWithPreference, preferredCurrency } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [attributes, setAttributes] = useState<Record<string, any>>(
    {}
  );
  const [observations, setObservations] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{ USD?: any; EUR?: any }>({});
  const [editingAttributeId, setEditingAttributeId] = useState<string | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productAttributes, setProductAttributes] = useState<{ 
    [key: string]: Array<{ 
      productId: number;
      product: Product; 
      attributes: Record<string, any> 
    }> 
  }>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productPricesFormatted, setProductPricesFormatted] = useState<Record<number, string>>({});
  const [totalFormatted, setTotalFormatted] = useState<string>("");
  const [unitPriceFormatted, setUnitPriceFormatted] = useState<string>("");
  const [basePriceFormatted, setBasePriceFormatted] = useState<string>("");
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  // Estados para almacenar los valores calculados y reutilizarlos en el render
  const [calculatedBasePriceInBs, setCalculatedBasePriceInBs] = useState<number>(0);
  const [calculatedBasePriceWithAdjustments, setCalculatedBasePriceWithAdjustments] = useState<number>(0);
  const [calculatedProductAttributesTotal, setCalculatedProductAttributesTotal] = useState<number>(0);
  const [calculatedUnitPrice, setCalculatedUnitPrice] = useState<number>(0);
  const [calculatedAdjustment, setCalculatedAdjustment] = useState<number>(0);
  const [detailedAttributeAdjustments, setDetailedAttributeAdjustments] = useState<Array<{
    attributeName: string;
    selectedValueLabel: string;
    adjustment: number;
    adjustmentInOriginalCurrency: number;
    originalCurrency: string;
    formattedAdjustment: string;
  }>>([]);
  const [detailedProductAttributeAdjustments, setDetailedProductAttributeAdjustments] = useState<Array<{
    productName: string;
    productPrice: number;
    productPriceCurrency: string;
    productPriceInBs: number;
    formattedProductPrice: string;
    productAdjustments: Array<{
      attributeName: string;
      selectedValueLabel: string;
      adjustment: number;
      adjustmentInOriginalCurrency: number;
      originalCurrency: string;
      formattedAdjustment: string;
    }>;
    hasAttributeAdjustments: boolean;
  }>>([]);
  const [formattedAttributeAdjustments, setFormattedAttributeAdjustments] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const [loadedCategories, rates] = await Promise.all([
          getCategories(),
          getActiveExchangeRates(),
        ]);
        setCategories(loadedCategories);
        setExchangeRates(rates);
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

    const normalizedAttributes: Record<string, string | number | string[]> = {};
    currentCategory.attributes?.forEach((attr: any) => {
      // IMPORTANTE: Usar título como clave, no ID (para compatibilidad, buscar por ambos)
      const attrTitle = attr.title || "";
      const attrId = attr?.id?.toString();
      if (!attrTitle && !attrId) return;

      // Buscar valor por título primero, luego por ID (compatibilidad con datos antiguos)
      const value =
        product.attributes?.[attrTitle] ??
        (attrId ? product.attributes?.[attrId] : undefined);

      if (value !== undefined && attrTitle) {
        // Guardar usando el título como clave
        normalizedAttributes[attrTitle] = value;
      }
    });

    Object.entries(product.attributes || {}).forEach(([key, value]) => {
      if (normalizedAttributes[key] === undefined) {
        normalizedAttributes[key] = value;
      }
    });

    setAttributes(normalizedAttributes);
  }, [product, categories]);

  // Calcular currentCategory de forma segura (después de todos los hooks, antes del return condicional)
  const currentCategory = product ? categories.find(
    (cat) => cat.name === product.category
  ) : null;

  // Cargar todos los productos una sola vez cuando se abre el diálogo
  useEffect(() => {
    if (!open || productsLoaded) return;
    
    const loadAllProducts = async () => {
      try {
        const loadedProducts = await getProducts();
        setAllProducts(loadedProducts);
        setProductsLoaded(true);
      } catch (error) {
        console.error("Error loading products:", error);
      }
    };
    
    loadAllProducts();
  }, [open, productsLoaded]);

  // Resetear cuando se cierra el diálogo
  useEffect(() => {
    if (!open) {
      setProductsLoaded(false);
      setAllProducts([]);
      setOriginalProduct(null);
      // Resetear valores calculados
      setCalculatedBasePriceInBs(0);
      setCalculatedBasePriceWithAdjustments(0);
      setCalculatedProductAttributesTotal(0);
      setCalculatedUnitPrice(0);
      setCalculatedAdjustment(0);
      setBasePriceFormatted("");
      setUnitPriceFormatted("");
      setTotalFormatted("");
      setDetailedAttributeAdjustments([]);
      setDetailedProductAttributeAdjustments([]);
      setFormattedAttributeAdjustments({});
    }
  }, [open]);

  // Obtener el producto original desde la base de datos para tener su precio y moneda originales
  useEffect(() => {
    const loadOriginalProduct = async () => {
      if (!product || !allProducts.length) {
        setOriginalProduct(null);
        return;
      }
      
      const productId = parseInt(product.id);
      const original = allProducts.find((p) => p.id === productId);
      setOriginalProduct(original || null);
    };
    
    loadOriginalProduct();
  }, [product, allProducts]);

  // Crear un Map de productos para búsquedas rápidas
  const productsMap = useMemo(() => {
    const map = new Map<number, Product>();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  // Cargar productos desde los valores del atributo cuando se abre el diálogo y productos están cargados
  useEffect(() => {
    if (!currentCategory || !open || !productsLoaded || allProducts.length === 0) return;
    
    const loadProductsFromAttributeValues = () => {
      for (const attribute of currentCategory.attributes || []) {
        if (attribute.valueType === "Product" && attribute.values && attribute.values.length > 0) {
          const productEntries: Array<{ productId: number; product: Product; attributes: Record<string, any> }> = [];
          const attrId = attribute.id?.toString() || attribute.title;
          
          // Verificar si ya está cargado para este atributo
          const existing = productAttributes[attrId];
          if (existing && existing.length > 0) {
            // Ya está cargado, continuar con el siguiente
            continue;
          }
          
          // Procesar cada valor del atributo
          for (const value of attribute.values) {
            const attrValue = typeof value === "string" 
              ? { id: "", label: value, productId: undefined }
              : value as AttributeValue;
            
            if (attrValue.productId) {
              const foundProduct = productsMap.get(attrValue.productId);
              if (foundProduct) {
                // Inicializar con los atributos originales del producto
                productEntries.push({
                  productId: foundProduct.id,
                  product: foundProduct,
                  attributes: foundProduct.attributes || {},
                });
              }
            }
          }
          
          if (productEntries.length > 0) {
            setProductAttributes((prev) => ({
              ...prev,
              [attrId]: productEntries,
            }));
          }
        }
      }
    };

    loadProductsFromAttributeValues();
  }, [currentCategory, open, productsLoaded, productsMap]); // Removido 'attributes' de las dependencias

  // Actualizar atributos editados cuando cambian (separado de la carga inicial)
  useEffect(() => {
    if (!currentCategory || !productsLoaded) return;
    
    setProductAttributes((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      
      for (const attribute of currentCategory.attributes || []) {
        if (attribute.valueType === "Product") {
          const attrId = attribute.id?.toString() || attribute.title;
          const existing = updated[attrId];
          
          if (existing && Array.isArray(existing) && existing.length > 0) {
            const updatedEntries = existing.map((entry) => {
              const productAttributeKey = `${attrId}_${entry.productId}`;
              const editedAttributes = attributes[productAttributeKey] || entry.product.attributes || {};
              
              // Solo actualizar si realmente cambió
              const attributesChanged = JSON.stringify(entry.attributes) !== JSON.stringify(editedAttributes);
              if (attributesChanged) {
                hasChanges = true;
                return {
                  ...entry,
                  attributes: editedAttributes,
                };
              }
              return entry;
            });
            
            if (hasChanges) {
              updated[attrId] = updatedEntries as Array<{ 
                productId: number;
                product: Product; 
                attributes: Record<string, any> 
              }>;
            }
          }
        }
      }
      
      return hasChanges ? updated : prev;
    });
  }, [attributes, currentCategory, productsLoaded]); // Este se ejecuta solo cuando attributes cambia

  // Formatear precios de productos-atributos cuando cambien los productos o la moneda preferida
  useEffect(() => {
    const formatProductPrices = async () => {
      const prices: Record<number, string> = {};
      
      // Recopilar todos los productos únicos de productAttributes
      const uniqueProducts = new Set<number>();
      Object.values(productAttributes).forEach((entries) => {
        entries.forEach((entry) => {
          uniqueProducts.add(entry.product.id);
        });
      });
      
      // Formatear cada precio
      for (const productId of uniqueProducts) {
        const product = allProducts.find((p) => p.id === productId);
        if (product) {
          const formatted = await formatWithPreference(
            product.price,
            product.priceCurrency || "Bs"
          );
          prices[productId] = formatted;
        }
      }
      
      setProductPricesFormatted(prices);
    };
    
    if (allProducts.length > 0 && Object.keys(productAttributes).length > 0) {
      formatProductPrices();
    }
  }, [productAttributes, allProducts, preferredCurrency, formatWithPreference]);

  // Formatear ajustes de atributos visibles junto a los campos
  useEffect(() => {
    const formatVisibleAdjustments = async () => {
      if (!currentCategory || !currentCategory.attributes) return;

      const formatted: Record<string, string> = {};

      for (const attribute of currentCategory.attributes) {
        // IMPORTANTE: Usar título como clave
        const attrKey = attribute.title || attribute.id?.toString();
        if (!attrKey || attribute.valueType === "Product") continue;

        // Buscar por título primero (clave actual), luego por ID (compatibilidad)
    const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);
        if (!attrValue) continue;

        // Función helper para convertir ajuste a Bs
        const convertAdjustmentToBs = (adjustment: number, currency?: string): number => {
          if (!currency || currency === "Bs") return adjustment;
          if (currency === "USD" && exchangeRates?.USD?.rate) {
            return adjustment * exchangeRates.USD.rate;
          }
          if (currency === "EUR" && exchangeRates?.EUR?.rate) {
            return adjustment * exchangeRates.EUR.rate;
          }
          return adjustment;
        };

        let totalAdjustment = 0;

        if (Array.isArray(attrValue)) {
          // Selección múltiple
          attrValue.forEach((valStr) => {
            const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
              const valStr2 = getValueString(val);
              return valStr2 === valStr;
            });
            if (selectedValue && typeof selectedValue === "object" && "priceAdjustment" in selectedValue) {
              const adjustment = selectedValue.priceAdjustment || 0;
              const currency = selectedValue.priceAdjustmentCurrency || "Bs";
              totalAdjustment += convertAdjustmentToBs(adjustment, currency);
            }
          });
        } else {
          // Selección única
          const selectedValue = attribute.values?.find((val: string | AttributeValue) => {
            const valStr = getValueString(val);
            return valStr === attrValue?.toString();
          });
          if (selectedValue && typeof selectedValue === "object" && "priceAdjustment" in selectedValue) {
            const adjustment = selectedValue.priceAdjustment || 0;
            const currency = selectedValue.priceAdjustmentCurrency || "Bs";
            totalAdjustment = convertAdjustmentToBs(adjustment, currency);
          }
        }

        if (totalAdjustment !== 0) {
          formatted[attrKey] = await formatWithPreference(totalAdjustment, "Bs");
        }
      }

      setFormattedAttributeAdjustments(formatted);
    };

    if (currentCategory && attributes) {
      formatVisibleAdjustments();
    }
  }, [attributes, currentCategory, exchangeRates, preferredCurrency, formatWithPreference]);

  // Actualizar totales formateados cuando cambien los cálculos
  useEffect(() => {
    const updateFormattedTotals = async () => {
      if (!product || !currentCategory) return;

      // Usar el precio original del producto si está disponible, sino usar el precio convertido
      let basePriceInBs = product.price;
      if (originalProduct) {
        const originalPrice = originalProduct.price;
        const originalCurrency = originalProduct.priceCurrency || "Bs";
        if (originalCurrency === "Bs") {
          basePriceInBs = originalPrice;
        } else if (originalCurrency === "USD" && exchangeRates?.USD?.rate) {
          basePriceInBs = originalPrice * exchangeRates.USD.rate;
        } else if (originalCurrency === "EUR" && exchangeRates?.EUR?.rate) {
          basePriceInBs = originalPrice * exchangeRates.EUR.rate;
        } else {
          basePriceInBs = originalPrice;
        }
      }

      // Calcular ajustes detallados de atributos normales
      const attributeAdjustments = calculateDetailedAttributeAdjustments(
        attributes,
        currentCategory,
        exchangeRates
      );

      // Formatear ajustes de atributos normales
      const formattedAttributeAdjustments = await Promise.all(
        attributeAdjustments.map(async (adj) => ({
          ...adj,
          // Usar el ajuste en su moneda original para el formateo, no el convertido a Bs
          formattedAdjustment: await formatWithPreference(adj.adjustmentInOriginalCurrency, adj.originalCurrency as Currency),
        }))
      );
      setDetailedAttributeAdjustments(formattedAttributeAdjustments);

      // Calcular el precio base con ajustes normales
      const basePriceWithAdjustments = calculateProductUnitPriceWithAttributes(
        basePriceInBs,
        attributes,
        currentCategory,
        exchangeRates
      );

      // Calcular ajustes detallados de productos-atributos
      const productAttrAdjustments: Array<{
        productName: string;
        productPrice: number;
        productPriceCurrency: string;
        productPriceInBs: number;
        formattedProductPrice: string;
        productAdjustments: Array<{
          attributeName: string;
          selectedValueLabel: string;
          adjustment: number;
          adjustmentInOriginalCurrency: number;
          originalCurrency: string;
          formattedAdjustment: string;
        }>;
        hasAttributeAdjustments: boolean;
      }> = [];

      let productAttributesTotal = 0;
      for (const attribute of currentCategory.attributes || []) {
        if (attribute.valueType === "Product") {
          const attrId = attribute.id?.toString() || attribute.title;
          const productsForAttr = productAttributes[attrId] || [];
          
          for (const productEntry of productsForAttr) {
            const productPrice = productEntry.product.price;
            const productCurrency = productEntry.product.priceCurrency || "Bs";
            
            let productPriceInBs = productPrice;
            if (productCurrency !== "Bs") {
              if (productCurrency === "USD" && exchangeRates?.USD?.rate) {
                productPriceInBs = productPrice * exchangeRates.USD.rate;
              } else if (productCurrency === "EUR" && exchangeRates?.EUR?.rate) {
                productPriceInBs = productPrice * exchangeRates.EUR.rate;
              }
            }

            // Calcular ajustes de atributos del producto-atributo
            const productCategory = categories.find(cat => cat.name === productEntry.product.category);
            let productAttrAdjusts: Array<{
              attributeName: string;
              selectedValueLabel: string;
              adjustment: number;
              adjustmentInOriginalCurrency: number;
              originalCurrency: string;
              formattedAdjustment: string;
            }> = [];
            let hasAttributeAdjustments = false;

            if (productCategory) {
              const rawAdjustments = calculateDetailedAttributeAdjustments(
                productEntry.attributes,
                productCategory,
                exchangeRates
              );
              
              hasAttributeAdjustments = rawAdjustments.length > 0 && rawAdjustments.some(adj => adj.adjustment !== 0);
              
              // Formatear ajustes del producto-atributo
              productAttrAdjusts = await Promise.all(
                rawAdjustments.map(async (adj) => ({
                  ...adj,
                  // Usar el ajuste en su moneda original para el formateo, no el convertido a Bs
                  formattedAdjustment: await formatWithPreference(adj.adjustmentInOriginalCurrency, adj.originalCurrency as Currency),
                }))
              );
            }

            // SIEMPRE sumar el precio base del producto
            productAttributesTotal += productPriceInBs;
            
            // Además, sumar los ajustes de los atributos del producto
            productAttrAdjusts.forEach(adj => {
              productAttributesTotal += adj.adjustment;
            });

            // Formatear precio del producto
            const formattedProductPrice = await formatWithPreference(productPrice, productCurrency);

            productAttrAdjustments.push({
              productName: productEntry.product.name,
              productPrice: productPrice,
              productPriceCurrency: productCurrency,
              productPriceInBs: productPriceInBs,
              formattedProductPrice: formattedProductPrice,
              productAdjustments: productAttrAdjusts,
              hasAttributeAdjustments,
            });
          }
        }
      }
      setDetailedProductAttributeAdjustments(productAttrAdjustments);

      const unitPrice = basePriceWithAdjustments + productAttributesTotal;
      const total = unitPrice * quantity;
      const adjustment = basePriceWithAdjustments - basePriceInBs;

      // Guardar los valores calculados para usar en el render
      setCalculatedBasePriceInBs(basePriceInBs);
      setCalculatedBasePriceWithAdjustments(basePriceWithAdjustments);
      setCalculatedProductAttributesTotal(productAttributesTotal);
      setCalculatedUnitPrice(unitPrice);
      setCalculatedAdjustment(adjustment);

      // Formatear en la moneda preferida
      // Para el precio base, usar el precio original del producto con su moneda original
      const basePriceToFormat = originalProduct 
        ? originalProduct.price 
        : product.price;
      const basePriceCurrency = originalProduct?.priceCurrency || "Bs";
      
      const [formattedTotal, formattedUnit, formattedBase] = await Promise.all([
        formatWithPreference(total, "Bs"),
        formatWithPreference(unitPrice, "Bs"),
        formatWithPreference(basePriceToFormat, basePriceCurrency),
      ]);

      setTotalFormatted(formattedTotal);
      setUnitPriceFormatted(formattedUnit);
      setBasePriceFormatted(formattedBase);
    };

    // Esperar a que originalProduct esté cargado (o sea null explícitamente) antes de calcular
    // originalProduct puede ser null si no se encuentra, pero debe haber intentado cargarlo
    if (product && currentCategory && allProducts.length > 0) {
      updateFormattedTotals();
    }
  }, [product, quantity, attributes, currentCategory, productAttributes, exchangeRates, preferredCurrency, formatWithPreference, originalProduct, allProducts, categories]);

  // Obtener la categoría del producto seleccionado para editar sus atributos
  const productCategoryForEdit = selectedProductForEdit
    ? categories.find((cat) => cat.name === selectedProductForEdit.category)
    : null;

  const handleSaveEditedAttributes = (attributeId: string, editedAttributes: Record<string, any>) => {
    if (!selectedProductForEdit || !productCategoryForEdit || !editingProductId) return;

    // Actualizar los atributos del producto específico en productAttributes
    setProductAttributes((prev) => ({
      ...prev,
      [attributeId]: (prev[attributeId] || []).map((entry) => {
        if (entry.productId === editingProductId) {
          return {
            ...entry,
            attributes: editedAttributes,
          };
        }
        return entry;
      }),
    }));

    // Actualizar en attributes
    // Los atributos editados se guardan con una clave única que combine attributeId y productId
    setAttributes((prev) => {
      const newAttributes = { ...prev };
      const productAttributeKey = `${attributeId}_${editingProductId}`;
      
      // Guardar los atributos editados con las claves correctas (usar título)
      productCategoryForEdit.attributes.forEach((attr: any) => {
        const attrKey = attr.title || attr.id?.toString();
        if (attrKey && editedAttributes[attrKey] !== undefined) {
          if (!newAttributes[productAttributeKey]) {
            newAttributes[productAttributeKey] = {};
          }
          newAttributes[productAttributeKey][attrKey] = editedAttributes[attrKey];
        }
      });

      return newAttributes;
    });

    setEditingAttributeId(null);
    setSelectedProductForEdit(null);
    setEditingProductId(null);
    toast.success("Atributos actualizados correctamente");
  };

  // Función para manejar cambios en los atributos del producto principal
  const handleAttributeChange = (attrKey: string, value: any) => {
    setAttributes((prev) => ({
      ...prev,
      [attrKey]: value,
    }));
  };

  // Función helper para verificar si un producto como atributo tiene atributos obligatorios faltantes
  const checkProductAttributeMissingMandatoryAttributes = (productEntry: { product: Product; attributes?: Record<string, any> }): string[] => {
    const missingAttributes: string[] = [];
    const productCategory = categories.find(cat => cat.name === productEntry.product.category);
    
    if (productCategory && productCategory.attributes && productCategory.attributes.length > 0) {
      const editedAttributes = productEntry.attributes || {};
      
      for (const productAttr of productCategory.attributes) {
        const productAttrKey = productAttr.id?.toString() || productAttr.title;
        if (!productAttrKey) continue;
        
        // Solo validar atributos obligatorios (Select y Multiple select)
        if (productAttr.valueType === "Select" || productAttr.valueType === "Multiple select") {
          const productAttrValue = editedAttributes[productAttrKey] ?? (productAttr.title ? editedAttributes[productAttr.title] : undefined);
          
          if (productAttr.valueType === "Select") {
            if (productAttrValue === undefined || productAttrValue === "" || productAttrValue === null) {
              missingAttributes.push(productAttr.title || productAttrKey);
            }
          } else if (productAttr.valueType === "Multiple select") {
            if (!Array.isArray(productAttrValue) || productAttrValue.length === 0) {
              missingAttributes.push(productAttr.title || productAttrKey);
            }
          }
        }
      }
    }
    
    return missingAttributes;
  };

  const handleSave = () => {
    if (!product) return;
    
    // ===== VALIDACIÓN OBLIGATORIA DE ATRIBUTOS =====
    // Verificar que todos los atributos de tipo Select, Multiple select y Product estén seleccionados
    if (currentCategory && currentCategory.attributes && currentCategory.attributes.length > 0) {
      const missingAttributes: string[] = [];
      
      for (const attribute of currentCategory.attributes) {
        // IMPORTANTE: Usar título como clave
        const attrKey = attribute.title || attribute.id?.toString();
        if (!attrKey) continue;
        
        // Buscar por título primero (clave actual), luego por ID (compatibilidad)
    const attrValue = attributes[attrKey] ?? (attribute.id ? attributes[attribute.id.toString()] : undefined);
        
        // Validar atributos de tipo "Select" (selección única)
        if (attribute.valueType === "Select") {
          if (attrValue === undefined || attrValue === "" || attrValue === null) {
            missingAttributes.push(attribute.title || attrKey);
          }
        }
        
        // Validar atributos de tipo "Multiple select" (selección múltiple)
        if (attribute.valueType === "Multiple select") {
          if (!Array.isArray(attrValue) || attrValue.length === 0) {
            missingAttributes.push(attribute.title || attrKey);
          }
        }
        
        // Validar atributos de tipo "Number" (número)
        if (attribute.valueType === "Number") {
          if (attrValue === undefined || attrValue === "" || attrValue === null) {
            missingAttributes.push(attribute.title || attrKey);
          } else {
            // Validar que el valor esté dentro del rango permitido
            const numValue = parseFloat(attrValue.toString());
            if (isNaN(numValue)) {
              missingAttributes.push(attribute.title || attrKey);
            } else {
              // Validar minValue si existe
              if (attribute.minValue !== undefined && numValue < attribute.minValue) {
                missingAttributes.push(`${attribute.title || attrKey} (mínimo: ${attribute.minValue})`);
              }
              // Validar maxValue si existe
              if (attribute.maxValue !== undefined && numValue > attribute.maxValue) {
                missingAttributes.push(`${attribute.title || attrKey} (máximo: ${attribute.maxValue})`);
              }
            }
          }
        }
        
        // Validar atributos de tipo "Product" (como "Tela" - productos como atributos)
        if (attribute.valueType === "Product") {
          const productsForAttribute = productAttributes[attrKey] || [];
          if (productsForAttribute.length === 0) {
            missingAttributes.push(attribute.title || attrKey);
          } else {
            // Validar que cada producto-atributo tenga sus atributos obligatorios completos
            for (const productEntry of productsForAttribute) {
              const missingProductAttributes = checkProductAttributeMissingMandatoryAttributes(productEntry);
              if (missingProductAttributes.length > 0) {
                const missingList = missingProductAttributes.join(", ");
                missingAttributes.push(`${attribute.title || attrKey} → ${productEntry.product.name}: ${missingList}`);
              }
            }
          }
        }
      }
      
      // Si hay atributos faltantes, mostrar alert y NO permitir agregar el producto
      if (missingAttributes.length > 0) {
        const missingList = missingAttributes.join(", ");
        toast.error(
          `Debe completar los siguientes atributos obligatorios: ${missingList}`,
          {
            duration: 6000,
          }
        );
        return; // Detener aquí, no agregar el producto al pedido
      }
    }
    
    // Usar el precio original del producto si está disponible, sino usar el precio convertido
    let basePriceInBs = product.price;
    if (originalProduct) {
      const originalPrice = originalProduct.price;
      const originalCurrency = originalProduct.priceCurrency || "Bs";
      if (originalCurrency === "Bs") {
        basePriceInBs = originalPrice;
      } else if (originalCurrency === "USD" && exchangeRates?.USD?.rate) {
        basePriceInBs = originalPrice * exchangeRates.USD.rate;
      } else if (originalCurrency === "EUR" && exchangeRates?.EUR?.rate) {
        basePriceInBs = originalPrice * exchangeRates.EUR.rate;
      } else {
        basePriceInBs = originalPrice;
      }
    }
    
    // Calcular el precio base con ajustes normales de atributos
    const basePriceWithAdjustments = calculateProductUnitPriceWithAttributes(
      basePriceInBs,
      attributes,
      currentCategory,
      exchangeRates
    );

    // Sumar precios de productos cuando son atributos (convertidos a Bs)
    let productAttributesTotal = 0;
    if (currentCategory) {
      for (const attribute of currentCategory.attributes || []) {
        if (attribute.valueType === "Product") {
          const attrId = attribute.id?.toString() || attribute.title;
          const productsForAttr = productAttributes[attrId] || [];
          
          for (const productEntry of productsForAttr) {
            // Convertir precio del producto-atributo a Bs
            const productPrice = productEntry.product.price;
            const productCurrency = productEntry.product.priceCurrency || "Bs";
            
            let productPriceInBs = productPrice;
            if (productCurrency !== "Bs") {
              if (productCurrency === "USD" && exchangeRates?.USD?.rate) {
                productPriceInBs = productPrice * exchangeRates.USD.rate;
              } else if (productCurrency === "EUR" && exchangeRates?.EUR?.rate) {
                productPriceInBs = productPrice * exchangeRates.EUR.rate;
              }
            }
            
            // SIEMPRE sumar el precio base del producto
            productAttributesTotal += productPriceInBs;
            
            // Además, sumar los ajustes de los atributos editados del producto-atributo
            const productCategory = categories.find(cat => cat.name === productEntry.product.category);
            if (productCategory && productEntry.attributes) {
              // Calcular los ajustes de precio de los atributos editados
              const productAttributeAdjustments = calculateProductUnitPriceWithAttributes(
                0, // Precio base 0 porque ya sumamos el precio del producto arriba
                productEntry.attributes,
                productCategory,
                exchangeRates
              );
              
              // Sumar los ajustes de atributos
              productAttributesTotal += productAttributeAdjustments;
            }
          }
        }
      }
    }

    // Calcular el total: (precio base + ajustes + precios de productos-atributos) * cantidad
    const unitPrice = basePriceWithAdjustments + productAttributesTotal;
    const total = unitPrice * quantity;

    // IMPORTANTE: Normalizar atributos para usar títulos como claves en lugar de IDs
    const finalAttributes: Record<string, any> = {};
    
    // Primero, normalizar los atributos existentes usando títulos
    if (currentCategory) {
      for (const attribute of currentCategory.attributes || []) {
        const attrTitle = attribute.title || "";
        const attrId = attribute.id?.toString();
        
        if (!attrTitle) continue;
        
        // Buscar el valor por título o por ID (compatibilidad)
        const value = attributes[attrTitle] ?? (attrId ? attributes[attrId] : undefined);
        
        if (value !== undefined) {
          finalAttributes[attrTitle] = value;
        }
        
        // Manejar atributos tipo Product
        if (attribute.valueType === "Product") {
          const productsForAttr = productAttributes[attrTitle] ?? (attrId ? productAttributes[attrId] : []);
          
          // IMPORTANTE: Guardar el array de IDs de productos seleccionados usando título como clave
          if (productsForAttr.length > 0) {
            finalAttributes[attrTitle] = productsForAttr.map(entry => entry.productId);
          }
          
          for (const productEntry of productsForAttr) {
            const productAttributeKey = `${attrTitle}_${productEntry.productId}`;
            // Si hay atributos editados, incluirlos en finalAttributes
            if (productEntry.attributes && Object.keys(productEntry.attributes).length > 0) {
              finalAttributes[productAttributeKey] = productEntry.attributes;
            }
          }
        }
      }
    }
    
    // Agregar cualquier atributo que no esté en la categoría (por compatibilidad)
    Object.entries(attributes).forEach(([key, value]) => {
      if (!finalAttributes[key] && !key.includes("_")) {
        finalAttributes[key] = value;
      }
    });

    // Asegurar que stock tenga un valor por defecto si no está presente
    const updatedProduct: OrderProduct = {
      ...product,
      quantity,
      total,
      attributes: finalAttributes,
      stock: product.stock ?? 0, // Usar 0 como valor por defecto si stock no existe
      observations: observations.trim() || undefined,
    };
    onProductUpdate(updatedProduct);
  };

  if (!product) return null;

  const categoryAttrs = currentCategory?.attributes || [];

  return (
    <>
      {/* Diálogo para editar atributos del producto seleccionado */}
      <Dialog
        open={editingAttributeId !== null && selectedProductForEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAttributeId(null);
            setSelectedProductForEdit(null);
            setEditingProductId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg">Editar Atributos de {selectedProductForEdit?.name}</DialogTitle>
          </DialogHeader>
          {selectedProductForEdit && productCategoryForEdit && editingAttributeId && editingProductId && (
            <ProductAttributesEditor
              product={selectedProductForEdit}
              category={productCategoryForEdit}
              initialAttributes={
                productAttributes[editingAttributeId]?.find(entry => entry.productId === editingProductId)?.attributes 
                  || selectedProductForEdit.attributes 
                  || {}
              }
              onSave={(editedAttributes) => {
                handleSaveEditedAttributes(editingAttributeId, editedAttributes);
              }}
              onCancel={() => {
                setEditingAttributeId(null);
                setSelectedProductForEdit(null);
                setEditingProductId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg">{mode === "add" ? "Agregar Producto" : "Editar Producto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Product Info */}
          <div className="p-3 bg-muted rounded-lg">
            <h3 className="font-medium text-sm">{product.name}</h3>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>Categoría: {product.category}</span>
              <span>•</span>
              <span>Precio: {formatCurrency(product.price, "Bs")}</span>
            </div>
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
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Atributos Personalizados
              </Label>
              {categoryAttrs.map((attr: any) => {
                // IMPORTANTE: Usar título como clave
                const attrKey = attr.title || attr?.id?.toString();
                if (!attrKey) {
                  return null;
                }
                const inputId = `attr-${attrKey}`;
                // Buscar por título primero, luego por ID (compatibilidad)
                const attrValue =
                  attributes[attrKey] ??
                  (attr.id ? attributes[attr.id.toString()] : undefined);

                // Función helper para convertir ajuste a Bs
                const convertAdjustmentToBs = (adjustment: number, currency?: string): number => {
                  if (!currency || currency === "Bs") return adjustment;
                  if (currency === "USD" && exchangeRates?.USD?.rate) {
                    return adjustment * exchangeRates.USD.rate;
                  }
                  if (currency === "EUR" && exchangeRates?.EUR?.rate) {
                    return adjustment * exchangeRates.EUR.rate;
                  }
                  return adjustment; // Si no hay tasa, usar valor original
                };

                // Función helper para obtener el ajuste de precio de un valor
                const getPriceAdjustment = (value: string | AttributeValue): number => {
                  if (typeof value === "object" && "priceAdjustment" in value) {
                    const adjustment = value.priceAdjustment || 0;
                    const currency = value.priceAdjustmentCurrency || "Bs";
                    return convertAdjustmentToBs(adjustment, currency);
                  }
                  return 0;
                };

                // Calcular ajuste total para selección múltiple
                const calculateTotalAdjustment = (): number => {
                  if (Array.isArray(attrValue)) {
                    return attrValue.reduce((total, valStr) => {
                      const selectedValue = attr.values?.find((val: string | AttributeValue) => {
                        const valStr2 = getValueString(val);
                        return valStr2 === valStr;
                      });
                      return total + (selectedValue ? getPriceAdjustment(selectedValue) : 0);
                    }, 0);
                  } else if (attrValue !== undefined) {
                    const selectedValue = attr.values?.find((val: string | AttributeValue) => {
                      const valStr = getValueString(val);
                      return valStr === attrValue?.toString();
                    });
                    return selectedValue ? getPriceAdjustment(selectedValue) : 0;
                  }
                  return 0;
                };
                const selectedAdjustment = calculateTotalAdjustment();

                return (
                  <div key={attr.id ?? attr.title} className="space-y-2">
                    <Label htmlFor={inputId}>
                      {attr.title}
                      {/* Indicador visual de campo obligatorio */}
                      {(attr.valueType === "Select" || 
                        attr.valueType === "Multiple select" || 
                        attr.valueType === "Product" ||
                        attr.valueType === "Number") && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    {attr.description && (
                      <p className="text-xs text-muted-foreground">{attr.description}</p>
                    )}
                    
                    {/* Mostrar mensaje de advertencia si el atributo está vacío */}
                    {(() => {
                      // Buscar por título primero (clave actual), luego por ID (compatibilidad)
                      const attrValue = attributes[attrKey] ?? (attr.id ? attributes[attr.id.toString()] : undefined);
                      const isEmpty = 
                        (attr.valueType === "Select" && (attrValue === undefined || attrValue === "" || attrValue === null)) ||
                        (attr.valueType === "Multiple select" && (!Array.isArray(attrValue) || attrValue.length === 0)) ||
                        (attr.valueType === "Product" && (!productAttributes[attrKey] || productAttributes[attrKey].length === 0));
                      
                      return isEmpty ? (
                        <p className="text-xs text-red-500 mt-1 font-medium">
                          ⚠️ Este atributo es obligatorio
                        </p>
                      ) : null;
                    })()}
                    
                    {attr.valueType === "Select" ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={
                            attrValue !== undefined && !Array.isArray(attrValue) ? attrValue.toString() : ""
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
                            {formattedAttributeAdjustments[attrKey] || formatCurrency(selectedAdjustment, "Bs")}
                          </span>
                        )}
                      </div>
                    ) : attr.valueType === "Multiple select" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value=""
                            disabled={(() => {
                              const currentArray = Array.isArray(attrValue) ? attrValue : [];
                              const maxSelections = attr.maxSelections !== undefined ? attr.maxSelections : Infinity;
                              return maxSelections !== Infinity && currentArray.length >= maxSelections;
                            })()}
                            onValueChange={(val) => {
                              const currentArray = Array.isArray(attrValue) ? attrValue : [];
                              const maxSelections = attr.maxSelections !== undefined ? attr.maxSelections : Infinity;
                              
                              // Validar maxSelections
                              if (maxSelections !== Infinity && currentArray.length >= maxSelections && !currentArray.includes(val)) {
                                toast.error(`Solo puedes seleccionar máximo ${maxSelections} opción${maxSelections > 1 ? 'es' : ''}`);
                                return;
                              }
                              
                              if (!currentArray.includes(val)) {
                                handleAttributeChange(attrKey, [...currentArray, val]);
                              }
                            }}
                          >
                            <SelectTrigger className={`flex-1 ${(() => {
                              const currentArray = Array.isArray(attrValue) ? attrValue : [];
                              const maxSelections = attr.maxSelections !== undefined ? attr.maxSelections : Infinity;
                              return maxSelections !== Infinity && currentArray.length >= maxSelections ? "opacity-50 cursor-not-allowed" : "";
                            })()}`}>
                              <SelectValue placeholder={(() => {
                                const currentArray = Array.isArray(attrValue) ? attrValue : [];
                                const maxSelections = attr.maxSelections !== undefined ? attr.maxSelections : Infinity;
                                return maxSelections !== Infinity && currentArray.length >= maxSelections 
                                  ? `Máximo alcanzado (${maxSelections})` 
                                  : "Seleccione opciones";
                              })()} />
                            </SelectTrigger>
                            <SelectContent>
                              {attr.values
                                ?.map(getValueString)
                                .filter((optionValue: string) => {
                                  const currentArray = Array.isArray(attrValue) ? attrValue : [];
                                  return !currentArray.includes(optionValue);
                                })
                                .map((optionValue: string) => {
                                  const option = attr.values?.find((v: string | AttributeValue) => getValueString(v) === optionValue);
                                  const optionLabel = option ? getValueLabel(option) : optionValue;
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
                              {formattedAttributeAdjustments[attrKey] || formatCurrency(selectedAdjustment, "Bs")}
                            </span>
                          )}
                        </div>
                        {Array.isArray(attrValue) && attrValue.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attrValue.map((val: string) => {
                              const option = attr.values?.find((v: string | AttributeValue) => getValueString(v) === val);
                              const displayLabel = option ? getValueLabel(option) : val;
                              return (
                                <div
                                  key={val}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm cursor-pointer hover:bg-secondary/80"
                                  onClick={() => {
                                    const currentArray = Array.isArray(attrValue) ? attrValue : [];
                                    handleAttributeChange(
                                      attrKey,
                                      currentArray.filter((v: string) => v !== val)
                                    );
                                  }}
                                >
                                  {displayLabel}
                                  <span className="text-xs">×</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {attr.maxSelections && (
                          <p className="text-xs text-muted-foreground">
                            Máximo {attr.maxSelections} selección{attr.maxSelections > 1 ? 'es' : ''} permitida{attr.maxSelections > 1 ? 's' : ''}
                            {Array.isArray(attrValue) && ` (${attrValue.length}/${attr.maxSelections})`}
                          </p>
                        )}
                      </div>
                    ) : attr.valueType === "Product" ? (
                      (() => {
                        const productsForAttribute = productAttributes[attrKey] || [];
                        
                        return (
                          <div className="space-y-2">
                            {productsForAttribute.length > 0 ? (
                              <div className="grid grid-cols-1 gap-2">
                                {productsForAttribute.map((productEntry) => {
                                  const missingProductAttributes = checkProductAttributeMissingMandatoryAttributes(productEntry);
                                  const hasMissingAttributes = missingProductAttributes.length > 0;
                                  
                                  return (
                                    <Card 
                                      key={`${attr.id}-${productEntry.productId}`} 
                                      className={`p-2 ${hasMissingAttributes ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20' : ''}`}
                                    >
                                      <CardContent className="p-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-xs leading-tight">{productEntry.product.name}</h4>
                                              <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                                <span>SKU: {productEntry.product.sku}</span>
                                                <span>•</span>
                                                <span>
                                                  {productPricesFormatted[productEntry.product.id] || 
                                                    formatCurrency(productEntry.product.price, productEntry.product.priceCurrency || "Bs")}
                                                </span>
                                                {productEntry.product.category && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="truncate">{productEntry.product.category}</span>
                                                  </>
                                                )}
                                              </div>
                                              {/* Mostrar advertencia si faltan atributos obligatorios */}
                                              {hasMissingAttributes && (
                                                <div className="mt-2 flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium">
                                                  <AlertTriangle className="h-3 w-3" />
                                                  <span>Faltan atributos obligatorios: {missingProductAttributes.join(", ")}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setSelectedProductForEdit(productEntry.product);
                                              setEditingAttributeId(attrKey);
                                              setEditingProductId(productEntry.productId);
                                            }}
                                            className="shrink-0 h-7 text-xs px-2"
                                          >
                                            <Settings className="h-3 w-3 mr-1" />
                                            Editar
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                      </div>
                            ) : (
                              <div className="text-xs text-muted-foreground text-center py-3 border rounded-lg">
                                No hay productos definidos para este atributo.
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <Input
                        id={inputId}
                        type="number"
                        min={attr.minValue !== undefined ? attr.minValue : undefined}
                        max={attr.maxValue !== undefined ? attr.maxValue : undefined}
                        value={attrValue && !Array.isArray(attrValue) ? attrValue.toString() : ""}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === "") {
                            handleAttributeChange(attrKey, "");
                            return;
                          }
                          
                          const parsedValue = parseFloat(inputValue);
                          if (isNaN(parsedValue)) {
                            return;
                          }
                          
                          // Validar rango
                          if (attr.minValue !== undefined && parsedValue < attr.minValue) {
                            toast.error(`El valor debe ser mayor o igual a ${attr.minValue}`);
                            return;
                          }
                          if (attr.maxValue !== undefined && parsedValue > attr.maxValue) {
                            toast.error(`El valor debe ser menor o igual a ${attr.maxValue}`);
                            return;
                          }
                          
                          handleAttributeChange(attrKey, parsedValue);
                        }}
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
            <Label htmlFor="productObservations" className="text-sm">Observaciones</Label>
            <Textarea
              id="productObservations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Agregar observaciones para este producto (opcional)"
              rows={2}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Notas específicas sobre este producto
            </p>
          </div>

          {/* Total */}
          <div className="p-3 bg-muted rounded-lg space-y-1.5">
            {(() => {
              // Usar los valores ya calculados del useEffect para evitar cálculos duplicados
              // Si aún no se han calculado, usar valores por defecto
              const basePriceInBs = calculatedBasePriceInBs || product.price;
              const basePriceWithAdjustments = calculatedBasePriceWithAdjustments || product.price;
              const productAttributesTotal = calculatedProductAttributesTotal || 0;
              const unitPrice = calculatedUnitPrice || product.price;
              const adjustment = calculatedAdjustment || 0;
              const total = unitPrice * quantity;

              return (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total:</span>
                    <span className="text-lg font-semibold">
                      {totalFormatted || formatCurrency(total, "Bs")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Precio base:</span>
                      <span>
                        {basePriceFormatted || 
                          (originalProduct 
                            ? formatCurrency(originalProduct.price, originalProduct.priceCurrency || "Bs")
                            : formatCurrency(product.price, "Bs")
                          )
                        }
                      </span>
                    </div>
                    {/* Mostrar cada atributo individualmente con su ajuste y valor seleccionado */}
                    {detailedAttributeAdjustments.length > 0 && (
                      <>
                        {detailedAttributeAdjustments.map((adj, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {adj.attributeName}
                              {adj.selectedValueLabel && ` (${adj.selectedValueLabel})`}:
                            </span>
                            <span
                              className={
                                adj.adjustment > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }
                            >
                              {adj.adjustment > 0 ? "+" : ""}
                              {adj.formattedAdjustment}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                    {/* Mostrar cada producto-atributo individualmente con su precio y ajustes */}
                    {detailedProductAttributeAdjustments.length > 0 && (
                      <>
                        {detailedProductAttributeAdjustments.map((productAttr, idx) => (
                          <div key={idx} className="space-y-1">
                            {/* Precio base del producto - SIEMPRE se muestra */}
                            <div className="flex justify-between">
                              <span>{productAttr.productName}:</span>
                              <span className="text-green-600 dark:text-green-400">
                                +{productAttr.formattedProductPrice}
                              </span>
                            </div>
                            {/* Ajustes de atributos del producto */}
                            {productAttr.productAdjustments.length > 0 && (
                              <>
                                {productAttr.productAdjustments.map((adj, adjIdx) => (
                                  <div key={adjIdx} className="flex justify-between pl-4 text-xs">
                                    <span className="text-muted-foreground">
                                      {productAttr.productName} - {adj.attributeName}
                                      {adj.selectedValueLabel && ` (${adj.selectedValueLabel})`}:
                                    </span>
                                    <span
                                      className={
                                        adj.adjustment > 0
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-red-600 dark:text-red-400"
                                      }
                                    >
                                      {adj.adjustment > 0 ? "+" : ""}
                                      {adj.formattedAdjustment}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t border-border">
                      <span>Precio unitario:</span>
                      <span>{unitPriceFormatted || formatCurrency(unitPrice, "Bs")}</span>
                    </div>
                    {quantity > 1 && (
                      <div className="flex justify-between text-xs pt-1">
                        <span>Cantidad:</span>
                        <span>{quantity} × {unitPriceFormatted || formatCurrency(unitPrice, "Bs")}</span>
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
    </>
  );
}
