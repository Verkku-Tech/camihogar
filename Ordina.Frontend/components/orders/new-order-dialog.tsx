"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useOrderForm } from "./hooks/use-order-form";
import { Step1Budget } from "./steps/step-1-budget";
import { Step2ProductStatus } from "./steps/step-2-product-status";
import { Step3OrderDetails } from "./steps/step-3-order-details";
import { ClientLookupDialog } from "./client-lookup-dialog";
import { ProductSelectionDialog } from "./product-selection-dialog";
import { ProductEditDialog } from "./product-edit-dialog";
import { RemoveProductDialog } from "./remove-product-dialog";
import { OrderConfirmationDialog } from "./order-confirmation-dialog";
import {
  addOrder,
  addBudget,
  type Order,
  type OrderProduct,
  type PartialPayment,
  type ProductImage,
  type Account,
} from "@/lib/storage";
import { Currency } from "@/lib/currency-utils";
import { useCurrency } from "@/contexts/currency-context";

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Constantes
export const PAYMENT_CONDITIONS = [
  { value: "cashea", label: "Cashea" },
  { value: "pagara_en_tienda", label: "Pagará en Tienda" },
  { value: "pago_a_entrega", label: "Pago a la entrega" },
  { value: "pago_parcial", label: "Pago Parcial" },
  { value: "todo_pago", label: "Todo Pago" },
] as const;

export const PURCHASE_TYPES = [
  { value: "encargo", label: "Encargo" },
  { value: "entrega", label: "Entrega" },
  { value: "sistema_apartado", label: "Sistema de Apartado" },
] as const;

export const DELIVERY_TYPES = [
  { value: "entrega_programada", label: "Entrega programada" },
  { value: "delivery_express", label: "Delivery Express" },
  { value: "retiro_tienda", label: "Retiro por Tienda" },
  { value: "retiro_almacen", label: "Retiro por almacén" },
] as const;

export const DELIVERY_ZONES = [
  { value: "caracas", label: "Caracas" },
  { value: "g_g", label: "G&G" },
  { value: "san_antonio_los_teques", label: "San Antonio-Los Teques" },
  { value: "caucagua_higuerote", label: "Caucagua-Higuerote" },
  { value: "la_guaira", label: "La Guaira" },
  { value: "charallave_cua", label: "Charallave-Cua" },
  { value: "interior_pais", label: "Interior del País" },
] as const;

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

const digitalPaymentMethods = [
  "Mercantil Panamá",
  "Banesco Panamá",
  "Paypal",
  "Bonace",
  "Facebank",
  "Zelle",
];

