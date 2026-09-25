import { telemetry } from './telemetry'
import { connectivityManager } from './connectivity'
import { localApi } from './local-api'
import type { OperationsMetricsSettings } from './metrics-thresholds'
import type {
  ClientResponseDto,
  CreateClientDto,
  UpdateClientDto,
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ProductResponseDto,
  CreateProductDto,
  UpdateProductDto,
  ProviderResponseDto,
  CreateProviderDto,
  UpdateProviderDto,
  StoreResponseDto,
  CreateStoreDto,
  UpdateStoreDto,
  WarehouseResponseDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  PhysicalStockDto,
  ManualStockEntryDto,
  StockImportSummaryDto,
  StockReservationDto,
  CreateStockReservationDto,
  ExtendStockReservationDto,
  AccountResponseDto,
  CreateAccountDto,
  UpdateAccountDto,
  OrderResponseDto,
  CreateOrderDto,
  UpdateOrderDto,
  ConvertBudgetToOrderDto,
  ConfirmOrderDto,
  OrderAuditLogDto,
  PagedAuditLogsResponseDto,
  PagedOrdersResponseDto,
  BulkUpdateProductStatusRequestDto,
  BulkUpdateProductStatusResponseDto,
  ConciliatePaymentRequestDto,
  ProductCommissionDto,
  CreateProductCommissionDto,
  SaleTypeCommissionRuleDto,
  CreateSaleTypeCommissionRuleDto,
  SaleTypeCommissionCompletenessDto,
  CommissionsReportQueryParams,
  CommissionReferrerOptionDto,
  CommissionReportRowDto,
  UserDto,
  UserResponseDto,
  CreateUserDto,
  UpdateUserDto,
  RoleResponseDto,
  CreateRoleDto,
  UpdateRoleDto,
  AssignablePermissionDto,
  GenerateAccessPinResponseDto,
  ValidateAccessPinResponseDto,
  AccessPinSessionResponseDto,
  AccessPinHistoryResponseDto,
  PagedResult,
  BulkDeleteResultDto,
  PaginatedResultDto,
  ProductListItemDto,
  CreateSupportTicketDto,
  SupportTicketResponseDto,
  StockTransferDto,
  CreateStockTransferDto,
  ManufacturingOrderDto,
  CreateManufacturingOrderDto,
  UpdateManufacturingOrderStatusDto
} from './api-client-dtos'
import type { ExchangeRate } from './currency-utils'

export interface NavigationSettingItemDto {
  id: string
  active: boolean
  superAdminOnly?: boolean
  allowedRoles?: string[]
}

export * from './api-client-dtos'

let inMemoryToken: string | null = null

export function setAuthToken(token: string | null) {
  inMemoryToken = token
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (!inMemoryToken && typeof localStorage !== 'undefined') {
    inMemoryToken = localStorage.getItem('auth_token')
  }
  return inMemoryToken
}

let refreshTokenPromise: Promise<string | null> | null = null

export async function requestTokenRefresh(): Promise<string | null> {
  if (refreshTokenPromise) {
    return refreshTokenPromise
  }

  refreshTokenPromise = (async () => {
    let explicitRejection = false
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      })

      if (refreshRes.ok) {
        const data = await refreshRes.json()
        if (data?.token) {
          setAuthToken(data.token)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('auth_last_active_at', Date.now().toString())
          }
          connectivityManager.reportSuccess()
          return data.token as string
        }
      }

      if (refreshRes.status === 401 || refreshRes.status === 403) {
        explicitRejection = true
      } else {
        connectivityManager.reportFailure({ statusCode: refreshRes.status })
      }
    } catch (err: any) {
      connectivityManager.reportFailure(err)
    } finally {
      refreshTokenPromise = null
    }

    if (typeof localStorage !== 'undefined') {
      const lastActive = Number(localStorage.getItem('auth_last_active_at') || '0')
      const ONE_HOUR = 60 * 60 * 1000
      // If within 1-hour grace period and not explicitly rejected by server (401/403)
      if (!explicitRejection && lastActive > 0 && Date.now() - lastActive < ONE_HOUR) {
        return getAuthToken()
      }

      setAuthToken(null)
      localStorage.removeItem('auth_last_active_at')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      } else if (typeof globalThis.dispatchEvent === 'function') {
        globalThis.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }

    return null
  })()

  return refreshTokenPromise
}

export class ApiError extends Error {
  statusCode: number
  data?: any

  constructor(message: string, statusCode: number, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.data = data
  }
}

interface RequestOptions extends RequestInit {
  mutationId?: string
  skipAuthRefresh?: boolean
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  const headers = new Headers(options.headers || {})
  headers.set('X-Requested-With', 'XMLHttpRequest')

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const mutationId = options.mutationId || (isMutation ? crypto.randomUUID() : undefined)
  if (mutationId) {
    headers.set('X-Mutation-Id', mutationId)
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/')
      ? endpoint
      : `/api/${endpoint}`

  try {
    const timeoutSignal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(10000) : undefined
    const effectiveSignal = options.signal || timeoutSignal

    const res = await fetch(url, {
      ...options,
      signal: effectiveSignal,
      headers,
      credentials: 'include'
    })

    if (res.status === 401 && !options.skipAuthRefresh && !endpoint.includes('/api/auth/')) {
      const refreshedToken = await requestTokenRefresh()
      if (refreshedToken) {
        return await apiFetch<T>(endpoint, { ...options, skipAuthRefresh: true })
      }
    }

    if (!res.ok) {
      let errorBody: any = null
      try {
        errorBody = await res.json()
      } catch {
        errorBody = await res.text()
      }

      const errorMessage = errorBody?.message || errorBody?.error || `HTTP ${res.status}: ${res.statusText}`
      const error = new ApiError(errorMessage, res.status, errorBody)

      connectivityManager.reportFailure(error)

      if (res.status >= 500) {
        telemetry.log('error', `API Failure: ${method} ${url}`, error.stack, { status: res.status, body: errorBody }, mutationId)
      }

      throw error
    }

    connectivityManager.reportSuccess()
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_last_active_at', Date.now().toString())
    }

    if (res.status === 204) {
      return {} as T
    }

    return await res.json()
  } catch (err: any) {
    const isCallerAborted = options.signal?.aborted === true
    if (isCallerAborted) {
      throw err
    }
    if (err instanceof ApiError) {
      throw err
    }
    const networkError = new ApiError('Error de conexión o modo sin conexión.', 0, { originalError: err?.message })
    connectivityManager.reportFailure(networkError)
    throw networkError
  }

}

// Analytics Dashboard types
export interface TrendDataPoint {
  date: string
  ordersCount: number
  invoicedUsd: number
  collectedUsd: number
}

export interface ForecastDataPoint {
  date: string
  label: string
  invoicedUsd?: number
  collectedUsd?: number
  projectedInvoiced?: number
  projectedCollected?: number
  benchmark3Yr?: number
}

export interface ForecastSummary {
  projectedInvoicedTotal: number
  projectedCollectedTotal: number
  benchmarkTotal?: number
  mapeScore: number
}

export interface SalesForecastResponse {
  points: ForecastDataPoint[]
  summary: ForecastSummary
}

export interface SaleTypeData {
  saleType: string
  label: string
  count: number
  totalUsd: number
}

export interface TopSeller {
  vendorId: string
  vendorName: string
  ordersCount: number
  totalUsd: number
  estimatedCommissionUsd?: number
  averageTicketUsd?: number
  unitsPerOrder?: number
  averageDiscountPercent?: number
  reservationConversionRate?: number
  convertedReservationsCount?: number
  sellerType?: 'store' | 'online'
  storeId?: string | null
  storeName?: string | null
}

