# Especificación de Diseño: Optimización de Rendimiento de Red y Eliminación de Peticiones Duplicadas

**Fecha:** 2026-09-25  
**Estado:** Propuesta / En revisión  
**Área:** Frontend (`Ordina.Frontend`), Backend Modular (`Ordina.Backend`), Enrutador (`camihogar-ab-router`)

---

## 1. Problema y Diagnóstico

### 1.1. Peticiones Duplicadas en la Consola Network
1. **Preflight CORS (`OPTIONS`):** El frontend (`camihogar.verkku.com`) realizaba llamadas cross-origin a `https://ch-api-v2.verkku.com` con cabeceras `Authorization` y `Content-Type: application/json`. El navegador por protocolo CORS ejecutaba una solicitud previa `OPTIONS` (204 No Content) por cada solicitud real `GET` o `POST`, viéndose dos entradas por petición.
2. **Excepción de serialización MongoDB en `StockTransfer.cs`:** `StockTransfer` heredaba de `BaseEntity` pero re-declaraba `CreatedAt` y `UpdatedAt`, lanzando `BsonSerializationException` (HTTP 500). TanStack Query reintentaba automáticamente 2 veces la llamada fallida, duplicándola en Network.
3. **Loop de reconexión SSE en Notificaciones:** `use-notifications.ts` usaba la ruta relativa `/api/notifications/stream` contra Pages en vez de la API. Pages respondía `200 text/html`, cerrando la conexión y forzando al navegador a reconectar cada 3 segundos.

### 1.2. Latencia Excesiva (>7 Segundos) en Carga Inicial
1. **Payload masivo de 43.6 MB de JSON:**
   * La colección `orders` contiene comprobantes de pago y fotos de producto en Base64 en el documento.
   * `Home.tsx` cargaba simultáneamente 4 pestañas (`pedidos`, `fabricacion`, `despachos`, `sa-vencidos`), sumando 350 órdenes con imágenes Base64.
   * La transferencia de 43.6 MB a través del enlace de subida de la Raspberry Pi y el túnel tomaba más de 7 segundos.
2. **Dashboard saturando memoria:** `GetAllOrdersForDashboardAsync` deserializaba todos los documentos de órdenes con Base64 de MongoDB a la RAM del contenedor para calcular métricas.

---

## 2. Requerimientos y Decisiones de Diseño

### 2.1. Carga de Imágenes bajo Demanda (`includeImages` / `getImage`)
* **Por defecto (`includeImages = false`):**
  * Todas las consultas paginadas (`/api/orders`, `/api/orders?status=...`, etc.) omiten las imágenes tanto a nivel de proyección en MongoDB como en el mapeo DTO.
  * Se proyectan fuera los campos: `partialPayments.images`, `mixedPayments.images`, `products.images`, `originalProducts.images`.
  * En el DTO, `images` será `null` o lista vacía.
* **Bajo demanda (`includeImages = true`):**
  * En los endpoints de detalle (`GET /api/orders/{id}` y `GET /api/orders/number/{orderNumber}`), el parámetro `includeImages` (o `getImage`) tendrá valor predeterminado `true`, retornando las imágenes completas para la pantalla de detalle y pagos.
  * Si una consulta paginada explícitamente solicita `includeImages=true` o `getImage=true`, devolverá las imágenes.

### 2.2. Precarga de Pestañas en Home
* Con la eliminación de imágenes en las listas, el peso total de una orden baja de ~95 KB a ~3.8 KB (un 96% de reducción).
* 50 órdenes pesan ~190 KB (apenas ~30 KB comprimidos con Gzip/Brotli).
* Las 4 pestañas de Home sumarán solo ~150 KB comprimidos, permitiendo mantener la carga concurrente de las pestañas sin impacto perceptible en la red (<200 ms), garantizando que el cambio entre pestañas ("Pedidos", "Fabricación", "Despachos", "SA Vencidos") sea instantáneo para el usuario.

### 2.3. Eliminación de Preflight CORS vía Worker Proxy
* En `camihogar-ab-router/src/index.ts`, para usuarios en versión V2 (`isV2 === true`), cualquier solicitud hacia `/api/*` se reenviará internamente a `https://ch-api-v2.verkku.com${url.pathname}${url.search}`.
* En `api-client.ts`, las peticiones desde `camihogar.verkku.com` se realizarán de forma relativa (`/api/...`), convirtiéndose en peticiones del **mismo origen (Same-Origin)**.
* **Resultado:** Cero peticiones `OPTIONS` en el navegador; el SSE de notificaciones conectará directamente sin loops ni errores.

