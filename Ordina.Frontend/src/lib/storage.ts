import {
  apiClient,
  type ClientResponseDto,
  type CreateClientDto,
  type UpdateClientDto,
  type ProviderResponseDto,
  type CreateProviderDto,
  type UpdateProviderDto,
  type StoreResponseDto,
  type CreateStoreDto,
  type UpdateStoreDto,
  type WarehouseResponseDto,
  type CreateWarehouseDto,
  type UpdateWarehouseDto,
  type AccountResponseDto,
  type CreateAccountDto,
  type UpdateAccountDto,
  type OrderResponseDto,
  type CreateOrderDto,
  type UpdateOrderDto,
  type UserResponseDto,
  type ProductListItemDto
} from './api-client'

import type {
  Client,
  Provider,
  Store,
  Warehouse,
  Account,
  Order,
  UnifiedOrder,
  Category,
  Product,
  User,
  DashboardMetrics,
  CommissionExclusivityMode,
  Vendor,
  Budget
} from '@/types'
import { inferOrderBaseCurrency } from './order-line-pricing'
import { getOrderPendingTotal, PAYMENT_BALANCE_EPSILON_BS } from './order-payments'
import { calculateProductUnitPriceWithAttributes } from './order-pricing-helpers'

// Re-export all domain types
export * from '@/types'
export * from './order-pricing-helpers'

export const INDEXEDDB_DATA_STORES: string[] = []
export const clearAllIndexedDBDataStores = async () => {}
export const getIndexedDBStoreStats = async (): Promise<{ name: string; count: number }[]> => []
export const bootSync = async () => {}
export const clearLastOrdersSyncAt = async () => {}

function isDashboardCompletedOrder(order: { status: string }): boolean {
  return order.status === 'Completado' || order.status === 'Entregado'
}

function getOrderCompletionDate(order: {
  completedAt?: string
  dispatchDate?: string
  updatedAt?: string
  createdAt: string
  status: string
}): Date | null {
  if (order.completedAt) return new Date(order.completedAt)
  if (order.dispatchDate) return new Date(order.dispatchDate)
  if (isDashboardCompletedOrder(order)) {
    return new Date(order.updatedAt || order.createdAt)
  }
  return null
}

export function getOrderDispatchDisplayDate(order: {
  completedAt?: string
  dispatchDate?: string
  updatedAt?: string
  createdAt: string
  status: string
  products?: any[]
}): Date | null {
  const fromCompletion = getOrderCompletionDate(order)
  if (fromCompletion && !Number.isNaN(fromCompletion.getTime())) {
    return fromCompletion
  }
  const deliveredMs = (order.products ?? [])
    .map((p: any) => p.deliveredAt)
    .filter((d): d is string => !!d?.trim())
    .map((d: string) => new Date(d).getTime())
    .filter((t: number) => !Number.isNaN(t))
  if (deliveredMs.length > 0) {
    return new Date(Math.max(...deliveredMs))
  }
  return order.createdAt ? new Date(order.createdAt) : null
}

export function orderToConvertBudgetDto(budget: any): any {
  return {
    budgetId: budget.id,
    orderNumber: budget.budgetNumber || budget.orderNumber,
    clientId: budget.clientId,
    vendorId: budget.vendorId,
    products: budget.products
  }
}

export async function persistConvertedBudgetLocally(budgetId: any, createdOrder?: any): Promise<void> {}

export function buildProductSalesMap(
  orders: { products?: any[] }[]
): Record<string, number> {
  const sales: Record<string, number> = {}
  for (const order of orders || []) {
    for (const line of order?.products || []) {
      const productId = (line.backendId || line.id).toString()
      sales[productId] = (sales[productId] || 0) + (line.quantity || 1)
    }
  }
  return sales
}