export interface TopProduct {
  productName: string
  category: string
  unitsSold: number
  totalUsd: number
  hasAttributes?: boolean
}

export interface AttributeOptionStat {
  value: string
  unitsSold: number
  percentage: number
}

export interface AttributeBreakdown {
  attributeId: string
  attributeTitle: string
  totalUnitsWithAttribute: number
  options: AttributeOptionStat[]
  isSuggestedForGrouping?: boolean
}

export interface ProductVariantOrderSummary {
  orderNumber: string
  clientName: string
  createdAt: string
  quantity: number
  totalUsd: number
  status?: string
}

export interface ProductVariantStat {
  rank: number
  variantName: string
  attributes: Record<string, string>
  unitsSold: number
  percentage: number
  totalInvoicedUsd: number
  orderNumbers: string[]
  orders?: ProductVariantOrderSummary[]
}

export interface ProductAttributeBreakdownResponse {
  productName: string
  category: string
  totalUnitsSold: number
  totalInvoicedUsd?: number
  averageUnitPriceUsd?: number
  ordersCount?: number
  attributes: AttributeBreakdown[]
  topVariants?: ProductVariantStat[]
  totalUniqueVariantsCount?: number
  activeAttributeIds?: string[]
}

export interface PipelineSnapshot {
  manufacturing: number
  warehouse: number
  dispatch: number
  delivered: number
  manufacturingUsd?: number
  warehouseUsd?: number
  dispatchUsd?: number
  deliveredUsd?: number
}

export interface ExpiredLayawayAgeRange {
  range: string
  label: string
  count: number
  totalUsd: number
}

export interface AovByBranch {
  branchId: string
  branchName: string
  averageOrderValue: number
  ordersCount: number
  totalSalesUsd: number
}

export interface AgingReport {
  range: string
  label: string
  count: number
  totalBalanceUsd: number
}

export interface PaymentMix {
  method: string
  label: string
  count: number
  totalUsd: number
  percentage: number
}

export interface ManufacturingLeadTime {
  category: string
  averageDays: number
  completedUnits: number
}

export interface OtifMetrics {
  otifRate: number
  onTimeOrders: number
  delayedOrders: number
  totalDeliveredOrders: number
}

export interface StageDwellTime {
  stageName: string
  averageDays: number
  activeOrdersCount: number
}

export interface FulfillmentRatio {
  immediateCount: number
  immediatePercentage: number
  madeToOrderCount: number
  madeToOrderPercentage: number
}

export interface ConversionRate {
  totalReservations: number
  convertedOrders: number
  winRatePercentage: number
  convertedVolumeUsd: number
}

export interface ClosingVelocity {
  averageDaysToClose: number
  medianHoursToFirstPayment: number
  analyzedOrdersCount: number
}

export interface ReplenishmentSuggestion {
  productName: string
  variantName: string
  attributes: Record<string, string>
  salesRank: number
  currentStockTerrinca: number
  currentStockStores: number
  suggestedQuantity: number
  priority: string
}

export interface StockTurnover {
  averageDaysInWarehouse: number
  slowMovingItemsCount: number
  totalActiveStockUnits: number
}

export interface StockoutRate {
  stockoutRatePercentage: number
  stockoutIncidentsCount: number
  statusNote: string
}

export interface StoreOccupancy {
  storeId: string
  storeName: string
  currentItems: number
  maxCapacity: number
  occupancyPercentage: number
  statusNote: string
}

export interface AgingOrderDetail {
  orderId: string
  orderNumber: string
  createdAt: string
  clientName: string
  vendorName: string
  storeName: string
  status: string
  saleType: string
  totalUsd: number
  paidUsd: number
  pendingBalanceUsd: number
  daysElapsed: number
  daysExpired: number
  rangeKey: string
  rangeLabel: string
}

export interface PaymentDrillDown {
  paymentId: string
  orderId: string
  orderNumber: string
  paymentDate: string
  orderDate: string
  clientName: string
  vendorName: string
  storeName: string
  method: string
  reference: string
  bank: string
  amountUsd: number
  amountBs: number
  exchangeRate: number
  isConciliated: boolean
  status: string
  isFromCurrentPeriodOrder: boolean
}

export interface CollectedDrillDownResponse {
  totalCollectedUsd: number
  currentPeriodCollectedUsd: number
  priorPeriodCollectedUsd: number
  currentPeriodPercentage: number
  priorPeriodPercentage: number
  currentPeriodPayments: PaymentDrillDown[]
  priorPeriodPayments: PaymentDrillDown[]
}

export interface CasheaDrillDownItem {
  orderId: string
  orderNumber: string
  orderDate: string
  clientName: string
  vendorName: string
  storeName: string
  totalOrderUsd: number
  downPaymentUsd: number
  financedCasheaUsd: number
  collectedCasheaUsd: number
  pendingCasheaUsd: number
  isFullyReconciled: boolean
  status: string
}

export interface CasheaDrillDownResponse {
  totalOrdersCount: number
  totalOrdersVolumeUsd: number
  totalDownPaymentUsd: number
  totalFinancedCasheaUsd: number
  totalCollectedCasheaUsd: number
  totalPendingCasheaUsd: number
  orders: CasheaDrillDownItem[]
}

