# Spec: Filtro Multitienda Global y Filtro de Tipo de Vendedor en Dashboard

## 1. Contexto y Objetivos
El dashboard de analítica de Camihogar actualmente muestra métricas consolidadas de todas las tiendas y de todos los vendedores.
El usuario requiere:
1. **Filtro de Tipo de Vendedor en el Ranking de Vendedores (`TopSellersChart`):**
   - Permitir discriminar entre:
     - **Ambos** (por defecto): todos los vendedores.
     - **Vendedores de tienda** (`UserRole.StoreSeller`).
     - **Vendedores online** (`UserRole.OnlineSeller`).
2. **Filtro Global Multitienda en todo el Dashboard (`analytics-dashboard.tsx`):**
   - Selector en la barra de controles (junto al selector de período).
   - Permite seleccionar "Todas las tiendas" o selección múltiple de tiendas específicas (`storeIds`).
   - El filtrado se aplica a todas las métricas operativas y comerciales del dashboard (Ventas, Cobranza, KPIs, Tendencia, Productos, Vendedores).

---

## 2. Reglas de Negocio y Mapeo
1. **Asociación de Órdenes a Tienda:**
   - Toda venta se registra en una tienda a través del vendedor que la concretó (`Order.VendorId` -> `User.StoreId`).
   - Si se especifica un conjunto de `storeIds`, una orden pertenece al filtro si el `User.StoreId` del vendedor está contenido en los IDs seleccionados.
2. **Clasificación de Vendedor (Tienda vs Online):**
   - `UserRole.OnlineSeller` o `RoleString == "Online Seller"` => `"online"`.
   - `UserRole.StoreSeller` u otros roles comerciales => `"store"`.

---

## 3. Contratos de Datos y APIs

### 3.1 DTOs en Backend
En `TopSellerDto`:
```csharp
public record TopSellerDto(
    string VendorId,
    string VendorName,
    int OrdersCount,
    decimal TotalUsd,
    decimal EstimatedCommissionUsd = 0m,
    decimal AverageTicketUsd = 0m,
    double UnitsPerOrder = 0,
    decimal AverageDiscountPercent = 0m,
    decimal ReservationConversionRate = 0m,
    int ConvertedReservationsCount = 0,
    string SellerType = "store", // "store" | "online"
    string? StoreId = null,
    string? StoreName = null
);
```

### 3.2 Endpoints del Dashboard
En `DashboardController`:
Parámetro opcional `[FromQuery] string? storeIds = null` (IDs separados por coma) en:
- `GET /api/dashboard/metrics?period={period}&storeIds={storeIds}`
- `GET /api/dashboard/sales-trend?days={days}&storeIds={storeIds}`
- `GET /api/dashboard/by-sale-type?period={period}&storeIds={storeIds}`
- `GET /api/dashboard/top-sellers?period={period}&limit={limit}&storeIds={storeIds}`
- `GET /api/dashboard/top-products?period={period}&limit={limit}&storeIds={storeIds}`
- `GET /api/dashboard/pipeline?storeIds={storeIds}`
- `GET /api/dashboard/aov-by-branch?period={period}&storeIds={storeIds}`

### 3.3 Frontend Interfaces y Clientes
En `TopSeller` (`api-client.ts`):
```ts
export interface TopSeller {
  // ...
  sellerType?: "store" | "online"
  storeId?: string
  storeName?: string
}
```
En `apiClient`: Métodos de dashboard aceptan `storeIds?: string[]`.

---

## 4. Diseño de Interfaz de Usuario
1. **Componente de Filtro Multitienda (`StoreFilterDropdown` o Popover):**
   - Botón con icono de tienda (`Store`) y texto dinámico:
     - "Todas las tiendas" cuando todas están activas.
     - "[N] tiendas" o nombres cuando hay selección específica.
   - Popover con checklist interactivo:
     - Checkbox "[ ] Seleccionar todas"
     - Checkboxes individuales por cada tienda activa obtenida de `/api/stores`.
2. **Selector de Tipo de Vendedor en `TopSellersChart`:**
   - Tabs o Toggle Group compacto en la cabecera:
     `[ Ambos ] [ Tienda ] [ Online ]`
   - Al cambiar, filtra la lista de vendedores antes de ordenar y graficar.