export const backendIdToNumber = (backendId: string): number => {
  const parsed = Number.parseInt(backendId)
  if (!Number.isNaN(parsed) && parsed > 0 && parsed.toString() === backendId) {
    return parsed
  }
  let hash = 0
  for (let i = 0; i < backendId.length; i++) {
    const char = backendId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hashValue = Math.abs(hash) || Date.now()
  return hashValue > 1000000 ? hashValue : hashValue + 1000000
}

// Client mappers & functions
export const clientFromBackendDto = (dto: ClientResponseDto): Client => ({
  id: dto.id,
  nombreRazonSocial: dto.nombreRazonSocial,
  apodo: dto.apodo,
  rutId: dto.rutId,
  direccion: dto.direccion,
  telefono: dto.telefono,
  telefono2: dto.telefono2,
  email: dto.email,
  tipoCliente: (dto.tipoCliente?.toLowerCase() as Client['tipoCliente']) || 'particular',
  estado: (dto.estado?.toLowerCase() as Client['estado']) || 'activo',
  fechaCreacion: dto.fechaCreacion,
  tieneNotasDespacho: dto.tieneNotasDespacho
})

export const getClients = async (): Promise<Client[]> => {
  try {
    const res = await apiClient.getClientsPaged(1, 1000)
    return (res?.items || []).map(clientFromBackendDto)
  } catch {
    return []
  }
}

export const getClient = async (id: string): Promise<Client | undefined> => {
  try {
    const res = await apiClient.getClientById(id)
    return res ? clientFromBackendDto(res) : undefined
  } catch {
    return undefined
  }
}

export const getClientFromCache = getClient

export const addClient = async (client: CreateClientDto): Promise<Client> => {
  const res = await apiClient.createClient(client)
  return clientFromBackendDto(res)
}

export const updateClient = async (id: string, client: UpdateClientDto): Promise<Client> => {
  const res = await apiClient.updateClient(id, client)
  return clientFromBackendDto(res)
}

export const deleteClient = async (id: string): Promise<void> => {
  await apiClient.deleteClient(id)
}

// Provider mappers & functions
export const providerFromBackendDto = (dto: ProviderResponseDto): Provider => ({
  id: dto.id,
  razonSocial: (dto as any).razonSocial || (dto as any).RazonSocial || dto.nombre || '',
  rif: (dto as any).rif || (dto as any).Rif || '',
  direccion: dto.direccion || '',
  telefono: dto.telefono || '',
  email: dto.email || '',
  contacto: dto.contacto || '',
  tipo: (dto.tipo as any) || 'productos-terminados',
  estado: (dto.estado as any) || 'activo',
  fechaCreacion: (dto as any).fechaCreacion || dto.createdAt || new Date().toISOString()
})

export const providerToCreateDto = (p: Omit<Provider, 'id'>): CreateProviderDto => ({
  nombre: p.razonSocial || '',
  razonSocial: p.razonSocial,
  rif: p.rif,
  direccion: p.direccion,
  telefono: p.telefono,
  email: p.email,
  contacto: p.contacto,
  tipo: p.tipo,
  estado: p.estado
})

export const providerToUpdateDto = (p: Partial<Provider>): UpdateProviderDto => ({
  nombre: p.razonSocial,
  razonSocial: p.razonSocial,
  rif: p.rif,
  direccion: p.direccion,
  telefono: p.telefono,
  email: p.email,
  contacto: p.contacto,
  tipo: p.tipo,
  estado: p.estado
})

export const getProviders = async (): Promise<Provider[]> => {
  try {
    const list = await apiClient.getProviders()
    return (list || []).map(providerFromBackendDto)
  } catch {
    return []
  }
}

export const getProvider = async (id: string): Promise<Provider | undefined> => {
  try {
    const p = await apiClient.getProviderById(id)
    return p ? providerFromBackendDto(p) : undefined
  } catch {
    return undefined
  }
}

export const addProvider = async (dto: any): Promise<Provider> => {
  const createDto: CreateProviderDto = {
    nombre: dto.razonSocial || dto.nombre || '',
    razonSocial: dto.razonSocial || dto.nombre || '',
    rif: dto.rif,
    direccion: dto.direccion,
    telefono: dto.telefono || '',
    email: dto.email,
    contacto: dto.contacto,
    tipo: dto.tipo,
    estado: dto.estado
  }
  const res = await apiClient.createProvider(createDto)
  return providerFromBackendDto(res)
}

export const updateProvider = async (id: string, dto: UpdateProviderDto): Promise<Provider> => {
  const res = await apiClient.updateProvider(id, dto)
  return providerFromBackendDto(res)
}

export const deleteProvider = async (id: string): Promise<void> => {
  await apiClient.deleteProvider(id)
}

export const syncProvidersFromBackend = async (): Promise<Provider[]> => {
  return getProviders()
}

// Store mappers & functions
export const storeFromBackendDto = (dto: StoreResponseDto): Store => ({
  id: dto.id,
  name: dto.name,
  code: dto.code,
  address: dto.address,
  phone: dto.phone,
  email: dto.email,
  rif: dto.rif,
  maxCapacity: dto.maxCapacity ?? 25,
  productDisplayLimits: dto.productDisplayLimits || {},
  status: dto.status as 'active' | 'inactive',
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt
})

export const storeToBackendDto = (s: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): CreateStoreDto => ({
  name: s.name,
  code: s.code,
  address: s.address,
  phone: s.phone,
  email: s.email,
  rif: s.rif,
  maxCapacity: s.maxCapacity ?? 25,
  productDisplayLimits: s.productDisplayLimits,
  status: s.status
})

export const getStores = async (status?: string): Promise<Store[]> => {
  try {
    const res = await apiClient.getStores(status)
    return (res || []).map(storeFromBackendDto)
  } catch {
    return []
  }
}

export const getStore = async (id: string): Promise<Store | undefined> => {
  try {
    const res = await apiClient.getStore(id)
    return res ? storeFromBackendDto(res) : undefined
  } catch {
    return undefined
  }
}

export const addStore = async (dto: CreateStoreDto): Promise<Store> => {
  const res = await apiClient.createStore(dto)
  return storeFromBackendDto(res)
}

export const updateStore = async (id: string, dto: UpdateStoreDto): Promise<Store> => {
  const res = await apiClient.updateStore(id, dto)
  return storeFromBackendDto(res)
}

export const updateStoreDisplayLimits = async (id: string, limits: Record<string, number>): Promise<Store> => {
  const res = await apiClient.updateStoreDisplayLimits(id, limits)
  return storeFromBackendDto(res)
}

export const deleteStore = async (id: string): Promise<void> => {
  await apiClient.deleteStore(id)
}

// Warehouse mappers & functions
export const warehouseFromBackendDto = (dto: WarehouseResponseDto): Warehouse => ({
  id: dto.id,
  name: dto.name,
  code: dto.code,
  address: dto.address,
  phone: dto.phone,
  maxCapacity: dto.maxCapacity,
  isCentral: dto.isCentral,
  status: dto.status as 'active' | 'inactive'
})

export const getWarehouses = async (): Promise<Warehouse[]> => {
  try {
    const res = await apiClient.getWarehouses()
    return (res || []).map(warehouseFromBackendDto)
  } catch {
    return []
  }
}

export const createWarehouse = async (dto: CreateWarehouseDto): Promise<Warehouse> => {
  const res = await apiClient.createWarehouse(dto)
  return warehouseFromBackendDto(res)
}

export const updateWarehouse = async (id: string, dto: UpdateWarehouseDto): Promise<Warehouse> => {
  const res = await apiClient.updateWarehouse(id, dto)
  return warehouseFromBackendDto(res)
}

export const deleteWarehouse = async (id: string): Promise<void> => {
  await apiClient.deleteWarehouse(id)
}

// Accounts
export const getAccounts = async (storeId?: string, isActive?: boolean): Promise<Account[]> => {
  try {
    const res = await apiClient.getAccounts(storeId, isActive)
    return (res || []) as unknown as Account[]
  } catch {
    return []
  }
}

export const getAccount = async (id: string): Promise<Account | undefined> => {
  try {
    return (await apiClient.getAccountById(id)) as unknown as Account
  } catch {
    return undefined
  }
}

export const addAccount = async (dto: CreateAccountDto): Promise<Account> => {
  return (await apiClient.createAccount(dto)) as unknown as Account
}

export const updateAccount = async (id: string, dto: UpdateAccountDto): Promise<Account> => {
  return (await apiClient.updateAccount(id, dto)) as unknown as Account
}

export const deleteAccount = async (id: string): Promise<void> => {
  await apiClient.deleteAccount(id)
}

// Categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const list = await apiClient.getCategories()
    return (list || []).map((c: any) => ({
      ...c,
      id: backendIdToNumber(c.id),
      backendId: c.id
    })) as unknown as Category[]
  } catch {
    return []
  }
}

