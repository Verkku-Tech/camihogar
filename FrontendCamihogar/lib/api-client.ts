// API Client para comunicación con el backend
// URLs base para cada microservicio
const SECURITY_API_URL =
  process.env.NEXT_PUBLIC_SECURITY_API_URL ||
  "https://camihogar-security.verkku.com";
const USERS_API_URL =
  process.env.NEXT_PUBLIC_USERS_API_URL || "https://camihogar-users.verkku.com";

export interface ApiError {
  message: string;
  status?: number;
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
    // Por defecto, usar Security API
    return SECURITY_API_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const baseUrl = this.getBaseUrl(endpoint);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

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
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Error: ${response.statusText}`);
      }

      // Si la respuesta está vacía, retornar void
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }
      return {} as T;
    } catch (error) {
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

export const apiClient = new ApiClient();