---

## 3. Arquitectura y Componentes Afectados

```mermaid
flowchart TD
    Browser[Navegador del Usuario: camihogar.verkku.com] -->|Mismo Origen| Worker[camihogar-ab-router Worker]
    Worker -->|/api/*| TunnelApi[Cloudflare Tunnel: ch-api-v2.verkku.com]
    Worker -->|/* (SPA Assets)| Pages[Cloudflare Pages: camihogar-v2.pages.dev]
    
    TunnelApi --> Monolith[Ordina.Api .NET 10 RPi 5]
    Monolith --> Mongo[(MongoDB ordina_db)]
    
    subgraph "Optimizaciones de Payload"
        P1[Proyección MongoDB: Excluye images Base64]
        P2[MapToDto: includeImages=false en Listas]
        P3[Detalle de Orden: includeImages=true]
    end
```

### 3.1. Backend (`Ordina.Backend`)
1. **`StockTransfer.cs`:**
   * Eliminar la redeclaración de `public DateTime CreatedAt` y `public DateTime UpdatedAt`.
2. **`RepositoryInterfaces.cs` (`OrderQueryFilter`):**
   * Añadir `bool IncludeImages = false`.
3. **`SpecializedRepositories.cs` (`GetFilteredPagedAsync`):**
   * Si `!queryFilter.IncludeImages`, aplicar proyección de exclusión de imágenes en MongoDB:
     `Exclude("partialPayments.images").Exclude("mixedPayments.images").Exclude("products.images").Exclude("originalProducts.images")`.
4. **`DashboardRepository.cs` (`GetAllOrdersForDashboardAsync`):**
   * Aplicar la misma proyección de exclusión de imágenes para métricas y dashboard.
5. **`OrderCoreService.cs`:**
   * Añadir parámetro `includeImages` a `GetByIdAsync`, `GetByOrderNumberAsync` (default `true`) y `MapToDto` (default `true`).
   * En `GetPagedAsync`, pasar `includeImages: filter?.IncludeImages ?? false`.
   * En `MapToDto`, omitir las listas de imágenes si `!includeImages`.
6. **`OrdersController.cs`:**
   * `GetPaged`: aceptar `[FromQuery] bool includeImages = false` y `[FromQuery] bool? getImage = null`.
   * `GetById` y `GetByOrderNumber`: aceptar `[FromQuery] bool includeImages = true` y `[FromQuery] bool? getImage = null`.

### 3.2. Worker (`camihogar-ab-router`)
* Actualizar `src/index.ts` para capturar `url.pathname.startsWith('/api/')` cuando `isV2 === true` y reenviar la solicitud a `https://ch-api-v2.verkku.com`.

### 3.3. Frontend (`Ordina.Frontend`)
* En `.env.production`: dejar `VITE_API_URL=` (vacío) para que las peticiones bajo `camihogar.verkku.com` sean relativas (same-origin).
* En `api-client.ts`:
  * Detectar automáticamente si se navega en preview directo de `pages.dev` para usar `ch-api-v2.verkku.com`, o si se está en el dominio principal para usar URL relativa.
  * Añadir soporte para `includeImages` en `OrderFilter` de `getOrdersPaged`.
* En `use-notifications.ts`: asegurar que la URL del SSE use `resolveApiUrl` o URL relativa limpia.

---

## 4. Plan de Pruebas y Criterios de Aceptación
1. **Tests Unitarios:**
   * Ejecutar suites de pruebas en backend (`Ordina.Application.Tests` y `Ordina.Api.Tests`) verificando que pasen al 100%.
2. **Verificación de Red en el Navegador (`camihogar.verkku.com/?beta=1`):**
   * Peticiones repetidas: Ninguna petición `OPTIONS` previa para llamadas `/api/*` (mismo origen).
   * SSE de Notificaciones: Conectado con estado 200 `text/event-stream` sin reintentos cada 3 segundos.
   * Carga de `/api/stock-transfers`: Respuesta 200 OK sin errores 500.
3. **Verificación de Rendimiento:**
   * Las peticiones de órdenes en Home descargan ~150-200 KB en total en lugar de 43.6 MB.
   * La pantalla de Home carga en menos de 500 ms.
   * Al abrir el detalle de una orden puntual (`/pedidos/:orderNumber`), las imágenes y comprobantes cargan correctamente.