export const getCategory = async (id: number): Promise<Category | undefined> => {
  const list = await getCategories()
  return list.find(c => c.id === id)
}

export const addCategory = async (cat: any): Promise<Category> => {
  const res = await apiClient.createCategory(cat)
  return { ...res, id: backendIdToNumber(res.id), backendId: res.id } as unknown as Category
}

export const updateCategory = async (id: number | string, cat: any): Promise<Category> => {
  const res = await apiClient.updateCategory(String(id), cat)
  return { ...res, id: backendIdToNumber(res.id), backendId: res.id } as unknown as Category
}

export const deleteCategory = async (id: number | string): Promise<void> => {
  await apiClient.deleteCategory(String(id))
}

// Products
export const productListItemDtoToProduct = (dto: ProductListItemDto): Product => ({
  id: backendIdToNumber(dto.id),
  backendId: dto.id,
  name: dto.name,
  category: (dto as any).categoryName || (dto as any).category || '',
  price: dto.price,
  priceCurrency: (dto as any).priceCurrency || 'USD',
  stock: dto.stock,
  status: dto.status,
  sku: dto.sku
})

export const getProducts = async (): Promise<Product[]> => {
  try {
    const list = await apiClient.getProducts()
    return (list || []).map((p: any) => ({
      ...p,
      id: backendIdToNumber(p.id),
      backendId: p.id
    }))
  } catch {
    return []
  }
}

