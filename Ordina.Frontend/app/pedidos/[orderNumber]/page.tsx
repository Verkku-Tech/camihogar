"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
  Loader2,
} from "lucide-react";
import {
  getOrderByOrderNumberPreferBackend,
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
import { PAYMENT_CONDITIONS } from "@/components/orders/new-order-dialog";
import { isReservationOrder } from "@/lib/order-document-types";
import { getSaleTypeLabel } from "@/components/orders/constants";
import {
  formatCurrency,
  getActiveExchangeRates,
  type Currency,
  convertFromBs,
  type ExchangeRate,
} from "@/lib/currency-utils";
import {
  getProductLineSurchargeInBaseCurrency,
  getOrderBaseCurrency,
  isUsdBaseOrder,
} from "@/lib/order-line-pricing";
import { resolveCatalogProductForOrderLine } from "@/lib/order-product-confirm-map";
import {
  commercialRatesToExchangeRatesInput,
  formatDualCurrencyAmounts,
  formatOrderAmountWithOrderRateBs,
  formatOrderPaymentTotalsDisplay,
  formatOrderPaymentUsdWithOrderRateBs,
  getCommercialRatesFromOrder,
  getCommercialTotalUsd,
  getOrderPaidUsd,
  getOrderPendingUsd,
} from "@/lib/order-currency-display";
import {
  sumPaymentsToUsd,
  PAYMENT_BALANCE_EPSILON_USD,
} from "@/lib/order-payments";
import { useCurrency } from "@/contexts/currency-context";
import type { AttributeValue } from "@/lib/storage";
import { getAll } from "@/lib/indexeddb";
import { apiClient } from "@/lib/api-client";
import { CommissionLineSourceBadge } from "@/components/orders/commission-line-source-badge";
import { CASHEA_FINANCED_METHOD_LABEL } from "@/lib/order-payments";
import { appliedUsdToBs } from "@/lib/order-store-credit-usd";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ImageGallery } from "@/components/orders/image-gallery";
import { useAuth } from "@/contexts/auth-context";
import {
  getLineDiscountDisplayMode,
  getIndividualDiscountsSummaryLabel,
  getGeneralDiscountSummaryLabel,
  getLineDiscountLabelLead,
} from "@/lib/product-discount-ui";

const OrderPdfDownloadButton = dynamic(
  () =>
    import("@/components/orders/order-pdf-download").then(
      (m) => m.OrderPdfDownloadButton,
    ),
  { ssr: false },
);

// Función helper para obtener el monto original del pago en su moneda
const getOriginalPaymentAmount = (
  payment: PartialPayment,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } },
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

  const paymentCurrency = payment.currency || "Bs";
  if (paymentCurrency === "Bs") {
    const payRate = payment.paymentDetails?.exchangeRate;
    if (payRate && payRate > 0) {
      return {
        amount: (payment.amount || 0) / payRate,
        currency: "USD",
      };
    }
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

// Helper para derivar tasas de cambio a partir de los pagos de un pedido
const deriveExchangeRatesFromPayments = (
  order: Order,
): { USD?: ExchangeRate; EUR?: ExchangeRate } => {
  const derived: { USD?: ExchangeRate; EUR?: ExchangeRate } = {};

  const tryAddRateFromDetails = (
    currency: "USD" | "EUR",
    rate?: number,
    date?: string,
  ) => {
    if (!rate || rate <= 0 || derived[currency]) return;

    const effectiveDate = date || order.createdAt;

    derived[currency] = {
      id: `payment-${currency.toLowerCase()}-${order.id}`,
      fromCurrency: "Bs",
      toCurrency: currency,
      rate,
      effectiveDate,
      isActive: true,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    };
  };

  // Pago principal (paymentDetails)
  if (order.paymentDetails?.cashCurrency && order.paymentDetails.exchangeRate) {
    const currency = order.paymentDetails.cashCurrency as "USD" | "EUR" | "Bs";
    if (currency === "USD" || currency === "EUR") {
      const date =
        order.paymentDetails.pagomovilDate ||
        order.paymentDetails.transferenciaDate ||
        order.createdAt;
      tryAddRateFromDetails(currency, order.paymentDetails.exchangeRate, date);
    }
  }

  // Pagos parciales o mixtos (mismo origen de tasas)
  const paymentsForRates =
    order.partialPayments && order.partialPayments.length > 0
      ? order.partialPayments
      : (order.mixedPayments ?? []);
  if (paymentsForRates.length > 0) {
    for (const p of paymentsForRates) {
      if (p.paymentDetails?.cashCurrency && p.paymentDetails.exchangeRate) {
        const currency = p.paymentDetails.cashCurrency as "USD" | "EUR" | "Bs";
        if (currency === "USD" || currency === "EUR") {
          const date =
            p.paymentDetails.pagomovilDate ||
            p.paymentDetails.transferenciaDate ||
            p.date ||
            order.createdAt;
          tryAddRateFromDetails(currency, p.paymentDetails.exchangeRate, date);
        }
      }
    }
  }

  return derived;
};

/** @deprecated Preferir formatOrderAmountWithOrderRateBs(order) para alinear con PDF. */
const formatCurrencyWithUsdPrimary = (
  amount: number,
  baseCurrency: Currency,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } },
): { primary: string; secondary?: string } => {
  return formatDualCurrencyAmounts(amount, baseCurrency, {
    commercialRates: exchangeRates,
    liveRates: exchangeRates,
  });
};

// Componente para renderizar moneda con formato USD principal / Bs secundario
const CurrencyDisplay = ({
  amount,
  baseCurrency,
  exchangeRates,
  liveRates,
  className = "",
  inline = false,
}: {
  amount: number;
  baseCurrency: Currency;
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } };
  liveRates?: { USD?: { rate: number }; EUR?: { rate: number } };
  className?: string;
  inline?: boolean;
}) => {
  const formatted = formatDualCurrencyAmounts(amount, baseCurrency, {
    commercialRates: exchangeRates,
    liveRates: exchangeRates,
  });

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
      <div className="font-medium">{formatted.primary}</div>
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
  inline = false,
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
      <div className="font-medium">{formatted.primary}</div>
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
  exchangeRates?: { USD?: any; EUR?: any },
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
    currency?: string,
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
      (attr) => attr.id?.toString() === attrKey || attr.title === attrKey,
    );

    if (!categoryAttribute || categoryAttribute.valueType === "Product") {
      return;
    }

    // Manejar atributos numéricos de forma especial
    if (categoryAttribute.valueType === "Number") {
      // Para atributos numéricos, el valor viene directamente de selectedValue
      // No hay valores predefinidos ni ajustes de precio
      const numericValue =
        selectedValue !== undefined &&
        selectedValue !== null &&
        selectedValue !== ""
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
          },
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
          },
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
    case "Validado":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
    case "En Fabricación":
    case "Fabricación":
    case "Fabricándose":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "Almacén":
    case "En Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "Despacho":
    case "Por despachar":
    case "En Ruta":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "Entregado":
    case "Completada":
    case "Completado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "Declinado":
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "Generado":
    case "Generada":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

