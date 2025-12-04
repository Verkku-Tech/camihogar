"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";
import { getCategories, updateProduct, getProducts, type Category, type AttributeValue, type Product } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/currency-utils";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/currency-context";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSave?: () => void;
}

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
                const optionValue = typeof option === "string" ? option : option.id || option.label;
                const optionLabel = typeof option === "string" ? option : option.label || option.id;
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

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: EditProductDialogProps) {
  const { preferredCurrency } = useCurrency();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    priceCurrency: preferredCurrency as "Bs" | "USD" | "EUR",
    category: "",
    status: "",
    sku: "",
    attributes: {} as Record<string, any>,
  });

  const [categories, setCategories] = useState<Category[]>([]);
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
        priceCurrency: product.priceCurrency || preferredCurrency,
        category: product.category || "",
        status: product.status || "",
        sku: product.sku || "",
        attributes: normalizedAttributes,
      });
    } else if (product && open) {
      // Si no hay categorías cargadas aún, usar atributos directos
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price && product.price !== 0 ? product.price.toString() : "",
        priceCurrency: product.priceCurrency || preferredCurrency,
        category: product.category || "",
        status: product.status || "",
        sku: product.sku || "",
        attributes: product.attributes || {},
      });
    }
  }, [product, open, categories]);

  const selectedCategory = categories.find(
    (cat) => cat.name === formData.category
  );

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
    }
  }, [open]);

  // Crear un Map de productos para búsquedas rápidas
  const productsMap = useMemo(() => {
    const map = new Map<number, Product>();
    allProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProducts]);

  // Cargar productos desde los valores del atributo cuando se abre el diálogo y productos están cargados
  useEffect(() => {
    if (!selectedCategory || !open || !productsLoaded || allProducts.length === 0) return;
    
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
  }, [selectedCategory, open, productsLoaded, productsMap]); // Removido formData.attributes de las dependencias

  // Actualizar atributos editados cuando cambian (separado de la carga inicial)
  useEffect(() => {
    if (!selectedCategory || !productsLoaded) return;
    
    setProductAttributes((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      
      for (const attribute of selectedCategory.attributes) {
        if (attribute.valueType === "Product") {
          const attrId = attribute.id?.toString() || attribute.title;
          const existing = updated[attrId];
          
          if (existing && existing.length > 0) {
            const updatedEntries = existing.map((entry) => {
              const productAttributeKey = `${attrId}_${entry.productId}`;
              const editedAttributes = formData.attributes[productAttributeKey] || entry.product.attributes || {};
              
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
              updated[attrId] = updatedEntries;
            }
          }
        }
      }
      
      return hasChanges ? updated : prev;
    });
  }, [formData.attributes, selectedCategory, productsLoaded]); // Este se ejecuta solo cuando formData.attributes cambia

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

      await updateProduct(product.id, {
        name: formData.name,
        price: price,
        priceCurrency: formData.priceCurrency || preferredCurrency,
        stock: 0, // Los productos se crean bajo demanda, no hay stock
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
      toast.error("Error al guardar el producto");
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
    // Los atributos editados se guardan con una clave única que combine attributeId y productId
    setFormData((prev) => {
      const newAttributes = { ...prev.attributes };
      const productAttributeKey = `${attributeId}_${editingProductId}`;
      
      // Guardar los atributos editados con las claves correctas
      productCategoryForEdit.attributes.forEach((attr: any) => {
        const attrKey = attr.id?.toString() || attr.title;
        if (attrKey && editedAttributes[attrKey] !== undefined) {
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

  if (!product) return null;

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
            <DialogDescription>
              Modifica los atributos específicos de este producto.
            </DialogDescription>
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <DialogDescription>
            Modifica los detalles del producto. Los cambios se guardarán en la base de datos.
          </DialogDescription>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio</Label>
                <div className="flex gap-2">
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                    className="flex-1"
                  />
                  <Select
                    value={formData.priceCurrency || preferredCurrency}
                    onValueChange={(value: "Bs" | "USD" | "EUR") =>
                      setFormData((prev) => ({ ...prev, priceCurrency: value }))
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
                    <SelectItem value="Agotado">Agotado</SelectItem>
                    <SelectItem value="Descontinuado">Descontinuado</SelectItem>
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

                    {attribute.valueType === "Product" && (() => {
                      const productsForAttribute = productAttributes[attrKey] || [];
                      
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
                                            Precio: {formatCurrency(productEntry.product.price, productEntry.product.priceCurrency || "Bs")}
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
                                          setEditingAttributeId(attrKey);
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
                    })()}

                    {attribute.valueType === "Multiple select" && (
                      <div className="space-y-2">
                        {(() => {
                          const currentArray = Array.isArray(currentValue) ? currentValue : [];
                          const maxSelections = attribute.maxSelections !== undefined ? attribute.maxSelections : Infinity;
                          
                          return (
                            <>
                              {attribute.values.map((value) => {
                                const valueStr = getValueString(value);
                                const valueLabel = getValueLabel(value);
                                const isSelected = currentArray.includes(valueStr);
                                const isDisabled = maxSelections !== Infinity && !isSelected && currentArray.length >= maxSelections;

                                return (
                                  <label 
                                    key={valueStr} 
                                    className={`flex items-center space-x-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // Validar maxSelections
                                          if (maxSelections !== Infinity && currentArray.length >= maxSelections) {
                                            toast.error(`Solo puedes seleccionar máximo ${maxSelections} opción${maxSelections > 1 ? 'es' : ''}`);
                                            return;
                                          }
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
                              {maxSelections !== Infinity && (
                                <p className="text-xs text-muted-foreground">
                                  Máximo {maxSelections} selección{maxSelections > 1 ? 'es' : ''} permitida{maxSelections > 1 ? 's' : ''}
                                  {currentArray.length > 0 && ` (${currentArray.length}/${maxSelections})`}
                                </p>
                              )}
                            </>
                          );
                        })()}
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
    </>
  );
}
