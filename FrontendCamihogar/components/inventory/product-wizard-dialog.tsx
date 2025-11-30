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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Package, Tag, Settings } from "lucide-react";
import { toast } from "sonner";
import {
  getCategories,
  addProduct,
  getProducts,
  type Category,
  type AttributeValue,
  type Product,
} from "@/lib/storage";
import { formatCurrency, getActiveExchangeRates, convertProductPriceToBs } from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";

interface ProductWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: () => void;
}

interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  price: string;
  priceCurrency: "Bs" | "USD" | "EUR";
  category: string;
  status: string;
  attributes: { [attributeId: string]: any };
}

interface CategoryAttribute {
  id: string;
  title: string;
  description: string;
  valueType: "Product" | "Number" | "Select" | "Multiple select";
  values: string[] | AttributeValue[];
  maxSelections?: number;
  required?: boolean;
}

// Helper functions to normalize attribute values
const getValueString = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.id || value.label;
};

const getValueLabel = (value: string | AttributeValue): string => {
  return typeof value === "string" ? value : value.label || value.id;
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
  const [attributes, setAttributes] = useState<Record<string, any>>(initialAttributes);

  const handleAttributeChange = (attrKey: string, value: any) => {
    setAttributes((prev) => ({
      ...prev,
      [attrKey]: value,
    }));
  };

  const renderAttributeInput = (attribute: any, attrKey: string) => {
    const attrValue = attributes[attrKey] ?? (attribute.title ? attributes[attribute.title] : undefined);

    switch (attribute.valueType) {
      case "Number":
        return (
          <Input
            type="number"
            value={attrValue || ""}
            onChange={(e) => handleAttributeChange(attrKey, e.target.value)}
            placeholder="0"
          />
        );

      case "Select":
        return (
          <Select
            value={attrValue || ""}
            onValueChange={(val) => handleAttributeChange(attrKey, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Seleccione ${attribute.title?.toLowerCase() || "opción"}`} />
            </SelectTrigger>
            <SelectContent>
              {attribute.values?.map((option: string | AttributeValue) => {
                const optionValue = getValueString(option);
                const optionLabel = getValueLabel(option);
                return (
                  <SelectItem key={optionValue} value={optionValue}>
                    {optionLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );

      case "Multiple select":
        const selectedValues = Array.isArray(attrValue) ? attrValue : [];
        const maxSelections = attribute.maxSelections !== undefined ? attribute.maxSelections : Infinity;
        const isMaxReached = maxSelections !== Infinity && selectedValues.length >= maxSelections;

        return (
          <div className="space-y-2">
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
              <SelectTrigger className={isMaxReached ? "opacity-50 cursor-not-allowed" : ""}>
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
                  ?.map(getValueString)
                  .filter((optionValue: string) => !selectedValues.includes(optionValue))
                  .map((optionValue: string) => {
                    const option = attribute.values?.find(
                      (v: string | AttributeValue) => getValueString(v) === optionValue
                    );
                    const optionLabel = option ? getValueLabel(option) : optionValue;
                    return (
                      <SelectItem key={optionValue} value={optionValue}>
                        {optionLabel}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((val: string) => {
                  const option = attribute.values?.find(
                    (v: string | AttributeValue) => getValueString(v) === val
                  );
                  const displayLabel = option ? getValueLabel(option) : val;
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
    <div className="space-y-4">
      {/* Información del producto */}
      <div className="p-4 bg-muted rounded-lg">
        <h3 className="font-medium">{product.name}</h3>
        <p className="text-sm text-muted-foreground">
          SKU: {product.sku} • Precio: {formatCurrency(product.price, product.priceCurrency || "Bs")}
        </p>
      </div>

      {/* Atributos de la categoría del producto */}
      {category.attributes && category.attributes.length > 0 ? (
        <div className="space-y-4">
          <Label className="text-base font-medium">Atributos del Producto</Label>
          {category.attributes.map((attribute: any) => {
            const attrKey = attribute.id?.toString() || attribute.title;
            if (!attrKey) return null;

            return (
              <div key={attrKey} className="space-y-2">
                <Label htmlFor={`edit-attr-${attrKey}`}>{attribute.title}</Label>
                {attribute.description && (
                  <p className="text-sm text-muted-foreground">{attribute.description}</p>
                )}
                {renderAttributeInput(attribute, attrKey)}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Esta categoría no tiene atributos configurados.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(attributes)}>
          Guardar Atributos
        </Button>
      </div>
    </div>
  );
}

export function ProductWizardDialog({
  open,
  onOpenChange,
  onProductCreated,
}: ProductWizardDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    sku: "",
    description: "",
    price: "",
    priceCurrency: "Bs",
    category: "",
    status: "Disponible",
    attributes: {},
  });
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
  const [exchangeRates, setExchangeRates] = useState<{ USD?: any; EUR?: any }>({});
  const [priceEditedManually, setPriceEditedManually] = useState(false);
  const { formatWithPreference, preferredCurrency } = useCurrency();
  const [productPricesFormatted, setProductPricesFormatted] = useState<Record<number, string>>({});

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

  // Generar SKU automático cuando se abre el diálogo
  useEffect(() => {
    const generateSKU = async () => {
      try {
        const products = await getProducts();
        const nextNumber = products.length + 1;
        const sku = `PROD-${String(nextNumber).padStart(4, "0")}`;
        setFormData((prev) => ({ ...prev, sku }));
      } catch (error) {
        console.error("Error generating SKU:", error);
      }
    };

    if (open) {
      generateSKU();
      setPriceEditedManually(false); // Resetear flag cuando se abre el diálogo
      setProductAttributes({}); // Limpiar productos-atributos
    }
  }, [open]);

  const selectedCategory = categories.find(
    (cat) => cat.id.toString() === formData.category
  );

  // Cargar todos los productos una sola vez cuando se entra al paso 2
  useEffect(() => {
    if (currentStep !== 2 || productsLoaded) return;
    
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
  }, [currentStep, productsLoaded]);

  // Resetear cuando se sale del paso 2 o se cierra el diálogo
  useEffect(() => {
    if (currentStep !== 2 || !open) {
      setProductsLoaded(false);
      setAllProducts([]);
    }
  }, [currentStep, open]);

  // Crear un Map de productos para búsquedas rápidas
  const productsMap = useMemo(() => {
    const map = new Map<number, Product>();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  // Cargar productos desde los valores del atributo cuando se entra al paso 2 y productos están cargados
  useEffect(() => {
    if (!selectedCategory || currentStep !== 2 || !productsLoaded || allProducts.length === 0) return;

    const loadProductsFromAttributeValues = () => {
      for (const attribute of selectedCategory.attributes) {
        if (attribute.valueType === "Product" && attribute.values && attribute.values.length > 0) {
          const attrId = attribute.id?.toString() || attribute.title;
          
          // Verificar si ya está cargado para este atributo
          const existing = productAttributes[attrId];
          if (existing && existing.length > 0) {
            // Ya está cargado, continuar con el siguiente
            continue;
          }
          
          const productEntries: Array<{ productId: number; product: Product; attributes: Record<string, any> }> = [];
          
          // Procesar cada valor del atributo
          for (const value of attribute.values) {
            const attrValue = typeof value === "string" 
              ? { id: "", label: value, productId: undefined }
              : value as AttributeValue;
            
            if (attrValue.productId) {
              const foundProduct = productsMap.get(attrValue.productId);
              if (foundProduct) {
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
  }, [selectedCategory, currentStep, productsLoaded, productsMap]);

  // Formatear precios de productos-atributos cuando cambien
  useEffect(() => {
    const formatProductPrices = async () => {
      const prices: Record<number, string> = {};
      
      const uniqueProducts = new Set<number>();
      Object.values(productAttributes).forEach((entries) => {
        entries.forEach((entry) => {
          uniqueProducts.add(entry.product.id);
        });
      });
      
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

  // Ajustar automáticamente el precio cuando se agregan productos como atributos
  useEffect(() => {
    // Solo ajustar si el precio no fue editado manualmente y estamos en el paso 2
    if (priceEditedManually || currentStep !== 2 || !selectedCategory) return;

    const calculateSuggestedPrice = async () => {
      let totalPriceInBs = 0;

      // Sumar precios de todos los productos-atributos convertidos a Bs
      for (const attribute of selectedCategory.attributes || []) {
        if (attribute.valueType === "Product") {
          const attrId = attribute.id?.toString() || attribute.title;
          const productsForAttr = productAttributes[attrId] || [];
          
          for (const productEntry of productsForAttr) {
            const productPrice = productEntry.product.price;
            const productCurrency = productEntry.product.priceCurrency || "Bs";
            
            // Convertir a Bs si es necesario
            let productPriceInBs = productPrice;
            if (productCurrency !== "Bs") {
              if (productCurrency === "USD" && exchangeRates?.USD?.rate) {
                productPriceInBs = productPrice * exchangeRates.USD.rate;
              } else if (productCurrency === "EUR" && exchangeRates?.EUR?.rate) {
                productPriceInBs = productPrice * exchangeRates.EUR.rate;
              }
            }
            
            totalPriceInBs += productPriceInBs;
          }
        }
      }

      // Solo actualizar si hay productos-atributos y el precio sugerido es diferente del actual
      if (totalPriceInBs > 0) {
        const currentPriceInBs = parseFloat(formData.price) || 0;
        const currentCurrency = formData.priceCurrency || "Bs";
        
        // Convertir precio actual a Bs si está en otra moneda
        let currentPriceInBsConverted = currentPriceInBs;
        if (currentCurrency !== "Bs") {
          if (currentCurrency === "USD" && exchangeRates?.USD?.rate) {
            currentPriceInBsConverted = currentPriceInBs * exchangeRates.USD.rate;
          } else if (currentCurrency === "EUR" && exchangeRates?.EUR?.rate) {
            currentPriceInBsConverted = currentPriceInBs * exchangeRates.EUR.rate;
          }
        }

        // Solo actualizar si el precio sugerido es diferente (con una tolerancia pequeña)
        if (Math.abs(totalPriceInBs - currentPriceInBsConverted) > 0.01) {
          setFormData((prev) => ({
            ...prev,
            price: totalPriceInBs.toFixed(2),
            priceCurrency: "Bs",
          }));
        }
      }
    };

    calculateSuggestedPrice();
  }, [productAttributes, selectedCategory, currentStep, exchangeRates, priceEditedManually]);

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Si el usuario edita el precio manualmente, marcar como editado
    if (field === "price") {
      setPriceEditedManually(true);
    }
  };

  const handleAttributeChange = (attributeId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [attributeId]: value },
    }));
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const categoryName =
        categories.find((cat) => cat.id.toString() === formData.category)
          ?.name || "";

      // Si el SKU está vacío, generarlo automáticamente
      let skuToUse = formData.sku;
      if (!skuToUse || skuToUse.trim() === "") {
        const products = await getProducts();
        const nextNumber = products.length + 1;
        skuToUse = `PROD-${String(nextNumber).padStart(4, "0")}`;
      }

      await addProduct({
        name: formData.name,
        sku: skuToUse,
        category: categoryName,
        price: Number.parseFloat(formData.price) || 0,
        priceCurrency: formData.priceCurrency || "Bs",
        stock: 0, // Los productos se crean bajo demanda, no hay stock
        status: formData.status,
        attributes: formData.attributes,
      });

      onProductCreated?.();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error al guardar el producto");
    }

    onOpenChange(false);
    setCurrentStep(1);
    // Al resetear, generar nuevo SKU para el siguiente producto
    const generateNewSKU = async () => {
      try {
        const products = await getProducts();
        const nextNumber = products.length + 1;
        const sku = `PROD-${String(nextNumber).padStart(4, "0")}`;
        setFormData({
          name: "",
          sku,
          description: "",
          price: "",
          priceCurrency: "Bs",
          category: "",
          status: "Disponible",
          attributes: {},
        });
        setProductAttributes({});
        setPriceEditedManually(false);
      } catch (error) {
        console.error("Error generating SKU:", error);
        setFormData({
          name: "",
          sku: "",
          description: "",
          price: "",
          priceCurrency: "Bs",
          category: "",
          status: "Disponible",
          attributes: {},
        });
        setProductAttributes({});
        setPriceEditedManually(false);
      }
    };
    generateNewSKU();
  };

  const renderAttributeInput = (attribute: CategoryAttribute) => {
    const value = formData.attributes[attribute.id];

    switch (attribute.valueType) {
      case "Number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) =>
              handleAttributeChange(attribute.id, e.target.value)
            }
            placeholder="Ingrese un número"
          />
        );

      case "Select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => handleAttributeChange(attribute.id, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent>
              {attribute.values.map((option) => {
                const optionValue = getValueString(option);
                const optionLabel = getValueLabel(option);
                return (
                  <SelectItem key={optionValue} value={optionValue}>
                    {optionLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );

      case "Multiple select":
        const selectedValues = value || [];
        const maxSelections =
          attribute.maxSelections !== undefined
            ? attribute.maxSelections
            : Infinity;
        const isMaxReached =
          maxSelections !== Infinity && selectedValues.length >= maxSelections;
        return (
          <div className="space-y-2">
            <Select
              value=""
              disabled={isMaxReached}
              onValueChange={(val) => {
                if (!selectedValues.includes(val)) {
                  // Validar maxSelections
                  if (
                    maxSelections !== Infinity &&
                    selectedValues.length >= maxSelections
                  ) {
                    toast.error(
                      `Solo puedes seleccionar máximo ${maxSelections} opción${
                        maxSelections > 1 ? "es" : ""
                      }`
                    );
                    return;
                  }
                  handleAttributeChange(attribute.id, [...selectedValues, val]);
                }
              }}
            >
              <SelectTrigger
                className={isMaxReached ? "opacity-50 cursor-not-allowed" : ""}
              >
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
                  .map(getValueString)
                  .filter(
                    (optionValue) => !selectedValues.includes(optionValue)
                  )
                  .map((optionValue) => {
                    const option = attribute.values.find(
                      (v) => getValueString(v) === optionValue
                    );
                    const optionLabel = option
                      ? getValueLabel(option)
                      : optionValue;
                    return (
                      <SelectItem key={optionValue} value={optionValue}>
                        {optionLabel}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((val: string) => {
                  const option = attribute.values.find(
                    (v) => getValueString(v) === val
                  );
                  const displayLabel = option ? getValueLabel(option) : val;
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        handleAttributeChange(
                          attribute.id,
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
                Máximo {maxSelections} selección{maxSelections > 1 ? "es" : ""}{" "}
                permitida{maxSelections > 1 ? "s" : ""}
                {selectedValues.length > 0 &&
                  ` (${selectedValues.length}/${maxSelections})`}
              </p>
            )}
          </div>
        );

      case "Product":
        // Los productos se cargan automáticamente desde attribute.values
        const productsForAttribute = productAttributes[attribute.id] || [];
        
        return (
          <div className="space-y-3">
            {productsForAttribute.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {productsForAttribute.map((productEntry) => (
                  <Card key={`${attribute.id}-${productEntry.productId}`} className="p-3">
                    <CardContent className="p-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Package className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{productEntry.product.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              SKU: {productEntry.product.sku}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Precio: {productPricesFormatted[productEntry.product.id] || formatCurrency(productEntry.product.price, productEntry.product.priceCurrency || "Bs")}
                            </p>
                            {productEntry.product.category && (
                              <p className="text-xs text-muted-foreground">
                                Categoría: {productEntry.product.category}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProductForEdit(productEntry.product);
                            setEditingAttributeId(attribute.id);
                            setEditingProductId(productEntry.productId);
                          }}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Editar Atributos
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                No hay productos definidos para este atributo.
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

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

    // Actualizar en formData.attributes
    // Los atributos editados se guardan con las claves de los atributos de la categoría del producto
    // Usamos una estructura anidada para mantener los atributos por producto
    setFormData((prev) => {
      const newAttributes = { ...prev.attributes };
      
      // Guardar los atributos editados del producto con una clave única que combine attributeId y productId
      const productAttributeKey = `${attributeId}_${editingProductId}`;
      
      // Guardar los atributos editados con las claves correctas (usando los IDs de los atributos de la categoría)
      productCategoryForEdit.attributes.forEach((attr: any) => {
        const attrKey = attr.id?.toString() || attr.title;
        if (attrKey && editedAttributes[attrKey] !== undefined) {
          // Guardar en una estructura anidada: attributeId_productId -> { attrKey: value }
          if (!newAttributes[productAttributeKey]) {
            newAttributes[productAttributeKey] = {};
          }
          newAttributes[productAttributeKey][attrKey] = editedAttributes[attrKey];
        }
      });

      return {
        ...prev,
        attributes: newAttributes,
      };
    });

    setEditingAttributeId(null);
    setSelectedProductForEdit(null);
    setEditingProductId(null);
    toast.success("Atributos actualizados correctamente");
  };

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Atributos de {selectedProductForEdit?.name}</DialogTitle>
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
              className={`flex items-center space-x-2 ${
                currentStep >= 1 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                1
              </div>
              <span className="text-sm font-medium">Información Básica</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div
              className={`flex items-center space-x-2 ${
                currentStep >= 2 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
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
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Descripción del producto..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <Select
                      value={formData.priceCurrency || "Bs"}
                      onValueChange={(value: "Bs" | "USD" | "EUR") =>
                        handleInputChange("priceCurrency", value)
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
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      handleInputChange("category", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={category.id.toString()}
                          >
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
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponible">Disponible</SelectItem>
                    <SelectItem value="Agotado">Agotado</SelectItem>
                    <SelectItem value="Descontinuado">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {selectedCategory ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="w-4 h-4" />
                    <h3 className="text-lg font-semibold">
                      Atributos de {selectedCategory.name}
                    </h3>
                  </div>

                  {selectedCategory.attributes.length > 0 ? (
                    <div className="space-y-4">
                      {selectedCategory.attributes.map((attribute) => (
                        <div key={attribute.id} className="space-y-2">
                          <Label htmlFor={`attr-${attribute.id}`}>
                            {attribute.title}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {attribute.description}
                          </p>
                          {renderAttributeInput({
                            id: attribute.id.toString(),
                            title: attribute.title,
                            description: attribute.description,
                            valueType: attribute.valueType as
                              | "Product"
                              | "Number"
                              | "Select"
                              | "Multiple select",
                            values: attribute.values,
                            maxSelections: attribute.maxSelections,
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
                  <p>
                    Seleccione una categoría en el paso anterior para ver los
                    atributos.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            {currentStep < 2 ? (
              <Button
                onClick={handleNext}
                disabled={
                  !formData.name || !formData.price || !formData.category
                }
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
    </>
  );
}
