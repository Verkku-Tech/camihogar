# Reporte de Comisiones 1:1 con Main y Corrección de Conversión Cashea Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar el cálculo oficial de comisiones 1:1 idéntico a `main` con 12 columnas en Excel, y corregir el error en frontend de conversión de reservas con pago en bolívares y condición Cashea mostrando además los mensajes de error transparentes en los toasts.

**Architecture:** Portar las 4 clases de cálculo de comisiones (`CommissionLineSources`, `SaleTypeCommissionTierResolver`, `CommissionExclusivityCalculator`, `CommissionLineClassifier`) a `Ordina.Application.Commission`. Reemplazar el stub 3% de `ReportService` con la descomposición por producto, categoría, tier y exclusividad de `main`. En el frontend, agregar fallbacks robustos de tasas en `order-payments.ts`, `use-edit-order-form.tsx` y `confirm-order-dialog.tsx`, asegurando que los montos en Bs siempre se conviertan a USD y los toasts muestren el mensaje de error explícito.

**Tech Stack:** .NET 8, ASP.NET Core Web API, ClosedXML, React 19, TypeScript, Vite, Tailwind CSS.

## Global Constraints
- Paridad 1:1 con la lógica de negocio y exportación de 12 columnas de `main`.
- NO realizar commits en git (el usuario solicitó mantener cambios uncommitted en el worktree).
- NO utilizar el subagente de navegador ("yo pruebo": el usuario valida en su navegador).
- Desplegar backend en Raspberry Pi (`ordina-modular-api`) y frontend en Cloudflare Pages (`camihogar-v2`).

---

### Task 1: Transparencia de Errores y Robustez de Tasas en Frontend para Cashea

**Files:**
- Modify: `Ordina.Frontend/src/lib/currency-utils.ts`
- Modify: `Ordina.Frontend/src/lib/order-payments.ts`
- Modify: `Ordina.Frontend/src/components/orders/hooks/use-edit-order-form.tsx`
- Modify: `Ordina.Frontend/src/components/orders/edit-order-dialog.tsx`
- Modify: `Ordina.Frontend/src/components/orders/confirm-order-dialog.tsx`
- Create Test: `Ordina.Frontend/src/lib/__tests__/cashea-conversion-rates.test.ts`

**Interfaces:**
- `buildCasheaPaymentsForSave(normalizedPayments: PartialPayment[], options: BuildCasheaPaymentsOptions): PartialPayment[]`
- `getCasheaTotalDueBs(options: { totalDueUsd: number; totalDueBsLegacy?: number; useUsdTotals: boolean; usdRate?: number | null; inStorePayments?: PartialPayment[] }): number`

- [ ] **Step 1: Escribir el test que expone el fallo de Cashea cuando usdRate falta y los abonos son en Bs**
Crear `Ordina.Frontend/src/lib/__tests__/cashea-conversion-rates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCasheaPaymentsForSave, getCasheaTotalDueBs } from "../order-payments";
import type { PartialPayment } from "@/lib/storage";

describe("Cashea conversion and fallback rates", () => {
  it("does not throw exceeding total error when paying in Bs with rate on payment", () => {
    const payment: PartialPayment = {
      id: "p1",
      method: "Pago Móvil",
      amount: 55671.1,
      currency: "Bs",
      paymentDetails: {
        originalAmount: 55671.1,
        originalCurrency: "Bs",
        exchangeRate: 857.01,
      },
    };
    // Order total is 324.80 USD. In Bs it's ~278,356.85 Bs. Payment is 55,671.10 Bs (~64.96 USD).
    const result = buildCasheaPaymentsForSave([payment], {
      orderTotalBs: 278356.85,
      useUsdTotals: true,
      totalDueUsd: 324.8,
      usdRate: 857.01,
      order: {
        baseCurrency: "USD",
      },
    });

    expect(result).toHaveLength(2);
    expect(result[1].paymentDetails?.casheaFinancedPortion).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar baseline**
Run: `bun test src/lib/__tests__/cashea-conversion-rates.test.ts` en `Ordina.Frontend`.

- [ ] **Step 3: Implementar la resolución de tasas y toasts explícitos**
1. En `currency-utils.ts`: en `normalizeExchangeRatesAtCreation`, aceptar `usd.rate > 0` incluso si `effectiveDate` falta, asignando `new Date().toISOString()`.
2. En `order-payments.ts`: en `buildCasheaPaymentsForSave` y `getCasheaTotalDueBs`, resolver `effectiveUsdRate` buscando en `options.usdRate`, `options.order?.liveRates`, `options.order?.exchangeRatesAtCreation`, o en `inStoreRaw.find(p => p.paymentDetails?.exchangeRate)`.
3. En `use-edit-order-form.tsx`: cuando `initialOrder` no tenga tasas congeladas, combinar con `liveExchangeRates`.
4. En `edit-order-dialog.tsx` y `confirm-order-dialog.tsx`:
   - Pasar `effectiveUsdRate` con fallback a tasas activas.
   - En los bloques `catch (error)`, invocar `toast.error(error instanceof Error ? error.message : "Error al actualizar el pedido.")`.

- [ ] **Step 4: Ejecutar tests del frontend**
Run: `bun test` en `Ordina.Frontend`.
Expected: PASS.

---

### Task 2: Portar Motor de Comisiones a `Ordina.Application.Commission`

**Files:**
- Create: `Ordina.Backend/src/Application/Commission/CommissionLineSources.cs`
- Create: `Ordina.Backend/src/Application/Commission/SaleTypeCommissionTierResolver.cs`
- Create: `Ordina.Backend/src/Application/Commission/CommissionExclusivityCalculator.cs`
- Create: `Ordina.Backend/src/Application/Commission/CommissionLineClassifier.cs`
- Create Test: `Ordina.Backend/tests/Ordina.Application.Tests/Commission/CommissionCalculatorTests.cs`

**Interfaces:**
- `CommissionExclusivityCalculator.Calculate(exclusivityMode, isSharedSale, hasReferrer, baseCommissionRate, quantity, familyCommission, rule)`
- `SaleTypeCommissionTierResolver.PickRule(rules, saleType, commissionUsdPerUnit, logger)`
- `CommissionLineClassifier.ClassifyLines(baseline, final)`

- [ ] **Step 1: Escribir tests unitarios para los cálculos de comisiones**
Crear `CommissionCalculatorTests.cs` validando:
1. Venta exclusiva de vendedor principal: recibe 100% de la comisión familiar.
2. Venta compartida con regla por tipo de venta y tier: distribuye `vendorRate`, `referrerRate` y `postventaRate` multiplicados por cantidad.
3. Fallback a 50/50 cuando no hay regla en venta compartida.
4. Resolución de tiers 2.5, 5.0 y 7.5 USD/u.

- [ ] **Step 2: Ejecutar los tests para verificar que fallen por falta de clases**
Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~CommissionCalculatorTests`
Expected: FAIL (tipos no encontrados).