export class ApiClientClass {
  // Auth
  async login(username: string, password: string, rememberMe = false): Promise<{ token: string; refreshToken: string; expiresAt: string; refreshTokenExpiresAt: string; user: UserDto }> {
    return apiFetch<{ token: string; refreshToken: string; expiresAt: string; refreshTokenExpiresAt: string; user: UserDto }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe })
    })
  }

  async refreshToken(): Promise<boolean> {
    const token = await requestTokenRefresh()
    return !!token
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return apiFetch<void>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    })
  }

  // Users & Roles
  async getUsers(status?: string): Promise<UserResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getUsers()) as unknown as UserResponseDto[]
    }
    try {
      const query = status ? `?status=${encodeURIComponent(status)}&pageSize=1000` : '?pageSize=1000'
      const res = await apiFetch<any>(`/api/users${query}`)
      const items = Array.isArray(res) ? res : res && Array.isArray(res.items) ? res.items : []
      localApi.cacheEntities('users', items).catch(() => {})
      return items
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getUsers()) as unknown as UserResponseDto[]
      }
      throw err
    }
  }

  async getUserById(id: string): Promise<UserResponseDto> {
    return apiFetch<UserResponseDto>(`/api/users/${id}`)
  }

  async getUserByUsername(username: string): Promise<UserResponseDto | null> {
    try {
      return await apiFetch<UserResponseDto>(`/api/users/username/${encodeURIComponent(username)}`)
    } catch {
      return null
    }
  }

  async getUserByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      return await apiFetch<UserResponseDto>(`/api/users/email/${encodeURIComponent(email)}`)
    } catch {
      return null
    }
  }

  async getAssignableUserPermissions(): Promise<AssignablePermissionDto[]> {
    return apiFetch<AssignablePermissionDto[]>('/api/users/permissions')
  }

  async createUser(user: CreateUserDto): Promise<UserResponseDto> {
    return apiFetch<UserResponseDto>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user)
    })
  }

  async updateUser(id: string, user: UpdateUserDto): Promise<UserResponseDto> {
    return apiFetch<UserResponseDto>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user)
    })
  }

  async regenerateUserPassword(userId: string): Promise<{ temporaryPassword: string }> {
    return apiFetch<{ temporaryPassword: string }>(`/api/users/${userId}/regenerate-password`, {
      method: 'POST'
    })
  }

  async deleteUser(id: string): Promise<void> {
    return apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' })
  }

  async getRoles(): Promise<RoleResponseDto[]> {
    return apiFetch<RoleResponseDto[]>('/api/users/roles')
  }

  async getRoleById(id: string): Promise<RoleResponseDto> {
    return apiFetch<RoleResponseDto>(`/api/users/roles/${id}`)
  }

  async createRole(role: CreateRoleDto): Promise<RoleResponseDto> {
    return apiFetch<RoleResponseDto>('/api/users/roles', {
      method: 'POST',
      body: JSON.stringify(role)
    })
  }

  async updateRole(id: string, role: UpdateRoleDto): Promise<RoleResponseDto> {
    return apiFetch<RoleResponseDto>(`/api/users/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(role)
    })
  }

  async deleteRole(id: string): Promise<void> {
    return apiFetch<void>(`/api/users/roles/${id}`, { method: 'DELETE' })
  }

  // Navigation Settings
  async getNavigationSettings(): Promise<NavigationSettingItemDto[]> {
    return apiFetch<NavigationSettingItemDto[]>('/api/NavigationSettings')
  }

  async updateNavigationSettings(items: NavigationSettingItemDto[]): Promise<NavigationSettingItemDto[]> {
    return apiFetch<NavigationSettingItemDto[]>('/api/NavigationSettings', {
      method: 'PUT',
      body: JSON.stringify(items),
    })
  }

  // Categories
  async getCategories(): Promise<CategoryResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getCategories()) as unknown as CategoryResponseDto[]
    }
    try {
      const res = await apiFetch<CategoryResponseDto[]>('/api/categories')
      localApi.cacheEntities('categories', res).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getCategories()) as unknown as CategoryResponseDto[]
      }
      throw err
    }
  }

  async getCategoryById(id: string): Promise<CategoryResponseDto> {
    return apiFetch<CategoryResponseDto>(`/api/categories/${id}`)
  }

  async getCategoryByName(name: string): Promise<CategoryResponseDto | undefined> {
    const list = await this.getCategories()
    return list.find(c => c.name.toLowerCase() === name.toLowerCase())
  }

  async createCategory(category: CreateCategoryDto): Promise<CategoryResponseDto> {
    return apiFetch<CategoryResponseDto>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(category)
    })
  }

  async updateCategory(id: string, category: UpdateCategoryDto): Promise<CategoryResponseDto> {
    return apiFetch<CategoryResponseDto>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category)
    })
  }

  async deleteCategory(id: string): Promise<void> {
    return apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' })
  }

  // Products
  async getProducts(): Promise<ProductResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getProducts()) as unknown as ProductResponseDto[]
    }
    try {
      const res = await apiFetch<ProductResponseDto[]>('/api/products/all')
      localApi.cacheEntities('products', res).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getProducts()) as unknown as ProductResponseDto[]
      }
      throw err
    }
  }



  async getProductById(id: string): Promise<ProductResponseDto> {
    return apiFetch<ProductResponseDto>(`/api/products/${id}`)
  }

  async getProductBySku(sku: string): Promise<ProductResponseDto> {
    return apiFetch<ProductResponseDto>(`/api/products/sku/${encodeURIComponent(sku)}`)
  }

  async getProductsByCategory(categoryId: string): Promise<ProductResponseDto[]> {
    return apiFetch<ProductResponseDto[]>(`/api/products/category/${categoryId}`)
  }

  async createProduct(product: CreateProductDto): Promise<ProductResponseDto> {
    return apiFetch<ProductResponseDto>('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    })
  }

  async updateProduct(id: string, product: UpdateProductDto): Promise<ProductResponseDto> {
    return apiFetch<ProductResponseDto>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    })
  }

  async deleteProduct(id: string): Promise<void> {
    return apiFetch<void>(`/api/products/${id}`, { method: 'DELETE' })
  }



  // Providers
  async getProviders(): Promise<ProviderResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getProviders()) as unknown as ProviderResponseDto[]
    }
    try {
      const res = await apiFetch<ProviderResponseDto[]>('/api/providers/all')
      localApi.cacheEntities('providers', res).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getProviders()) as unknown as ProviderResponseDto[]
      }
      throw err
    }
  }

  async getProvidersPaged(page = 1, pageSize = 20, search?: string, signal?: AbortSignal): Promise<PagedResult<ProviderResponseDto>> {
    const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
    if (search) query.set('search', search)
    return apiFetch<PagedResult<ProviderResponseDto>>(`/api/providers?${query.toString()}`, { signal })
  }

  async getProviderById(id: string): Promise<ProviderResponseDto> {
    return apiFetch<ProviderResponseDto>(`/api/providers/${id}`)
  }

  async createProvider(provider: CreateProviderDto): Promise<ProviderResponseDto> {
    return apiFetch<ProviderResponseDto>('/api/providers', {
      method: 'POST',
      body: JSON.stringify(provider)
    })
  }

  async updateProvider(id: string, provider: UpdateProviderDto): Promise<ProviderResponseDto> {
    return apiFetch<ProviderResponseDto>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(provider)
    })
  }

  async deleteProvider(id: string): Promise<void> {
    return apiFetch<void>(`/api/providers/${id}`, { method: 'DELETE' })
  }

  // Clients
  async getClientsPaged(page = 1, pageSize = 20, search?: string, signal?: AbortSignal): Promise<PagedResult<ClientResponseDto>> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getClientsPaged(page, pageSize, search)) as unknown as PagedResult<ClientResponseDto>
    }
    try {
      const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      if (search) query.set('search', search)
      const res = await apiFetch<PagedResult<ClientResponseDto>>(`/api/clients?${query.toString()}`, { signal })
      if (res?.items) {
        localApi.cacheEntities('clients', res.items).catch(() => {})
      }
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getClientsPaged(page, pageSize, search)) as unknown as PagedResult<ClientResponseDto>
      }
      throw err
    }
  }

  async getClientById(id: string): Promise<ClientResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      const cached = await localApi.getClient(id)
      if (cached) return cached as unknown as ClientResponseDto
    }
    try {
      const res = await apiFetch<ClientResponseDto>(`/api/clients/${id}`)
      localApi.cacheEntities('clients', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        const cached = await localApi.getClient(id)
        if (cached) return cached as unknown as ClientResponseDto
      }
      throw err
    }
  }

  async getClientByRut(rut: string): Promise<ClientResponseDto> {
    return apiFetch<ClientResponseDto>(`/api/clients/rut/${encodeURIComponent(rut)}`)
  }

  async createClient(client: CreateClientDto): Promise<ClientResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.createClient(client)) as unknown as ClientResponseDto
    }
    try {
      const res = await apiFetch<ClientResponseDto>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(client)
      })
      localApi.cacheEntities('clients', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.createClient(client)) as unknown as ClientResponseDto
      }
      throw err
    }
  }

  async updateClient(id: string, client: UpdateClientDto): Promise<ClientResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.updateClient(id, client)) as unknown as ClientResponseDto
    }
    try {
      const res = await apiFetch<ClientResponseDto>(`/api/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(client)
      })
      localApi.cacheEntities('clients', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.updateClient(id, client)) as unknown as ClientResponseDto
      }
      throw err
    }
  }

  async deleteClient(id: string): Promise<void> {
    return apiFetch<void>(`/api/clients/${id}`, { method: 'DELETE' })
  }

  // Stores & Accounts
  async getStores(status?: string): Promise<StoreResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getStores(status)) as unknown as StoreResponseDto[]
    }
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : ''
      const res = await apiFetch<StoreResponseDto[]>(`/api/stores${query}`)
      localApi.cacheEntities('stores', res).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getStores(status)) as unknown as StoreResponseDto[]
      }
      throw err
    }
  }

  async getStore(id: string): Promise<StoreResponseDto> {
    return apiFetch<StoreResponseDto>(`/api/stores/${id}`)
  }

  async createStore(dto: CreateStoreDto): Promise<StoreResponseDto> {
    return apiFetch<StoreResponseDto>('/api/stores', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async updateStore(id: string, dto: UpdateStoreDto): Promise<StoreResponseDto> {
    return apiFetch<StoreResponseDto>(`/api/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto)
    })
  }

  async updateStoreDisplayLimits(id: string, limits: Record<string, number>): Promise<StoreResponseDto> {
    return apiFetch<StoreResponseDto>(`/api/stores/${id}/display-limits`, {
      method: 'PUT',
      body: JSON.stringify({ productDisplayLimits: limits })
    })
  }

  async deleteStore(id: string): Promise<void> {
    return apiFetch<void>(`/api/stores/${id}`, { method: 'DELETE' })
  }

  // Warehouses
  async getWarehouses(): Promise<WarehouseResponseDto[]> {
    return apiFetch<WarehouseResponseDto[]>('/api/warehouses')
  }

  async getWarehouse(id: string): Promise<WarehouseResponseDto> {
    return apiFetch<WarehouseResponseDto>(`/api/warehouses/${id}`)
  }

  async createWarehouse(dto: CreateWarehouseDto): Promise<WarehouseResponseDto> {
    return apiFetch<WarehouseResponseDto>('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto): Promise<WarehouseResponseDto> {
    return apiFetch<WarehouseResponseDto>(`/api/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto)
    })
  }

  async deleteWarehouse(id: string): Promise<void> {
    return apiFetch<void>(`/api/warehouses/${id}`, { method: 'DELETE' })
  }

  // Physical Stock
  async getStockList(params?: { locationId?: string; categoryId?: string; search?: string; onlyAvailable?: boolean }): Promise<PhysicalStockDto[]> {
    const query = new URLSearchParams()
    if (params?.locationId) query.set('locationId', params.locationId)
    if (params?.categoryId) query.set('categoryId', params.categoryId)
    if (params?.search) query.set('search', params.search)
    if (params?.onlyAvailable !== undefined) query.set('onlyAvailable', params.onlyAvailable.toString())
    const qStr = query.toString() ? `?${query.toString()}` : ''
    return apiFetch<PhysicalStockDto[]>(`/api/stock${qStr}`)
  }

  async getStockItem(id: string): Promise<PhysicalStockDto> {
    return apiFetch<PhysicalStockDto>(`/api/stock/${id}`)
  }

  async addManualStock(dto: ManualStockEntryDto): Promise<PhysicalStockDto> {
    return apiFetch<PhysicalStockDto>('/api/stock/manual-entry', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async importStockExcel(file: File): Promise<StockImportSummaryDto> {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetch<StockImportSummaryDto>('/api/stock/import-excel', {
      method: 'POST',
      body: formData
    })
  }

  async downloadStockTemplate(): Promise<Blob> {
    const headers = new Headers()
    headers.set('X-Requested-With', 'XMLHttpRequest')
    const token = getAuthToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch('/api/stock/import-template', { headers, credentials: 'include' })
    if (!res.ok) throw new Error('Error al descargar plantilla de stock')
    return res.blob()
  }

  // Stock Reservations
  async reserveStockItem(dto: CreateStockReservationDto): Promise<StockReservationDto> {
    return apiFetch<StockReservationDto>('/api/stock/reservations', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async getActiveReservations(vendorId?: string): Promise<StockReservationDto[]> {
    const query = vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ''
    return apiFetch<StockReservationDto[]>(`/api/stock/reservations/active${query}`)
  }

  async getActiveReservationByStockId(stockId: string): Promise<StockReservationDto | null> {
    try {
      return await apiFetch<StockReservationDto>(`/api/stock/${stockId}/reservation`)
    } catch {
      return null
    }
  }

  async releaseStockReservation(id: string): Promise<void> {
    return apiFetch<void>(`/api/stock/reservations/${id}/release`, { method: 'POST' })
  }

  async extendStockReservation(id: string, orderNumber: string): Promise<StockReservationDto> {
    return apiFetch<StockReservationDto>(`/api/stock/reservations/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ orderNumber })
    })
  }

  async confirmStockReservation(id: string, orderNumber: string): Promise<void> {
    return apiFetch<void>(`/api/stock/reservations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ orderNumber })
    })
  }

  // Stock Transfers
  async getStockTransfers(status?: string, locationId?: string): Promise<StockTransferDto[]> {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (locationId) params.set('locationId', locationId)
    const qStr = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<StockTransferDto[]>(`/api/stock-transfers${qStr}`)
  }

  async getStockTransferById(id: string): Promise<StockTransferDto> {
    return apiFetch<StockTransferDto>(`/api/stock-transfers/${id}`)
  }

  async createStockTransfer(dto: CreateStockTransferDto): Promise<StockTransferDto> {
    return apiFetch<StockTransferDto>('/api/stock-transfers', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async confirmStockTransfer(id: string, transferredBy?: string): Promise<StockTransferDto> {
    return apiFetch<StockTransferDto>(`/api/stock-transfers/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ transferredBy })
    })
  }

  async cancelStockTransfer(id: string): Promise<void> {
    return apiFetch<void>(`/api/stock-transfers/${id}/cancel`, {
      method: 'POST'
    })
  }

  // Manufacturing Orders (Stock)
  async getManufacturingOrders(status?: string, destinationLocationId?: string): Promise<ManufacturingOrderDto[]> {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (destinationLocationId) params.set('destinationLocationId', destinationLocationId)
    const qStr = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<ManufacturingOrderDto[]>(`/api/manufacturing-orders${qStr}`)
  }

  async getManufacturingOrderById(id: string): Promise<ManufacturingOrderDto> {
    return apiFetch<ManufacturingOrderDto>(`/api/manufacturing-orders/${id}`)
  }

  async createManufacturingOrder(dto: CreateManufacturingOrderDto): Promise<ManufacturingOrderDto> {
    return apiFetch<ManufacturingOrderDto>('/api/manufacturing-orders', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async updateManufacturingOrderStatus(id: string, dto: UpdateManufacturingOrderStatusDto): Promise<ManufacturingOrderDto> {
    return apiFetch<ManufacturingOrderDto>(`/api/manufacturing-orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(dto)
    })
  }

  async cancelManufacturingOrder(id: string): Promise<void> {
    return apiFetch<void>(`/api/manufacturing-orders/${id}/cancel`, {
      method: 'POST'
    })
  }

  async getAccounts(storeId?: string, isActive?: boolean): Promise<AccountResponseDto[]> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getAccounts(storeId, isActive)) as unknown as AccountResponseDto[]
    }
    try {
      const query = new URLSearchParams()
      if (storeId) query.set('storeId', storeId)
      if (isActive !== undefined) query.set('isActive', isActive.toString())
      const qStr = query.toString() ? `?${query.toString()}` : ''
      const res = await apiFetch<AccountResponseDto[]>(`/api/stores/accounts${qStr}`)
      localApi.cacheEntities('accounts', res).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getAccounts(storeId, isActive)) as unknown as AccountResponseDto[]
      }
      throw err
    }
  }

  async getAccountById(id: string): Promise<AccountResponseDto> {
    return apiFetch<AccountResponseDto>(`/api/stores/accounts/${id}`)
  }

  async createAccount(account: CreateAccountDto): Promise<AccountResponseDto> {
    return apiFetch<AccountResponseDto>('/api/stores/accounts', {
      method: 'POST',
      body: JSON.stringify(account)
    })
  }

  async updateAccount(id: string, account: UpdateAccountDto): Promise<AccountResponseDto> {
    return apiFetch<AccountResponseDto>(`/api/stores/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(account)
    })
  }

  async deleteAccount(id: string): Promise<void> {
    return apiFetch<void>(`/api/stores/accounts/${id}`, { method: 'DELETE' })
  }

  // Orders
  async getOrdersPaged(
    page = 1,
    pageSize = 50,
    since?: string,
    filters?: {
      search?: string
      clientSearch?: string
      vendor?: string
      status?: string
      saleType?: string
      dateFrom?: string
      dateTo?: string
      includeBudgets?: boolean
      locationStatus?: string
      manufacturingStatus?: string
      excludeStatuses?: string
      productFilterPreset?: string
    },
    signal?: AbortSignal
  ): Promise<PagedOrdersResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.getOrdersPaged(page, pageSize, filters)) as unknown as PagedOrdersResponseDto
    }
    try {
      const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      if (since) query.set('since', since)
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            query.set(k, String(v))
          }
        })
      }
      const res = await apiFetch<PagedOrdersResponseDto>(`/api/orders?${query.toString()}`, { signal })
      const orderList = res?.orders || (res as any)?.items || []
      if (Array.isArray(orderList) && orderList.length > 0) {
        localApi.cacheEntities('orders', orderList).catch(() => {})
      }
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.getOrdersPaged(page, pageSize, filters)) as unknown as PagedOrdersResponseDto
      }
      throw err
    }
  }

  async getOrderById(id: string): Promise<OrderResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      const cached = await localApi.getOrder(id)
      if (cached) return cached as unknown as OrderResponseDto
    }
    try {
      const res = await apiFetch<OrderResponseDto>(`/api/orders/${id}`)
      localApi.cacheEntities('orders', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        const cached = await localApi.getOrder(id)
        if (cached) return cached as unknown as OrderResponseDto
      }
      throw err
    }
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<OrderResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      const cached = await localApi.getOrderByOrderNumber(orderNumber)
      if (cached) return cached as unknown as OrderResponseDto
    }
    try {
      const res = await apiFetch<OrderResponseDto>(`/api/orders/number/${encodeURIComponent(orderNumber)}`)
      localApi.cacheEntities('orders', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        const cached = await localApi.getOrderByOrderNumber(orderNumber)
        if (cached) return cached as unknown as OrderResponseDto
      }
      throw err
    }
  }

  async createOrder(order: CreateOrderDto): Promise<OrderResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.createOrder(order)) as unknown as OrderResponseDto
    }
    try {
      return await apiFetch<OrderResponseDto>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(order)
      })
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.createOrder(order)) as unknown as OrderResponseDto
      }
      throw err
    }
  }

  async updateOrder(id: string, order: UpdateOrderDto): Promise<OrderResponseDto> {
    if (connectivityManager.isServerUnreachable()) {
      return (await localApi.updateOrder(id, order)) as unknown as OrderResponseDto
    }
    try {
      const res = await apiFetch<OrderResponseDto>(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(order)
      })
      localApi.cacheEntities('orders', [res]).catch(() => {})
      return res
    } catch (err: any) {
      if (connectivityManager.isServerUnreachable()) {
        return (await localApi.updateOrder(id, order)) as unknown as OrderResponseDto
      }
      throw err
    }
  }

  async convertBudgetToOrder(id: string, body: ConvertBudgetToOrderDto): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>('/api/orders/convert-budget', {
      method: 'POST',
      body: JSON.stringify({ ...body, budgetId: id })
    })
  }

  async deleteOrder(id: string): Promise<void> {
    return apiFetch<void>(`/api/orders/${id}`, { method: 'DELETE' })
  }

  async bulkUpdateProductStatus(dto: BulkUpdateProductStatusRequestDto): Promise<BulkUpdateProductStatusResponseDto> {
    return apiFetch<BulkUpdateProductStatusResponseDto>('/api/orders/bulk-update-status', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async confirmPendingOrder(id: string, body: ConfirmOrderDto): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>(`/api/orders/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async declineOrder(orderId: string, reason?: string): Promise<void> {
    return apiFetch<void>(`/api/orders/${orderId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  }

  async reactivateOrder(orderId: string): Promise<void> {
    return apiFetch<void>(`/api/orders/${orderId}/reactivate`, {
      method: 'POST'
    })
  }

  // Finance & Exchange Rates
  async getActiveExchangeRates(): Promise<ExchangeRate[]> {
    return apiFetch<ExchangeRate[]>('/api/finance/exchange-rates/active')
  }

  async getExchangeRateHistory(days = 30): Promise<ExchangeRate[]> {
    return apiFetch<ExchangeRate[]>(`/api/finance/exchange-rates/history?days=${days}`)
  }

  async getExchangeRateForDate(toCurrency: string, date: string, fromCurrency = 'Bs'): Promise<ExchangeRate | null> {
    try {
      return await apiFetch<ExchangeRate>(`/api/finance/exchange-rates/for-date?to=${toCurrency}&from=${fromCurrency}&date=${date}`)
    } catch {
      return null
    }
  }

  async getLatestExchangeRate(toCurrency: string, fromCurrency = 'Bs'): Promise<ExchangeRate | null> {
    try {
      return await apiFetch<ExchangeRate>(`/api/finance/exchange-rates/latest?toCurrency=${toCurrency}&fromCurrency=${fromCurrency}`)
    } catch {
      return null
    }
  }

  async setExchangeRate(data: { fromCurrency: string; toCurrency: string; rate: number }): Promise<ExchangeRate> {
    return apiFetch<ExchangeRate>('/api/finance/exchange-rates', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Manufacturing
  async getManufacturingKanban(providerId?: string): Promise<any> {
    const query = providerId ? `?providerId=${encodeURIComponent(providerId)}` : ''
    return apiFetch(`/api/manufacturing/kanban${query}`)
  }

  async getManufacturingItems(stage: string): Promise<any[]> {
    return apiFetch<any[]>(`/api/manufacturing/items?stage=${encodeURIComponent(stage)}`)
  }

  async updateManufacturingStage(dto: { orderId: string; productId: string; stage: string }): Promise<void> {
    return apiFetch<void>('/api/manufacturing/stage', {
      method: 'PATCH',
      body: JSON.stringify(dto)
    })
  }

  async refabricateProduct(dto: { orderId: string; productId: string; reason: string }): Promise<void> {
    return apiFetch<void>('/api/manufacturing/refabricate', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  async getManufacturingReport(status?: string, manufacturerId?: string): Promise<any[]> {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (manufacturerId) query.set('manufacturerId', manufacturerId)
    const qStr = query.toString() ? `?${query.toString()}` : ''
    return apiFetch<any[]>(`/api/manufacturing/report${qStr}`)
  }

  // Dashboard
  async getDashboardMetrics(
    period = 'day',
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<any> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams({ period })
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    return apiFetch<any>(`/api/dashboard/metrics?${params.toString()}`, { signal: sig })
  }

  async getSalesTrend(
    days = 30,
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<TrendDataPoint[]> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams({ days: String(days) })
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    return apiFetch<TrendDataPoint[]>(`/api/dashboard/trend?${params.toString()}`, { signal: sig }).then(r => r ?? [])
  }

  async getSalesForecast(period = 'month', signal?: AbortSignal): Promise<SalesForecastResponse> {
    return apiFetch<SalesForecastResponse>(`/api/dashboard/forecast?period=${period}`, { signal })
      .then(r => r ?? { points: [], summary: { projectedInvoicedTotal: 0, projectedCollectedTotal: 0, mapeScore: 0 } })
  }

  async getBySaleType(
    period = 'month',
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<SaleTypeData[]> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams({ period })
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    return apiFetch<SaleTypeData[]>(`/api/dashboard/by-sale-type?${params.toString()}`, { signal: sig }).then(r => r ?? [])
  }

  async getTopSellers(
    period = 'month',
    limit = 20,
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<TopSeller[]> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams({ period, limit: String(limit) })
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    return apiFetch<TopSeller[]>(`/api/dashboard/top-sellers?${params.toString()}`, { signal: sig }).then(r => r ?? [])
  }

  async getTopProducts(
    period = 'month',
    limit = 10,
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<TopProduct[]> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams({ period, limit: String(limit) })
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    return apiFetch<TopProduct[]>(`/api/dashboard/top-products?${params.toString()}`, { signal: sig }).then(r => r ?? [])
  }

  async getProductAttributeBreakdown(
    productName: string,
    period = 'month',
    attributeIds?: string[],
    signal?: AbortSignal
  ): Promise<ProductAttributeBreakdownResponse> {
    const params: Record<string, string> = { productName, period }
    if (attributeIds && attributeIds.length > 0) {
      params.attributeIds = attributeIds.join(',')
    }
    const query = new URLSearchParams(params)
    return apiFetch<ProductAttributeBreakdownResponse>(
      `/api/dashboard/top-products/attribute-breakdown?${query.toString()}`,
      { signal }
    )
  }

  async getPipelineSnapshot(
    storeIdsOrSignal?: string[] | AbortSignal,
    signal?: AbortSignal
  ): Promise<PipelineSnapshot> {
    const isSignal = storeIdsOrSignal instanceof AbortSignal
    const storeIds = isSignal ? undefined : storeIdsOrSignal
    const sig = isSignal ? storeIdsOrSignal : signal
    const params = new URLSearchParams()
    if (storeIds && storeIds.length > 0) params.set('storeIds', storeIds.join(','))
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PipelineSnapshot>(`/api/dashboard/pipeline${query}`, { signal: sig })
      .then(r => r ?? { manufacturing: 0, warehouse: 0, dispatch: 0, delivered: 0 })
  }

  async getExpiredLayawaysByAge(signal?: AbortSignal): Promise<ExpiredLayawayAgeRange[]> {
    return apiFetch<ExpiredLayawayAgeRange[]>(`/api/dashboard/expired-layaways-by-age`, { signal }).then(r => r ?? [])
  }

  // BI Fase 1: Finanzas y Consolidación
  async getAovByBranch(period = 'month', signal?: AbortSignal): Promise<AovByBranch[]> {
    return apiFetch<AovByBranch[]>(`/api/dashboard/aov-by-branch?period=${period}`, { signal }).then(r => r ?? [])
  }

  async getAgingUnliquidated(signal?: AbortSignal): Promise<AgingReport[]> {
    return apiFetch<AgingReport[]>(`/api/dashboard/aging-unliquidated`, { signal }).then(r => r ?? [])
  }

  async getPaymentMix(period = 'month', signal?: AbortSignal): Promise<PaymentMix[]> {
    return apiFetch<PaymentMix[]>(`/api/dashboard/payment-mix?period=${period}`, { signal }).then(r => r ?? [])
  }

  // BI Fase 2: Operaciones
  async getManufacturingLeadTime(period = 'month', signal?: AbortSignal): Promise<ManufacturingLeadTime[]> {
    return apiFetch<ManufacturingLeadTime[]>(`/api/dashboard/manufacturing-lead-time?period=${period}`, { signal }).then(r => r ?? [])
  }

  async getOtif(period = 'month', signal?: AbortSignal): Promise<OtifMetrics> {
    return apiFetch<OtifMetrics>(`/api/dashboard/otif?period=${period}`, { signal })
      .then(r => r ?? { otifRate: 100, onTimeOrders: 0, delayedOrders: 0, totalDeliveredOrders: 0 })
  }

  async getStageDwellTimes(signal?: AbortSignal): Promise<StageDwellTime[]> {
    return apiFetch<StageDwellTime[]>(`/api/dashboard/stage-dwell-times`, { signal }).then(r => r ?? [])
  }

  async getFulfillmentRatio(period = 'month', signal?: AbortSignal): Promise<FulfillmentRatio> {
    return apiFetch<FulfillmentRatio>(`/api/dashboard/fulfillment-ratio?period=${period}`, { signal })
      .then(r => r ?? { immediateCount: 0, immediatePercentage: 0, madeToOrderCount: 0, madeToOrderPercentage: 0 })
  }

  // BI Fase 3: Funnel y Ventas
  async getConversionRate(period = 'month', signal?: AbortSignal): Promise<ConversionRate> {
    return apiFetch<ConversionRate>(`/api/dashboard/conversion-rate?period=${period}`, { signal })
      .then(r => r ?? { totalReservations: 0, convertedOrders: 0, winRatePercentage: 0, convertedVolumeUsd: 0 })
  }

  async getClosingVelocity(period = 'month', signal?: AbortSignal): Promise<ClosingVelocity> {
    return apiFetch<ClosingVelocity>(`/api/dashboard/closing-velocity?period=${period}`, { signal })
      .then(r => r ?? { averageDaysToClose: 0, medianHoursToFirstPayment: 0, analyzedOrdersCount: 0 })
  }

  // BI Fase 4: Inventario y Reposición
  async getReplenishmentSuggestions(signal?: AbortSignal): Promise<ReplenishmentSuggestion[]> {
    return apiFetch<ReplenishmentSuggestion[]>(`/api/dashboard/replenishment-suggestions`, { signal }).then(r => r ?? [])
  }

  async getStockTurnover(signal?: AbortSignal): Promise<StockTurnover> {
    return apiFetch<StockTurnover>(`/api/dashboard/stock-turnover`, { signal })
      .then(r => r ?? { averageDaysInWarehouse: 0, slowMovingItemsCount: 0, totalActiveStockUnits: 0 })
  }

  async getStockoutRate(signal?: AbortSignal): Promise<StockoutRate> {
    return apiFetch<StockoutRate>(`/api/dashboard/stockout-rate`, { signal })
      .then(r => r ?? { stockoutRatePercentage: 0, stockoutIncidentsCount: 0, statusNote: '' })
  }

  async getStoreOccupancy(signal?: AbortSignal): Promise<StoreOccupancy[]> {
    return apiFetch<StoreOccupancy[]>(`/api/dashboard/store-occupancy`, { signal }).then(r => r ?? [])
  }

  // Aging Drill-down & Excel Export
  async getAgingOrders(type = 'unliquidated', range?: string, signal?: AbortSignal): Promise<AgingOrderDetail[]> {
    const q = new URLSearchParams({ type })
    if (range) q.set('range', range)
    return apiFetch<AgingOrderDetail[]>(`/api/dashboard/aging-orders?${q.toString()}`, { signal }).then(r => r ?? [])
  }

  async downloadAgingOrdersExcel(type = 'unliquidated', range?: string): Promise<void> {
    const q = new URLSearchParams({ type })
    if (range) q.set('range', range)
    const token = getAuthToken()
    const url = `/api/dashboard/aging-orders/excel?${q.toString()}`
    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) {
      throw new Error(`Error al exportar reporte Excel: ${response.status}`)
    }
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    const typeLabel = type === 'expired_layaways' ? 'apartados_vencidos' : 'saldos_pendientes'
    const rangeLabel = range ? `_${range}` : ''
    a.download = `reporte_${typeLabel}${rangeLabel}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  // Top KPI Drill-downs & Excel Exports
  async getOrdersDrilldown(type = 'orders', period = 'month', signal?: AbortSignal): Promise<AgingOrderDetail[]> {
    const q = new URLSearchParams({ type, period })
    return apiFetch<AgingOrderDetail[]>(`/api/dashboard/drilldown/orders?${q.toString()}`, { signal }).then(r => r ?? [])
  }

  async downloadOrdersDrilldownExcel(type = 'orders', period = 'month'): Promise<void> {
    const q = new URLSearchParams({ type, period })
    const token = getAuthToken()
    const response = await fetch(`/api/dashboard/drilldown/orders/excel?${q.toString()}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) throw new Error(`Error al exportar pedidos a Excel: ${response.status}`)
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    a.download = `detalle_pedidos_${type}_${period}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  async getCollectedDrilldown(period = 'month', signal?: AbortSignal): Promise<CollectedDrillDownResponse> {
    return apiFetch<CollectedDrillDownResponse>(`/api/dashboard/drilldown/collected?period=${period}`, { signal })
      .then(r => r ?? {
        totalCollectedUsd: 0,
        currentPeriodCollectedUsd: 0,
        priorPeriodCollectedUsd: 0,
        currentPeriodPercentage: 0,
        priorPeriodPercentage: 0,
        currentPeriodPayments: [],
        priorPeriodPayments: []
      })
  }

  async downloadCollectedDrilldownExcel(period = 'month', tab?: string): Promise<void> {
    const q = new URLSearchParams({ period })
    if (tab) q.set('tab', tab)
    const token = getAuthToken()
    const response = await fetch(`/api/dashboard/drilldown/collected/excel?${q.toString()}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) throw new Error(`Error al exportar cobranza a Excel: ${response.status}`)
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    a.download = `detalle_cobranza_${period}_${tab || 'completo'}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  async getCasheaDrilldown(period = 'month', signal?: AbortSignal): Promise<CasheaDrillDownResponse> {
    return apiFetch<CasheaDrillDownResponse>(`/api/dashboard/drilldown/cashea?period=${period}`, { signal })
      .then(r => r ?? {
        totalOrdersCount: 0,
        totalOrdersVolumeUsd: 0,
        totalDownPaymentUsd: 0,
        totalFinancedCasheaUsd: 0,
        totalCollectedCasheaUsd: 0,
        totalPendingCasheaUsd: 0,
        orders: []
      })
  }

  async downloadCasheaDrilldownExcel(period = 'month'): Promise<void> {
    const q = new URLSearchParams({ period })
    const token = getAuthToken()
    const response = await fetch(`/api/dashboard/drilldown/cashea/excel?${q.toString()}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) throw new Error(`Error al exportar Cashea a Excel: ${response.status}`)
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    a.download = `detalle_cashea_${period}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  async downloadManufacturingReportExcel(status?: string, from?: string, to?: string): Promise<void> {
    const q = new URLSearchParams()
    if (status && status !== 'all') q.set('status', status)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    const qStr = q.toString() ? `?${q.toString()}` : ''
    const token = getAuthToken()
    const response = await fetch(`/api/reports/manufacturing/excel${qStr}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) throw new Error(`Error al exportar reporte de fabricación a Excel: ${response.status}`)
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    a.download = `Reporte_Fabricacion_Completo_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  // Reports

  async getCommissionsReportPreview(params: CommissionsReportQueryParams): Promise<CommissionReportRowDto[]> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
    })
    return apiFetch<CommissionReportRowDto[]>(`/api/reports/commissions?${query.toString()}`)
  }

  async getCommissionReferrersInRange(startDate: string, endDate: string): Promise<CommissionReferrerOptionDto[]> {
    return apiFetch<CommissionReferrerOptionDto[]>(`/api/reports/commission-referrers?startDate=${startDate}&endDate=${endDate}`)
  }

  // Access PIN
  async generateAccessPin(): Promise<GenerateAccessPinResponseDto> {
    return apiFetch<GenerateAccessPinResponseDto>('/api/accesspin/generate', { method: 'POST' })
  }

  async validateAccessPin(pin: string, orderId: string): Promise<ValidateAccessPinResponseDto> {
    return apiFetch<ValidateAccessPinResponseDto>('/api/accesspin/validate', {
      method: 'POST',
      body: JSON.stringify({ pin, orderId })
    })
  }

  async getAccessPinSession(orderId: string): Promise<AccessPinSessionResponseDto> {
    return apiFetch<AccessPinSessionResponseDto>(`/api/accesspin/session/${orderId}`)
  }

  async searchOrders(q: string, limit = 20): Promise<any[]> {
    const res = await this.getOrdersPaged(1, limit, undefined, { search: q })
    return (res as any)?.orders || (res as any)?.items || []
  }

  async searchProducts(q: string, limit = 20): Promise<ProductListItemDto[]> {
    const res = await this.getProductsPaginated({ search: q, pageSize: limit })
    return res?.items || []
  }

  async getOrdersByClient(clientId: string): Promise<any[]> {
    const res = await this.getOrdersPaged(1, 100, undefined, { clientSearch: clientId })
    return (res as any)?.orders || (res as any)?.items || []
  }

  async getOrderAuditLogs(params: any = {}): Promise<PagedAuditLogsResponseDto> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v))
    })
    return apiFetch<PagedAuditLogsResponseDto>(`/api/orders/audit-logs?${query.toString()}`)
  }

  async confirmReservation(id: string, body: ConfirmOrderDto): Promise<OrderResponseDto> {
    return this.confirmPendingOrder(id, body)
  }

  async validateOrderItem(orderId: string, itemId: string): Promise<void> {
    return apiFetch<void>(`/api/orders/${orderId}/items/${itemId}/validate`, { method: 'POST' })
  }

  async exportProducts(includeData: boolean, currency: string): Promise<Blob> {
    const res = await fetch(`/api/products/export?includeData=${includeData}&currency=${currency}`)
    return res.blob()
  }

  async importProducts(file: File, currency: string): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('currency', currency)
    return apiFetch('/api/products/import', { method: 'POST', body: formData })
  }

  async checkUserExistsByEmail(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email)
    return !!user
  }

  async checkUserExistsByUsername(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username)
    return !!user
  }

  async conciliatePayments(requests: ConciliatePaymentRequestDto[]): Promise<any> {
    return apiFetch('/api/finance/payments/conciliate', {
      method: 'POST',
      body: JSON.stringify(requests)
    })
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return apiFetch<T>(endpoint, options)
  }

  async exportClients(includeData: boolean): Promise<void> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const url = `/api/clients/export?includeData=${includeData}`
    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) {
      throw new Error(`Error al exportar clientes: ${response.status}`)
    }
    const blob = await response.blob()
    const urlBlob = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = urlBlob
    a.download = includeData ? 'clientes_con_datos.xlsx' : 'plantilla_clientes.xlsx'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(urlBlob)
    document.body.removeChild(a)
  }

  async importClients(file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    return apiFetch('/api/clients/import', { method: 'POST', body: formData })
  }

  async getAccessPinHistory(page = 1, pageSize = 20): Promise<any> {
    return apiFetch(`/api/AccessPin/history?page=${page}&pageSize=${pageSize}`)
  }

  async getProductCommissions(): Promise<any[]> {
    return apiFetch('/api/CommissionSettings/ProductCommissions')
  }

  async getProductCommissionByCategory(categoryId: string): Promise<any> {
    return apiFetch(`/api/CommissionSettings/ProductCommissions/${categoryId}`)
  }

  async upsertProductCommission(data: any): Promise<any> {
    return apiFetch('/api/CommissionSettings/ProductCommissions', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async batchUpsertProductCommissions(data: any[]): Promise<any[]> {
    return apiFetch('/api/CommissionSettings/ProductCommissions/Batch', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async deleteProductCommission(categoryId: string): Promise<void> {
    return apiFetch(`/api/CommissionSettings/ProductCommissions/${categoryId}`, {
      method: 'DELETE'
    })
  }

  async getSaleTypeCommissionRules(): Promise<any[]> {
    return apiFetch('/api/CommissionSettings/SaleTypeRules')
  }

  async getSaleTypeCommissionRule(saleType: string): Promise<any[]> {
    return apiFetch(`/api/CommissionSettings/SaleTypeRules/${encodeURIComponent(saleType)}`)
  }

  async upsertSaleTypeCommissionRule(data: any): Promise<any> {
    return apiFetch('/api/CommissionSettings/SaleTypeRules', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async batchUpsertSaleTypeCommissionRules(data: any[]): Promise<any[]> {
    return apiFetch('/api/CommissionSettings/SaleTypeRules/Batch', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async deleteSaleTypeCommissionRule(saleType: string): Promise<void> {
    return apiFetch(`/api/CommissionSettings/SaleTypeRules/${encodeURIComponent(saleType)}`, {
      method: 'DELETE'
    })
  }

  async seedDefaultSaleTypeRules(force = false): Promise<any[]> {
    const q = force ? '?force=true' : ''
    return apiFetch(`/api/CommissionSettings/SaleTypeRules/SeedDefaults${q}`, {
      method: 'POST'
    })
  }

  async getSaleTypeRulesCompleteness(): Promise<any> {
    return apiFetch('/api/CommissionSettings/SaleTypeRules/Completeness')
  }

  async ensureSaleTypeRulesComplete(): Promise<{ inserted: number; rules: any[] }> {
    return apiFetch('/api/CommissionSettings/SaleTypeRules/EnsureComplete', {
      method: 'POST'
    })
  }

  async getAllPermissions(): Promise<string[]> {
    return this.request<string[]>('/api/Roles/permissions')
  }

  async deleteCategoriesBulk(ids: string[]): Promise<BulkDeleteResultDto> {
    return this.request<BulkDeleteResultDto>('/api/categories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
  }

  async deleteProductsBulk(ids: string[]): Promise<BulkDeleteResultDto> {
    return this.request<BulkDeleteResultDto>('/api/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
  }

  async getProductsPaginated(
    params: {
      page?: number
      pageSize?: number
      search?: string
      categoryId?: string
      status?: string
    } = {},
    signal?: AbortSignal
  ): Promise<PaginatedResultDto<ProductListItemDto>> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page.toString())
    if (params.pageSize) query.set('pageSize', params.pageSize.toString())
    if (params.search) query.set('search', params.search)
    if (params.categoryId) query.set('categoryId', params.categoryId)
    if (params.status) query.set('status', params.status)
    const qs = query.toString()
    return this.request<PaginatedResultDto<ProductListItemDto>>(
      `/api/products/paginated${qs ? `?${qs}` : ''}`,
      { signal }
    )
  }

  async getOrderCount(
    filters?: any,
    signal?: AbortSignal,
    pageSize = 50
  ): Promise<{ totalCount: number; totalPages: number; pageSize: number }> {
    try {
      const res = await this.getOrdersPaged(1, pageSize, undefined, filters, signal)
      const totalCount = res.totalCount ?? (res as any).total ?? res.orders?.length ?? 0
      const totalPages = Math.ceil(totalCount / pageSize) || 1
      return { totalCount, totalPages, pageSize }
    } catch {
      return { totalCount: 0, totalPages: 1, pageSize }
    }
  }

  async downloadCommissionsReportExcel(params: CommissionsReportQueryParams): Promise<Blob> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
    })
    const res = await fetch(`/api/reports/commissions/excel?${query.toString()}`)
    return res.blob()
  }

  async downloadExpiredLayawaysReportExcel(): Promise<Blob> {
    const res = await fetch('/api/reports/expired-layaways/excel')
    return res.blob()
  }

  // Notifications
  async getNotifications(skip = 0, limit = 10): Promise<NotificationDto[]> {
    return apiFetch<NotificationDto[]>(`/api/notifications?skip=${skip}&limit=${limit}`)
  }

  async getUnreadNotificationCount(): Promise<number> {
    const res = await apiFetch<{ count: number }>('/api/notifications/unread-count')
    return res.count
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const res = await apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PUT'
    })
    return res.success
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const res = await apiFetch<{ success: boolean }>('/api/notifications/mark-all-read', {
      method: 'PUT'
    })
    return res.success
  }

  async deleteNotification(id: string): Promise<boolean> {
    const res = await apiFetch<{ success: boolean }>(`/api/notifications/${id}`, {
      method: 'DELETE'
    })
    return res.success
  }

  async deleteAllNotifications(): Promise<boolean> {
    const res = await apiFetch<{ success: boolean }>('/api/notifications', {
      method: 'DELETE'
    })
    return res.success
  }

  // Support Tickets
  async createSupportTicket(dto: CreateSupportTicketDto): Promise<SupportTicketResponseDto> {
    return apiFetch<SupportTicketResponseDto>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(dto)
    })
  }

  // Operations Metrics & Threshold Settings
  async getOperationsMetricsSettings(signal?: AbortSignal): Promise<OperationsMetricsSettings> {
    return apiFetch<OperationsMetricsSettings>('/api/operations-metrics/settings', { signal })
  }

  async updateOperationsMetricsSettings(settings: OperationsMetricsSettings, signal?: AbortSignal): Promise<OperationsMetricsSettings> {
    return apiFetch<OperationsMetricsSettings>('/api/operations-metrics/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      signal
    })
  }

  // Notification Rules & Settings
  async getNotificationSettings(signal?: AbortSignal): Promise<NotificationRuleSettings> {
    return apiFetch<NotificationRuleSettings>('/api/notifications/settings', { signal })
  }

  async updateNotificationSettings(settings: NotificationRuleSettings, signal?: AbortSignal): Promise<NotificationRuleSettings> {
    return apiFetch<NotificationRuleSettings>('/api/notifications/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      signal
    })
  }

  async testNotificationAlert(signal?: AbortSignal): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/notifications/settings/test-alert', {
      method: 'POST',
      signal
    })
  }
}

export interface NotificationRuleSettings {
  id?: string
  biAlertsEnabled: boolean
  biFrequency: string
  biDayOfWeek: number // 1 = Monday
  biHourOfDay: number
  biMinuteOfHour: number
  biTargetRoles: string[]
  manufacturingDelayEnabled: boolean
  manufacturingDelayDays: number
  reservationExpiringEnabled: boolean
  reservationExpiringDays: number
  emergencyPinUsedEnabled: boolean
  exchangeRateChangedEnabled: boolean
  syncConflictEnabled: boolean
  soundEnabled: boolean
}

export interface NotificationDto {
  id: string
  type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'success'
  link?: string
  targetUserId?: string
  targetRoles?: string[]
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any>
}

export const apiClient = new ApiClientClass()
export { ApiClientClass as ApiClient }
