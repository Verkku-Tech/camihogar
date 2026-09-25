# Order Audit Log Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the monochrome, tabular Order Audit Log dialog into an intuitive, semantic vertical timeline with visual diffs (color-coded before/after values, payment pills, action badges, and in-place expansion) using the Verkku Precision Atelier design system.

**Architecture:** Decompose the audit log presentation into a structured parser layer in `src/lib/audit-log-labels.ts` that converts raw log entries into typed diff items, and a modular UI layer under `src/components/orders/audit-timeline/` (`AuditTimelineItem`, `AuditDiffRow`, `AuditActionBadge`, `AuditTimelineSkeleton`) integrated into `OrderAuditLogDialog`.

**Tech Stack:** Bun, React 19, TypeScript, Tailwind CSS, Lucide React, JetBrains Mono, Plus Jakarta Sans.

## Global Constraints

- Scope: Strictly within worktree `f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith`.
- Product Identity: FORGE ERP (Verkku Precision Atelier: Emerald `#1CB569`, Warm Graphite `#111418`, Dark Canvas `#090C0F`).
- Code language: English for code identifiers and types, Spanish for user-facing UI copy.
- React 19 rules: `ref` as regular prop, clean default parameters (no `defaultProps`), no nested component definitions in render bodies.
- Zero white screens or CLS: animated skeleton state during loading.

---

### Task 1: Structured Change Parser & Relative Time Formatter (TDD)

**Files:**
- Create: `Ordina.Frontend/src/lib/__tests__/audit-log-structured.test.ts`
- Modify: `Ordina.Frontend/src/lib/audit-log-labels.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface StructuredAuditItem {
    type: "status" | "payment_add" | "payment_remove" | "field_diff" | "creation_summary";
    label?: string;
    oldValue?: string | null;
    newValue?: string | null;
    paymentText?: string;
  }
  export function extractStructuredChanges(log: OrderAuditLogDto): StructuredAuditItem[];
  export function formatRelativeTime(dateInput: string | Date, now?: Date): string;
  ```

- [ ] **Step 1: Write failing tests for structured change extraction and relative time**

Create `Ordina.Frontend/src/lib/__tests__/audit-log-structured.test.ts`:
```typescript
import { describe, expect, it } from "bun:test";
import {
  extractStructuredChanges,
  formatRelativeTime,
  type StructuredAuditItem,
} from "@/lib/audit-log-labels";
import type { OrderAuditLogDto } from "@/lib/api-client";

describe("Audit Log Structured Change Extraction", () => {
  it("extracts status change as typed status item", () => {
    const log: OrderAuditLogDto = {
      id: "1",
      orderId: "ord-1",
      orderNumber: "ORD-1642",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Estado del pedido: En almacén → En Ruta",
      changes: [
        {
          field: "Status",
          oldValue: "almacen_no_fabricado",
          newValue: "en ruta",
          displayField: "Estado del pedido",
          displayOldValue: "En almacén",
          displayNewValue: "En Ruta",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: "status",
      label: "Estado del pedido",
      oldValue: "En almacén",
      newValue: "En Ruta",
    });
  });

  it("extracts added and removed payments with amounts", () => {
    const log: OrderAuditLogDto = {
      id: "2",
      orderId: "ord-2",
      orderNumber: "ORD-1205",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Agregó pago: Binance $170,00 — Eliminó pago: Binance $200,00",
      changes: [
        {
          field: "mixedPayments[+]",
          oldValue: null,
          newValue: "Método=Binance; Monto=170; Moneda=USD",
          displayField: "Pago agregado",
          displayNewValue: "Binance $170,00",
        },
        {
          field: "mixedPayments[-]",
          oldValue: "Método=Binance; Monto=200; Moneda=USD",
          newValue: null,
          displayField: "Pago eliminado",
          displayOldValue: "Binance $200,00",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      type: "payment_add",
      paymentText: "Binance $170,00",
    });
    expect(items[1]).toEqual({
      type: "payment_remove",
      paymentText: "Binance $200,00",
    });
  });

  it("extracts arbitrary field changes with before and after values", () => {
    const log: OrderAuditLogDto = {
      id: "3",
      orderId: "ord-3",
      orderNumber: "ORD-466",
      action: "updated",
      userId: "u1",
      userName: "Nicole",
      summary: "Actualizó Observaciones de despacho: (sin valor) → Máximo 5pm",
      changes: [
        {
          field: "DispatchObservations",
          oldValue: null,
          newValue: "Máximo 5pm",
          displayField: "Observaciones de despacho",
          displayOldValue: "(sin valor)",
          displayNewValue: "Máximo 5pm",
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      type: "field_diff",
      label: "Observaciones de despacho",
      oldValue: "(sin valor)",
      newValue: "Máximo 5pm",
    });
  });

  it("handles order creation log with fallback summary", () => {
    const log: OrderAuditLogDto = {
      id: "4",
      orderId: "ord-4",
      orderNumber: "ORD-2143",
      action: "created",
      userId: "u2",
      userName: "Francis",
      summary: "Agregó pago durante la creación del pedido: Tarjeta de débito Bs. 106.195,00",
      changes: [],
      timestamp: new Date().toISOString(),
    };

    const items = extractStructuredChanges(log);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].type).toBe("creation_summary");
    expect(items[0].paymentText).toBe("Tarjeta de débito Bs. 106.195,00");
  });

  it("formats relative time correctly", () => {
    const now = new Date("2026-09-23T18:00:00Z");
    expect(formatRelativeTime("2026-09-23T17:59:30Z", now)).toBe("Hace momentos");
    expect(formatRelativeTime("2026-09-23T17:45:00Z", now)).toBe("Hace 15 min");
    expect(formatRelativeTime("2026-09-23T15:00:00Z", now)).toBe("Hace 3 horas");
    expect(formatRelativeTime("2026-09-21T18:00:00Z", now)).toBe("Hace 2 días");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/audit-log-structured.test.ts`
