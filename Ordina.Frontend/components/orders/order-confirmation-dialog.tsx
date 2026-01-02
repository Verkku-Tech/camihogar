"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Package,
  User,
  DollarSign,
  FileText,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type {
  OrderProduct,
  PartialPayment,
  Category,
  Product,
  AttributeValue,
} from "@/lib/storage";
import {
  formatCurrency,
  type Currency,
  convertFromBs,
} from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";
import { getCategories, getProducts } from "@/lib/storage";

// Función helper para obtener el monto original del pago en su moneda
const getOriginalPaymentAmount = (
  payment: PartialPayment,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } }
): { amount: number; currency: string } => {
  // Para Efectivo, el monto original está en cashReceived
  if (payment.method === "Efectivo" && payment.paymentDetails?.cashReceived) {
    return {
      amount: payment.paymentDetails.cashReceived,
      currency: payment.paymentDetails.cashCurrency || payment.currency || "Bs",
    };
  }
  
  // Si hay monto original guardado (para Pago Móvil y Transferencia)
  if (payment.paymentDetails?.originalAmount !== undefined) {
    return {
      amount: payment.paymentDetails.originalAmount,
      currency:
        payment.paymentDetails.originalCurrency || payment.currency || "Bs",
    };
  }
  
  // Fallback: calcular desde payment.amount (que está en Bs)
  const paymentCurrency = payment.currency || "Bs";
  if (paymentCurrency === "Bs") {
    return {
      amount: payment.amount,
      currency: "Bs",
    };
  }
  
  // Convertir de Bs a la moneda original usando la tasa guardada o actual
  const rate =
    payment.paymentDetails?.exchangeRate ||
    (paymentCurrency === "USD" 
      ? exchangeRates?.USD?.rate 
      : exchangeRates?.EUR?.rate);
  
  if (rate && rate > 0) {
    return {
      amount: payment.amount / rate,
      currency: paymentCurrency,
    };
  }
  
  // Si no hay tasa, devolver el amount en Bs
  return {
    amount: payment.amount,
    currency: "Bs",
  };
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
  originalCurrency: string;
}> => {
  if (!productAttributes || !category || !category.attributes) {
    return [];
  }

  const adjustments: Array<{ 
    attributeName: string; 
    selectedValueLabel: string;
    adjustment: number; 
    adjustmentInOriginalCurrency: number; 
    originalCurrency: string;
  }> = [];

  const convertAdjustmentToBs = (
    adjustment: number,
    currency?: string
  ): number => {
    if (!currency || currency === "Bs") return adjustment;
    
    // Verificar que exchangeRates esté disponible
    if (!exchangeRates) {
      console.warn("⚠️ exchangeRates no disponible para convertir ajuste");
      return adjustment;
    }
    
    if (currency === "USD") {
      const rate = exchangeRates.USD?.rate;
      if (rate && rate > 0) {
        const converted = adjustment * rate;
        console.log(
          `✅ Convertido ajuste: ${adjustment} ${currency} × ${rate} = ${converted} Bs`
        );
        return converted;
      } else {
        console.warn(
          `⚠️ No hay tasa USD disponible, usando valor original: ${adjustment}`
        );
        return adjustment;
      }
    }
    
    if (currency === "EUR") {
      const rate = exchangeRates.EUR?.rate;
      if (rate && rate > 0) {
        const converted = adjustment * rate;
        console.log(
          `✅ Convertido ajuste: ${adjustment} ${currency} × ${rate} = ${converted} Bs`
        );
        return converted;
      } else {
        console.warn(
          `⚠️ No hay tasa EUR disponible, usando valor original: ${adjustment}`
        );
        return adjustment;
      }
    }
    
    return adjustment;
  };

  const getValueLabel = (value: string | AttributeValue): string => {
    return typeof value === "string" ? value : value.label || value.id;
  };

  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    const categoryAttribute = category.attributes.find(
      (attr) => attr.id?.toString() === attrKey || attr.title === attrKey
    );

    if (!categoryAttribute || categoryAttribute.valueType === "Product") {
      return;
    }

    // Manejar atributos numéricos de forma especial
    if (categoryAttribute.valueType === "Number") {
      // Para atributos numéricos, el valor viene directamente de selectedValue
      // No hay valores predefinidos ni ajustes de precio
      const numericValue = selectedValue !== undefined && selectedValue !== null && selectedValue !== "" 
        ? selectedValue.toString() 
        : "";
      
      adjustments.push({
        attributeName: categoryAttribute.title || attrKey,
        selectedValueLabel: numericValue,
        adjustment: 0, // Los atributos numéricos no tienen ajuste de precio
        adjustmentInOriginalCurrency: 0,
        originalCurrency: "Bs",
      });
      return;
    }

    // Para otros tipos de atributos, necesitan values
    if (!categoryAttribute.values) {
      return;
    }

    let attributeAdjustment = 0;
    let adjustmentInOriginalCurrency = 0;
    let originalCurrency = "Bs";
    const selectedLabels: string[] = [];

    if (Array.isArray(selectedValue)) {
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values.find(
          (val: string | AttributeValue) => {
            if (typeof val === "string") {
              return val === valStr;
            }
            return val.id === valStr || val.label === valStr;
          }
        );

        if (attributeValue) {
          selectedLabels.push(getValueLabel(attributeValue));
          
          if (
            typeof attributeValue === "object" &&
            "priceAdjustment" in attributeValue
          ) {
            const adjustment = attributeValue.priceAdjustment || 0;
            const currency = attributeValue.priceAdjustmentCurrency || "Bs";
            console.log(
              `🔍 Atributo encontrado: ajuste=${adjustment}, moneda=${currency}, exchangeRates=`,
              exchangeRates
            );
            adjustmentInOriginalCurrency += adjustment;
            originalCurrency = currency;
            const convertedAdjustment = convertAdjustmentToBs(
              adjustment,
              currency
            );
            console.log(
              `💰 Ajuste convertido: ${adjustment} ${currency} → ${convertedAdjustment} Bs`
            );
            attributeAdjustment += convertedAdjustment;
          }
        }
      });
    } else {
      const selectedValueStr = selectedValue?.toString();
      if (selectedValueStr) {
        const attributeValue = categoryAttribute.values.find(
          (val: string | AttributeValue) => {
          if (typeof val === "string") {
            return val === selectedValueStr;
          }
            return (
              val.id === selectedValueStr || val.label === selectedValueStr
            );
          }
        );

        if (attributeValue) {
          selectedLabels.push(getValueLabel(attributeValue));
          
          if (
            typeof attributeValue === "object" &&
            "priceAdjustment" in attributeValue
          ) {
            const adjustment = attributeValue.priceAdjustment || 0;
            const currency = attributeValue.priceAdjustmentCurrency || "Bs";
            console.log(
              `🔍 Atributo encontrado (simple): ajuste=${adjustment}, moneda=${currency}, exchangeRates=`,
              exchangeRates
            );
            adjustmentInOriginalCurrency = adjustment;
            originalCurrency = currency;
            const convertedAdjustment = convertAdjustmentToBs(
              adjustment,
              currency
            );
            console.log(
              `💰 Ajuste convertido (simple): ${adjustment} ${currency} → ${convertedAdjustment} Bs`
            );
            attributeAdjustment = convertedAdjustment;
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

interface OrderConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  orderData: {
    clientName: string;
    clientTelefono?: string;
    clientTelefono2?: string;
    clientEmail?: string;
    clientRutId?: string;
    clientDireccion?: string;
    vendorName: string;
    referrerName?: string;
    products: OrderProduct[];
    subtotal: number;
    productDiscountTotal: number;
    generalDiscountAmount: number;
    taxAmount: number;
    deliveryCost: number;
    total: number;
    payments: PartialPayment[];
    paymentCondition?:
      | "cashea"
      | "pagara_en_tienda"
      | "pago_a_entrega"
      | "pago_parcial"
      | "todo_pago";
    saleType?:
      | "encargo"
      | "entrega"
      | "sistema_apartado";
    deliveryType?:
      | "entrega_programada"
      | "delivery_express"
      | "retiro_tienda"
      | "retiro_almacen";
    deliveryZone?:
      | "caracas"
      | "g_g"
      | "san_antonio_los_teques"
      | "caucagua_higuerote"
      | "la_guaira"
      | "charallave_cua"
      | "interior_pais";
    hasDelivery: boolean;
    deliveryAddress?: string;
    deliveryServices?: {
      deliveryExpress?: { enabled: boolean; cost: number; currency: Currency };
      servicioAcarreo?: { enabled: boolean; cost?: number; currency: Currency };
      servicioArmado?: { enabled: boolean; cost: number; currency: Currency };
    };
    observations?: string;
  };
}

type ConfirmationStep =
  | "general"
  | "products"
  | "observations"
  | "delivery"
  | "payments"
  | "totals";

export function OrderConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  orderData,
}: OrderConfirmationDialogProps) {
  const { exchangeRates, preferredCurrency } = useCurrency();
  const [currentStep, setCurrentStep] = useState<ConfirmationStep>("general");
  const [confirmedSteps, setConfirmedSteps] = useState<Set<ConfirmationStep>>(
    new Set()
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productBreakdowns, setProductBreakdowns] = useState<
    Record<
      string,
      {
    basePrice: string;
        basePriceInBs: number; // Valor numérico del precio base
        attributeAdjustments: Array<{
          name: string;
          value: string;
          adjustment: string;
          adjustmentInBs: number; // Valor numérico del ajuste
        }>;
        productAttributes: Array<{
          name: string;
          price: string;
          priceInBs: number; // Valor numérico del precio del producto
          adjustments: Array<{
            name: string;
            value: string;
            adjustment: string;
            adjustmentInBs: number; // Valor numérico del ajuste
          }>;
        }>;
    unitPrice: string;
    unitPriceInBs: number; // Valor numérico del precio unitario convertido a Bs
      }
    >
  >({});

  // Definir el orden de los pasos (solo 2 pasos: general y products)
  const steps: ConfirmationStep[] = [
    "general",
    "products",
  ];

  // Cargar categorías y productos al abrir el modal
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        try {
          const [loadedCategories, loadedProducts] = await Promise.all([
            getCategories(),
            getProducts(),
          ]);
          setCategories(loadedCategories);
          setAllProducts(loadedProducts);
        } catch (error) {
          console.error("Error loading data:", error);
        }
      };
      loadData();
    }
  }, [open]);

  // Calcular desglose de productos
  useEffect(() => {
    const calculateBreakdowns = async () => {
      if (categories.length === 0 || allProducts.length === 0) return;
      
      // Verificar que exchangeRates esté disponible
      if (!exchangeRates) {
        console.warn(
          "⚠️ exchangeRates no disponible, esperando a que se cargue..."
        );
        return;
      }
      console.log("📊 Calculando breakdowns con tasas:", exchangeRates);

      const breakdowns: Record<string, any> = {};

      for (const product of orderData.products) {
        const category = categories.find(
          (cat) => cat.name === product.category
        );
        if (!category) continue;

        // Obtener producto original
        const orderProductIdNum =
          typeof product.id === "string"
          ? Number.parseInt(product.id) 
          : product.id;
        const originalProduct = allProducts.find(
          (p) => p.id === orderProductIdNum
        );
        
        // Calcular precio base en Bs
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
          }
        }

        const basePriceFormatted = formatCurrency(basePriceInBs, "Bs");

        // Calcular ajustes de atributos normales
        const attributeAdjustments = calculateDetailedAttributeAdjustments(
          product.attributes || {},
          category,
          exchangeRates
        );

        const formattedAttributeAdjustments = attributeAdjustments.map(
          (adj) => ({
          name: adj.attributeName,
          value: adj.selectedValueLabel,
          adjustment: formatCurrency(adj.adjustment, "Bs"),
            adjustmentInBs: adj.adjustment, // Guardar el valor numérico
          })
        );

        // Calcular productos como atributos
        const productAttributes: Array<{
          name: string;
          price: string;
          priceInBs: number;
          adjustments: Array<{
            name: string;
            value: string;
            adjustment: string;
            adjustmentInBs: number;
          }>;
        }> = [];
        
        for (const attribute of category.attributes || []) {
          if (attribute.valueType === "Product") {
            const attrId = attribute.id?.toString() || attribute.title;
            if (!attrId) continue;

            const selectedProductsForAttr = product.attributes?.[attrId];
            if (
              !selectedProductsForAttr ||
              !Array.isArray(selectedProductsForAttr)
            )
              continue;

            for (const selectedProductId of selectedProductsForAttr) {
              const productIdNum =
                typeof selectedProductId === "string"
                ? Number.parseInt(selectedProductId) 
                : selectedProductId;
              const foundProduct = allProducts.find(
                (p) => p.id === productIdNum
              );
              if (!foundProduct) continue;

              const productPrice = foundProduct.price;
              const productCurrency = foundProduct.priceCurrency || "Bs";
              let productPriceInBs = productPrice;
              if (productCurrency !== "Bs") {
                const rate =
                  productCurrency === "USD"
                  ? exchangeRates?.USD?.rate 
                  : exchangeRates?.EUR?.rate;
                if (rate && rate > 0) {
                  productPriceInBs = productPrice * rate;
                }
              }
              const productPriceFormatted = formatCurrency(
                productPriceInBs,
                "Bs"
              );

              // Buscar atributos editados del producto-atributo
              const productAttributeKey = `${attrId}_${foundProduct.id}`;
              const editedAttributes =
                product.attributes?.[productAttributeKey];

              let productAttrAdjustments: Array<{
                name: string;
                value: string;
                adjustment: string;
                adjustmentInBs: number;
              }> = [];
              
              if (editedAttributes && typeof editedAttributes === "object") {
                const productCategory = categories.find(
                  (cat) => cat.name === foundProduct.category
                );
                if (productCategory) {
                  const rawAdjustments = calculateDetailedAttributeAdjustments(
                    editedAttributes,
                    productCategory,
                    exchangeRates
                  );
                  
                  productAttrAdjustments = rawAdjustments.map((adj) => ({
                    name: adj.attributeName,
                    value: adj.selectedValueLabel,
                    adjustment: formatCurrency(adj.adjustment, "Bs"),
                    adjustmentInBs: adj.adjustment, // Guardar el valor numérico
                  }));
                }
              }

              productAttributes.push({
                name: foundProduct.name,
                price: productPriceFormatted,
                priceInBs: productPriceInBs, // Guardar el valor numérico
                adjustments: productAttrAdjustments,
              });
            }
          }
        }

        // Calcular precio unitario
        let unitPriceInBs = basePriceInBs;
        attributeAdjustments.forEach((adj) => {
          unitPriceInBs += adj.adjustment;
        });
        
        // Sumar precios de productos como atributos
        for (const attribute of category.attributes || []) {
          if (attribute.valueType === "Product") {
            const attrId = attribute.id?.toString() || attribute.title;
            if (!attrId) continue;

            const selectedProductsForAttr = product.attributes?.[attrId];
            if (
              !selectedProductsForAttr ||
              !Array.isArray(selectedProductsForAttr)
            )
              continue;

            for (const selectedProductId of selectedProductsForAttr) {
              const productIdNum =
                typeof selectedProductId === "string"
                ? Number.parseInt(selectedProductId) 
                : selectedProductId;
              const foundProduct = allProducts.find(
                (p) => p.id === productIdNum
              );
              if (!foundProduct) continue;

              const productPrice = foundProduct.price;
              const productCurrency = foundProduct.priceCurrency || "Bs";
              let productPriceInBs = productPrice;
              if (productCurrency !== "Bs") {
                const rate =
                  productCurrency === "USD"
                  ? exchangeRates?.USD?.rate 
                  : exchangeRates?.EUR?.rate;
                if (rate && rate > 0) {
                  productPriceInBs = productPrice * rate;
                }
              }
              unitPriceInBs += productPriceInBs;

              // Sumar ajustes de atributos del producto
              const productAttributeKey = `${attrId}_${foundProduct.id}`;
              const editedAttributes =
                product.attributes?.[productAttributeKey];
              
              if (editedAttributes && typeof editedAttributes === "object") {
                const productCategory = categories.find(
                  (cat) => cat.name === foundProduct.category
                );
                if (productCategory) {
                  const rawAdjustments = calculateDetailedAttributeAdjustments(
                    editedAttributes,
                    productCategory,
                    exchangeRates
                  );
                  
                  rawAdjustments.forEach((adj) => {
                    unitPriceInBs += adj.adjustment;
                  });
                }
              }
            }
          }
        }

        const unitPriceFormatted = formatCurrency(unitPriceInBs, "Bs");

        breakdowns[product.id] = {
          basePrice: basePriceFormatted,
          basePriceInBs: basePriceInBs, // Guardar el valor numérico del precio base
          attributeAdjustments: formattedAttributeAdjustments,
          productAttributes,
          unitPrice: unitPriceFormatted,
          unitPriceInBs: unitPriceInBs, // Guardar el valor numérico convertido a Bs
        };
      }

      setProductBreakdowns(breakdowns);
    };

    calculateBreakdowns();
  }, [orderData.products, categories, allProducts, exchangeRates]);
  
  // Log cuando exchangeRates cambie
  useEffect(() => {
    if (exchangeRates) {
      console.log("✅ exchangeRates cargado en confirmación:", exchangeRates);
    } else {
      console.warn("⚠️ exchangeRates aún no disponible");
    }
  }, [exchangeRates]);

  // Resetear cuando se abre el modal
  useEffect(() => {
    if (open) {
      setCurrentStep("general");
      setConfirmedSteps(new Set());
    }
  }, [open]);

  // Función para obtener el orden de monedas según la preferencia
  const getCurrencyOrder = (): Currency[] => {
    if (preferredCurrency === "Bs") {
      return ["Bs", "USD", "EUR"];
    } else if (preferredCurrency === "USD") {
      return ["Bs", "USD", "EUR"];
    } else {
      return ["Bs", "EUR", "USD"];
    }
  };

  // Determinar qué monedas mostrar (Bs siempre, y la preferida si tiene tasa)
  const getAvailableCurrencies = (): Currency[] => {
    const currencies: Currency[] = ["Bs"];
    if (preferredCurrency !== "Bs") {
      const hasRate = preferredCurrency === "USD" 
        ? exchangeRates?.USD !== undefined 
        : exchangeRates?.EUR !== undefined;
      if (hasRate) {
        currencies.push(preferredCurrency);
      }
    }
    // Agregar la otra moneda si tiene tasa y no es la preferida
    if (preferredCurrency !== "USD" && exchangeRates?.USD) {
      currencies.push("USD");
    }
    if (preferredCurrency !== "EUR" && exchangeRates?.EUR) {
      currencies.push("EUR");
    }
    return currencies;
  };

  // Función helper para renderizar celda de moneda con USD arriba y Bs abajo
  const renderCurrencyCell = (amountInBs: number, className?: string) => {
    // Intentar convertir a USD si hay tasa disponible
    const usdRate = exchangeRates?.USD?.rate;
    
    if (usdRate && usdRate > 0) {
      const amountInUsd = amountInBs / usdRate;
      return (
        <TableCell className={`text-right ${className || ""}`}>
          <div className="font-medium">
            {formatCurrency(amountInUsd, "USD")}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatCurrency(amountInBs, "Bs")}
          </div>
        </TableCell>
      );
    }
    
    // Si no hay tasa USD, mostrar solo en Bs
    return (
      <TableCell className={`text-right ${className || ""}`}>
        <div className="font-medium">
          {formatCurrency(amountInBs, "Bs")}
        </div>
      </TableCell>
    );
  };

  // Función helper para renderizar celdas de moneda con signo negativo (descuentos)
  const renderCurrencyCellsNegative = (
    amountInBs: number,
    className?: string
  ) => {
    const availableCurrencies = getAvailableCurrencies();
    return getCurrencyOrder().map((currency) => {
      if (!availableCurrencies.includes(currency)) return null;

      let amount = amountInBs;
      let rate: number | undefined;

      if (currency === "USD") {
        rate = exchangeRates?.USD?.rate;
        if (rate) amount = amountInBs / rate;
      } else if (currency === "EUR") {
        rate = exchangeRates?.EUR?.rate;
        if (rate) amount = amountInBs / rate;
      }

      const defaultClass = className ? "" : "text-xs sm:text-sm";
      const finalClass = className || defaultClass;

      return (
        <TableCell key={currency} className={`text-right ${finalClass}`}>
          {currency !== "Bs" && !rate ? "-" : `-${formatCurrency(amount, currency)}`}
        </TableCell>
      );
    });
  };

  const currentStepIndex = steps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isStepConfirmed = confirmedSteps.has(currentStep);

  const handleConfirmStep = () => {
    const newConfirmedSteps = new Set(confirmedSteps);
    newConfirmedSteps.add(currentStep);
    setConfirmedSteps(newConfirmedSteps);

    // Avanzar al siguiente paso
    if (!isLastStep) {
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStep(steps[nextStepIndex]);
    } else {
      // Si es el último paso, confirmar el pedido
      onConfirm();
    }
  };

  const handleEdit = () => {
    // Cerrar modal y volver al formulario
    onCancel();
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      const prevStepIndex = currentStepIndex - 1;
      setCurrentStep(steps[prevStepIndex]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "general":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                {/* Columna izquierda: Información del Cliente */}
                <div className="space-y-3">
                <div>
                    <span className="text-sm text-muted-foreground">
                      Cliente:
                    </span>
                  <p className="font-medium">{orderData.clientName}</p>
                    {orderData.clientRutId && (
                      <p className="text-xs text-muted-foreground">
                        RUT/ID: {orderData.clientRutId}
                      </p>
                    )}
                </div>
                  {orderData.clientTelefono && (
                <div>
                      <span className="text-sm text-muted-foreground">
                        Teléfono del cliente:
                      </span>
                      <p className="font-medium">{orderData.clientTelefono}</p>
                      {orderData.clientTelefono2 && (
                        <p className="font-medium text-sm mt-1">{orderData.clientTelefono2}</p>
                      )}
                    </div>
                  )}
                  {orderData.clientEmail && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Email del cliente:
                      </span>
                      <p className="font-medium">{orderData.clientEmail}</p>
                    </div>
                  )}
                  {orderData.clientDireccion && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Dirección del cliente:
                      </span>
                      <p className="font-medium">{orderData.clientDireccion}</p>
                    </div>
                  )}
                </div>
                {/* Columna derecha: Información del Vendedor, Referidor y Tipo de Venta */}
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Vendedor:
                    </span>
                  <p className="font-medium">{orderData.vendorName}</p>
                </div>
                {orderData.referrerName && (
                  <div>
                      <span className="text-sm text-muted-foreground">
                        Referidor:
                      </span>
                    <p className="font-medium">{orderData.referrerName}</p>
                  </div>
                )}
                  {orderData.paymentCondition && (
                <div>
                      <span className="text-sm text-muted-foreground">
                        Condición de Pago:
                      </span>
                      <p className="font-medium">
                        {orderData.paymentCondition === "cashea"
                          ? "Cashea"
                          : orderData.paymentCondition === "pagara_en_tienda"
                          ? "Pagará en Tienda"
                          : orderData.paymentCondition === "pago_a_entrega"
                          ? "Pago a la entrega"
                          : orderData.paymentCondition === "pago_parcial"
                          ? "Pago Parcial"
                          : orderData.paymentCondition === "todo_pago"
                          ? "Todo Pago"
                          : orderData.paymentCondition}
                      </p>
                    </div>
                  )}
                  {orderData.saleType && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Tipo de Venta:
                      </span>
                      <p className="font-medium">
                        {orderData.saleType === "encargo"
                          ? "Encargo"
                          : orderData.saleType === "entrega"
                          ? "Entrega"
                          : orderData.saleType === "sistema_apartado"
                          ? "Sistema de Apartado"
                          : orderData.saleType}
                      </p>
                    </div>
                  )}
                  {orderData.deliveryType && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Tipo de Entrega:
                      </span>
                      <p className="font-medium">
                        {orderData.deliveryType === "entrega_programada"
                          ? "Entrega programada"
                          : orderData.deliveryType === "delivery_express"
                          ? "Delivery Express"
                          : orderData.deliveryType === "retiro_tienda"
                          ? "Retiro por Tienda"
                          : orderData.deliveryType === "retiro_almacen"
                          ? "Retiro por almacén"
                          : orderData.deliveryType}
                      </p>
                    </div>
                  )}
                  {orderData.deliveryZone && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Zona de Entrega:
                      </span>
                      <p className="font-medium">
                        {orderData.deliveryZone === "caracas"
                          ? "Caracas"
                          : orderData.deliveryZone === "g_g"
                          ? "G&G"
                          : orderData.deliveryZone === "san_antonio_los_teques"
                          ? "San Antonio-Los Teques"
                          : orderData.deliveryZone === "caucagua_higuerote"
                          ? "Caucagua-Higuerote"
                          : orderData.deliveryZone === "la_guaira"
                          ? "La Guaira"
                          : orderData.deliveryZone === "charallave_cua"
                          ? "Charallave-Cua"
                          : orderData.deliveryZone === "interior_pais"
                          ? "Interior del País"
                          : orderData.deliveryZone}
                      </p>
                    </div>
                  )}
                  {orderData.hasDelivery && orderData.deliveryServices && (
                    <div>
                      <span className="text-sm text-muted-foreground">
                        Servicios de Delivery:
                      </span>
                      <p className="font-medium">
                        {(() => {
                            const services: string[] = [];
                            if (orderData.deliveryServices.deliveryExpress?.enabled) {
                              services.push("Delivery Express");
                            }
                            if (orderData.deliveryServices.servicioAcarreo?.enabled) {
                              services.push("Servicio de Acarreo");
                            }
                            if (orderData.deliveryServices.servicioArmado?.enabled) {
                              services.push("Servicio de Armado");
                            }
                            return services.length > 0 ? services.join(", ") : "Sin servicios específicos";
                          })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "products":
        const availableCurrenciesProducts = getAvailableCurrencies();
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-4 h-4" />
                Productos ({orderData.products.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderData.products.map((product, idx) => {
                  const breakdown = productBreakdowns[product.id];
                  return (
                    <div key={idx} className="border rounded-lg p-4">
                      {/* Estado de ubicación */}
                      <div className="mb-3 pb-3 border-b">
                        {(() => {
                          let badgeText = "Sin definir";
                          let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
                          let badgeClassName = "text-sm";

                          if (product.locationStatus === "EN TIENDA") {
                            badgeText = "En Tienda";
                            badgeVariant = "default";
                          } else if (product.locationStatus === "FABRICACION") {
                            if (product.manufacturingStatus === "fabricado") {
                              badgeText = "Fabricado";
                              badgeVariant = "default";
                              badgeClassName = "text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
                            } else if (product.manufacturingStatus === "fabricando") {
                              badgeText = "En Fabricación";
                              badgeVariant = "secondary";
                              badgeClassName = "text-sm bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
                            } else {
                              badgeText = "Mandar a Fabricar";
                              badgeVariant = "destructive";
                            }
                          }

                          return (
                            <Badge 
                              variant={badgeVariant}
                              className={badgeClassName}
                            >
                              {badgeText}
                            </Badge>
                          );
                        })()}
                      </div>
                      
                      <div className="mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">
                            {product.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Cantidad: {product.quantity}
                          </p>
                        </div>
                      </div>

                      {/* Atributos del producto */}
                      {product.attributes && Object.keys(product.attributes).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium mb-2">Atributos:</p>
                          <div className="text-sm">
                            {(() => {
                              const category = categories.find(c => 
                                c.name === product.category
                              );
                              
                              // Función helper para obtener el label del valor desde los values del atributo
                              const getAttributeValueLabel = (
                                selectedValue: any,
                                categoryAttribute: Category["attributes"][0] | undefined
                              ): string => {
                                if (!categoryAttribute) {
                                  return String(selectedValue);
                                }

                                // Si es un atributo numérico, mostrar el valor directamente
                                if (categoryAttribute.valueType === "Number") {
                                  return selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
                                    ? selectedValue.toString()
                                    : "";
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
                                      labels.push(typeof attributeValue === "string" ? attributeValue : attributeValue.label || attributeValue.id || String(attributeValue));
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
                                      return typeof attributeValue === "string" 
                                        ? attributeValue 
                                        : attributeValue.label || attributeValue.id || String(attributeValue);
                                    }
                                  }
                                  return String(selectedValue);
                                }
                              };
                              
                              // Recopilar todos los valores de atributos en una sola línea
                              const attributeValues: string[] = [];
                              
                              // Primero, identificar qué atributos son de tipo Product para excluirlos
                              const productAttributeKeys = new Set<string>();
                              category?.attributes?.forEach(attr => {
                                if (attr.valueType === "Product") {
                                  const attrId = attr.id?.toString() || attr.title;
                                  if (attrId) {
                                    productAttributeKeys.add(attrId);
                                  }
                                }
                              });
                              
                              Object.entries(product.attributes).forEach(([key, value]) => {
                                // Ignorar atributos de tipo Product (se manejan por separado)
                                if (productAttributeKeys.has(key)) {
                                  return;
                                }
                                
                                // Ignorar claves que son para atributos editados de productos-atributos (formato: attrId_productId)
                                if (key.includes("_")) {
                                  const parts = key.split("_");
                                  if (parts.length === 2 && !isNaN(Number(parts[1])) && productAttributeKeys.has(parts[0])) {
                                    return;
                                  }
                                }
                                
                                const categoryAttribute = category?.attributes?.find(
                                  attr => (attr.id?.toString() === key || attr.title === key) && attr.valueType !== "Product"
                                );
                                
                                const valueLabel = getAttributeValueLabel(value, categoryAttribute);
                                if (valueLabel && valueLabel.trim() !== "" && valueLabel !== "-") {
                                  attributeValues.push(valueLabel.trim());
                                }
                              });
                              
                              return attributeValues.length > 0 
                                ? attributeValues.join(" + ")
                                : "Sin atributos";
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Observaciones del producto */}
                      {product.observations && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
                            Observación de este producto:
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-wrap">
                            {product.observations}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Resumen del pedido */}
              <div className="mt-6 pt-6 border-t">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Resumen del Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {/* Total pagado */}
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm">
                            Total pagado:
                          </TableCell>
                          {renderCurrencyCell(
                            orderData.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
                            "font-semibold"
                          )}
                        </TableRow>

                        {/* Total del pedido */}
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm">
                            Total del pedido:
                          </TableCell>
                          {renderCurrencyCell(orderData.total)}
                        </TableRow>

                        {/* Resta por pagar */}
                        <TableRow className="font-semibold border-t">
                          <TableCell className="text-xs sm:text-sm">
                            Falta:
                          </TableCell>
                          {renderCurrencyCell(
                            orderData.total - orderData.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
                            "text-sm sm:text-base font-semibold"
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        );

      // Casos eliminados: observations, delivery, payments, totals
      // Solo quedan: general y products
      case "observations":
      case "delivery":
      case "payments":
      case "totals":
        return null;

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Confirmar Creación de Pedido
            <Badge variant="outline" className="ml-2">
              Paso {currentStepIndex + 1} de {steps.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Indicador de progreso */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((step, idx) => (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div
                className={`flex-1 h-2 rounded transition-colors ${
                idx < currentStepIndex 
                  ? confirmedSteps.has(step) 
                    ? "bg-green-500" 
                    : "bg-blue-500"
                  : idx === currentStepIndex
                  ? "bg-blue-500"
                  : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        <div className="min-h-[400px]">{renderStepContent()}</div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button variant="outline" onClick={handlePrevious}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            )}
            <Button variant="outline" onClick={handleEdit}>
              Editar
            </Button>
          </div>
          <Button 
            onClick={handleConfirmStep} 
            className="bg-green-600 hover:bg-green-700"
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar y Crear Pedido
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar y Continuar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
