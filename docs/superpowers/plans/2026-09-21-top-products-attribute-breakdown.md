# Top Products Attribute Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users on the Metrics Dashboard to inspect the ranking of most-sold attribute versions (e.g. headboards, box types, fabrics, colors) for configurable products by clicking on rows in the Top Products table.

**Architecture:** 
- Backend adds `HasAttributes` flag to `TopProductDto` and introduces `GET /api/dashboard/top-products/attribute-breakdown` which queries matching orders for the period, aggregates attribute usage from `OrderProduct.Attributes`, maps them to the category's attributes, and returns ranked option stats.
- Frontend marks configurable products as interactive in `TopProductsTable` and opens a new modal `ProductAttributeBreakdownDialog` that fetches and renders attribute ranking cards with progress bars.

**Tech Stack:** C# .NET 10, ASP.NET Core, xUnit, TypeScript, React 19, Tailwind CSS v4, Radix UI Dialog.

## Global Constraints

- Backend tests executed with `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`.
- Frontend tests executed with `bun test`.
- Frontend build verified with `npm run build`.
- Follow strict Ponytail and TDD rules (tests first, minimal working code, no unrequested abstractions).

---

### Task 1: Backend DTOs and IDashboardService Contract

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardDtos.cs`
- Modify: `Ordina.Backend/src/Application/Dashboard/IDashboardService.cs`

**Interfaces:**
- Produces:
  - `TopProductDto(string ProductName, string Category, int UnitsSold, decimal TotalUsd, bool HasAttributes = false)`
  - `AttributeOptionStatDto(string Value, int UnitsSold, decimal Percentage)`
  - `AttributeBreakdownDto(string AttributeId, string AttributeTitle, int TotalUnitsWithAttribute, IReadOnlyList<AttributeOptionStatDto> Options)`
  - `ProductAttributeBreakdownResponseDto(string ProductName, string Category, int TotalUnitsSold, IReadOnlyList<AttributeBreakdownDto> Attributes)`
  - `Task<ProductAttributeBreakdownResponseDto> GetProductAttributeBreakdownAsync(string productName, string period = "month", CancellationToken cancellationToken = default)` in `IDashboardService`

- [x] **Step 1: Write failing test in Ordina.Application.Tests**

Add a test in `tests/Ordina.Application.Tests/DashboardServiceAttributeBreakdownTests.cs` verifying `GetProductAttributeBreakdownAsync` contract and DTO initialization.

```csharp
using System.Threading.Tasks;
using Ordina.Application.Dashboard;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardServiceAttributeBreakdownTests
{
    [Fact]
    public void TopProductDto_SupportsHasAttributesParameter()
    {
        var dto = new TopProductDto("Cama Matrimonial", "Camas", 10, 2500m, HasAttributes: true);
        Assert.True(dto.HasAttributes);
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj` in `Ordina.Backend`
Expected: Compilation failure because `HasAttributes` does not exist on `TopProductDto`.

- [x] **Step 3: Update DashboardDtos.cs and IDashboardService.cs**

Update `TopProductDto` with `bool HasAttributes = false` and add the new DTO records.
Add `Task<ProductAttributeBreakdownResponseDto> GetProductAttributeBreakdownAsync(string productName, string period = "month", CancellationToken cancellationToken = default);` to `IDashboardService`.

- [x] **Step 4: Run test to verify it passes**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add Ordina.Backend/src/Application/Dashboard/DashboardDtos.cs Ordina.Backend/src/Application/Dashboard/IDashboardService.cs tests/Ordina.Application.Tests/DashboardServiceAttributeBreakdownTests.cs
git commit -m "feat(backend): add attribute breakdown DTOs and IDashboardService interface"
```

---

### Task 2: Backend DashboardService Logic and Unit Tests

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`
- Modify: `tests/Ordina.Application.Tests/DashboardServiceAttributeBreakdownTests.cs`

**Interfaces:**
- Consumes: DTOs from Task 1, `_dashboardRepository.GetAllOrdersForDashboardAsync`, `_dashboardRepository.GetCategoriesAsync` (or `_categoryRepository`)
- Produces: Working implementation of `GetTopProductsAsync` (populating `HasAttributes`) and `GetProductAttributeBreakdownAsync`.

- [x] **Step 1: Write tests for GetTopProductsAsync with HasAttributes and GetProductAttributeBreakdownAsync**

In `tests/Ordina.Application.Tests/DashboardServiceAttributeBreakdownTests.cs`, add unit tests:
1. `GetTopProductsAsync_MarksHasAttributes_WhenCategoryHasAttributes`: Verifies products whose category has attributes return `HasAttributes = true`, and standard ones return `false`.
2. `GetProductAttributeBreakdownAsync_AggregatesAndSortsByUnitsSoldDescending`: Sets up orders with products containing attributes (e.g. Copete = Capitoneado x 5, Copete = Liso x 2) and checks that `Options` are sorted descending by `UnitsSold`.

- [x] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: FAIL because `GetProductAttributeBreakdownAsync` is not yet implemented in `DashboardService`.

- [x] **Step 3: Implement logic in DashboardService.cs**

1. In `GetTopProductsAsync`: Load categories from repository to check if each product's category has `Attributes?.Count > 0`. Set `HasAttributes`.
2. In `GetProductAttributeBreakdownAsync`:
   - Filter orders by period (`CreatedAt >= ComputePeriodStart(period)` and `IsValidOrder`).
   - Find all `OrderProduct` matching `p.Name.Equals(productName, StringComparison.OrdinalIgnoreCase)`.
   - Find category definition and its `Attributes`.
   - For each category attribute, aggregate values from `p.Attributes`, count `Quantity`, compute percentage, sort descending.
   - Return `ProductAttributeBreakdownResponseDto`.

- [x] **Step 4: Run test to verify it passes**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: PASS (all tests pass).

- [x] **Step 5: Commit**

```bash
git add Ordina.Backend/src/Application/Dashboard/DashboardService.cs tests/Ordina.Application.Tests/DashboardServiceAttributeBreakdownTests.cs
git commit -m "feat(backend): implement attribute breakdown aggregation in DashboardService"
```

---

### Task 3: Backend Controller Endpoint

**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/DashboardController.cs`

**Interfaces:**
- Consumes: `IDashboardService.GetProductAttributeBreakdownAsync`
- Produces: `GET /api/dashboard/top-products/attribute-breakdown?productName={name}&period={period}`

- [x] **Step 1: Add endpoint to DashboardController.cs**

```csharp
    [HttpGet("top-products/attribute-breakdown")]
    public async Task<ActionResult<ProductAttributeBreakdownResponseDto>> GetProductAttributeBreakdown(
        [FromQuery] string productName,
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productName))
            return BadRequest("El nombre del producto es requerido.");

        var result = await _dashboardService.GetProductAttributeBreakdownAsync(productName, period, ct);
        return Ok(result);
    }
```

- [x] **Step 2: Verify Backend Build**

Run: `dotnet build` in `Ordina.Backend`
Expected: Build succeeds with 0 errors.

- [x] **Step 3: Commit**

```bash
git add Ordina.Backend/src/Api/Controllers/DashboardController.cs
git commit -m "feat(backend): add top-products attribute breakdown endpoint"
```

---

### Task 4: Frontend API Client Types and Method

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Test: `Ordina.Frontend/src/lib/__tests__/api-client-top-products.test.ts`

**Interfaces:**
- Produces:
  - `AttributeOptionStat`, `AttributeBreakdown`, `ProductAttributeBreakdownResponse` interfaces
  - `TopProduct.hasAttributes?: boolean`
  - `apiClient.getProductAttributeBreakdown(productName: string, period?: string, signal?: AbortSignal)`

- [x] **Step 1: Write failing test in Frontend**

Create `Ordina.Frontend/src/lib/__tests__/api-client-top-products.test.ts`:
```typescript
import { describe, it, expect } from "bun:test";
import { apiClient } from "../api-client";

describe("ApiClient Top Products Attribute Breakdown", () => {
  it("has getProductAttributeBreakdown method", () => {
    expect(typeof apiClient.getProductAttributeBreakdown).toBe("function");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/api-client-top-products.test.ts`
Expected: FAIL (method undefined).

- [x] **Step 3: Update api-client.ts**

Export the new interfaces, update `TopProduct` with `hasAttributes?: boolean`, and add:
```typescript
  async getProductAttributeBreakdown(
    productName: string,
    period = 'month',
    signal?: AbortSignal
  ): Promise<ProductAttributeBreakdownResponse> {
    const query = new URLSearchParams({ productName, period });
    return apiFetch<ProductAttributeBreakdownResponse>(
      `/api/dashboard/top-products/attribute-breakdown?${query.toString()}`,
      { signal }
    );
  }
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/api-client-top-products.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add Ordina.Frontend/src/lib/api-client.ts Ordina.Frontend/src/lib/__tests__/api-client-top-products.test.ts
git commit -m "feat(frontend): add getProductAttributeBreakdown to apiClient"
```

---

### Task 5: Frontend Modal Component `ProductAttributeBreakdownDialog`

**Files:**
- Create: `Ordina.Frontend/src/components/analytics/product-attribute-breakdown-dialog.tsx`

**Interfaces:**
- Consumes: `apiClient.getProductAttributeBreakdown`, Radix UI Dialog components
- Produces: `<ProductAttributeBreakdownDialog open={open} onOpenChange={setOpen} productName={...} category={...} period={...} />`

- [x] **Step 1: Create component with loading skeletons and attribute cards**

Implement `ProductAttributeBreakdownDialog`:
- Dialog header with `productName`, category badge, and period badge.
- Fetch data on open when `productName` is provided.
- If loading: Render 3-4 skeleton cards.
- If loaded:
  - If `attributes.length === 0`: friendly empty message ("No hay variantes registradas en este período").
  - Grid of cards (1 col on mobile, 2 cols on desktop/large):
    - Card header: Attribute title (e.g. "Copete", "Box", "Tela", "Color") and total units with this attribute.
    - Card content: Ranked list of options. Each row displays rank number, option value name, sold units badge, percentage, and emerald progress bar.

- [x] **Step 2: Run bun test and build check**

Run: `bun test`
Expected: All tests pass.

- [x] **Step 3: Commit**

```bash
git add Ordina.Frontend/src/components/analytics/product-attribute-breakdown-dialog.tsx
git commit -m "feat(frontend): create ProductAttributeBreakdownDialog modal component"
```

---

### Task 6: Connect `TopProductsTable` with the Modal and Period Prop

**Files:**
- Modify: `Ordina.Frontend/src/components/analytics/top-products-table.tsx`
- Modify: `Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx`

**Interfaces:**
- Consumes: `TopProductsTable` with `period: string`, `ProductAttributeBreakdownDialog`
- Produces: Clickable rows for items where `hasAttributes === true`, opening the modal with the right product and period.

- [x] **Step 1: Update TopProductsTable.tsx**

1. Add `period?: string` to `TopProductsTableProps`.
2. State for `selectedProduct: TopProduct | null` and `isModalOpen: boolean`.
3. In table body row rendering:
   - Check `p.hasAttributes`:
     - If true: add `cursor-pointer hover:bg-muted/50 transition-colors`, `onClick={() => handleRowClick(p)}`.
     - In the product name cell: display an interactive badge or icon `<SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Ver versiones más vendidas" />`.
     - If false: standard table row without cursor pointer or click event.
4. Render `<ProductAttributeBreakdownDialog>` bound to `selectedProduct` and `isModalOpen`.

- [x] **Step 2: Pass period prop in AnalyticsDashboard.tsx**

Pass `period={period}` to `<TopProductsTable data={topProducts} isLoading={isLoading} period={period} />`.

- [x] **Step 3: Verification**

1. Run: `bun test` in `Ordina.Frontend` -> verify 0 errors.
2. Run: `npm run build` in `Ordina.Frontend` -> verify production build succeeds.
3. Run: `dotnet build` in `Ordina.Backend` -> verify build succeeds.

- [x] **Step 4: Commit**

```bash
git add Ordina.Frontend/src/components/analytics/top-products-table.tsx Ordina.Frontend/src/components/analytics/analytics-dashboard.tsx
git commit -m "feat(frontend): integrate attribute breakdown modal into TopProductsTable"
```
