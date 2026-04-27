"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { toast } from "sonner";
import {
  getVendors,
  getReferrers,
  getCategories,
  getProducts,
  getAccounts,
  calculateProductUnitPriceWithAttributes,
  resolveProductFromAttributeValue,
  type OrderProduct,
  type PartialPayment,
  type Vendor,
  type Category,
  type Product,
  type Account,
  type AttributeValue,
  type Order,
} from "@/lib/storage";
import {
  getActiveExchangeRates,
  formatCurrency,
  type ExchangeRate,
  type Currency,
} from "@/lib/currency-utils";
import {
  getActivePaymentsList,
  filterCasheaStubForEditForm,
  PAYMENT_BALANCE_EPSILON_BS,
} from "@/lib/order-payments";
import {
  mergeDiscountUiIntoAttributes,
  readDiscountUiFromProduct,
} from "@/lib/product-discount-ui";

export interface OrderFormData {
  vendor: string;
  referrer: string;
  paymentMethod: string;
  deliveryAddress: string;
  firstPaymentAmount: 0;
  pagomovilReference: string;
  pagomovilBank: string;
  pagomovilPhone: string;
  pagomovilDate: string;
  transferenciaBank: string;
  transferenciaReference: string;
  transferenciaDate: string;
  cashAmount: string;
}

export interface DeliveryServices {
  deliveryExpress?: { enabled: boolean; cost: number; currency: Currency };
  servicioAcarreo?: { enabled: boolean; cost?: number; currency: Currency };
  servicioArmado?: { enabled: boolean; cost: number; currency: Currency };
}

export interface UseOrderFormReturn {
  // Estado del formulario
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Datos del pedido
  selectedClient: {
    id: string;
    name: string;
    address?: string;
    telefono?: string;
    telefono2?: string;
    email?: string;
    rutId?: string;
  } | null;
  setSelectedClient: React.Dispatch<
    React.SetStateAction<UseOrderFormReturn["selectedClient"]>
  >;

  selectedProducts: OrderProduct[];
  setSelectedProducts: React.Dispatch<React.SetStateAction<OrderProduct[]>>;

  formData: OrderFormData;
  setFormData: React.Dispatch<React.SetStateAction<OrderFormData>>;

  // Estados adicionales
  paymentCondition:
  | "cashea"
  | "pagara_en_tienda"
  | "pago_a_entrega"
  | "pago_parcial"
  | "todo_pago"
  | "";
  setPaymentCondition: (
    condition: UseOrderFormReturn["paymentCondition"]
  ) => void;

  saleType: "delivery_express" | "encargo" | "encargo_entrega" | "entrega" | "retiro_almacen" | "retiro_tienda" | "sistema_apartado" | "";
  setSaleType: (type: UseOrderFormReturn["saleType"]) => void;

  deliveryType:
  | "entrega_programada"
  | "delivery_express"
  | "retiro_tienda"
  | "retiro_almacen"
  | "";
  setDeliveryType: (type: UseOrderFormReturn["deliveryType"]) => void;

  deliveryZone: string;
  setDeliveryZone: (zone: string) => void;

  hasDelivery: boolean;
  setHasDelivery: (has: boolean) => void;

  deliveryServices: DeliveryServices;
  setDeliveryServices: React.Dispatch<React.SetStateAction<DeliveryServices>>;

  payments: PartialPayment[];
  setPayments: React.Dispatch<React.SetStateAction<PartialPayment[]>>;

  generalDiscount: number;
  setGeneralDiscount: (discount: number) => void;

  generalDiscountType: "monto" | "porcentaje";
  setGeneralDiscountType: (type: "monto" | "porcentaje") => void;

  generalDiscountCurrency: Currency;
  setGeneralDiscountCurrency: (currency: Currency) => void;

  generalObservations: string;
  setGeneralObservations: (obs: string) => void;

  createSupplierOrder: boolean;
  setCreateSupplierOrder: (create: boolean) => void;

  productMarkups: Record<string, number>;
  setProductMarkups: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;

  productDiscountTypes: Record<string, "monto" | "porcentaje">;
  setProductDiscountTypes: React.Dispatch<
    React.SetStateAction<Record<string, "monto" | "porcentaje">>
  >;

  productDiscountCurrencies: Record<string, Currency>;
  setProductDiscountCurrencies: React.Dispatch<
    React.SetStateAction<Record<string, Currency>>
  >;

  deliveryCurrency: Currency;
  setDeliveryCurrency: (currency: Currency) => void;

  selectedCurrencies: Currency[];
  setSelectedCurrencies: React.Dispatch<React.SetStateAction<Currency[]>>;

  // Datos cargados
  vendors: Vendor[];
  referrers: Vendor[];
  categories: Category[];
  allProducts: Product[];
  accounts: Account[];
  exchangeRates: { USD?: ExchangeRate; EUR?: ExchangeRate };

