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

    if (
      !categoryAttribute ||
      !categoryAttribute.values ||
      categoryAttribute.valueType === "Product"
    ) {
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

    if (attributeAdjustment !== 0) {
      adjustments.push({
        attributeName: categoryAttribute.title || attrKey,
        selectedValueLabel: selectedLabels.join(", ") || "",
        adjustment: attributeAdjustment,
        adjustmentInOriginalCurrency,
        originalCurrency,
      });
    }
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
      | "delivery_express"
      | "encargo"
      | "encargo_entrega"
      | "entrega"
      | "retiro_almacen"
      | "retiro_tienda"
      | "sa";
    hasDelivery: boolean;
    deliveryAddress?: string;
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

  // Definir el orden de los pasos (solo incluir pasos que tienen datos)
  const steps: ConfirmationStep[] = [
    "general",
    "products",
    ...(orderData.observations ? (["observations"] as ConfirmationStep[]) : []),
    ...(orderData.hasDelivery && orderData.deliveryAddress ? (["delivery"] as ConfirmationStep[]) : []),
    "payments",
    "totals",
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

  // Función helper para renderizar celdas de moneda en el orden correcto
  const renderCurrencyCells = (amountInBs: number, className?: string) => {
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
          {currency !== "Bs" && !rate ? "-" : formatCurrency(amount, currency)}
        </TableCell>
      );
    });
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
                        {orderData.saleType === "delivery_express"
                          ? "Delivery Express"
                          : orderData.saleType === "encargo"
                          ? "Encargo"
                          : orderData.saleType === "encargo_entrega"
                          ? "Encargo/Entrega"
                          : orderData.saleType === "entrega"
                          ? "Entrega"
                          : orderData.saleType === "retiro_almacen"
                          ? "Retiro x almacén"
                          : orderData.saleType === "retiro_tienda"
                          ? "Retiro x tienda"
                          : orderData.saleType === "sa"
                          ? "SA"
                          : orderData.saleType}
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
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">
                            {product.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Cantidad: {product.quantity} ×{" "}
                            {breakdown
                              ? formatCurrency(breakdown.unitPriceInBs, "Bs")
                              : formatCurrency(product.price, "Bs")}
                            {preferredCurrency !== "Bs" && 
                             (preferredCurrency === "USD" ? exchangeRates?.USD : exchangeRates?.EUR) && (
                              <span className="ml-2">
                                ({(() => {
                                  const unitPriceInBs = breakdown
                                    ? breakdown.unitPriceInBs
                                    : product.price;
                                  const rate = preferredCurrency === "USD" 
                                    ? exchangeRates?.USD?.rate 
                                    : exchangeRates?.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return formatCurrency(unitPriceInBs / rate, preferredCurrency);
                                  }
                                  return "";
                                })()})
                              </span>
                            )}
                          </p>
                          {product.discount && product.discount > 0 && (
                            <p className="text-sm text-red-600 mt-1">
                              Descuento: -
                              {formatCurrency(product.discount, "Bs")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex flex-col items-end gap-1">
                          <p className="font-semibold text-lg">
                              {formatCurrency(
                                product.total - (product.discount || 0),
                                "Bs"
                              )}
                            </p>
                            {preferredCurrency !== "Bs" && 
                             (preferredCurrency === "USD" ? exchangeRates?.USD : exchangeRates?.EUR) && (
                              <p className="text-sm text-muted-foreground">
                                {(() => {
                                  const totalInBs = product.total - (product.discount || 0);
                                  const rate = preferredCurrency === "USD" 
                                    ? exchangeRates?.USD?.rate 
                                    : exchangeRates?.EUR?.rate;
                                  if (rate && rate > 0) {
                                    return formatCurrency(totalInBs / rate, preferredCurrency);
                                  }
                                  return "";
                                })()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desglose detallado de precio */}
                      {breakdown && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="font-semibold mb-3 text-sm">
                            Desglose de Precio:
                          </div>
                          {availableCurrenciesProducts.length > 1 ? (
                            // Mostrar tabla si hay múltiples monedas disponibles
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[200px]">
                                      Concepto
                                    </TableHead>
                                    {getCurrencyOrder().map((currency) => {
                                      if (availableCurrenciesProducts.includes(currency)) {
                                        return (
                                          <TableHead
                                            key={currency}
                                            className="text-right"
                                          >
                                            {currency}
                                          </TableHead>
                                        );
                                      }
                                      return null;
                                    })}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {/* Precio base */}
                                  <TableRow>
                                    <TableCell className="text-xs sm:text-sm">
                                      Precio base:
                                    </TableCell>
                                    {renderCurrencyCells(breakdown.basePriceInBs)}
                                  </TableRow>

                                  {/* Ajustes de atributos normales */}
                                  {breakdown.attributeAdjustments.length > 0 && (
                                    <>
                                      {breakdown.attributeAdjustments.map(
                                        (adj, adjIdx) => (
                                          <TableRow key={adjIdx}>
                                            <TableCell className="text-xs sm:text-sm text-muted-foreground pl-4">
                                              {adj.name}
                                              {adj.value ? ` (${adj.value})` : ""}:
                                            </TableCell>
                                            {renderCurrencyCells(
                                              adj.adjustmentInBs,
                                              "text-green-600 dark:text-green-400"
                                            )}
                                          </TableRow>
                                        )
                                      )}
                                    </>
                                  )}

                                  {/* Productos como atributos */}
                                  {breakdown.productAttributes.length > 0 && (
                                    <>
                                      {breakdown.productAttributes.map(
                                        (prodAttr, prodIdx) => (
                                          <>
                                            {/* Precio del producto */}
                                            <TableRow key={`${prodIdx}-price`}>
                                              <TableCell className="text-xs sm:text-sm text-muted-foreground pl-4">
                                                {prodAttr.name}:
                                              </TableCell>
                                              {renderCurrencyCells(
                                                prodAttr.priceInBs,
                                                "text-green-600 dark:text-green-400"
                                              )}
                                            </TableRow>
                                            {/* Ajustes de atributos del producto */}
                                            {prodAttr.adjustments.length > 0 && (
                                              <>
                                                {prodAttr.adjustments.map(
                                                  (adj, adjIdx) => (
                                                    <TableRow key={`${prodIdx}-adj-${adjIdx}`}>
                                                      <TableCell className="text-xs text-muted-foreground pl-8">
                                                        {prodAttr.name} - {adj.name}
                                                        {adj.value
                                                          ? ` (${adj.value})`
                                                          : ""}
                                                        :
                                                      </TableCell>
                                                      {renderCurrencyCells(
                                                        adj.adjustmentInBs,
                                                        "text-xs text-green-600 dark:text-green-400"
                                                      )}
                                                    </TableRow>
                                                  )
                                                )}
                                              </>
                                            )}
                                          </>
                                        )
                                      )}
                                    </>
                                  )}

                                  {/* Precio unitario final */}
                                  <TableRow className="font-semibold border-t-2">
                                    <TableCell className="text-sm sm:text-base">
                                      Precio unitario:
                                    </TableCell>
                                    {renderCurrencyCells(
                                      breakdown.unitPriceInBs,
                                      "text-sm sm:text-base font-semibold"
                                    )}
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            // Mostrar formato simple si solo hay Bs
                            <div className="space-y-2 text-sm">
                          {/* Precio base */}
                          <div className="flex justify-between">
                            <span>Precio base:</span>
                            <span>{breakdown.basePrice}</span>
                          </div>

                          {/* Ajustes de atributos normales */}
                          {breakdown.attributeAdjustments.length > 0 && (
                            <>
                                  {breakdown.attributeAdjustments.map(
                                    (adj, adjIdx) => (
                                      <div
                                        key={adjIdx}
                                        className="flex justify-between pl-4"
                                      >
                                  <span className="text-muted-foreground">
                                          {adj.name}
                                          {adj.value ? ` (${adj.value})` : ""}:
                                  </span>
                                  <span className="text-green-600 dark:text-green-400">
                                    +{adj.adjustment}
                                  </span>
                                </div>
                                    )
                                  )}
                            </>
                          )}

                          {/* Productos como atributos */}
                          {breakdown.productAttributes.length > 0 && (
                            <>
                                  {breakdown.productAttributes.map(
                                    (prodAttr, prodIdx) => (
                                <div key={prodIdx} className="space-y-1">
                                  {/* Precio del producto */}
                                  <div className="flex justify-between pl-4">
                                          <span className="text-muted-foreground">
                                            {prodAttr.name}:
                                          </span>
                                    <span className="text-green-600 dark:text-green-400">
                                      +{prodAttr.price}
                                    </span>
                                  </div>
                                  {/* Ajustes de atributos del producto */}
                                  {prodAttr.adjustments.length > 0 && (
                                    <>
                                            {prodAttr.adjustments.map(
                                              (adj, adjIdx) => (
                                                <div
                                                  key={adjIdx}
                                                  className="flex justify-between pl-8 text-xs"
                                                >
                                          <span className="text-muted-foreground">
                                                    {prodAttr.name} - {adj.name}
                                                    {adj.value
                                                      ? ` (${adj.value})`
                                                      : ""}
                                                    :
                                          </span>
                                          <span className="text-green-600 dark:text-green-400">
                                            +{adj.adjustment}
                                          </span>
                                        </div>
                                              )
                                            )}
                                    </>
                                  )}
                                </div>
                                    )
                                  )}
                            </>
                          )}

                          {/* Precio unitario final */}
                          <Separator className="my-2" />
                          <div className="flex justify-between font-semibold">
                            <span>Precio unitario:</span>
                            <span>{breakdown.unitPrice}</span>
                          </div>
                            </div>
                          )}
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
            </CardContent>
          </Card>
        );

      case "observations":
        return (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <FileText className="w-4 h-4" />
                Observaciones Generales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm bg-amber-50 dark:bg-amber-950 p-3 rounded whitespace-pre-wrap">
                {orderData.observations}
              </p>
            </CardContent>
          </Card>
        );

      case "delivery":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dirección de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{orderData.deliveryAddress}</p>
            </CardContent>
          </Card>
        );

      case "payments":
        const totalPaid = orderData.payments.reduce(
          (sum, p) => sum + (p.amount || 0),
          0
        );
        const pendingBalance = orderData.total - totalPaid;
        const availableCurrenciesPayments = getAvailableCurrencies();
        
        // Determinar la moneda predominante de los pagos
        let paymentCurrency: Currency | null = null;
        let paymentRate: number | null = null;
        
        if (orderData.payments.length > 0) {
          // Buscar el primer pago que no sea en Bs
          for (const payment of orderData.payments) {
            const originalPayment = getOriginalPaymentAmount(
              payment,
              exchangeRates
            );
            const currency = originalPayment.currency as Currency;
            
            if (currency !== "Bs") {
              paymentCurrency = currency;
              // Usar la tasa guardada del pago o la tasa actual
              paymentRate =
                payment.paymentDetails?.exchangeRate ||
                (currency === "USD"
                  ? exchangeRates?.USD?.rate
                  : exchangeRates?.EUR?.rate) ||
                null;
              break;
            }
          }
        }
        
        // Calcular el saldo pendiente en la moneda del pago si aplica
        let pendingBalanceInPaymentCurrency: string | null = null;
        if (
          pendingBalance > 0 &&
          paymentCurrency &&
          paymentRate &&
          paymentRate > 0
        ) {
          const convertedBalance = convertFromBs(
            pendingBalance,
            paymentCurrency,
            paymentRate
          );
          pendingBalanceInPaymentCurrency = formatCurrency(
            convertedBalance,
            paymentCurrency
          );
        }
        
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Pagos
              </CardTitle>
              {exchangeRates && (exchangeRates.USD || exchangeRates.EUR) && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tasas del día del pedido:{" "}
                  {exchangeRates.USD &&
                    `USD: ${formatCurrency(exchangeRates.USD.rate, "Bs")}`}
                  {exchangeRates.USD && exchangeRates.USD.effectiveDate && (
                    <span>
                      {" "}
                      (Fecha efectiva:{" "}
                      {new Date(
                        exchangeRates.USD.effectiveDate
                      ).toLocaleDateString()}
                      )
                    </span>
                  )}
                  {exchangeRates.USD && exchangeRates.EUR && " | "}
                  {exchangeRates.EUR &&
                    `EUR: ${formatCurrency(exchangeRates.EUR.rate, "Bs")}`}
                  {exchangeRates.EUR && exchangeRates.EUR.effectiveDate && (
                    <span>
                      {" "}
                      (Fecha efectiva:{" "}
                      {new Date(
                        exchangeRates.EUR.effectiveDate
                      ).toLocaleDateString()}
                      )
                    </span>
                  )}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderData.payments.map((payment, idx) => {
                  const originalPayment = getOriginalPaymentAmount(
                    payment,
                    exchangeRates
                  );
                  
                  // Obtener la tasa de cambio guardada del pago
                  const paymentExchangeRate =
                    payment.paymentDetails?.exchangeRate;
                  const paymentCurrency =
                    payment.currency || originalPayment.currency;
                  
                  return (
                    <div
                      key={idx}
                      className="space-y-1 border-b pb-2 last:border-0"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {payment.method} ({originalPayment.currency})
                        </span>
                        <span className="font-medium">
                          {formatCurrency(
                            originalPayment.amount,
                            originalPayment.currency as Currency
                          )}
                        </span>
                      </div>

                      {/* Mostrar tasa de cambio del día del pago si existe y no es en Bs */}
                      {paymentExchangeRate &&
                        paymentCurrency &&
                        paymentCurrency !== "Bs" && (
                          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded">
                            💱 Tasa de cambio del día del pago: 1{" "}
                            {paymentCurrency} ={" "}
                            {formatCurrency(paymentExchangeRate, "Bs")}
                            {payment.date && (
                              <span className="ml-2">
                                (Fecha del pago:{" "}
                                {new Date(payment.date).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        )}

                      {payment.date &&
                        (!paymentExchangeRate || paymentCurrency === "Bs") && (
                          <div className="text-xs text-muted-foreground">
                            Fecha: {new Date(payment.date).toLocaleDateString()}
                          </div>
                        )}
                    </div>
                  );
                })}
                
                {/* Tabla de resumen de pagos - Similar a la tabla de totales */}
                {availableCurrenciesPayments.length > 1 && (
                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">
                            Concepto
                          </TableHead>
                          {getCurrencyOrder().map((currency) => {
                            if (availableCurrenciesPayments.includes(currency)) {
                              return (
                                <TableHead
                                  key={currency}
                                  className="text-right"
                                >
                                  {currency}
                                </TableHead>
                              );
                            }
                            return null;
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Total pagado */}
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm">
                            <span className="font-semibold">
                              Total pagado:
                            </span>
                          </TableCell>
                          {renderCurrencyCells(
                            totalPaid,
                            "font-semibold"
                          )}
                        </TableRow>

                        {/* Total del pedido */}
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm">
                            Total del pedido:
                          </TableCell>
                          {renderCurrencyCells(orderData.total)}
                        </TableRow>

                        {/* Falta / Cambio / Estado */}
                        <TableRow
                          className={`font-semibold border-t ${
                            pendingBalance === 0
                              ? "text-green-600"
                              : pendingBalance > 0
                              ? "text-orange-600"
                              : "text-blue-600"
                          }`}
                        >
                          <TableCell className="text-sm sm:text-base">
                            {pendingBalance === 0
                              ? "Estado:"
                              : pendingBalance > 0
                              ? "Falta:"
                              : "Cambio/Vuelto:"}
                          </TableCell>
                          {renderCurrencyCells(
                            Math.abs(pendingBalance),
                            `text-sm sm:text-base font-semibold ${
                              pendingBalance === 0
                                ? "text-green-600"
                                : pendingBalance > 0
                                ? "text-orange-600"
                                : "text-blue-600"
                            }`
                          )}
                        </TableRow>
                      </TableBody>
                    </Table>
                    {pendingBalance === 0 && (
                      <p className="text-xs text-green-600 text-center mt-2">
                        (Pagado completo)
                      </p>
                    )}
                  </div>
                )}

                {/* Mostrar formato simple si solo hay Bs */}
                {availableCurrenciesPayments.length === 1 && (
                  <>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total Pagado:</span>
                      <span>{formatCurrency(totalPaid, "Bs")}</span>
                </div>

                {/* Mostrar saldo pendiente si existe */}
                {pendingBalance > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <span className="font-semibold text-red-700 dark:text-red-300">
                          Saldo Pendiente:
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-red-700 dark:text-red-300">
                          {formatCurrency(pendingBalance, "Bs")}
                        </div>
                        {pendingBalanceInPaymentCurrency && (
                          <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                            {pendingBalanceInPaymentCurrency}
                          </div>
                        )}
                      </div>
                    </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "totals":
        const availableCurrencies = getAvailableCurrencies();
        const subtotalBeforeDiscounts = orderData.subtotal +
          orderData.productDiscountTotal +
          orderData.generalDiscountAmount;

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent>
              {availableCurrencies.length > 1 ? (
                // Mostrar tabla si hay múltiples monedas disponibles
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">
                          Concepto
                        </TableHead>
                        {getCurrencyOrder().map((currency) => {
                          if (availableCurrencies.includes(currency)) {
                            return (
                              <TableHead
                                key={currency}
                                className="text-right"
                              >
                                {currency}
                              </TableHead>
                            );
                          }
                          return null;
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Subtotal productos */}
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm">
                          Subtotal productos:
                        </TableCell>
                        {renderCurrencyCells(subtotalBeforeDiscounts)}
                      </TableRow>

                      {/* Descuentos individuales */}
                      {orderData.productDiscountTotal > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm text-red-600">
                            Descuentos individuales:
                          </TableCell>
                          {renderCurrencyCellsNegative(
                            orderData.productDiscountTotal,
                            "text-red-600"
                          )}
                        </TableRow>
                      )}

                      {/* Descuento general */}
                      {orderData.generalDiscountAmount > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm text-red-600">
                            Descuento general:
                          </TableCell>
                          {renderCurrencyCellsNegative(
                            orderData.generalDiscountAmount,
                            "text-red-600"
                          )}
                        </TableRow>
                      )}

                      {/* Subtotal después de descuentos */}
                      <TableRow className="font-medium border-t">
                        <TableCell className="text-xs sm:text-sm">
                          Subtotal después de descuentos:
                        </TableCell>
                        {renderCurrencyCells(orderData.subtotal)}
                      </TableRow>

                      {/* Impuesto */}
                      <TableRow>
                        <TableCell className="text-xs sm:text-sm">
                          Impuesto (16%):
                        </TableCell>
                        {renderCurrencyCells(orderData.taxAmount)}
                      </TableRow>

                      {/* Gastos de entrega */}
                      {orderData.deliveryCost > 0 && (
                        <TableRow>
                          <TableCell className="text-xs sm:text-sm">
                            Delivery:
                          </TableCell>
                          {renderCurrencyCells(orderData.deliveryCost)}
                        </TableRow>
                      )}

                      {/* Total */}
                      <TableRow className="font-semibold border-t-2">
                        <TableCell className="text-base sm:text-lg">
                          Total:
                        </TableCell>
                        {renderCurrencyCells(
                          orderData.total,
                          "text-base sm:text-lg font-semibold"
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Mostrar formato simple si solo hay Bs
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                    <span>
                      {formatCurrency(subtotalBeforeDiscounts, "Bs")}
                    </span>
                </div>
                {orderData.productDiscountTotal > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuentos individuales:</span>
                      <span>
                        -{formatCurrency(orderData.productDiscountTotal, "Bs")}
                      </span>
                  </div>
                )}
                {orderData.generalDiscountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento general:</span>
                      <span>
                        -{formatCurrency(orderData.generalDiscountAmount, "Bs")}
                      </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Subtotal después de descuentos:</span>
                  <span>{formatCurrency(orderData.subtotal, "Bs")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuesto (16%):</span>
                  <span>{formatCurrency(orderData.taxAmount, "Bs")}</span>
                </div>
                {orderData.deliveryCost > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span>{formatCurrency(orderData.deliveryCost, "Bs")}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(orderData.total, "Bs")}</span>
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        );

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
