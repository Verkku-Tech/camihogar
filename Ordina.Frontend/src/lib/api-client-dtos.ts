export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClientResponseDto {
  id: string;
  nombreRazonSocial: string;
  apodo?: string;
  rutId: string;
  direccion: string;
  telefono: string;
  telefono2?: string;
  email?: string;
  tipoCliente: string;
  estado: string;
  fechaCreacion: string;
  tieneNotasDespacho: boolean;
}

export interface CreateClientDto {
  nombreRazonSocial: string;
  apodo?: string;
  rutId: string;
  direccion: string;
  telefono: string;
  telefono2?: string;
  email?: string;
  tipoCliente: string;
  estado: string;
  tieneNotasDespacho: boolean;
}

export interface UpdateClientDto {
  nombreRazonSocial?: string;
  apodo?: string;
  rutId?: string;
  direccion?: string;
  telefono?: string;
  telefono2?: string;
  email?: string;
  tipoCliente?: string;
  estado?: string;
  tieneNotasDespacho?: boolean;
}

export interface ImportClientsResultDto {
  message: string;
  rowsProcessed: number;
  errors: number;
  total: number;
}

export interface GenerateAccessPinResponseDto {
  pin: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface ValidateAccessPinResponseDto {
  success: boolean;
  sessionExpiresAt: string;
  sessionRemainingSeconds: number;
}

export interface AccessPinSessionResponseDto {
  active: boolean;
  remainingSeconds?: number;
  sessionExpiresAt?: string;
}

export interface AccessPinHistoryItemDto {
  id: string;
  pinMasked: string;
  generatedByUserName: string;
  usedByUserId?: string;
  orderId?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  sessionExpiresAt?: string;
  status: string;
}

export interface AccessPinHistoryResponseDto {
  items: AccessPinHistoryItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ProductCommissionDto {
  id: string;
  categoryId: string;
  categoryName: string;
  commissionValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductCommissionDto {
  categoryId: string;
  categoryName: string;
  commissionValue: number;
}

export interface SaleTypeCommissionRuleDto {
  id: string;
  saleType: string;
  saleTypeLabel: string;
  /** USD de comisión familia por unidad (2.5, 5 o 7.5). */
  familyCommissionUsdPerUnit: number;
  /** USD por unidad para vendedor de tienda. */
  vendorRate: number;
  /** USD por unidad para referido online. */
  referrerRate: number;
  /** USD por unidad para post venta. */
  postventaRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleTypeCommissionRuleDto {
  saleType: string;
  saleTypeLabel: string;
  familyCommissionUsdPerUnit: number;
  vendorRate: number;
  referrerRate: number;
  postventaRate?: number;
}

export interface SaleTypeCommissionCompletenessDto {
  isComplete: boolean;
  expectedRuleCount: number;
  actualRuleCount: number;
  hasLegacyTierZero: boolean;
  missingDescriptions: string[];
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
  refreshTokenExpiresAt: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: string;
  name: string;
  status: string;
  permissions: string[];
  avatarUrl?: string;
}

export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt?: string;
  permissions?: string[];
  exclusiveCommission?: boolean;
  commissionExclusivityMode?: "shared" | "exclusive" | "exclusive_with_referrer";
  baseSalary?: number;
  baseSalaryCurrency?: string;
  storeId?: string;
  storeName?: string;
  extraPermissions?: string[];
  avatarUrl?: string;
}

export interface AssignablePermissionDto {
  id: string;
  label: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  name: string;
  role: string;
  status?: string;
  password?: string;
  storeId?: string;
  extraPermissions?: string[];
  avatarUrl?: string;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  exclusiveCommission?: boolean;
  commissionExclusivityMode?: "shared" | "exclusive" | "exclusive_with_referrer";
  baseSalary?: number;
  baseSalaryCurrency?: string;
  storeId?: string;
  extraPermissions?: string[];
  avatarUrl?: string;
}

export interface CommissionsReportQueryParams {
  startDate: string;
  endDate: string;
  vendorId?: string;
  storeId?: string;
  sellerType?: "all" | "store" | "online";
  referrerId?: string;
}

export interface CommissionReferrerOptionDto {
  id: string;
  name: string;
}

export interface CommissionReportRowDto {
  fecha: string;
  cliente: string;
  vendedor: string;
  pedido: string;
  descripcion: string;
  cantidadArticulos: number;
  tipoVenta: string;
  comisionFamiliaUsdPorUnidad: number;
  comision: number;
  vendedorSecundario?: string | null;
  comisionSecundaria?: number | null;
  vendedorPostventa?: string | null;
  comisionPostventa?: number | null;
  sueldoBase: number;
  tasaComisionBase: number;
  tasaAplicadaVendedor: number;
  tasaAplicadaReferido?: number | null;
  tasaAplicadaPostventa?: number | null;
  esVentaCompartida: boolean;
  esVendedorExclusivo: boolean;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleDto {
  name: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  permissions?: string[];
}

export interface CategoryAttributeDto {
  id: string;
  title: string;
  description: string;
  valueType: string;
  values: AttributeValueDto[];
  maxSelections?: number;
  minValue?: number;
  maxValue?: number;
  required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
}

export interface AttributeValueDto {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number;
  priceAdjustmentCurrency?: string;
  productId?: string;
}

export interface CategoryResponseDto {
  id: string;
  name: string;
  description: string;
  products: number;
  maxDiscount: number;
  maxDiscountCurrency?: string;
  attributes: CategoryAttributeDto[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCategoryAttributeDto {
  title: string;
  description: string;
  valueType: string;
  values: CreateAttributeValueDto[];
  maxSelections?: number;
  minValue?: number;
  maxValue?: number;
  required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
}

export interface CreateAttributeValueDto {
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number;
  priceAdjustmentCurrency?: string;
  productId?: string;
}

export interface CreateCategoryDto {
  name: string;
  description: string;
  maxDiscount: number;
  maxDiscountCurrency?: string;
  attributes: CreateCategoryAttributeDto[];
}

export interface UpdateCategoryAttributeDto {
  id?: string;
  title?: string;
  description?: string;
  valueType?: string;
  values?: UpdateAttributeValueDto[];
  maxSelections?: number;
  minValue?: number;
  maxValue?: number;
  required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
}

export interface UpdateAttributeValueDto {
  id?: string;
  label?: string;
  isDefault?: boolean;
  priceAdjustment?: number;
  priceAdjustmentCurrency?: string;
  productId?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  maxDiscount?: number;
  maxDiscountCurrency?: string;
  attributes?: UpdateCategoryAttributeDto[];
}

export interface ProductResponseDto {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  price: number;
  priceCurrency?: string;
  stock: number;
  status: string;
  sku: string;
  description?: string;
  attributes?: { [key: string]: any };
  providerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  categoryId?: string; // Opcional - el backend lo resolverá por nombre si no está presente
  category: string;
  price: number;
  priceCurrency?: string;
  stock: number;
  status: string;
  attributes?: { [key: string]: any };
  providerId?: string;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  category?: string;
  price?: number;
  priceCurrency?: string;
  stock?: number;
  status?: string;
  attributes?: { [key: string]: any };
  providerId?: string;
}

export interface PaginatedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ProductListItemDto {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  price: number;
  priceCurrency?: string;
  stock: number;
  status: string;
  sku: string;
}

export interface BulkDeleteResultDto {
  deleted: number;
  failed: number;
  errors: string[];
}

export interface ImportProductsResultDto {
  totalSheets: number;
  totalCategoriesCreated: number;
  totalCategoriesUpdated: number;
  totalValuesAdded: number;
  totalProductsCreated: number;
  totalProductsUpdated: number;
  totalProductsSkipped: number;
  sheets: SheetImportResultDto[];
}

export interface SheetImportResultDto {
  sheetName: string;
  categoryId: string;
  categoryCreated: boolean;
  categoryUpdated: boolean;
  valuesAdded: number;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  errors: string[];
}

export interface ProviderResponseDto {
  id: string;
  razonSocial: string;
  rif: string;
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  contacto: string;
  tipo: string;
  estado?: string;
  createdAt: string;
  updatedAt?: string;
  productsCount: number;
}

export interface CreateProviderDto {
  nombre?: string;
  telefono: string;
  rif?: string;
  razonSocial?: string;
  email?: string;
  direccion?: string;
  contacto?: string;
  tipo?: string;
  estado?: string;
}

export interface UpdateProviderDto {
  rif?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  estado?: string;
  razonSocial?: string;
  contacto?: string;
  tipo?: string;
}

export interface OrderProductDto {
  id: string;
  name: string;
  price: number;
  priceCurrency?: "Bs" | "USD" | "EUR";
  quantity: number;
  total: number;
  category: string;
  stock: number;
  attributes?: { [key: string]: any };
  discount?: number;
  observations?: string;
  images?: ProductImageDto[]; // Imágenes de referencia del producto
  availabilityStatus?: string;
  manufacturingStatus?: string;
  manufacturingProviderId?: string;
  manufacturingProviderName?: string;
  manufacturingStartedAt?: string;
  manufacturingCompletedAt?: string;
  manufacturingNotes?: string;
  locationStatus?: string;
  logisticStatus?: string;
  /** Origen preservado al marcar EN DESPACHO: "tienda" | "almacen" | null */
  dispatchOrigin?: string | null;
  /** ISO cuando el producto se marcó entregado/despachado */
  deliveredAt?: string;
  // Campos de refabricación
  refabricationReason?: string; // Razón de la última refabricación
  refabricatedAt?: string; // Fecha de última refabricación (ISO string)
  refabricationHistory?: RefabricationRecordDto[]; // Historial de refabricaciones
  // Campos de sobreprecio
  surchargeEnabled?: boolean;
  surchargeAmount?: number;
  surchargeReason?: string;
  commissionLineSource?: string;
  catalogProductId?: string;
}

export interface PaymentDetailsDto {
  pagomovilReference?: string;
  pagomovilBank?: string;
  pagomovilPhone?: string;
  pagomovilDate?: string;
  transferenciaBank?: string;
  transferenciaReference?: string;
  transferenciaDate?: string;
  cashAmount?: string;
  cashCurrency?: "Bs" | "USD" | "EUR";
  cashReceived?: number;
  exchangeRate?: number;
  originalAmount?: number;
  originalCurrency?: "Bs" | "USD" | "EUR";
  // Información de cuenta relacionada
  accountId?: string;
  accountNumber?: string; // Para cuentas bancarias
  bank?: string; // Para cuentas bancarias
  email?: string; // Para cuentas digitales
  wallet?: string; // Para cuentas digitales
  // Zelle
  envia?: string; // Nombre del titular de la cuenta que paga (solo para Zelle)
  /** Conciliación contable del pago */
  isConciliated?: boolean;
  /** Comisión informativa TDC (6%) registrada en el cobro. */
  cardCommissionApplied?: boolean;
  cardCommissionAmount?: number;
}

export interface ConciliatePaymentRequestDto {
  orderId: string;
  paymentType: "main" | "partial" | "mixed";
  paymentIndex: number;
  isConciliated: boolean;
}

export interface ProductImageDto {
  id: string;
  base64: string; // Imagen en base64 (data:image/jpeg;base64,...)
  filename: string; // Nombre original del archivo
  type: "model" | "reference" | "other"; // Tipo de imagen
  uploadedAt: string; // Fecha de carga (ISO string)
  size?: number; // Tamaño del archivo en bytes (opcional)
}

export interface RefabricationRecordDto {
  reason: string; // Razón de la refabricación
  date: string; // Fecha de la refabricación (ISO string)
  previousProviderId?: string; // ID del proveedor anterior
  previousProviderName?: string; // Nombre del proveedor anterior
  newProviderId?: string; // ID del nuevo proveedor
  newProviderName?: string; // Nombre del nuevo proveedor
}

export interface PartialPaymentDto {
  id: string;
  amount: number;
  method: string;
  date: string;
  images?: ProductImageDto[]; // Imágenes del comprobante de pago
  paymentDetails?: PaymentDetailsDto;
}

export interface OrderSearchResultDto {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientId: string;
  type: string;
  clientPhone?: string | null;
  clientRutId?: string | null;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  convertedFromNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  postventaId?: string;
  postventaName?: string;
  products: OrderProductDto[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
  paymentType: string;
  paymentMethod: string;
  paymentCondition?: string;
  paymentDetails?: PaymentDetailsDto;
  partialPayments?: PartialPaymentDto[];
  mixedPayments?: PartialPaymentDto[];
  deliveryAddress?: string;
  hasDelivery: boolean;
  deliveryServices?: {
    deliveryExpress?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioAcarreo?: {
      enabled: boolean;
      cost?: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioArmado?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
  };
  status: string;
  productMarkups?: { [key: string]: number };
  createSupplierOrder?: boolean;
  observations?: string;
  dispatchObservations?: string;
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string } | null;
    EUR?: { rate: number; effectiveDate: string } | null;
    /** Algunos backends serializan en camelCase/minúsculas */
    usd?: { rate: number; effectiveDate: string } | null;
    eur?: { rate: number; effectiveDate: string } | null;
  };
  baseCurrency?: "Bs" | "USD" | "EUR";
  dispatchDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
  originalOrderId?: string;
  originalProducts?: OrderProductDto[];
  sourceReservationVendorId?: string;
  sourceReservationVendorName?: string;
  declineReason?: string;
}

export interface ConvertBudgetToOrderDto {
  products?: OrderProductDto[];
  paymentType: string;
  paymentMethod: string;
  paymentCondition?: string;
  paymentDetails?: PaymentDetailsDto;
  partialPayments?: PartialPaymentDto[];
  mixedPayments?: PartialPaymentDto[];
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  deliveryAddress?: string;
  hasDelivery?: boolean;
  deliveryServices?: CreateOrderDto["deliveryServices"];
  observations?: string;
  dispatchObservations?: string;
  subtotal?: number;
  taxAmount?: number;
  deliveryCost?: number;
  total?: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
  productMarkups?: { [key: string]: number };
  createSupplierOrder?: boolean;
  postventaId?: string;
  postventaName?: string;
  exchangeRatesAtCreation?: CreateOrderDto["exchangeRatesAtCreation"];
}

export interface ConfirmOrderDto {
  storeVendorId: string;
  storeVendorName: string;
  products?: OrderProductDto[];
  paymentType: string;
  paymentMethod: string;
  paymentCondition?: string;
  paymentDetails?: PaymentDetailsDto;
  partialPayments?: PartialPaymentDto[];
  mixedPayments?: PartialPaymentDto[];
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  deliveryAddress?: string;
  hasDelivery?: boolean;
  deliveryServices?: CreateOrderDto["deliveryServices"];
  observations?: string;
  dispatchObservations?: string;
  subtotal?: number;
  taxAmount?: number;
  deliveryCost?: number;
  total?: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
  productMarkups?: { [key: string]: number };
  createSupplierOrder?: boolean;
  postventaId?: string;
  postventaName?: string;
  exchangeRatesAtCreation?: CreateOrderDto["exchangeRatesAtCreation"];
  baseCurrency?: "Bs" | "USD" | "EUR";
}

export interface AuditChangeDto {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  displayField?: string | null;
  displayOldValue?: string | null;
  displayNewValue?: string | null;
  productName?: string | null;
  category?: string | null;
}

export interface OrderAuditLogDto {
  id: string;
  orderId: string;
  orderNumber: string;
  action: string;
  userId: string;
  userName: string;
  summary: string;
  changes: AuditChangeDto[];
  timestamp: string;
}

export interface PagedAuditLogsResponseDto {
  items: OrderAuditLogDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface OnlineSellerTeamIdsDto {
  ids: string[];
}

export interface PagedOrdersResponseDto {
  /** Lista de pedidos en la página actual */
  orders: OrderResponseDto[];
  /** Número de página actual (1-indexed) */
  page: number;
  /** Cantidad de elementos por página */
  pageSize: number;
  /** Total de elementos (sin paginar) */
  totalCount: number;
  /** Total de páginas disponibles */
  totalPages: number;
  /** Indica si hay más páginas después de la actual */
  hasNextPage: boolean;
  /** Indica si hay páginas anteriores a la actual */
  hasPreviousPage: boolean;
  /** Timestamp del servidor para sincronización incremental */
  serverTimestamp: string;
}

export interface CreateOrderDto {
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  postventaId?: string;
  postventaName?: string;
  products: OrderProductDto[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
  paymentType: string;
  paymentMethod: string;
  paymentCondition?: string;
  paymentDetails?: PaymentDetailsDto;
  partialPayments?: PartialPaymentDto[];
  mixedPayments?: PartialPaymentDto[];
  deliveryAddress?: string;
  hasDelivery: boolean;
  deliveryServices?: {
    deliveryExpress?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioAcarreo?: {
      enabled: boolean;
      cost?: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioArmado?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
  };
  status?: string;
  productMarkups?: { [key: string]: number };
  createSupplierOrder?: boolean;
  observations?: string;
  dispatchObservations?: string;
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string } | null;
    EUR?: { rate: number; effectiveDate: string } | null;
    usd?: { rate: number; effectiveDate: string } | null;
    eur?: { rate: number; effectiveDate: string } | null;
  };
  baseCurrency?: "Bs" | "USD" | "EUR";
  type?: string;
}

export interface UpdateOrderDto {
  clientId?: string;
  clientName?: string;
  vendorId?: string;
  vendorName?: string;
  referrerId?: string;
  referrerName?: string;
  postventaId?: string;
  postventaName?: string;
  products?: OrderProductDto[];
  subtotal?: number;
  taxAmount?: number;
  deliveryCost?: number;
  total?: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  generalDiscountType?: string;
  generalDiscountPercent?: number;
  paymentType?: string;
  paymentMethod?: string;
  paymentCondition?: string;
  paymentDetails?: PaymentDetailsDto;
  partialPayments?: PartialPaymentDto[];
  mixedPayments?: PartialPaymentDto[];
  deliveryAddress?: string;
  hasDelivery?: boolean;
  deliveryServices?: {
    deliveryExpress?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioAcarreo?: {
      enabled: boolean;
      cost?: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioArmado?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
  };
  status?: string;
  productMarkups?: { [key: string]: number };
  createSupplierOrder?: boolean;
  observations?: string;
  dispatchObservations?: string;
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string } | null;
    EUR?: { rate: number; effectiveDate: string } | null;
    usd?: { rate: number; effectiveDate: string } | null;
    eur?: { rate: number; effectiveDate: string } | null;
  };
  type?: string;
  declineReason?: string;
}

export interface AccountResponseDto {
  id: string;
  code: string;
  label: string;
  storeId: string;
  isForeign: boolean;
  accountType: string;
  email?: string;
  wallet?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountDto {
  code: string;
  label: string;
  storeId: string;
  isForeign: boolean;
  accountType: string;
  email?: string;
  wallet?: string;
  isActive?: boolean;
}

export interface UpdateAccountDto {
  code?: string;
  label?: string;
  storeId?: string;
  isForeign?: boolean;
  accountType?: string;
  email?: string;
  wallet?: string;
  isActive?: boolean;
}

export interface StoreResponseDto {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  maxCapacity?: number;
  productDisplayLimits?: Record<string, number>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreDto {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  maxCapacity?: number;
  productDisplayLimits?: Record<string, number>;
  status?: string;
}

export interface UpdateStoreDto {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  rif?: string;
  maxCapacity?: number;
  productDisplayLimits?: Record<string, number>;
  status?: string;
}

export interface UpdateStoreDisplayLimitsDto {
  productDisplayLimits: Record<string, number>;
}

export interface WarehouseResponseDto {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  maxCapacity: number;
  isCentral: boolean;
  status: string;
}

export interface CreateWarehouseDto {
  name: string;
  code: string;
  address: string;
  phone: string;
  maxCapacity: number;
  isCentral: boolean;
}

export interface UpdateWarehouseDto {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  maxCapacity?: number;
  isCentral?: boolean;
  status?: string;
}

export interface PhysicalStockDto {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  locationType: 'store' | 'warehouse';
  locationId: string;
  locationName: string;
  attributes: Record<string, string>;
  variantKey: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  priceUsd: number;
  costUsd: number;
  updatedAt: string;
}

export interface ManualStockEntryDto {
  productId: string;
  locationType: string;
  locationId: string;
  attributes: Record<string, string>;
  quantity: number;
  costUsd: number;
  priceUsd: number;
  note?: string;
}

export interface StockImportSummaryDto {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

export interface StockReservationDto {
  id: string;
  stockId: string;
  productId: string;
  productName: string;
  locationId: string;
  locationName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  reservationType: string;
  orderNumber?: string;
  expiresAt: string;
  status: string;
  remainingSeconds: number;
}

export interface CreateStockReservationDto {
  stockId: string;
  vendorId: string;
  vendorName: string;
  quantity?: number;
  reservationType?: string;
}

export interface ExtendStockReservationDto {
  orderNumber: string;
}

export interface BulkUpdateProductStatusItemDto {
  orderId: string;
  productId: string;
  dispatchOrigin?: string;
}

export interface BulkUpdateProductStatusRequestDto {
  items: BulkUpdateProductStatusItemDto[];
  action: string;
  providerId?: string;
  providerName?: string;
  notes?: string;
  refabricationReason?: string;
}

export interface BulkUpdateProductStatusResponseDto {
  successCount: number;
  errorCount: number;
  errors: string[];
}

export interface CreateSupportTicketDto {
  category: string;
  priority: string;
  subject: string;
  description: string;
  currentUrl: string;
  clientInfo?: string;
}

export interface SupportTicketResponseDto {
  id: string;
  ticketCode: string;
  status: string;
  emailSent: boolean;
  message: string;
}

export interface StockTransferDto {
  id: string;
  transferNumber: string;
  stockId: string;
  productId: string;
  productName: string;
  sku: string;
  variantKey: string;
  attributes: Record<string, string>;
  originLocationId: string;
  originLocationName: string;
  originLocationType: string;
  destinationLocationId: string;
  destinationLocationName: string;
  destinationLocationType: string;
  quantity: number;
  status: string; // 'in_transit' | 'transferred' | 'cancelled'
  requestedBy: string;
  transferredBy?: string | null;
  reason?: string | null;
  transferredAt?: string | null;
  createdAt: string;
}

export interface CreateStockTransferDto {
  stockId: string;
  destinationLocationId: string;
  destinationLocationName: string;
  destinationLocationType: string;
  quantity: number;
  requestedBy: string;
  reason?: string;
}

export interface ManufacturingOrderDto {
  id: string;
  orderNumber: string;
  orderType: string;
  productId: string;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  quantity: number;
  destinationLocationId: string;
  destinationLocationName: string;
  destinationLocationType: string;
  requestedBy: string;
  providerId?: string | null;
  providerName?: string | null;
  costUsd: number;
  status: string; // 'Pendiente' | 'En Produccion' | 'Fabricado' | 'Cancelado'
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface CreateManufacturingOrderDto {
  productId: string;
  productName: string;
  sku: string;
  attributes?: Record<string, string>;
  quantity: number;
  destinationLocationId: string;
  destinationLocationName: string;
  destinationLocationType: string;
  requestedBy: string;
  providerId?: string;
  providerName?: string;
  costUsd: number;
  notes?: string;
}

export interface UpdateManufacturingOrderStatusDto {
  status: string;
  providerId?: string;
  providerName?: string;
  notes?: string;
}
