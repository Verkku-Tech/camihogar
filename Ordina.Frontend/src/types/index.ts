import type { Currency, ExchangeRate } from "@/lib/currency-utils";

export interface AttributeValue {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number; // positive for increase, negative for decrease
  priceAdjustmentCurrency?: Currency; // Moneda del ajuste de precio
  /** ID numérico del frontend (hash de ObjectId); puede quedar desfasado si solo existía productId corrupto en API */
  productId?: number;
  /** ObjectId del producto en el backend; fuente de verdad para atributos tipo Product */
  productBackendId?: string;
}

export interface Category {
  backendId?: string; // ObjectId original del backend (opcional)
  id: number;
  name: string;
  description: string;
  products: number;
  maxDiscount: number;
  maxDiscountCurrency?: Currency; // Moneda del descuento máximo
  attributes: {
    id: number;
    title: string;
    description: string;
    valueType: string;
    values: string[] | AttributeValue[]; // Support both old and new format
    maxSelections?: number; // For "Multiple select" type
    minValue?: number; // For "Number" type
    maxValue?: number; // For "Number" type (REQUIRED when valueType is "Number")
    required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
  }[];
}

export interface Product {
  id: number;
  backendId?: string;
  name: string;
  category: string;
  price: number;
  priceCurrency?: Currency; // Moneda del precio
  stock: number;
  status: string;
  sku: string;
  attributes?: { [attributeId: string]: any };
}

export interface ProductImage {
  id: string; // ID único para la imagen
  base64: string; // Imagen o PDF en base64 (data:image/jpeg;base64,... o data:application/pdf;base64,...)
  filename: string; // Nombre original del archivo
  type: "model" | "reference" | "other"; // Tipo de imagen
  uploadedAt: string; // Fecha de carga (ISO string)
  size?: number; // Tamaño del archivo en bytes (opcional)
  mimeType?: string; // Tipo MIME: "image/jpeg", "image/png", "application/pdf", etc.
}

export interface RefabricationRecord {
  reason: string; // Razón de la refabricación
  date: string; // Fecha de la refabricación (ISO string)
  previousProviderId?: string; // ID del proveedor anterior
  previousProviderName?: string; // Nombre del proveedor anterior
  newProviderId?: string; // ID del nuevo proveedor
  newProviderName?: string; // Nombre del nuevo proveedor
}

export interface OrderProduct {
  id: string;
  name: string;
  price: number;
  /** Moneda en la que están expresados price y total de la línea. Legacy: omitido = Bs. */
  priceCurrency?: Currency;
  quantity: number;
  total: number;
  category: string;
  stock: number; // Stock disponible
  attributes?: Record<string, string | number | string[]>; // Permite arrays para selección múltiple
  discount?: number; // Descuento aplicado al producto (monto)
  observations?: string; // Observaciones específicas del producto
  images?: ProductImage[]; // Imágenes de referencia del producto
  // Campos de fabricación
  availabilityStatus?: "disponible" | "no_disponible"; // Estado de disponibilidad
  manufacturingStatus?: "debe_fabricar" | "por_fabricar" | "fabricando" | "almacen_no_fabricado";
  manufacturingProviderId?: string; // ID del proveedor asignado
  manufacturingProviderName?: string; // Nombre del proveedor (para display)
  manufacturingStartedAt?: string; // Fecha de inicio de fabricación
  manufacturingCompletedAt?: string; // Fecha de finalización de fabricación
  manufacturingNotes?: string; // Notas de fabricación
  // Campos de refabricación (cuando un producto en almacén se devuelve a fabricación)
  refabricationReason?: string; // Razón de la última refabricación
  refabricatedAt?: string; // Fecha de última refabricación (ISO string)
  refabricationHistory?: RefabricationRecord[]; // Historial de refabricaciones
  // Estado de ubicación del producto
  locationStatus?:
    | "SELECCIONAR ESTADO"
    | "DISPONIBILIDAD INMEDIATA"
    | "EN TIENDA"
    | "FABRICACION"
    | "EN DESPACHO"
    | "DESPACHADO"; // Estado de ubicación
  logisticStatus?: string; // "Generado", "Fabricándose", "En Almacén", "En Ruta", "Completado"
  /** Origen preservado al marcar EN DESPACHO: "tienda" | "almacen" | null */
  dispatchOrigin?: "tienda" | "almacen" | null;
  /** ISO UTC cuando el ítem se marcó entregado/despachado */
  deliveredAt?: string;
  // Campos de sobreprecio
  surchargeEnabled?: boolean; // Checkbox "Sobre precio" activo
  surchargeAmount?: number; // Monto del sobreprecio (en USD)
  surchargeReason?: string; // Razón del sobreprecio
  commissionLineSource?: string;
  catalogProductId?: string;
}

