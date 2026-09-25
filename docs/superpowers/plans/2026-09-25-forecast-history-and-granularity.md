# Plan de Implementación: Historial de Proyecciones de Venta y Granularidad Semanal/Diaria

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la persistencia y versionado automático de proyecciones con idempotencia diaria ("Proyecciones nuevas = Gráficas nuevas"), habilitar la granularidad semanal con carrusel hasta +3 semanas y la granularidad diaria por 24 horas, y crear el modal interactivo de historial y detalle en el frontend.

**Architecture:** 
1. `SalesForecastRecord` en MongoDB almacena versiones con hash SHA256 de los valores proyectados. Si no hay cambios en la proyección, no duplica y solo actualiza los valores reales y recaudos; si cambia la proyección, crea una nueva versión (`Proyección N+1`).
2. `DashboardService` implementa cálculo semanal de 7 días (con `weekOffset: 0..3` proyectando semanas futuras) y cálculo diario de 24 horas (distribución horaria histórica ponderada para horas restantes).
3. `DashboardController` expone `GET /api/dashboard/forecast`, `GET /api/dashboard/forecast/history` y `GET /api/dashboard/forecast/history/{id}`.
4. `TrendChart` añade carrusel para semanas y visualización por franjas horarias.
5. `ForecastHistoryModal` lista las proyecciones y permite ver la gráfica histórica correspondiente dentro del modal.

**Tech Stack:** .NET 10, C#, MongoDB Driver, React, TypeScript, Tailwind CSS, Recharts, Lucide Icons.

## Global Constraints
- **NO HACER `git commit`**: Todas las modificaciones deben permanecer sin commitear en el working tree del worktree.
- **NO ALTERAR contenedores legados**: Solo modificar `ordina-modular-api` en RPi (puerto 8090).
- **Idempotencia diaria**: Proyecciones idénticas no crean nuevo registro hoy, solo actualizan datos reales; proyecciones nuevas crean versiones nuevas.

---

### Task 1: Entidad de Dominio y Repositorio MongoDB para Proyecciones

**Files:**
- Create: `Ordina.Backend/src/Domain/Dashboard/SalesForecastRecord.cs`
- Create: `Ordina.Backend/src/Application/Common/ISalesForecastRepository.cs`
- Create: `Ordina.Backend/src/Infrastructure/Repositories/SalesForecastRepository.cs`
- Modify: `Ordina.Backend/src/Infrastructure/DependencyInjection.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/SalesForecastRepositoryTests.cs`

**Interfaces:**
- Produces: `ISalesForecastRepository` con métodos:
  - `Task<SalesForecastRecord?> GetLatestAsync(string period, int weekOffset, DateTime startDate, DateTime endDate, CancellationToken ct)`
  - `Task<int> GetMaxVersionNumberAsync(CancellationToken ct)`
  - `Task<SalesForecastRecord> InsertAsync(SalesForecastRecord record, CancellationToken ct)`
  - `Task<SalesForecastRecord> UpdateAsync(SalesForecastRecord record, CancellationToken ct)`
  - `Task<IReadOnlyList<SalesForecastRecord>> GetHistoryAsync(string? period, CancellationToken ct)`
  - `Task<SalesForecastRecord?> GetByIdAsync(string id, CancellationToken ct)`

- [ ] **Step 1: Escribir el test para la entidad y mapeo BSON**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/SalesForecastRepositoryTests.cs`:
```csharp
using MongoDB.Bson.Serialization;
using Ordina.Domain.Dashboard;
using Xunit;

namespace Ordina.Application.Tests;

public class SalesForecastRepositoryTests
{
    [Fact]
    public void SalesForecastRecord_ShouldMapBsonProperly()
    {
        var classMap = BsonClassMap.LookupClassMap(typeof(SalesForecastRecord));
        Assert.NotNull(classMap);
        Assert.NotNull(classMap.GetMemberMap(nameof(SalesForecastRecord.VersionNumber)));
        Assert.NotNull(classMap.GetMemberMap(nameof(SalesForecastRecord.ProjectionsHash)));
    }
}
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~SalesForecastRepositoryTests`
Expected: Fails compilation (class not found).

- [ ] **Step 3: Crear `SalesForecastRecord.cs`**

Crear `Ordina.Backend/src/Domain/Dashboard/SalesForecastRecord.cs`:
```csharp
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Dashboard;