export const getProduct = async (id: number): Promise<Product | undefined> => {
  const list = await getProducts()
  return list.find(p => p.id === id)
}

export const addProduct = async (p: any): Promise<Product> => {
  const res = await apiClient.createProduct(p)
  return { ...res, id: backendIdToNumber(res.id), backendId: res.id } as Product
}

export const updateProduct = async (id: number | string, p: any): Promise<Product> => {
  const res = await apiClient.updateProduct(String(id), p)
  return { ...res, id: backendIdToNumber(res.id), backendId: res.id } as Product
}

export const deleteProduct = async (id: number | string): Promise<void> => {
  await apiClient.deleteProduct(String(id))
}

export const getProductsByCategory = async (categoryName: string): Promise<Product[]> => {
  const all = await getProducts()
  return all.filter(p => p.category.toLowerCase() === categoryName.toLowerCase())
}

// Orders & Budgets
export const orderFromBackendDto = (dto: OrderResponseDto): Order => {
  const baseCurrency = (dto.baseCurrency as Order['baseCurrency']) ?? inferOrderBaseCurrency(dto as unknown as Order)

  const rawType = (dto.type ?? (dto as unknown as { Type?: string }).Type ?? '').trim().toLowerCase()
  const orderNumber = (dto.orderNumber ?? (dto as unknown as { OrderNumber?: string }).OrderNumber ?? '').trim()

  let type: Order['type'] = 'order'
  if (rawType === 'budget' || rawType === 'presupuesto' || (orderNumber.toUpperCase().startsWith('PRE-') && dto.status === 'Presupuesto')) {
    type = 'budget'
  } else if (rawType === 'reservation' || rawType === 'reserva' || (typeof orderNumber === 'string' && orderNumber.toUpperCase().startsWith('RES-'))) {
    type = 'reservation'
  }

  const rawPayments = (dto as any).payments || (dto as any).partialPayments || (dto as any).mixedPayments || []

  return {
    ...dto,
    type,
    orderNumber,
    declineReason:
      dto.declineReason ??
      (dto as unknown as { DeclineReason?: string }).DeclineReason ??
      undefined,
    products: (dto.products || []).map(p => ({
      ...p,
      priceCurrency: p.priceCurrency as any,
      stock: (p as any).stock ?? 0,
      status: (p as any).status || (p as any).manufacturingStatus || 'Por Fabricar'
    })) as any,
    payments: rawPayments.map((pay: any) => ({
      ...pay,
      currency: pay.currency as any
    })) as any,
    baseCurrency
  } as Order
}

