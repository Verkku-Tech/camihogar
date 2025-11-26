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
import { ClientLookupDialog } from "@/components/orders/client-lookup-dialog";
import { ProductSelectionDialog } from "@/components/orders/product-selection-dialog";
import { ProductEditDialog } from "@/components/orders/product-edit-dialog";
import { RemoveProductDialog } from "@/components/orders/remove-product-dialog";
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
  type Order,
  type OrderProduct,
  type PartialPayment,
  type Vendor,
  type Category,
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

const paymentMethods = [
  "Pago Móvil",
  "Efectivo",
  "Débito",
  "Crédito",
  "Cashea",
  "Transferencia", // Agregar si no está
];

export function NewOrderDialog({ open, onOpenChange }: NewOrderDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    address?: string;
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
  const [payments, setPayments] = useState<PartialPayment[]>([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState(0);
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false); // Added supplier order flag
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referrers, setReferrers] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{
    USD?: ExchangeRate;
    EUR?: ExchangeRate;
  }>({});

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
    if (open) {
      loadVendorsAndReferrers();
      loadCategories();
      loadExchangeRates();
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
  const [productDiscountTypes, setProductDiscountTypes] = useState<
    Record<string, "monto" | "porcentaje">
  >({});
  const [generalObservations, setGeneralObservations] = useState("");

  const getProductBaseTotal = (product: OrderProduct) => {
    const markup = productMarkups[product.id] || 0;
    // El product.total ya debería incluir los ajustes de atributos
    // pero lo recalculamos para asegurarnos de que esté correcto
    const category = categories.find((cat) => cat.name === product.category);
    const recalculatedTotal = calculateProductTotalWithAttributes(
      product.price,
      product.quantity,
      product.attributes,
      category
    );
    // Usar el total recalculado si es diferente (puede haber cambios en atributos)
    // o usar el total guardado si no hay categoría disponible
    const baseTotal = category ? recalculatedTotal : product.total;
    return baseTotal + markup;
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
  const calculateTotalPaidInBs = async (): Promise<number> => {
    let totalInBs = 0;

    for (const payment of payments) {
      if (
        payment.paymentDetails?.cashCurrency &&
        payment.paymentDetails.cashCurrency !== "Bs"
      ) {
        // Convertir pago en moneda extranjera a Bs
        const rate =
          payment.paymentDetails.exchangeRate ||
          exchangeRates[payment.paymentDetails.cashCurrency]?.rate;
        if (rate && rate > 0) {
          totalInBs += payment.amount * rate;
        } else {
          totalInBs += payment.amount;
        }
      } else {
        totalInBs += payment.amount;
      }
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
    products.forEach((product) => {
      if (!productDiscountTypes[product.id]) {
        newTypes[product.id] = "monto";
      }
    });
    if (Object.keys(newTypes).length > 0) {
      setProductDiscountTypes((prev) => ({ ...prev, ...newTypes }));
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

        let discountAmount: number;
        if (discountType === "porcentaje") {
          // Convertir porcentaje a monto y limitarlo al baseTotal
          const percentage = Math.max(0, Math.min(value, 100));
          discountAmount = (baseTotal * percentage) / 100;
        } else {
          // Monto directo
          discountAmount = Math.max(0, Math.min(value, baseTotal));
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
      // Monto directo
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
        alert("Por favor selecciona un vendedor");
        return;
      }

      if (!selectedClient) {
        alert("Por favor selecciona un cliente");
        return;
      }

      if (selectedProducts.length === 0) {
        alert("Por favor agrega al menos un producto");
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
        alert("Por favor selecciona un cliente");
        return;
      }

      if (selectedProducts.length === 0) {
        alert("Por favor agrega al menos un producto");
        return;
      }

      // Validar pagos
      if (payments.length === 0) {
        alert("Por favor agrega al menos un pago");
        return;
      }

      if (!isPaymentsValid && saleType === "contado") {
        // Para contado, el total debe ser igual al pedido
        alert(
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
        saleType, // Nuevo campo
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
      };

      await addOrder(orderData);

      // Mostrar mensaje de éxito
      //alert("Pedido creado exitosamente");

      // Reset y cerrar
      onOpenChange(false);
      setCurrentStep(1);
      setSelectedClient(null);
      setSelectedProducts([]);
      setPayments([]);
      setDeliveryExpenses(0);
      setHasDelivery(false);
      setProductMarkups({});
      setGeneralDiscount(0);
      setGeneralDiscountType("monto");
      setProductDiscountTypes({});
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
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Error al crear el pedido. Por favor intenta nuevamente.");
    }
  };

  // Funciones unificadas para manejar pagos (funciona para todos los tipos de venta)
  const addPayment = () => {
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      paymentDetails: {},
    };
    setPayments([...payments, newPayment]);
  };

  const updatePayment = (
    id: string,
    field: keyof PartialPayment,
    value: string | number
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

  const hasOutOfStockProducts = () => {
    return selectedProducts.some((product) => product.quantity > product.stock);
  };

  const getOutOfStockProducts = () => {
    return selectedProducts.filter(
      (product) => product.quantity > product.stock
    );
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

                    {hasOutOfStockProducts() && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">
                            Productos sin inventario suficiente
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-yellow-700">
                          Los siguientes productos no tienen inventario
                          suficiente:
                          <ul className="mt-1 ml-4 list-disc">
                            {getOutOfStockProducts().map((product) => (
                              <li key={product.id}>
                                {product.name} - Solicitado: {product.quantity},
                                Disponible: {product.stock}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3 flex items-center space-x-2">
                          <Checkbox
                            id="supplier-order"
                            checked={createSupplierOrder}
                            onCheckedChange={(checked) =>
                              setCreateSupplierOrder(checked as boolean)
                            }
                          />
                          <Label
                            htmlFor="supplier-order"
                            className="text-sm font-medium"
                          >
                            Crear pedido a proveedor para productos faltantes
                          </Label>
                        </div>
                      </div>
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
                                      {product.quantity > product.stock && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs mt-1"
                                        >
                                          Sin stock
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-semibold">
                                        ${finalTotal.toFixed(2)}
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
                                        ${product.price.toFixed(2)}
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
                                        Stock:
                                      </span>
                                      <span
                                        className={`ml-2 font-medium ${
                                          product.quantity > product.stock
                                            ? "text-red-600"
                                            : ""
                                        }`}
                                      >
                                        {product.stock}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        Subtotal:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        ${baseTotal.toFixed(2)}
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
                                      <Input
                                        type="number"
                                        min="0"
                                        step={
                                          productDiscountTypes[product.id] ===
                                          "porcentaje"
                                            ? "0.1"
                                            : "0.01"
                                        }
                                        max={
                                          productDiscountTypes[product.id] ===
                                          "porcentaje"
                                            ? 100
                                            : baseTotal
                                        }
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
                                            return percentage;
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
                                        className="flex-1"
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
                                  <TableHead className="w-[8%]">
                                    Cantidad
                                  </TableHead>
                                  <TableHead className="w-[8%]">
                                    Stock
                                  </TableHead>
                                  <TableHead className="w-[10%]">
                                    Subtotal
                                  </TableHead>
                                  <TableHead className="w-[18%]">
                                    Descuento
                                  </TableHead>
                                  <TableHead className="w-[10%]">
                                    Total final
                                  </TableHead>
                                  <TableHead className="w-[16%] text-right">
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
                                          {product.quantity > product.stock && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs shrink-0"
                                            >
                                              Sin stock
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="w-[10%] text-right text-sm">
                                        ${product.price.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="w-[8%] text-center text-sm">
                                        {product.quantity}
                                      </TableCell>
                                      <TableCell className="w-[8%] text-center text-sm">
                                        <span
                                          className={
                                            product.quantity > product.stock
                                              ? "text-red-600 font-medium"
                                              : ""
                                          }
                                        >
                                          {product.stock}
                                        </span>
                                      </TableCell>
                                      <TableCell className="w-[10%] text-right text-sm">
                                        ${baseTotal.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="w-[18%]">
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
                                          <Input
                                            type="number"
                                            min="0"
                                            step={
                                              productDiscountTypes[
                                                product.id
                                              ] === "porcentaje"
                                                ? "0.1"
                                                : "0.01"
                                            }
                                            max={
                                              productDiscountTypes[
                                                product.id
                                              ] === "porcentaje"
                                                ? 100
                                                : baseTotal
                                            }
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
                                                return percentage;
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
                                            className="w-full h-7 text-xs flex-1"
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
                                        ${finalTotal.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="w-[16%] text-right">
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
                          ${subtotal.toFixed(2)}
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
                        <Label
                          htmlFor="deliveryExpenses"
                          className="text-sm sm:text-base"
                        >
                          Gastos de Entrega ($)
                        </Label>
                        <Input
                          id="deliveryExpenses"
                          type="number"
                          step="0.01"
                          value={deliveryExpenses === 0 ? "" : deliveryExpenses}
                          onChange={(e) =>
                            setDeliveryExpenses(
                              Number.parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* 2. TOTALIZACIÓN */}
                  <div className="p-3 sm:p-4 bg-muted rounded-lg">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">
                              Concepto
                            </TableHead>
                            <TableHead className="text-right">Bs</TableHead>
                            <TableHead className="text-right">USD</TableHead>
                            <TableHead className="text-right">EUR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Subtotal productos */}
                          <TableRow>
                            <TableCell className="text-xs sm:text-sm">
                              Subtotal productos:
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(productSubtotal, "Bs")}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.USD?.rate
                                ? formatCurrency(
                                    productSubtotal / exchangeRates.USD.rate,
                                    "USD"
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.EUR?.rate
                                ? formatCurrency(
                                    productSubtotal / exchangeRates.EUR.rate,
                                    "EUR"
                                  )
                                : "-"}
                            </TableCell>
                          </TableRow>

                          {/* Descuentos individuales */}
                          {productDiscountTotal > 0 && (
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm text-red-600">
                                Descuentos individuales:
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                - {formatCurrency(productDiscountTotal, "Bs")}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                {exchangeRates.USD?.rate
                                  ? `- ${formatCurrency(
                                      productDiscountTotal /
                                        exchangeRates.USD.rate,
                                      "USD"
                                    )}`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                {exchangeRates.EUR?.rate
                                  ? `- ${formatCurrency(
                                      productDiscountTotal /
                                        exchangeRates.EUR.rate,
                                      "EUR"
                                    )}`
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          )}

                          {/* Descuento general */}
                          {generalDiscountAmount > 0 && (
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm text-red-600">
                                Descuento general:
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                - {formatCurrency(generalDiscountAmount, "Bs")}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                {exchangeRates.USD?.rate
                                  ? `- ${formatCurrency(
                                      generalDiscountAmount /
                                        exchangeRates.USD.rate,
                                      "USD"
                                    )}`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm text-red-600">
                                {exchangeRates.EUR?.rate
                                  ? `- ${formatCurrency(
                                      generalDiscountAmount /
                                        exchangeRates.EUR.rate,
                                      "EUR"
                                    )}`
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          )}

                          {/* Subtotal después de descuentos */}
                          <TableRow className="font-medium border-t">
                            <TableCell className="text-xs sm:text-sm">
                              Subtotal después de descuentos:
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(subtotal, "Bs")}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.USD?.rate
                                ? formatCurrency(
                                    subtotal / exchangeRates.USD.rate,
                                    "USD"
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.EUR?.rate
                                ? formatCurrency(
                                    subtotal / exchangeRates.EUR.rate,
                                    "EUR"
                                  )
                                : "-"}
                            </TableCell>
                          </TableRow>

                          {/* Impuesto */}
                          <TableRow>
                            <TableCell className="text-xs sm:text-sm">
                              Impuesto (16%):
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {formatCurrency(taxAmount, "Bs")}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.USD?.rate
                                ? formatCurrency(
                                    taxAmount / exchangeRates.USD.rate,
                                    "USD"
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {exchangeRates.EUR?.rate
                                ? formatCurrency(
                                    taxAmount / exchangeRates.EUR.rate,
                                    "EUR"
                                  )
                                : "-"}
                            </TableCell>
                          </TableRow>

                          {/* Gastos de entrega */}
                          {hasDelivery && (
                            <TableRow>
                              <TableCell className="text-xs sm:text-sm">
                                Gastos de entrega:
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm">
                                {formatCurrency(deliveryCost, "Bs")}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm">
                                {exchangeRates.USD?.rate
                                  ? formatCurrency(
                                      deliveryCost / exchangeRates.USD.rate,
                                      "USD"
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm">
                                {exchangeRates.EUR?.rate
                                  ? formatCurrency(
                                      deliveryCost / exchangeRates.EUR.rate,
                                      "EUR"
                                    )
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          )}

                          {/* Total */}
                          <TableRow className="font-semibold border-t-2">
                            <TableCell className="text-base sm:text-lg">
                              Total:
                            </TableCell>
                            <TableCell className="text-right text-base sm:text-lg">
                              {formatCurrency(total, "Bs")}
                            </TableCell>
                            <TableCell className="text-right text-base sm:text-lg">
                              {exchangeRates.USD?.rate
                                ? formatCurrency(
                                    total / exchangeRates.USD.rate,
                                    "USD"
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right text-base sm:text-lg">
                              {exchangeRates.EUR?.rate
                                ? formatCurrency(
                                    total / exchangeRates.EUR.rate,
                                    "EUR"
                                  )
                                : "-"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
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
                      <Input
                        id="generalDiscount"
                        type="number"
                        min="0"
                        step={
                          generalDiscountType === "porcentaje" ? "0.1" : "0.01"
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
                              ? (generalDiscount /
                                  subtotalAfterProductDiscounts) *
                                100
                              : 0
                            : generalDiscount
                        }
                        onChange={(e) =>
                          handleGeneralDiscountChange(
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
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
                                {/* Solo mostrar campo Monto si NO es Efectivo */}
                                {payment.method !== "Efectivo" && (
                                  <div className="flex-1 w-full">
                                    <Label className="text-xs">Monto</Label>
                                    <Input
                                      type="number"
                                      value={
                                        payment.amount === 0
                                          ? ""
                                          : payment.amount
                                      }
                                      onChange={(e) =>
                                        updatePayment(
                                          payment.id,
                                          "amount",
                                          Number.parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full"
                                    />
                                  </div>
                                )}
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
                                            ?.cashCurrency || "Bs"
                                        }
                                        onValueChange={(value: Currency) => {
                                          updatePaymentDetails(
                                            payment.id,
                                            "cashCurrency",
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

                          <div className="p-3 sm:p-4 bg-muted rounded-lg space-y-2 mt-4">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Total pagado:</span>
                              <span
                                className={
                                  isPaymentsValid
                                    ? "text-green-600 font-semibold"
                                    : "text-orange-600 font-semibold"
                                }
                              >
                                {formatCurrency(totalPaidInBs, "Bs")}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Total del pedido:</span>
                              <span>{formatCurrency(total, "Bs")}</span>
                            </div>
                            <div className="flex justify-between text-sm sm:text-base font-semibold">
                              <span className="break-words">
                                {remainingAmount === 0
                                  ? "Estado:"
                                  : remainingAmount > 0
                                  ? "Falta:"
                                  : "Cambio/Vuelto:"}
                              </span>
                              <span
                                className={`${
                                  isPaymentsValid
                                    ? "text-green-600"
                                    : remainingAmount > 0
                                    ? "text-orange-600"
                                    : "text-blue-600"
                                } text-right ml-2`}
                              >
                                {formatCurrency(
                                  Math.abs(remainingAmount),
                                  "Bs"
                                )}
                                {isPaymentsValid && (
                                  <span className="text-xs ml-2 block sm:inline">
                                    (Pagado completo)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
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
                      Observaciones Generales
                    </Label>
                    <Textarea
                      id="generalObservations"
                      value={generalObservations}
                      onChange={(e) => setGeneralObservations(e.target.value)}
                      placeholder="Agregar observaciones generales para el pedido (opcional)"
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
        product={productToRemove}
        onConfirm={confirmRemoveProduct}
      />
    </>
  );
}