- [ ] **Step 3: Portar los 4 archivos de comisiones**
Copiar e integrar desde `main` a `Ordina.Backend/src/Application/Commission/`:
- `CommissionLineSources.cs`
- `SaleTypeCommissionTierResolver.cs` (usando namespace `Ordina.Domain.Finance` para `SaleTypeCommissionRule`)
- `CommissionExclusivityCalculator.cs` (usando `Ordina.Domain.Users.CommissionExclusivityModes` y `Ordina.Domain.Finance.SaleTypeCommissionRule`)
- `CommissionLineClassifier.cs` (usando `Ordina.Domain.Orders.OrderProduct`)

- [ ] **Step 4: Ejecutar los tests de comisiones**
Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~CommissionCalculatorTests`
Expected: PASS.

---

### Task 3: Actualizar DTOs y ReportService para Reporte 1:1 con Main

**Files:**
- Modify: `Ordina.Backend/src/Application/Reports/DTOs.cs`
- Modify: `Ordina.Backend/src/Application/Reports/ReportService.cs`
- Modify: `Ordina.Backend/src/Application/Reports/ExcelReportBuilder.cs`
- Create Test: `Ordina.Backend/tests/Ordina.Application.Tests/Reports/CommissionReportServiceTests.cs`

**Interfaces:**
- `CommissionReportRowDto` con 21 propiedades estándar de `main`.
- `CommissionReferrerOptionDto(string Id, string Name)`.
- `IReportService.GetCommissionReportAsync(DateTime? from, DateTime? to, string? vendorId, string? storeId, string? sellerType, string? referrerId, CancellationToken cancellationToken)`.
- `IReportService.GenerateCommissionsReportExcelAsync(DateTime? from, DateTime? to, string? vendorId, string? storeId, string? sellerType, string? referrerId, CancellationToken cancellationToken)`.
- `IReportService.GetCommissionReferrersInRangeAsync(DateTime? from, DateTime? to, CancellationToken cancellationToken)`.

- [ ] **Step 1: Escribir test para generación de reporte de comisiones desglosado por producto**
Crear `CommissionReportServiceTests.cs` simulando una orden con 2 productos de diferentes categorías, reglas de comisión y vendedor exclusivo/compartido, validando que se devuelvan las filas con `TipoVenta`, `ComisionFamiliaUsdPorUnidad`, `Comision`, etc.

- [ ] **Step 2: Ejecutar test para verificar que falle**
Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~CommissionReportServiceTests`

