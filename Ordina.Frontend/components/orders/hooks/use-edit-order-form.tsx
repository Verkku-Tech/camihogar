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
  normalizeExchangeRatesAtCreation,
  type ExchangeRate,
  type Currency,
} from "@/lib/currency-utils";
import {
  CASHEA_FINANCED_METHOD_LABEL,
  getActivePaymentsList,
  filterCasheaStubForEditForm,
  getOrderPendingTotal,
  PAYMENT_BALANCE_EPSILON_BS,
  PAYMENT_BALANCE_EPSILON_USD,
  sumPaymentsCollectedInBs,
  sumPaymentsToUsd,
} from "@/lib/order-payments";
import {
  buildExchangeRatesAtCreationPayload,
  commercialRatesToExchangeRatesInput,
  formatCommercialDualDisplay,
  formatDualCurrencyAmounts,
  formatOrderPaymentTotalsDisplay,
  getCommercialRatesFromOrder,
  getCommercialTotalUsd,
  getFrozenCommercialTotalsFromOrder,
  shouldFreezeCommercialTotals,
} from "@/lib/order-currency-display";
import { getBsPerUsdFromOrder } from "@/lib/order-store-credit-usd";
import {
  getLineDiscountInBaseCurrency,
  getProductDiscountCurrencyForTotals,
  computeProductDiscountStoredAmount,
  normalizeProductLineDiscountFromLegacy,
  getLinePriceCurrency,
  getOrderBaseCurrency,
  getProductLineBaseWithoutSurchargeInBaseCurrency,
  getProductLineSurchargeInBaseCurrency,
  getProductLineSubtotalDisplayInBaseCurrency,
  getProductLineTotalAfterDiscountInBaseCurrency,
  isUsdBaseOrder,
  sumDeliveryServicesToBaseCurrency,
  normalizeDeliveryServicesFromLegacy,
  getGeneralDiscountInBaseCurrency,
  normalizeMonetaryAmountFromLegacy,
  convertAmountBetweenOrKeep,
} from "@/lib/order-line-pricing";
import { apiClient } from "@/lib/api-client";
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
    condition: UseOrderFormReturn["paymentCondition"],
  ) => void;

  saleType:
    | "delivery_express"
    | "encargo"
    | "encargo_entrega"
    | "entrega"
    | "retiro_almacen"
    | "retiro_tienda"
    | "sistema_apartado"
    | "";
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

  dispatchObservations: string;
  setDispatchObservations: (obs: string) => void;

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
  /** Tasas del día del pedido (solo lectura / persistencia). */
  commercialExchangeRates: { USD?: ExchangeRate; EUR?: ExchangeRate };
  /** Moneda base persistida del pedido (legacy: Bs). */
  formBaseCurrency: Currency;
  /** Líneas sin cambios: totales congelados al pedido guardado. */
  commercialTotalsFrozen: boolean;

  // Control de impuesto
  taxEnabled: boolean;
  setTaxEnabled: (enabled: boolean) => void;

  // Valores calculados
  productSubtotalBase: number;
  productSurchargeTotal: number;
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
  /** Total cobrado en tienda expresado en USD (para resumen de pagos). */
  totalPaidUsd: number;
  remainingAmount: number;
  /** Saldo pendiente en USD (display resumen de pagos en pedidos legacy). */
  remainingAmountUsd: number;
  isPaymentsValid: boolean;

  appliedStoreCreditUsd: number;
  setAppliedStoreCreditUsd: React.Dispatch<React.SetStateAction<number>>;
  clientStoreCreditBalanceUsd: number | null;
  refreshClientStoreCreditBalance: () => Promise<void>;
  appliedCreditBsApprox: number;
  maxApplicableStoreCreditUsd: number;

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
  getProductLineBase: (product: OrderProduct) => number;
  getProductLineSurcharge: (product: OrderProduct) => number;
  getProductLineSubtotalDisplay: (product: OrderProduct) => number;
  getProductBaseTotal: (product: OrderProduct) => number;
  convertCurrencyValue: (
    value: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ) => number | null;
  getDefaultCurrencyFromSelection: () => Currency;
  getCurrencyOrder: () => Currency[];
  handleProductsSelect: (products: OrderProduct[]) => void;
  handleProductDiscountChange: (
    productId: string,
    value: number,
    opts?: { inputCurrency?: Currency },
  ) => void;
  handleProductDiscountTypeChange: (
    productId: string,
    type: "monto" | "porcentaje",
  ) => void;
  handleGeneralDiscountChange: (value: number) => void;
  handleGeneralDiscountTypeChange: (type: "monto" | "porcentaje") => void;
  calculateDeliveryCost: () => number;
  renderCurrencyCell: (
    amountInBs: number,
    className?: string,
  ) => React.ReactElement;
  renderCurrencyCellNegative: (
    amountInBs: number,
    className?: string,
  ) => React.ReactElement;
  renderServiceLineCell: (
    amount: number,
    currency: Currency,
    className?: string,
  ) => React.ReactElement;
  /** Resumen de pagos: primario USD + Bs informativo (tasa viva). */
  renderPaymentTotalCell: (
    amountUsd: number,
    className?: string,
    showCollectedBs?: boolean,
  ) => React.ReactElement;

  // Mock data (compatibilidad)
  mockVendors: Vendor[];
  mockReferrers: Vendor[];

  needsDraftPrompt: boolean;
  isDraftGateBlocking: boolean;
  applyDraftAndContinue: () => void;
  discardDraftAndStartFresh: () => void;
  clearDraftStorage: () => void;
  onlineSellerMode: "vendor" | "referrer" | null;
  setOnlineSellerMode: React.Dispatch<
    React.SetStateAction<"vendor" | "referrer" | null>
  >;
  isOnlineSellerReferrer: boolean;
}