  // Control de impuesto
  taxEnabled: boolean;
  setTaxEnabled: (enabled: boolean) => void;

  // Valores calculados
  productSubtotal: number;
  productDiscountTotal: number;
  subtotalAfterProductDiscounts: number;
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  totalBeforeGeneralDiscount: number;
  generalDiscountAmount: number;
  total: number;
  totalPaidInBs: number;
  remainingAmount: number;
  isPaymentsValid: boolean;

  // Formateados
  formattedProductPrices: Record<string, string>;
  formattedProductTotals: Record<string, string>;
  formattedProductFinalTotals: Record<string, string>;
  formattedSubtotal: string;

  // Funciones helper
  canGoToNextStep: boolean;
  canCreateBudget: boolean;
  canAddProduct: boolean;
  step1SellerReady: boolean;
  handleNext: () => void;
  handleBack: () => void;
  resetForm: () => void;
  getProductBaseTotal: (product: OrderProduct) => number;
  convertCurrencyValue: (
    value: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ) => number | null;
  getDefaultCurrencyFromSelection: () => Currency;
  getCurrencyOrder: () => Currency[];
  handleProductsSelect: (products: OrderProduct[]) => void;
  handleProductDiscountChange: (
    productId: string,
    value: number,
    opts?: { inputCurrency?: Currency }
  ) => void;
  handleProductDiscountTypeChange: (
    productId: string,
    type: "monto" | "porcentaje"
  ) => void;
  handleGeneralDiscountChange: (value: number) => void;
  handleGeneralDiscountTypeChange: (type: "monto" | "porcentaje") => void;
  calculateDeliveryCost: () => number;
  renderCurrencyCell: (amountInBs: number, className?: string) => React.ReactElement;
  renderCurrencyCellNegative: (
    amountInBs: number,
    className?: string
  ) => React.ReactElement;

  // Mock data (compatibilidad)
  mockVendors: Vendor[];
  mockReferrers: Vendor[];

  needsDraftPrompt: boolean;
  applyDraftAndContinue: () => void;
  discardDraftAndStartFresh: () => void;
  clearDraftStorage: () => void;
  onlineSellerMode: "vendor" | "referrer" | null;
  setOnlineSellerMode: React.Dispatch<
    React.SetStateAction<"vendor" | "referrer" | null>
  >;
  isOnlineSellerReferrer: boolean;
}