export interface PartialPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  currency?: Currency; // Moneda del pago
  images?: ProductImage[]; // Imágenes del comprobante de pago
  paymentDetails?: {
    // Pago Móvil
    pagomovilReference?: string;
    pagomovilBank?: string;
    pagomovilPhone?: string;
    pagomovilDate?: string;
    // Transferencia
    transferenciaBank?: string;
    transferenciaReference?: string;
    transferenciaDate?: string;
    // Efectivo
    cashAmount?: string;
    cashCurrency?: "Bs" | "USD" | "EUR"; // Moneda del pago en efectivo
    cashReceived?: number; // Monto recibido del cliente
    exchangeRate?: number; // Tasa de cambio usada al momento del pago
    useCustomRate?: boolean; // Indica si se usó una tasa personalizada/manual
    // Para Pago Móvil y Transferencia
    originalAmount?: number; // Monto original en la moneda del pago
    originalCurrency?: "Bs" | "USD" | "EUR"; // Moneda original del pago
    // Información de cuenta relacionada
    accountId?: string; // ID de la cuenta (opcional)
    accountNumber?: string; // Para cuentas bancarias: número de cuenta completo
    bank?: string; // Para cuentas bancarias: nombre del banco
    email?: string; // Para cuentas digitales: correo
    wallet?: string; // Para cuentas digitales: wallet
    // Zelle
    envia?: string; // Nombre del titular de la cuenta que paga (solo para Zelle)
    // TDD (Tarjeta de Débito)
    cardReference?: string; // Número de referencia del pago con tarjeta
    /** Conciliación contable (reporte / offline) */
    isConciliated?: boolean;
    /** Segunda línea sintética en pedidos Cashea: saldo cubierto vía financiación (no es un cobro en caja). */
    casheaFinancedPortion?: boolean;
    /** Comisión informativa TDC (6%) registrada en el cobro. */
    cardCommissionApplied?: boolean;
    cardCommissionAmount?: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  convertedFromNumber?: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  /** Usuario de post venta (comisión en ENCARGO / SA). */
  postventaId?: string;
  postventaName?: string;
  products: OrderProduct[]; // Ahora usa la interfaz exportada
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: "monto" | "porcentaje";
  generalDiscountPercent?: number;
  paymentType: "directo" | "apartado" | "mixto"; // Mantener para compatibilidad
  paymentMode?: "simple" | "mixto"; // Nuevo campo
  paymentMethod: string;
  // Nuevos campos opcionales para compatibilidad hacia atrás
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
  paymentDetails?: {
    // Pago Móvil
    pagomovilReference?: string;
    pagomovilBank?: string;
    pagomovilPhone?: string;
    pagomovilDate?: string;
    // Transferencia
    transferenciaBank?: string;
    transferenciaReference?: string;
    transferenciaDate?: string;
    // Efectivo
    cashAmount?: string;
    cashCurrency?: "Bs" | "USD" | "EUR"; // Moneda del pago en efectivo
    cashReceived?: number; // Monto recibido del cliente
    exchangeRate?: number; // Tasa de cambio usada al momento del pago
    useCustomRate?: boolean; // Indica si se usó una tasa personalizada/manual
    // Para Pago Móvil y Transferencia
    originalAmount?: number; // Monto original en la moneda del pago
    originalCurrency?: "Bs" | "USD" | "EUR"; // Moneda original del pago
    // Información de cuenta relacionada
    accountId?: string; // ID de la cuenta (opcional)
    accountNumber?: string; // Para cuentas bancarias: número de cuenta completo
    bank?: string; // Para cuentas bancarias: nombre del banco
    email?: string; // Para cuentas digitales: correo
    wallet?: string; // Para cuentas digitales: wallet
    // Zelle
    envia?: string; // Nombre del titular de la cuenta que paga (solo para Zelle)
    isConciliated?: boolean;
    /** Comisión informativa TDC (6%) registrada en el cobro. */
    cardCommissionApplied?: boolean;
    cardCommissionAmount?: number;
  };
  partialPayments?: PartialPayment[]; // Ahora usa la interfaz exportada
  mixedPayments?: PartialPayment[]; // Para pagos mixtos
  deliveryAddress?: string;
  hasDelivery: boolean;
  // Nueva estructura de servicios de delivery
  deliveryServices?: {
    deliveryExpress?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioAcarreo?: {
      enabled: boolean;
      cost?: number; // Opcional
      currency: "Bs" | "USD" | "EUR";
    };
    servicioArmado?: {
      enabled: boolean;
      cost: number; // Obligatorio si enabled
      currency: "Bs" | "USD" | "EUR";
    };
  };
  status:
    | "Presupuesto"
    | "Generado"
    | "Validado"
    | "Reporte de fabricación"
    | "Fabricándose"
    | "En Almacén"
    | "En Ruta"
    | "Completado"
    | "Cancelado"
    | "Generada"
    | "Fabricación"
    | "Por despachar"
    | "Completada"
    | "Reserva"
    | "Por Confirmar"
    | "Convertido"
    | "Declinado";
  createdAt: string;
  updatedAt: string;
  productMarkups?: Record<string, number>;
  createSupplierOrder?: boolean;
  observations?: string; // Observaciones generales del pedido
  dispatchObservations?: string; // Observaciones generales del despacho
  declineReason?: string;
  type?: string;
  baseCurrency?: "Bs" | "USD" | "EUR"; // Moneda base para visualización del pedido
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  }; // Tasas de cambio del día en que se creó el pedido
  dispatchDate?: string; // Fecha de despacho
  completedAt?: string; // Fecha de completado
  originalOrderId?: string;
  originalProducts?: OrderProduct[];
  sourceReservationVendorId?: string;
  sourceReservationVendorName?: string;
}

