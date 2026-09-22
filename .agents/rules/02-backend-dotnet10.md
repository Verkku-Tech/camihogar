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

---

## 7. Malas Prácticas y Prácticas Deprecadas a Evitar en .NET 10

### 7.1. Sintaxis, Tipos y Rendimiento del Lenguaje
1. **NO usar constructores clásicos con boilerplate de campos privados** (`private readonly IService _service; ... this._service = service;`) cuando se trate de inyección de dependencias. Usar **Primary Constructors** (`public class OrderService(IMongoDbContext context, ILogger<OrderService> logger)`).
2. **NO usar inicializaciones verbosas de colecciones** (`new List<string>()`, `new int[] { 1, 2 }`). Usar **Collection Expressions** (`string[] roles = ["Admin", "Seller"];`, `[.. listA, .. listB]`).
3. **NO usar `Dictionary` o `HashSet` mutables para catálogos estáticos / permisos en memoria**. Usar **`FrozenDictionary<TKey, TValue>` y `FrozenSet<T>`** (`.ToFrozenSet(StringComparer.Ordinal)`).
4. **NO definir DTOs de API como clases mutables clásicas** (`public class CreateOrderDto { public string ClientId { get; set; } }`). Usar **`public readonly record struct` o `public record`**.
5. **NO usar `lock (new object())` clásico**. Usar el nuevo tipo nativo **`System.Threading.Lock`** de .NET 9/10.

### 7.2. Asincronía, Hilos y Manejo de Tiempo
1. **PROHIBIDO Sync-over-async** (`.Result`, `.GetAwaiter().GetResult()`, `.Wait()`). Todo debe ser `await` puro para evitar thread pool starvation.
2. **PROHIBIDO `async void` en código de backend**. Todo método asíncrono debe retornar `Task` o `ValueTask`.
3. **PROHIBIDO omitir la propagación de `CancellationToken`**. Todo método asíncrono desde Controladores hasta Repositorios debe aceptar `CancellationToken cancellationToken = default` y pasarlo a MongoDB / HTTP / IO.
4. **NO invocar directamente `DateTime.UtcNow` ni `DateTime.Now`**. Inyectar y usar **`TimeProvider`** (`timeProvider.GetUtcNow().UtcDateTime`) para permitir pruebas unitarias deterministas.
5. **NO usar `Task.Run` dentro de controladores o servicios web** para operaciones de E/S.

### 7.3. Inyección de Dependencias y Clientes HTTP
1. **NO crear dependencias cautivas (*Captive Dependencies*)**: Nunca inyectar servicios `Scoped` directamente dentro de un `Singleton`. Usar `IServiceScopeFactory` si se requiere un scope en un singleton/worker.
2. **NO usar el antipatrón Service Locator** (`IServiceProvider.GetService<T>()` dentro de métodos de negocio). Inyectar dependencias directamente en el constructor o como **Keyed Services**.
3. **NO crear factorías manuales `switch/case`** para resolver implementaciones alternativas. Usar **`AddKeyedScoped` / `AddKeyedSingleton`** nativos de .NET con `[FromKeyedServices("key")]`.
4. **PROHIBIDO instanciar `new HttpClient()` manualmente**. Usar `IHttpClientFactory` / Clientes Tipados con `.AddStandardResilienceHandler()`.

### 7.4. Persistencia en MongoDB
1. **PROHIBIDO registrar `MongoClient` con ciclo de vida `Scoped` o instanciarlo con `new MongoClient()` por request**. `IMongoClient` debe ser estrictamente **Singleton**.
2. **PROHIBIDO ejecutar consultas ilimitadas (*Unbounded Queries*)** (`Find(_ => true).ToListAsync()`) en colecciones de negocio que crezcan sin control. Exigir siempre paginación (`.Skip().Limit()`).
3. **NO omitir proyecciones en listas y tablas**. Proyectar únicamente los campos requeridos con `.Project(o => new OrderListDto { ... })` para evitar transferir documentos completos con subdocumentos masivos.
4. **NO omitir tolerancia a campos extra**. Añadir `[BsonIgnoreExtraElements]` en las entidades del dominio para evitar fallos cuando el esquema evoluciona en MongoDB.

### 7.5. Caché, APIs y Observabilidad
1. **NO usar caché manual con `IMemoryCache` vulnerable a Cache Stampede**. Usar **`HybridCache`** (.NET 9/10).
2. **PROHIBIDO el logging no estructurado con interpolación de strings** (`logger.LogInformation($"Pedido {id} creado")`). Usar siempre logging estructurado semántico: `logger.LogInformation("Pedido {OrderId} creado", id)`.
3. **PROHIBIDO retornar HTTP 500 para errores de validación de negocio**. Usar `ProblemDetails` RFC 7807 (400, 404, 409).
4. **PROHIBIDO tragar excepciones silenciosamente (*Exception Swallowing*)** (`catch (Exception) { }` sin rethrow o logging enriquecido).