public class SalesForecastRecord : BaseEntity
{
    [BsonElement("versionNumber")]
    public int VersionNumber { get; set; }

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("period")]
    public string Period { get; set; } = "month";

    [BsonElement("weekOffset")]
    public int WeekOffset { get; set; } = 0;

    [BsonElement("startDate")]
    public DateTime StartDate { get; set; }

    [BsonElement("endDate")]
    public DateTime EndDate { get; set; }

    [BsonElement("projectionsHash")]
    public string ProjectionsHash { get; set; } = string.Empty;

    [BsonElement("points")]
    public List<ForecastRecordPoint> Points { get; set; } = new();

    [BsonElement("summary")]
    public ForecastRecordSummary Summary { get; set; } = null!;
}

public class ForecastRecordPoint
{
    [BsonElement("date")]
    public string Date { get; set; } = string.Empty;

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    [BsonElement("actualInvoiced")]
    public decimal? ActualInvoiced { get; set; }

    [BsonElement("actualCollected")]
    public decimal? ActualCollected { get; set; }

    [BsonElement("projectedInvoiced")]
    public decimal ProjectedInvoiced { get; set; }

    [BsonElement("projectedCollected")]
    public decimal ProjectedCollected { get; set; }

    [BsonElement("benchmark")]
    public decimal? Benchmark { get; set; }
}

public class ForecastRecordSummary
{
    [BsonElement("projectedInvoicedTotal")]
    public decimal ProjectedInvoicedTotal { get; set; }

    [BsonElement("projectedCollectedTotal")]
    public decimal ProjectedCollectedTotal { get; set; }

    [BsonElement("realInvoicedTotal")]
    public decimal RealInvoicedTotal { get; set; }

    [BsonElement("realCollectedTotal")]
    public decimal RealCollectedTotal { get; set; }

    [BsonElement("benchmarkTotal")]
    public decimal? BenchmarkTotal { get; set; }

    [BsonElement("mapeScore")]
    public double MapeScore { get; set; }
}
```

- [ ] **Step 4: Crear `ISalesForecastRepository.cs` e implementación en `SalesForecastRepository.cs`**

Crear `Ordina.Backend/src/Application/Common/ISalesForecastRepository.cs`:
```csharp
using Ordina.Domain.Dashboard;

namespace Ordina.Application.Common;

