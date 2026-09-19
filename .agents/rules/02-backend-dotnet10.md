# Reglas de Desarrollo Backend (.NET 10 & MongoDB)

Este documento define los estándares técnicos, patrones y optimizaciones obligatorias para el backend monolítico de **Camihogar / Ordina** (`Ordina.Backend`).

---

## 1. Versión del Framework y Sintaxis Moderna (.NET 10 / C# 13-14)

1. **Target Framework:** `net10.0` obligatorio en todos los proyectos (`Ordina.Domain`, `Ordina.Application`, `Ordina.Infrastructure`, `Ordina.Api`, `Ordina.*.Tests`).
2. **Nullable Reference Types & Implicit Usings:** Siempre activados (`<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`).
3. **Primary Constructors:** Usar constructores primarios en todas las clases de servicio, controladores y repositorios para inyección de dependencias limpia y sin boilerplate de campos privados:
   ```csharp
   public class ManufacturingService(
       IMongoDbContext context, 
       ILogger<ManufacturingService> logger) : IManufacturingService
   {
       // ...
   }
   ```
4. **Collection Expressions & Spread:** Usar `[...]` y `..` para inicialización de colecciones:
   ```csharp
   string[] allowedRoles = ["Admin", "Workshop", "Seller"];
   List<string> merged = [.. teamIds, .. additionalIds, "SYSTEM"];
   ```
5. **Colecciones Inmutables Ultrarrápidas (`FrozenDictionary` / `FrozenSet`):**
   Para catálogos en memoria, permisos y tablas estáticas, usar `System.Collections.Frozen` para búsquedas O(1) con aceleración nativa:
   ```csharp
   public static readonly FrozenSet<string> SystemPermissions = 
       new[] { "Orders.Create", "Orders.Edit", "Workshop.UpdateStage" }.ToFrozenSet(StringComparer.Ordinal);
   ```

---

## 2. Inmutabilidad y Optimización de DTOs (`record` y `readonly record struct`)

1. **DTOs de Entrada y Salida como `record`:**
   - Todos los DTOs de API y modelos de transferencia deben ser `public record` o `public readonly record struct` para garantizar inmutabilidad, comparación estructural y mínima sobrecarga de memoria:
   ```csharp
   public readonly record struct CreateOrderRequest(
       string ClientId,
       string StoreId,
       IReadOnlyList<OrderItemDto> Items,
       decimal GeneralDiscountPercent,
       string? Notes
   );

   public record OrderDetailDto(
       string Id,
       string OrderNumber,
       string ClientName,
       OrderStatus Status,
       decimal TotalUsd,
       decimal TotalVes,
       DateTime CreatedAt
   );
   ```
2. **Modelos de Paginación Estándar:**
   ```csharp
   public readonly record struct PagedRequest(int Page = 1, int PageSize = 20, string? Search = null);
   public record PagedResult<T>(IReadOnlyList<T> Items, long TotalCount, int Page, int PageSize);
   ```

---

## 3. Manejo Asíncrono, Cancelación y Determinismo de Tiempo

1. **Propagación Completa de `CancellationToken`:**
   - **TODOS** los métodos asíncronos en Controladores, Servicios de Aplicación y Repositorios deben aceptar `CancellationToken cancellationToken = default` y pasarlo a las llamadas de MongoDB / HTTP / IO:
   ```csharp
   [HttpGet("{id}")]
   public async Task<ActionResult<OrderDetailDto>> GetOrderByIdAsync(
       string id, 
       CancellationToken cancellationToken)
   {
       var order = await _orderService.GetByIdAsync(id, cancellationToken);
       return order is not null ? Ok(order) : NotFound();
   }
   ```
2. **Abstracción Determinista de Tiempo (`TimeProvider`):**
   - No usar llamadas directas a `DateTime.UtcNow`. Inyectar `TimeProvider` vía DI para permitir pruebas TDD deterministas de vencimientos y fechas con `FakeTimeProvider`:
   ```csharp
   var now = timeProvider.GetUtcNow().UtcDateTime;
   ```
3. **Cero `.Result` o `.Wait()`:** Prohibido bloquear el hilo con sincronización bloqueante.

---

## 4. Inyección de Dependencias, Keyed Services y Service Discovery

1. **Keyed Services (Cero Factorías Manuales Innecesarias):**
   - Registrar múltiples implementaciones de una misma interfaz mediante `AddKeyedScoped` o `AddKeyedSingleton`:
   ```csharp
   builder.Services.AddKeyedScoped<IExchangeRateScrapper, BcvScrapper>("bcv");
   builder.Services.AddKeyedScoped<IExchangeRateScrapper, EnParaleloScrapper>("paralelo");
   ```
   - Inyectarlas con el atributo `[FromKeyedServices("key")]`.
2. **Service Discovery y Resiliencia en Clientes HTTP:**
   - Todo `HttpClient` para servicios externos o scrappers debe usar `AddServiceDiscovery()` y `AddStandardResilienceHandler()` (reintentos, circuit breaker y timeout con Polly v8):
   ```csharp
   builder.Services.AddHttpClient<IBcvScrapperClient, BcvScrapperClient>(client =>
   {
       client.BaseAddress = new Uri("http://scrappers");
   }).AddStandardResilienceHandler();
   ```

---

## 5. Persistencia en MongoDB y Caché Híbrido

1. **`IMongoClient` como Singleton Estricto:**
   - Nunca crear instancias manuales de `MongoClient`. Registrar `IMongoClient` y `IMongoDatabase` en el contenedor de DI como **Singleton**.
2. **Prohibición de Consultas Ilimitadas (Unbounded Queries):**
   - Nunca hacer `Find(_ => true).ToListAsync()` sin paginación (`.Skip().Limit()`) a menos que sea un catálogo pequeño (<50 registros garantizados) y esté explícitamente en caché.
3. **Mantenimiento de Índices en Arranque (`IndexManager`):**
   - Todo campo utilizado en filtros frecuentes (`orderNumber`, `rutId`, `status`, `stage`, `createdAt`) debe tener un índice compuesto creado en la inicialización de la app.
4. **Caché con Protección Anti-Stampede (`HybridCache`):**
   - Utilizar `HybridCache` (.NET 9/10) para evitar que peticiones concurrentes sobrecarguen la base de datos cuando expire una clave.

---

## 6. Observabilidad y Logging Estructurado (OpenTelemetry + Aspire)

1. **Enriquecimiento con Scopes de Negocio:**
   - Al ejecutar operaciones de dominio, abrir scopes de logging para adjuntar contexto relevante:
   ```csharp
   using (logger.BeginScope(new Dictionary<string, object>
   {
       ["Module"] = "Manufacturing",
       ["OrderId"] = orderId,
       ["Stage"] = newStage,
       ["UserId"] = userId
   }))
   {
       logger.LogInformation("Transitioned work order {OrderId} to stage {Stage}", orderId, newStage);
   }
   ```
2. **Exportador OTLP Centralizado:**
   - Todo trace, métrica y log se exporta a través de `OpenTelemetryProtocol` hacia el Aspire Dashboard (`http://aspire-dashboard:4317`).