export const orderToBackendDto = (order: Partial<Order>): CreateOrderDto => {
  return {
    ...order,
    type: order.type === 'budget' ? 'Budget' : order.type === 'reservation' ? 'Reservation' : 'Order'
  } as unknown as CreateOrderDto
}

export const orderDtoToUnifiedOrder = (dto: OrderResponseDto): UnifiedOrder => {
  const order = orderFromBackendDto(dto)
  return {
    ...order,
    type: order.type === 'budget' ? 'budget' : 'order',
  } as unknown as UnifiedOrder
}

export const getOrders = async (options?: any): Promise<Order[]> => {
  try {
    const res = await apiClient.getOrdersPaged(1, 1000)
    const list = res?.orders || (res as any)?.items || []
    const mapped = list.map(orderFromBackendDto)
    if (options?.onAllLoaded) {
      setTimeout(() => options.onAllLoaded(mapped), 0)
    }
    return mapped
  } catch {
    return []
  }
}

export const getOrder = async (id: string): Promise<Order | undefined> => {
  try {
    const res = await apiClient.getOrderById(id)
    return res ? orderFromBackendDto(res) : undefined
  } catch {
    return undefined
  }
}

export const getOrderFromCache = async (id?: string): Promise<any> => {
  if (id) return getOrder(id)
  return getOrders()
}

export const getOrdersFromCache = async (): Promise<Order[]> => {
  return getOrders()
}

export const getUnifiedOrders = async (options?: any): Promise<UnifiedOrder[]> => {
  const orders = await getOrders(options)
  return orders as unknown as UnifiedOrder[]
}

export const getOrderByOrderNumberPreferBackend = async (orderNumber: string): Promise<Order | undefined> => {
  try {
    const res = await apiClient.getOrderByOrderNumber(orderNumber)
    return res ? orderFromBackendDto(res) : undefined
  } catch {
    return undefined
  }
}

export const addOrder = async (order: any): Promise<Order> => {
  const res = await apiClient.createOrder(order)
  return orderFromBackendDto(res)
}

export const addReservationOrder = async (order: any): Promise<Order> => {
  return addOrder({ ...order, orderType: 'reservation' })
}

export const updateOrder = async (id: string, order: any): Promise<Order> => {
  const res = await apiClient.updateOrder(id, order)
  return orderFromBackendDto(res)
}

export const deleteOrder = async (id: string): Promise<void> => {
  await apiClient.deleteOrder(id)
}

export const getOrdersByClient = async (clientId: string): Promise<Order[]> => {
  const all = await getOrders()
  return all.filter(o => o.clientId === clientId)
}

export const getOrdersByStatus = async (status: string): Promise<Order[]> => {
  const all = await getOrders()
  return all.filter(o => o.status === status)
}

export const getReservations = async (): Promise<Order[]> => {
  const all = await getOrders()
  return all.filter(o => (o as any).orderType === 'reservation' || o.status === 'Reserva')
}

export const budgetFromOrder = (order: Order): Budget => {
  const validForDays = (order as any).validForDays || 30
  const createdAt = order.createdAt || new Date().toISOString()
  const expiresAt = (order as any).expiresAt || new Date(new Date(createdAt).getTime() + validForDays * 24 * 60 * 60 * 1000).toISOString()
  return {
    ...order,
    budgetNumber: (order as any).budgetNumber || order.orderNumber,
    expiresAt,
    validForDays,
    status: (order.status as Budget['status']) || 'Presupuesto'
  } as Budget
}

export const getBudgets = async (options?: any): Promise<Budget[]> => {
  const all = await getOrders(options)
  return all.filter(o => o.status === 'Presupuesto' || (o as any).orderType === 'budget').map(budgetFromOrder)
}

export const getBudget = async (id: string): Promise<Budget | undefined> => {
  const o = await getOrder(id)
  return o ? budgetFromOrder(o) : undefined
}

export const getBudgetByNumber = async (num: string): Promise<Budget | undefined> => {
  const o = await getOrderByOrderNumberPreferBackend(num)
  return o ? budgetFromOrder(o) : undefined
}