export function useEditOrderForm(
  open: boolean,
  initialOrder: Order | null = null,
): UseOrderFormReturn {
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
    | "delivery_express"
    | "encargo"
    | "encargo_entrega"
    | "entrega"
    | "retiro_almacen"
    | "retiro_tienda"
    | "sistema_apartado"
    | ""
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
  const [appliedStoreCreditUsd, setAppliedStoreCreditUsd] = useState(0);
  const [clientStoreCreditBalanceUsd, setClientStoreCreditBalanceUsd] =
    useState<number | null>(null);
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [generalDiscountType, setGeneralDiscountType] = useState<
    "monto" | "porcentaje"
  >("monto");
  const [taxEnabled, setTaxEnabled] = useState<boolean>(true); // Impuesto habilitado por defecto
  const [generalDiscountCurrency, setGeneralDiscountCurrency] =
    useState<Currency>(preferredCurrency);
  const [generalObservations, setGeneralObservations] = useState("");
  const [dispatchObservations, setDispatchObservations] = useState("");
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false);
  const [productMarkups, setProductMarkups] = useState<Record<string, number>>(
    {},
  );
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
    },
  );

  // Datos cargados
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referrers, setReferrers] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [liveExchangeRates, setLiveExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  const [commercialExchangeRates, setCommercialExchangeRates] = useState<{
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
        setLiveExchangeRates(rates);

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
      const ratesForProductNormalize = commercialRatesToExchangeRatesInput(
        getCommercialRatesFromOrder(initialOrder),
      );
      const productsHydrated = (initialOrder.products || []).map((p) => {
        const discountNum = Number(p.discount);
        const hasDiscount = Number.isFinite(discountNum) && discountNum > 0;
        const hasStoredDiscountUi =
          p.attributes != null &&
          (Object.prototype.hasOwnProperty.call(
            p.attributes,
            "discountUiType",
          ) ||
            Object.prototype.hasOwnProperty.call(
              p.attributes,
              "discountUiPercent",
            ));
        const ui = readDiscountUiFromProduct(p, pref);
        let line: OrderProduct = p;
        if (!hasStoredDiscountUi && hasDiscount) {
          line = {
            ...p,
            attributes: mergeDiscountUiIntoAttributes(
              p.attributes,
              "monto",
              pref,
            ),
          };
        }
        const discType = hasStoredDiscountUi ? ui.type : "monto";
        const discCurr = hasStoredDiscountUi ? ui.currency : pref;
        return normalizeProductLineDiscountFromLegacy(
          line,
          discCurr,
          discType,
          ratesForProductNormalize,
        );
      });
      setSelectedProducts(productsHydrated);

      // 3. FormData básico
      setFormData({
        vendor: initialOrder.vendorId || "",
        referrer: initialOrder.referrerId || "",
        paymentMethod: initialOrder.paymentMethod || "",
        deliveryAddress: initialOrder.deliveryAddress || "",
        firstPaymentAmount: 0,
        pagomovilReference:
          initialOrder.paymentDetails?.pagomovilReference || "",
        pagomovilBank: initialOrder.paymentDetails?.pagomovilBank || "",
        pagomovilPhone: initialOrder.paymentDetails?.pagomovilPhone || "",
        pagomovilDate: initialOrder.paymentDetails?.pagomovilDate || "",
        transferenciaBank: initialOrder.paymentDetails?.transferenciaBank || "",
        transferenciaReference:
          initialOrder.paymentDetails?.transferenciaReference || "",
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
        const ratesForNormalize = commercialRatesToExchangeRatesInput(
          getCommercialRatesFromOrder(initialOrder),
        );
        setDeliveryServices(
          normalizeDeliveryServicesFromLegacy(
            {
              deliveryExpress: initialOrder.deliveryServices.deliveryExpress || {
                enabled: false,
                cost: 0,
                currency: "USD",
              },
              servicioAcarreo: initialOrder.deliveryServices.servicioAcarreo || {
                enabled: false,
                cost: undefined,
                currency: "USD",
              },
              servicioArmado: initialOrder.deliveryServices.servicioArmado || {
                enabled: false,
                cost: 0,
                currency: "USD",
              },
            },
            ratesForNormalize,
          ),
        );
      }

      // 6. Abonos (misma regla que detalle: partial si tiene ítems, si no mixed)
      setPayments(
        filterCasheaStubForEditForm(
          initialOrder,
          getActivePaymentsList(initialOrder),
        ),
      );
      setAppliedStoreCreditUsd(initialOrder.appliedStoreCreditUsd ?? 0);

      // 7. Descuentos y observaciones
      if (
        initialOrder.generalDiscountAmount &&
        initialOrder.generalDiscountAmount > 0
      ) {
        const pct = initialOrder.generalDiscountPercent;
        const pctValid =
          initialOrder.generalDiscountType === "porcentaje" &&
          pct != null &&
          Number.isFinite(pct) &&
          pct > 0 &&
          pct <= 100;
        if (pctValid) {
          setGeneralDiscountType("porcentaje");
          setGeneralDiscount(pct);
        } else {
          const base = getOrderBaseCurrency(initialOrder);
          setGeneralDiscountCurrency(base);
          setGeneralDiscount(
            normalizeMonetaryAmountFromLegacy(
              initialOrder.generalDiscountAmount,
              base,
              commercialRatesToExchangeRatesInput(
                getCommercialRatesFromOrder(initialOrder),
              ),
            ),
          );
          setGeneralDiscountType("monto");
        }
      }
      setGeneralObservations(initialOrder.observations || "");
      setDispatchObservations(initialOrder.dispatchObservations || "");
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
        const { type: attrType, currency: attrCurrency } =
          readDiscountUiFromProduct(p, pref);
        const discountNum = Number(p.discount);
        const hasDiscount = Number.isFinite(discountNum) && discountNum > 0;
        const hasStoredDiscountUi =
          p.attributes != null &&
          (Object.prototype.hasOwnProperty.call(
            p.attributes,
            "discountUiType",
          ) ||
            Object.prototype.hasOwnProperty.call(
              p.attributes,
              "discountUiPercent",
            ));
        let finalType = attrType;
        let finalCurrency = attrCurrency;
        if (!hasStoredDiscountUi && hasDiscount) {
          finalType = "monto";
          finalCurrency = pref;
        }
        if (
          p.attributes != null &&
          !Object.prototype.hasOwnProperty.call(
            p.attributes,
            "discountUiType",
          ) &&
          Object.prototype.hasOwnProperty.call(
            p.attributes,
            "discountUiPercent",
          ) &&
          hasDiscount
        ) {
          finalType = "porcentaje";
        }
        newTypes[p.id] = finalType;
        newCurrencies[p.id] = finalCurrency;
      });
      setProductDiscountTypes(newTypes);
      setProductDiscountCurrencies(newCurrencies);

      setCommercialExchangeRates(getCommercialRatesFromOrder(initialOrder));
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
    if (selectedCurrencies.includes("USD") || liveExchangeRates.USD?.rate) {
      return "USD";
    }
    // Luego EUR si está disponible en selectedCurrencies O si hay tasa de cambio
    if (selectedCurrencies.includes("EUR") || liveExchangeRates.EUR?.rate) {
      return "EUR";
    }
    // Si preferredCurrency no es Bs y está disponible, usarla
    if (
      selectedCurrencies.includes(preferredCurrency) &&
      preferredCurrency !== "Bs"
    ) {
      return preferredCurrency;
    }
    // Buscar cualquier moneda no-Bs disponible
    const nonBsCurrency = selectedCurrencies.find((c) => c !== "Bs");
    if (nonBsCurrency) {
      return nonBsCurrency;
    }
    // Fallback: devolver preferredCurrency o USD si no hay nada
    return preferredCurrency !== "Bs" ? preferredCurrency : "USD";
  }, [selectedCurrencies, preferredCurrency, liveExchangeRates]);

  const convertCurrencyValue = useCallback(
    (
      value: number,
      fromCurrency: Currency,
      toCurrency: Currency,
    ): number | null => {
      if (fromCurrency === toCurrency) return value;
      if (fromCurrency === "Bs") {
        const rate =
          toCurrency === "USD"
            ? liveExchangeRates.USD?.rate
            : liveExchangeRates.EUR?.rate;
        return rate && rate > 0 ? value / rate : null;
      }
      if (toCurrency === "Bs") {
        const rate =
          fromCurrency === "USD"
            ? liveExchangeRates.USD?.rate
            : liveExchangeRates.EUR?.rate;
        return rate && rate > 0 ? value * rate : null;
      }
      // Entre USD y EUR
      const fromRate =
        fromCurrency === "USD"
          ? liveExchangeRates.USD?.rate
          : liveExchangeRates.EUR?.rate;
      const toRate =
        toCurrency === "USD"
          ? liveExchangeRates.USD?.rate
          : liveExchangeRates.EUR?.rate;
      if (fromRate && toRate && fromRate > 0 && toRate > 0) {
        return (value * fromRate) / toRate;
      }
      return null;
    },
    [liveExchangeRates],
  );

  const formBaseCurrency = useMemo(
    () => getOrderBaseCurrency(initialOrder ?? undefined),
    [initialOrder],
  );
  const formUsesUsdTotals = isUsdBaseOrder(initialOrder ?? undefined);

  const commercialRatesInput = useMemo(
    () => commercialRatesToExchangeRatesInput(commercialExchangeRates),
    [commercialExchangeRates],
  );
  const liveRatesInput = useMemo(
    () => commercialRatesToExchangeRatesInput(liveExchangeRates),
    [liveExchangeRates],
  );

  const commercialTotalsFrozen = useMemo(
    () => shouldFreezeCommercialTotals(initialOrder, selectedProducts),
    [initialOrder, selectedProducts],
  );

  const frozenCommercialTotals = useMemo(
    () =>
      initialOrder && commercialTotalsFrozen
        ? getFrozenCommercialTotalsFromOrder(initialOrder)
        : null,
    [initialOrder, commercialTotalsFrozen],
  );

  const calculateDeliveryCost = useCallback((): number => {
    return sumDeliveryServicesToBaseCurrency(
      deliveryServices,
      formBaseCurrency,
      commercialRatesInput,
    );
  }, [deliveryServices, formBaseCurrency, commercialRatesInput]);

  /** Evita duplicar envío si coexisten servicios y `order.deliveryCost` por datos inconsistentes. */
  const DELIVERY_TOTAL_EPSILON = 1e-6;
  const deliveryCost = useMemo(() => {
    const fromServices = calculateDeliveryCost();
    if (fromServices > DELIVERY_TOTAL_EPSILON) return fromServices;
    return initialOrder?.deliveryCost ?? 0;
  }, [calculateDeliveryCost, initialOrder?.deliveryCost]);

  const getLinePricingOptions = useCallback(
    (product: OrderProduct) => ({
      baseCurrency: formBaseCurrency,
      exchangeRates: commercialRatesInput,
      categories,
      allProducts,
      markup: productMarkups[product.id] || 0,
    }),
    [productMarkups, categories, allProducts, commercialRatesInput, formBaseCurrency],
  );

  const getProductLineBase = useCallback(
    (product: OrderProduct): number =>
      getProductLineBaseWithoutSurchargeInBaseCurrency(
        product,
        getLinePricingOptions(product),
      ),
    [getLinePricingOptions],
  );

  const getProductLineSurcharge = useCallback(
    (product: OrderProduct): number =>
      getProductLineSurchargeInBaseCurrency(
        product,
        getLinePricingOptions(product),
      ),
    [getLinePricingOptions],
  );

  const getProductLineSubtotalDisplay = useCallback(
    (product: OrderProduct): number =>
      getProductLineSubtotalDisplayInBaseCurrency(
        product,
        getLinePricingOptions(product),
      ),
    [getLinePricingOptions],
  );

  const getLineDiscountInBaseForProduct = useCallback(
    (product: OrderProduct): number => {
      const disc = product.discount || 0;
      if (disc <= 0) return 0;
      const discCurrency = getProductDiscountCurrencyForTotals(product, {
        productDiscountTypes,
        productDiscountCurrencies,
        preferredCurrency,
      });
      return getLineDiscountInBaseCurrency(
        product,
        disc,
        discCurrency,
        formBaseCurrency,
        commercialRatesInput,
      );
    },
    [
      productDiscountTypes,
      productDiscountCurrencies,
      preferredCurrency,
      formBaseCurrency,
      commercialRatesInput,
    ],
  );

  const getProductBaseTotal = useCallback(
    (product: OrderProduct): number =>
      getProductLineTotalAfterDiscountInBaseCurrency(
        product,
        getLineDiscountInBaseForProduct(product),
        getLinePricingOptions(product),
      ),
    [getLinePricingOptions, getLineDiscountInBaseForProduct],
  );

  // Valores calculados
  const productSubtotalBaseComputed = useMemo(() => {
    return selectedProducts.reduce(
      (sum, product) => sum + getProductLineBase(product),
      0,
    );
  }, [selectedProducts, getProductLineBase]);

  const productSurchargeTotalComputed = useMemo(() => {
    return selectedProducts.reduce(
      (sum, product) => sum + getProductLineSurcharge(product),
      0,
    );
  }, [selectedProducts, getProductLineSurcharge]);

  const productSubtotalBase =
    frozenCommercialTotals?.productSubtotal ?? productSubtotalBaseComputed;

  const productSurchargeTotal =
    frozenCommercialTotals?.productSurchargeTotal ??
    productSurchargeTotalComputed;

  const productSubtotal = productSubtotalBase;

  const productDiscountTotalComputed = useMemo(() => {
    return selectedProducts.reduce((sum, product) => {
      const disc = product.discount || 0;
      if (disc <= 0) return sum;
      const discCurrency = getProductDiscountCurrencyForTotals(product, {
        productDiscountTypes,
        productDiscountCurrencies,
        preferredCurrency,
      });
      return (
        sum +
        getLineDiscountInBaseCurrency(
          product,
          disc,
          discCurrency,
          formBaseCurrency,
          commercialRatesInput,
        )
      );
    }, 0);
  }, [
    selectedProducts,
    productDiscountTypes,
    productDiscountCurrencies,
    preferredCurrency,
    commercialRatesInput,
    formBaseCurrency,
  ]);

  const productDiscountTotal =
    frozenCommercialTotals?.productDiscountTotal ?? productDiscountTotalComputed;

  const subtotalAfterProductDiscounts = Math.max(
    productSubtotalBase - productDiscountTotal,
    0,
  );

  const subtotalComputed = subtotalAfterProductDiscounts;
  const subtotal = frozenCommercialTotals?.subtotal ?? subtotalComputed;

  const taxAmountComputed = taxEnabled ? subtotal * 0.16 : 0;
  const taxAmount = frozenCommercialTotals?.taxAmount ?? taxAmountComputed;

  const totalBeforeGeneralDiscount = frozenCommercialTotals
    ? subtotal + taxAmount + deliveryCost
    : subtotal + taxAmount + productSurchargeTotal + deliveryCost;
  const generalDiscountAmount = useMemo(() => {
    if (frozenCommercialTotals) {
      return initialOrder?.generalDiscountAmount ?? 0;
    }
    if (generalDiscountType === "porcentaje") {
      const p = Math.min(Math.max(generalDiscount, 0), 100);
      return (totalBeforeGeneralDiscount * p) / 100;
    }
    const inBase = getGeneralDiscountInBaseCurrency(
      generalDiscount,
      generalDiscountCurrency,
      formBaseCurrency,
      commercialRatesInput,
    );
    return Math.min(Math.max(inBase, 0), totalBeforeGeneralDiscount);
  }, [
    frozenCommercialTotals,
    initialOrder?.generalDiscountAmount,
    generalDiscountType,
    generalDiscount,
    generalDiscountCurrency,
    formBaseCurrency,
    commercialRatesInput,
    totalBeforeGeneralDiscount,
  ]);
  const totalComputed = Math.max(
    totalBeforeGeneralDiscount - generalDiscountAmount,
    0,
  );
  const total = frozenCommercialTotals?.total ?? totalComputed;

  const orderSnapshotForCreditRates = useMemo(() => {
    if (initialOrder && open) {
      const n = normalizeExchangeRatesAtCreation(
        initialOrder.exchangeRatesAtCreation,
      );
      if (n?.USD?.rate && n.USD.rate > 0) {
        return {
          exchangeRatesAtCreation: {
            USD: n.USD,
            EUR: n.EUR,
          },
        };
      }
    }
    return {
      exchangeRatesAtCreation: buildExchangeRatesAtCreationPayload(
        commercialExchangeRates,
      ),
    };
  }, [initialOrder, commercialExchangeRates, open]);

  const bsPerUsdForStoreCredit = useMemo(() => {
    try {
      return getBsPerUsdFromOrder(orderSnapshotForCreditRates);
    } catch {
      return 0;
    }
  }, [orderSnapshotForCreditRates]);

  const appliedCreditBsApprox = useMemo(() => {
    if (bsPerUsdForStoreCredit <= 0 || appliedStoreCreditUsd <= 0) return 0;
    return appliedStoreCreditUsd * bsPerUsdForStoreCredit;
  }, [appliedStoreCreditUsd, bsPerUsdForStoreCredit]);

  const maxApplicableStoreCreditUsd = useMemo(() => {
    const bal = clientStoreCreditBalanceUsd ?? 0;
    if (formUsesUsdTotals) {
      const cap = Math.min(bal, total);
      return Math.round(Math.max(0, cap) * 100) / 100;
    }
    if (bsPerUsdForStoreCredit <= 0) return 0;
    const orderTotalUsd = total / bsPerUsdForStoreCredit;
    const cap = Math.min(bal, orderTotalUsd);
    return Math.round(Math.max(0, cap) * 100) / 100;
  }, [
    total,
    bsPerUsdForStoreCredit,
    clientStoreCreditBalanceUsd,
    formUsesUsdTotals,
  ]);

  useEffect(() => {
    if (!open || !selectedClient?.id) {
      setClientStoreCreditBalanceUsd(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.getClientStoreCreditBalanceUsd(
          selectedClient.id,
        );
        if (!cancelled) setClientStoreCreditBalanceUsd(res.balanceUsd);
      } catch {
        if (!cancelled) setClientStoreCreditBalanceUsd(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedClient?.id]);

  useEffect(() => {
    if (appliedStoreCreditUsd <= 0) return;
    if (appliedStoreCreditUsd > maxApplicableStoreCreditUsd + 1e-9) {
      setAppliedStoreCreditUsd(maxApplicableStoreCreditUsd);
    }
  }, [maxApplicableStoreCreditUsd, appliedStoreCreditUsd]);

  const refreshClientStoreCreditBalance = useCallback(async () => {
    const id = selectedClient?.id;
    if (!id) return;
    try {
      const res = await apiClient.getClientStoreCreditBalanceUsd(id);
      setClientStoreCreditBalanceUsd(res.balanceUsd);
    } catch {
      setClientStoreCreditBalanceUsd(0);
    }
  }, [selectedClient?.id]);

  const orderPaymentContext = useMemo(
    () => ({
      baseCurrency: formBaseCurrency,
      exchangeRatesAtCreation: orderSnapshotForCreditRates.exchangeRatesAtCreation,
      liveRates: liveRatesInput,
    }),
    [formBaseCurrency, orderSnapshotForCreditRates, liveRatesInput],
  );

  const inStorePaymentsForDisplay = useMemo(
    () =>
      payments.filter(
        (p) =>
          !p.paymentDetails?.casheaFinancedPortion &&
          p.method !== CASHEA_FINANCED_METHOD_LABEL,
      ),
    [payments],
  );

  const totalPaidInUsd = useMemo(
    () => sumPaymentsToUsd(payments, orderPaymentContext),
    [payments, orderPaymentContext],
  );

  const totalPaidInBs = useMemo(
    () => sumPaymentsCollectedInBs(inStorePaymentsForDisplay),
    [inStorePaymentsForDisplay],
  );

  const casheaInStorePayments = inStorePaymentsForDisplay;
  const casheaPaidSumUsd = useMemo(
    () => sumPaymentsToUsd(casheaInStorePayments, orderPaymentContext),
    [casheaInStorePayments, orderPaymentContext],
  );
  const casheaPaidSumBs = casheaInStorePayments.reduce(
    (s, p) => s + (p.amount || 0),
    0,
  );
  const casheaCapUsd =
    total - appliedStoreCreditUsd + PAYMENT_BALANCE_EPSILON_USD;
  const casheaCapBs =
    total - appliedCreditBsApprox + PAYMENT_BALANCE_EPSILON_BS;
  const remainingAmount = useMemo(
    () =>
      getOrderPendingTotal({
        total,
        baseCurrency: formBaseCurrency,
        exchangeRatesAtCreation: buildExchangeRatesAtCreationPayload(
          commercialExchangeRates,
        ),
        appliedStoreCreditUsd,
        partialPayments: payments,
      }),
    [
      total,
      formBaseCurrency,
      commercialExchangeRates,
      appliedStoreCreditUsd,
      payments,
    ],
  );

  const totalUsd = useMemo(
    () =>
      getCommercialTotalUsd({
        total,
        baseCurrency: formBaseCurrency,
        exchangeRatesAtCreation: buildExchangeRatesAtCreationPayload(
          commercialExchangeRates,
        ),
      }),
    [total, formBaseCurrency, commercialExchangeRates],
  );

  const remainingAmountUsd = useMemo(
    () => totalUsd - appliedStoreCreditUsd - totalPaidInUsd,
    [totalUsd, appliedStoreCreditUsd, totalPaidInUsd],
  );
  const isPaymentsValid =
    paymentCondition === "pago_a_entrega" ||
    paymentCondition === "pagara_en_tienda"
      ? true
      : paymentCondition === "cashea"
        ? formUsesUsdTotals
          ? casheaInStorePayments.length >= 1 &&
            casheaPaidSumUsd > 0 &&
            casheaPaidSumUsd <= casheaCapUsd
          : casheaInStorePayments.length >= 1 &&
            casheaPaidSumBs > 0 &&
            casheaPaidSumBs <= casheaCapBs
        : formUsesUsdTotals
          ? Math.abs(remainingAmount) < PAYMENT_BALANCE_EPSILON_USD
          : Math.abs(remainingAmount) < PAYMENT_BALANCE_EPSILON_BS;

  // Formatear precios (paso 1): USD comercial + Bs informativo, también en pedidos legacy Bs
  useEffect(() => {
    if (selectedProducts.length === 0) {
      setFormattedProductPrices({});
      setFormattedProductTotals({});
      setFormattedProductFinalTotals({});
      return;
    }

    const prices: Record<string, string> = {};
    const totals: Record<string, string> = {};
    const finalTotals: Record<string, string> = {};
    const dualOpts = {
      commercialRates: commercialRatesInput,
      liveRates: liveRatesInput,
    };

    for (const product of selectedProducts) {
      const lineSubtotal = getProductLineSubtotalDisplay(product);
      const finalTotal = getProductBaseTotal(product);

      prices[product.id] = formatCommercialDualDisplay(
        product.price,
        getLinePriceCurrency(product),
        dualOpts,
      );
      totals[product.id] = formatCommercialDualDisplay(
        lineSubtotal,
        formBaseCurrency,
        dualOpts,
      );
      finalTotals[product.id] = formatCommercialDualDisplay(
        finalTotal,
        formBaseCurrency,
        dualOpts,
      );
    }

    setFormattedProductPrices(prices);
    setFormattedProductTotals(totals);
    setFormattedProductFinalTotals(finalTotals);
  }, [
    selectedProducts,
    preferredCurrency,
    commercialRatesInput,
    liveRatesInput,
    productDiscountCurrencies,
    formBaseCurrency,
    productMarkups,
    categories,
    allProducts,
    productDiscountTypes,
    getProductBaseTotal,
    getProductLineSubtotalDisplay,
  ]);

  useEffect(() => {
    setFormattedSubtotal(
      formatCommercialDualDisplay(subtotal, formBaseCurrency, {
        commercialRates: commercialRatesInput,
        liveRates: liveRatesInput,
      }),
    );
  }, [subtotal, formBaseCurrency, commercialRatesInput, liveRatesInput]);

  // Handlers
  const handleProductsSelect = useCallback(
    (products: OrderProduct[]) => {
      setSelectedProducts(
        products.map((product) => ({
          ...product,
          discount: product.discount ?? 0,
          locationStatus: product.locationStatus ?? "DISPONIBILIDAD INMEDIATA",
        })),
      );
      const newTypes: Record<string, "monto" | "porcentaje"> = {};
      const newCurrencies: Record<string, Currency> = {};
      products.forEach((product) => {
        if (!productDiscountTypes[product.id]) {
          const { type, currency } = readDiscountUiFromProduct(
            product,
            getDefaultCurrencyFromSelection(),
          );
          newTypes[product.id] = type;
          newCurrencies[product.id] = currency;
        }
        if (
          !productDiscountCurrencies[product.id] &&
          !newCurrencies[product.id]
        ) {
          newCurrencies[product.id] = readDiscountUiFromProduct(
            product,
            getDefaultCurrencyFromSelection(),
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
    ],
  );

  const handleProductDiscountChange = useCallback(
    (productId: string, value: number, opts?: { inputCurrency?: Currency }) => {
      setSelectedProducts((products) =>
        products.map((product) => {
          if (product.id !== productId) {
            return product;
          }
          const baseTotal = getProductLineBase(product);
          const discountType = productDiscountTypes[productId] || "monto";
          const discountCurrency =
            opts?.inputCurrency ??
            productDiscountCurrencies[productId] ??
            preferredCurrency;

          const category = categories.find(
            (cat) => cat.name === product.category,
          );
          const discountAmount = computeProductDiscountStoredAmount({
            inputValue: value,
            discountType,
            discountCurrency,
            baseTotalInBase: baseTotal,
            rates: liveExchangeRates,
            maxDiscount: category?.maxDiscount,
            maxDiscountCurrency: category?.maxDiscountCurrency,
            baseCurrency: formBaseCurrency,
          });

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
              percentForAttrs,
            ),
          };
        }),
      );
    },
    [
      getProductLineBase,
      productDiscountTypes,
      productDiscountCurrencies,
      preferredCurrency,
      liveExchangeRates,
      categories,
      formBaseCurrency,
    ],
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
            attributes: mergeDiscountUiIntoAttributes(
              p.attributes,
              type,
              currency,
            ),
          };
        }),
      );
    },
    [productDiscountCurrencies, preferredCurrency],
  );

  const handleGeneralDiscountChange = useCallback(
    (value: number) => {
      if (generalDiscountType === "porcentaje") {
        setGeneralDiscount(Math.max(0, Math.min(value, 100)));
        return;
      }
      setGeneralDiscount(
        Math.max(0, Math.min(value, totalBeforeGeneralDiscount)),
      );
    },
    [generalDiscountType, totalBeforeGeneralDiscount],
  );

  const handleGeneralDiscountTypeChange = useCallback(
    (type: "monto" | "porcentaje") => {
      setGeneralDiscountType(type);
      setGeneralDiscount(0);
    },
    [],
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
    setDispatchObservations("");
    setCreateSupplierOrder(false);
    setProductMarkups({});
    setProductDiscountTypes({});
    setProductDiscountCurrencies({});
    setAppliedStoreCreditUsd(0);
    setClientStoreCreditBalanceUsd(null);
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

  // Render helpers (USD comercial con tasa del pedido; Bs informativo con tasa viva)
  const renderCurrencyCell = useCallback(
    (amount: number, className?: string) => {
      const formatted = formatDualCurrencyAmounts(amount, formBaseCurrency, {
        commercialRates: commercialRatesInput,
        liveRates: liveRatesInput,
      });
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
    },
    [formBaseCurrency, commercialRatesInput, liveRatesInput],
  );

  const renderCurrencyCellNegative = useCallback(
    (amount: number, className?: string) => {
      const formatted = formatDualCurrencyAmounts(amount, formBaseCurrency, {
        commercialRates: commercialRatesInput,
        liveRates: liveRatesInput,
      });
      return (
        <div className={`text-right ${className || ""}`}>
          <div className="font-medium">-{formatted.primary}</div>
          {formatted.secondary && (
            <div className="text-xs text-muted-foreground">
              -{formatted.secondary}
            </div>
          )}
        </div>
      );
    },
    [formBaseCurrency, commercialRatesInput, liveRatesInput],
  );

  const renderServiceLineCell = useCallback(
    (amount: number, currency: Currency, className?: string) => {
      const inBase = convertAmountBetweenOrKeep(
        amount,
        currency,
        formBaseCurrency,
        commercialRatesInput,
      );
      return renderCurrencyCell(inBase, className);
    },
    [formBaseCurrency, commercialRatesInput, renderCurrencyCell],
  );

  const renderPaymentTotalCell = useCallback(
    (amountUsd: number, className?: string, showCollectedBs?: boolean) => {
      const formatted = showCollectedBs
        ? formatOrderPaymentTotalsDisplay(
            amountUsd,
            inStorePaymentsForDisplay,
          )
        : formatDualCurrencyAmounts(amountUsd, "USD", {
            commercialRates: commercialRatesInput,
            liveRates: liveRatesInput,
          });
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
    },
    [commercialRatesInput, liveRatesInput, inStorePaymentsForDisplay],
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

  // Limitar descuento general (Bs en monto; 0–100 en porcentaje)
  useEffect(() => {
    setGeneralDiscount((prev) => {
      const lo = Math.max(prev, 0);
      if (generalDiscountType === "porcentaje") {
        return Math.min(lo, 100);
      }
      return Math.min(lo, totalBeforeGeneralDiscount);
    });
  }, [totalBeforeGeneralDiscount, generalDiscountType]);

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
    dispatchObservations,
    setDispatchObservations,
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
    exchangeRates: liveExchangeRates,
    commercialExchangeRates,
    formBaseCurrency,
    commercialTotalsFrozen,
    productSubtotalBase,
    productSurchargeTotal,
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
    totalPaidUsd: totalPaidInUsd,
    remainingAmount,
    remainingAmountUsd,
    isPaymentsValid,
    appliedStoreCreditUsd,
    setAppliedStoreCreditUsd,
    clientStoreCreditBalanceUsd,
    refreshClientStoreCreditBalance,
    appliedCreditBsApprox,
    maxApplicableStoreCreditUsd,
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
    getProductLineBase,
    getProductLineSurcharge,
    getProductLineSubtotalDisplay,
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
    renderServiceLineCell,
    renderPaymentTotalCell,
    mockVendors: vendors,
    mockReferrers: referrers,
    needsDraftPrompt: false,
    isDraftGateBlocking: false,
    applyDraftAndContinue: () => {},
    discardDraftAndStartFresh: () => {},
    clearDraftStorage: () => {},
    onlineSellerMode: null,
    setOnlineSellerMode: () => {},
    isOnlineSellerReferrer: false,
  };
}
