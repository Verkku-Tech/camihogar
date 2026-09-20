import { telemetry } from './telemetry'
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
  ProductListItemDto
} from './api-client-dtos'
import type { ExchangeRate } from './currency-utils'

export * from './api-client-dtos'

let inMemoryToken: string | null = null

export function setAuthToken(token: string | null) {
  inMemoryToken = token
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (!inMemoryToken && typeof window !== 'undefined') {
    inMemoryToken = localStorage.getItem('auth_token')
  }
  return inMemoryToken
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
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    })

    if (res.status === 401 && !options.skipAuthRefresh && !endpoint.includes('/api/auth/')) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include'
        })

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setAuthToken(data.token)
          return await apiFetch<T>(endpoint, { ...options, skipAuthRefresh: true })
        } else {
          setAuthToken(null)
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }
      } catch {
        setAuthToken(null)
        window.dispatchEvent(new CustomEvent('auth:expired'))
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

      if (res.status >= 500) {
        telemetry.log('error', `API Failure: ${method} ${url}`, error.stack, { status: res.status, body: errorBody }, mutationId)
      }

      throw error
    }

    if (res.status === 204) {
      return {} as T
    }

    return await res.json()
  } catch (err: any) {
    if (
      err?.name === 'AbortError' ||
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      options.signal?.aborted ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('aborted'))
    ) {
      throw err
    }
    if (err instanceof ApiError) {
      throw err
    }
    const networkError = new ApiError('Error de conexión o modo sin conexión.', 0, { originalError: err?.message })
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
}

export interface TopProduct {
  productName: string
  category: string
  unitsSold: number
  totalUsd: number
}

export interface PipelineSnapshot {
  manufacturing: number
  warehouse: number
  dispatch: number
  delivered: number
}

export interface ExpiredLayawayAgeRange {
  range: string
  label: string
  count: number
  totalUsd: number
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
    try {
      const res = await apiFetch<{ token: string }>('/api/auth/refresh', { method: 'POST', skipAuthRefresh: true })
      if (res?.token) {
        setAuthToken(res.token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return apiFetch<void>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    })
  }

  // Users & Roles
  async getUsers(status?: string): Promise<UserResponseDto[]> {
    const query = status ? `?status=${encodeURIComponent(status)}&pageSize=1000` : '?pageSize=1000'
    const res = await apiFetch<any>(`/api/users${query}`)
    if (Array.isArray(res)) return res
    if (res && Array.isArray(res.items)) return res.items
    return []
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

  // Categories
  async getCategories(): Promise<CategoryResponseDto[]> {
    return apiFetch<CategoryResponseDto[]>('/api/categories')
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
    return apiFetch<ProductResponseDto[]>('/api/products/all')
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
    return apiFetch<ProviderResponseDto[]>('/api/providers/all')
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
    const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
    if (search) query.set('search', search)
    return apiFetch<PagedResult<ClientResponseDto>>(`/api/clients?${query.toString()}`, { signal })
  }

  async getClientById(id: string): Promise<ClientResponseDto> {
    return apiFetch<ClientResponseDto>(`/api/clients/${id}`)
  }

  async getClientByRut(rut: string): Promise<ClientResponseDto> {
    return apiFetch<ClientResponseDto>(`/api/clients/rut/${encodeURIComponent(rut)}`)
  }

  async createClient(client: CreateClientDto): Promise<ClientResponseDto> {
    return apiFetch<ClientResponseDto>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(client)
    })
  }

  async updateClient(id: string, client: UpdateClientDto): Promise<ClientResponseDto> {
    return apiFetch<ClientResponseDto>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client)
    })
  }

  async deleteClient(id: string): Promise<void> {
    return apiFetch<void>(`/api/clients/${id}`, { method: 'DELETE' })
  }

  // Stores & Accounts
  async getStores(status?: string): Promise<StoreResponseDto[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    return apiFetch<StoreResponseDto[]>(`/api/stores${query}`)
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

  async deleteStore(id: string): Promise<void> {
    return apiFetch<void>(`/api/stores/${id}`, { method: 'DELETE' })
  }

  async getAccounts(storeId?: string, isActive?: boolean): Promise<AccountResponseDto[]> {
    const query = new URLSearchParams()
    if (storeId) query.set('storeId', storeId)
    if (isActive !== undefined) query.set('isActive', isActive.toString())
    const qStr = query.toString() ? `?${query.toString()}` : ''
    return apiFetch<AccountResponseDto[]>(`/api/stores/accounts${qStr}`)
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
    const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
    if (since) query.set('since', since)
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          query.set(k, String(v))
        }
      })
    }
    return apiFetch<PagedOrdersResponseDto>(`/api/orders?${query.toString()}`, { signal })
  }

  async getOrderById(id: string): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>(`/api/orders/${id}`)
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>(`/api/orders/number/${encodeURIComponent(orderNumber)}`)
  }

  async createOrder(order: CreateOrderDto): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    })
  }

  async updateOrder(id: string, order: UpdateOrderDto): Promise<OrderResponseDto> {
    return apiFetch<OrderResponseDto>(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order)
    })
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
  async getDashboardMetrics(period = 'day', signal?: AbortSignal): Promise<any> {
    return apiFetch<any>(`/api/dashboard/metrics?period=${period}`, { signal })
  }

  async getSalesTrend(days = 30, signal?: AbortSignal): Promise<TrendDataPoint[]> {
    return apiFetch<TrendDataPoint[]>(`/api/dashboard/trend?days=${days}`, { signal }).then(r => r ?? [])
  }

  async getSalesForecast(period = 'month', signal?: AbortSignal): Promise<SalesForecastResponse> {
    return apiFetch<SalesForecastResponse>(`/api/dashboard/forecast?period=${period}`, { signal })
      .then(r => r ?? { points: [], summary: { projectedInvoicedTotal: 0, projectedCollectedTotal: 0, mapeScore: 0 } })
  }

  async getBySaleType(period = 'month', signal?: AbortSignal): Promise<SaleTypeData[]> {
    return apiFetch<SaleTypeData[]>(`/api/dashboard/by-sale-type?period=${period}`, { signal }).then(r => r ?? [])
  }

  async getTopSellers(period = 'month', limit = 10, signal?: AbortSignal): Promise<TopSeller[]> {
    return apiFetch<TopSeller[]>(`/api/dashboard/top-sellers?period=${period}&limit=${limit}`, { signal }).then(r => r ?? [])
  }

  async getTopProducts(period = 'month', limit = 10, signal?: AbortSignal): Promise<TopProduct[]> {
    return apiFetch<TopProduct[]>(`/api/dashboard/top-products?period=${period}&limit=${limit}`, { signal }).then(r => r ?? [])
  }

  async getPipelineSnapshot(signal?: AbortSignal): Promise<PipelineSnapshot> {
    return apiFetch<PipelineSnapshot>(`/api/dashboard/pipeline`, { signal })
      .then(r => r ?? { manufacturing: 0, warehouse: 0, dispatch: 0, delivered: 0 })
  }

  async getExpiredLayawaysByAge(signal?: AbortSignal): Promise<ExpiredLayawayAgeRange[]> {
    return apiFetch<ExpiredLayawayAgeRange[]>(`/api/dashboard/expired-layaways-by-age`, { signal }).then(r => r ?? [])
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
}

export const apiClient = new ApiClientClass()
export { ApiClientClass as ApiClient }
