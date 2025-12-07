// API Client para comunicación con el backend
// URLs base para cada microservicio
const SECURITY_API_URL =
  process.env.NEXT_PUBLIC_SECURITY_API_URL || "http://48.217.223.103:8082";
const USERS_API_URL =
  process.env.NEXT_PUBLIC_USERS_API_URL || "http://48.217.223.103:8083";
const PROVIDERS_API_URL =
  process.env.NEXT_PUBLIC_PROVIDERS_API_URL || "http://48.217.223.103:8084";

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
  private getBaseUrl(endpoint: string): string {
    // Determinar qué API usar según el endpoint
    if (endpoint.startsWith("/api/Auth")) {
      return SECURITY_API_URL;
    }
    if (
      endpoint.startsWith("/api/users") ||
      endpoint.startsWith("/api/Users")
    ) {
      return USERS_API_URL;
    }
    if (
      endpoint.startsWith("/api/categories") ||
      endpoint.startsWith("/api/products") ||
      endpoint.startsWith("/api/providers")
    ) {
      return PROVIDERS_API_URL;
    }
    // Por defecto, usar Security API
    return SECURITY_API_URL;
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

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      // Si es 401, intentar refresh token
      if (response.status === 401) {
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
        throw new Error(errorData.message || `Error: ${response.statusText}`);
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
      const response = await fetch(`${SECURITY_API_URL}/api/Auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Guardar nuevos tokens
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("refresh_token", data.refreshToken);
      localStorage.setItem(
        "token_expires_at",
        new Date(data.expiresAt).getTime().toString()
      );
      localStorage.setItem(
        "refresh_token_expires_at",
        new Date(data.refreshTokenExpiresAt).getTime().toString()
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

export const apiClient = new ApiClient();