export interface Client {
  id: string;
  nombreRazonSocial: string;
  apodo?: string;
  rutId: string;
  direccion: string;
  telefono: string;
  telefono2?: string;
  email?: string;
  tipoCliente: "empresa" | "particular";
  estado: "activo" | "inactivo";
  fechaCreacion: string;
  tieneNotasDespacho: boolean;
}

export interface Provider {
  id: string;
  razonSocial: string;
  rif: string;
  direccion: string;
  telefono: string;
  email: string;
  contacto: string;
  tipo: "materia-prima" | "servicios" | "productos-terminados";
  estado: "activo" | "inactivo";
  fechaCreacion?: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  maxCapacity?: number;
  productDisplayLimits?: Record<string, number>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  maxCapacity: number;
  isCentral: boolean;
  status: "active" | "inactive";
}

export interface Account {
  id: string;
  code: string; // Código de la cuenta (ej: Banesco_POS)
  label: string; // Etiqueta o Nombre (ej: Punto de Venta Banesco)
  storeId: string | "all"; // ID de la tienda asociada o "all" para todas las tiendas
  isForeign: boolean; // true = Extranjera, false = Nacional
  accountType: string; // "Cuentas Digitales", "Ahorro", "Corriente", etc.
  email?: string; // Correo (solo para cuentas digitales)
  wallet?: string; // Wallet (solo para cuentas digitales)
  isActive: boolean; // true = Activa, false = Inactiva
  createdAt: string;
  updatedAt: string;
}

export type CommissionExclusivityMode =
  | "shared"
  | "exclusive"
  | "exclusive_with_referrer";

export interface User {
  id: string;
  username: string;
  email: string;
  role:
    | "Super Administrator"
    | "Administrator"
    | "Supervisor"
    | "Store Seller"
    | "Online Seller";
  name: string;
  status: "active" | "inactive";
  createdAt?: string;
  // Campos para comisiones
  commissionExclusivityMode?: CommissionExclusivityMode;
  exclusiveCommission?: boolean; // Legacy; derivado del modo
  baseSalary?: number; // Sueldo fijo del vendedor
  baseSalaryCurrency?: string; // Moneda del sueldo
  storeId?: string;
  storeName?: string;
  avatarUrl?: string;
  permissions?: string[];
}

export interface Vendor {
  id: string;
  name: string;
  role: string;
  type: "vendor" | "referrer";
}

export type GetOrdersOptions = {
  forceFullSync?: boolean;
  refreshFromBackend?: boolean;
  /** Si se provee, retorna después de cargar tantas páginas iniciales (cada una pageSize=50).
   *  El resto se sigue cargando en background y se almacena en IndexedDB para uso posterior. */
  initialPageLimit?: number;
  /** Callback que se llama cuando la carga background de órdenes termina. */
  onBackgroundComplete?: (allOrders: Order[]) => void;
  /** Signal para cancelar la carga de órdenes. */
  signal?: AbortSignal;
};