Expected: FAIL (`extractStructuredChanges is not a function`).

- [ ] **Step 3: Implement `extractStructuredChanges` and `formatRelativeTime` in `audit-log-labels.ts`**

Add interfaces and functions to `Ordina.Frontend/src/lib/audit-log-labels.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/audit-log-structured.test.ts`
Expected: PASS (all 5 tests pass).

- [ ] **Step 5: Commit**

Run:
```bash
git add src/lib/__tests__/audit-log-structured.test.ts src/lib/audit-log-labels.ts
git commit -m "feat(audit): add structured change parser and relative time helper"
```

---

### Task 2: Visual Component Library for Timeline (`AuditActionBadge`, `AuditDiffRow`, `AuditTimelineSkeleton`)

**Files:**
- Create: `Ordina.Frontend/src/components/orders/audit-timeline/audit-action-badge.tsx`
- Create: `Ordina.Frontend/src/components/orders/audit-timeline/audit-diff-row.tsx`
- Create: `Ordina.Frontend/src/components/orders/audit-timeline/audit-timeline-skeleton.tsx`

**Interfaces:**
- `AuditActionBadge`: `({ action, hasPaymentChanges }: { action: string; hasPaymentChanges?: boolean }) => JSX.Element`
- `AuditDiffRow`: `({ item }: { item: StructuredAuditItem }) => JSX.Element`
- `AuditTimelineSkeleton`: `({ count?: number }) => JSX.Element`

- [ ] **Step 1: Create `audit-action-badge.tsx`**

Implement styled badges using Tailwind CSS:
- `created`: Emerald badge (`bg-emerald-500/10 text-emerald-400 border border-emerald-500/25`).
- `updated`: Sky blue badge (`bg-sky-500/10 text-sky-400 border border-sky-500/25`), or Purple if payments were updated.
- `payment_conciliated`: Purple badge (`bg-purple-500/10 text-purple-400 border border-purple-500/25`).
- `deleted` / `order_declined`: Rose badge (`bg-rose-500/10 text-rose-400 border border-rose-500/25`).
- `manufacturing_*`: Amber badge (`bg-amber-500/10 text-amber-400 border border-amber-500/25`).

- [ ] **Step 2: Create `audit-diff-row.tsx`**

Implement visual diff row with:
- Field label tag (`text-xs font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/40`).
- Diff values:
  - `val-old`: line-through with subtle red background (`text-slate-400 line-through bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-xs`).
  - `arrow`: `→` separator (`text-muted-foreground text-xs`).
  - `val-new`: highlighted with emerald background (`text-emerald-300 font-semibold bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded text-xs`).
