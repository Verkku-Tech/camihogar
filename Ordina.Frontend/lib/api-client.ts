// API Client para comunicación con el backend
// URLs base para cada microservicio (solo para servidor/SSR)
const SECURITY_API_URL_DIRECT =
  process.env.SECURITY_API_URL ||
  "http://camihogar.eastus.cloudapp.azure.com:8082";
const USERS_API_URL_DIRECT =
  process.env.USERS_API_URL ||
  "http://camihogar.eastus.cloudapp.azure.com:8083";
const PROVIDERS_API_URL_DIRECT =
  process.env.PROVIDERS_API_URL || "http://camihogar.eastus.cloudapp.azure.com:8084";
const ORDERS_API_URL_DIRECT =
  process.env.NEXT_PUBLIC_ORDERS_API_URL || "http://camihogar.eastus.cloudapp.azure.com:8085";
export interface ApiError {
  message: string;
  status?: number;
}

interface CachedApiResponse {
  id: string;
  endpoint: string;
  data: any;
  timestamp: number;
}

export class ApiClient {
  getBaseUrl(endpoint: string): string {
    // Determinar qué servicio usar según el endpoint
    let service: "security" | "users" | "providers" | "orders" = "security";

    if (endpoint.startsWith("/api/Auth")) {
      service = "security";
    } else if (
      endpoint.startsWith("/api/users") ||
      endpoint.startsWith("/api/Users")
    ) {
      service = "users";
    } else if (
      endpoint.startsWith("/api/categories") ||
      endpoint.startsWith("/api/products") ||
      endpoint.startsWith("/api/providers")
    ) {
      service = "providers";
    } else if (
      endpoint.startsWith("/api/orders") ||
      endpoint.startsWith("/api/Orders") ||
      endpoint.startsWith("/api/Reports")
    ) {
      service = "orders";
    }

    // Si estamos en el cliente (navegador) y la página está en HTTPS, usar proxy
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      if (isHttps) {
        // Usar proxy para evitar contenido mixto
        return `/api/proxy/${service}`;
      }
    }

