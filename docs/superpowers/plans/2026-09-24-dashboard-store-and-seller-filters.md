# Dashboard Store and Seller Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global multi-store filter across the analytics dashboard and a seller-type filter (Ambos, Tienda, Online) in the Top Sellers ranking.

**Architecture:** Enrich backend DTOs and dashboard service with store-based filtering (`storeIds`) and vendor classification (`SellerType`, `StoreId`, `StoreName`). Update frontend API client and add multi-store selector in dashboard header and seller type toggle in `TopSellersChart`.

**Tech Stack:** .NET 10, C# 13, xUnit v3, React 19, TypeScript, Tailwind CSS 4, Radix UI.

## Global Constraints
- Work strictly inside worktree `f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith`.
- Only consider concrete orders (`IsValidOrder(o) == true`) for performance metrics, associating orders to stores via the order's vendor (`User.StoreId`).
- Use Ponytail philosophy: minimal working code, standard library, avoid unneeded abstractions.
- All test runs must use `dotnet run --project tests/... -- -class <Namespace.ClassName>`.

---

### Task 1: Extend `TopSellerDto` with Seller Type and Store Metadata
**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs`

**Interfaces:**
- Produces: `TopSellerDto` with additional parameters:
  `string SellerType = "store", string? StoreId = null, string? StoreName = null`

- [ ] **Step 1: Update `TopSellerDto` record declaration**
- [ ] **Step 2: Verify project builds with `dotnet build Ordina.Backend/src/Application/Ordina.Application.csproj`**
- [ ] **Step 3: Commit**
`git add Ordina.Backend/src/Application/Dashboard/DashboardDTOs.cs; git commit -m "feat(application): add SellerType and Store metadata to TopSellerDto"`

---

### Task 2: Implement Store Filtering and Seller Classification in `DashboardService`
**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/IDashboardService.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`

**Interfaces:**
- Consumes: `string? storeIds` (comma-separated or list) across dashboard methods.
- Produces: Filtered dashboard metrics, top sellers with `SellerType` ("store" vs "online") and `StoreId`/`StoreName`.

- [ ] **Step 1: Add `storeIds` parameter to `IDashboardService` methods**
- [ ] **Step 2: Implement `FilterOrdersByStore` helper and map seller types in `DashboardService`**
- [ ] **Step 3: Verify project builds with `dotnet build Ordina.Backend/src/Application/Ordina.Application.csproj`**
- [ ] **Step 4: Commit**
`git add Ordina.Backend/src/Application/Dashboard/IDashboardService.cs Ordina.Backend/src/Application/Dashboard/DashboardService.cs; git commit -m "feat(application): add store filtering and seller classification to DashboardService"`

---

### Task 3: Expose `storeIds` Query Parameter in `DashboardController`
**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/DashboardController.cs`

**Interfaces:**
- Accepts: `[FromQuery] string? storeIds = null` in dashboard endpoints.

- [ ] **Step 1: Update controller actions to pass `storeIds` to `_dashboardService`**
- [ ] **Step 2: Verify project builds with `dotnet build Ordina.Backend/src/Api/Ordina.Api.csproj`**
- [ ] **Step 3: Commit**
`git add Ordina.Backend/src/Api/Controllers/DashboardController.cs; git commit -m "feat(api): expose storeIds parameter in DashboardController"`

---

### Task 4: Unit Tests for Store Filtering and Seller Classification
**Files:**
- Modify: `Ordina.Backend/tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs`

- [ ] **Step 1: Add unit tests verifying `GetTopSellersAsync` and `GetDashboardMetricsAsync` with store filtering and seller classification**
- [ ] **Step 2: Run tests with `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.DashboardComprehensiveBiTests`**
- [ ] **Step 3: Commit**
`git add Ordina.Backend/tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs; git commit -m "test(application): add unit tests for store filtering and seller classification"`

---

### Task 5: Update Frontend API Client and Types
**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`

- [ ] **Step 1: Update `TopSeller` interface with `sellerType?: "store" | "online"`, `storeId?: string`, `storeName?: string`**
- [ ] **Step 2: Update `getDashboardMetrics`, `getTopSellers`, `getTopProducts`, etc. to accept `storeIds?: string[]`**
- [ ] **Step 3: Commit**
`git add Ordina.Frontend/src/lib/api-client.ts; git commit -m "feat(frontend): support storeIds query and seller type in api-client"`

---

### Task 6: Implement Seller Type Filter in `TopSellersChart`
**Files:**
- Modify: `Ordina.Frontend/src/components/analytics/top-sellers-chart.tsx`

- [ ] **Step 1: Add seller type state (`all` | `store` | `online`) and toggle controls in `TopSellersChart` header**
- [ ] **Step 2: Filter `data` by `sellerType` before sorting by active metric**
- [ ] **Step 3: Commit**
`git add Ordina.Frontend/src/components/analytics/top-sellers-chart.tsx; git commit -m "feat(frontend): add seller type filter in TopSellersChart"`

---

### Task 7: Implement Global Multi-Store Filter in `analytics-dashboard.tsx`
**Files:**
- Modify: `Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx`

- [ ] **Step 1: Fetch stores from `apiClient.getStores()` and maintain `selectedStoreIds: string[]`**
- [ ] **Step 2: Render Multi-Select Popover next to period tabs in header**
- [ ] **Step 3: Pass `selectedStoreIds` to all dashboard queries on change**
- [ ] **Step 4: Verify frontend build with `npm run build`**
- [ ] **Step 5: Commit**
`git add Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx; git commit -m "feat(frontend): implement global multi-store filter in analytics dashboard"`

---

### Task 8: Verification Before Completion
- [ ] **Step 1: Run all backend tests**
- [ ] **Step 2: Verify git status is clean**
