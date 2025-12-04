"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/currency-context";
import { ClientLookupDialog } from "@/components/orders/client-lookup-dialog";
import { ProductSelectionDialog } from "@/components/orders/product-selection-dialog";
import { ProductEditDialog } from "@/components/orders/product-edit-dialog";
import { RemoveProductDialog } from "@/components/orders/remove-product-dialog";
import { OrderConfirmationDialog } from "@/components/orders/order-confirmation-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  addOrder,
  getVendors,
  getReferrers,
  getCategories,
  calculateProductTotalWithAttributes,
  calculateProductUnitPriceWithAttributes,
  getProducts,
  type Order,
  type OrderProduct,
  type PartialPayment,
  type Vendor,
  type Category,
  type Product,
  type AttributeValue,
} from "@/lib/storage";
import {
  Currency,
  getActiveExchangeRates,
  convertCurrency,
  formatCurrency,
  type ExchangeRate,
} from "@/lib/currency-utils";

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Constantes para Condición de Pago
export const PAYMENT_CONDITIONS = [
  { value: "cashea", label: "Cashea" },
  { value: "pagara_en_tienda", label: "Pagará en Tienda" },
  { value: "pago_a_entrega", label: "Pago a la entrega" },
  { value: "pago_parcial", label: "Pago Parcial" },
  { value: "todo_pago", label: "Todo Pago" },
] as const;

// Constantes para Tipo de Compra
export const PURCHASE_TYPES = [
  { value: "delivery_express", label: "Delivery Express" },
  { value: "encargo", label: "Encargo" },
  { value: "encargo_entrega", label: "Encargo/Entrega" },
  { value: "entrega", label: "Entrega" },
  { value: "retiro_almacen", label: "Retiro x almacén" },
  { value: "retiro_tienda", label: "Retiro x tienda" },
  { value: "sa", label: "SA" },
] as const;

// Lista ampliada de métodos de pago
const paymentMethods = [
  "AirTM",
  "Banesco Panamá",
  "Binance",
  "Efectivo",
  "Facebank",
  "Mercantil Panamá",
  "Pago Móvil",
  "Paypal",
  "Tarjeta de débito",
  "Tarjeta de Crédito",
  "Transferencia",
  "Zelle",
];

