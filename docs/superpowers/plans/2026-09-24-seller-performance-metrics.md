# Seller Performance Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich vendor BI ranking with multi-metric performance dimensions (ticket promedio, pedidos concretados, unidades por pedido, descuento promedio, conversión de reservas) and interactive metric selector.

**Architecture:** Extend backend `TopSellerDto` and `DashboardService.GetTopSellersAsync` with faithful mathematical derivations from concrete orders only. Update frontend `TopSellersChart` with metric switcher and dynamic formatting.

**Tech Stack:** .NET 10, C# 13, xUnit v3, React 19, TypeScript, Recharts, Tailwind CSS 4, Radix UI.

## Global Constraints
- Work strictly inside worktree `f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith`.
- Only consider concrete orders (`IsValidOrder(o) == true`), strictly excluding reservations (`RES-`), budgets (`PRE-`), and cancelled/declined statuses.
- Use Ponytail philosophy: minimal working code, standard library, avoid unneeded abstractions.
- All test runs must use `dotnet run --project tests/... -- -class <Namespace.ClassName>`.

---

### Task 1: Extend Backend `TopSellerDto`
**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs`

**Interfaces:**
- Produces: `TopSellerDto` with properties:
  `string VendorId, string VendorName, int OrdersCount, decimal TotalUsd, decimal? EstimatedCommissionUsd, decimal AverageTicketUsd = 0m, double UnitsPerOrder = 0, decimal AverageDiscountPercent = 0m, decimal ReservationConversionRate = 0m, int ConvertedReservationsCount = 0`

- [ ] **Step 1: Update `TopSellerDto` record declaration**
Add default-valued parameters to `TopSellerDto` in `Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs`.

- [ ] **Step 2: Verify project builds**
Run `dotnet build Ordina.Backend/src/Application/Ordina.Application.csproj`.

- [ ] **Step 3: Commit**
`git add Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs; git commit -m "feat(application): extend TopSellerDto with performance metrics"`

---

### Task 2: Implement Metrics Calculations in `DashboardService.GetTopSellersAsync`
**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`

**Interfaces:**
- Consumes: `allOrders` from `_dashboardRepository.GetAllOrdersForDashboardAsync`
- Produces: `TopSellerDto` with accurately calculated metrics.

- [ ] **Step 1: Update `GetTopSellersAsync` in `DashboardService.cs`**
Calculate:
- `totalSales`: Sum of USD totals of valid concrete orders for vendor.
- `ordersCount`: Number of valid concrete orders for vendor.
- `averageTicket`: `ordersCount > 0 ? Math.Round(totalSales / ordersCount, 2) : 0m`.
- `totalUnits`: `vendorOrders.Sum(o => o.Products?.Sum(p => p.Quantity) ?? 0)`.
- `unitsPerOrder`: `ordersCount > 0 ? Math.Round((double)totalUnits / ordersCount, 2) : 0`.
- `discountPct`: Calculate sum of discounts vs sum of base subtotals.
- `reservationConversionRate`: Track reservations created by or assigned to vendor vs converted orders.

- [ ] **Step 2: Verify project builds**
Run `dotnet build Ordina.Backend/src/Application/Ordina.Application.csproj`.

- [ ] **Step 3: Commit**
`git add Ordina.Backend/src/Application/Dashboard/DashboardService.cs; git commit -m "feat(application): calculate seller performance metrics in GetTopSellersAsync"`

---

### Task 3: Unit Tests for Seller Performance Metrics
**Files:**
- Modify: `Ordina.Backend/tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs`

**Interfaces:**
- Tests `GetTopSellersAsync` calculation correctness with reservations vs concrete orders.

- [ ] **Step 1: Write unit tests verifying new seller metrics**
Add tests asserting `AverageTicketUsd`, `UnitsPerOrder`, `AverageDiscountPercent`, and `ReservationConversionRate`.

- [ ] **Step 2: Run tests**
Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.DashboardComprehensiveBiTests`
Expected: PASS

- [ ] **Step 3: Commit**
`git add Ordina.Backend/tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs; git commit -m "test(application): add tests for seller performance metrics"`

---

### Task 4: Update Frontend `TopSeller` Interface
**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`

**Interfaces:**
- Produces: `TopSeller` interface matching updated backend DTO.

- [ ] **Step 1: Update `TopSeller` interface in `api-client.ts`**
Add `averageTicketUsd`, `unitsPerOrder`, `averageDiscountPercent`, `reservationConversionRate`, `convertedReservationsCount`.

- [ ] **Step 2: Commit**
`git add Ordina.Frontend/src/lib/api-client.ts; git commit -m "feat(frontend): update TopSeller interface with performance metrics"`

---

### Task 5: Enhance `TopSellersChart` with Metric Selector and Dynamic Rendering
**Files:**
- Modify: `Ordina.Frontend/src/components/analytics/top-sellers-chart.tsx`

**Interfaces:**
- Renders: Interactive dropdown selector for metrics:
  - Facturación ($)
  - Ticket Promedio ($)
  - Pedidos Concretados (#)
  - Unidades / Pedido (UPT)
  - Descuento Promedio (%)
  - Conversión de Reservas (%)
  - Comisión Estimada ($)
- Dynamically formats Tooltip, X-Axis, and Bar labels based on the active metric.

- [ ] **Step 1: Add metric state and switcher in `top-sellers-chart.tsx`**
Implement selector and sorting based on active metric.

- [ ] **Step 2: Test frontend build**
Run `npm run build` in `Ordina.Frontend`.

- [ ] **Step 3: Commit**
`git add Ordina.Frontend/src/components/analytics/top-sellers-chart.tsx; git commit -m "feat(frontend): add metric selector and dynamic formatting in TopSellersChart"`

---

### Task 6: Final Verification
- [ ] **Step 1: Run all backend tests**
Run test suite for application and api tests.
- [ ] **Step 2: Verify git status is clean**
Run `git status`.
