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
  type Order,
  type OrderProduct,
  type PartialPayment,
  type Vendor,
} from "@/lib/storage";

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
  const [paymentType, setPaymentType] = useState<
    "directo" | "apartado" | "mixto"
  >("directo");
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
  const [mixedPayments, setMixedPayments] = useState<PartialPayment[]>([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState(0);
  const [createSupplierOrder, setCreateSupplierOrder] = useState(false); // Added supplier order flag
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const loadedVendors = await getVendors();
        setVendors(loadedVendors);
      } catch (error) {
        console.error("Error loading vendors:", error);
      }
    };
    if (open) {
      loadVendors();
    }
  }, [open]);

  const mockVendors = vendors.filter((v) => v.type === "vendor");
  const mockReferrers = vendors.filter((v) => v.type === "referrer");

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
    return product.total + markup;
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

  const firstPaymentRequired = total * 0.3;
  const totalPaid =
    partialPayments.reduce((sum, payment) => sum + payment.amount, 0) +
    formData.firstPaymentAmount;
  const remainingAmount = total - totalPaid;

  // Calcular total de pagos mixtos
  const mixedPaymentsTotal = mixedPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const mixedPaymentsRemaining = total - mixedPaymentsTotal;
  const isMixedPaymentsValid = Math.abs(mixedPaymentsRemaining) < 0.01; // Tolerancia para decimales

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
      setCurrentStep(currentStep + 1);
      if (paymentType === "apartado") {
        setFormData((prev) => ({
          ...prev,
          firstPaymentAmount: firstPaymentRequired,
        }));
      }
    }
  };

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

      // Validar pagos mixtos
      if (paymentType === "mixto") {
        if (mixedPayments.length === 0) {
          alert("Por favor agrega al menos un método de pago mixto");
          return;
        }
        if (!isMixedPaymentsValid) {
          alert(
            `El total de los pagos mixtos ($${mixedPaymentsTotal.toFixed(
              2
            )}) debe ser igual al total del pedido ($${total.toFixed(2)})`
          );
          return;
        }
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
        paymentType,
        paymentMethod:
          paymentType === "mixto" ? "Mixto" : formData.paymentMethod,
        paymentDetails:
          paymentType === "mixto"
            ? undefined
            : {
                ...(formData.paymentMethod === "Pago Móvil" && {
                  pagomovilReference: formData.pagomovilReference,
                  pagomovilBank: formData.pagomovilBank,
                  pagomovilPhone: formData.pagomovilPhone,
                  pagomovilDate: formData.pagomovilDate,
                }),
                ...(formData.paymentMethod === "Transferencia" && {
                  transferenciaBank: formData.transferenciaBank,
                  transferenciaReference: formData.transferenciaReference,
                  transferenciaDate: formData.transferenciaDate,
                }),
                ...(formData.paymentMethod === "Efectivo" && {
                  cashAmount: formData.cashAmount,
                }),
              },
        partialPayments:
          paymentType === "apartado" ? partialPayments : undefined,
        mixedPayments: paymentType === "mixto" ? mixedPayments : undefined,
        deliveryAddress: hasDelivery ? formData.deliveryAddress : undefined,
        hasDelivery,
        status: paymentType === "apartado" ? "Apartado" : "Pendiente",
        productMarkups,
        createSupplierOrder,
        observations: generalObservations.trim() || undefined,
      };

      await addOrder(orderData);

      // Mostrar mensaje de éxito
      //alert("Pedido creado exitosamente");

      // Reset y cerrar
      onOpenChange(false);
      setCurrentStep(1);
      setSelectedClient(null);
      setSelectedProducts([]);
      setPartialPayments([]);
      setMixedPayments([]);
      setDeliveryExpenses(0);
      setHasDelivery(false);
      setProductMarkups({});
      setGeneralDiscount(0);
      setGeneralDiscountType("monto");
      setProductDiscountTypes({});
      setCreateSupplierOrder(false);
      setGeneralObservations("");
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

  const addPartialPayment = () => {
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      paymentDetails: {},
    };
    setPartialPayments([...partialPayments, newPayment]);
  };

  const updatePartialPayment = (
    id: string,
    field: keyof PartialPayment,
    value: string | number
  ) => {
    setPartialPayments((payments) =>
      payments.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  };

  const updatePartialPaymentDetails = (
    id: string,
    field: string,
    value: string
  ) => {
    setPartialPayments((payments) =>
      payments.map((payment) => {
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

  const removePartialPayment = (id: string) => {
    setPartialPayments((payments) =>
      payments.filter((payment) => payment.id !== id)
    );
  };

  // Funciones para manejar pagos mixtos
  const addMixedPayment = () => {
    const newPayment: PartialPayment = {
      id: Date.now().toString(),
      amount: 0,
      method: "",
      date: new Date().toISOString().split("T")[0],
      paymentDetails: {},
    };
    setMixedPayments([...mixedPayments, newPayment]);
  };

  const updateMixedPayment = (
    id: string,
    field: keyof PartialPayment,
    value: string | number
  ) => {
    setMixedPayments((payments) =>
      payments.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      )
    );
  };

  const updateMixedPaymentDetails = (
    id: string,
    field: string,
    value: string
  ) => {
    setMixedPayments((payments) =>
      payments.map((payment) => {
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

  const removeMixedPayment = (id: string) => {
    setMixedPayments((payments) =>
      payments.filter((payment) => payment.id !== id)
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
        <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Nuevo Pedido - Paso {currentStep} de 2</DialogTitle>
          </DialogHeader>

          {currentStep === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Presupuesto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Vendor Selection */}
                  <div className="grid gap-4 sm:grid-cols-2">
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
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Producto
                      </Button>
                    </div>

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
                      <div className="overflow-x-auto">
                        <Table className="min-w-[780px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producto</TableHead>
                              <TableHead>Precio</TableHead>
                              <TableHead>Cantidad</TableHead>
                              <TableHead>Stock</TableHead>
                              <TableHead>Subtotal</TableHead>
                              <TableHead>Descuento</TableHead>
                              <TableHead>Total final</TableHead>
                              <TableHead className="text-right">
                                Acciones
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedProducts.map((product) => {
                              const baseTotal = getProductBaseTotal(product);
                              const discount = product.discount || 0;
                              const finalTotal = Math.max(
                                baseTotal - discount,
                                0
                              );

                              return (
                                <TableRow key={product.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {product.name}
                                      {product.quantity > product.stock && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          Sin stock
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    ${product.price.toFixed(2)}
                                  </TableCell>
                                  <TableCell>{product.quantity}</TableCell>
                                  <TableCell>
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
                                  <TableCell>${baseTotal.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2 items-center">
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
                                        <SelectTrigger className="w-24 h-9">
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
                                        className="w-28"
                                        placeholder={
                                          productDiscountTypes[product.id] ===
                                          "porcentaje"
                                            ? "0%"
                                            : "0.00"
                                        }
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    ${finalTotal.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleEditProduct(product)
                                        }
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleRemoveProduct(product)
                                        }
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay productos seleccionados
                      </div>
                    )}
                  </div>

                  {/* Observaciones Generales */}
                  <div className="space-y-2">
                    <Label htmlFor="generalObservations">
                      Observaciones Generales
                    </Label>
                    <Textarea
                      id="generalObservations"
                      value={generalObservations}
                      onChange={(e) => setGeneralObservations(e.target.value)}
                      placeholder="Agregar observaciones generales para el pedido (opcional)"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Notas generales sobre el pedido
                    </p>
                  </div>

                  {/* Subtotal */}
                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        Subtotal (después de descuentos): ${subtotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Realizar Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Payment Method */}
                  <div className="space-y-4">
                    <Label>Método de Pago</Label>
                    <RadioGroup
                      value={paymentType}
                      onValueChange={(
                        value: "directo" | "apartado" | "mixto"
                      ) => setPaymentType(value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="directo" id="directo" />
                        <Label htmlFor="directo">Pago Directo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="apartado" id="apartado" />
                        <Label htmlFor="apartado">Apartado</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mixto" id="mixto" />
                        <Label htmlFor="mixto">Pago Mixto</Label>
                      </div>
                    </RadioGroup>

                    {paymentType === "directo" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Seleccionar método de pago</Label>
                          <Select
                            value={formData.paymentMethod}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                paymentMethod: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar método" />
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

                        {/* Campos condicionales según método de pago */}
                        {formData.paymentMethod === "Pago Móvil" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <Label className="text-base font-medium">
                              Información de Pago Móvil
                            </Label>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="pagomovilReference">
                                  N° Referencia *
                                </Label>
                                <Input
                                  id="pagomovilReference"
                                  value={formData.pagomovilReference}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      pagomovilReference: e.target.value,
                                    }))
                                  }
                                  placeholder="Ingrese el número de referencia"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="pagomovilBank">
                                  Banco Emisor *
                                </Label>
                                <Input
                                  id="pagomovilBank"
                                  value={formData.pagomovilBank}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      pagomovilBank: e.target.value,
                                    }))
                                  }
                                  placeholder="Ej: Banco de Venezuela"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="pagomovilPhone">
                                  Teléfono *
                                </Label>
                                <Input
                                  id="pagomovilPhone"
                                  type="tel"
                                  value={formData.pagomovilPhone}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      pagomovilPhone: e.target.value,
                                    }))
                                  }
                                  placeholder="0412-1234567"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="pagomovilDate">Fecha *</Label>
                                <Input
                                  id="pagomovilDate"
                                  type="date"
                                  value={formData.pagomovilDate}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      pagomovilDate: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formData.paymentMethod === "Transferencia" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <Label className="text-base font-medium">
                              Información de Transferencia
                            </Label>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="transferenciaBank">
                                  Banco *
                                </Label>
                                <Input
                                  id="transferenciaBank"
                                  value={formData.transferenciaBank}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      transferenciaBank: e.target.value,
                                    }))
                                  }
                                  placeholder="Ej: Banco de Venezuela"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="transferenciaReference">
                                  N° de Referencia *
                                </Label>
                                <Input
                                  id="transferenciaReference"
                                  value={formData.transferenciaReference}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      transferenciaReference: e.target.value,
                                    }))
                                  }
                                  placeholder="Ingrese el número de referencia"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="transferenciaDate">
                                  Fecha *
                                </Label>
                                <Input
                                  id="transferenciaDate"
                                  type="date"
                                  value={formData.transferenciaDate}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      transferenciaDate: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {formData.paymentMethod === "Efectivo" && (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <Label className="text-base font-medium">
                              Información de Pago en Efectivo
                            </Label>
                            <div className="space-y-2">
                              <Label htmlFor="cashAmount">
                                Cantidad en efectivo *
                              </Label>
                              <Input
                                id="cashAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  formData.cashAmount === "0" ||
                                  formData.cashAmount === ""
                                    ? ""
                                    : formData.cashAmount
                                }
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    cashAmount: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentType === "apartado" && (
                      <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground mb-2">
                            Pago inicial requerido (30%)
                          </div>
                          <div className="text-lg font-semibold">
                            ${firstPaymentRequired.toFixed(2)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Pagos Parciales</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addPartialPayment}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar Pago
                            </Button>
                          </div>

                          {partialPayments.map((payment) => (
                            <div
                              key={payment.id}
                              className="space-y-4 p-4 border rounded-lg"
                            >
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Label className="text-xs">Monto</Label>
                                  <Input
                                    type="number"
                                    value={
                                      payment.amount === 0 ? "" : payment.amount
                                    }
                                    onChange={(e) =>
                                      updatePartialPayment(
                                        payment.id,
                                        "amount",
                                        Number.parseFloat(e.target.value) || 0
                                      )
                                    }
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="flex-1">
                                  <Label className="text-xs">Método</Label>
                                  <Select
                                    value={payment.method}
                                    onValueChange={(value) =>
                                      updatePartialPayment(
                                        payment.id,
                                        "method",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
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
                                <div className="flex-1">
                                  <Label className="text-xs">Fecha</Label>
                                  <Input
                                    type="date"
                                    value={payment.date}
                                    onChange={(e) =>
                                      updatePartialPayment(
                                        payment.id,
                                        "date",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removePartialPayment(payment.id)
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
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
                                          updatePartialPaymentDetails(
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
                                          updatePartialPaymentDetails(
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
                                          updatePartialPaymentDetails(
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
                                          updatePartialPaymentDetails(
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
                                          updatePartialPaymentDetails(
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
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor={`cash-amount-${payment.id}`}
                                      className="text-xs"
                                    >
                                      Cantidad en efectivo *
                                    </Label>
                                    <Input
                                      id={`cash-amount-${payment.id}`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={
                                        payment.paymentDetails?.cashAmount ===
                                          "0" ||
                                        payment.paymentDetails?.cashAmount ===
                                          "" ||
                                        !payment.paymentDetails?.cashAmount
                                          ? ""
                                          : payment.paymentDetails.cashAmount
                                      }
                                      onChange={(e) =>
                                        updatePartialPaymentDetails(
                                          payment.id,
                                          "cashAmount",
                                          e.target.value
                                        )
                                      }
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {paymentType === "apartado" && (
                            <div className="p-4 bg-muted rounded-lg">
                              <div className="flex justify-between text-sm">
                                <span>Total pagado:</span>
                                <span>${totalPaid.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Restante:</span>
                                <span>${remainingAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span>Progreso:</span>
                                <span>
                                  {((totalPaid / total) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {paymentType === "mixto" && (
                      <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground mb-2">
                            Total del pedido
                          </div>
                          <div className="text-lg font-semibold">
                            ${total.toFixed(2)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Métodos de Pago</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addMixedPayment}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar Método
                            </Button>
                          </div>

                          {mixedPayments.map((payment) => (
                            <div
                              key={payment.id}
                              className="space-y-4 p-4 border rounded-lg"
                            >
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Label className="text-xs">Monto</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={total}
                                    value={
                                      payment.amount === 0 ? "" : payment.amount
                                    }
                                    onChange={(e) =>
                                      updateMixedPayment(
                                        payment.id,
                                        "amount",
                                        Number.parseFloat(e.target.value) || 0
                                      )
                                    }
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="flex-1">
                                  <Label className="text-xs">Método</Label>
                                  <Select
                                    value={payment.method}
                                    onValueChange={(value) =>
                                      updateMixedPayment(
                                        payment.id,
                                        "method",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
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
                                <div className="flex-1">
                                  <Label className="text-xs">Fecha</Label>
                                  <Input
                                    type="date"
                                    value={payment.date}
                                    onChange={(e) =>
                                      updateMixedPayment(
                                        payment.id,
                                        "date",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMixedPayment(payment.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
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
                                        htmlFor={`mixed-pagomovil-reference-${payment.id}`}
                                        className="text-xs"
                                      >
                                        N° Referencia *
                                      </Label>
                                      <Input
                                        id={`mixed-pagomovil-reference-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilReference || ""
                                        }
                                        onChange={(e) =>
                                          updateMixedPaymentDetails(
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
                                        htmlFor={`mixed-pagomovil-bank-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Banco Emisor *
                                      </Label>
                                      <Input
                                        id={`mixed-pagomovil-bank-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilBank || ""
                                        }
                                        onChange={(e) =>
                                          updateMixedPaymentDetails(
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
                                        htmlFor={`mixed-pagomovil-phone-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Teléfono *
                                      </Label>
                                      <Input
                                        id={`mixed-pagomovil-phone-${payment.id}`}
                                        type="tel"
                                        value={
                                          payment.paymentDetails
                                            ?.pagomovilPhone || ""
                                        }
                                        onChange={(e) =>
                                          updateMixedPaymentDetails(
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
                                        htmlFor={`mixed-transferencia-bank-${payment.id}`}
                                        className="text-xs"
                                      >
                                        Banco *
                                      </Label>
                                      <Input
                                        id={`mixed-transferencia-bank-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.transferenciaBank || ""
                                        }
                                        onChange={(e) =>
                                          updateMixedPaymentDetails(
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
                                        htmlFor={`mixed-transferencia-reference-${payment.id}`}
                                        className="text-xs"
                                      >
                                        N° de Referencia *
                                      </Label>
                                      <Input
                                        id={`mixed-transferencia-reference-${payment.id}`}
                                        value={
                                          payment.paymentDetails
                                            ?.transferenciaReference || ""
                                        }
                                        onChange={(e) =>
                                          updateMixedPaymentDetails(
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
                            </div>
                          ))}

                          {paymentType === "mixto" && (
                            <div className="p-4 bg-muted rounded-lg space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Total pagado:</span>
                                <span
                                  className={
                                    isMixedPaymentsValid
                                      ? "text-green-600 font-semibold"
                                      : "text-red-600 font-semibold"
                                  }
                                >
                                  ${mixedPaymentsTotal.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Total del pedido:</span>
                                <span>${total.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span>Restante:</span>
                                <span
                                  className={
                                    isMixedPaymentsValid
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  ${Math.abs(mixedPaymentsRemaining).toFixed(2)}
                                  {!isMixedPaymentsValid && (
                                    <span className="text-xs ml-2">
                                      {mixedPaymentsRemaining > 0
                                        ? "(falta)"
                                        : "(sobra)"}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {isMixedPaymentsValid && (
                                <div className="pt-2 border-t text-green-600 font-medium text-sm"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* NUEVA SECCIÓN: Delivery */}
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
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="deliveryAddress">
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
                        />
                        <Label htmlFor="deliveryExpenses">
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
                        />
                      </div>
                    )}
                  </div>

                  {/* Descuento general */}
                  <div className="space-y-2">
                    <Label htmlFor="generalDiscount">Descuento general</Label>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={generalDiscountType}
                        onValueChange={(value: "monto" | "porcentaje") =>
                          handleGeneralDiscountTypeChange(value)
                        }
                        disabled={selectedProducts.length === 0}
                      >
                        <SelectTrigger className="w-24">
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
                    <p className="text-sm text-muted-foreground">
                      Este descuento se aplica después de los descuentos
                      individuales por producto.
                    </p>
                  </div>

                  {/* TOTALIZACIÓN - Modificada */}
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal productos:</span>
                      <span>${productSubtotal.toFixed(2)}</span>
                    </div>

                    {productDiscountTotal > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuentos individuales:</span>
                        <span>- ${productDiscountTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {generalDiscountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuento general:</span>
                        <span>- ${generalDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-medium border-t pt-2">
                      <span>Subtotal después de descuentos:</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Impuesto (16%):</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>

                    {hasDelivery && (
                      <div className="flex justify-between">
                        <span>Gastos de entrega:</span>
                        <span>${deliveryCost.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>

            {currentStep < 2 ? (
              <Button onClick={handleNext}>
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>Crear Pedido</Button>
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