    // En servidor (SSR) o si estamos en HTTP, usar URLs directas
    switch (service) {
      case "security":
        return SECURITY_API_URL_DIRECT;
      case "users":
        return USERS_API_URL_DIRECT;
      case "providers":
        return PROVIDERS_API_URL_DIRECT;
      case "orders":
        return ORDERS_API_URL_DIRECT;
      default:
        return SECURITY_API_URL_DIRECT;
    }
  }

  // Verificar si el endpoint existe en el backend
  private isBackendEndpoint(endpoint: string): boolean {
    // Solo estos endpoints existen actualmente
    const availableEndpoints = [
      "/api/Auth",
      "/api/users",
      "/api/Users",
      "/api/categories",
      "/api/products",
      "/api/orders",
      "/api/Orders",
      "/api/Reports",
    ];

    return availableEndpoints.some((path) => endpoint.startsWith(path));
  }

  // Obtener datos desde cache (IndexedDB)
  private async getFromCache<T>(endpoint: string): Promise<T> {
    try {
      const { get } = await import("./indexeddb");
      const cacheKey = `api_cache_${endpoint}`;
      const cached = await get<CachedApiResponse>("api_cache", cacheKey);
      if (cached && cached.data) {
        console.log("📦 Datos obtenidos de cache:", endpoint);
        return cached.data as T;
      }
    } catch (error) {
      console.error("Error obteniendo de cache:", error);
    }
    throw new Error("Sin conexión y sin datos en cache");
  }

  // Cachear respuesta de API
  private async cacheResponse(endpoint: string, data: any): Promise<void> {
    try {
      const { add } = await import("./indexeddb");
      const cacheKey = `api_cache_${endpoint}`;
      await add("api_cache", {
        id: cacheKey,
        endpoint,
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Si ya existe, actualizar
      try {
        const { update } = await import("./indexeddb");
        const cacheKey = `api_cache_${endpoint}`;
        await update("api_cache", {
          id: cacheKey,
          endpoint,
          data,
          timestamp: Date.now(),
        });
      } catch (updateError) {
        // Cache lleno o error, ignorar
        console.warn("No se pudo cachear respuesta:", updateError);
      }
    }
  }

  // Agregar petición a cola de sincronización
  private async queueRequest(
    endpoint: string,
    options: RequestInit,
    baseUrl: string
  ): Promise<void> {
    try {
      const { syncManager } = await import("./sync-manager");

      const requestData = {
        url: `${baseUrl}${endpoint}`,
        method: options.method || "GET",
        headers: Object.fromEntries(
          Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
        ),
        body: options.body || null,
        timestamp: Date.now(),
      };

      // Determinar entidad
      let entity:
        | "user"
        | "order"
        | "product"
        | "category"
        | "client"
        | "provider"
        | "store" = "user";
      if (endpoint.includes("/orders")) entity = "order";
      else if (endpoint.includes("/products")) entity = "product";
      else if (endpoint.includes("/categories")) entity = "category";
      else if (endpoint.includes("/clients")) entity = "client";
      else if (endpoint.includes("/providers")) entity = "provider";
      else if (endpoint.includes("/stores")) entity = "store";

      // Determinar tipo de operación
      let type: "create" | "update" | "delete" = "create";
      if (options.method === "PUT" || options.method === "PATCH")
        type = "update";
      else if (options.method === "DELETE") type = "delete";

      // Agregar a cola de sincronización
      await syncManager.addToQueue({
        type,
        entity,
        entityId: "",
        data: requestData,
      });

      // Registrar Background Sync si está disponible
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ("sync" in registration) {
            await (registration as any).sync.register("sync-requests");
          }
        } catch (error) {
          console.warn("Background Sync no disponible:", error);
        }
      }
    } catch (error) {
      console.error("Error agregando petición a cola:", error);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const baseUrl = this.getBaseUrl(endpoint);
    const isOnline = typeof window !== "undefined" ? navigator.onLine : true;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    // Si está offline y es GET de un endpoint disponible, intentar cache primero
    if (
      !isOnline &&
      options.method === "GET" &&
      this.isBackendEndpoint(endpoint)
    ) {
      try {
        return await this.getFromCache<T>(endpoint);
      } catch (error) {
        // Si no hay cache, continuar con el error
        throw error;
      }
    }

    // Construir la URL final
    // Si baseUrl es un proxy (/api/proxy/security), enviar el endpoint completo (incluyendo /api/)
    // El proxy extraerá el servicio y pasará el resto al backend correctamente
    // Si baseUrl es una URL directa (http://...), agregar el endpoint completo
    const isProxy = baseUrl.startsWith("/api/proxy/");
    const finalUrl = isProxy
      ? `${baseUrl}${endpoint}` // Proxy: /api/proxy/orders/api/Orders (el proxy manejará el path)
      : `${baseUrl}${endpoint}`; // Directo: http://.../api/Auth/login

    try {
      const response = await fetch(finalUrl, {
        ...options,
        headers,
      });

      // Si es 401, intentar refresh token (excepto para login que es un error de credenciales)
      if (response.status === 401) {
        // No intentar refresh si es el endpoint de login (es un error de credenciales, no de token)
        if (endpoint === "/api/Auth/login") {
          // Leer el mensaje de error real del backend
          const errorData = await response
            .json()
            .catch(() => ({ message: "Usuario o contraseña incorrectos" }));
          
          let errorMessage = errorData.message || "Usuario o contraseña incorrectos";
          if (errorData.errors || errorData.title) {
            const errors: string[] = [];
            if (errorData.errors) {
              Object.keys(errorData.errors).forEach((key) => {
                const fieldErrors = errorData.errors[key];
                if (Array.isArray(fieldErrors)) {
                  fieldErrors.forEach((err: string) => {
                    errors.push(`${key}: ${err}`);
                  });
                } else {
                  errors.push(`${key}: ${fieldErrors}`);
                }
              });
            }
            if (errorData.title) {
              errors.push(errorData.title);
            }
            errorMessage = errors.length > 0 ? errors.join("; ") : errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        // Para otros endpoints, intentar refresh token
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Reintentar request con nuevo token
          const newToken =
            typeof window !== "undefined"
              ? localStorage.getItem("auth_token")
              : null;
          return this.request<T>(endpoint, {
            ...options,
            headers: {
              ...headers,
              ...(newToken && { Authorization: `Bearer ${newToken}` }),
            },
          });
        }
        throw new Error(
          "Sesión expirada. Por favor, inicia sesión nuevamente."
        );
      }

      if (!response.ok) {
        // Si falla y estamos offline, guardar en cola solo si el endpoint existe
        if (
          !isOnline &&
          this.isBackendEndpoint(endpoint) &&
          ["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")
        ) {
          await this.queueRequest(endpoint, options, baseUrl);
          return {
            success: true,
            offline: true,
            message: "Operación guardada para sincronizar",
          } as T;
        }

        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        
        // Si es un ModelState (validación de ASP.NET), extraer los mensajes
        let errorMessage = errorData.message || `Error: ${response.statusText}`;
        if (errorData.errors || errorData.title) {
          // ModelState de ASP.NET Core
          const errors: string[] = [];
          if (errorData.errors) {
            Object.keys(errorData.errors).forEach((key) => {
              const fieldErrors = errorData.errors[key];
              if (Array.isArray(fieldErrors)) {
                fieldErrors.forEach((err: string) => {
                  errors.push(`${key}: ${err}`);
                });
              } else {
                errors.push(`${key}: ${fieldErrors}`);
              }
            });
          }
          if (errorData.title) {
            errors.push(errorData.title);
          }
          errorMessage = errors.length > 0 ? errors.join("; ") : errorMessage;
        }
        
        console.error("❌ Error del backend:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorMessage,
        });
        
        throw new Error(errorMessage);
      }

      // Si es GET exitoso y es un endpoint del backend, guardar en cache
      if (
        options.method === "GET" &&
        response.ok &&
        this.isBackendEndpoint(endpoint)
      ) {
        try {
          const data = await response.clone().json();
          await this.cacheResponse(endpoint, data);
        } catch {
          // Si no es JSON, no cachear
        }
      }

      // Manejar respuesta 201 Created (puede tener body con el objeto creado)
      if (response.status === 201) {
        const contentType = response.headers.get("content-type");
        const location = response.headers.get("location");
        console.log("📥 Respuesta 201 Created:", { contentType, location });
        
        if (contentType && contentType.includes("application/json")) {
          try {
            const data = await response.json();
            console.log("✅ Datos recibidos del 201:", data);
            // El body de un 201 Created debería contener el objeto creado
            return data;
          } catch (error) {
            console.warn("⚠️ No se pudo parsear el body de la respuesta 201:", error);
            // Si no hay body, retornar objeto vacío
            return {} as T;
          }
        }
      }

      // Si la respuesta está vacía, retornar void
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }
      return {} as T;
    } catch (error) {
      // Si es error de red y estamos offline
      if (
        !isOnline &&
        error instanceof TypeError &&
        error.message.includes("fetch")
      ) {
        // Solo intentar cachear/encolar si el endpoint existe en el backend
        if (this.isBackendEndpoint(endpoint)) {
          if (
            ["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")
          ) {
            await this.queueRequest(endpoint, options, baseUrl);
            return {
              success: true,
              offline: true,
              message: "Operación guardada para sincronizar",
            } as T;
          }
          if (options.method === "GET") {
            try {
              return await this.getFromCache<T>(endpoint);
            } catch {
              // Si no hay cache, lanzar error
            }
          }
        }
        // Si el endpoint no existe, no hacer nada - la app sigue funcionando con IndexedDB
        throw new Error("Sin conexión");
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Error de conexión con el servidor");
    }
  }

  async refreshToken(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;

    // Verificar si el refresh token expiró
    const refreshExpiresAt = parseInt(
      localStorage.getItem("refresh_token_expires_at") || "0"
    );
    if (Date.now() > refreshExpiresAt) {
      return false;
    }

    try {
      // Usar el mismo método request para mantener consistencia
      const response = await this.request<{
        token: string;
        refreshToken: string;
        expiresAt: string;
        refreshTokenExpiresAt: string;
      }>("/api/Auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });

      // Guardar nuevos tokens
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("refresh_token", response.refreshToken);
      localStorage.setItem(
        "token_expires_at",
        new Date(response.expiresAt).getTime().toString()
      );
      localStorage.setItem(
        "refresh_token_expires_at",
        new Date(response.refreshTokenExpiresAt).getTime().toString()
      );

      return true;
    } catch {
      return false;
    }
  }

  // Auth endpoints
  async login(username: string, password: string, rememberMe: boolean = false) {
    return this.request<LoginResponse>("/api/Auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, rememberMe }),
    });
  }

  // Users endpoints
  async getUsers(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request<UserResponseDto[]>(`/api/users${query}`);
  }

  async getUserById(id: string) {
    return this.request<UserResponseDto>(`/api/users/${id}`);
  }

  async getUserByUsername(username: string) {
    return this.request<UserResponseDto>(`/api/users/username/${username}`);
  }

  async getUserByEmail(email: string) {
    return this.request<UserResponseDto>(`/api/users/email/${encodeURIComponent(email)}`);
  }

  async checkUserExistsByEmail(email: string): Promise<boolean> {
    try {
      await this.getUserByEmail(email);
      return true; // Si no lanza error, el usuario existe
    } catch (error: any) {
      const errorMessage = error?.message || "";
      // Si es 404 o contiene "no encontrado", el usuario no existe
      if (errorMessage.includes("404") || errorMessage.includes("no encontrado") || errorMessage.includes("NotFound")) {
        return false;
      }
      // Para otros errores, asumimos que no existe para no bloquear la creación
      console.warn("Error verificando correo, asumiendo que no existe:", error);
      return false;
    }
  }

  async checkUserExistsByUsername(username: string): Promise<boolean> {
    try {
      await this.getUserByUsername(username);
      return true; // Si no lanza error, el usuario existe
    } catch (error: any) {
      const errorMessage = error?.message || "";
      // Si es 404 o contiene "no encontrado", el usuario no existe
      if (errorMessage.includes("404") || errorMessage.includes("no encontrado") || errorMessage.includes("NotFound")) {
        return false;
      }
      // Para otros errores, asumimos que no existe para no bloquear la creación
      console.warn("Error verificando username, asumiendo que no existe:", error);
      return false;
    }
  }

  async createUser(user: CreateUserDto) {
    return this.request<UserResponseDto>("/api/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, user: UpdateUserDto) {
    return this.request<UserResponseDto>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(user),
    });
  }

  async deleteUser(id: string) {
    return this.request<{ success: boolean }>(`/api/users/${id}`, {
      method: "DELETE",
    });
  }

  // Categories endpoints
  async getCategories() {
    return this.request<CategoryResponseDto[]>("/api/categories");
  }

  async getCategoryById(id: string) {
    return this.request<CategoryResponseDto>(`/api/categories/${id}`);
  }

  async getCategoryByName(name: string) {
    return this.request<CategoryResponseDto>(
      `/api/categories/name/${encodeURIComponent(name)}`
    );
  }

  async createCategory(category: CreateCategoryDto) {
    return this.request<CategoryResponseDto>("/api/categories", {
      method: "POST",
      body: JSON.stringify(category),
    });
  }

  async updateCategory(id: string, category: UpdateCategoryDto) {
    return this.request<CategoryResponseDto>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(category),
    });
  }

  async deleteCategory(id: string) {
    return this.request<void>(`/api/categories/${id}`, {
      method: "DELETE",
    });
  }

  // Products endpoints
  async getProducts() {
    return this.request<ProductResponseDto[]>("/api/products");
  }

  async getProductById(id: string) {
    return this.request<ProductResponseDto>(`/api/products/${id}`);
  }

  async getProductBySku(sku: string) {
    return this.request<ProductResponseDto>(
      `/api/products/sku/${encodeURIComponent(sku)}`
    );
  }

  async getProductsByCategory(categoryId: string) {
    return this.request<ProductResponseDto[]>(
      `/api/products/category/${categoryId}`
    );
  }

  async getProductsByStatus(status: string) {
    return this.request<ProductResponseDto[]>(
      `/api/products/status/${encodeURIComponent(status)}`
    );
  }

  async createProduct(product: CreateProductDto) {
    return this.request<ProductResponseDto>("/api/products", {
      method: "POST",
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: UpdateProductDto) {
    return this.request<ProductResponseDto>(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(id: string) {
    return this.request<void>(`/api/products/${id}`, {
      method: "DELETE",
    });
  }

  // Orders endpoints
  async getOrders() {
    return this.request<OrderResponseDto[]>("/api/Orders");
  }

  async getOrderById(id: string) {
    return this.request<OrderResponseDto>(`/api/Orders/${id}`);
  }

  async getOrderByOrderNumber(orderNumber: string) {
    return this.request<OrderResponseDto>(
      `/api/Orders/number/${encodeURIComponent(orderNumber)}`
    );
  }

  async getOrdersByClient(clientId: string) {
    return this.request<OrderResponseDto[]>(
      `/api/Orders/client/${clientId}`
    );
  }

  async getOrdersByStatus(status: string) {
    return this.request<OrderResponseDto[]>(
      `/api/Orders/status/${encodeURIComponent(status)}`
    );
  }

  async createOrder(order: CreateOrderDto) {
    return this.request<OrderResponseDto>("/api/Orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  async updateOrder(id: string, order: UpdateOrderDto) {
    return this.request<OrderResponseDto>(`/api/Orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(order),
    });
  }

  async deleteOrder(id: string) {
    return this.request<void>(`/api/Orders/${id}`, {
      method: "DELETE",
    });
  }
}

// Types
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
}

export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt?: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  name: string;
  role: string;
  status?: string;
  password?: string;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  password?: string;
}

// Category Types
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

// Product Types
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

// Order Types
export interface OrderProductDto {
  id: string;
  name: string;
  price: number;
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
}

export interface ProductImageDto {
  id: string;
  base64: string; // Imagen en base64 (data:image/jpeg;base64,...)
  filename: string; // Nombre original del archivo
  type: "model" | "reference" | "other"; // Tipo de imagen
  uploadedAt: string; // Fecha de carga (ISO string)
  size?: number; // Tamaño del archivo en bytes (opcional)
}

export interface PartialPaymentDto {
  id: string;
  amount: number;
  method: string;
  date: string;
  images?: ProductImageDto[]; // Imágenes del comprobante de pago
  paymentDetails?: PaymentDetailsDto;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProductDto[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  paymentType: string;
  paymentMethod: string;
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
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderDto {
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProductDto[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  paymentType: string;
  paymentMethod: string;
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
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
}

export interface UpdateOrderDto {
  clientId?: string;
  clientName?: string;
  vendorId?: string;
  vendorName?: string;
  referrerId?: string;
  referrerName?: string;
  products?: OrderProductDto[];
  subtotal?: number;
  taxAmount?: number;
  deliveryCost?: number;
  total?: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  paymentType?: string;
  paymentMethod?: string;
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
  saleType?: string;
  deliveryType?: string;
  deliveryZone?: string;
}

export const apiClient = new ApiClient();
