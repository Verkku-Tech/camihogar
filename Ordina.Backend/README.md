# Ordina.Backend — Monolito Modular Clean en .NET 10

Backend de alto rendimiento para **Camihogar / Ordina ERP**, diseñado bajo los principios de **Clean Architecture** y **Monolito Modular**, optimizado para ejecutarse en **Raspberry Pi 5 (ARM64)** con compilación **ReadyToRun (R2R)** y persistencia directa en **MongoDB** (100% libre de dependencias de bases relacionales, Supabase o Redis).

---

## 🏛️ Arquitectura y Estructura de Proyectos

La solución `Ordina.sln` se estructura en 4 capas limpias y desacopladas:

```
Ordina.Backend/
├── src/
│   ├── Domain/                 # Ordina.Domain.csproj
│   │   ├── Security/           # Role, Permission, RolePermission
│   │   ├── Users/              # User, UserProfile, Client, Permissions constants
│   │   ├── Catalog/            # Provider, Product, Category
│   │   ├── Orders/             # Order, OrderItem, OrderHistory, Payment, Enums
│   │   ├── Manufacturing/      # WorkOrder, ManufacturingStage, RefabricationRecord
│   │   ├── Dispatch/           # DispatchRoute, DeliveryStatus, DispatchItem
│   │   ├── Finance/            # ExchangeRate, BankAccount, CashRegister
│   │   └── Stores/             # Store
│   │
│   ├── Application/            # Ordina.Application.csproj
│   │   ├── Security/           # DTOs, IAuthService, ITokenService
│   │   ├── Users/              # DTOs, IUserService, IRoleService
│   │   ├── Clients/            # DTOs, IClientService, RutValidator
│   │   ├── Catalog/            # DTOs, IProductService, ICategoryService
│   │   ├── Orders/             # DTOs, IOrderCoreService, IPagedResult
│   │   ├── Manufacturing/      # DTOs, IManufacturingService
│   │   ├── Dispatch/           # DTOs, IDispatchService
│   │   ├── Finance/            # DTOs, IFinanceService, IBcvExchangeRateService
│   │   └── Common/             # PagedRequest, PagedResult<T>, Exceptions
│   │
│   ├── Infrastructure/         # Ordina.Infrastructure.csproj
│   │   ├── Persistence/        # MongoDbContext (Singleton MongoClient), Mappings BSON
│   │   ├── Repositories/       # OrderRepository, ClientRepository, etc.
│   │   ├── Caching/            # In-Memory Cache IMemoryCache con TTL
│   │   └── External/           # BCV Scraper / API Client con reintentos
│   │
│   └── Api/                    # Ordina.Api.csproj
│       ├── Controllers/        # Controladores especializados por caso de uso
│       ├── Middlewares/        # Idempotency, GlobalException, AntiCsrf
│       ├── Extensions/         # OpenTelemetry, Swagger, Cors, DependencyInjection
│       └── Program.cs          # Pipeline ASP.NET Core minimalista (.NET 10)
│
└── tests/
    ├── Ordina.Application.Tests/ # Pruebas unitarias de casos de uso y cálculo financiero
    └── Ordina.Api.Tests/         # Pruebas de middlewares, idempotencia y seguridad
```

---

## ⚡ Principios de Diseño Técnico

1. **Monolito Modular Orientado a Casos de Uso:**
   - En lugar de controladores monolíticos sobrecargados, los endpoints están compartimentados según el rol operativo:
     - `ManufacturingController`: Enfocado en órdenes de trabajo de taller, avance de etapas y refabricación.
     - `DispatchController`: Rutas de entrega, guías de despacho y confirmación en bodega.
     - `OrdersController`: Creación de ventas, presupuestos, reservas y control de pagos.
   - Proyecciones de consulta estrictas (`BsonProjectionDefinition`) para evitar sobrecarga de red y serialización innecesaria.

2. **Persistencia Directa en MongoDB (Cero EF / Cero Redis):**
   - Inyección de `IMongoClient` como **Singleton**.
   - Índices compuestos preconfigurados (`OrderNumber`, `Status`, `CreatedAt`, `Client.DocumentNumber`).
   - Caché local en memoria (`IMemoryCache`) para datos de alta frecuencia y baja mutación (tasas de cambio BCV, roles).

3. **Inmutabilidad y Concurrencia:**
   - DTOs definidos como `public record` o `public readonly record struct`.
   - Control de concurrencia optimista mediante `updatedAt` / cabecera `If-Match`: cambios conflictivos retornan `409 Conflict`.
   - Idempotencia distribuida vía cabecera `X-Mutation-Id: <UUIDv4>` con registro de resultado y TTL de 24 horas.

4. **Seguridad y Anti-CSRF:**
   - Autenticación híbrida: Token JWT de corta duración (15 min) en memoria; refresh token en Cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
   - Validación estricta de cabecera `X-Requested-With: XMLHttpRequest` para mitigar ataques CSRF en endpoints sensibles.

5. **Observabilidad y Telemetría:**
   - Instrumentación nativa con OpenTelemetry (`Ordina.Backend` ActivitySource y Meter).
   - Exportación OTLP (`grpc://aspire-dashboard:4317`) hacia el dashboard de Aspire.
   - Registro estructurado con `_logger.BeginScope` inyectando contexto de negocio (`OrderId`, `UserId`, `Module`).

---

## 🚀 Requisitos y Comandos de Ejecución

### Prerrequisitos
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Instancia de MongoDB activa (local o Docker en `localhost:27017`)

### Restauración y Compilación
```bash
# Restaurar paquetes de la solución
dotnet restore Ordina.sln

# Compilar en modo Release
dotnet build src/Api/Ordina.Api.csproj -c Release
```

### Ejecución Local
```bash
# Iniciar el API en desarrollo
dotnet run --project src/Api/Ordina.Api.csproj
```
El servicio iniciará en `http://localhost:5000` con Swagger disponible en `/swagger`.

---

## 🧪 Pruebas Automatizadas (TDD)

El proyecto sigue una estricta política de pruebas unitarias y de integración para flujos críticos:

```bash
# Ejecutar pruebas de lógica de aplicación (ventas, cálculos, validaciones)
dotnet test tests/Ordina.Application.Tests

# Ejecutar pruebas de middlewares de API (idempotencia, excepciones globales, anti-CSRF)
dotnet test tests/Ordina.Api.Tests

# Ejecutar con reporte de cobertura de código
dotnet test --collect:"XPlat Code Coverage"
```

---

## 📦 Compilación para Producción (Raspberry Pi 5 ARM64)

Para el despliegue en la Raspberry Pi 5 con runtime optimizado:

```bash
dotnet publish src/Api/Ordina.Api.csproj \
  -c Release \
  -r linux-arm64 \
  --self-contained false \
  -p:PublishReadyToRun=true \
  -o ./publish/rpi-arm64
```
Esto genera binarios precompilados AOT/ReadyToRun que reducen a milisegundos el tiempo de arranque (JIT startup) y minimizan el uso de memoria RAM.