public interface ISalesForecastRepository
{
    Task<SalesForecastRecord?> GetLatestAsync(string period, int weekOffset, DateTime startDate, DateTime endDate, CancellationToken ct = default);
    Task<int> GetMaxVersionNumberAsync(CancellationToken ct = default);
    Task<SalesForecastRecord> InsertAsync(SalesForecastRecord record, CancellationToken ct = default);
    Task<SalesForecastRecord> UpdateAsync(SalesForecastRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<SalesForecastRecord>> GetHistoryAsync(string? period = null, CancellationToken ct = default);
    Task<SalesForecastRecord?> GetByIdAsync(string id, CancellationToken ct = default);
}
```

Crear `Ordina.Backend/src/Infrastructure/Repositories/SalesForecastRepository.cs` implementando las consultas en la colección `sales_projections`.

- [ ] **Step 5: Registrar el repositorio en `DependencyInjection.cs`**

En `Ordina.Backend/src/Infrastructure/DependencyInjection.cs`:
`services.AddScoped<ISalesForecastRepository, SalesForecastRepository>();`

- [ ] **Step 6: Ejecutar tests para verificar que compila y pasa**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~SalesForecastRepositoryTests`
Expected: PASS

---

### Task 2: Implementar Cálculo Semanal con Carrusel y Diario por Horas

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/IDashboardService.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/DTOs.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/WeeklyAndDailyForecastTests.cs`

**Interfaces:**
- `GetSalesForecastAsync(string period = "month", int weekOffset = 0, CancellationToken ct = default)`

- [ ] **Step 1: Escribir tests para cálculo semanal (con weekOffset) y diario (24 horas)**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/WeeklyAndDailyForecastTests.cs`:
- Test 1: `CalculateDailyForecast_ShouldReturn24HourlyPoints` (verifica 24 puntos de "00:00" a "23:00").
- Test 2: `CalculateWeeklyForecast_WithOffset0_ShouldReturn7Days` (verifica 7 días desde lunes a domingo).
- Test 3: `CalculateWeeklyForecast_WithOffset1_ShouldProjectFutureWeek` (verifica que todos los días futuros tengan `actualInvoiced == null`).

- [ ] **Step 2: Ejecutar tests para verificar fallo**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~WeeklyAndDailyForecastTests`
Expected: FAIL (métodos no implementados o parámetros no coinciden).

- [ ] **Step 3: Implementar `CalculateDailyHourlyForecast` en `DashboardService.cs`**

Generar 24 franjas horarias:
- Horas pasadas: Suma real de pedidos y cobros en esa hora hoy.
- Horas futuras: Distribución porcentual horaria histórica ponderada (últimos 90 días) multiplicada por el volumen esperado del día.

- [ ] **Step 4: Implementar `CalculateWeeklyForecast` en `DashboardService.cs`**

Generar 7 días de Lunes a Domingo para `SemanaActual + weekOffset`:
- `weekOffset = 0`: Días pasados reales, días presentes/futuros proyectados con Holt-Winters.
- `weekOffset > 0`: Pasos extendidos en el horizonte de predicción, 100% proyectados.

- [ ] **Step 5: Ejecutar tests y validar que pasen**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~WeeklyAndDailyForecastTests`
Expected: PASS

---

### Task 3: Pipeline de Idempotencia y Versionado de Proyecciones

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/ForecastIdempotencyTests.cs`

**Interfaces:**
- `ComputeProjectionsHash(IReadOnlyList<ForecastDataPointDto> points)` $\to$ `string` (SHA256)
- Lógica de persistencia en `GetSalesForecastAsync`:
  - Si existe y hash idéntico $\to$ actualiza reales y retorna.
  - Si no existe o hash difiere $\to$ incrementa versión y guarda nuevo.

- [ ] **Step 1: Escribir tests de idempotencia y versionado**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/ForecastIdempotencyTests.cs`:
- Test 1: Consulta repetida con idéntica proyección no inserta nuevo documento, actualiza datos reales del existente.
- Test 2: Si cambian los valores proyectados, genera una nueva versión `VersionNumber + 1`.

- [ ] **Step 2: Ejecutar test para verificar fallo**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~ForecastIdempotencyTests`
Expected: FAIL

- [ ] **Step 3: Implementar la lógica de persistencia e idempotencia en `DashboardService.cs`**

Integrar llamada a `ISalesForecastRepository` dentro de `GetSalesForecastAsync` y añadir métodos:
- `Task<IReadOnlyList<SalesForecastHistoryItemDto>> GetForecastHistoryAsync(string? period, CancellationToken ct)`
- `Task<SalesForecastRecordDto?> GetForecastByIdAsync(string id, CancellationToken ct)`

- [ ] **Step 4: Ejecutar tests y verificar que pasen**

Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~ForecastIdempotencyTests`
Expected: PASS

---

### Task 4: Endpoints API en `DashboardController`

**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/DashboardController.cs`
- Test: `Ordina.Backend/tests/Ordina.Api.Tests/DashboardForecastControllerTests.cs`

**Interfaces:**
- `GET /api/dashboard/forecast?period={period}&weekOffset={weekOffset}`
- `GET /api/dashboard/forecast/history?period={period}`
- `GET /api/dashboard/forecast/history/{id}`

- [ ] **Step 1: Escribir tests para los nuevos endpoints de forecast e historial**

Crear `Ordina.Backend/tests/Ordina.Api.Tests/DashboardForecastControllerTests.cs`:
- Test que `GET /api/dashboard/forecast?period=week&weekOffset=1` responde 200 con DTO.
- Test que `GET /api/dashboard/forecast/history` responde 200 con lista.
- Test que `GET /api/dashboard/forecast/history/{id}` responde 200 o 404.

- [ ] **Step 2: Ejecutar test para comprobar fallo**

Run: `dotnet test tests/Ordina.Api.Tests --filter FullyQualifiedName~DashboardForecastControllerTests`
Expected: FAIL (parámetros o rutas inexistentes).

- [ ] **Step 3: Modificar `DashboardController.cs`**

Actualizar `GetForecast` para aceptar `[FromQuery] int weekOffset = 0`.
Añadir:
- `[HttpGet("forecast/history")]`
- `[HttpGet("forecast/history/{id}")]`

- [ ] **Step 4: Ejecutar todos los tests unitarios y de API**

Run: `dotnet test tests/Ordina.Api.Tests` y `dotnet test tests/Ordina.Application.Tests`
Expected: PASS (todos los tests pasan).

---

### Task 5: Cliente Frontend y Tipos DTO

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client-dtos.ts`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Test: `npm run build` en `Ordina.Frontend`

**Interfaces:**
- `SalesForecastHistoryItem`: `{ id, versionNumber, title, period, startDate, endDate, generatedAtUtc, projectedInvoicedTotal, projectedCollectedTotal, realInvoicedTotal, realCollectedTotal }`
- `SalesForecastRecordDto`: `{ id, versionNumber, title, period, points, summary }`
- Métodos en `apiClient`:
  - `getSalesForecast(period?: string, weekOffset?: number, signal?: AbortSignal)`
  - `getSalesForecastHistory(period?: string, signal?: AbortSignal)`
  - `getSalesForecastHistoryById(id: string, signal?: AbortSignal)`

- [ ] **Step 1: Definir los tipos en `api-client-dtos.ts`**
- [ ] **Step 2: Añadir métodos en `api-client.ts`**
- [ ] **Step 3: Validar compilación con `npm run build`**

---

### Task 6: UI - Carrusel Semanal y Vista Horaria en `TrendChart.tsx`

**Files:**
- Modify: `Ordina.Frontend/src/components/analytics/trend-chart.tsx`
- Modify: `Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx`

- [ ] **Step 1: Añadir controles de carrusel cuando `period === "week"`**
  - Botones `<` y `>` para desplazarse entre semana actual (`offset 0`) y hasta +3 semanas (`offset 1, 2, 3`).
  - Indicador de texto: `"Semana actual (dd/MM - dd/MM)"`, `"Semana +1 (dd/MM - dd/MM)"`, etc.
  - Al cambiar de semana, disparar recarga de datos con `weekOffset`.
- [ ] **Step 2: Ajustar escala y etiquetas para `period === "day"`**
  - Formato de 24 horas en eje X (`00:00`, `04:00`, `08:00`, `12:00`, `16:00`, `20:00`, `23:00`).
  - Subtítulo dinámico: *"Proyección horaria (24 horas) y ritmo comercial continuo"*.
- [ ] **Step 3: Añadir botón de "Historial" en el encabezado de `TrendChart`**
  - Botón con icono `History` y texto "Historial" que emite evento o callback `onOpenHistory()`.

---

### Task 7: UI - Modal de Historial y Detalle (`ForecastHistoryModal.tsx`)

**Files:**
- Create: `Ordina.Frontend/src/components/analytics/forecast-history-modal.tsx`
- Modify: `Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx`

- [ ] **Step 1: Crear `forecast-history-modal.tsx`**
  - **Vista Lista**:
    - Tabla/tarjetas de proyecciones guardadas.
    - Badges con versión (`Proyección N`), rango temporal, fecha de cálculo, total facturado y cobrado.
    - Botón "Ver Detalle".
  - **Vista Detalle**:
    - Botón `← Volver al listado`.
    - Resumen superior con las métricas de la proyección seleccionada.
    - Gráfica interactiva de la proyección histórica seleccionada (usando `TrendChart` o Recharts embebido con los `points` del snapshot).
- [ ] **Step 2: Conectar el modal en `analytics-dashboard.tsx`**
- [ ] **Step 3: Validar compilación con `npm run build`**

---

### Task 8: Despliegue en RPi, Cloudflare Pages y Verificación End-to-End

**Files:**
- RPi Container: `ordina-modular-api`
- Cloudflare Pages: `camihogar-v2`

- [ ] **Step 1: Compilar backend para Linux ARM64 y desplegar en RPi**
  - `dotnet publish src/Api/Ordina.Api.csproj -c Release -r linux-arm64 --self-contained false -o bin/arm64-publish`
  - Transferir archivos a RPi y reiniciar `ordina-modular-api`.
- [ ] **Step 2: Compilar y desplegar frontend en Cloudflare Pages**
  - `npx wrangler pages deploy dist --project-name=camihogar-v2`
- [ ] **Step 3: Verificación con curl de los endpoints**
  - Probar `GET /api/dashboard/forecast?period=week&weekOffset=1`.
  - Probar `GET /api/dashboard/forecast/history`.
- [ ] **Step 4: Verificación en el navegador**
  - Probar el carrusel de semanas (+1, +2, +3).
  - Probar la vista diaria por horas (24h).
  - Abrir el modal de historial, listar proyecciones y ver el detalle de una proyección histórica.