/** Saldo residual por redondeo; alinear con validación de pagos del formulario (~0,01 Bs). */
const PENDING_BALANCE_EPSILON_BS = 0.01;

function appliedStoreCreditBsOnOrder(order: Order): number {
  const usd = order.appliedStoreCreditUsd ?? 0;
  if (usd <= 0) return 0;
  try {
    return appliedUsdToBs(usd, order);
  } catch {
    return 0;
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;
  const { user } = useAuth();
  const canValidateOrders =
    user?.role === "Super Administrator" || user?.role === "Administrator";
  const { formatWithPreference, preferredCurrency } = useCurrency();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCurrency] = useState<Currency>("Bs"); // Siempre usar Bs como base, mostrar USD/Bs en formato fijo
  const [localExchangeRates, setLocalExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  const [liveExchangeRates, setLiveExchangeRates] = useState<{
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
  const [formattedProductSurcharges, setFormattedProductSurcharges] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [validatingOrder, setValidatingOrder] = useState<boolean>(false);

  /** Un solo arreglo activo: varios pagos van en mixedPayments y partialPayments queda vacío. */
  const activePayments = useMemo((): PartialPayment[] => {
    if (!order) return [];
    if (order.partialPayments && order.partialPayments.length > 0) {
      return order.partialPayments;
    }
    return order.mixedPayments ?? [];
  }, [order]);

  const orderBaseCurrency = order ? getOrderBaseCurrency(order) : "Bs";

  const pendingBalanceUsd = useMemo(() => {
    if (!order) return 0;
    return getOrderPendingUsd(order);
  }, [order]);

  const hasMeaningfulPendingBalance = useMemo(() => {
    if (!order) return false;
    return pendingBalanceUsd > PAYMENT_BALANCE_EPSILON_USD;
  }, [order, pendingBalanceUsd]);

  const totalPaidUsd = useMemo(() => {
    if (!order) return 0;
    return getOrderPaidUsd(order);
  }, [order]);

  const inStorePaymentsForDisplay = useMemo(
    () =>
      activePayments.filter(
        (p) =>
          !p.paymentDetails?.casheaFinancedPortion &&
          p.method !== CASHEA_FINANCED_METHOD_LABEL,
      ),
    [activePayments],
  );

  /** Cobros y saldo: USD comercial; con showCollectedBs el secundario es la suma real de Bs. */
  const OrderPaymentCurrency = ({
    amountUsd,
    className,
    inline,
    showCollectedBs,
  }: {
    amountUsd: number;
    className?: string;
    inline?: boolean;
    showCollectedBs?: boolean;
  }) => {
    const formatted = showCollectedBs
      ? formatOrderPaymentTotalsDisplay(
          amountUsd,
          inStorePaymentsForDisplay,
          order ?? undefined,
        )
      : formatOrderPaymentUsdWithOrderRateBs(amountUsd, order ?? undefined);
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
      <div className={`text-right ${className || ""}`}>
        <div className="font-medium">{formatted.primary}</div>
        {formatted.secondary && (
          <div className="text-xs text-muted-foreground">
            {formatted.secondary}
          </div>
        )}
      </div>
    );
  };

  const OrderCurrency = ({
    amount,
    className,
    inline,
    paymentUsdRate,
    amountCurrency,
  }: {
    amount: number;
    className?: string;
    inline?: boolean;
    paymentUsdRate?: number;
    amountCurrency?: Currency;
  }) => {
    // Moneda en la que se interpreta `amount`. Para pagos cuya moneda original
    // difiere de la base del pedido (ej. pago en Bs en un pedido USD), el caller
    // debe pasar `amountCurrency` para evitar tratar el monto como si estuviera
    // en la base del pedido.
    const effectiveBaseCurrency: Currency = amountCurrency ?? orderBaseCurrency;
    const commercialRates =
      paymentUsdRate && paymentUsdRate > 0
        ? {
            ...localExchangeRates,
            USD: {
              ...(localExchangeRates.USD ?? {
                id: "payment-usd",
                fromCurrency: "Bs" as const,
                toCurrency: "USD" as const,
                effectiveDate: "",
                isActive: true,
                createdAt: "",
                updatedAt: "",
              }),
              rate: paymentUsdRate,
              effectiveDate:
                localExchangeRates.USD?.effectiveDate ?? "",
            },
          }
        : localExchangeRates;
    if (paymentUsdRate && paymentUsdRate > 0) {
      const ratesInput = {
        USD: commercialRates.USD
          ? { rate: commercialRates.USD.rate }
          : undefined,
        EUR: commercialRates.EUR
          ? { rate: commercialRates.EUR.rate }
          : undefined,
      };
      const formatted = formatDualCurrencyAmounts(
        amount,
        effectiveBaseCurrency,
        {
          commercialRates: ratesInput,
          liveRates: ratesInput,
        },
      );
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
          <div className="font-medium">{formatted.primary}</div>
          {formatted.secondary && (
            <div className="text-xs text-muted-foreground">
              {formatted.secondary}
            </div>
          )}
        </div>
      );
    }

    const formatted = order
      ? formatOrderAmountWithOrderRateBs(amount, {
          ...order,
          baseCurrency: effectiveBaseCurrency,
        })
      : formatCurrencyWithUsdPrimary(
          amount,
          effectiveBaseCurrency,
          localExchangeRates,
        );

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
        <div className="font-medium">{formatted.primary}</div>
        {formatted.secondary && (
          <div className="text-xs text-muted-foreground">
            {formatted.secondary}
          </div>
        )}
      </div>
    );
  };

  const casheaPaidInStoreUsd = useMemo(() => {
    if (!order || order.paymentCondition !== "cashea") return 0;
    const inStore = activePayments.filter(
      (p) =>
        !p.paymentDetails?.casheaFinancedPortion &&
        p.method !== CASHEA_FINANCED_METHOD_LABEL,
    );
    return sumPaymentsToUsd(inStore, order);
  }, [order, activePayments]);

  const casheaHasFinancedLine = useMemo(
    () =>
      order?.paymentCondition === "cashea" &&
      activePayments.some(
        (p) =>
          p.paymentDetails?.casheaFinancedPortion ||
          p.method === CASHEA_FINANCED_METHOD_LABEL,
      ),
    [order, activePayments],
  );

  const casheaTotalCoveredUsd = useMemo(() => {
    if (!order || !casheaHasFinancedLine) return totalPaidUsd;
    return getCommercialTotalUsd(order);
  }, [order, casheaHasFinancedLine, totalPaidUsd]);

  const individualDiscountsSummaryLabel = useMemo(
    () =>
      order
        ? getIndividualDiscountsSummaryLabel(
            order.products,
            (preferredCurrency as Currency) || "Bs",
          )
        : "Descuentos individuales:",
    [order, preferredCurrency],
  );

  const generalDiscountSummaryLabel = useMemo(
    () =>
      order ? getGeneralDiscountSummaryLabel(order) : "Descuento general:",
    [order],
  );

  const productSurchargeTotal = useMemo(() => {
    if (!order?.products?.length || categories.length === 0) return 0;
    const base = getOrderBaseCurrency(order);
    const rates = commercialRatesToExchangeRatesInput(
      getCommercialRatesFromOrder(order),
    );
    return order.products.reduce(
      (sum, p) =>
        sum +
        getProductLineSurchargeInBaseCurrency(p, {
          baseCurrency: base,
          exchangeRates: rates,
          categories,
          allProducts,
        }),
      0,
    );
  }, [order, categories, allProducts]);

  const handleValidateOrder = async () => {
    if (!canValidateOrders) {
      toast.error("Solo administradores pueden validar pedidos.");
      return;
    }
    if (!order || !order.products) return;

    // Obtener productos que no están validados
    const productsToValidate = order.products.filter(
      (p) => !p.logisticStatus || p.logisticStatus === "Generado",
    );

    if (productsToValidate.length === 0) {
      toast.info("Todos los productos ya están validados.");
      return;
    }

    try {
      setValidatingOrder(true);
      for (const p of productsToValidate) {
        await apiClient.validateOrderItem(order.id, p.id);
      }

      // Actualizamos el pedido para ver reflejado el cambio global
      const foundOrder = await getOrderByOrderNumberPreferBackend(orderNumber);
      if (foundOrder) {
        setOrder(foundOrder);
        console.log("INFORMACIÓN DEL PEDIDO >>>>", foundOrder);
      }
      toast.success("Pedido validado exitosamente");
    } catch (error) {
      console.error("Error validando pedido:", error);
      toast.error("Error al tratar de validar el pedido");
    } finally {
      setValidatingOrder(false);
    }
  };
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

        const foundOrder =
          await getOrderByOrderNumberPreferBackend(orderNumber);

        if (!foundOrder) {
          // Redirigir si no se encuentra
          router.push("/pedidos");
          return;
        }

        setOrder(foundOrder);
        console.log("INFORMACIÓN DEL PEDIDO >>>>", foundOrder);

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
          // Convertir las tasas guardadas al formato ExchangeRate.
          // Soportar tanto propiedades en MAYÚSCULAS (USD/EUR) como en minúsculas (usd/eur),
          // ya que el backend puede serializar con camelCase.
          const ex = foundOrder.exchangeRatesAtCreation as any;
          const usdAtCreation = ex.USD || ex.usd;
          const eurAtCreation = ex.EUR || ex.eur;

          const savedRates: { USD?: ExchangeRate; EUR?: ExchangeRate } = {};

          if (usdAtCreation) {
            savedRates.USD = {
              id: `saved-usd-${foundOrder.id}`,
              fromCurrency: "Bs",
              toCurrency: "USD",
              rate: usdAtCreation.rate,
              effectiveDate: usdAtCreation.effectiveDate,
              isActive: true,
              createdAt: foundOrder.createdAt,
              updatedAt: foundOrder.createdAt,
            };
          }

          if (eurAtCreation) {
            savedRates.EUR = {
              id: `saved-eur-${foundOrder.id}`,
              fromCurrency: "Bs",
              toCurrency: "EUR",
              rate: eurAtCreation.rate,
              effectiveDate: eurAtCreation.effectiveDate,
              isActive: true,
              createdAt: foundOrder.createdAt,
              updatedAt: foundOrder.createdAt,
            };
          }

          // Si no hay tasas guardadas para alguna moneda, intentar derivarlas desde los pagos
          const paymentDerived = deriveExchangeRatesFromPayments(foundOrder);
          if (!savedRates.USD && paymentDerived.USD) {
            savedRates.USD = paymentDerived.USD;
          }
          if (!savedRates.EUR && paymentDerived.EUR) {
            savedRates.EUR = paymentDerived.EUR;
          }

          setLocalExchangeRates(savedRates);
          void getActiveExchangeRates().then(setLiveExchangeRates);
        } else {
          // Si no hay tasas guardadas en el pedido, intentar derivarlas desde los pagos
          const paymentDerived = deriveExchangeRatesFromPayments(foundOrder);
          if (paymentDerived.USD || paymentDerived.EUR) {
            setLocalExchangeRates(paymentDerived);
            void getActiveExchangeRates().then(setLiveExchangeRates);
          } else {
            // Fallback: Buscar tasas del día del pedido si no están guardadas ni se pueden derivar
            const orderDateObj = new Date(foundOrder.createdAt);
            orderDateObj.setHours(0, 0, 0, 0);

            const allRates = await getAll<ExchangeRate>("exchange_rates");
            const activeRates = allRates
              .filter((r) => r.isActive)
              .sort(
                (a, b) =>
                  new Date(b.effectiveDate).getTime() -
                  new Date(a.effectiveDate).getTime(),
              );

            // Buscar la tasa más reciente hasta el día del pedido
            const usdRate = activeRates.find(
              (r) =>
                r.toCurrency === "USD" &&
                new Date(r.effectiveDate).getTime() <= orderDateObj.getTime(),
            );
            const eurRate = activeRates.find(
              (r) =>
                r.toCurrency === "EUR" &&
                new Date(r.effectiveDate).getTime() <= orderDateObj.getTime(),
            );

            // Si no hay tasa para el día del pedido, usar la más reciente disponible
            const latestUsd = activeRates.find((r) => r.toCurrency === "USD");
            const latestEur = activeRates.find((r) => r.toCurrency === "EUR");

            setLocalExchangeRates({
              USD: usdRate || latestUsd,
              EUR: eurRate || latestEur,
            });
            void getActiveExchangeRates().then(setLiveExchangeRates);
          }
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
      originalCurrency: Currency = "Bs",
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
              `No hay tasa del día del pedido para ${originalCurrency}, mostrando valor original`,
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
          `No hay tasa del día del pedido para ${selectedCurrency}, mostrando en Bs`,
        );
        return formatCurrency(amountInBs, "Bs");
      } catch (error) {
        console.error("Error converting currency:", error);
        return formatCurrency(amount, originalCurrency);
      }
    },
    [selectedCurrency, localExchangeRates],
  );

  // Formatear totales siempre en USD como principal, Bs como secundario
  useEffect(() => {
    const formatTotals = () => {
      if (!order) return;

      const totals: Record<string, { primary: string; secondary?: string }> =
        {};

      totals.total = formatOrderAmountWithOrderRateBs(order.total, order);
      totals.subtotal = formatOrderAmountWithOrderRateBs(order.subtotal, order);
      totals.tax = formatOrderAmountWithOrderRateBs(order.taxAmount, order);
      totals.subtotalBeforeDiscounts = formatOrderAmountWithOrderRateBs(
        order.subtotalBeforeDiscounts || 0,
        order,
      );

      if (order.productDiscountTotal && order.productDiscountTotal > 0) {
        totals.productDiscountTotal = formatOrderAmountWithOrderRateBs(
          order.productDiscountTotal,
          order,
        );
      }

      if (order.generalDiscountAmount && order.generalDiscountAmount > 0) {
        totals.generalDiscountAmount = formatOrderAmountWithOrderRateBs(
          order.generalDiscountAmount,
          order,
        );
      }

      if (order.deliveryCost > 0) {
        totals.deliveryCost = formatOrderAmountWithOrderRateBs(
          order.deliveryCost,
          order,
        );
      }

      if (productSurchargeTotal > 0) {
        totals.productSurchargeTotal = formatOrderAmountWithOrderRateBs(
          productSurchargeTotal,
          order,
        );
      }

      setFormattedTotals(totals);
    };

    formatTotals();
  }, [order, localExchangeRates, productSurchargeTotal]);

  // Formatear pagos cuando cambia la moneda seleccionada
  useEffect(() => {
    const formatPayments = async () => {
      if (!order || activePayments.length === 0) {
        setFormattedPayments([]);
        setFormattedTotalPaid("");
        // Si no hay pagos, el saldo pendiente es el total del pedido
        if (order) {
          if (order.total > PENDING_BALANCE_EPSILON_BS) {
            const totalInBs = order.total;
            if (selectedCurrency && selectedCurrency !== "Bs") {
              const pendingFormatted = await formatWithSelectedCurrency(
                totalInBs,
                "Bs",
              );
              setFormattedPendingBalance(pendingFormatted);
            } else {
              setFormattedPendingBalance(formatCurrency(totalInBs, "Bs"));
            }
          } else {
            setFormattedPendingBalance("");
          }
        } else {
          setFormattedPendingBalance("");
        }
        return;
      }

      const paymentsFormatted = await Promise.all(
        activePayments.map(async (payment) => {
          const originalPayment = getOriginalPaymentAmount(
            payment,
            localExchangeRates,
          );
          const originalFormatted = formatCurrency(
            originalPayment.amount,
            originalPayment.currency as Currency,
          );

          let convertedFormatted: string | undefined;
          if (
            selectedCurrency &&
            selectedCurrency !== originalPayment.currency
          ) {
            // Convertir el pago a la moneda seleccionada
            convertedFormatted = await formatWithSelectedCurrency(
              originalPayment.amount,
              originalPayment.currency as Currency,
            );
          }

          return {
            original: originalFormatted,
            converted: convertedFormatted,
            currency: originalPayment.currency,
          };
        }),
      );

      if (selectedCurrency && selectedCurrency !== "Bs") {
        const totalPaidFormatted = await formatWithSelectedCurrency(
          totalPaidUsd,
          "USD",
        );
        setFormattedTotalPaid(totalPaidFormatted);
      } else {
        setFormattedTotalPaid(formatCurrency(totalPaidUsd, "USD"));
      }

      if (pendingBalanceUsd > PAYMENT_BALANCE_EPSILON_USD) {
        if (selectedCurrency && selectedCurrency !== "Bs") {
          const pendingFormatted = await formatWithSelectedCurrency(
            pendingBalanceUsd,
            "USD",
          );
          setFormattedPendingBalance(pendingFormatted);
        } else {
          setFormattedPendingBalance(
            formatCurrency(pendingBalanceUsd, "USD"),
          );
        }
      } else {
        setFormattedPendingBalance("");
      }

      setFormattedPayments(paymentsFormatted);
    };

    formatPayments();
  }, [
    order,
    activePayments,
    selectedCurrency,
    formatWithSelectedCurrency,
    localExchangeRates,
    totalPaidUsd,
    pendingBalanceUsd,
  ]);

  // Formatear precios, descuentos, totales y calcular desglose detallado de productos
  useEffect(() => {
    const formatProductData = () => {
      if (!order || categories.length === 0 || allProducts.length === 0) return;

      const fmtAmount = (amount: number) =>
        formatOrderAmountWithOrderRateBs(amount, order);
      /** Formatea un monto en su moneda nativa (evita doble conversión en desglose). */
      const fmtAmountInCurrency = (
        amount: number,
        currency: Currency = "Bs",
      ) =>
        formatOrderAmountWithOrderRateBs(amount, {
          ...order,
          baseCurrency: currency,
        });

      /** Resolución de catálogo para desglose (incl. pedidos convertidos desde reserva). */
      const resolveCatalogForDetail = (
        line: OrderProduct,
      ): Product | undefined =>
        resolveCatalogProductForOrderLine(line, allProducts);

      const formattedDiscounts: Record<
        string,
        { primary: string; secondary?: string }
      > = {};
      const formattedPrices: Record<
        string,
        { primary: string; secondary?: string }
      > = {};
      const formattedTotals: Record<
        string,
        { primary: string; secondary?: string }
      > = {};
      const formattedSurcharges: Record<
        string,
        { primary: string; secondary?: string }
      > = {};
      const linePricingRates = commercialRatesToExchangeRatesInput(
        getCommercialRatesFromOrder(order),
      );
      const linePricingBase = getOrderBaseCurrency(order);
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
        const originalProduct = resolveCatalogForDetail(orderProduct);
        const lineCurrency =
          orderProduct.priceCurrency ||
          originalProduct?.priceCurrency ||
          "Bs";
        formattedPrices[orderProduct.id] =
          lineCurrency === "USD" || lineCurrency === "EUR"
            ? {
                primary: formatCurrency(orderProduct.price, lineCurrency),
                ...(localExchangeRates?.USD?.rate &&
                lineCurrency === "USD"
                  ? {
                      secondary: formatCurrency(
                        orderProduct.price * localExchangeRates.USD.rate,
                        "Bs",
                      ),
                    }
                  : {}),
              }
            : fmtAmount(orderProduct.price);
        if (orderProduct.discount && orderProduct.discount > 0) {
          formattedDiscounts[orderProduct.id] = fmtAmount(orderProduct.discount);
        }
        const productTotal = orderProduct.total - (orderProduct.discount || 0);
        formattedTotals[orderProduct.id] = fmtAmount(productTotal);

        if (
          orderProduct.surchargeEnabled &&
          orderProduct.surchargeAmount &&
          orderProduct.surchargeAmount > 0
        ) {
          const surchargeAmt = getProductLineSurchargeInBaseCurrency(
            orderProduct,
            {
              baseCurrency: linePricingBase,
              exchangeRates: linePricingRates,
              categories,
              allProducts,
            },
          );
          if (surchargeAmt > 0) {
            formattedSurcharges[orderProduct.id] = fmtAmount(surchargeAmt);
          }
        }

        // Calcular desglose detallado
        const category = categories.find(
          (cat) => cat.name === orderProduct.category,
        );
        if (!category) continue;

        // Precio base = precio de catálogo (originalProduct.price).
        // orderProduct.price es el unitario configurado (incluye atributos), NO el precio base.
        // Si no resuelve el catálogo, mostramos '—' en el label (no inventamos con el total).
        const basePriceCurrency = (originalProduct?.priceCurrency ||
          orderProduct.priceCurrency ||
          "Bs") as Currency;
        const nativeBasePrice = originalProduct?.price;
        const rate =
          basePriceCurrency === "USD"
            ? localExchangeRates?.USD?.rate
            : basePriceCurrency === "EUR"
              ? localExchangeRates?.EUR?.rate
              : undefined;
        const toBs = (amt: number) =>
          basePriceCurrency === "Bs" ? amt : rate ? amt * rate : amt;
        // basePriceInBs alimenta el cálculo del unitario mostrado en el desglose.
        // Sin catálogo, fallback al precio de línea para no romper el unitario.
        const basePriceInBs =
          nativeBasePrice != null ? toBs(nativeBasePrice) : toBs(orderProduct.price);
        const basePriceFormatted =
          nativeBasePrice == null
            ? { primary: "—" }
            : basePriceCurrency === "USD" || basePriceCurrency === "EUR"
              ? {
                  primary: formatCurrency(nativeBasePrice, basePriceCurrency),
                  ...(rate
                    ? {
                        secondary: formatCurrency(nativeBasePrice * rate, "Bs"),
                      }
                    : {}),
                }
              : fmtAmountInCurrency(basePriceInBs, "Bs");

        // Calcular ajustes de atributos normales
        const attributeAdjustments = calculateDetailedAttributeAdjustments(
          orderProduct.attributes || {},
          category,
          localExchangeRates,
        );

        const formattedAttributeAdjustments = attributeAdjustments.map(
          (adj) => ({
            name: adj.attributeName,
            value: adj.selectedValueLabel,
            adjustment: fmtAmountInCurrency(
              adj.adjustmentInOriginalCurrency,
              (adj.originalCurrency as Currency) || "Bs",
            ),
            adjustmentValue: adj.adjustment, // Mantener el valor en Bs para cálculos
          }),
        );

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
                (p) => p.id === productIdNum,
              );
              if (!foundProduct) continue;

              const productPrice = foundProduct.price;
              const productCurrency = (foundProduct.priceCurrency ||
                "Bs") as Currency;
              const productPriceFormatted = fmtAmountInCurrency(
                productPrice,
                productCurrency,
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
                  (cat) => cat.name === foundProduct.category,
                );
                if (productCategory) {
                  const rawAdjustments = calculateDetailedAttributeAdjustments(
                    editedAttributes,
                    productCategory,
                    localExchangeRates,
                  );

                  productAttrAdjustments = rawAdjustments.map((adj) => ({
                    name: adj.attributeName,
                    value: adj.selectedValueLabel,
                    adjustment: fmtAmountInCurrency(
                      adj.adjustmentInOriginalCurrency,
                      (adj.originalCurrency as Currency) || "Bs",
                    ),
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

        const unitPriceFormatted = fmtAmountInCurrency(unitPriceInBs, "Bs");

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
      setFormattedProductSurcharges(formattedSurcharges);
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Barra de acciones — solo móvil */}
                <div className="flex items-center justify-between gap-2 sm:hidden">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/pedidos")}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Volver
                    </Button>
                    <OrderPdfDownloadButton
                      order={order}
                      client={client}
                      compact
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(order.status === "Generado" ||
                      order.status === "Generada") &&
                      canValidateOrders && (
                        <Button
                          size="sm"
                          onClick={handleValidateOrder}
                          disabled={validatingOrder}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {validatingOrder && (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          )}
                          Validar
                        </Button>
                      )}
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-0 flex-1 sm:flex-row sm:items-center sm:gap-4">
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <Button
                      variant="ghost"
                      onClick={() => router.push("/pedidos")}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Volver
                    </Button>
                    <OrderPdfDownloadButton order={order} client={client} />
                  </div>
                  <HoverCard openDelay={300} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div className="cursor-help border-b border-dashed border-transparent hover:border-muted-foreground/40 pb-0.5 transition-colors min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold break-words">
                          {isReservationOrder(order)
                            ? "Reserva "
                            : "Pedido "}

                          {order.orderNumber}
                          {order.convertedFromNumber !== null &&
                          order.convertedFromNumber !== "" ? (
                            <>
                              {", Convertido de Orden "}
                              <button
                                type="button"
                                className="font-bold text-primary underline-offset-4 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/pedidos/${encodeURIComponent(order.convertedFromNumber!)}`,
                                  );
                                }}
                              >
                                {order.convertedFromNumber}
                              </button>
                            </>
                          ) : (
                            ""
                          )}
                        </h1>

                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                        <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                          Pasa el cursor para ver resumen del pedido
                        </p>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                      className="min-w-[320px] max-w-[min(420px,95vw)]"
                      align="start"
                    >
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">
                          Resumen del pedido
                        </h4>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Cliente:
                          </span>{" "}
                          {order.clientName}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Vendedor:
                          </span>{" "}
                          {order.vendorName}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Total:</span>{" "}
                          <OrderCurrency
                            amount={order.total}
                            inline
                            className="inline"
                          />
                        </p>
                        <>
                          {hasMeaningfulPendingBalance && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              <span className="text-muted-foreground">
                                Saldo pendiente:
                              </span>{" "}
                              <OrderPaymentCurrency
                                amountUsd={pendingBalanceUsd}
                                inline
                                className="inline font-medium"
                              />
                            </p>
                          )}
                          {order.paymentCondition === "cashea" &&
                            casheaHasFinancedLine && (
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                Incluye línea de financiación Cashea por el
                                saldo no cobrado en tienda.
                              </p>
                            )}
                        </>
                        {order.deliveryAddress && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Dirección:
                            </span>{" "}
                            {order.deliveryAddress}
                          </p>
                        )}
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Productos:
                          </span>{" "}
                          {order.products.length}
                        </p>
                        {order.observations && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Observaciones:
                            </span>{" "}
                            {order.observations.slice(0, 80)}
                            {order.observations.length > 80 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  {(order.status === "Generado" ||
                    order.status === "Generada") &&
                    canValidateOrders && (
                      <Button
                        onClick={handleValidateOrder}
                        disabled={validatingOrder}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {validatingOrder && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Validar Pedido
                      </Button>
                    )}
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="font-medium">{order.clientName}</p>
                        {client?.rutId && (
                          <p className="text-xs text-muted-foreground">
                            RUT/ID: {client.rutId}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Teléfono
                        </p>
                        <p className="font-medium">
                          {client?.telefono || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Dirección
                        </p>
                        <p className="font-medium">
                          {client?.direccion || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Tipo de Venta
                        </p>
                        <p className="font-medium">
                          {order.saleType
                            ? getSaleTypeLabel(order.saleType)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Condición de Pago
                        </p>
                        <p className="font-medium">
                          {order.paymentCondition
                            ? PAYMENT_CONDITIONS.find(
                                (pc) => pc.value === order.paymentCondition,
                              )?.label || order.paymentCondition
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Método de Pago
                        </p>
                        <p className="font-medium">
                          {order.paymentMethod || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Vendedor</p>
                        <p className="font-medium">{order.vendorName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Referidor
                        </p>
                        <p className="font-medium">
                          {order.referrerName || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Fecha de Creación
                        </p>
                        <p className="font-medium">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
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
              {/* Obsevbaciones de despacho*/}
              {order.dispatchObservations && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5" />
                      Observaciones de Despacho
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-950 p-3 rounded">
                      {order.dispatchObservations}
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

                      // DEBUG: Verificar imágenes de productos
                      if (product.images && product.images.length > 0) {
                        console.log(
                          `📸 Producto ${idx} (${product.name}) tiene ${product.images.length} imágenes:`,
                          product.images,
                        );
                      } else {
                        console.log(
                          `⚠️ Producto ${idx} (${product.name}) NO tiene imágenes:`,
                          product.images,
                        );
                      }

                      return (
                        <HoverCard key={idx} openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div
                              className={`border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? "bg-background" : "dark:bg-muted/30 bg-muted/30"}`}
                            >
                              {/* Estado de ubicación y logística */}
                              <div className="mb-3 pb-3 border-b flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                  {/* Badge de Ubicación/Fabricación Original */}
                                  {(() => {
                                    let badgeText = "Disponibilidad Inmediata";
                                    let badgeVariant:
                                      | "default"
                                      | "destructive"
                                      | "secondary"
                                      | "outline" = "secondary";
                                    let badgeClassName = "text-sm";

                                    // Normalizar locationStatus para comparación (trim y manejar ambos formatos)
                                    const locationStatus =
                                      product.locationStatus?.trim();

                                    // Verificar si es "EN TIENDA" (ambos formatos)
                                    if (
                                      locationStatus === "en_tienda" ||
                                      locationStatus === "EN TIENDA"
                                    ) {
                                      badgeText = "En Tienda";
                                      badgeVariant = "default";
                                    }
                                    // Verificar si es "FABRICACION"
                                    // También verificar variaciones con espacios o mayúsculas/minúsculas
                                    else if (
                                      locationStatus === "FABRICACION" ||
                                      locationStatus?.toUpperCase() ===
                                        "FABRICACION" ||
                                      (locationStatus &&
                                        locationStatus
                                          .toLowerCase()
                                          .includes("fabric"))
                                    ) {
                                      if (
                                        product.manufacturingStatus ===
                                          "almacen_no_fabricado" ||
                                        (product.manufacturingStatus as string) ===
                                          "fabricado"
                                      ) {
                                        badgeText = "En almacén";
                                        badgeVariant = "default";
                                        badgeClassName =
                                          "text-sm bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
                                      } else if (
                                        product.manufacturingStatus ===
                                        "fabricando"
                                      ) {
                                        badgeText = "En Fabricación";
                                        badgeVariant = "secondary";
                                        badgeClassName =
                                          "text-sm bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
                                      } else if (
                                        product.manufacturingStatus ===
                                        "por_fabricar"
                                      ) {
                                        badgeText = "Por fabricar";
                                        badgeVariant = "secondary";
                                        badgeClassName =
                                          "text-sm bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200";
                                      } else {
                                        badgeText = "Debe fabricar";
                                        badgeVariant = "outline";
                                        badgeClassName =
                                          "text-sm text-foreground border-0";
                                      }
                                    }

                                    return (
                                      <Badge
                                        variant={badgeVariant}
                                        className={badgeClassName}
                                        title="Estado de Producción/Ubicación"
                                      >
                                        {badgeText}
                                      </Badge>
                                    );
                                  })()}

                                  {/* Progress / Logistic Status */}
                                  <Badge
                                    variant={
                                      product.logisticStatus === "Completado"
                                        ? "default"
                                        : "secondary"
                                    }
                                    title="Estado Logístico"
                                  >
                                    {product.logisticStatus || "Generado"}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-lg">
                                      {product.name}
                                    </p>
                                    <CommissionLineSourceBadge
                                      source={product.commissionLineSource}
                                    />
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Cantidad: {product.quantity}
                                  </p>
                                  {product.discount &&
                                    product.discount > 0 &&
                                    (() => {
                                      const discMode =
                                        getLineDiscountDisplayMode(
                                          product,
                                          (preferredCurrency as Currency) ||
                                            "Bs",
                                        );
                                      return (
                                        <p className="text-sm text-red-600 mt-1">
                                          <span>
                                            {getLineDiscountLabelLead(discMode)}
                                          </span>{" "}
                                          -{" "}
                                          {formattedProductDiscounts[
                                            product.id
                                          ] ? (
                                            <FormattedCurrencyDisplay
                                              formatted={
                                                formattedProductDiscounts[
                                                  product.id
                                                ]
                                              }
                                              inline={true}
                                              className="inline"
                                            />
                                          ) : (
                                            formatCurrency(
                                              product.discount,
                                              "Bs",
                                            )
                                          )}
                                        </p>
                                      );
                                    })()}
                                </div>
                                <div className="text-right">
                                  {formattedProductTotals[product.id] ? (
                                    <FormattedCurrencyDisplay
                                      formatted={
                                        formattedProductTotals[product.id]
                                      }
                                      className="font-semibold text-lg"
                                    />
                                  ) : (
                                    <p className="font-semibold text-lg">
                                      {formatCurrency(
                                        product.total - (product.discount || 0),
                                        "Bs",
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
                                      <FormattedCurrencyDisplay
                                        formatted={breakdown.basePrice}
                                      />
                                    ) : null}
                                  </div>

                                  {/* Ajustes de atributos normales */}
                                  {breakdown.attributeAdjustments.length >
                                    0 && (
                                    <>
                                      {breakdown.attributeAdjustments.map(
                                        (
                                          adj: {
                                            name: string;
                                            value: string;
                                            adjustment: {
                                              primary: string;
                                              secondary?: string;
                                            };
                                            adjustmentValue: number;
                                          },
                                          adjIdx: number,
                                        ) => (
                                          <div
                                            key={adjIdx}
                                            className="flex justify-between pl-4"
                                          >
                                            <span className="text-muted-foreground">
                                              {adj.name}
                                              {adj.value
                                                ? ` (${adj.value})`
                                                : ""}
                                              :
                                            </span>
                                            <span
                                              className={
                                                adj.adjustmentValue > 0
                                                  ? "text-green-600 dark:text-green-400"
                                                  : adj.adjustmentValue < 0
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-muted-foreground"
                                              }
                                            >
                                              {adj.adjustmentValue > 0
                                                ? "+"
                                                : ""}
                                              <FormattedCurrencyDisplay
                                                formatted={adj.adjustment}
                                                inline={true}
                                                className="inline"
                                              />
                                            </span>
                                          </div>
                                        ),
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
                                            price: {
                                              primary: string;
                                              secondary?: string;
                                            };
                                            priceValue: number;
                                            adjustments: Array<{
                                              name: string;
                                              value: string;
                                              adjustment: {
                                                primary: string;
                                                secondary?: string;
                                              };
                                              adjustmentValue: number;
                                            }>;
                                          },
                                          prodIdx: number,
                                        ) => (
                                          <div
                                            key={prodIdx}
                                            className="space-y-1"
                                          >
                                            {/* Precio del producto */}
                                            <div className="flex justify-between pl-4">
                                              <span className="text-muted-foreground">
                                                {prodAttr.name}:
                                              </span>
                                              <span className="text-green-600 dark:text-green-400">
                                                +
                                                <FormattedCurrencyDisplay
                                                  formatted={prodAttr.price}
                                                  inline={true}
                                                  className="inline"
                                                />
                                              </span>
                                            </div>
                                            {/* Ajustes de atributos del producto */}
                                            {prodAttr.adjustments.length >
                                              0 && (
                                              <>
                                                {prodAttr.adjustments.map(
                                                  (
                                                    adj: {
                                                      name: string;
                                                      value: string;
                                                      adjustment: {
                                                        primary: string;
                                                        secondary?: string;
                                                      };
                                                      adjustmentValue: number;
                                                    },
                                                    adjIdx: number,
                                                  ) => (
                                                    <div
                                                      key={adjIdx}
                                                      className="flex justify-between pl-8 text-xs"
                                                    >
                                                      <span className="text-muted-foreground">
                                                        {prodAttr.name} -{" "}
                                                        {adj.name}
                                                        {adj.value
                                                          ? ` (${adj.value})`
                                                          : ""}
                                                        :
                                                      </span>
                                                      <span
                                                        className={
                                                          adj.adjustmentValue >
                                                          0
                                                            ? "text-green-600 dark:text-green-400"
                                                            : adj.adjustmentValue <
                                                                0
                                                              ? "text-red-600 dark:text-red-400"
                                                              : "text-muted-foreground"
                                                        }
                                                      >
                                                        {adj.adjustmentValue > 0
                                                          ? "+"
                                                          : ""}
                                                        <FormattedCurrencyDisplay
                                                          formatted={
                                                            adj.adjustment
                                                          }
                                                          inline={true}
                                                          className="inline"
                                                        />
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                              </>
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </>
                                  )}

                                  {product.surchargeEnabled &&
                                    product.surchargeAmount &&
                                    product.surchargeAmount > 0 && (
                                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                                        <span>
                                          Sobreprecio
                                          {product.surchargeReason
                                            ? ` (${product.surchargeReason})`
                                            : ""}
                                          :
                                        </span>
                                        {formattedProductSurcharges[
                                          product.id
                                        ] ? (
                                          <FormattedCurrencyDisplay
                                            formatted={
                                              formattedProductSurcharges[
                                                product.id
                                              ]
                                            }
                                          />
                                        ) : null}
                                      </div>
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
                              {breakdown &&
                                breakdown.attributeAdjustments.length > 0 && (
                                  <div className="space-y-1.5">
                                    {breakdown.attributeAdjustments.map(
                                      (adj, adjIdx) => (
                                        <div key={adjIdx} className="text-sm">
                                          <span className="font-medium text-muted-foreground">
                                            {adj.name}:
                                          </span>{" "}
                                          <span className="text-foreground">
                                            {adj.value || "N/A"}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              {breakdown &&
                                breakdown.productAttributes.length > 0 && (
                                  <div className="space-y-2 mt-3 pt-3 border-t">
                                    {breakdown.productAttributes.map(
                                      (prodAttr, prodIdx) => (
                                        <div
                                          key={prodIdx}
                                          className="space-y-1"
                                        >
                                          <div className="text-sm font-medium text-muted-foreground">
                                            {prodAttr.name}
                                          </div>
                                          {prodAttr.adjustments.length > 0 && (
                                            <div className="pl-3 space-y-1">
                                              {prodAttr.adjustments.map(
                                                (adj, adjIdx) => (
                                                  <div
                                                    key={adjIdx}
                                                    className="text-xs"
                                                  >
                                                    <span className="text-muted-foreground">
                                                      {adj.name}:
                                                    </span>{" "}
                                                    <span className="text-foreground">
                                                      {adj.value || "N/A"}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              {(!breakdown ||
                                (breakdown.attributeAdjustments.length === 0 &&
                                  breakdown.productAttributes.length ===
                                    0)) && (
                                <p className="text-sm text-muted-foreground">
                                  Sin atributos personalizados
                                </p>
                              )}
                            </div>
                          </HoverCardContent>

                          {/* Imágenes del Producto - FUERA del HoverCardTrigger para mejor visibilidad */}
                          {product.images && product.images.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <ImageGallery
                                images={product.images}
                                title="Imágenes de referencia"
                                maxThumbnails={3}
                              />
                            </div>
                          )}
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
                          "Bs",
                        )}{" "}
                        (Fecha efectiva:{" "}
                        {new Date(
                          localExchangeRates[selectedCurrency]!.effectiveDate,
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
                        <FormattedCurrencyDisplay
                          formatted={formattedTotals.subtotalBeforeDiscounts}
                        />
                      ) : (
                        <OrderCurrency
                          amount={order.subtotalBeforeDiscounts || 0}
                        />
                      )}
                    </div>
                    {order.productDiscountTotal &&
                      order.productDiscountTotal > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>{individualDiscountsSummaryLabel}</span>
                          {formattedTotals.productDiscountTotal ? (
                            <FormattedCurrencyDisplay
                              formatted={formattedTotals.productDiscountTotal}
                            />
                          ) : (
                            <OrderCurrency amount={order.productDiscountTotal} />
                          )}
                        </div>
                      )}
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal después de descuentos:</span>
                      {formattedTotals.subtotal ? (
                        <FormattedCurrencyDisplay
                          formatted={formattedTotals.subtotal}
                        />
                      ) : (
                        <OrderCurrency amount={order.subtotal} />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto (16%):</span>
                      {formattedTotals.tax ? (
                        <FormattedCurrencyDisplay
                          formatted={formattedTotals.tax}
                        />
                      ) : (
                        <OrderCurrency amount={order.taxAmount} />
                      )}
                    </div>
                    {productSurchargeTotal > 0 && (
                      <div className="flex justify-between">
                        <span>Sobreprecio:</span>
                        {formattedTotals.productSurchargeTotal ? (
                          <FormattedCurrencyDisplay
                            formatted={formattedTotals.productSurchargeTotal}
                          />
                        ) : (
                          <OrderCurrency amount={productSurchargeTotal} />
                        )}
                      </div>
                    )}
                    {order.generalDiscountAmount &&
                      order.generalDiscountAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>{generalDiscountSummaryLabel}</span>
                          {formattedTotals.generalDiscountAmount ? (
                            <FormattedCurrencyDisplay
                              formatted={formattedTotals.generalDiscountAmount}
                            />
                          ) : (
                            <OrderCurrency amount={order.generalDiscountAmount} />
                          )}
                        </div>
                      )}
                    {order.deliveryCost > 0 && (
                      <div className="flex justify-between">
                        <span>Servicios Adicionales:</span>
                        {formattedTotals.deliveryCost ? (
                          <FormattedCurrencyDisplay
                            formatted={formattedTotals.deliveryCost}
                          />
                        ) : (
                          <OrderCurrency amount={order.deliveryCost} />
                        )}
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      {formattedTotals.total ? (
                        <FormattedCurrencyDisplay
                          formatted={formattedTotals.total}
                        />
                      ) : (
                        <OrderCurrency amount={order.total} />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pagos */}
              {activePayments.length > 0 && (
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
                            "Bs",
                          )}{" "}
                          (Fecha efectiva:{" "}
                          {new Date(
                            localExchangeRates[selectedCurrency]!.effectiveDate,
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
                              "Bs",
                            )}`}
                          {localExchangeRates.USD &&
                            localExchangeRates.EUR &&
                            " | "}
                          {localExchangeRates.EUR &&
                            `EUR: ${formatCurrency(
                              localExchangeRates.EUR.rate,
                              "Bs",
                            )}`}
                        </p>
                      )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activePayments.map((payment, idx) => {
                        const formattedPayment = formattedPayments[idx];
                        if (!formattedPayment) {
                          const originalPayment = getOriginalPaymentAmount(
                            payment,
                            localExchangeRates,
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
                                {originalPayment.currency === "Bs" ? (
                                  <OrderCurrency
                                    amount={originalPayment.amount}
                                    amountCurrency="Bs"
                                    paymentUsdRate={
                                      paymentExchangeRate
                                    }
                                  />
                                ) : (
                                  <span className="font-medium text-right">
                                    {formatCurrency(
                                      originalPayment.amount,
                                      originalPayment.currency as Currency,
                                    )}
                                    {paymentExchangeRate &&
                                      paymentCurrency === "USD" && (
                                        <span className="block text-xs text-muted-foreground">
                                          {formatCurrency(
                                            originalPayment.amount *
                                              paymentExchangeRate,
                                            "Bs",
                                          )}
                                        </span>
                                      )}
                                  </span>
                                )}
                              </div>

                              {paymentExchangeRate && (
                                  <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded">
                                    💱 Tasa de cambio del día del pago: 1{" "}
                                    {paymentCurrency} ={" "}
                                    {formatCurrency(paymentExchangeRate, "Bs")}
                                    {payment.date && (
                                      <span className="ml-2">
                                        (Fecha del pago:{" "}
                                        {new Date(
                                          payment.date,
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
                                      payment.date,
                                    ).toLocaleDateString()}
                                  </div>
                                )}

                              {/* Comprobante de Pago - Imágenes */}
                              {payment.images && payment.images.length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <ImageGallery
                                    images={payment.images}
                                    title={`Comprobante de ${payment.method}`}
                                    maxThumbnails={2}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        }

                        const originalPayment = getOriginalPaymentAmount(
                          payment,
                          localExchangeRates,
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
                              {originalPayment.currency === "Bs" ? (
                                <OrderCurrency
                                  amount={originalPayment.amount}
                                  amountCurrency="Bs"
                                  paymentUsdRate={paymentExchangeRate}
                                />
                              ) : (
                                <div className="text-right">
                                  <div className="font-medium">
                                    {formatCurrency(
                                      originalPayment.amount,
                                      originalPayment.currency as Currency,
                                    )}
                                  </div>
                                  {payment.amount > 0 &&
                                    originalPayment.currency === "USD" && (
                                      <div className="text-xs text-muted-foreground">
                                        {formatCurrency(
                                          payment.amount,
                                          "Bs",
                                        )}
                                      </div>
                                    )}
                                  {formattedPayment.converted &&
                                    originalPayment.currency !== "USD" && (
                                      <div className="text-xs text-muted-foreground">
                                        {formattedPayment.converted}
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>

                            {paymentExchangeRate && (
                                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded">
                                  💱 Tasa de cambio del día del pago: 1{" "}
                                  {paymentCurrency} ={" "}
                                  {formatCurrency(paymentExchangeRate, "Bs")}
                                  {payment.date && (
                                    <span className="ml-2">
                                      (Fecha del pago:{" "}
                                      {new Date(
                                        payment.date,
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

                            {/* Comprobante de Pago - Imágenes */}
                            {payment.images && payment.images.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <ImageGallery
                                  images={payment.images}
                                  title={`Comprobante de ${payment.method}`}
                                  maxThumbnails={2}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <Separator />
                      {order.paymentCondition === "cashea" &&
                        casheaHasFinancedLine && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Pago inicial en tienda:</span>
                            <OrderPaymentCurrency
                              amountUsd={casheaPaidInStoreUsd}
                              showCollectedBs
                            />
                          </div>
                        )}
                      <div className="flex justify-between font-semibold">
                        <span>
                          {order.paymentCondition === "cashea" &&
                          casheaHasFinancedLine
                            ? "Total cubierto (inicial + financiación Cashea):"
                            : "Total Pagado:"}
                        </span>
                        <OrderPaymentCurrency
                          amountUsd={casheaTotalCoveredUsd}
                          showCollectedBs
                        />
                      </div>
                      {(order.appliedStoreCreditUsd ?? 0) > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Crédito de tienda aplicado (equiv. Bs):</span>
                          <OrderCurrency
                            amount={appliedStoreCreditBsOnOrder(order)}
                          />
                        </div>
                      )}

                      {/* Mostrar saldo pendiente si existe (en USD cuando hay tasa, para ver cuánto debe) */}
                      {formattedPendingBalance &&
                        hasMeaningfulPendingBalance && (
                          <>
                            <Separator />
                            <div className="space-y-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                  <span className="font-semibold text-red-700 dark:text-red-300">
                                    Saldo pendiente (lo que debe el cliente):
                                  </span>
                                </div>
                                <div className="text-right">
                                  <OrderPaymentCurrency
                                    amountUsd={pendingBalanceUsd}
                                    className="font-bold text-lg text-red-700 dark:text-red-300"
                                  />
                                </div>
                              </div>
                              {localExchangeRates?.USD?.rate && (
                                <p className="text-xs text-red-600/90 dark:text-red-400/90">
                                  Saldo comercial en USD; equivalente en Bs con
                                  tasa del pedido
                                </p>
                              )}
                            </div>
                          </>
                        )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {order.paymentCondition === "cashea" && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                  <CardContent className="p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {casheaHasFinancedLine
                        ? "Cashea: el pago inicial se registró en tienda; el resto del total figura como financiación Cashea. El seguimiento de cuotas lo gestiona la plataforma Cashea."
                        : "Cashea: registre el pago inicial en tienda; al guardar, el saldo restante quedará como financiación Cashea en el pedido."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Mostrar saldo pendiente cuando NO hay pagos */}
              {activePayments.length === 0 &&
                formattedPendingBalance &&
                hasMeaningfulPendingBalance && (
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
                          Este pedido aún no tiene pagos registrados. Total a
                          pagar (lo que debe el cliente):
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-red-700 dark:text-red-300">
                            Total pendiente:
                          </span>
                          <OrderPaymentCurrency
                            amountUsd={pendingBalanceUsd}
                            className="font-bold text-lg text-red-700 dark:text-red-300"
                          />
                        </div>
                        {localExchangeRates?.USD?.rate && (
                          <p className="text-xs text-red-600/90 dark:text-red-400/90">
                            Mostrado en USD cuando hay tasa disponible;
                            equivalente en Bs entre paréntesis.
                          </p>
                        )}
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
