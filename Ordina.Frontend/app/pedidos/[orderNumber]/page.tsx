"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Package,
  DollarSign,
  FileText,
  MapPin,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  getOrders,
  getClient,
  type Order,
  type PartialPayment,
  type Client,
  getCategories,
  getProducts,
  type Product,
  type Category,
  type OrderProduct,
} from "@/lib/storage";
import { PAYMENT_CONDITIONS, PURCHASE_TYPES } from "@/components/orders/new-order-dialog";
import {
  formatCurrency,
  type Currency,
  convertFromBs,
  type ExchangeRate,
} from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";
import type { AttributeValue } from "@/lib/storage";
import { getAll } from "@/lib/indexeddb";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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

  // IMPORTANTE: SIEMPRE usar la tasa guardada del pago (tasa del día del pago)
  // Solo usar tasas del día del pedido como fallback si no hay tasa guardada
  // Esto asegura que los pagos muestren el valor correcto con la tasa que se usó cuando se hizo el pago
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

// Función helper para formatear moneda siempre en USD como principal, Bs como secundario
const formatCurrencyWithUsdPrimary = (
  amountInBs: number,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } }
): { primary: string; secondary?: string } => {
  // Intentar convertir a USD si hay tasa disponible
  const usdRate = exchangeRates?.USD?.rate;
  
  if (usdRate && usdRate > 0) {
    const amountInUsd = amountInBs / usdRate;
    return {
      primary: formatCurrency(amountInUsd, "USD"),
      secondary: formatCurrency(amountInBs, "Bs"),
    };
  }
  
  // Si no hay tasa USD, mostrar solo en Bs
  return {
    primary: formatCurrency(amountInBs, "Bs"),
  };
};

// Componente para renderizar moneda con formato USD principal / Bs secundario
const CurrencyDisplay = ({ 
  amountInBs, 
  exchangeRates,
  className = "",
  inline = false
}: { 
  amountInBs: number; 
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } };
  className?: string;
  inline?: boolean;
}) => {
  const formatted = formatCurrencyWithUsdPrimary(amountInBs, exchangeRates);
  
  if (inline) {
    return (
      <span className={className}>
        <span className="font-medium">{formatted.primary}</span>
        {formatted.secondary && (
          <span className="text-xs text-muted-foreground ml-1">
            ({formatted.secondary})
          </span>
        )}
      </span>
    );
  }
  
  return (
    <div className={`text-right ${className}`}>
      <div className="font-medium">
        {formatted.primary}
      </div>
      {formatted.secondary && (
        <div className="text-xs text-muted-foreground">
          {formatted.secondary}
        </div>
      )}
    </div>
  );
};

// Helper para renderizar un valor formateado (objeto con primary/secondary)
const FormattedCurrencyDisplay = ({
  formatted,
  className = "",
  inline = false
}: {
  formatted: { primary: string; secondary?: string };
  className?: string;
  inline?: boolean;
}) => {
  if (inline) {
    return (
      <span className={className}>
        <span className="font-medium">{formatted.primary}</span>
        {formatted.secondary && (
          <span className="text-xs text-muted-foreground ml-1">
            ({formatted.secondary})
          </span>
        )}
      </span>
    );
  }
  
  return (
    <div className={`text-right ${className}`}>
      <div className="font-medium">
        {formatted.primary}
      </div>
      {formatted.secondary && (
        <div className="text-xs text-muted-foreground">
          {formatted.secondary}
        </div>
      )}
    </div>
  );
};