export function NewOrderDialog({ open, onOpenChange }: NewOrderDialogProps) {
  const { preferredCurrency } = useCurrency();
  const orderForm = useOrderForm(open);

  // Estados locales para diálogos modales
  const [isClientLookupOpen, setIsClientLookupOpen] = useState(false);
  const [isProductSelectionOpen, setIsProductSelectionOpen] = useState(false);
  const [isProductEditOpen, setIsProductEditOpen] = useState(false);
  const [isRemoveProductOpen, setIsRemoveProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<OrderProduct | null>(null);
  const [productToRemove, setProductToRemove] = useState<OrderProduct | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);

  // Handlers de productos
  const handleEditProduct = (product: OrderProduct) => {
    setEditingProduct(product);
    setIsProductEditOpen(true);
  };

  const handleUpdateProduct = (updatedProduct: OrderProduct) => {
    orderForm.setSelectedProducts((products) =>
      products.map((p) =>
        p.id === updatedProduct.id
          ? { ...updatedProduct, locationStatus: updatedProduct.locationStatus ?? "EN TIENDA" }
          : p
      )
    );
    setIsProductEditOpen(false);
    setEditingProduct(null);
  };

  const handleRemoveProduct = (product: OrderProduct) => {
    setProductToRemove(product);
    setIsRemoveProductOpen(true);
  };

  const confirmRemoveProduct = () => {
    if (productToRemove) {
      orderForm.setSelectedProducts((products) =>
        products.filter((p) => p.id !== productToRemove.id)
      );
      setProductToRemove(null);
      setIsRemoveProductOpen(false);
    }
  };

  // Handlers de pagos (mantener aquí por ahora, pueden moverse al hook después)
  const addPayment = () => {
    const defaultCurrency = orderForm.getDefaultCurrencyFromSelection();
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      currency: defaultCurrency,
      paymentDetails: {},
    };
    orderForm.setPayments([...orderForm.payments, newPayment]);
  };

  const updatePayment = (
    id: string,
    field: keyof PartialPayment,
    value: string | number | Currency
  ) => {
    orderForm.setPayments((paymentsList) =>
      paymentsList.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  };

  const updatePaymentDetails = (
    id: string,
    field: string,
    value: string | number | boolean | undefined
  ) => {
    orderForm.setPayments((paymentsList) =>
      paymentsList.map((payment) => {
        if (payment.id === id) {
          const updatedDetails = { ...payment.paymentDetails } as any;
          if (value === undefined) {
            delete updatedDetails[field];
          } else {
            updatedDetails[field] = value;
          }
          return {
            ...payment,
            paymentDetails: updatedDetails,
          };
        }
        return payment;
      })
    );
  };

  const getAccountsForPaymentMethod = (method: string): Account[] => {
    if (["Binance", "Paypal"].includes(method)) {
      return orderForm.accounts.filter((acc) => acc.accountType === "Cuentas Digitales");
    } else if (
      [
        "Banesco Panamá",
        "Mercantil Panamá",
        "Pago Móvil",
        "Transferencia",
        "Facebank",
        "Zelle",
      ].includes(method)
    ) {
      return orderForm.accounts.filter(
        (acc) => acc.accountType === "Ahorro" || acc.accountType === "Corriente"
      );
    }
    return [];
  };

  const saveAccountInfoToPayment = (paymentId: string, account: Account): void => {
    updatePaymentDetails(paymentId, "accountId", account.id);

    if (account.accountType === "Cuentas Digitales") {
      updatePaymentDetails(paymentId, "email", account.email || undefined);
      updatePaymentDetails(paymentId, "wallet", account.wallet || undefined);
      updatePaymentDetails(paymentId, "accountNumber", undefined);
      updatePaymentDetails(paymentId, "bank", undefined);
    } else {
      // Para cuentas tradicionales, usar el código como referencia y el label puede contener el banco
      updatePaymentDetails(paymentId, "accountNumber", account.code || undefined);
      updatePaymentDetails(paymentId, "bank", account.label || undefined);
      updatePaymentDetails(paymentId, "email", undefined);
      updatePaymentDetails(paymentId, "wallet", undefined);
    }

    // Si la etiqueta contiene información del banco, intentar extraerla para Pago Móvil/Transferencia
    const currentPayment = orderForm.payments.find((p) => p.id === paymentId);
    if (account.label && (currentPayment?.method === "Pago Móvil" || currentPayment?.method === "Transferencia")) {
      // Intentar extraer el banco del label si es posible (ej: "Punto de Venta Banesco" -> "Banesco")
      const bankMatch = account.label.match(/\b(Banesco|Mercantil|Venezuela|Provincial|BOD|100% Banco|Banco del Tesoro|Banco de Venezuela)\b/i);
      if (bankMatch) {
        const bankName = bankMatch[1];
        if (currentPayment?.method === "Pago Móvil") {
          updatePaymentDetails(paymentId, "pagomovilBank", bankName);
        } else if (currentPayment?.method === "Transferencia") {
          updatePaymentDetails(paymentId, "transferenciaBank", bankName);
        }
      }
    }
  };

  const removePayment = (id: string) => {
    orderForm.setPayments((paymentsList) =>
      paymentsList.filter((payment) => payment.id !== id)
    );
  };

  const updatePaymentImages = (paymentId: string, images: ProductImage[]) => {
    orderForm.setPayments((paymentsList) =>
      paymentsList.map((payment) =>
        payment.id === paymentId
          ? { ...payment, images: images.length > 0 ? images : undefined }
          : payment
      )
    );
  };

  // Handler para crear presupuesto
  const handleCreateBudget = async () => {
    try {
      if (
        !orderForm.selectedClient ||
        !orderForm.formData.vendor ||
        orderForm.selectedProducts.length === 0
      ) {
        toast.error("Por favor completa la información requerida");
        return;
      }

      const orderData = {
        clientId: orderForm.selectedClient.id,
        clientName: orderForm.selectedClient.name,
        vendorId: orderForm.formData.vendor,
        vendorName:
          orderForm.mockVendors.find((v) => v.id === orderForm.formData.vendor)?.name || "",
        referrerId: orderForm.formData.referrer || undefined,
        referrerName: orderForm.formData.referrer
          ? orderForm.mockReferrers.find((r) => r.id === orderForm.formData.referrer)?.name
          : undefined,
        products: orderForm.selectedProducts.map((product) => ({
          ...product,
          discount: product.discount && product.discount > 0 ? product.discount : undefined,
        })),
        subtotalBeforeDiscounts: orderForm.productSubtotal,
        productDiscountTotal:
          orderForm.productDiscountTotal > 0 ? orderForm.productDiscountTotal : undefined,
        generalDiscountAmount:
          orderForm.generalDiscountAmount > 0 ? orderForm.generalDiscountAmount : undefined,
        subtotal: orderForm.subtotal,
        taxAmount: orderForm.taxAmount,
        deliveryCost: orderForm.deliveryCost,
        total: orderForm.total,
        hasDelivery: orderForm.hasDelivery,
        deliveryAddress: orderForm.hasDelivery ? orderForm.formData.deliveryAddress : undefined,
        deliveryServices: orderForm.hasDelivery
          ? {
              deliveryExpress: orderForm.deliveryServices.deliveryExpress?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.deliveryExpress.cost,
                    currency: orderForm.deliveryServices.deliveryExpress.currency,
                  }
                : undefined,
              servicioAcarreo: orderForm.deliveryServices.servicioAcarreo?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioAcarreo.cost,
                    currency: orderForm.deliveryServices.servicioAcarreo.currency,
                  }
                : undefined,
              servicioArmado: orderForm.deliveryServices.servicioArmado?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioArmado.cost,
                    currency: orderForm.deliveryServices.servicioArmado.currency,
                  }
                : undefined,
            }
          : undefined,
        observations: orderForm.generalObservations.trim() || undefined,
        baseCurrency: preferredCurrency,
        exchangeRatesAtCreation: orderForm.exchangeRates,
        validForDays: 30,
      };

      const budget = await addBudget(orderData);
      toast.success(`Presupuesto ${budget.budgetNumber} creado exitosamente`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating budget:", error);
      toast.error("Error al crear el presupuesto. Por favor intenta nuevamente.");
    }
  };

  // Handler para submit del pedido
  const handleSubmit = async () => {
    try {
      if (!orderForm.selectedClient) {
        toast.error("Por favor selecciona un cliente");
        return;
      }

      if (
        orderForm.hasDelivery &&
        orderForm.deliveryServices.servicioArmado?.enabled
      ) {
        if (
          !orderForm.deliveryServices.servicioArmado.cost ||
          orderForm.deliveryServices.servicioArmado.cost <= 0
        ) {
          toast.error("El precio del Servicio de Armado es obligatorio");
          return;
        }
      }

      if (orderForm.selectedProducts.length === 0) {
        toast.error("Por favor agrega al menos un producto");
        return;
      }

      if (!orderForm.paymentCondition) {
        toast.error("Por favor selecciona la condición de pago");
        return;
      }

      // Solo validar pagos si NO es "Pago a la entrega"
      if (orderForm.paymentCondition !== "pago_a_entrega" && orderForm.payments.length === 0) {
        toast.error("Por favor agrega al menos un pago");
        return;
      }

      if (!orderForm.saleType) {
        toast.error("Por favor selecciona el tipo de venta");
        return;
      }

      if (!orderForm.deliveryType) {
        toast.error("Por favor selecciona el tipo de entrega");
        return;
      }

      if (!orderForm.deliveryZone) {
        toast.error("Por favor selecciona la zona de entrega");
        return;
      }

      // Preparar datos para confirmación
      const orderDataForConfirmation = {
        clientName: orderForm.selectedClient.name,
        clientTelefono: orderForm.selectedClient.telefono,
        clientTelefono2: orderForm.selectedClient.telefono2,
        clientEmail: orderForm.selectedClient.email,
        clientRutId: orderForm.selectedClient.rutId,
        clientDireccion: orderForm.selectedClient.address,
        vendorName:
          orderForm.mockVendors.find((v) => v.id === orderForm.formData.vendor)?.name || "",
        referrerName: orderForm.formData.referrer
          ? orderForm.mockReferrers.find((r) => r.id === orderForm.formData.referrer)?.name
          : undefined,
        products: orderForm.selectedProducts.map((product) => ({
          ...product,
          discount: product.discount && product.discount > 0 ? product.discount : undefined,
          locationStatus: product.locationStatus ?? "EN TIENDA",
        })),
        subtotal: orderForm.subtotal,
        productDiscountTotal:
          orderForm.productDiscountTotal > 0 ? orderForm.productDiscountTotal : undefined,
        generalDiscountAmount:
          orderForm.generalDiscountAmount > 0 ? orderForm.generalDiscountAmount : undefined,
        taxAmount: orderForm.taxAmount,
        deliveryCost: orderForm.deliveryCost,
        total: orderForm.total,
        payments: orderForm.payments,
        paymentCondition: orderForm.paymentCondition,
        saleType: orderForm.saleType,
        deliveryType: orderForm.deliveryType,
        deliveryZone: orderForm.deliveryZone,
        hasDelivery: orderForm.hasDelivery,
        deliveryAddress: orderForm.formData.deliveryAddress,
        deliveryServices: orderForm.hasDelivery
          ? {
              deliveryExpress: orderForm.deliveryServices.deliveryExpress?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.deliveryExpress.cost,
                    currency: orderForm.deliveryServices.deliveryExpress.currency,
                  }
                : undefined,
              servicioAcarreo: orderForm.deliveryServices.servicioAcarreo?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioAcarreo.cost,
                    currency: orderForm.deliveryServices.servicioAcarreo.currency,
                  }
                : undefined,
              servicioArmado: orderForm.deliveryServices.servicioArmado?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioArmado.cost,
                    currency: orderForm.deliveryServices.servicioArmado.currency,
                  }
                : undefined,
            }
          : undefined,
        observations: orderForm.generalObservations.trim() || undefined,
      };

      setPendingOrderData(orderDataForConfirmation);
      setIsConfirmationOpen(true);
    } catch (error) {
      console.error("Error preparing order:", error);
      toast.error("Error al preparar el pedido. Por favor intenta nuevamente.");
    }
  };

  // Handler para confirmar el pedido
  const handleConfirmOrder = async () => {
    try {
      if (!pendingOrderData || !orderForm.selectedClient) return;

      const orderData: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt"> = {
        clientId: orderForm.selectedClient.id,
        clientName: orderForm.selectedClient.name,
        vendorId: orderForm.formData.vendor,
        vendorName:
          orderForm.mockVendors.find((v) => v.id === orderForm.formData.vendor)?.name || "",
        referrerId: orderForm.formData.referrer || undefined,
        referrerName: orderForm.formData.referrer
          ? orderForm.mockReferrers.find((r) => r.id === orderForm.formData.referrer)?.name
          : undefined,
        products: orderForm.selectedProducts.map((product) => ({
          ...product,
          discount: product.discount && product.discount > 0 ? product.discount : undefined,
          locationStatus: product.locationStatus ?? "EN TIENDA",
        })),
        subtotalBeforeDiscounts: orderForm.productSubtotal,
        productDiscountTotal:
          orderForm.productDiscountTotal > 0 ? orderForm.productDiscountTotal : undefined,
        generalDiscountAmount:
          orderForm.generalDiscountAmount > 0 ? orderForm.generalDiscountAmount : undefined,
        subtotal: orderForm.subtotal,
        taxAmount: orderForm.taxAmount,
        deliveryCost: orderForm.deliveryCost,
        total: orderForm.total,
        paymentType:
          orderForm.paymentCondition === "pago_a_entrega"
            ? "directo"
            : orderForm.paymentCondition === "todo_pago"
            ? "directo"
            : orderForm.paymentCondition === "pago_parcial"
            ? "apartado"
            : "apartado",
        paymentCondition: orderForm.paymentCondition as
          | "cashea"
          | "pagara_en_tienda"
          | "pago_a_entrega"
          | "pago_parcial"
          | "todo_pago",
        saleType: orderForm.saleType as "encargo" | "entrega" | "sistema_apartado",
        deliveryType: orderForm.deliveryType as
          | "entrega_programada"
          | "delivery_express"
          | "retiro_tienda"
          | "retiro_almacen",
        deliveryZone: orderForm.deliveryZone as
          | "caracas"
          | "g_g"
          | "san_antonio_los_teques"
          | "caucagua_higuerote"
          | "la_guaira"
          | "charallave_cua"
          | "interior_pais",
        paymentMethod:
          orderForm.paymentCondition === "pago_a_entrega"
            ? "Pago a la entrega"
            : orderForm.payments.length > 1
            ? "Mixto"
            : orderForm.payments[0]?.method || "",
        paymentDetails:
          orderForm.paymentCondition === "pago_a_entrega" || orderForm.payments.length === 0
            ? undefined
            : orderForm.payments.length === 1
            ? orderForm.payments[0]?.paymentDetails
            : undefined,
        partialPayments: orderForm.paymentCondition === "pago_a_entrega" ? undefined : orderForm.payments,
        mixedPayments: orderForm.paymentCondition === "pago_a_entrega" ? undefined : (orderForm.payments.length > 1 ? orderForm.payments : undefined),
        deliveryAddress: orderForm.hasDelivery ? orderForm.formData.deliveryAddress : undefined,
        hasDelivery: orderForm.hasDelivery,
        deliveryServices: orderForm.hasDelivery
          ? {
              deliveryExpress: orderForm.deliveryServices.deliveryExpress?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.deliveryExpress.cost,
                    currency: orderForm.deliveryServices.deliveryExpress.currency,
                  }
                : undefined,
              servicioAcarreo: orderForm.deliveryServices.servicioAcarreo?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioAcarreo.cost,
                    currency: orderForm.deliveryServices.servicioAcarreo.currency,
                  }
                : undefined,
              servicioArmado: orderForm.deliveryServices.servicioArmado?.enabled
                ? {
                    enabled: true,
                    cost: orderForm.deliveryServices.servicioArmado.cost,
                    currency: orderForm.deliveryServices.servicioArmado.currency,
                  }
                : undefined,
            }
          : undefined,
        status: "Generado",
        productMarkups: orderForm.productMarkups,
        createSupplierOrder: orderForm.createSupplierOrder,
        observations: orderForm.generalObservations.trim() || undefined,
        baseCurrency: "Bs",
        exchangeRatesAtCreation: {
          USD: orderForm.exchangeRates.USD
            ? {
                rate: orderForm.exchangeRates.USD.rate,
                effectiveDate: orderForm.exchangeRates.USD.effectiveDate,
              }
            : undefined,
          EUR: orderForm.exchangeRates.EUR
            ? {
                rate: orderForm.exchangeRates.EUR.rate,
                effectiveDate: orderForm.exchangeRates.EUR.effectiveDate,
              }
            : undefined,
        },
      };

      const createdOrder = await addOrder(orderData);

      setIsConfirmationOpen(false);
      onOpenChange(false);
      toast.success("Pedido creado exitosamente");

      // Reset form
      orderForm.resetForm();
      setPendingOrderData(null);

      // Redirigir a la vista de detalle del pedido
      window.location.href = `/pedidos/${createdOrder.orderNumber}`;
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Error al crear el pedido. Por favor intenta nuevamente.");
      setIsConfirmationOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none sm:w-full sm:h-auto sm:max-w-[95vw] sm:max-w-5xl sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 md:p-8 rounded-none sm:rounded-lg m-0 sm:m-4">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl">
              Nuevo Pedido - Paso {orderForm.currentStep} de 3
            </DialogTitle>
            <DialogDescription>
              {orderForm.currentStep === 1 && "Configura el presupuesto, cliente y productos"}
              {orderForm.currentStep === 2 && "Define el estado de los productos"}
              {orderForm.currentStep === 3 && "Completa los detalles finales del pedido"}
            </DialogDescription>
          </DialogHeader>

          {/* Renderizar paso actual */}
          {orderForm.currentStep === 1 && (
            <Step1Budget
              orderForm={orderForm}
              onClientLookup={() => setIsClientLookupOpen(true)}
              onProductSelection={() => setIsProductSelectionOpen(true)}
              onEditProduct={handleEditProduct}
              onRemoveProduct={handleRemoveProduct}
            />
          )}

          {orderForm.currentStep === 2 && (
            <Step2ProductStatus orderForm={orderForm} />
          )}

          {orderForm.currentStep === 3 && (
            <Step3OrderDetails
              orderForm={orderForm}
              onSubmit={handleSubmit}
              addPayment={addPayment}
              updatePayment={updatePayment}
              updatePaymentDetails={updatePaymentDetails}
              removePayment={removePayment}
              getAccountsForPaymentMethod={getAccountsForPaymentMethod}
              saveAccountInfoToPayment={saveAccountInfoToPayment}
              updatePaymentImages={updatePaymentImages}
            />
          )}

          {/* Footer con botones de navegación */}
          <div className="flex justify-between items-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={orderForm.handleBack}
              disabled={orderForm.currentStep === 1}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            <div className="flex gap-2">
              {orderForm.currentStep === 1 && (
                <Button
                  onClick={handleCreateBudget}
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!orderForm.canCreateBudget}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Presupuesto
                </Button>
              )}

              {orderForm.currentStep < 3 ? (
                <Button
                  onClick={orderForm.handleNext}
                  className="w-full sm:w-auto"
                  disabled={!orderForm.canGoToNextStep}
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogos modales */}
      <ClientLookupDialog
        open={isClientLookupOpen}
        onOpenChange={setIsClientLookupOpen}
        onClientSelect={(client) => {
          orderForm.setSelectedClient(client);
          if (orderForm.hasDelivery && client.address) {
            orderForm.setFormData((prev) => ({
              ...prev,
              deliveryAddress: client.address || prev.deliveryAddress,
            }));
          }
        }}
      />

      <ProductSelectionDialog
        open={isProductSelectionOpen}
        onOpenChange={setIsProductSelectionOpen}
        onProductsSelect={orderForm.handleProductsSelect}
        selectedProducts={orderForm.selectedProducts}
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

