# Holt-Winters Econometric Forecasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-performance, native .NET 10 Damped Additive Holt-Winters forecasting engine for dual-series (Invoiced vs Collected USD) with seasonality, and wire it end-to-end to the React 19 analytics dashboard.

**Architecture:** Pure C# managed time-series service in `Ordina.Application/Dashboard` doing bounded grid-search parameter optimization ($\alpha, \beta, \gamma$) with damping ($\phi=0.92$), exposed via `GET /api/dashboard/forecast`, and rendered seamlessly in Recharts with solid (real) and dashed (projected) lines.

**Tech Stack:** .NET 10 (C#), ASP.NET Core Web API, React 19, TypeScript, Recharts, Bun.

## Global Constraints
- Native managed C# .NET 10: Zero external ML/C++ native binaries (ARM64 Raspberry Pi 5 compatibility).
- Execution latency < 3ms.
- Damped Trend ($\phi=0.92$) to ensure conservative, realistic, non-overoptimistic projections.
- Dual-series: Invoiced and Collected projected independently.
- Real data lines solid; projected lines dashed (`5 5`); 3-year benchmark dotted (`3 3`).
- TDD: Test before implementation for all backend math and service methods.

---

### Task 1: TimeSeries Forecasting Service (Holt-Winters Engine)

**Files:**
- Create: `Ordina.Backend/src/Application/Dashboard/ITimeSeriesForecastingService.cs`
- Create: `Ordina.Backend/src/Application/Dashboard/HoltWintersForecastingService.cs`
- Modify: `Ordina.Backend/src/Application/ApplicationServiceExtensions.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/HoltWintersForecastingTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public record TimeSeriesPoint(DateTime Date, decimal Value);
  public record ForecastResult(
      IReadOnlyList<decimal> ProjectedValues,
      double Alpha,
      double Beta,
      double Gamma,
      double MapeScore);

  public interface ITimeSeriesForecastingService
  {
      ForecastResult Forecast(
          IReadOnlyList<TimeSeriesPoint> history,
          int horizonSteps,
          int seasonalPeriod = 7,
          double damping = 0.92);
  }
  ```

- [ ] **Step 1: Write the failing unit tests for Holt-Winters**
  Test seasonal forecast on synthetic data with weekly periodicity, test parameter optimization, test non-negativity constraint, and test edge case with short history.

- [ ] **Step 2: Run test to verify it fails**
  Run: `dotnet test Ordina.Backend/tests/Ordina.Application.Tests --filter FullyQualifiedName~HoltWintersForecastingTests`
  Expected: FAIL with compilation error (types do not exist yet).

- [ ] **Step 3: Implement `ITimeSeriesForecastingService` and `HoltWintersForecastingService`**
  Implement Holt-Winters additive smoothing with damping, bounded grid-search for $\alpha \in [0.1, 0.6]$, $\beta \in [0.01, 0.2]$, $\gamma \in [0.1, 0.5]$ minimizing RMSE, and MAPE computation. Register in `ApplicationServiceExtensions.cs`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `dotnet test Ordina.Backend/tests/Ordina.Application.Tests --filter FullyQualifiedName~HoltWintersForecastingTests`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add Ordina.Backend/src/Application/Dashboard/ITimeSeriesForecastingService.cs Ordina.Backend/src/Application/Dashboard/HoltWintersForecastingService.cs Ordina.Backend/src/Application/ApplicationServiceExtensions.cs Ordina.Backend/tests/Ordina.Application.Tests/HoltWintersForecastingTests.cs
  git commit -m "feat(analytics): add Holt-Winters time-series forecasting service with parameter tuning"
  ```

---

### Task 2: Dashboard Service Integration & Controller Endpoint

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/IDashboardService.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`
- Modify: `Ordina.Backend/src/Api/Controllers/DashboardController.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/DashboardForecastTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  // DashboardDTOs.cs
  public record ForecastDataPointDto(
      string Date,
      string Label,
      decimal? InvoicedUsd,
      decimal? CollectedUsd,
      decimal? ProjectedInvoiced,
      decimal? ProjectedCollected,
      decimal? Benchmark3Yr);

  public record ForecastSummaryDto(
      decimal ProjectedInvoicedTotal,
      decimal ProjectedCollectedTotal,
      decimal? BenchmarkTotal,
      double MapeScore);

  public record SalesForecastResponseDto(
      IReadOnlyList<ForecastDataPointDto> Points,
      ForecastSummaryDto Summary);
  ```
- Endpoint:
  `GET /api/dashboard/forecast?period={period}`

- [ ] **Step 1: Write failing tests for Dashboard forecast endpoint logic**
  Create `DashboardForecastTests.cs` verifying that `GetSalesForecastAsync("month")` and `GetSalesForecastAsync("year")` correctly calculate real series, forecast future periods with continuous anchoring, and return the 3-year benchmark when `period == "year"`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `dotnet test Ordina.Backend/tests/Ordina.Application.Tests --filter FullyQualifiedName~DashboardForecastTests`
  Expected: FAIL.

- [ ] **Step 3: Implement DTOs, `GetSalesForecastAsync` in `DashboardService`, and endpoint in `DashboardController`**
  Connect `ITimeSeriesForecastingService` into `DashboardService`, compute multi-currency USD orders, execute forecasting, and expose `GET /api/dashboard/forecast`.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `dotnet test Ordina.Backend/tests/Ordina.Application.Tests`
  Expected: PASS for all 23+ test cases.

- [ ] **Step 5: Commit**
  ```bash
  git add Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs Ordina.Backend/src/Application/Dashboard/IDashboardService.cs Ordina.Backend/src/Application/Dashboard/DashboardService.cs Ordina.Backend/src/Api/Controllers/DashboardController.cs Ordina.Backend/tests/Ordina.Application.Tests/DashboardForecastTests.cs
  git commit -m "feat(api): expose sales forecast endpoint with dual-series projections and benchmark"
  ```

---

### Task 3: Frontend Client & Trend Chart Integration

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/components/analytics/trend-chart.tsx`
- Modify: `Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx`

**Interfaces:**
- Produces:
  ```typescript
  // api-client.ts
  export interface ForecastDataPoint {
    date: string
    label: string
    invoicedUsd?: number
    collectedUsd?: number
    projectedInvoiced?: number
    projectedCollected?: number
    benchmark3Yr?: number
  }

  export interface SalesForecastResponse {
    points: ForecastDataPoint[]
    summary: {
      projectedInvoicedTotal: number
      projectedCollectedTotal: number
      benchmarkTotal?: number
      mapeScore: number
    }
  }

  getSalesForecast(period: string, signal?: AbortSignal): Promise<SalesForecastResponse>
  ```

- [ ] **Step 1: Update `api-client.ts`**
  Add types and `getSalesForecast(period, signal)`.

- [ ] **Step 2: Update `TrendChart` to consume backend forecast structure**
  Render real series with solid strokes and projected series with dashed strokes (`5 5`), benchmark with dotted strokes (`3 3`), displaying the MAPE score badge and summary totals.

- [ ] **Step 3: Update `AnalyticsDashboard`**
  In `loadData`, fetch `apiClient.getSalesForecast(period, signal)` alongside metrics, passing response to `<TrendChart />`.

- [ ] **Step 4: Build and test frontend**
  Run: `bun run build` and `bun test` in `Ordina.Frontend`.
  Expected: Clean build, 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add Ordina.Frontend/src/lib/api-client.ts Ordina.Frontend/src/components/analytics/trend-chart.tsx Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx
  git commit -m "feat(ui): connect analytics dashboard to native backend forecasting engine"
  ```