// Función para calcular ajustes detallados por atributo (similar a product-edit-dialog)
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
    if (currency === "USD" && exchangeRates?.USD?.rate) {
      return adjustment * exchangeRates.USD.rate;
    }
    if (currency === "EUR" && exchangeRates?.EUR?.rate) {
      return adjustment * exchangeRates.EUR.rate;
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
            adjustmentInOriginalCurrency += adjustment;
            originalCurrency = currency;
            attributeAdjustment += convertAdjustmentToBs(adjustment, currency);
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

function getStatusColor(status: string) {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
    case "Generado":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case "Generada":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "Fabricación":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "Por despachar":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "Completada":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;
  const { formatWithPreference, preferredCurrency } = useCurrency();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCurrency] = useState<Currency>("Bs"); // Siempre usar Bs como base, mostrar USD/Bs en formato fijo
  const [localExchangeRates, setLocalExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  const [formattedTotals, setFormattedTotals] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({});
  const [formattedPayments, setFormattedPayments] = useState<
    Array<{
      original: string;
      converted?: string;
      currency: string;
    }>
  >([]);
  const [formattedTotalPaid, setFormattedTotalPaid] = useState<string>("");
  const [formattedPendingBalance, setFormattedPendingBalance] =
    useState<string>("");
  const [formattedProductDiscounts, setFormattedProductDiscounts] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({});
  const [formattedProductPrices, setFormattedProductPrices] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({});
  const [formattedProductTotals, setFormattedProductTotals] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [productBreakdowns, setProductBreakdowns] = useState<
    Record<
      string,
      {
        basePrice: { primary: string; secondary?: string };
        attributeAdjustments: Array<{
          name: string;
          value: string;
          adjustment: { primary: string; secondary?: string };
          adjustmentValue: number;
        }>;
        productAttributes: Array<{
          name: string;
          price: { primary: string; secondary?: string };
          priceValue: number;
          adjustments: Array<{
            name: string;
            value: string;
            adjustment: { primary: string; secondary?: string };
            adjustmentValue: number;
          }>;
        }>;
        unitPrice: { primary: string; secondary?: string };
      }
    >
  >({});

  useEffect(() => {
    const loadOrder = async () => {
      try {
        // Cargar categorías y productos
        const [loadedCategories, loadedProducts] = await Promise.all([
          getCategories(),
          getProducts(),
        ]);
        setCategories(loadedCategories);
        setAllProducts(loadedProducts);

        const orders = await getOrders();
        const foundOrder = orders.find((o) => o.orderNumber === orderNumber);

        if (!foundOrder) {
          // Redirigir si no se encuentra
          router.push("/pedidos");
          return;
        }

        setOrder(foundOrder);

        // Cargar información completa del cliente
        if (foundOrder.clientId) {
          const clientData = await getClient(foundOrder.clientId);
          if (clientData) {
            setClient(clientData);
          }
        }

        // Cargar tasas de cambio para el día del pedido
        // PRIORIDAD: Usar las tasas guardadas en el pedido si existen
        if (foundOrder.exchangeRatesAtCreation) {
          // Convertir las tasas guardadas al formato ExchangeRate
          const savedRates: { USD?: ExchangeRate; EUR?: ExchangeRate } = {};

          if (foundOrder.exchangeRatesAtCreation.USD) {
            savedRates.USD = {
              id: `saved-usd-${foundOrder.id}`,
              fromCurrency: "Bs",
              toCurrency: "USD",
              rate: foundOrder.exchangeRatesAtCreation.USD.rate,
              effectiveDate:
                foundOrder.exchangeRatesAtCreation.USD.effectiveDate,
              isActive: true,
              createdAt: foundOrder.createdAt,
              updatedAt: foundOrder.createdAt,
            };
          }

          if (foundOrder.exchangeRatesAtCreation.EUR) {
            savedRates.EUR = {
              id: `saved-eur-${foundOrder.id}`,
              fromCurrency: "Bs",
              toCurrency: "EUR",
              rate: foundOrder.exchangeRatesAtCreation.EUR.rate,
              effectiveDate:
                foundOrder.exchangeRatesAtCreation.EUR.effectiveDate,
              isActive: true,
              createdAt: foundOrder.createdAt,
              updatedAt: foundOrder.createdAt,
            };
          }

          setLocalExchangeRates(savedRates);
        } else {
          // Fallback: Buscar tasas del día del pedido si no están guardadas
          const orderDateObj = new Date(foundOrder.createdAt);
          orderDateObj.setHours(0, 0, 0, 0);

          const allRates = await getAll<ExchangeRate>("exchange_rates");
          const activeRates = allRates
            .filter((r) => r.isActive)
            .sort(
              (a, b) =>
                new Date(b.effectiveDate).getTime() -
                new Date(a.effectiveDate).getTime()
            );

          // Buscar la tasa más reciente hasta el día del pedido
          const usdRate = activeRates.find(
            (r) =>
              r.toCurrency === "USD" &&
              new Date(r.effectiveDate).getTime() <= orderDateObj.getTime()
          );
          const eurRate = activeRates.find(
            (r) =>
              r.toCurrency === "EUR" &&
              new Date(r.effectiveDate).getTime() <= orderDateObj.getTime()
          );

          // Si no hay tasa para el día del pedido, usar la más reciente disponible
          const latestUsd = activeRates.find((r) => r.toCurrency === "USD");
          const latestEur = activeRates.find((r) => r.toCurrency === "EUR");

          setLocalExchangeRates({
            USD: usdRate || latestUsd,
            EUR: eurRate || latestEur,
          });
        }
      } catch (error) {
        console.error("Error loading order:", error);
      } finally {
        setLoading(false);
      }
    };

    if (orderNumber) {
      loadOrder();
    }
  }, [orderNumber, router]);

  // Función para formatear con la moneda seleccionada localmente
  // IMPORTANTE: Siempre usa las tasas del día del pedido, no tasas actuales
  // Esto asegura que los valores convertidos sean consistentes con el total original
  const formatWithSelectedCurrency = useCallback(
    async (
      amount: number,
      originalCurrency: Currency = "Bs"
    ): Promise<string> => {
      if (!selectedCurrency || selectedCurrency === originalCurrency) {
        return formatCurrency(amount, originalCurrency);
      }

      try {
        // Convertir usando las tasas del día del pedido (localExchangeRates)
        // NO usar tasas actuales para mantener consistencia con los valores originales
        let amountInBs = amount;
        if (originalCurrency !== "Bs") {
          const rate =
            originalCurrency === "USD"
              ? localExchangeRates.USD?.rate
              : localExchangeRates.EUR?.rate;
          if (rate && rate > 0) {
            amountInBs = amount * rate;
          } else {
            // Si no hay tasa del día del pedido, no convertir (mostrar en moneda original)
            console.warn(
              `No hay tasa del día del pedido para ${originalCurrency}, mostrando valor original`
            );
            return formatCurrency(amount, originalCurrency);
          }
        }

        if (selectedCurrency === "Bs") {
          return formatCurrency(amountInBs, "Bs");
        }

        // Convertir de Bs a la moneda seleccionada usando la tasa del día del pedido
        const rate =
          selectedCurrency === "USD"
            ? localExchangeRates.USD?.rate
            : localExchangeRates.EUR?.rate;

        if (rate && rate > 0) {
          const converted = convertFromBs(amountInBs, selectedCurrency, rate);
          return formatCurrency(converted, selectedCurrency);
        }

        // Si no hay tasa, mostrar en moneda original
        console.warn(
          `No hay tasa del día del pedido para ${selectedCurrency}, mostrando en Bs`
        );
        return formatCurrency(amountInBs, "Bs");
      } catch (error) {
        console.error("Error converting currency:", error);
        return formatCurrency(amount, originalCurrency);
      }
    },
    [selectedCurrency, localExchangeRates]
  );


  // Formatear totales siempre en USD como principal, Bs como secundario
  useEffect(() => {
    const formatTotals = () => {
      if (!order) return;

      const totals: Record<string, { primary: string; secondary?: string }> = {};
      
      // Usar siempre USD como principal
      totals.total = formatCurrencyWithUsdPrimary(order.total, localExchangeRates);
      totals.subtotal = formatCurrencyWithUsdPrimary(order.subtotal, localExchangeRates);
      totals.tax = formatCurrencyWithUsdPrimary(order.taxAmount, localExchangeRates);
      totals.subtotalBeforeDiscounts = formatCurrencyWithUsdPrimary(
        order.subtotalBeforeDiscounts || 0,
        localExchangeRates
      );
      
      if (order.productDiscountTotal && order.productDiscountTotal > 0) {
        totals.productDiscountTotal = formatCurrencyWithUsdPrimary(
          order.productDiscountTotal,
          localExchangeRates
        );
      }
      
      if (order.generalDiscountAmount && order.generalDiscountAmount > 0) {
        totals.generalDiscountAmount = formatCurrencyWithUsdPrimary(
          order.generalDiscountAmount,
          localExchangeRates
        );
      }
      
      if (order.deliveryCost > 0) {
        totals.deliveryCost = formatCurrencyWithUsdPrimary(
          order.deliveryCost,
          localExchangeRates
        );
      }
      
      setFormattedTotals(totals);
    };

    formatTotals();
  }, [order, localExchangeRates]);

  // Formatear pagos cuando cambia la moneda seleccionada
  useEffect(() => {
    const formatPayments = async () => {
      if (
        !order ||
        !order.partialPayments ||
        order.partialPayments.length === 0
      ) {
        setFormattedPayments([]);
        setFormattedTotalPaid("");
        // Si no hay pagos, el saldo pendiente es el total del pedido
        if (order) {
          const totalInBs = order.total;
          if (selectedCurrency && selectedCurrency !== "Bs") {
            const pendingFormatted = await formatWithSelectedCurrency(
              totalInBs,
              "Bs"
            );
            setFormattedPendingBalance(pendingFormatted);
          } else {
            setFormattedPendingBalance(formatCurrency(totalInBs, "Bs"));
          }
        } else {
          setFormattedPendingBalance("");
        }
        return;
      }

      const paymentsFormatted = await Promise.all(
        order.partialPayments.map(async (payment) => {
          const originalPayment = getOriginalPaymentAmount(
            payment,
            localExchangeRates
          );
          const originalFormatted = formatCurrency(
            originalPayment.amount,
            originalPayment.currency as Currency
          );

          let convertedFormatted: string | undefined;
          if (
            selectedCurrency &&
            selectedCurrency !== originalPayment.currency
          ) {
            // Convertir el pago a la moneda seleccionada
            convertedFormatted = await formatWithSelectedCurrency(
              originalPayment.amount,
              originalPayment.currency as Currency
            );
          }

          return {
            original: originalFormatted,
            converted: convertedFormatted,
            currency: originalPayment.currency,
          };
        })
      );

      // Calcular total pagado
      const totalPaidInBs = order.partialPayments.reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );
      if (selectedCurrency && selectedCurrency !== "Bs") {
        const totalPaidFormatted = await formatWithSelectedCurrency(
          totalPaidInBs,
          "Bs"
        );
        setFormattedTotalPaid(totalPaidFormatted);
      } else {
        setFormattedTotalPaid(formatCurrency(totalPaidInBs, "Bs"));
      }

      // Calcular saldo pendiente
      const totalOrderInBs = order.total;
      const pendingBalanceInBs = totalOrderInBs - totalPaidInBs;

      if (pendingBalanceInBs > 0) {
        // Hay saldo pendiente
        if (selectedCurrency && selectedCurrency !== "Bs") {
          const pendingFormatted = await formatWithSelectedCurrency(
            pendingBalanceInBs,
            "Bs"
          );
          setFormattedPendingBalance(pendingFormatted);
        } else {
          setFormattedPendingBalance(formatCurrency(pendingBalanceInBs, "Bs"));
        }
      } else {
        // El pedido está completamente pagado
        setFormattedPendingBalance("");
      }

      setFormattedPayments(paymentsFormatted);
    };

    formatPayments();
  }, [order, selectedCurrency, formatWithSelectedCurrency, localExchangeRates]);

  // Formatear precios, descuentos, totales y calcular desglose detallado de productos
  useEffect(() => {
    const formatProductData = () => {
      if (!order || categories.length === 0 || allProducts.length === 0) return;

      const formattedDiscounts: Record<string, { primary: string; secondary?: string }> = {};
      const formattedPrices: Record<string, { primary: string; secondary?: string }> = {};
      const formattedTotals: Record<string, { primary: string; secondary?: string }> = {};
      const breakdowns: Record<
        string,
        {
          basePrice: { primary: string; secondary?: string };
          attributeAdjustments: Array<{
            name: string;
            value: string;
            adjustment: { primary: string; secondary?: string };
            adjustmentValue: number;
          }>;
          productAttributes: Array<{
            name: string;
            price: { primary: string; secondary?: string };
            priceValue: number;
            adjustments: Array<{
              name: string;
              value: string;
              adjustment: { primary: string; secondary?: string };
              adjustmentValue: number;
            }>;
          }>;
          unitPrice: { primary: string; secondary?: string };
        }
      > = {};

      for (const orderProduct of order.products) {
        // Formatear precios básicos siempre en USD como principal
        formattedPrices[orderProduct.id] = formatCurrencyWithUsdPrimary(
          orderProduct.price,
          localExchangeRates
        );
        if (orderProduct.discount && orderProduct.discount > 0) {
          formattedDiscounts[orderProduct.id] = formatCurrencyWithUsdPrimary(
            orderProduct.discount,
            localExchangeRates
          );
        }
        const productTotal = orderProduct.total - (orderProduct.discount || 0);
        formattedTotals[orderProduct.id] = formatCurrencyWithUsdPrimary(
          productTotal,
          localExchangeRates
        );

        // Calcular desglose detallado
        const category = categories.find(
          (cat) => cat.name === orderProduct.category
        );
        if (!category) continue;

        // Obtener producto original para precio base
        // Convertir orderProduct.id (string) a número para la comparación
        const orderProductIdNum =
          typeof orderProduct.id === "string"
            ? Number.parseInt(orderProduct.id)
            : orderProduct.id;
        const originalProduct = allProducts.find(
          (p) => p.id === orderProductIdNum
        );

        // Calcular precio base en Bs (usar precio original del producto, no el convertido)
        // IMPORTANTE: orderProduct.price ya está en Bs, pero necesitamos el precio original
        // para mostrarlo correctamente y calcular el desglose
        let basePriceInBs = orderProduct.price; // Fallback: usar precio ya convertido
        if (originalProduct) {
          const originalPrice = originalProduct.price;
          const originalCurrency = originalProduct.priceCurrency || "Bs";
          if (originalCurrency === "Bs") {
            basePriceInBs = originalPrice;
          } else if (
            originalCurrency === "USD" &&
            localExchangeRates?.USD?.rate
          ) {
            basePriceInBs = originalPrice * localExchangeRates.USD.rate;
          } else if (
            originalCurrency === "EUR" &&
            localExchangeRates?.EUR?.rate
          ) {
            basePriceInBs = originalPrice * localExchangeRates.EUR.rate;
          } else {
            basePriceInBs = originalPrice;
          }
        }

        const basePriceCurrency = originalProduct?.priceCurrency || "Bs";
        // Formatear precio base siempre en USD como principal
        const basePriceFormatted = formatCurrencyWithUsdPrimary(basePriceInBs, localExchangeRates);

        // Calcular ajustes de atributos normales
        const attributeAdjustments = calculateDetailedAttributeAdjustments(
          orderProduct.attributes || {},
          category,
          localExchangeRates
        );

        const formattedAttributeAdjustments = attributeAdjustments.map((adj) => ({
          name: adj.attributeName,
          value: adj.selectedValueLabel,
          // Formatear ajuste siempre en USD como principal
          adjustment: formatCurrencyWithUsdPrimary(adj.adjustment, localExchangeRates),
          adjustmentValue: adj.adjustment, // Mantener el valor en Bs para cálculos
        }));

        // Calcular productos como atributos
        const productAttributes: Array<{
          name: string;
          price: { primary: string; secondary?: string };
          priceValue: number;
          adjustments: Array<{
            name: string;
            value: string;
            adjustment: { primary: string; secondary?: string };
            adjustmentValue: number;
          }>;
        }> = [];

        for (const attribute of category.attributes || []) {
          if (attribute.valueType === "Product") {
            const attrId = attribute.id?.toString() || attribute.title;
            if (!attrId) continue;

            // Buscar productos seleccionados para este atributo
            const selectedProductsForAttr = orderProduct.attributes?.[attrId];
            if (
              !selectedProductsForAttr ||
              !Array.isArray(selectedProductsForAttr)
            )
              continue;

            for (const selectedProductId of selectedProductsForAttr) {
              // Convertir a número si es string para la comparación
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
              // Convertir precio del producto a Bs primero si no está en Bs
              let productPriceInBsForDisplay = productPrice;
              if (productCurrency !== "Bs") {
                const rate =
                  productCurrency === "USD"
                    ? localExchangeRates?.USD?.rate
                    : localExchangeRates?.EUR?.rate;
                if (rate && rate > 0) {
                  productPriceInBsForDisplay = productPrice * rate;
                }
              }
              const productPriceFormatted = formatCurrencyWithUsdPrimary(
                productPriceInBsForDisplay,
                localExchangeRates
              );

              // Convertir precio del producto a Bs para cálculos
              let productPriceInBs = productPrice;
              if (productCurrency !== "Bs") {
                const rate =
                  productCurrency === "USD"
                    ? localExchangeRates?.USD?.rate
                    : localExchangeRates?.EUR?.rate;
                if (rate && rate > 0) {
                  productPriceInBs = productPrice * rate;
                }
              }

              // Buscar atributos editados del producto-atributo
              const productAttributeKey = `${attrId}_${foundProduct.id}`;
              const editedAttributes =
                orderProduct.attributes?.[productAttributeKey];

              let productAttrAdjustments: Array<{
                name: string;
                value: string;
                adjustment: { primary: string; secondary?: string };
                adjustmentValue: number;
              }> = [];

              if (editedAttributes && typeof editedAttributes === "object") {
                const productCategory = categories.find(
                  (cat) => cat.name === foundProduct.category
                );
                if (productCategory) {
                  const rawAdjustments = calculateDetailedAttributeAdjustments(
                    editedAttributes,
                    productCategory,
                    localExchangeRates
                  );

                  productAttrAdjustments = rawAdjustments.map((adj) => ({
                    name: adj.attributeName,
                    value: adj.selectedValueLabel,
                    // Formatear ajuste siempre en USD como principal
                    adjustment: formatCurrencyWithUsdPrimary(adj.adjustment, localExchangeRates),
                    adjustmentValue: adj.adjustment, // Mantener el valor en Bs para cálculos
                  }));
                }
              }

              productAttributes.push({
                name: foundProduct.name,
                price: productPriceFormatted,
                priceValue: productPriceInBs,
                adjustments: productAttrAdjustments,
              });
            }
          }
        }

        // Calcular precio unitario
        // El precio base ya está en Bs (basePriceInBs)
        let unitPriceInBs = basePriceInBs;

        // Sumar ajustes de atributos normales (ya están en Bs)
        formattedAttributeAdjustments.forEach((adj) => {
          unitPriceInBs += adj.adjustmentValue;
        });

        // Sumar precios de productos como atributos y sus ajustes
        productAttributes.forEach((prodAttr) => {
          // Sumar precio base del producto-atributo (ya está en Bs)
          unitPriceInBs += prodAttr.priceValue;

          // Sumar ajustes de atributos del producto-atributo (ya están en Bs)
          prodAttr.adjustments.forEach((adj) => {
            unitPriceInBs += adj.adjustmentValue;
          });
        });

        const unitPriceFormatted = formatCurrencyWithUsdPrimary(unitPriceInBs, localExchangeRates);

        breakdowns[orderProduct.id] = {
          basePrice: basePriceFormatted,
          attributeAdjustments: formattedAttributeAdjustments,
          productAttributes,
          unitPrice: unitPriceFormatted,
        };
      }

      setFormattedProductDiscounts(formattedDiscounts);
      setFormattedProductPrices(formattedPrices);
      setFormattedProductTotals(formattedTotals);
      setProductBreakdowns(breakdowns);
    };
    formatProductData();
  }, [order, categories, allProducts, localExchangeRates]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center">
          <p>Cargando pedido...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (!order && !loading) {
    return null;
  }


  if (!order) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center">
          <p>Cargando pedido...</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/pedidos")}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">
                      Pedido {order.orderNumber}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              </div>

              {/* Información General */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Información del Cliente - Agrupada */}
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-medium">{order.clientName}</p>
                      {client?.rutId && (
                        <p className="text-xs text-muted-foreground">RUT/ID: {client.rutId}</p>
                      )}
                    </div>
                    {client?.telefono && (
                      <div>
                        <p className="text-sm text-muted-foreground">Teléfono del cliente</p>
                        <p className="font-medium">{client.telefono}</p>
                      </div>
                    )}
                    {client?.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email del cliente</p>
                        <p className="font-medium">{client.email}</p>
                      </div>
                    )}
                    {/* Información del Vendedor y otros - Agrupada */}
                    <div>
                      <p className="text-sm text-muted-foreground">Vendedor</p>
                      <p className="font-medium">{order.vendorName}</p>
                    </div>
                    {order.referrerName && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Referidor
                        </p>
                        <p className="font-medium">{order.referrerName}</p>
                      </div>
                    )}
                    {order.paymentCondition && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Condición de Pago
                        </p>
                        <p className="font-medium">
                          {PAYMENT_CONDITIONS.find(
                            (pc) => pc.value === order.paymentCondition
                          )?.label || order.paymentCondition}
                        </p>
                      </div>
                    )}
                    {order.saleType && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Tipo de Venta
                        </p>
                        <p className="font-medium">
                          {PURCHASE_TYPES.find(
                            (pt) => pt.value === order.saleType
                          )?.label || order.saleType}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Método de Pago
                      </p>
                      <p className="font-medium">{order.paymentMethod}</p>
                    </div>
                    {client?.direccion && (
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-sm text-muted-foreground">Dirección del cliente</p>
                        <p className="font-medium">{client.direccion}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Fecha de Creación
                      </p>
                      <p className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Observaciones Generales - DESTACADAS */}
              {order.observations && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5" />
                      Observaciones Generales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-950 p-3 rounded">
                      {order.observations}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Productos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Productos ({order.products.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.products.map((product, idx) => {
                      const breakdown = productBreakdowns[product.id];
                      return (
                        <HoverCard key={idx} openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              {/* Estado de ubicación */}
                              <div className="mb-3 pb-3 border-b">
                                {(() => {
                                  let badgeText = "Sin definir";
                                  let badgeVariant: "default" | "destructive" | "secondary" = "secondary";
                                  let badgeClassName = "text-sm";

                                  // Normalizar locationStatus para comparación (trim y manejar ambos formatos)
                                  const locationStatus = product.locationStatus?.trim();
                                  
                                  // Debug temporal: descomentar para ver qué valor está llegando
                                  // if (product.name) console.log(`Product: ${product.name}, locationStatus: "${locationStatus}", raw: "${product.locationStatus}"`);
                                  
                                  // Verificar si es "EN TIENDA" (ambos formatos)
                                  if (locationStatus === "en_tienda" || locationStatus === "EN TIENDA") {
                                    badgeText = "En Tienda";
                                    badgeVariant = "default";
                                  } 
                                  // Verificar si es "FABRICACION" o "mandar_a_fabricar" (ambos formatos)
                                  // También verificar variaciones con espacios o mayúsculas/minúsculas
                                  else if (
                                    locationStatus === "mandar_a_fabricar" || 
                                    locationStatus === "FABRICACION" ||
                                    locationStatus?.toUpperCase() === "FABRICACION" ||
                                    locationStatus?.toUpperCase() === "MANDAR_A_FABRICAR" ||
                                    (locationStatus && locationStatus.toLowerCase().includes("fabric"))
                                  ) {
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
                              
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-lg">
                                    {product.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Cantidad: {product.quantity}
                                  </p>
                                  {product.discount && product.discount > 0 && (
                                    <p className="text-sm text-red-600 mt-1">
                                      Descuento: -
                                      {formattedProductDiscounts[product.id] ? (
                                        <FormattedCurrencyDisplay 
                                          formatted={formattedProductDiscounts[product.id]} 
                                          inline={true}
                                          className="inline"
                                        />
                                      ) : (
                                        formatCurrency(product.discount, "Bs")
                                      )}
                                    </p>
                                  )}
                                </div>
                            <div className="text-right">
                              {formattedProductTotals[product.id] ? (
                                <FormattedCurrencyDisplay 
                                  formatted={formattedProductTotals[product.id]} 
                                  className="font-semibold text-lg"
                                />
                              ) : (
                                <p className="font-semibold text-lg">
                                  {formatCurrency(
                                    product.total - (product.discount || 0),
                                    "Bs"
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Desglose detallado de precio */}
                          {breakdown && (
                            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                              <div className="font-semibold mb-2">
                                Desglose de Precio:
                              </div>

                              {/* Precio base */}
                              <div className="flex justify-between">
                                <span>Precio base:</span>
                                {breakdown.basePrice ? (
                                  <FormattedCurrencyDisplay formatted={breakdown.basePrice} />
                                ) : null}
                              </div>

                              {/* Ajustes de atributos normales */}
                              {breakdown.attributeAdjustments.length > 0 && (
                                <>
                                  {breakdown.attributeAdjustments
                                    .map(
                                    (
                                      adj: {
                                        name: string;
                                        value: string;
                                        adjustment: { primary: string; secondary?: string };
                                        adjustmentValue: number;
                                      },
                                      adjIdx: number
                                    ) => (
                                      <div
                                        key={adjIdx}
                                        className="flex justify-between pl-4"
                                      >
                                        <span className="text-muted-foreground">
                                          {adj.name}
                                          {adj.value ? ` (${adj.value})` : ""}:
                                        </span>
                                        <span className={
                                          adj.adjustmentValue > 0
                                            ? "text-green-600 dark:text-green-400"
                                            : adj.adjustmentValue < 0
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-muted-foreground"
                                        }>
                                          {adj.adjustmentValue > 0 ? "+" : ""}
                                          <FormattedCurrencyDisplay 
                                            formatted={adj.adjustment} 
                                            inline={true}
                                            className="inline"
                                          />
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
                                    (
                                      prodAttr: {
                                        name: string;
                                        price: { primary: string; secondary?: string };
                                        priceValue: number;
                                        adjustments: Array<{
                                          name: string;
                                          value: string;
                                          adjustment: { primary: string; secondary?: string };
                                          adjustmentValue: number;
                                        }>;
                                      },
                                      prodIdx: number
                                    ) => (
                                      <div key={prodIdx} className="space-y-1">
                                        {/* Precio del producto */}
                                        <div className="flex justify-between pl-4">
                                          <span className="text-muted-foreground">
                                            {prodAttr.name}:
                                          </span>
                                          <span className="text-green-600 dark:text-green-400">
                                            +<FormattedCurrencyDisplay 
                                              formatted={prodAttr.price} 
                                              inline={true}
                                              className="inline"
                                            />
                                          </span>
                                        </div>
                                        {/* Ajustes de atributos del producto */}
                                        {prodAttr.adjustments.length > 0 && (
                                          <>
                                            {prodAttr.adjustments
                                              .map(
                                              (
                                                adj: {
                                                  name: string;
                                                  value: string;
                                                  adjustment: { primary: string; secondary?: string };
                                                  adjustmentValue: number;
                                                },
                                                adjIdx: number
                                              ) => (
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
                                                  <span className={
                                                    adj.adjustmentValue > 0
                                                      ? "text-green-600 dark:text-green-400"
                                                      : adj.adjustmentValue < 0
                                                      ? "text-red-600 dark:text-red-400"
                                                      : "text-muted-foreground"
                                                  }>
                                                    {adj.adjustmentValue > 0 ? "+" : ""}
                                                    <FormattedCurrencyDisplay 
                                                      formatted={adj.adjustment} 
                                                      inline={true}
                                                      className="inline"
                                                    />
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
                            </div>
                          )}

                          {/* Observaciones Individuales - DESTACADAS */}
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
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" align="start">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm mb-3">
                                {product.name}
                              </h4>
                              {breakdown && breakdown.attributeAdjustments.length > 0 && (
                                <div className="space-y-1.5">
                                  {breakdown.attributeAdjustments.map((adj, adjIdx) => (
                                    <div key={adjIdx} className="text-sm">
                                      <span className="font-medium text-muted-foreground">
                                        {adj.name}:
                                      </span>{" "}
                                      <span className="text-foreground">
                                        {adj.value || "N/A"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {breakdown && breakdown.productAttributes.length > 0 && (
                                <div className="space-y-2 mt-3 pt-3 border-t">
                                  {breakdown.productAttributes.map((prodAttr, prodIdx) => (
                                    <div key={prodIdx} className="space-y-1">
                                      <div className="text-sm font-medium text-muted-foreground">
                                        {prodAttr.name}
                                      </div>
                                      {prodAttr.adjustments.length > 0 && (
                                        <div className="pl-3 space-y-1">
                                          {prodAttr.adjustments.map((adj, adjIdx) => (
                                            <div key={adjIdx} className="text-xs">
                                              <span className="text-muted-foreground">
                                                {adj.name}:
                                              </span>{" "}
                                              <span className="text-foreground">
                                                {adj.value || "N/A"}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(!breakdown || 
                                (breakdown.attributeAdjustments.length === 0 && 
                                 breakdown.productAttributes.length === 0)) && (
                                <p className="text-sm text-muted-foreground">
                                  Sin atributos personalizados
                                </p>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Dirección de Entrega */}
              {order.hasDelivery && order.deliveryAddress && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Dirección de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{order.deliveryAddress}</p>
                  </CardContent>
                </Card>
              )}

              {/* Resumen Financiero */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Resumen Financiero
                    {selectedCurrency && (
                      <Badge variant="outline" className="ml-2">
                        En{" "}
                        {selectedCurrency === "Bs"
                          ? "Bolívares"
                          : selectedCurrency === "USD"
                          ? "Dólares"
                          : "Euros"}
                      </Badge>
                    )}
                  </CardTitle>
                  {selectedCurrency &&
                    selectedCurrency !== "Bs" &&
                    localExchangeRates[selectedCurrency] && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Tasa de cambio: 1 {selectedCurrency} ={" "}
                        {formatCurrency(
                          localExchangeRates[selectedCurrency]!.rate,
                          "Bs"
                        )}{" "}
                        (Fecha efectiva:{" "}
                        {new Date(
                          localExchangeRates[selectedCurrency]!.effectiveDate
                        ).toLocaleDateString()}
                        )
                      </p>
                    )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      {formattedTotals.subtotalBeforeDiscounts ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.subtotalBeforeDiscounts} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={order.subtotalBeforeDiscounts || 0} 
                          exchangeRates={localExchangeRates}
                        />
                    )}
                  </div>
                  {order.productDiscountTotal && order.productDiscountTotal > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Descuentos individuales:</span>
                          {formattedTotals.productDiscountTotal ? (
                            <FormattedCurrencyDisplay formatted={formattedTotals.productDiscountTotal} />
                          ) : (
                            <CurrencyDisplay 
                              amountInBs={order.productDiscountTotal} 
                              exchangeRates={localExchangeRates}
                            />
                          )}
                        </div>
                      )}
                    {order.generalDiscountAmount && order.generalDiscountAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Descuento general:</span>
                          {formattedTotals.generalDiscountAmount ? (
                            <FormattedCurrencyDisplay formatted={formattedTotals.generalDiscountAmount} />
                          ) : (
                            <CurrencyDisplay 
                              amountInBs={order.generalDiscountAmount} 
                              exchangeRates={localExchangeRates}
                            />
                          )}
                        </div>
                      )}
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal después de descuentos:</span>
                      {formattedTotals.subtotal ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.subtotal} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={order.subtotal} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto (16%):</span>
                      {formattedTotals.tax ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.tax} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={order.taxAmount} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                    {order.deliveryCost > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery:</span>
                        {formattedTotals.deliveryCost ? (
                          <FormattedCurrencyDisplay formatted={formattedTotals.deliveryCost} />
                        ) : (
                          <CurrencyDisplay 
                            amountInBs={order.deliveryCost} 
                            exchangeRates={localExchangeRates}
                          />
                        )}
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      {formattedTotals.total ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.total} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={order.total} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pagos */}
              {order.partialPayments && order.partialPayments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Pagos
                      {selectedCurrency && selectedCurrency !== "Bs" && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          También en{" "}
                          {selectedCurrency === "USD" ? "Dólares" : "Euros"}
                        </Badge>
                      )}
                    </CardTitle>
                    {selectedCurrency &&
                      selectedCurrency !== "Bs" &&
                      localExchangeRates[selectedCurrency] && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Tasa del día del pedido: 1 {selectedCurrency} ={" "}
                          {formatCurrency(
                            localExchangeRates[selectedCurrency]!.rate,
                            "Bs"
                          )}{" "}
                          (Fecha efectiva:{" "}
                          {new Date(
                            localExchangeRates[selectedCurrency]!.effectiveDate
                          ).toLocaleDateString()}
                          )
                        </p>
                      )}
                    {(!selectedCurrency || selectedCurrency === "Bs") &&
                      (localExchangeRates.USD || localExchangeRates.EUR) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tasas del día del pedido:{" "}
                          {localExchangeRates.USD &&
                            `USD: ${formatCurrency(
                              localExchangeRates.USD.rate,
                              "Bs"
                            )}`}
                          {localExchangeRates.USD &&
                            localExchangeRates.EUR &&
                            " | "}
                          {localExchangeRates.EUR &&
                            `EUR: ${formatCurrency(
                              localExchangeRates.EUR.rate,
                              "Bs"
                            )}`}
                        </p>
                      )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.partialPayments.map((payment, idx) => {
                        const formattedPayment = formattedPayments[idx];
                        if (!formattedPayment) {
                          const originalPayment = getOriginalPaymentAmount(
                            payment,
                            localExchangeRates
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
                                        {new Date(
                                          payment.date
                                        ).toLocaleDateString()}
                                        )
                                      </span>
                                    )}
                                  </div>
                                )}

                              {payment.date &&
                                (!paymentExchangeRate ||
                                  paymentCurrency === "Bs") && (
                                  <div className="text-xs text-muted-foreground">
                                    Fecha:{" "}
                                    {new Date(
                                      payment.date
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                            </div>
                          );
                        }

                        const originalPayment = getOriginalPaymentAmount(
                          payment,
                          localExchangeRates
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
                              <div className="text-right">
                                <div className="font-medium">
                                  {formattedPayment.original}
                                </div>
                                {formattedPayment.converted && (
                                  <div className="text-xs text-muted-foreground">
                                    {formattedPayment.converted}
                                  </div>
                                )}
                              </div>
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
                                      {new Date(
                                        payment.date
                                      ).toLocaleDateString()}
                                      )
                                    </span>
                                  )}
                                </div>
                              )}

                            {payment.date &&
                              (!paymentExchangeRate ||
                                paymentCurrency === "Bs") && (
                                <div className="text-xs text-muted-foreground">
                                  Fecha:{" "}
                                  {new Date(payment.date).toLocaleDateString()}
                                </div>
                              )}
                          </div>
                        );
                      })}
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total Pagado:</span>
                        <CurrencyDisplay 
                          amountInBs={order.partialPayments.reduce((sum, p) => sum + (p.amount || 0), 0)} 
                          exchangeRates={localExchangeRates}
                        />
                      </div>

                      {/* Mostrar saldo pendiente si existe */}
                      {formattedPendingBalance && (
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
                              <CurrencyDisplay 
                                amountInBs={order.total - order.partialPayments.reduce((sum, p) => sum + (p.amount || 0), 0)} 
                                exchangeRates={localExchangeRates}
                                className="font-bold text-lg text-red-700 dark:text-red-300"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mostrar saldo pendiente cuando NO hay pagos */}
              {(!order.partialPayments || order.partialPayments.length === 0) &&
                formattedPendingBalance && (
                  <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5" />
                        Pago Pendiente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Este pedido aún no tiene pagos registrados.
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-red-700 dark:text-red-300">
                            Total Pendiente:
                          </span>
                          <div className="text-right">
                            <div className="font-bold text-xl text-red-700 dark:text-red-300">
                              {formatCurrency(order.total, "Bs")}
                            </div>
                            {selectedCurrency && selectedCurrency !== "Bs" && (
                              <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                                {formattedPendingBalance}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