export const getBudgetsByClient = async (clientId: string): Promise<Budget[]> => {
  const all = await getBudgets()
  return all.filter(b => b.clientId === clientId)
}

export const getBudgetsByStatus = async (status: string): Promise<Budget[]> => {
  const all = await getBudgets()
  return all.filter(b => b.status === status)
}

export const addBudget = async (dto: any): Promise<Budget> => {
  const res = await addOrder({ ...dto, status: 'Presupuesto' })
  return budgetFromOrder(res)
}

export const updateBudget = async (id: string, dto: any): Promise<Budget> => {
  const res = await updateOrder(id, dto)
  return budgetFromOrder(res)
}

export const deleteBudget = async (id: string): Promise<void> => {
  return deleteOrder(id)
}

// Expired Layaways
export const getExpiredLayaways = async (): Promise<Array<Order & { daysExpired: number; pendingAmount: number }>> => {
  const orders = await getOrders()
  const now = new Date()

  return orders
    .filter(order => {
      if (order.saleType !== 'sistema_apartado' || order.status === 'Cancelado') return false
      const pending = getOrderPendingTotal(order)
      if (pending <= PAYMENT_BALANCE_EPSILON_BS) return false
      const created = new Date(order.createdAt || (order as any).orderDate || new Date().toISOString())
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays > 90
    })
    .map(order => {
      const created = new Date(order.createdAt || (order as any).orderDate || new Date().toISOString())
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...order,
        daysExpired: diffDays - 90,
        pendingAmount: getOrderPendingTotal(order)
      }
    })
}

// Users
export const COMMISSION_EXCLUSIVITY_MODES = {
  Shared: 'shared',
  Exclusive: 'exclusive',
  ExclusiveWithReferrer: 'exclusive_with_referrer'
} as const

export function normalizeCommissionExclusivityMode(
  mode?: string,
  exclusiveLegacy?: boolean
): CommissionExclusivityMode {
  if (
    mode === COMMISSION_EXCLUSIVITY_MODES.Exclusive ||
    mode === COMMISSION_EXCLUSIVITY_MODES.ExclusiveWithReferrer ||
    mode === COMMISSION_EXCLUSIVITY_MODES.Shared
  ) {
    return mode as CommissionExclusivityMode
  }
  if (exclusiveLegacy === true) return COMMISSION_EXCLUSIVITY_MODES.Exclusive
  return COMMISSION_EXCLUSIVITY_MODES.Shared
}

export const userFromBackendDto = (dto: UserResponseDto): User => ({
  id: dto.id,
  username: dto.username,
  email: dto.email,
  name: dto.name,
  role: dto.role as User['role'],
  status: dto.status as 'active' | 'inactive',
  createdAt: dto.createdAt || new Date().toISOString(),
  commissionExclusivityMode: normalizeCommissionExclusivityMode(
    dto.commissionExclusivityMode,
    dto.exclusiveCommission
  ),
  exclusiveCommission: dto.exclusiveCommission,
  baseSalary: dto.baseSalary !== undefined && dto.baseSalary !== null ? Number(dto.baseSalary) : undefined,
  baseSalaryCurrency: dto.baseSalaryCurrency,
  storeId: dto.storeId,
  storeName: dto.storeName,
  avatarUrl: dto.avatarUrl,
})

export const getUsers = async (status?: string): Promise<User[]> => {
  try {
    const res: any = await apiClient.getUsers(status)
    const list = Array.isArray(res) ? res : (res?.items ?? [])
    return list.map(userFromBackendDto)
  } catch {
    return []
  }
}

export const getUser = async (id: string): Promise<User | undefined> => {
  try {
    const u = await apiClient.getUserById(id)
    return u ? userFromBackendDto(u) : undefined
  } catch {
    return undefined
  }
}

export const addUser = async (dto: any): Promise<User> => {
  const u = await apiClient.createUser(dto)
  return userFromBackendDto(u)
}

export const updateUser = async (id: string, dto: any): Promise<User> => {
  const u = await apiClient.updateUser(id, dto)
  return userFromBackendDto(u)
}