export function NewOrderDialog({ open, onOpenChange }: NewOrderDialogProps) {
  const { preferredCurrency, formatWithPreference } = useCurrency();
  const [currentStep, setCurrentStep] = useState(1);

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

  // Función helper para obtener la moneda por defecto basada en las seleccionadas
  const getDefaultCurrencyFromSelection = (): Currency => {
    // Si la moneda preferida está seleccionada y no es Bs, usarla
    if (selectedCurrencies.includes(preferredCurrency) && preferredCurrency !== "Bs") {
      return preferredCurrency;
    }
    
    // Buscar la primera moneda seleccionada que no sea Bs
    const nonBsCurrency = selectedCurrencies.find(c => c !== "Bs");
    if (nonBsCurrency) {
      return nonBsCurrency;
    }
    
    // Si solo está Bs seleccionado o no hay ninguna, usar la preferida
    return preferredCurrency;
  };

  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    address?: string;
    telefono?: string;
    email?: string;
    rutId?: string;
  } | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<OrderProduct[]>([]);
  const [isClientLookupOpen, setIsClientLookupOpen] = useState(false);
  const [isProductSelectionOpen, setIsProductSelectionOpen] = useState(false);
  const [isProductEditOpen, setIsProductEditOpen] = useState(false);
  const [isRemoveProductOpen, setIsRemoveProductOpen] = useState(false); // Added remove confirmation dialog state
  const [editingProduct, setEditingProduct] = useState<OrderProduct | null>(
    null
  );
  const [productToRemove, setProductToRemove] = useState<OrderProduct | null>(
    null
  ); // Added product to remove state
  const [saleType, setSaleType] = useState<"apartado" | "entrega" | "contado">(
    "apartado"
  );
  const [paymentCondition, setPaymentCondition] = useState<
    "cashea" | "pagara_en_tienda" | "pago_a_entrega" | "pago_parcial" | "todo_pago" | ""
  >("");
  const [purchaseType, setPurchaseType] = useState<
    | "delivery_express"
    | "encargo"
    | "encargo_entrega"
    | "entrega"
    | "retiro_almacen"
    | "retiro_tienda"
    | "sa"
    | ""
  >("");
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  const [payments, setPayments] = useState<PartialPayment[]>([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState(0);
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false); // Added supplier order flag
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referrers, setReferrers] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});
  // Inicializar monedas seleccionadas según la preferencia del usuario
  // Siempre incluir Bs y la moneda preferida
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
  const [showCurrencyTable, setShowCurrencyTable] = useState(true);

  useEffect(() => {
    const loadVendorsAndReferrers = async () => {
      try {
        // Cargar vendedores desde usuarios con rol "Store Seller" o "Vendedor de tienda"
        const loadedVendors = await getVendors();
        setVendors(loadedVendors);

        // Cargar referidos desde usuarios con rol "Online Seller" o "Vendedor Online"
        const loadedReferrers = await getReferrers();
        setReferrers(loadedReferrers);
      } catch (error) {
        console.error("Error loading vendors and referrers:", error);
      }
    };
    const loadCategories = async () => {
      try {
        const loadedCategories = await getCategories();
        setCategories(loadedCategories);
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    const loadExchangeRates = async () => {
      try {
        const rates = await getActiveExchangeRates();
        setExchangeRates(rates);
      } catch (error) {
        console.error("Error loading exchange rates:", error);
      }
    };
    const loadProducts = async () => {
      try {
        const loadedProducts = await getProducts();
        setAllProducts(loadedProducts);
      } catch (error) {
        console.error("Error loading products:", error);
      }
    };
    if (open) {
      loadVendorsAndReferrers();
      loadCategories();
      loadExchangeRates();
      loadProducts();
    }
  }, [open]);

  // Mantener compatibilidad con código existente usando vendors y referrers separados
  const mockVendors = vendors;
  const mockReferrers = referrers;

  const [formData, setFormData] = useState({
    vendor: "",
    referrer: "",
    paymentMethod: "",
    deliveryAddress: "",
    firstPaymentAmount: 0,
    // Agregar nuevos campos para métodos de pago
    // Pago Móvil
    pagomovilReference: "",
    pagomovilBank: "",
    pagomovilPhone: "",
    pagomovilDate: "",
    // Transferencia
    transferenciaBank: "",
    transferenciaReference: "",
    transferenciaDate: "",
    // Efectivo
    cashAmount: "",
  });

  // Agregar nuevos estados
  const [hasDelivery, setHasDelivery] = useState(false);
  const [productMarkups, setProductMarkups] = useState<Record<string, number>>(
    {}
  ); // Sobreprecio por producto
  const [generalDiscount, setGeneralDiscount] = useState(0);
  const [generalDiscountType, setGeneralDiscountType] = useState<
    "monto" | "porcentaje"
  >("monto");
  const [generalDiscountCurrency, setGeneralDiscountCurrency] =
    useState<Currency>(() => {
      // Inicializar con la moneda seleccionada en los checkboxes
      const currencies: Currency[] = ["Bs"];
      if (preferredCurrency !== "Bs" && !currencies.includes(preferredCurrency)) {
        currencies.push(preferredCurrency);
      }
      // Usar la primera moneda no-Bs si existe, sino la preferida
      return currencies.find(c => c !== "Bs") || preferredCurrency;
    });
  const [productDiscountTypes, setProductDiscountTypes] = useState<
    Record<string, "monto" | "porcentaje">
  >({});
  const [productDiscountCurrencies, setProductDiscountCurrencies] = useState<
    Record<string, Currency>
  >({});
  const [deliveryCurrency, setDeliveryCurrency] = useState<Currency>(() => {
    // Inicializar con la moneda seleccionada en los checkboxes
    const currencies: Currency[] = ["Bs"];
    if (preferredCurrency !== "Bs" && !currencies.includes(preferredCurrency)) {
      currencies.push(preferredCurrency);
    }
    // Usar la primera moneda no-Bs si existe, sino la preferida
    return currencies.find(c => c !== "Bs") || preferredCurrency;
  });
  const [generalObservations, setGeneralObservations] = useState("");
  const [formattedProductPrices, setFormattedProductPrices] = useState<
    Record<string, string>
  >({});
  const [formattedProductTotals, setFormattedProductTotals] = useState<
    Record<string, string>
  >({});
  const [formattedProductFinalTotals, setFormattedProductFinalTotals] =
    useState<Record<string, string>>({});
  const [formattedSubtotal, setFormattedSubtotal] = useState<string>("");

  // Formatear precios de productos en la moneda preferida
  useEffect(() => {
    const formatPrices = async () => {
      if (selectedProducts.length === 0) {
        setFormattedProductPrices({});
        setFormattedProductTotals({});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedProducts,
    preferredCurrency,
    exchangeRates,
    productMarkups,
    categories,
    allProducts,
    formatWithPreference,
    productDiscountTypes,
  ]);

  // Actualizar monedas seleccionadas cuando cambie la preferencia
  useEffect(() => {
    const currencies: Currency[] = ["Bs"];
    if (preferredCurrency !== "Bs" && !currencies.includes(preferredCurrency)) {
      currencies.push(preferredCurrency);
    }
    setSelectedCurrencies(currencies);
  }, [preferredCurrency]);

  // Actualizar monedas por defecto cuando cambien las monedas seleccionadas
  useEffect(() => {
    const defaultCurrency = getDefaultCurrencyFromSelection();
    
    // Actualizar descuento general si está en Bs y hay otra moneda seleccionada
    if (generalDiscountCurrency === "Bs" && defaultCurrency !== "Bs") {
      setGeneralDiscountCurrency(defaultCurrency);
    }
    
    // Actualizar delivery si está en Bs y hay otra moneda seleccionada
    if (deliveryCurrency === "Bs" && defaultCurrency !== "Bs") {
      setDeliveryCurrency(defaultCurrency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurrencies, preferredCurrency]);

  // Función helper para renderizar celdas de moneda en el orden correcto
  const renderCurrencyCells = (amountInBs: number, className?: string) => {
    return getCurrencyOrder().map((currency) => {
      if (!selectedCurrencies.includes(currency)) return null;

      let amount = amountInBs;
      let rate: number | undefined;

      if (currency === "USD") {
        rate = exchangeRates.USD?.rate;
        if (rate) amount = amountInBs / rate;
      } else if (currency === "EUR") {
        rate = exchangeRates.EUR?.rate;
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
    return getCurrencyOrder().map((currency) => {
      if (!selectedCurrencies.includes(currency)) return null;

      let amount = amountInBs;
      let rate: number | undefined;

      if (currency === "USD") {
        rate = exchangeRates.USD?.rate;
        if (rate) amount = amountInBs / rate;
      } else if (currency === "EUR") {
        rate = exchangeRates.EUR?.rate;
        if (rate) amount = amountInBs / rate;
      }

      return (
        <TableCell
          key={currency}
          className={`text-right text-xs sm:text-sm ${className || ""}`}
        >
          {currency !== "Bs" && !rate
            ? "-"
            : `- ${formatCurrency(amount, currency)}`}
        </TableCell>
      );
    });
  };

  const getProductBaseTotal = (product: OrderProduct) => {
    const markup = productMarkups[product.id] || 0;
    const category = categories.find((cat) => cat.name === product.category);

    if (!category) {
      return product.total + markup;
    }

    // Calcular el precio base con ajustes normales (excluyendo productos como atributos)
    const basePriceWithAdjustments = calculateProductUnitPriceWithAttributes(
      product.price,
      product.attributes,
      category,
      exchangeRates
    );

    // Sumar precios de productos cuando son atributos (convertidos a Bs)
    // IMPORTANTE: Los productos-atributos se cargan desde attribute.values (valores por defecto de la categoría)
    // TODOS los productos en attribute.values están siempre presentes y deben incluirse en el precio
    let productAttributesTotal = 0;

    if (allProducts.length > 0) {
      // Crear un Map para búsquedas rápidas de productos
      const productsMap = new Map<number, Product>();
      allProducts.forEach((p) => productsMap.set(p.id, p));

      // Iterar sobre los atributos de la categoría para encontrar los de tipo "Product"
      for (const attribute of category.attributes || []) {
        if (
          attribute.valueType === "Product" &&
          attribute.values &&
          attribute.values.length > 0
        ) {
          const attrId = attribute.id?.toString() || attribute.title;

          // Todos los productos en attribute.values están siempre presentes por defecto
          for (const value of attribute.values) {
            const attrValue =
              typeof value === "string"
                ? { id: "", label: value, productId: undefined }
                : (value as AttributeValue);

            if (attrValue.productId) {
              const foundProduct = productsMap.get(attrValue.productId);
              if (foundProduct) {
                // Convertir precio del producto-atributo a Bs
                const productPrice = foundProduct.price;
                const productCurrency = foundProduct.priceCurrency || "Bs";

                let productPriceInBs = productPrice;
                if (productCurrency !== "Bs") {
                  if (productCurrency === "USD" && exchangeRates?.USD?.rate) {
                    productPriceInBs = productPrice * exchangeRates.USD.rate;
                  } else if (
                    productCurrency === "EUR" &&
                    exchangeRates?.EUR?.rate
                  ) {
                    productPriceInBs = productPrice * exchangeRates.EUR.rate;
                  }
                }

                // Sumar el precio base del producto
                productAttributesTotal += productPriceInBs;

                // Buscar atributos editados de este producto-atributo
                // Los atributos editados se guardan con la clave: `${attrId}_${productId}`
                const productAttributeKey = `${attrId}_${foundProduct.id}`;
                const editedAttributes =
                  product.attributes?.[productAttributeKey];

                // Verificar que editedAttributes sea un Record (objeto) y no un array
                if (
                  editedAttributes &&
                  typeof editedAttributes === "object" &&
                  !Array.isArray(editedAttributes)
                ) {
                  // Obtener la categoría del producto-atributo
                  const productCategory = categories.find(
                    (cat) => cat.name === foundProduct.category
                  );

                  if (productCategory) {
                    // Calcular los ajustes de precio de los atributos editados del producto-atributo
                    const productAttributeAdjustments =
                      calculateProductUnitPriceWithAttributes(
                        0, // Precio base 0 porque ya sumamos el precio del producto arriba
                        editedAttributes as Record<string, string | number | string[]>,
                        productCategory,
                        exchangeRates
                      );

                    // Sumar los ajustes de atributos (el precio base ya está incluido arriba)
                    productAttributesTotal += productAttributeAdjustments;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Calcular el total: (precio base + ajustes + precios de productos-atributos) * cantidad
    const unitPrice = basePriceWithAdjustments + productAttributesTotal;
    const total = unitPrice * product.quantity;

    return total + markup;
  };

  const productSubtotal = selectedProducts.reduce((sum, product) => {
    return sum + getProductBaseTotal(product);
  }, 0);

  const productDiscountTotal = selectedProducts.reduce((sum, product) => {
    return sum + (product.discount || 0);
  }, 0);

  const subtotalAfterProductDiscounts = Math.max(
    productSubtotal - productDiscountTotal,
    0
  );

  const generalDiscountAmount = Math.min(
    Math.max(generalDiscount, 0),
    subtotalAfterProductDiscounts
  );

  const subtotal = Math.max(
    subtotalAfterProductDiscounts - generalDiscountAmount,
    0
  );

  const taxAmount = subtotal * 0.16; // Impuesto fijo del 16%
  const deliveryCost = hasDelivery ? deliveryExpenses : 0;
  const total = subtotal + taxAmount + deliveryCost;

  // Formatear subtotal en la moneda preferida
  useEffect(() => {
    const formatSubtotal = async () => {
      const formatted = await formatWithPreference(subtotal, "Bs");
      setFormattedSubtotal(formatted);
    };

    formatSubtotal();
  }, [subtotal, preferredCurrency, formatWithPreference, exchangeRates]);

  useEffect(() => {
    setGeneralDiscount((prev) =>
      Math.min(Math.max(prev, 0), subtotalAfterProductDiscounts)
    );
  }, [subtotalAfterProductDiscounts]);

  // Cargar dirección del cliente cuando se activa delivery y hay un cliente seleccionado
  useEffect(() => {
    if (hasDelivery && selectedClient?.address && !formData.deliveryAddress) {
      setFormData((prev) => ({
        ...prev,
        deliveryAddress: selectedClient.address || "",
      }));
    }
  }, [hasDelivery, selectedClient]);

  // Calcular total de pagos en Bs (para validación)
  // IMPORTANTE: payment.amount siempre está en Bs (se convierte al guardar)
  const calculateTotalPaidInBs = async (): Promise<number> => {
    let totalInBs = 0;

    for (const payment of payments) {
      // payment.amount ya está en Bs, solo sumarlo
      totalInBs += payment.amount || 0;
    }

    return totalInBs;
  };

  const [totalPaidInBs, setTotalPaidInBs] = useState(0);

  useEffect(() => {
    const updateTotal = async () => {
      const total = await calculateTotalPaidInBs();
      setTotalPaidInBs(total);
    };
    updateTotal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, exchangeRates]);

  // Remaining amount - siempre trabajamos en Bs
  const remainingAmount = total - totalPaidInBs;
  const isPaymentsValid = Math.abs(remainingAmount) < 0.01; // Tolerancia para decimales

  const handleProductsSelect = (products: OrderProduct[]) => {
    setSelectedProducts(
      products.map((product) => ({
        ...product,
        discount: product.discount ?? 0,
      }))
    );
    // Inicializar tipos de descuento como "monto" por defecto
    const newTypes: Record<string, "monto" | "porcentaje"> = {};
    const newCurrencies: Record<string, Currency> = {};
    products.forEach((product) => {
      if (!productDiscountTypes[product.id]) {
        newTypes[product.id] = "monto";
      }
      if (!productDiscountCurrencies[product.id]) {
        newCurrencies[product.id] = getDefaultCurrencyFromSelection();
      }
    });
    if (Object.keys(newTypes).length > 0) {
      setProductDiscountTypes((prev) => ({ ...prev, ...newTypes }));
    }
    if (Object.keys(newCurrencies).length > 0) {
      setProductDiscountCurrencies((prev) => ({ ...prev, ...newCurrencies }));
    }
  };

  const handleProductDiscountChange = (productId: string, value: number) => {
    setSelectedProducts((products) =>
      products.map((product) => {
        if (product.id !== productId) {
          return product;
        }
        const baseTotal = getProductBaseTotal(product);
        const discountType = productDiscountTypes[productId] || "monto";
        const discountCurrency =
          productDiscountCurrencies[productId] || getDefaultCurrencyFromSelection();

        let discountAmount: number;
        if (discountType === "porcentaje") {
          // Convertir porcentaje a monto y limitarlo al baseTotal
          // NO aplicar maxDiscount cuando es porcentaje - permitir hasta 100%
          // El maxDiscount solo se aplica cuando el descuento es por monto directo
          const percentage = Math.max(0, Math.min(value, 100));

          // Redondear el cálculo para evitar errores de precisión
          discountAmount =
            Math.round(((baseTotal * percentage) / 100) * 100) / 100;
        } else {
          // Monto directo - convertir a Bs según la moneda seleccionada
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
          discountAmount = Math.max(0, Math.min(discountInBs, baseTotal));

          // Validar descuento máximo de la categoría (solo para monto)
          const category = categories.find(
            (cat) => cat.name === product.category
          );
          if (category && category.maxDiscount > 0) {
            // Convertir maxDiscount a Bs si está en otra moneda
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

            // Limitar el descuento al máximo permitido
            discountAmount = Math.min(discountAmount, maxDiscountInBs);
          }
        }

        return {
          ...product,
          discount: discountAmount,
        };
      })
    );
  };

  const handleProductDiscountTypeChange = (
    productId: string,
    type: "monto" | "porcentaje"
  ) => {
    setProductDiscountTypes((prev) => ({ ...prev, [productId]: type }));

    // Convertir el descuento actual al nuevo tipo
    setSelectedProducts((products) =>
      products.map((product) => {
        if (product.id !== productId) {
          return product;
        }
        const baseTotal = getProductBaseTotal(product);
        const currentDiscount = product.discount || 0;

        if (type === "porcentaje") {
          // Si estaba en monto, convertir a porcentaje
          const percentage =
            baseTotal > 0 ? (currentDiscount / baseTotal) * 100 : 0;
          // El discount se mantiene como monto, solo cambia la UI
          return product;
        } else {
          // Si estaba en porcentaje, el monto ya está correcto
          return product;
        }
      })
    );
  };

  const handleGeneralDiscountChange = (value: number) => {
    let discountAmount: number;

    if (generalDiscountType === "porcentaje") {
      // Convertir porcentaje a monto
      const percentage = Math.max(0, Math.min(value, 100));
      discountAmount = (subtotalAfterProductDiscounts * percentage) / 100;
    } else {
      // Monto directo - el valor ya viene en Bs desde el onChange
      discountAmount = Math.max(
        0,
        Math.min(value, subtotalAfterProductDiscounts)
      );
    }

    setGeneralDiscount(discountAmount);
  };

  const handleGeneralDiscountTypeChange = (type: "monto" | "porcentaje") => {
    const currentDiscount = generalDiscount;

    if (type === "porcentaje") {
      // Convertir monto actual a porcentaje para mostrar en el input
      const percentage =
        subtotalAfterProductDiscounts > 0
          ? (currentDiscount / subtotalAfterProductDiscounts) * 100
          : 0;
      setGeneralDiscountType(type);
      // El discount se mantiene como monto, solo cambia cómo se muestra
    } else {
      // Ya estaba en porcentaje, el monto se mantiene
      setGeneralDiscountType(type);
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      // Validar que tenga vendedor, cliente y al menos un producto
      if (!formData.vendor) {
        toast.error("Por favor selecciona un vendedor");
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

      setCurrentStep(currentStep + 1);
    }
  };

  // Validación para habilitar botón de agregar producto
  const canAddProduct = formData.vendor && selectedClient;

  // Validación para habilitar botón siguiente
  const canGoToNextStep =
    formData.vendor && selectedClient && selectedProducts.length > 0;

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validaciones básicas
      if (!selectedClient) {
        toast.error("Por favor selecciona un cliente");
        return;
      }

      if (selectedProducts.length === 0) {
        toast.error("Por favor agrega al menos un producto");
        return;
      }

      // Validar pagos
      if (payments.length === 0) {
        toast.error("Por favor agrega al menos un pago");
        return;
      }

      if (!isPaymentsValid && saleType === "contado") {
        // Para contado, el total debe ser igual al pedido
        toast.error(
          `El total de los pagos (${formatCurrency(
            totalPaidInBs,
            "Bs"
          )}) debe ser igual al total del pedido (${formatCurrency(
            total,
            "Bs"
          )})`
        );
        return;
      }

      // Validar condición de pago (obligatoria)
      if (!paymentCondition) {
        toast.error("Por favor selecciona la condición de pago");
        return;
      }

      // Validar tipo de compra (obligatorio)
      if (!purchaseType) {
        toast.error("Por favor selecciona el tipo de compra");
        return;
      }

      // Validar observaciones generales (obligatorias)
      if (!generalObservations || generalObservations.trim() === "") {
        toast.error("Por favor agrega observaciones generales para el pedido");
        return;
      }

      // Preparar datos para confirmación
      const orderDataForConfirmation = {
        clientName: selectedClient.name,
        clientTelefono: selectedClient.telefono,
        clientEmail: selectedClient.email,
        clientRutId: selectedClient.rutId,
        clientDireccion: selectedClient.address,
        vendorName:
          mockVendors.find((v) => v.id === formData.vendor)?.name || "",
        referrerName: formData.referrer
          ? mockReferrers.find((r) => r.id === formData.referrer)?.name
          : undefined,
        products: selectedProducts,
        subtotal,
        productDiscountTotal,
        generalDiscountAmount,
        taxAmount,
        deliveryCost,
        total,
        payments,
        saleType,
        paymentCondition,
        purchaseType,
        hasDelivery,
        deliveryAddress: formData.deliveryAddress,
        observations: generalObservations.trim() || undefined,
      };

      // Mostrar modal de confirmación
      setPendingOrderData(orderDataForConfirmation);
      setIsConfirmationOpen(true);
    } catch (error) {
      console.error("Error preparing order:", error);
      toast.error("Error al preparar el pedido. Por favor intenta nuevamente.");
    }
  };

  const handleConfirmOrder = async () => {
    try {
      if (!pendingOrderData || !selectedClient) return;

      // Preparar el pedido
      const orderData: Omit<
        Order,
        "id" | "orderNumber" | "createdAt" | "updatedAt"
      > = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        vendorId: formData.vendor,
        vendorName:
          mockVendors.find((v) => v.id === formData.vendor)?.name || "",
        referrerId: formData.referrer || undefined,
        referrerName: formData.referrer
          ? mockReferrers.find((r) => r.id === formData.referrer)?.name
          : undefined,
        products: selectedProducts,
        subtotalBeforeDiscounts: productSubtotal,
        productDiscountTotal,
        generalDiscountAmount,
        subtotal,
        taxAmount,
        deliveryCost,
        total,
        paymentType:
          saleType === "apartado"
            ? "apartado"
            : saleType === "entrega"
            ? "apartado"
            : "directo", // Mantener compatibilidad
        saleType, // Mantener para compatibilidad
        paymentCondition: paymentCondition as
          | "cashea"
          | "pagara_en_tienda"
          | "pago_a_entrega"
          | "pago_parcial"
          | "todo_pago",
        purchaseType: purchaseType as
          | "delivery_express"
          | "encargo"
          | "encargo_entrega"
          | "entrega"
          | "retiro_almacen"
          | "retiro_tienda"
          | "sa",
        paymentMethod:
          payments.length > 1 ? "Mixto" : payments[0]?.method || "",
        paymentDetails:
          payments.length === 1 ? payments[0]?.paymentDetails : undefined,
        partialPayments: payments, // Usar payments unificado
        mixedPayments: payments.length > 1 ? payments : undefined,
        deliveryAddress: hasDelivery ? formData.deliveryAddress : undefined,
        hasDelivery,
        status:
          saleType === "apartado" || saleType === "entrega"
            ? "Apartado"
            : saleType === "contado"
            ? "Pendiente"
            : "Pendiente",
        productMarkups,
        createSupplierOrder,
        observations: generalObservations.trim() || undefined,
        baseCurrency: "Bs", // Moneda principal siempre es Bs
        // Guardar las tasas de cambio del día en que se crea el pedido
        exchangeRatesAtCreation: {
          USD: exchangeRates.USD
            ? {
                rate: exchangeRates.USD.rate,
                effectiveDate: exchangeRates.USD.effectiveDate,
              }
            : undefined,
          EUR: exchangeRates.EUR
            ? {
                rate: exchangeRates.EUR.rate,
                effectiveDate: exchangeRates.EUR.effectiveDate,
              }
            : undefined,
        },
      };

      const createdOrder = await addOrder(orderData);

      // Cerrar modales
      setIsConfirmationOpen(false);
      onOpenChange(false);

      // Mostrar mensaje de éxito
      toast.success("Pedido creado exitosamente");

      // Reset
      setCurrentStep(1);
      setSelectedClient(null);
      setSelectedProducts([]);
      setPayments([]);
      setDeliveryExpenses(0);
      setHasDelivery(false);
      setProductMarkups({});
      setGeneralDiscount(0);
      setGeneralDiscountType("monto");
      setGeneralDiscountCurrency("Bs");
      setProductDiscountTypes({});
      setProductDiscountCurrencies({});
      setDeliveryCurrency("Bs");
      setCreateSupplierOrder(false);
      setGeneralObservations("");
      setSaleType("apartado"); // Reset tipo de venta
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
      setPendingOrderData(null);

      // Redirigir a la vista de detalle del pedido
      window.location.href = `/pedidos/${createdOrder.orderNumber}`;
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Error al crear el pedido. Por favor intenta nuevamente.");
      setIsConfirmationOpen(false);
    }
  };

  // Funciones unificadas para manejar pagos (funciona para todos los tipos de venta)
  const addPayment = () => {
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      currency: getDefaultCurrencyFromSelection(),
      paymentDetails: {},
    };
    setPayments([...payments, newPayment]);
  };

  const updatePayment = (
    id: string,
    field: keyof PartialPayment,
    value: string | number | Currency
  ) => {
    setPayments((paymentsList) =>
      paymentsList.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  };

  const updatePaymentDetails = (
    id: string,
    field: string,
    value: string | number
  ) => {
    setPayments((paymentsList) =>
      paymentsList.map((payment) => {
        if (payment.id === id) {
          return {
            ...payment,
            paymentDetails: {
              ...payment.paymentDetails,
              [field]: value,
            },
          };
        }
        return payment;
      })
    );
  };

  const removePayment = (id: string) => {
    setPayments((paymentsList) =>
      paymentsList.filter((payment) => payment.id !== id)
    );
  };

  const handleEditProduct = (product: OrderProduct) => {
    setEditingProduct(product);
    setIsProductEditOpen(true);
  };

  const handleUpdateProduct = (updatedProduct: OrderProduct) => {
    setSelectedProducts((products) =>
      products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    setIsProductEditOpen(false);
    setEditingProduct(null);
  };

  const handleRemoveProduct = (product: OrderProduct) => {
    // Modified to show confirmation dialog
    setProductToRemove(product);
    setIsRemoveProductOpen(true);
  };

  const confirmRemoveProduct = () => {
    // Added confirmation handler
    if (productToRemove) {
      setSelectedProducts((products) =>
        products.filter((p) => p.id !== productToRemove.id)
      );
      setProductToRemove(null);
      setIsRemoveProductOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none sm:w-full sm:h-auto sm:max-w-[95vw] sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6 rounded-none sm:rounded-lg m-0 sm:m-4">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              Nuevo Pedido - Paso {currentStep} de 2
            </DialogTitle>
          </DialogHeader>

          {currentStep === 1 && (
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="p-3 sm:p-6 pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">
                    Presupuesto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-3 sm:p-6">
                  {/* Vendor Selection */}
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendedor</Label>
                      <Select
                        value={formData.vendor}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, vendor: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="referrer">Referidor</Label>
                      <Select
                        value={formData.referrer}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, referrer: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar referidor" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockReferrers.map((referrer) => (
                            <SelectItem key={referrer.id} value={referrer.id}>
                              {referrer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Client Selection */}
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedClient?.name || ""}
                        placeholder="Seleccionar cliente"
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsClientLookupOpen(true)}
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                      <Label>Productos</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setIsProductSelectionOpen(true)}
                        disabled={!canAddProduct}
                        title={
                          !formData.vendor && !selectedClient
                            ? "Selecciona un vendedor y un cliente para agregar productos"
                            : !formData.vendor
                            ? "Selecciona un vendedor para agregar productos"
                            : !selectedClient
                            ? "Selecciona un cliente para agregar productos"
                            : ""
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Producto
                      </Button>
                    </div>
                    {!canAddProduct && (
                      <p className="text-xs text-muted-foreground">
                        {!formData.vendor && !selectedClient
                          ? "⚠️ Debes seleccionar un vendedor y un cliente para agregar productos"
                          : !formData.vendor
                          ? "⚠️ Debes seleccionar un vendedor para agregar productos"
                          : "⚠️ Debes seleccionar un cliente para agregar productos"}
                      </p>
                    )}

                    {selectedProducts.length > 0 ? (
                      <>
                        {/* Vista de tarjetas para móvil */}
                        <div className="space-y-3 sm:hidden">
                          {selectedProducts.map((product) => {
                            const baseTotal = getProductBaseTotal(product);
                            const discount = product.discount || 0;
                            const finalTotal = Math.max(
                              baseTotal - discount,
                              0
                            );

                            return (
                              <Card key={product.id} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-base mb-1">
                                        {product.name}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-semibold">
                                        {formattedProductFinalTotals[
                                          product.id
                                        ] || formatCurrency(finalTotal, "Bs")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Total final
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">
                                        Precio:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {formattedProductPrices[product.id] ||
                                          formatCurrency(product.price, "Bs")}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Cantidad:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {product.quantity}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Subtotal:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {formattedProductTotals[product.id] ||
                                          formatCurrency(baseTotal, "Bs")}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-2 pt-2 border-t">
                                    <Label className="text-sm">Descuento</Label>
                                    <div className="flex gap-2">
                                      <Select
                                        value={
                                          productDiscountTypes[product.id] ||
                                          "monto"
                                        }
                                        onValueChange={(
                                          value: "monto" | "porcentaje"
                                        ) =>
                                          handleProductDiscountTypeChange(
                                            product.id,
                                            value
                                          )
                                        }
                                      >
                                        <SelectTrigger className="w-20">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="monto">
                                            $
                                          </SelectItem>
                                          <SelectItem value="porcentaje">
                                            %
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {productDiscountTypes[product.id] ===
                                        "monto" && (
                                        <Select
                                          value={
                                            productDiscountCurrencies[
                                              product.id
                                            ] || getDefaultCurrencyFromSelection()
                                          }
                                          onValueChange={(value: Currency) => {
                                            setProductDiscountCurrencies(
                                              (prev) => ({
                                                ...prev,
                                                [product.id]: value,
                                              })
                                            );
                                            // Recalcular el descuento mostrado
                                            const currentDiscount =
                                              product.discount || 0;
                                            const currentCurrency =
                                              productDiscountCurrencies[
                                                product.id
                                              ] || getDefaultCurrencyFromSelection();
                                            const newCurrency = value;
                                            if (
                                              currentCurrency !== newCurrency
                                            ) {
                                              // Convertir el descuento actual a la nueva moneda
                                              let discountInNewCurrency =
                                                currentDiscount;
                                              if (currentCurrency === "Bs") {
                                                const rate =
                                                  newCurrency === "USD"
                                                    ? exchangeRates.USD?.rate
                                                    : exchangeRates.EUR?.rate;
                                                if (rate && rate > 0) {
                                                  discountInNewCurrency =
                                                    currentDiscount / rate;
                                                }
                                              } else if (newCurrency === "Bs") {
                                                const rate =
                                                  currentCurrency === "USD"
                                                    ? exchangeRates.USD?.rate
                                                    : exchangeRates.EUR?.rate;
                                                if (rate && rate > 0) {
                                                  discountInNewCurrency =
                                                    currentDiscount * rate;
                                                }
                                              } else {
                                                const currentRate =
                                                  currentCurrency === "USD"
                                                    ? exchangeRates.USD?.rate
                                                    : exchangeRates.EUR?.rate;
                                                const newRate =
                                                  newCurrency === "USD"
                                                    ? exchangeRates.USD?.rate
                                                    : exchangeRates.EUR?.rate;
                                                if (
                                                  currentRate &&
                                                  newRate &&
                                                  currentRate > 0
                                                ) {
                                                  discountInNewCurrency =
                                                    (currentDiscount *
                                                      currentRate) /
                                                    newRate;
                                                }
                                              }
                                              handleProductDiscountChange(
                                                product.id,
                                                discountInNewCurrency
                                              );
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="w-20">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Bs">
                                              Bs
                                            </SelectItem>
                                            <SelectItem value="USD">
                                              USD
                                            </SelectItem>
                                            <SelectItem value="EUR">
                                              EUR
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                      <Input
                                        type="number"
                                        min="0"
                                        step={
                                          productDiscountTypes[product.id] ===
                                          "porcentaje"
                                            ? "1"
                                            : "0.01"
                                        }
                                        max={(() => {
                                          const discountType =
                                            productDiscountTypes[product.id] ||
                                            "monto";
                                          if (discountType === "porcentaje") {
                                            // Para porcentaje, permitir hasta 100% sin restricción del maxDiscount
                                            // El maxDiscount solo se aplica cuando el descuento es por monto directo
                                            return 100;
                                          }

                                          // Para monto, considerar el maxDiscount de la categoría
                                          const category = categories.find(
                                            (cat) =>
                                              cat.name === product.category
                                          );
                                          if (
                                            category &&
                                            category.maxDiscount > 0
                                          ) {
                                            // Convertir maxDiscount a Bs si está en otra moneda
                                            let maxDiscountInBs =
                                              category.maxDiscount;
                                            if (
                                              category.maxDiscountCurrency &&
                                              category.maxDiscountCurrency !==
                                                "Bs"
                                            ) {
                                              const rate =
                                                category.maxDiscountCurrency ===
                                                "USD"
                                                  ? exchangeRates.USD?.rate
                                                  : exchangeRates.EUR?.rate;
                                              if (rate && rate > 0) {
                                                maxDiscountInBs =
                                                  category.maxDiscount * rate;
                                              }
                                            }
                                            return Math.min(
                                              baseTotal,
                                              maxDiscountInBs
                                            );
                                          }
                                          return baseTotal;
                                        })()}
                                        value={(() => {
                                          const discountType =
                                            productDiscountTypes[product.id] ||
                                            "monto";
                                          if (discount === 0) return "";
                                          if (discountType === "porcentaje") {
                                            const percentage =
                                              baseTotal > 0
                                                ? (discount / baseTotal) * 100
                                                : 0;
                                            // Redondear a 2 decimales para evitar errores de precisión
                                            return (
                                              Math.round(percentage * 100) / 100
                                            );
                                          }
                                          // Para monto, convertir a la moneda seleccionada
                                          const discountCurrency =
                                            productDiscountCurrencies[
                                              product.id
                                            ] || preferredCurrency;
                                          if (discountCurrency === "Bs") {
                                            return discount;
                                          }
                                          const rate =
                                            discountCurrency === "USD"
                                              ? exchangeRates.USD?.rate
                                              : exchangeRates.EUR?.rate;
                                          if (rate && rate > 0) {
                                            return discount / rate;
                                          }
                                          return discount;
                                        })()}
                                        onChange={(e) =>
                                          handleProductDiscountChange(
                                            product.id,
                                            Number.parseFloat(e.target.value) ||
                                              0
                                          )
                                        }
                                        className="flex-1 min-w-[100px] text-sm"
                                        placeholder={
                                          productDiscountTypes[product.id] ===
                                          "porcentaje"
                                            ? "0%"
                                            : "0.00"
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-2 border-t">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditProduct(product)}
                                      className="flex-1"
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Editar
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() =>
                                        handleRemoveProduct(product)
                                      }
                                      className="flex-1"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>

                        {/* Vista de tabla responsive para tablet/desktop/pantallas grandes */}
                        <div className="hidden sm:block overflow-hidden">
                          <div className="w-full overflow-x-hidden">
                            <Table className="w-full table-fixed">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[20%]">
                                    Producto
                                  </TableHead>
                                  <TableHead className="w-[10%]">
                                    Precio
                                  </TableHead>
                                  <TableHead className="w-[10%] text-center">
                                    Cantidad
                                  </TableHead>
                                  <TableHead className="w-[10%]">
                                    Subtotal
                                  </TableHead>
                                  <TableHead className="w-[22%]">
                                    Descuento
                                  </TableHead>
                                  <TableHead className="w-[10%]">
                                    Total final
                                  </TableHead>
                                  <TableHead className="w-[12%] text-right">
                                    Acciones
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedProducts.map((product) => {
                                  const baseTotal =
                                    getProductBaseTotal(product);
                                  const discount = product.discount || 0;
                                  const finalTotal = Math.max(
                                    baseTotal - discount,
                                    0
                                  );

                                  return (
                                    <TableRow key={product.id}>
                                      <TableCell className="w-[20%]">
                                        <div className="flex items-center gap-1">
                                          <span className="truncate text-sm">
                                            {product.name}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="w-[10%] text-right text-sm">
                                        {formattedProductPrices[product.id] ||
                                          formatCurrency(product.price, "Bs")}
                                      </TableCell>
                                      <TableCell className="w-[10%] text-center text-sm font-medium">
                                        {product.quantity || 1}
                                      </TableCell>
                                      <TableCell className="w-[10%] text-right text-sm">
                                        {formattedProductTotals[product.id] ||
                                          formatCurrency(baseTotal, "Bs")}
                                      </TableCell>
                                      <TableCell className="w-[22%]">
                                        <div className="flex gap-1 items-center">
                                          <Select
                                            value={
                                              productDiscountTypes[
                                                product.id
                                              ] || "monto"
                                            }
                                            onValueChange={(
                                              value: "monto" | "porcentaje"
                                            ) =>
                                              handleProductDiscountTypeChange(
                                                product.id,
                                                value
                                              )
                                            }
                                          >
                                            <SelectTrigger className="w-14 h-7 text-xs px-1">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="monto">
                                                $
                                              </SelectItem>
                                              <SelectItem value="porcentaje">
                                                %
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                          {productDiscountTypes[product.id] ===
                                            "monto" && (
                                            <Select
                                              value={
                                                productDiscountCurrencies[
                                                  product.id
                                                ] || getDefaultCurrencyFromSelection()
                                              }
                                              onValueChange={(
                                                value: Currency
                                              ) => {
                                                setProductDiscountCurrencies(
                                                  (prev) => ({
                                                    ...prev,
                                                    [product.id]: value,
                                                  })
                                                );
                                                // Recalcular el descuento mostrado
                                                const currentDiscount =
                                                  product.discount || 0;
                                                const currentCurrency =
                                                  productDiscountCurrencies[
                                                    product.id
                                                  ] || preferredCurrency;
                                                const newCurrency = value;
                                                if (
                                                  currentCurrency !==
                                                  newCurrency
                                                ) {
                                                  // Convertir el descuento actual a la nueva moneda
                                                  let discountInNewCurrency =
                                                    currentDiscount;
                                                  if (
                                                    currentCurrency === "Bs"
                                                  ) {
                                                    // De Bs a otra moneda
                                                    const rate =
                                                      newCurrency === "USD"
                                                        ? exchangeRates.USD
                                                            ?.rate
                                                        : exchangeRates.EUR
                                                            ?.rate;
                                                    if (rate && rate > 0) {
                                                      discountInNewCurrency =
                                                        currentDiscount / rate;
                                                    }
                                                  } else if (
                                                    newCurrency === "Bs"
                                                  ) {
                                                    // De otra moneda a Bs
                                                    const rate =
                                                      currentCurrency === "USD"
                                                        ? exchangeRates.USD
                                                            ?.rate
                                                        : exchangeRates.EUR
                                                            ?.rate;
                                                    if (rate && rate > 0) {
                                                      discountInNewCurrency =
                                                        currentDiscount * rate;
                                                    }
                                                  } else {
                                                    // Entre USD y EUR
                                                    const currentRate =
                                                      currentCurrency === "USD"
                                                        ? exchangeRates.USD
                                                            ?.rate
                                                        : exchangeRates.EUR
                                                            ?.rate;
                                                    const newRate =
                                                      newCurrency === "USD"
                                                        ? exchangeRates.USD
                                                            ?.rate
                                                        : exchangeRates.EUR
                                                            ?.rate;
                                                    if (
                                                      currentRate &&
                                                      newRate &&
                                                      currentRate > 0
                                                    ) {
                                                      discountInNewCurrency =
                                                        (currentDiscount *
                                                          currentRate) /
                                                        newRate;
                                                    }
                                                  }
                                                  handleProductDiscountChange(
                                                    product.id,
                                                    discountInNewCurrency
                                                  );
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="w-16 h-7 text-xs px-1">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="Bs">
                                                  Bs
                                                </SelectItem>
                                                <SelectItem value="USD">
                                                  USD
                                                </SelectItem>
                                                <SelectItem value="EUR">
                                                  EUR
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          )}
                                          <Input
                                            type="number"
                                            min="0"
                                            step={
                                              productDiscountTypes[
                                                product.id
                                              ] === "porcentaje"
                                                ? "1"
                                                : "0.01"
                                            }
                                            max={(() => {
                                              const discountType =
                                                productDiscountTypes[
                                                  product.id
                                                ] || "monto";
                                              if (
                                                discountType === "porcentaje"
                                              ) {
                                                // Para porcentaje, permitir hasta 100% sin restricción del maxDiscount
                                                // El maxDiscount solo se aplica cuando el descuento es por monto directo
                                                return 100;
                                              }

                                              // Para monto, considerar el maxDiscount de la categoría
                                              const category = categories.find(
                                                (cat) =>
                                                  cat.name === product.category
                                              );
                                              if (
                                                category &&
                                                category.maxDiscount > 0
                                              ) {
                                                // Convertir maxDiscount a Bs si está en otra moneda
                                                let maxDiscountInBs =
                                                  category.maxDiscount;
                                                if (
                                                  category.maxDiscountCurrency &&
                                                  category.maxDiscountCurrency !==
                                                    "Bs"
                                                ) {
                                                  const rate =
                                                    category.maxDiscountCurrency ===
                                                    "USD"
                                                      ? exchangeRates.USD?.rate
                                                      : exchangeRates.EUR?.rate;
                                                  if (rate && rate > 0) {
                                                    maxDiscountInBs =
                                                      category.maxDiscount *
                                                      rate;
                                                  }
                                                }
                                                return Math.min(
                                                  baseTotal,
                                                  maxDiscountInBs
                                                );
                                              }
                                              return baseTotal;
                                            })()}
                                            value={(() => {
                                              const discountType =
                                                productDiscountTypes[
                                                  product.id
                                                ] || "monto";
                                              if (discount === 0) return "";
                                              if (
                                                discountType === "porcentaje"
                                              ) {
                                                const percentage =
                                                  baseTotal > 0
                                                    ? (discount / baseTotal) *
                                                      100
                                                    : 0;
                                                // Redondear a 2 decimales para evitar errores de precisión
                                                return (
                                                  Math.round(percentage * 100) /
                                                  100
                                                );
                                              }
                                              // Para monto, convertir a la moneda seleccionada
                                              const discountCurrency =
                                                productDiscountCurrencies[
                                                  product.id
                                                ] || preferredCurrency;
                                              if (discountCurrency === "Bs") {
                                                return discount;
                                              }
                                              const rate =
                                                discountCurrency === "USD"
                                                  ? exchangeRates.USD?.rate
                                                  : exchangeRates.EUR?.rate;
                                              if (rate && rate > 0) {
                                                return discount / rate;
                                              }
                                              return discount;
                                            })()}
                                            onChange={(e) =>
                                              handleProductDiscountChange(
                                                product.id,
                                                Number.parseFloat(
                                                  e.target.value
                                                ) || 0
                                              )
                                            }
                                            className="flex-1 min-w-[80px] h-7 text-sm"
                                            placeholder={
                                              productDiscountTypes[
                                                product.id
                                              ] === "porcentaje"
                                                ? "0%"
                                                : "0.00"
                                            }
                                          />
                                        </div>
                                      </TableCell>
                                      <TableCell className="w-[10%] font-semibold text-right text-sm">
                                        {formattedProductFinalTotals[
                                          product.id
                                        ] || formatCurrency(finalTotal, "Bs")}
                                      </TableCell>
                                      <TableCell className="w-[12%] text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleEditProduct(product)
                                            }
                                            className="h-7 w-7 p-0"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleRemoveProduct(product)
                                            }
                                            className="h-7 w-7 p-0"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
                        No hay productos seleccionados
                      </div>
                    )}
                  </div>

                  {/* Subtotal */}
                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-sm sm:text-lg font-semibold">
                        <span className="block sm:inline">
                          Subtotal (después de descuentos):
                        </span>
                        <span className="block sm:inline sm:ml-1">
                          {formattedSubtotal || formatCurrency(subtotal, "Bs")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="p-3 sm:p-6 pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">
                    Realizar Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-3 sm:p-6">
                  {/* 1. DELIVERY */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hasDelivery"
                        checked={hasDelivery}
                        onCheckedChange={(checked) =>
                          setHasDelivery(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="hasDelivery"
                        className="text-base font-medium"
                      >
                        ¿Requiere delivery?
                      </Label>
                    </div>

                    {hasDelivery && (
                      <div className="space-y-2 pl-4 sm:pl-6">
                        <Label
                          htmlFor="deliveryAddress"
                          className="text-sm sm:text-base"
                        >
                          Dirección de Entrega
                        </Label>
                        <Textarea
                          id="deliveryAddress"
                          value={formData.deliveryAddress}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              deliveryAddress: e.target.value,
                            }))
                          }
                          placeholder="Ingrese la dirección de entrega"
                          rows={3}
                          className="w-full"
                        />
                        <div className="space-y-2">
                          <Label
                            htmlFor="deliveryExpenses"
                            className="text-sm sm:text-base"
                          >
                            Gastos de Entrega
                          </Label>
                          <div className="flex gap-2">
                            <Select
                              value={deliveryCurrency}
                              onValueChange={(value: Currency) => {
                                setDeliveryCurrency(value);
                                // Convertir el valor actual a la nueva moneda
                                if (deliveryExpenses > 0) {
                                  let newValue = deliveryExpenses;
                                  if (deliveryCurrency === "Bs") {
                                    // De Bs a otra moneda
                                    const rate =
                                      value === "USD"
                                        ? exchangeRates.USD?.rate
                                        : exchangeRates.EUR?.rate;
                                    if (rate && rate > 0) {
                                      newValue = deliveryExpenses / rate;
                                    }
                                  } else if (value === "Bs") {
                                    // De otra moneda a Bs
                                    const rate =
                                      deliveryCurrency === "USD"
                                        ? exchangeRates.USD?.rate
                                        : exchangeRates.EUR?.rate;
                                    if (rate && rate > 0) {
                                      newValue = deliveryExpenses * rate;
                                    }
                                  } else {
                                    // Entre USD y EUR
                                    const currentRate =
                                      deliveryCurrency === "USD"
                                        ? exchangeRates.USD?.rate
                                        : exchangeRates.EUR?.rate;
                                    const newRate =
                                      value === "USD"
                                        ? exchangeRates.USD?.rate
                                        : exchangeRates.EUR?.rate;
                                    if (
                                      currentRate &&
                                      newRate &&
                                      currentRate > 0
                                    ) {
                                      newValue =
                                        (deliveryExpenses * currentRate) /
                                        newRate;
                                    }
                                  }
                                  setDeliveryExpenses(newValue);
                                }
                              }}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Bs">Bs</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              id="deliveryExpenses"
                              type="number"
                              step="0.01"
                              value={(() => {
                                if (deliveryExpenses === 0) return "";
                                if (deliveryCurrency === "Bs") {
                                  return deliveryExpenses;
                                }
                                const rate =
                                  deliveryCurrency === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                if (rate && rate > 0) {
                                  return deliveryExpenses / rate;
                                }
                                return deliveryExpenses;
                              })()}
                              onChange={(e) => {
                                const inputValue =
                                  Number.parseFloat(e.target.value) || 0;
                                // Convertir a Bs según la moneda seleccionada
                                let valueInBs = inputValue;
                                if (deliveryCurrency !== "Bs") {
                                  const rate =
                                    deliveryCurrency === "USD"
                                      ? exchangeRates.USD?.rate
                                      : exchangeRates.EUR?.rate;
                                  if (rate && rate > 0) {
                                    valueInBs = inputValue * rate;
                                  }
                                }
                                setDeliveryExpenses(valueInBs);
                              }}
                              placeholder="0.00"
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. TOTALIZACIÓN */}
                  <div className="p-3 sm:p-4 bg-muted rounded-lg space-y-4">
                    {/* Selector de monedas */}
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">
                        Ver totales en:
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {/* Bs siempre primero */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="currency-bs"
                            checked={selectedCurrencies.includes("Bs")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const newCurrencies: Currency[] = [
                                  ...selectedCurrencies,
                                  "Bs",
                                ];
                                setSelectedCurrencies(newCurrencies);
                                setShowCurrencyTable(newCurrencies.length > 0);
                              } else {
                                const newCurrencies: Currency[] =
                                  selectedCurrencies.filter((c) => c !== "Bs");
                                setSelectedCurrencies(newCurrencies);
                                setShowCurrencyTable(newCurrencies.length > 0);
                              }
                            }}
                          />
                          <Label
                            htmlFor="currency-bs"
                            className="cursor-pointer text-sm"
                          >
                            Bs.
                          </Label>
                        </div>
                        {/* Mostrar la moneda preferida en segundo lugar (si no es Bs) */}
                        {preferredCurrency !== "Bs" && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`currency-${preferredCurrency.toLowerCase()}`}
                              checked={selectedCurrencies.includes(
                                preferredCurrency
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const newCurrencies: Currency[] = [
                                    ...selectedCurrencies,
                                    preferredCurrency,
                                  ];
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                } else {
                                  const newCurrencies: Currency[] =
                                    selectedCurrencies.filter(
                                      (c) => c !== preferredCurrency
                                    );
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`currency-${preferredCurrency.toLowerCase()}`}
                              className="cursor-pointer text-sm"
                            >
                              {preferredCurrency === "USD"
                                ? "USD ($)"
                                : "EUR (€)"}
                            </Label>
                          </div>
                        )}
                        {/* Mostrar las otras monedas */}
                        {preferredCurrency !== "USD" && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="currency-usd"
                              checked={selectedCurrencies.includes("USD")}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const newCurrencies: Currency[] = [
                                    ...selectedCurrencies,
                                    "USD",
                                  ];
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                } else {
                                  const newCurrencies: Currency[] =
                                    selectedCurrencies.filter(
                                      (c) => c !== "USD"
                                    );
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor="currency-usd"
                              className="cursor-pointer text-sm"
                            >
                              USD ($)
                            </Label>
                          </div>
                        )}
                        {preferredCurrency !== "EUR" && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="currency-eur"
                              checked={selectedCurrencies.includes("EUR")}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const newCurrencies: Currency[] = [
                                    ...selectedCurrencies,
                                    "EUR",
                                  ];
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                } else {
                                  const newCurrencies: Currency[] =
                                    selectedCurrencies.filter(
                                      (c) => c !== "EUR"
                                    );
                                  setSelectedCurrencies(newCurrencies);
                                  setShowCurrencyTable(
                                    newCurrencies.length > 0
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor="currency-eur"
                              className="cursor-pointer text-sm"
                            >
                              EUR (€)
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tabla de totales - Solo mostrar si hay monedas seleccionadas */}
                    {showCurrencyTable && selectedCurrencies.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[200px]">
                                Concepto
                              </TableHead>
                              {getCurrencyOrder().map((currency) => {
                                if (selectedCurrencies.includes(currency)) {
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
                              {renderCurrencyCells(productSubtotal)}
                            </TableRow>

                            {/* Descuentos individuales */}
                            {productDiscountTotal > 0 && (
                              <TableRow>
                                <TableCell className="text-xs sm:text-sm text-red-600">
                                  Descuentos individuales:
                                </TableCell>
                                {renderCurrencyCellsNegative(
                                  productDiscountTotal,
                                  "text-red-600"
                                )}
                              </TableRow>
                            )}

                            {/* Descuento general */}
                            {generalDiscountAmount > 0 && (
                              <TableRow>
                                <TableCell className="text-xs sm:text-sm text-red-600">
                                  Descuento general:
                                </TableCell>
                                {renderCurrencyCellsNegative(
                                  generalDiscountAmount,
                                  "text-red-600"
                                )}
                              </TableRow>
                            )}

                            {/* Subtotal después de descuentos */}
                            <TableRow className="font-medium border-t">
                              <TableCell className="text-xs sm:text-sm">
                                Subtotal después de descuentos:
                              </TableCell>
                              {renderCurrencyCells(subtotal)}
                            </TableRow>

                            {/* Impuesto */}
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm">
                                Impuesto (16%):
                              </TableCell>
                              {renderCurrencyCells(taxAmount)}
                            </TableRow>

                            {/* Gastos de entrega */}
                            {hasDelivery && (
                              <TableRow>
                                <TableCell className="text-xs sm:text-sm">
                                  Gastos de entrega:
                                </TableCell>
                                {renderCurrencyCells(deliveryCost)}
                              </TableRow>
                            )}

                            {/* Total */}
                            <TableRow className="font-semibold border-t-2">
                              <TableCell className="text-base sm:text-lg">
                                Total:
                              </TableCell>
                              {renderCurrencyCells(
                                total,
                                "text-base sm:text-lg font-semibold"
                              )}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* 3. DESCUENTO */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="generalDiscount"
                      className="text-sm sm:text-base"
                    >
                      Descuento general
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Select
                        value={generalDiscountType}
                        onValueChange={(value: "monto" | "porcentaje") =>
                          handleGeneralDiscountTypeChange(value)
                        }
                        disabled={selectedProducts.length === 0}
                      >
                        <SelectTrigger className="w-full sm:w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monto">Monto ($)</SelectItem>
                          <SelectItem value="porcentaje">
                            Porcentaje (%)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {generalDiscountType === "monto" && (
                        <Select
                          value={generalDiscountCurrency}
                          onValueChange={(value: Currency) => {
                            // Convertir el valor actual a la nueva moneda (similar a delivery)
                            if (generalDiscount > 0) {
                              let newValue = generalDiscount;
                              if (generalDiscountCurrency === "Bs") {
                                // De Bs a otra moneda
                                const rate =
                                  value === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                if (rate && rate > 0) {
                                  newValue = generalDiscount / rate;
                                }
                              } else if (value === "Bs") {
                                // De otra moneda a Bs
                                const rate =
                                  generalDiscountCurrency === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                if (rate && rate > 0) {
                                  newValue = generalDiscount * rate;
                                }
                              } else {
                                // Entre USD y EUR
                                const currentRate =
                                  generalDiscountCurrency === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                const newRate =
                                  value === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                if (currentRate && newRate && currentRate > 0) {
                                  newValue =
                                    (generalDiscount * currentRate) / newRate;
                                }
                              }
                              setGeneralDiscount(newValue);
                            }
                            setGeneralDiscountCurrency(value);
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Bs">Bs</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        id="generalDiscount"
                        type="number"
                        min="0"
                        step={
                          generalDiscountType === "porcentaje" ? "1" : "0.01"
                        }
                        max={
                          generalDiscountType === "porcentaje"
                            ? 100
                            : subtotalAfterProductDiscounts
                        }
                        value={
                          generalDiscount === 0
                            ? ""
                            : generalDiscountType === "porcentaje"
                            ? subtotalAfterProductDiscounts > 0
                              ? Math.round(
                                  (generalDiscount /
                                    subtotalAfterProductDiscounts) *
                                    100 *
                                    100
                                ) / 100 // Redondear a 2 decimales máximo
                              : 0
                            : (() => {
                                // Mostrar en la moneda seleccionada (similar a delivery)
                                if (generalDiscountCurrency === "Bs") {
                                  return generalDiscount;
                                }
                                const rate =
                                  generalDiscountCurrency === "USD"
                                    ? exchangeRates.USD?.rate
                                    : exchangeRates.EUR?.rate;
                                if (rate && rate > 0) {
                                  return (
                                    Math.round((generalDiscount / rate) * 100) /
                                    100
                                  );
                                }
                                return generalDiscount;
                              })()
                        }
                        onChange={(e) => {
                          const inputValue =
                            Number.parseFloat(e.target.value) || 0;
                          if (generalDiscountType === "monto") {
                            // Convertir a Bs según la moneda seleccionada (similar a delivery)
                            let valueInBs = inputValue;
                            if (generalDiscountCurrency !== "Bs") {
                              const rate =
                                generalDiscountCurrency === "USD"
                                  ? exchangeRates.USD?.rate
                                  : exchangeRates.EUR?.rate;
                              if (rate && rate > 0) {
                                valueInBs = inputValue * rate;
                              }
                            }
                            setGeneralDiscount(valueInBs);
                          } else {
                            handleGeneralDiscountChange(inputValue);
                          }
                        }}
                        placeholder={
                          generalDiscountType === "porcentaje" ? "0%" : "0.00"
                        }
                        disabled={selectedProducts.length === 0}
                        className="w-full sm:w-48"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Este descuento se aplica después de los descuentos
                      individuales por producto.
                    </p>
                  </div>

                  {/* 4. TIPO DE VENTA Y MÉTODO DE PAGO */}
                  <div className="space-y-4">
                    <Label className="text-sm sm:text-base">
                      Tipo de Venta
                    </Label>
                    <RadioGroup
                      value={saleType}
                      onValueChange={(
                        value: "apartado" | "entrega" | "contado"
                      ) => setSaleType(value)}
                      className="flex flex-col sm:flex-row sm:gap-4 gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="apartado" id="apartado" />
                        <Label
                          htmlFor="apartado"
                          className="text-sm sm:text-base cursor-pointer"
                        >
                          Apartado
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="entrega" id="entrega" />
                        <Label
                          htmlFor="entrega"
                          className="text-sm sm:text-base cursor-pointer"
                        >
                          Entrega
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="contado" id="contado" />
                        <Label
                          htmlFor="contado"
                          className="text-sm sm:text-base cursor-pointer"
                        >
                          De Contado
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Condición de Pago */}
                    <div className="space-y-2">
                      <Label htmlFor="paymentCondition" className="text-sm sm:text-base">
                        Condición de Pago <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={paymentCondition}
                        onValueChange={(value) =>
                          setPaymentCondition(
                            value as
                              | "cashea"
                              | "pagara_en_tienda"
                              | "pago_a_entrega"
                              | "pago_parcial"
                              | "todo_pago"
                              | ""
                          )
                        }
                      >
                        <SelectTrigger id="paymentCondition">
                          <SelectValue placeholder="Seleccione la condición de pago" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_CONDITIONS.map((condition) => (
                            <SelectItem key={condition.value} value={condition.value}>
                              {condition.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tipo de Compra */}
                    <div className="space-y-2">
                      <Label htmlFor="purchaseType" className="text-sm sm:text-base">
                        Tipo de Compra <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={purchaseType}
                        onValueChange={(value) =>
                          setPurchaseType(
                            value as
                              | "delivery_express"
                              | "encargo"
                              | "encargo_entrega"
                              | "entrega"
                              | "retiro_almacen"
                              | "retiro_tienda"
                              | "sa"
                              | ""
                          )
                        }
                      >
                        <SelectTrigger id="purchaseType">
                          <SelectValue placeholder="Seleccione el tipo de compra" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURCHASE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sección unificada de Pagos - funciona para todos los tipos de venta */}
                    <div className="space-y-4 pt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <Label className="text-sm sm:text-base">
                              Pagos
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addPayment}
                              className="w-full sm:w-auto"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar Pago
                            </Button>
                          </div>

                          {payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="space-y-3 sm:space-y-4 p-3 sm:p-4 border rounded-lg"
                            >
                              <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
                                {/* Método primero */}
                                <div className="flex-1 w-full">
                                  <Label className="text-xs">Método</Label>
                                  <Select
                                    value={payment.method}
                                    onValueChange={(value) => {
                                      updatePayment(
                                        payment.id,
                                        "method",
                                        value
                                      );
                                      // Si se cambia a un método diferente a Efectivo y había cashReceived, limpiarlo
                                      if (value !== "Efectivo") {
                                        updatePaymentDetails(
                                          payment.id,
                                          "cashReceived",
                                          0
                                        );
                                        updatePaymentDetails(
                                          payment.id,
                                          "cashCurrency",
                                          "Bs"
                                        );
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Método" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {paymentMethods.map((method) => (
                                        <SelectItem key={method} value={method}>
                                          {method}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {/* Fecha */}
                                <div className="flex-1 w-full">
                                  <Label className="text-xs">Fecha</Label>
                                  <Input
                                    type="date"
                                    value={payment.date}
                                    onChange={(e) =>
                                      updatePayment(
                                        payment.id,
                                        "date",
                                        e.target.value
                                      )
                                    }
                                    className="w-full"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePayment(payment.id)}
                                  className="w-full sm:w-auto self-end sm:self-auto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="ml-2 sm:hidden">
                                    Eliminar
                                  </span>
                                </Button>
                              </div>

                              {/* Campos condicionales según método de pago */}
                              {payment.method === "Pago Móvil" && (
                                <div className="space-y-3 pt-2 border-t">
                                  <Label className="text-sm font-medium">
                                    Información de Pago Móvil
                                  </Label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`pagomovil-currency-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Moneda *
                                      </Label>
                                      <Select
                                        value={
                                          payment.currency || preferredCurrency
                                        }
                                        onValueChange={(value: Currency) => {
                                          // Actualizar la moneda registrada
                                          updatePayment(
                                            payment.id,
                                            "currency",
                                            value
                                          );

                                          // Si hay un monto, recalcular el monto original en la nueva moneda
                                          if (payment.amount > 0) {
                                            let originalAmount = payment.amount;
                                            if (value !== "Bs") {
                                              const rate =
                                                value === "USD"
                                                  ? exchangeRates.USD?.rate
                                                  : exchangeRates.EUR?.rate;
                                              if (rate && rate > 0) {
                                                originalAmount =
                                                  payment.amount / rate;
                                                updatePaymentDetails(
                                                  payment.id,
                                                  "exchangeRate",
                                                  rate
                                                );
                                              }
                                            } else {
                                              // Si cambia a Bs, el monto original es el amount
                                              originalAmount = payment.amount;
                                            }
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalAmount",
                                              originalAmount
                                            );
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalCurrency",
                                              value
                                            );
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Bs">
                                            Bolívares (Bs)
                                          </SelectItem>
                                          <SelectItem value="USD">
                                            Dólares (USD)
                                          </SelectItem>
                                          <SelectItem value="EUR">
                                            Euros (EUR)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {/* Campo Monto después de Moneda */}
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`pagomovil-amount-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Monto *
                                      </Label>
                                      <Input
                                        id={`pagomovil-amount-${payment.id}`}
                                        type="number"
                                        step="0.01"
                                        value={(() => {
                                          if (payment.amount === 0) return "";
                                          // Si hay monto original guardado, usarlo
                                          if (
                                            payment.paymentDetails
                                              ?.originalAmount !== undefined
                                          ) {
                                            return payment.paymentDetails
                                              .originalAmount;
                                          }
                                          // Fallback: calcular desde payment.amount
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();
                                          if (paymentCurrency === "Bs") {
                                            return payment.amount;
                                          }
                                          const rate =
                                            paymentCurrency === "USD"
                                              ? exchangeRates.USD?.rate
                                              : exchangeRates.EUR?.rate;
                                          if (rate && rate > 0) {
                                            return payment.amount / rate;
                                          }
                                          return payment.amount;
                                        })()}
                                        onChange={(e) => {
                                          const inputValue =
                                            Number.parseFloat(e.target.value) ||
                                            0;
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();

                                          // Guardar el monto original en la moneda del pago
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalAmount",
                                            inputValue
                                          );
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalCurrency",
                                            paymentCurrency
                                          );

                                          // Convertir a Bs según la moneda seleccionada
                                          let valueInBs = inputValue;
                                          if (paymentCurrency !== "Bs") {
                                            const rate =
                                              paymentCurrency === "USD"
                                                ? exchangeRates.USD?.rate
                                                : exchangeRates.EUR?.rate;
                                            if (rate && rate > 0) {
                                              valueInBs = inputValue * rate;
                                              // Guardar la tasa de cambio usada
                                              updatePaymentDetails(
                                                payment.id,
                                                "exchangeRate",
                                                rate
                                              );
                                            }
                                          }
                                          updatePayment(
                                            payment.id,
                                            "amount",
                                            valueInBs
                                          );
                                        }}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`pagomovil-reference-${payment.id}`}
                                        className="text-xs"
                                      >
                                        N° Referencia *
                                      </Label>
                                      <Input
                                        id={`pagomovil-reference-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilReference || ""
                                        }
                                        onChange={(e) =>
                                          updatePaymentDetails(
                                            payment.id,
                                            "pagomovilReference",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Ingrese el número de referencia"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`pagomovil-bank-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Banco Emisor *
                                      </Label>
                                      <Input
                                        id={`pagomovil-bank-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilBank || ""
                                        }
                                        onChange={(e) =>
                                          updatePaymentDetails(
                                            payment.id,
                                            "pagomovilBank",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Ej: Banco de Venezuela"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`pagomovil-phone-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Teléfono *
                                      </Label>
                                      <Input
                                        id={`pagomovil-phone-${payment.id}`}
                                        type="tel"
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilPhone || ""
                                        }
                                        onChange={(e) =>
                                          updatePaymentDetails(
                                            payment.id,
                                            "pagomovilPhone",
                                            e.target.value
                                          )
                                        }
                                        placeholder="0412-1234567"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {payment.method === "Transferencia" && (
                                <div className="space-y-3 pt-2 border-t">
                                  <Label className="text-sm font-medium">
                                    Información de Transferencia
                                  </Label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`transferencia-currency-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Moneda *
                                      </Label>
                                      <Select
                                        value={
                                          payment.currency || preferredCurrency
                                        }
                                        onValueChange={(value: Currency) => {
                                          // Actualizar la moneda registrada
                                          updatePayment(
                                            payment.id,
                                            "currency",
                                            value
                                          );

                                          // Si hay un monto, recalcular el monto original en la nueva moneda
                                          if (payment.amount > 0) {
                                            let originalAmount = payment.amount;
                                            if (value !== "Bs") {
                                              const rate =
                                                value === "USD"
                                                  ? exchangeRates.USD?.rate
                                                  : exchangeRates.EUR?.rate;
                                              if (rate && rate > 0) {
                                                originalAmount =
                                                  payment.amount / rate;
                                                updatePaymentDetails(
                                                  payment.id,
                                                  "exchangeRate",
                                                  rate
                                                );
                                              }
                                            } else {
                                              // Si cambia a Bs, el monto original es el amount
                                              originalAmount = payment.amount;
                                            }
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalAmount",
                                              originalAmount
                                            );
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalCurrency",
                                              value
                                            );
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Bs">
                                            Bolívares (Bs)
                                          </SelectItem>
                                          <SelectItem value="USD">
                                            Dólares (USD)
                                          </SelectItem>
                                          <SelectItem value="EUR">
                                            Euros (EUR)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {/* Campo Monto después de Moneda */}
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`transferencia-amount-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Monto *
                                      </Label>
                                      <Input
                                        id={`transferencia-amount-${payment.id}`}
                                        type="number"
                                        step="0.01"
                                        value={(() => {
                                          if (payment.amount === 0) return "";
                                          // Si hay monto original guardado, usarlo
                                          if (
                                            payment.paymentDetails
                                              ?.originalAmount !== undefined
                                          ) {
                                            return payment.paymentDetails
                                              .originalAmount;
                                          }
                                          // Fallback: calcular desde payment.amount
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();
                                          if (paymentCurrency === "Bs") {
                                            return payment.amount;
                                          }
                                          const rate =
                                            paymentCurrency === "USD"
                                              ? exchangeRates.USD?.rate
                                              : exchangeRates.EUR?.rate;
                                          if (rate && rate > 0) {
                                            return payment.amount / rate;
                                          }
                                          return payment.amount;
                                        })()}
                                        onChange={(e) => {
                                          const inputValue =
                                            Number.parseFloat(e.target.value) ||
                                            0;
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();

                                          // Guardar el monto original en la moneda del pago
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalAmount",
                                            inputValue
                                          );
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalCurrency",
                                            paymentCurrency
                                          );

                                          // Convertir a Bs según la moneda seleccionada
                                          let valueInBs = inputValue;
                                          if (paymentCurrency !== "Bs") {
                                            const rate =
                                              paymentCurrency === "USD"
                                                ? exchangeRates.USD?.rate
                                                : exchangeRates.EUR?.rate;
                                            if (rate && rate > 0) {
                                              valueInBs = inputValue * rate;
                                              // Guardar la tasa de cambio usada
                                              updatePaymentDetails(
                                                payment.id,
                                                "exchangeRate",
                                                rate
                                              );
                                            }
                                          }
                                          updatePayment(
                                            payment.id,
                                            "amount",
                                            valueInBs
                                          );
                                        }}
                                        placeholder="0.00"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`transferencia-bank-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Banco *
                                      </Label>
                                      <Input
                                        id={`transferencia-bank-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.transferenciaBank || ""
                                        }
                                        onChange={(e) =>
                                          updatePaymentDetails(
                                            payment.id,
                                            "transferenciaBank",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Ej: Banco de Venezuela"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`transferencia-reference-${payment.id}`}
                                        className="text-xs"
                                      >
                                        N° de Referencia *
                                      </Label>
                                      <Input
                                        id={`transferencia-reference-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.transferenciaReference || ""
                                        }
                                        onChange={(e) =>
                                          updatePaymentDetails(
                                            payment.id,
                                            "transferenciaReference",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Ingrese el número de referencia"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Sección genérica para métodos que solo necesitan Moneda y Monto */}
                              {!["Pago Móvil", "Transferencia", "Efectivo"].includes(payment.method) && (
                                <div className="space-y-3 pt-2 border-t">
                                  <Label className="text-sm font-medium">
                                    Información de {payment.method}
                                  </Label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-currency-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Moneda *
                                      </Label>
                                      <Select
                                        value={
                                          payment.currency || preferredCurrency
                                        }
                                        onValueChange={(value: Currency) => {
                                          // Actualizar la moneda registrada
                                          updatePayment(
                                            payment.id,
                                            "currency",
                                            value
                                          );

                                          // Si hay un monto, recalcular el monto original en la nueva moneda
                                          if (payment.amount > 0) {
                                            let originalAmount = payment.amount;
                                            if (value !== "Bs") {
                                              const rate =
                                                value === "USD"
                                                  ? exchangeRates.USD?.rate
                                                  : exchangeRates.EUR?.rate;
                                              if (rate && rate > 0) {
                                                originalAmount =
                                                  payment.amount / rate;
                                                updatePaymentDetails(
                                                  payment.id,
                                                  "exchangeRate",
                                                  rate
                                                );
                                              }
                                            } else {
                                              // Si cambia a Bs, el monto original es el amount
                                              originalAmount = payment.amount;
                                            }
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalAmount",
                                              originalAmount
                                            );
                                            updatePaymentDetails(
                                              payment.id,
                                              "originalCurrency",
                                              value
                                            );
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Bs">
                                            Bolívares (Bs)
                                          </SelectItem>
                                          <SelectItem value="USD">
                                            Dólares (USD)
                                          </SelectItem>
                                          <SelectItem value="EUR">
                                            Euros (EUR)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-amount-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Monto *
                                      </Label>
                                      <Input
                                        id={`${payment.method.toLowerCase().replace(/\s+/g, '-')}-amount-${payment.id}`}
                                        type="number"
                                        step="0.01"
                                        value={(() => {
                                          if (payment.amount === 0) return "";
                                          // Si hay monto original guardado, usarlo
                                          if (
                                            payment.paymentDetails
                                              ?.originalAmount !== undefined
                                          ) {
                                            return payment.paymentDetails
                                              .originalAmount;
                                          }
                                          // Fallback: calcular desde payment.amount
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();
                                          if (paymentCurrency === "Bs") {
                                            return payment.amount;
                                          }
                                          const rate =
                                            paymentCurrency === "USD"
                                              ? exchangeRates.USD?.rate
                                              : exchangeRates.EUR?.rate;
                                          if (rate && rate > 0) {
                                            return payment.amount / rate;
                                          }
                                          return payment.amount;
                                        })()}
                                        onChange={(e) => {
                                          const inputValue =
                                            Number.parseFloat(e.target.value) ||
                                            0;
                                          const paymentCurrency =
                                            payment.currency || getDefaultCurrencyFromSelection();

                                          // Guardar el monto original en la moneda del pago
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalAmount",
                                            inputValue
                                          );
                                          updatePaymentDetails(
                                            payment.id,
                                            "originalCurrency",
                                            paymentCurrency
                                          );

                                          // Convertir a Bs según la moneda seleccionada
                                          let valueInBs = inputValue;
                                          if (paymentCurrency !== "Bs") {
                                            const rate =
                                              paymentCurrency === "USD"
                                                ? exchangeRates.USD?.rate
                                                : exchangeRates.EUR?.rate;
                                            if (rate && rate > 0) {
                                              valueInBs = inputValue * rate;
                                              // Guardar la tasa de cambio usada
                                              updatePaymentDetails(
                                                payment.id,
                                                "exchangeRate",
                                                rate
                                              );
                                            }
                                          }
                                          updatePayment(
                                            payment.id,
                                            "amount",
                                            valueInBs
                                          );
                                        }}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {payment.method === "Efectivo" && (
                                <div className="space-y-3 pt-2 border-t">
                                  <Label className="text-sm font-medium">
                                    Información de Pago en Efectivo
                                  </Label>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`cash-currency-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Moneda *
                                      </Label>
                                      <Select
                                        value={
                                          payment.paymentDetails
                                            ?.cashCurrency || preferredCurrency
                                        }
                                        onValueChange={(value: Currency) => {
                                          // Actualizar cashCurrency
                                          updatePaymentDetails(
                                            payment.id,
                                            "cashCurrency",
                                            value
                                          );

                                          // ACTUALIZAR payment.currency también
                                          updatePayment(
                                            payment.id,
                                            "currency",
                                            value
                                          );

                                          // Actualizar la tasa de cambio si es necesario
                                          const rate =
                                            value !== "Bs" &&
                                            exchangeRates[value]
                                              ? exchangeRates[value]?.rate || 1
                                              : 1;

                                          if (value !== "Bs") {
                                            updatePaymentDetails(
                                              payment.id,
                                              "exchangeRate",
                                              rate
                                            );
                                          }

                                          // Recalcular el amount en Bs basado en cashReceived
                                          const cashReceived =
                                            payment.paymentDetails
                                              ?.cashReceived || 0;
                                          if (cashReceived > 0) {
                                            const amountInBs =
                                              value === "Bs"
                                                ? cashReceived
                                                : cashReceived * rate;
                                            updatePayment(
                                              payment.id,
                                              "amount",
                                              amountInBs
                                            );
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Bs">
                                            Bolívares (Bs)
                                          </SelectItem>
                                          <SelectItem value="USD">
                                            Dólares (USD)
                                          </SelectItem>
                                          <SelectItem value="EUR">
                                            Euros (EUR)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`cash-received-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Monto recibido del cliente *
                                      </Label>
                                      <Input
                                        id={`cash-received-${payment.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={
                                          payment.paymentDetails
                                            ?.cashReceived || ""
                                        }
                                        onChange={(e) => {
                                          const received =
                                            parseFloat(e.target.value) || 0;

                                          // Guardar el monto recibido
                                          updatePaymentDetails(
                                            payment.id,
                                            "cashReceived",
                                            received
                                          );

                                          // Calcular y actualizar el amount en Bs automáticamente
                                          const currency =
                                            payment.paymentDetails
                                              ?.cashCurrency || "Bs";
                                          const rate =
                                            currency !== "Bs"
                                              ? payment.paymentDetails
                                                  ?.exchangeRate ||
                                                exchangeRates[currency]?.rate ||
                                                1
                                              : 1;

                                          // El amount siempre se guarda en Bs
                                          const amountInBs =
                                            currency === "Bs"
                                              ? received
                                              : received * rate;

                                          updatePayment(
                                            payment.id,
                                            "amount",
                                            amountInBs
                                          );

                                          // Guardar/actualizar la tasa si no está guardada
                                          if (
                                            currency !== "Bs" &&
                                            !payment.paymentDetails
                                              ?.exchangeRate
                                          ) {
                                            updatePaymentDetails(
                                              payment.id,
                                              "exchangeRate",
                                              exchangeRates[currency]?.rate || 1
                                            );
                                          }
                                        }}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                  {payment.paymentDetails?.cashReceived &&
                                    payment.paymentDetails.cashReceived > 0 && (
                                      <>
                                        {/* Mostrar el monto del pago calculado */}
                                        <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-sm">
                                          <span className="font-medium">
                                            Monto del pago:{" "}
                                          </span>
                                          {formatCurrency(payment.amount, "Bs")}{" "}
                                          {(() => {
                                            const currency =
                                              payment.paymentDetails
                                                ?.cashCurrency;
                                            if (currency && currency !== "Bs") {
                                              return (
                                                <span className="text-xs text-muted-foreground">
                                                  (
                                                  {formatCurrency(
                                                    payment.amount /
                                                      (payment.paymentDetails
                                                        ?.exchangeRate || 1),
                                                    currency
                                                  )}
                                                  )
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>

                                        {/* Mostrar cambio si el cliente pagó más */}
                                        {(() => {
                                          const paymentAmountInCurrency =
                                            payment.paymentDetails
                                              .cashCurrency === "Bs"
                                              ? payment.amount
                                              : payment.amount /
                                                (payment.paymentDetails
                                                  .exchangeRate || 1);

                                          if (
                                            payment.paymentDetails
                                              .cashReceived >
                                            paymentAmountInCurrency
                                          ) {
                                            return (
                                              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                                                <span className="font-medium">
                                                  Cambio/Vuelto:{" "}
                                                </span>
                                                {formatCurrency(
                                                  payment.paymentDetails
                                                    .cashReceived -
                                                    paymentAmountInCurrency,
                                                  payment.paymentDetails
                                                    .cashCurrency as Currency
                                                )}
                                              </div>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </>
                                    )}
                                  {payment.paymentDetails?.cashCurrency &&
                                    payment.paymentDetails.cashCurrency !==
                                      "Bs" && (
                                      <p className="text-xs text-muted-foreground">
                                        Tasa usada: 1{" "}
                                        {payment.paymentDetails.cashCurrency} ={" "}
                                        {payment.paymentDetails.exchangeRate?.toFixed(
                                          2
                                        ) || "N/A"}{" "}
                                        Bs
                                      </p>
                                    )}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Tabla de resumen de pagos - Similar a la tabla de totales */}
                          {showCurrencyTable &&
                            selectedCurrencies.length > 0 && (
                              <div className="mt-4 overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[200px]">
                                        Concepto
                                      </TableHead>
                                      {getCurrencyOrder().map((currency) => {
                                        if (
                                          selectedCurrencies.includes(currency)
                                        ) {
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
                                        <span
                                          className={
                                            isPaymentsValid
                                              ? "text-green-600 font-semibold"
                                              : "font-semibold"
                                          }
                                        >
                                          Total pagado:
                                        </span>
                                      </TableCell>
                                      {renderCurrencyCells(
                                        totalPaidInBs,
                                        isPaymentsValid
                                          ? "text-green-600 font-semibold"
                                          : "font-semibold"
                                      )}
                                    </TableRow>

                                    {/* Total del pedido */}
                                    <TableRow>
                                      <TableCell className="text-xs sm:text-sm">
                                        Total del pedido:
                                      </TableCell>
                                      {renderCurrencyCells(total)}
                                    </TableRow>

                                    {/* Falta / Cambio / Estado */}
                                    <TableRow
                                      className={`font-semibold border-t ${
                                        isPaymentsValid
                                          ? "text-green-600"
                                          : remainingAmount > 0
                                          ? "text-orange-600"
                                          : "text-blue-600"
                                      }`}
                                    >
                                      <TableCell className="text-sm sm:text-base">
                                        {remainingAmount === 0
                                          ? "Estado:"
                                          : remainingAmount > 0
                                          ? "Falta:"
                                          : "Cambio/Vuelto:"}
                                      </TableCell>
                                      {renderCurrencyCells(
                                        Math.abs(remainingAmount),
                                        `text-sm sm:text-base font-semibold ${
                                          isPaymentsValid
                                            ? "text-green-600"
                                            : remainingAmount > 0
                                            ? "text-orange-600"
                                            : "text-blue-600"
                                        }`
                                      )}
                                    </TableRow>
                                  </TableBody>
                                </Table>
                                {isPaymentsValid && (
                                  <p className="text-xs text-green-600 text-center mt-2">
                                    (Pagado completo)
                                  </p>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. OBSERVACIONES */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="generalObservations"
                      className="text-sm sm:text-base"
                    >
                      Observaciones Generales <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="generalObservations"
                      value={generalObservations}
                      onChange={(e) => setGeneralObservations(e.target.value)}
                      placeholder="Agregar observaciones generales para el pedido (obligatorio)"
                      rows={3}
                      className="w-full"
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Notas generales sobre el pedido
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-2 sm:pt-0">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            {currentStep < 2 ? (
              <Button
                onClick={handleNext}
                className="w-full sm:w-auto"
                disabled={!canGoToNextStep}
                title={
                  !formData.vendor &&
                  !selectedClient &&
                  selectedProducts.length === 0
                    ? "Selecciona vendedor, cliente y al menos un producto para continuar"
                    : !formData.vendor && !selectedClient
                    ? "Selecciona vendedor y cliente para continuar"
                    : !formData.vendor && selectedProducts.length === 0
                    ? "Selecciona vendedor y al menos un producto para continuar"
                    : !selectedClient && selectedProducts.length === 0
                    ? "Selecciona cliente y al menos un producto para continuar"
                    : !formData.vendor
                    ? "Selecciona un vendedor para continuar"
                    : !selectedClient
                    ? "Selecciona un cliente para continuar"
                    : selectedProducts.length === 0
                    ? "Agrega al menos un producto para continuar"
                    : ""
                }
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="w-full sm:w-auto">
                Crear Pedido
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ClientLookupDialog
        open={isClientLookupOpen}
        onOpenChange={setIsClientLookupOpen}
        onClientSelect={(client) => {
          setSelectedClient(client);
          // Si hay delivery activo y el cliente tiene dirección, cargarla por defecto
          if (hasDelivery && client.address) {
            setFormData((prev) => ({
              ...prev,
              deliveryAddress: client.address || prev.deliveryAddress,
            }));
          }
        }}
      />

      <ProductSelectionDialog
        open={isProductSelectionOpen}
        onOpenChange={setIsProductSelectionOpen}
        onProductsSelect={handleProductsSelect}
        selectedProducts={selectedProducts}
      />

      <ProductEditDialog
        open={isProductEditOpen}
        onOpenChange={setIsProductEditOpen}
        product={editingProduct}
        onProductUpdate={handleUpdateProduct}
      />

      <RemoveProductDialog
        open={isRemoveProductOpen}
        onOpenChange={setIsRemoveProductOpen}
        product={productToRemove as OrderProduct | null}
        onConfirm={confirmRemoveProduct}
      />

      {pendingOrderData && (
        <OrderConfirmationDialog
          open={isConfirmationOpen}
          onOpenChange={setIsConfirmationOpen}
          onConfirm={handleConfirmOrder}
          onCancel={() => {
            setIsConfirmationOpen(false);
            setPendingOrderData(null);
          }}
          orderData={pendingOrderData}
        />
      )}
    </>
  );
}