- [ ] **Step 3: Implementar ReportService con cálculo 1:1 y exportación de 12 columnas**
1. Actualizar `CommissionReportRowDto` en `DTOs.cs` con todas las propiedades de `main`.
2. Inyectar `IRepository<ProductCommission>`, `IRepository<SaleTypeCommissionRule>`, `IUserRepository`, `IRepository<Category>` en `ReportService`.
3. Implementar `GetCommissionReportAsync` con `GetFilteredCommissionsDataAsync`:
   - Normalizar fechas inicio (00:00:00) y fin (23:59:59.999).
   - Omitir presupuestos, reservas y pedidos declinados/cancelados.
   - Omitir `pago_a_entrega` sin cobro registrado.
   - Filtrar por vendedor, tienda, tipo de vendedor y referido.
   - Calcular comisión por producto con `CalculateProductCommission`.
   - Formatear descripción del producto con atributos.
4. En `GenerateCommissionsReportExcelAsync`: generar las 12 columnas exactas:
   1. Fecha | 2. Cliente | 3. Pedido | 4. Vendedor | 5. Descripción | 6. Cant. Artículos | 7. Tipo de venta | 8. Comisión familia USD/u | 9. Comisión Vendedor | 10. Total Comisión + Sueldo | 11. Comisión Post venta | 12. Comisión Referido.
5. Implementar `GetCommissionReferrersInRangeAsync`.

- [ ] **Step 4: Ejecutar tests**
Run: `dotnet test tests/Ordina.Application.Tests --filter FullyQualifiedName~CommissionReportServiceTests`
Expected: PASS.

---

### Task 4: Actualizar Endpoints y Filtros en ReportsController

**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/ReportsController.cs`
- Create Test: `Ordina.Backend/tests/Ordina.Api.Tests/Controllers/ReportsControllerCommissionTests.cs`

**Interfaces:**
- `GET /api/reports/commissions` & `GET /api/reports/commissions/preview` con `startDate`, `endDate`, `from`, `to`, `vendorId`, `storeId`, `sellerType`, `referrerId`.
- `GET /api/reports/commissions/excel` con los mismos parámetros.
- `GET /api/reports/commission-referrers` & `GET /api/reports/commissions/referrers` con `startDate`, `endDate`.

- [ ] **Step 1: Escribir test del controlador con filtros de comisiones**
Crear `ReportsControllerCommissionTests.cs` verificando que pase los parámetros `storeId`, `sellerType` y `referrerId` al servicio de reportes.

- [ ] **Step 2: Ejecutar test para verificar fallo**
Run: `dotnet test tests/Ordina.Api.Tests --filter FullyQualifiedName~ReportsControllerCommissionTests`

- [ ] **Step 3: Actualizar `ReportsController.cs`**
Agregar los parámetros de consulta `storeId`, `sellerType`, `referrerId` en `GetCommissionsReport` y `DownloadCommissionsReportExcel`, y mapear `commission-referrers` a `GetCommissionReferrersInRangeAsync`.

- [ ] **Step 4: Ejecutar tests de la API**
Run: `dotnet test tests/Ordina.Api.Tests`
Expected: PASS.

---

### Task 5: Compilación, Empaquetado y Despliegue a Producción

- [ ] **Step 1: Compilar backend y frontend localmente**
- Backend: `dotnet build Ordina.Backend.sln`
- Backend Tests: `dotnet test Ordina.Backend.sln`
- Frontend: `bun run build` en `Ordina.Frontend`
Expected: Todo compila sin advertencias ni errores.

- [ ] **Step 2: Empaquetar y desplegar Backend en Raspberry Pi**
1. Generar tarball de backend:
   `tar.exe -czf $env:TEMP\modular-backend.tar.gz --exclude="bin" --exclude="obj" --exclude=".vs" -C "f:\Verkku\Camihogar\.worktrees\refactor-modular-monolith\Ordina.Backend" .`
2. Copiar por SSH/SCP a RPi:
   `scp -P 9888 -i C:\Users\Saydenier\.ssh\id_ed25519 -o StrictHostKeyChecking=no $env:TEMP\modular-backend.tar.gz sa@127.0.0.1:/home/sa/camihogar-modular-backend.tar.gz`
3. Extraer y construir imagen Docker en RPi:
   `$null | ssh -T -i C:\Users\Saydenier\.ssh\id_ed25519 -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "mkdir -p ~/camihogar-modular-src && tar -xzf ~/camihogar-modular-backend.tar.gz -C ~/camihogar-modular-src && cd ~/camihogar-modular-src && sudo docker build -t camihogar-modular-api:latest -f Dockerfile . && cd ~/camihogar-infra && sudo docker compose up -d --force-recreate modular-api"`
4. Verificar salud del contenedor:
   `$null | ssh -T -i C:\Users\Saydenier\.ssh\id_ed25519 -p 9888 -o StrictHostKeyChecking=no sa@127.0.0.1 "curl -s http://127.0.0.1:8090/health || curl -s http://127.0.0.1:8090/swagger/index.html | head -n 5"`

- [ ] **Step 3: Desplegar Frontend en Cloudflare Pages**
1. En `Ordina.Frontend`:
   `npx wrangler pages deploy dist --project-name=camihogar-v2 --branch=main`
2. Verificar URL de producción.