export interface UnifiedOrder {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  postventaId?: string;
  postventaName?: string;
  products: OrderProduct[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: "monto" | "porcentaje";
  generalDiscountPercent?: number;
  deliveryAddress?: string;
  hasDelivery: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  observations?: string;
  baseCurrency?: "Bs" | "USD" | "EUR";
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  };
  type: "order" | "budget"; // Para distinguir entre pedido y presupuesto
  expiresAt?: string; // Solo para presupuestos
  validForDays?: number; // Solo para presupuestos
  paymentMethod?: string; // Solo para pedidos
  paymentCondition?: Order["paymentCondition"];
  saleType?:
    | "delivery_express"
    | "encargo"
    | "encargo_entrega"
    | "entrega"
    | "retiro_almacen"
    | "retiro_tienda"
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
  deliveryServices?: Order["deliveryServices"];
  dispatchDate?: string; // Fecha de despacho
  completedAt?: string; // Fecha de completado
  partialPayments?: PartialPayment[]; // Para mostrar saldo pendiente / debe en USD en listados
  /** Abonos cuando el pedido guarda varios pagos solo en mixed (partial vacío); necesario para editar desde lista. */
  mixedPayments?: PartialPayment[];
}

export type MetricChangeDirection = "higher_is_better" | "lower_is_better";

export interface MetricChange {
  value: number;
  current: number;
  previous: number;
  hasBase: boolean;
  direction: MetricChangeDirection;
}

export interface DashboardMetrics {
  completedOrders: number;
  /** Variación de ventas vs periodo anterior; `null` cuando no aplica. */
  completedOrdersChange: MetricChange | null;
  pendingPayments: number;
  /** Saldo actual (sin histórico): siempre `null`. */
  pendingPaymentsChange: MetricChange | null;
  productsToManufacture: number;
  /** Conteo actual (sin histórico): siempre `null`. */
  productsToManufactureChange: MetricChange | null;
  averageOrderValue: number;
  averageOrderValueChange: MetricChange | null;
  totalSalesCount: number;
  /** USD comercial (base imponible). */
  totalInvoiced: number;
  totalInvoicedChange: MetricChange | null;
  /** USD comercial cobrado en el periodo. */
  totalCollected: number;
  totalCollectedChange: MetricChange | null;
  expiredLayawaysCount: number;
  expiredLayawaysAmount: number;
}

export interface Budget {
  id: string;
  budgetNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProduct[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: "monto" | "porcentaje";
  generalDiscountPercent?: number;
  deliveryAddress?: string;
  hasDelivery: boolean;
  deliveryServices?: Order["deliveryServices"];
  status: "Presupuesto" | "Aprobado" | "Rechazado" | "Vencido" | "Convertido";
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
  validForDays: number;
  observations?: string;
  baseCurrency?: "Bs" | "USD" | "EUR";
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  };
  convertedToOrderId?: string;
}

export type CalculateUnitPriceOptions = {
  /** Moneda del basePrice (default Bs, legacy). */
  basePriceCurrency?: Currency;
  /** Moneda del resultado (default Bs, legacy). */
  targetCurrency?: Currency;
};

export interface Commission {
  id: string;
  commissionType: "role" | "user"; // Por rol o por usuario
  role?: string; // Solo si commissionType === "role"
  userId?: string; // Solo si commissionType === "user"
  userName?: string; // Nombre del usuario (para display)
  commissionKind: "percentage" | "net"; // Porcentual o neta
  value: number; // Valor o cantidad
  currency: "Bs" | "USD" | "EUR";
  createdAt: string;
  updatedAt: string;
}

export interface ProductCommission {
  id: string;
  categoryId: string;
  categoryName: string;
  /** USD fijos por unidad vendida en esa familia/categoría (0 = sin comisión). */
  commissionValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleTypeCommissionRule {
  id: string;
  saleType: string;
  saleTypeLabel: string;
  /** USD de comisión familia por unidad (2.5, 5 o 7.5). */
  familyCommissionUsdPerUnit: number;
  /** USD por unidad para vendedor de tienda (venta compartida). */
  vendorRate: number;
  /** USD por unidad para referido online. */
  referrerRate: number;
  /** USD por unidad para post venta. */
  postventaRate?: number;
  createdAt: string;
  updatedAt: string;
}

export type CommissionCalculationContext = {
  productCommissions: ProductCommission[];
  saleTypeRules: SaleTypeCommissionRule[];
  users: User[];
  legacyCommissions: Commission[];
};

export type ProductCommissionSplit = {
  vendorCommission: number;
  referrerCommission: number;
  postventaCommission: number;
  /** True cuando hay reparto vendedor/referido en el reporte (dos filas con comisiones compartidas). */
  isShared: boolean;
};

export type OrderCommissionLine = {
  sellerId: string;
  sellerName: string;
  productId: string;
  productName: string;
  commission: number;
  isShared: boolean;
  payoutRole: "vendor" | "referrer" | "postventa";
};