export const deleteUser = async (id: string): Promise<void> => {
  await apiClient.deleteUser(id)
}

export const getVendors = async (): Promise<Vendor[]> => {
  const all = await getUsers('active')
  return all
    .filter(
      (u) =>
        (u.status === 'active' || !u.status) &&
        (u.role === 'Store Seller' ||
          u.role === 'Online Seller' ||
          (u.role as string) === 'Vendedor de tienda' ||
          (u.role as string) === 'Vendedor Online'),
    )
    .map((u) => ({ id: u.id, name: u.name, role: u.role, type: 'vendor' as const }))
}

export const getReferrers = async (): Promise<Vendor[]> => {
  const all = await getUsers('active')
  return all
    .filter(
      (u) =>
        (u.status === 'active' || !u.status) &&
        (u.role === 'Online Seller' || (u.role as string) === 'Vendedor Online'),
    )
    .map((u) => ({ id: u.id, name: u.name, role: u.role, type: 'referrer' as const }))
}

export const getOnlineSellerUserIds = async (): Promise<string[]> => {
  const users = await getUsers()
  return users.filter(u => u.role === 'Online Seller').map(u => u.id)
}

// Product Pricing Helpers
export const calculateProductTotalWithAttributes = (
  product: any,
  category: any,
  exchangeRates?: any
): number => {
  return (
    calculateProductUnitPriceWithAttributes(
      product.price,
      product.attributes,
      category,
      exchangeRates
    ) * (product.quantity || 1)
  )
}

// Dashboard metrics
export const calculateDashboardMetrics = async (
  period: 'day' | 'week' | 'month' | 'year' = 'week',
  existingOrders?: Order[]
): Promise<DashboardMetrics> => {
  try {
    const metrics = await apiClient.getDashboardMetrics(period)
    if (metrics) return metrics
  } catch {
    // fallback
  }

  const orders = existingOrders || (await getOrders())
  const completed = orders.filter(o => o.status === 'Completado').length
  const pending = orders.reduce((acc, o) => acc + getOrderPendingTotal(o), 0)
  const toMfg = orders.reduce(
    (acc, o) =>
      acc +
      (o.products?.filter(p => (p as any).status === 'Por Fabricar' || (p as any).status === 'En Fabricación').length || 0),
    0
  )
  const totalVal = orders.reduce((acc, o) => acc + (o.total || 0), 0)
  const avg = orders.length > 0 ? totalVal / orders.length : 0

  return {
    completedOrders: completed,
    completedOrdersChange: null,
    pendingPayments: pending,
    pendingPaymentsChange: null,
    productsToManufacture: toMfg,
    productsToManufactureChange: null,
    averageOrderValue: avg,
    averageOrderValueChange: null,
    totalSalesCount: completed,
    totalInvoiced: totalVal,
    totalInvoicedChange: null,
    totalCollected: Math.max(0, totalVal - pending),
    totalCollectedChange: null,
    expiredLayawaysCount: 0,
    expiredLayawaysAmount: 0
  }
}

export const propagateClientNameToOrders = async (
  _clientId: string,
  _newClientName: string
): Promise<void> => {}

export const batchUpsertProductCommissions = async (data: any[]): Promise<any[]> => {
  return apiClient.batchUpsertProductCommissions(data)
}

export const batchUpsertSaleTypeCommissionRules = async (data: any[]): Promise<any[]> => {
  return apiClient.batchUpsertSaleTypeCommissionRules(data)
}

export const seedDefaultSaleTypeRules = async (force = false): Promise<any[]> => {
  return apiClient.seedDefaultSaleTypeRules(force)
}

export const ensureSaleTypeRulesComplete = async (): Promise<{
  inserted: number
  rules: any[]
}> => {
  return apiClient.ensureSaleTypeRulesComplete()
}

export const getOrdersByIds = async (
  ids: string[]
): Promise<Map<string, Order>> => {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()
  const all = await getOrders()
  const idSet = new Set(uniqueIds)
  const result = new Map<string, Order>()
  for (const o of all) {
    if (idSet.has(o.id)) {
      result.set(o.id, o)
    }
  }
  return result
}