export function useEditOrderForm(open: boolean, initialOrder: Order | null = null): UseOrderFormReturn {
  const { preferredCurrency, formatWithPreference } = useCurrency();
  const [currentStep, setCurrentStep] = useState(1);

  // Estados del formulario
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    address?: string;
    telefono?: string;
    telefono2?: string;
    email?: string;
    rutId?: string;
  } | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<OrderProduct[]>([]);
  const [formData, setFormData] = useState<OrderFormData>({
    vendor: "",
    referrer: "",
    paymentMethod: "",
    deliveryAddress: "",
    firstPaymentAmount: 0,
    pagomovilReference: "",
    pagomovilBank: "",
    pagomovilPhone: "",
    pagomovilDate: "",
    transferenciaBank: "",
    transferenciaReference: "",
    transferenciaDate: "",
    cashAmount: "",
  });

  // Estados adicionales
  const [paymentCondition, setPaymentCondition] = useState<
    | "cashea"
    | "pagara_en_tienda"
    | "pago_a_entrega"
    | "pago_parcial"
    | "todo_pago"
    | ""
  >("");
  const [saleType, setSaleType] = useState<
    "delivery_express" | "encargo" | "encargo_entrega" | "entrega" | "retiro_almacen" | "retiro_tienda" | "sistema_apartado" | ""
  >("");
  const [deliveryType, setDeliveryType] = useState<
    | "entrega_programada"
    | "delivery_express"
    | "retiro_tienda"
    | "retiro_almacen"
    | ""
  >("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [hasDelivery, setHasDelivery] = useState(false);
  const [deliveryServices, setDeliveryServices] = useState<DeliveryServices>({
    deliveryExpress: { enabled: false, cost: 0, currency: "USD" },
    servicioAcarreo: { enabled: false, cost: undefined, currency: "USD" },
    servicioArmado: { enabled: false, cost: 0, currency: "USD" },
  });
  const [payments, setPayments] = useState<PartialPayment[]>([]);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [generalDiscountType, setGeneralDiscountType] = useState<
    "monto" | "porcentaje"
  >("monto");
  const [taxEnabled, setTaxEnabled] = useState<boolean>(true); // Impuesto habilitado por defecto
  const [generalDiscountCurrency, setGeneralDiscountCurrency] =
    useState<Currency>(preferredCurrency);
  const [generalObservations, setGeneralObservations] = useState("");
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false);
  const [productMarkups, setProductMarkups] = useState<
    Record<string, number>
  >({});
  const [productDiscountTypes, setProductDiscountTypes] = useState<
    Record<string, "monto" | "porcentaje">
  >({});
  const [productDiscountCurrencies, setProductDiscountCurrencies] = useState<
    Record<string, Currency>
  >({});
  const [deliveryCurrency, setDeliveryCurrency] = useState<Currency>(() => {
    const currencies: Currency[] = ["Bs"];
    if (preferredCurrency !== "Bs" && !currencies.includes(preferredCurrency)) {
      currencies.push(preferredCurrency);
    }
    return currencies.find((c) => c !== "Bs") || preferredCurrency;
  });

  // Inicializar monedas seleccionadas
  const [selectedCurrencies, setSelectedCurrencies] = useState<Currency[]>(
    () => {
      const currencies: Currency[] = ["Bs"];
      if (
        preferredCurrency !== "Bs" &&
        !currencies.includes(preferredCurrency)
      ) {
        currencies.push(preferredCurrency);
      }
      return currencies;
    }
  );

  // Datos cargados
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referrers, setReferrers] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});

  // Formateados
  const [formattedProductPrices, setFormattedProductPrices] = useState<
    Record<string, string>
  >({});
  const [formattedProductTotals, setFormattedProductTotals] = useState<
    Record<string, string>
  >({});
  const [formattedProductFinalTotals, setFormattedProductFinalTotals] =
    useState<Record<string, string>>({});
  const [formattedSubtotal, setFormattedSubtotal] = useState<string>("");
  const [totalPaidInBs, setTotalPaidInBs] = useState(0);

  // Cargar datos
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      try {
        const [
          loadedVendors,
          loadedReferrers,
          loadedCategories,
          loadedProducts,
          loadedAccounts,
          rates,
        ] = await Promise.all([
          getVendors(),
          getReferrers(),
          getCategories(),
          getProducts(),
          getAccounts(),
          getActiveExchangeRates(),
        ]);

        setVendors(loadedVendors);
        setReferrers(loadedReferrers);
        setCategories(loadedCategories);
        setAllProducts(loadedProducts);
        setAccounts(loadedAccounts);
        setExchangeRates(rates);

        // Actualizar monedas seleccionadas según tasas disponibles
        setSelectedCurrencies((prev) => {
          const currencies: Currency[] = ["Bs"];
          if (preferredCurrency !== "Bs") {
            const hasRate =
              preferredCurrency === "USD"
                ? rates.USD !== undefined
                : rates.EUR !== undefined;
            if (hasRate) {
              currencies.push(preferredCurrency);
            }
          }
          if (preferredCurrency !== "USD" && rates.USD) {
            currencies.push("USD");
          }
          if (preferredCurrency !== "EUR" && rates.EUR) {
            currencies.push("EUR");
          }
          return currencies.length > 0 ? currencies : ["Bs"];
        });
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    loadData();
  }, [open, preferredCurrency]);

  // Hidratar formulario al recibir initialOrder
  useEffect(() => {
    if (initialOrder && open) {
      // 1. Cliente
      setSelectedClient({
        id: initialOrder.clientId,
        name: initialOrder.clientName,
        address: initialOrder.deliveryAddress || "",
      });

      // 2. Productos (legacy: si hay descuento en Bs pero no attributes UI, persistir monto + moneda)
      const pref = (preferredCurrency as Currency) || "Bs";
      const productsHydrated = (initialOrder.products || []).map((p) => {
        const discountNum = Number(p.discount);
        const hasDiscount = Number.isFinite(discountNum) && discountNum > 0;
        const hasStoredDiscountUi =
          p.attributes != null &&
          Object.prototype.hasOwnProperty.call(p.attributes, "discountUiType");
        if (!hasStoredDiscountUi && hasDiscount) {
          return {
            ...p,
            attributes: mergeDiscountUiIntoAttributes(p.attributes, "monto", pref),
          };
        }
        return p;
      });
      setSelectedProducts(productsHydrated);

      // 3. FormData básico
      setFormData({
        vendor: initialOrder.vendorId || "",
        referrer: initialOrder.referrerId || "",
        paymentMethod: initialOrder.paymentMethod || "",
        deliveryAddress: initialOrder.deliveryAddress || "",
        firstPaymentAmount: 0,
        pagomovilReference: initialOrder.paymentDetails?.pagomovilReference || "",
        pagomovilBank: initialOrder.paymentDetails?.pagomovilBank || "",
        pagomovilPhone: initialOrder.paymentDetails?.pagomovilPhone || "",
        pagomovilDate: initialOrder.paymentDetails?.pagomovilDate || "",
        transferenciaBank: initialOrder.paymentDetails?.transferenciaBank || "",
        transferenciaReference: initialOrder.paymentDetails?.transferenciaReference || "",
        transferenciaDate: initialOrder.paymentDetails?.transferenciaDate || "",
        cashAmount: initialOrder.paymentDetails?.cashAmount || "",
      });

      // 4. Estados adicionales
      setPaymentCondition(initialOrder.paymentCondition || "todo_pago");
      setSaleType(initialOrder.saleType || "entrega");
      setDeliveryType(initialOrder.deliveryType || "");
      setDeliveryZone(initialOrder.deliveryZone || "");
      setHasDelivery(initialOrder.hasDelivery || false);

      // 5. Servicios de delivery
      if (initialOrder.deliveryServices) {
        setDeliveryServices({
          deliveryExpress: initialOrder.deliveryServices.deliveryExpress || { enabled: false, cost: 0, currency: "USD" },
          servicioAcarreo: initialOrder.deliveryServices.servicioAcarreo || { enabled: false, cost: undefined, currency: "USD" },
          servicioArmado: initialOrder.deliveryServices.servicioArmado || { enabled: false, cost: 0, currency: "USD" },
        });
      }

      // 6. Abonos (misma regla que detalle: partial si tiene ítems, si no mixed)
      setPayments(
        filterCasheaStubForEditForm(
          initialOrder,
          getActivePaymentsList(initialOrder),
        ),
      );

      // 7. Descuentos y observaciones
      if (initialOrder.generalDiscountAmount && initialOrder.generalDiscountAmount > 0) {
        setGeneralDiscount(initialOrder.generalDiscountAmount);
        setGeneralDiscountType("monto");
      }
      setGeneralObservations(initialOrder.observations || "");
      setCreateSupplierOrder(initialOrder.createSupplierOrder || false);

      // 8. Markups
      if (initialOrder.productMarkups) {
        setProductMarkups(initialOrder.productMarkups);
      }

      // 9. Impuesto: alinear con datos persistidos (misma heurística que confirm-order-dialog)
      setTaxEnabled((initialOrder.taxAmount ?? 0) > 0.001);

      const newTypes: Record<string, "monto" | "porcentaje"> = {};
      const newCurrencies: Record<string, Currency> = {};
      productsHydrated.forEach((p) => {
        const { type: attrType, currency: attrCurrency } = readDiscountUiFromProduct(
          p,
          pref
        );
        const discountNum = Number(p.discount);
        const hasDiscount = Number.isFinite(discountNum) && discountNum > 0;
        const hasStoredDiscountUi =
          p.attributes != null &&
          Object.prototype.hasOwnProperty.call(p.attributes, "discountUiType");
        let finalType = attrType;
        let finalCurrency = attrCurrency;
        if (!hasStoredDiscountUi && hasDiscount) {
          finalType = "monto";
          finalCurrency = pref;
        }
        newTypes[p.id] = finalType;
        newCurrencies[p.id] = finalCurrency;
      });
      setProductDiscountTypes(newTypes);
      setProductDiscountCurrencies(newCurrencies);
    }
  }, [initialOrder, open, preferredCurrency]);

  // Funciones helper
  const getCurrencyOrder = useCallback((): Currency[] => {
    if (preferredCurrency === "Bs") {
      return ["Bs", "USD", "EUR"];
    } else if (preferredCurrency === "USD") {
      return ["Bs", "USD", "EUR"];
    } else {
      return ["Bs", "EUR", "USD"];
    }
  }, [preferredCurrency]);

  const getDefaultCurrencyFromSelection = useCallback((): Currency => {
    // Priorizar USD primero si está disponible en selectedCurrencies O si hay tasa de cambio
    if (selectedCurrencies.includes("USD") || exchangeRates.USD?.rate) {
      return "USD";
    }
    // Luego EUR si está disponible en selectedCurrencies O si hay tasa de cambio
    if (selectedCurrencies.includes("EUR") || exchangeRates.EUR?.rate) {
      return "EUR";
    }
    // Si preferredCurrency no es Bs y está disponible, usarla
    if (selectedCurrencies.includes(preferredCurrency) && preferredCurrency !== "Bs") {
      return preferredCurrency;
    }
    // Buscar cualquier moneda no-Bs disponible
    const nonBsCurrency = selectedCurrencies.find((c) => c !== "Bs");
    if (nonBsCurrency) {
      return nonBsCurrency;
    }
    // Fallback: devolver preferredCurrency o USD si no hay nada
    return preferredCurrency !== "Bs" ? preferredCurrency : "USD";
  }, [selectedCurrencies, preferredCurrency, exchangeRates]);

  const convertCurrencyValue = useCallback(
    (value: number, fromCurrency: Currency, toCurrency: Currency): number | null => {
      if (fromCurrency === toCurrency) return value;
      if (fromCurrency === "Bs") {
        const rate =
          toCurrency === "USD" ? exchangeRates.USD?.rate : exchangeRates.EUR?.rate;
        return rate && rate > 0 ? value / rate : null;
      }
      if (toCurrency === "Bs") {
        const rate =
          fromCurrency === "USD" ? exchangeRates.USD?.rate : exchangeRates.EUR?.rate;
        return rate && rate > 0 ? value * rate : null;
      }
      // Entre USD y EUR
      const fromRate =
        fromCurrency === "USD" ? exchangeRates.USD?.rate : exchangeRates.EUR?.rate;
      const toRate =
        toCurrency === "USD" ? exchangeRates.USD?.rate : exchangeRates.EUR?.rate;
      if (fromRate && toRate && fromRate > 0 && toRate > 0) {
        return (value * fromRate) / toRate;
      }
      return null;
    },
    [exchangeRates]
  );

  const calculateDeliveryCost = useCallback((): number => {
    let total = 0;
    if (deliveryServices.deliveryExpress?.enabled && deliveryServices.deliveryExpress.cost) {
      total += deliveryServices.deliveryExpress.cost;
    }
    if (deliveryServices.servicioAcarreo?.enabled && deliveryServices.servicioAcarreo.cost) {
      total += deliveryServices.servicioAcarreo.cost;
    }
    if (deliveryServices.servicioArmado?.enabled && deliveryServices.servicioArmado.cost) {
      total += deliveryServices.servicioArmado.cost;
    }
    return total;
  }, [deliveryServices]);

  /** Evita duplicar envío si coexisten servicios y `order.deliveryCost` por datos inconsistentes. */
  const DELIVERY_TOTAL_EPSILON = 1e-6;
  const deliveryCost = useMemo(() => {
    const fromServices = calculateDeliveryCost();
    if (fromServices > DELIVERY_TOTAL_EPSILON) return fromServices;
    return initialOrder?.deliveryCost ?? 0;
  }, [calculateDeliveryCost, initialOrder?.deliveryCost]);

  const getProductBaseTotal = useCallback(
    (product: OrderProduct): number => {
      const markup = productMarkups[product.id] || 0;
      const category = categories.find((cat) => cat.name === product.category);

      if (!category) {
        // Incluir sobreprecio (viene en USD, convertir a Bs)
        let surchargeInBs = 0;
        if (product.surchargeEnabled && product.surchargeAmount) {
          const usdRate = exchangeRates.USD?.rate;
          surchargeInBs = usdRate && usdRate > 0 ? product.surchargeAmount * usdRate : product.surchargeAmount;
        }
        return product.total + markup + surchargeInBs;
      }

      // Calcular el precio base con todos los ajustes (incluyendo productos-atributos y sus sub-atributos)
      const unitPrice = calculateProductUnitPriceWithAttributes(
        product.price,
        product.attributes,
        category,
        exchangeRates,
        allProducts,
        categories
      );
      const total = unitPrice * product.quantity;

      // Incluir sobreprecio (viene en USD, convertir a Bs)
      let surchargeInBs = 0;
      if (product.surchargeEnabled && product.surchargeAmount) {
        const usdRate = exchangeRates.USD?.rate;
        surchargeInBs = usdRate && usdRate > 0 ? product.surchargeAmount * usdRate : product.surchargeAmount;
      }

      return total + markup + surchargeInBs;
    },
    [
      productMarkups,
      categories,
      allProducts,
      exchangeRates,
      calculateProductUnitPriceWithAttributes,
    ]
  );

  // Valores calculados
  const productSubtotal = useMemo(() => {
    return selectedProducts.reduce((sum, product) => {
      return sum + getProductBaseTotal(product);
    }, 0);
  }, [selectedProducts, getProductBaseTotal]);

  const productDiscountTotal = useMemo(() => {
    return selectedProducts.reduce((sum, product) => {
      return sum + (product.discount || 0);
    }, 0);
  }, [selectedProducts]);

  const subtotalAfterProductDiscounts = useMemo(() => {
    return Math.max(productSubtotal - productDiscountTotal, 0);
  }, [productSubtotal, productDiscountTotal]);

  const subtotal = subtotalAfterProductDiscounts;
  const taxAmount = taxEnabled ? subtotal * 0.16 : 0; // Impuesto condicional (16% o 0%)
  const totalBeforeGeneralDiscount = subtotal + taxAmount + deliveryCost;
  const generalDiscountAmount = Math.min(
    Math.max(generalDiscount, 0),
    totalBeforeGeneralDiscount
  );
  const total = Math.max(totalBeforeGeneralDiscount - generalDiscountAmount, 0);

  // Calcular total pagado
  useEffect(() => {
    const calculateTotal = async () => {
      let totalInBs = 0;
      for (const payment of payments) {
        totalInBs += payment.amount || 0;
      }
      setTotalPaidInBs(totalInBs);
    };
    calculateTotal();
  }, [payments]);

  const remainingAmount = total - totalPaidInBs;
  const isPaymentsValid =
    paymentCondition === "cashea"
      ? payments.length === 1 &&
        (payments[0].amount || 0) > 0 &&
        (payments[0].amount || 0) <= total + PAYMENT_BALANCE_EPSILON_BS
      : Math.abs(remainingAmount) < PAYMENT_BALANCE_EPSILON_BS;

  // Formatear precios
  useEffect(() => {
    const formatPrices = async () => {
      if (selectedProducts.length === 0) {
        setFormattedProductPrices({});
        setFormattedProductTotals({});
        setFormattedProductFinalTotals({});
        return;
      }

      const prices: Record<string, string> = {};
      const totals: Record<string, string> = {};
      const finalTotals: Record<string, string> = {};

      for (const product of selectedProducts) {
        const baseTotal = getProductBaseTotal(product);
        const discount = product.discount || 0;
        const finalTotal = Math.max(baseTotal - discount, 0);

        prices[product.id] = await formatWithPreference(product.price, "Bs");
        totals[product.id] = await formatWithPreference(baseTotal, "Bs");
        finalTotals[product.id] = await formatWithPreference(finalTotal, "Bs");
      }

      setFormattedProductPrices(prices);
      setFormattedProductTotals(totals);
      setFormattedProductFinalTotals(finalTotals);
    };

    formatPrices();
  }, [
    selectedProducts,
    preferredCurrency,
    exchangeRates,
    productMarkups,
    categories,
    allProducts,
    formatWithPreference,
    productDiscountTypes,
    getProductBaseTotal,
  ]);

  useEffect(() => {
    const formatSubtotal = async () => {
      const formatted = await formatWithPreference(subtotal, "Bs");
      setFormattedSubtotal(formatted);
    };
    formatSubtotal();
  }, [subtotal, preferredCurrency, formatWithPreference, exchangeRates]);

  // Handlers
  const handleProductsSelect = useCallback(
    (products: OrderProduct[]) => {
      setSelectedProducts(
        products.map((product) => ({
          ...product,
          discount: product.discount ?? 0,
          locationStatus: product.locationStatus ?? "DISPONIBILIDAD INMEDIATA",
        }))
      );
      const newTypes: Record<string, "monto" | "porcentaje"> = {};
      const newCurrencies: Record<string, Currency> = {};
      products.forEach((product) => {
        if (!productDiscountTypes[product.id]) {
          const { type, currency } = readDiscountUiFromProduct(
            product,
            getDefaultCurrencyFromSelection()
          );
          newTypes[product.id] = type;
          newCurrencies[product.id] = currency;
        }
        if (!productDiscountCurrencies[product.id] && !newCurrencies[product.id]) {
          newCurrencies[product.id] = readDiscountUiFromProduct(
            product,
            getDefaultCurrencyFromSelection()
          ).currency;
        }
      });
      if (Object.keys(newTypes).length > 0) {
        setProductDiscountTypes((prev) => ({ ...prev, ...newTypes }));
      }
      if (Object.keys(newCurrencies).length > 0) {
        setProductDiscountCurrencies((prev) => ({ ...prev, ...newCurrencies }));
      }
    },
    [
      productDiscountTypes,
      productDiscountCurrencies,
      getDefaultCurrencyFromSelection,
    ]
  );

  const handleProductDiscountChange = useCallback(
    (productId: string, value: number, opts?: { inputCurrency?: Currency }) => {
      setSelectedProducts((products) =>
        products.map((product) => {
          if (product.id !== productId) {
            return product;
          }
          const baseTotal = getProductBaseTotal(product);
          const discountType = productDiscountTypes[productId] || "monto";
          const discountCurrency =
            opts?.inputCurrency ??
            productDiscountCurrencies[productId] ??
            preferredCurrency;

          let discountAmount: number;
          if (discountType === "porcentaje") {
            const percentage = Math.max(0, Math.min(value, 100));
            discountAmount = Math.round(((baseTotal * percentage) / 100) * 100) / 100;
          } else {
            let discountInBs = value;
            if (discountCurrency !== "Bs") {
              const rate =
                discountCurrency === "USD"
                  ? exchangeRates.USD?.rate
                  : exchangeRates.EUR?.rate;
              if (rate && rate > 0) {
                discountInBs = value * rate;
              }
            }
            discountInBs = Math.round(discountInBs * 100) / 100;
            discountAmount = Math.max(0, Math.min(discountInBs, baseTotal));

            const category = categories.find(
              (cat) => cat.name === product.category
            );
            if (category && category.maxDiscount > 0) {
              let maxDiscountInBs = category.maxDiscount;
              if (
                category.maxDiscountCurrency &&
                category.maxDiscountCurrency !== "Bs"
              ) {
                const rate =
                  category.maxDiscountCurrency === "USD"
                    ? exchangeRates.USD?.rate
                    : exchangeRates.EUR?.rate;
                if (rate && rate > 0) {
                  maxDiscountInBs = category.maxDiscount * rate;
                }
              }
              discountAmount = Math.min(discountAmount, maxDiscountInBs);
            }
          }

          const percentForAttrs =
            discountType === "porcentaje"
              ? Math.max(0, Math.min(value, 100))
              : undefined;

          return {
            ...product,
            discount: discountAmount,
            attributes: mergeDiscountUiIntoAttributes(
              product.attributes,
              discountType,
              discountCurrency,
              percentForAttrs
            ),
          };
        })
      );
    },
    [
      getProductBaseTotal,
      productDiscountTypes,
      productDiscountCurrencies,
      preferredCurrency,
      exchangeRates,
      categories,
    ]
  );

  const handleProductDiscountTypeChange = useCallback(
    (productId: string, type: "monto" | "porcentaje") => {
      setProductDiscountTypes((prev) => ({ ...prev, [productId]: type }));
      setSelectedProducts((products) =>
        products.map((p) => {
          if (p.id !== productId) return p;
          const currency =
            productDiscountCurrencies[productId] ?? preferredCurrency;
          return {
            ...p,
            attributes: mergeDiscountUiIntoAttributes(p.attributes, type, currency),
          };
        })
      );
    },
    [productDiscountCurrencies, preferredCurrency]
  );

  const handleGeneralDiscountChange = useCallback(
    (value: number) => {
      let discountAmount: number;

      if (generalDiscountType === "porcentaje") {
        const percentage = Math.max(0, Math.min(value, 100));
        discountAmount = (totalBeforeGeneralDiscount * percentage) / 100;
      } else {
        discountAmount = Math.max(0, Math.min(value, totalBeforeGeneralDiscount));
      }

      setGeneralDiscount(discountAmount);
    },
    [generalDiscountType, totalBeforeGeneralDiscount]
  );

  const handleGeneralDiscountTypeChange = useCallback(
    (type: "monto" | "porcentaje") => {
      setGeneralDiscountType(type);
    },
    []
  );

  const step1SellerReady = !!(formData.vendor || formData.referrer);

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      if (currentStep === 1) {
        if (!step1SellerReady) {
          toast.error("Por favor selecciona un vendedor o un referidor");
          return;
        }
        if (!selectedClient) {
          toast.error("Por favor selecciona un cliente");
          return;
        }
        if (selectedProducts.length === 0) {
          toast.error("Por favor agrega al menos un producto");
          return;
        }
      }
      setCurrentStep(currentStep + 1);
      setTimeout(() => {
        const dialogContent = document.querySelector('[role="dialog"]');
        if (dialogContent) {
          dialogContent.scrollTop = 0;
        }
      }, 0);
    }
  }, [currentStep, step1SellerReady, selectedClient, selectedProducts]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const resetForm = useCallback(() => {
    setCurrentStep(1);
    setSelectedClient(null);
    setSelectedProducts([]);
    setFormData({
      vendor: "",
      referrer: "",
      paymentMethod: "",
      deliveryAddress: "",
      firstPaymentAmount: 0,
      pagomovilReference: "",
      pagomovilBank: "",
      pagomovilPhone: "",
      pagomovilDate: "",
      transferenciaBank: "",
      transferenciaReference: "",
      transferenciaDate: "",
      cashAmount: "",
    });
    setPaymentCondition("");
    setSaleType("");
    setDeliveryType("");
    setDeliveryZone("");
    setHasDelivery(false);
    setDeliveryServices({
      deliveryExpress: { enabled: false, cost: 0, currency: "USD" },
      servicioAcarreo: { enabled: false, cost: undefined, currency: "USD" },
      servicioArmado: { enabled: false, cost: 0, currency: "USD" },
    });
    setPayments([]);
    setGeneralDiscount(0);
    setTaxEnabled(true); // Reiniciar impuesto a habilitado
    setGeneralDiscountType("monto");
    setGeneralDiscountCurrency(preferredCurrency);
    setGeneralObservations("");
    setCreateSupplierOrder(false);
    setProductMarkups({});
    setProductDiscountTypes({});
    setProductDiscountCurrencies({});
  }, [preferredCurrency]);

  // Validaciones
  const canGoToNextStep: boolean =
    currentStep === 1
      ? !!(step1SellerReady && selectedClient && selectedProducts.length > 0)
      : currentStep === 2
        ? selectedProducts.length > 0
        : true;

  const canCreateBudget: boolean =
    currentStep === 1 &&
    !!(step1SellerReady && selectedClient && selectedProducts.length > 0);

  const canAddProduct: boolean = !!(step1SellerReady && selectedClient);

  // Render helpers
  const renderCurrencyCell = useCallback(
    (amountInBs: number, className?: string) => {
      const usdRate = exchangeRates.USD?.rate;
      if (usdRate && usdRate > 0) {
        const amountInUsd = amountInBs / usdRate;
        return (
          <div className={`text-right ${className || ""}`}>
            <div className="font-medium">{formatCurrency(amountInUsd, "USD")}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(amountInBs, "Bs")}
            </div>
          </div>
        );
      }
      return (
        <div className={`text-right ${className || ""}`}>
          <div className="font-medium">{formatCurrency(amountInBs, "Bs")}</div>
        </div>
      );
    },
    [exchangeRates]
  );

  const renderCurrencyCellNegative = useCallback(
    (amountInBs: number, className?: string) => {
      const usdRate = exchangeRates.USD?.rate;
      if (usdRate && usdRate > 0) {
        const amountInUsd = amountInBs / usdRate;
        return (
          <div className={`text-right ${className || ""}`}>
            <div className="font-medium">-{formatCurrency(amountInUsd, "USD")}</div>
            <div className="text-xs text-muted-foreground">
              -{formatCurrency(amountInBs, "Bs")}
            </div>
          </div>
        );
      }
      return (
        <div className={`text-right ${className || ""}`}>
          <div className="font-medium">-{formatCurrency(amountInBs, "Bs")}</div>
        </div>
      );
    },
    [exchangeRates]
  );

  // Cargar dirección del cliente cuando se activa delivery
  useEffect(() => {
    if (hasDelivery && selectedClient?.address && !formData.deliveryAddress) {
      setFormData((prev) => ({
        ...prev,
        deliveryAddress: selectedClient.address || "",
      }));
    }
  }, [hasDelivery, selectedClient, formData.deliveryAddress]);

  // Limitar descuento general
  useEffect(() => {
    setGeneralDiscount((prev) =>
      Math.min(Math.max(prev, 0), totalBeforeGeneralDiscount)
    );
  }, [totalBeforeGeneralDiscount]);

  return {
    currentStep,
    setCurrentStep,
    selectedClient,
    setSelectedClient,
    selectedProducts,
    setSelectedProducts,
    formData,
    setFormData,
    paymentCondition,
    setPaymentCondition,
    saleType,
    setSaleType,
    deliveryType,
    setDeliveryType,
    deliveryZone,
    setDeliveryZone,
    hasDelivery,
    setHasDelivery,
    deliveryServices,
    setDeliveryServices,
    payments,
    setPayments,
    generalDiscount,
    setGeneralDiscount,
    generalDiscountType,
    setGeneralDiscountType,
    generalDiscountCurrency,
    setGeneralDiscountCurrency,
    taxEnabled,
    setTaxEnabled,
    generalObservations,
    setGeneralObservations,
    createSupplierOrder,
    setCreateSupplierOrder,
    productMarkups,
    setProductMarkups,
    productDiscountTypes,
    setProductDiscountTypes,
    productDiscountCurrencies,
    setProductDiscountCurrencies,
    deliveryCurrency,
    setDeliveryCurrency,
    selectedCurrencies,
    setSelectedCurrencies,
    vendors,
    referrers,
    categories,
    allProducts,
    accounts,
    exchangeRates,
    productSubtotal,
    productDiscountTotal,
    subtotalAfterProductDiscounts,
    subtotal,
    taxAmount,
    deliveryCost,
    totalBeforeGeneralDiscount,
    generalDiscountAmount,
    total,
    totalPaidInBs,
    remainingAmount,
    isPaymentsValid,
    formattedProductPrices,
    formattedProductTotals,
    formattedProductFinalTotals,
    formattedSubtotal,
    canGoToNextStep,
    canCreateBudget,
    canAddProduct,
    step1SellerReady,
    handleNext,
    handleBack,
    resetForm,
    getProductBaseTotal,
    convertCurrencyValue,
    getDefaultCurrencyFromSelection,
    getCurrencyOrder,
    handleProductsSelect,
    handleProductDiscountChange,
    handleProductDiscountTypeChange,
    handleGeneralDiscountChange,
    handleGeneralDiscountTypeChange,
    calculateDeliveryCost,
    renderCurrencyCell,
    renderCurrencyCellNegative,
    mockVendors: vendors,
    mockReferrers: referrers,
    needsDraftPrompt: false,
    applyDraftAndContinue: () => {},
    discardDraftAndStartFresh: () => {},
    clearDraftStorage: () => {},
    onlineSellerMode: null,
    setOnlineSellerMode: () => {},
    isOnlineSellerReferrer: false,
  };
}