- Payment pills:
  - `+ Agregó pago: ...` in emerald (`bg-emerald-500/12 text-emerald-400 border border-emerald-500/30`).
  - `- Eliminó pago: ...` in rose (`bg-rose-500/12 text-rose-400 border border-rose-500/30`).

- [ ] **Step 3: Create `audit-timeline-skeleton.tsx`**

Implement 4 pulse cards connected by a vertical line placeholder to show realistic loading motion.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `bun run build` (or `bun x tsc -b`) to ensure types and components resolve with 0 errors.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/orders/audit-timeline/
git commit -m "feat(audit): create visual timeline components and skeleton loader"
```

---

### Task 3: Interactive Timeline Item (`AuditTimelineItem`)

**Files:**
- Create: `Ordina.Frontend/src/components/orders/audit-timeline/audit-timeline-item.tsx`

**Interfaces:**
- `AuditTimelineItem`: `({ log, onSelectOrder }: { log: OrderAuditLogDto; onSelectOrder: (orderNumber: string) => void }) => JSX.Element`

- [ ] **Step 1: Implement `AuditTimelineItem`**

Features:
- Left timeline connector node with dynamic SVG icon (factory for manufacturing, dollar for payments, plus for create, pencil for update, check for completed).
- Event Header:
  - Clickable Order Number badge with `font-mono`, emerald border and hover effect.
  - Actor initials avatar circle + actor full name (`font-semibold`).
  - Action badge.
  - Relative time (`formatRelativeTime`) + time formatted in `JetBrains Mono` with full date tooltip.
- Structured changes list:
  - Uses `extractStructuredChanges(log)`.
  - If length $> 3$, shows first 3 and renders a button `+ N cambios adicionales` with chevron icon.
  - Clicking toggles in-place expansion without requiring an external dialog.

- [ ] **Step 2: Add component unit test in `src/components/orders/__tests__/order-audit-timeline-item.test.tsx`**

Create test verifying:
- Renders order number, user name, and action badge.
- When $> 3$ changes are present, initial render shows 3 items and the expansion button with count.
- Clicking the expansion button reveals the remaining changes.

- [ ] **Step 3: Run test**

Run: `bun test src/components/orders/__tests__/order-audit-timeline-item.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/orders/audit-timeline/audit-timeline-item.tsx src/components/orders/__tests__/
git commit -m "feat(audit): implement interactive AuditTimelineItem with in-place expansion"
```

---

### Task 4: Integrate Timeline in `OrderAuditLogDialog`

**Files:**
- Modify: `Ordina.Frontend/src/components/orders/order-audit-log-dialog.tsx`

- [ ] **Step 1: Replace legacy `<Table>` with the new `<AuditTimeline>` container**

In `order-audit-log-dialog.tsx`:
- Import `AuditTimelineItem` and `AuditTimelineSkeleton`.
- When `loading` is true: render `<AuditTimelineSkeleton />`.
- When `loading` is false and `logs.length === 0`: render clean empty state card.
- When `logs` are present: render vertical timeline with continuous connecting line (`relative pl-8 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500/40 before:via-sky-500/20 before:to-border/20`).
- Remove obsolete monochromatic table imports and unused detail dialog state.

- [ ] **Step 2: Verify filter bar and pagination interactions**

Ensure:
- Applying filters (`handleApplyFilters`) updates state and triggers timeline fetch.
- Pagination buttons (Anterior / Siguiente) work cleanly and smoothly.
- Clicking on order badge navigates to `/pedidos/{orderNumber}`.

- [ ] **Step 3: Verify TypeScript and compilation**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/orders/order-audit-log-dialog.tsx
git commit -m "feat(audit): integrate modern unified timeline in OrderAuditLogDialog"
```

---

### Task 5: End-to-End Verification & Walkthrough

**Files:**
- Verify: All tests in frontend and backend.
- Update: Walkthrough artifact and verification summary.

- [ ] **Step 1: Run all frontend tests**

Run: `bun test`
Expected: 100% tests pass (85+ tests passing).

- [ ] **Step 2: Run frontend production build**

Run: `bun run build`
Expected: `✓ built in ~4s` with 0 errors.

- [ ] **Step 3: Run backend test suites to ensure zero regressions**

Run: `dotnet run --project tests/Ordina.Api.Tests`
Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: 135/135 tests pass.

- [ ] **Step 4: Document results in `walkthrough.md`**
