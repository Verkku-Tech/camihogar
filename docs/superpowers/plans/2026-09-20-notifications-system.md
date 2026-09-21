# Notificaciones en Tiempo Real (SSE + MongoDB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el sistema completo de notificaciones en tiempo real para Ordina ERP utilizando Server-Sent Events (SSE) nativo de ASP.NET Core, persistencia en MongoDB y componentes interactivos en el Frontend (campanita en sidebar, filtros directos para fabricación con retraso y reservas vencidas).

**Architecture:** La capa de Dominio define `Notification`. La capa de Aplicación gestiona `NotificationService` con un `System.Threading.Channels.Channel<NotificationDto>` en memoria para pub/sub de SSE y persistencia en MongoDB. La capa de API expone `GET /api/notifications/stream` (`text/event-stream`) y endpoints REST para lectura. El Frontend consume el stream mediante `EventSource` nativo, muestra un badge numérico en el sidebar y permite navegar a las pantallas con filtros de retraso activos.

**Tech Stack:** ASP.NET Core (.NET 10), MongoDB Driver, System.Threading.Channels, React 19, TypeScript, Vite, TailwindCSS, Lucide React.

## Global Constraints

- No external real-time packages (like SignalR or Pusher): use native SSE (`text/event-stream`) and browser `EventSource`.
- All timestamps in UTC (`DateTime.UtcNow` / ISO strings).
- Strictly follow TDD: tests written and failing before implementation code.
- Consolidated notifications: only ONE notification for all delayed manufacturing orders (>25 days) and ONE per vendor for expired reservations (>30 days).

---

### Task 1: Domain Entity & MongoDB Repository for Notifications

**Files:**
- Create: `Ordina.Backend/src/Domain/Notifications/Notification.cs`
- Create: `Ordina.Backend/src/Domain/Notifications/INotificationRepository.cs`
- Create: `Ordina.Backend/src/Infrastructure/Repositories/NotificationRepository.cs`
- Modify: `Ordina.Backend/src/Infrastructure/DependencyInjection.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/NotificationRepositoryTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public interface INotificationRepository
  {
      Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default);
      Task<IReadOnlyList<Notification>> GetForUserAsync(string userId, IEnumerable<string> roles, int limit = 50, CancellationToken ct = default);
      Task<long> GetUnreadCountAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
      Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default);
      Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
      Task<Notification?> GetActiveConsolidatedAsync(string type, string? targetUserId = null, CancellationToken ct = default);
  }
  ```

- [ ] **Step 1: Write unit tests for Notification entity and queries**

```csharp
// Ordina.Backend/tests/Ordina.Application.Tests/NotificationRepositoryTests.cs
using MongoDB.Bson;
using Ordina.Domain.Notifications;
using Xunit;

namespace Ordina.Application.Tests;

public class NotificationRepositoryTests
{
    [Fact]
    public void Notification_Initialization_SetsDefaults()
    {
        var notification = new Notification
        {
            Type = "ExchangeRateChanged",
            Title = "Tasa actualizada",
            Message = "Nueva tasa USD",
            Severity = "info"
        };

        Assert.NotNull(notification.Id);
        Assert.True(ObjectId.TryParse(notification.Id, out _));
        Assert.Equal("info", notification.Severity);
        Assert.Empty(notification.TargetRoles);
        Assert.Empty(notification.ReadByUserIds);
    }
}
```

- [ ] **Step 2: Run test to verify it fails (missing type)**

Run: `dotnet run --project tests/Ordina.Application.Tests` in `Ordina.Backend`
Expected: FAIL (Compilation error: Notification does not exist)

- [ ] **Step 3: Create Domain Entity and Repository Interface**

```csharp
// Ordina.Backend/src/Domain/Notifications/Notification.cs
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Notifications;

public class Notification : BaseEntity
{
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("message")]
    public string Message { get; set; } = string.Empty;

    [BsonElement("severity")]
    public string Severity { get; set; } = "info"; // info | warning | error | success

    [BsonElement("link")]
    public string? Link { get; set; }

    [BsonElement("targetUserId")]
    public string? TargetUserId { get; set; }

    [BsonElement("targetRoles")]
    public List<string> TargetRoles { get; set; } = new();

    [BsonElement("readByUserIds")]
    public List<string> ReadByUserIds { get; set; } = new();

    [BsonElement("metadata")]
    public Dictionary<string, object>? Metadata { get; set; }
}
```

- [ ] **Step 4: Implement NotificationRepository with MongoDB Driver**

Create `Ordina.Backend/src/Domain/Notifications/INotificationRepository.cs` and `Ordina.Backend/src/Infrastructure/Repositories/NotificationRepository.cs` implementing queries with role/user filtering. Register in `DependencyInjection.cs`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: PASS (All 39+ tests pass)

- [ ] **Step 6: Commit Task 1**

```bash
git add -f Ordina.Backend/src/Domain/Notifications/ Ordina.Backend/src/Infrastructure/Repositories/NotificationRepository.cs Ordina.Backend/tests/Ordina.Application.Tests/NotificationRepositoryTests.cs Ordina.Backend/src/Infrastructure/DependencyInjection.cs
git commit -m "feat(notifications): add notification domain entity and mongodb repository"
```

---

### Task 2: Application Notification Service & In-Memory Event Hub (Channel)

**Files:**
- Create: `Ordina.Backend/src/Application/Notifications/DTOs.cs`
- Create: `Ordina.Backend/src/Application/Notifications/INotificationService.cs`
- Create: `Ordina.Backend/src/Application/Notifications/NotificationService.cs`
- Modify: `Ordina.Backend/src/Application/DependencyInjection.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/NotificationServiceTests.cs`

**Interfaces:**
- Consumes: `INotificationRepository`
- Produces:
  ```csharp
  public interface INotificationService
  {
      Task<NotificationDto> PublishAsync(CreateNotificationDto dto, CancellationToken ct = default);
      IAsyncEnumerable<NotificationDto> SubscribeAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
      Task<IReadOnlyList<NotificationDto>> GetUserNotificationsAsync(string userId, IEnumerable<string> roles, int limit = 50, CancellationToken ct = default);
      Task<long> GetUnreadCountAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
      Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default);
      Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
  }
  ```

- [ ] **Step 1: Write unit tests for NotificationService Pub/Sub filtering**

```csharp
// Ordina.Backend/tests/Ordina.Application.Tests/NotificationServiceTests.cs
using Moq;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;
using Xunit;

namespace Ordina.Application.Tests;

public class NotificationServiceTests
{
    [Fact]
    public async Task PublishAsync_PersistsNotificationAndBroadcasts()
    {
        var mockRepo = new Mock<INotificationRepository>();
        mockRepo.Setup(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification n, CancellationToken _) => n);

        var service = new NotificationService(mockRepo.Object);

        var dto = new CreateNotificationDto(
            Type: "ExchangeRateChanged",
            Title: "Tasa actualizada",
            Message: "1 USD = 50.00 VES",
            Severity: "info",
            Link: "/configuracion/tasas");

        var result = await service.PublishAsync(dto);

        Assert.NotNull(result);
        Assert.Equal("ExchangeRateChanged", result.Type);
        mockRepo.Verify(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: FAIL (types not defined)

- [ ] **Step 3: Implement DTOs and NotificationService using System.Threading.Channels**

Implement `NotificationService` maintaining a concurrent list of client channels or bounded channel broadcasting to subscribers whose role/userId matches. Register `INotificationService` as Singleton (for pub/sub state) in `Application/DependencyInjection.cs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add -f Ordina.Backend/src/Application/Notifications/ Ordina.Backend/tests/Ordina.Application.Tests/NotificationServiceTests.cs Ordina.Backend/src/Application/DependencyInjection.cs
git commit -m "feat(notifications): implement notification service with SSE event hub"
```

---

### Task 3: Real-Time SSE Endpoint & REST Notification Controller

**Files:**
- Create: `Ordina.Backend/src/Api/Controllers/NotificationsController.cs`
- Modify: `Ordina.Backend/src/Api/Program.cs`

**Interfaces:**
- Endpoints:
  - `GET /api/notifications` -> `NotificationDto[]`
  - `GET /api/notifications/unread-count` -> `{ count: number }`
  - `PUT /api/notifications/{id}/read` -> `{ success: true }`
  - `PUT /api/notifications/mark-all-read` -> `{ success: true }`
  - `GET /api/notifications/stream` -> SSE stream (`text/event-stream`)

- [ ] **Step 1: Create NotificationsController**

Write `NotificationsController` with `[Authorize]`. In `GetStream(CancellationToken ct)`:
- Set `Response.Headers.Append("Content-Type", "text/event-stream")`.
- Set `Response.Headers.Append("Cache-Control", "no-cache")`.
- Set `Response.Headers.Append("Connection", "keep-alive")`.
- Read claims for current user ID and roles.
- Stream events: `await Response.WriteAsync($"data: {json}\n\n", ct); await Response.Body.FlushAsync(ct)`.

- [ ] **Step 2: Test building API**

Run: `dotnet build src/Api` in `Ordina.Backend`
Expected: Build succeeded with 0 errors.

- [ ] **Step 3: Commit Task 3**

```bash
git add -f Ordina.Backend/src/Api/Controllers/NotificationsController.cs
git commit -m "feat(notifications): add SSE stream and REST notification controller"
```

---

### Task 4: Triggers Integration (Exchange Rate, Pin, Offline Conflict)

**Files:**
- Modify: `Ordina.Backend/src/Application/Finance/ExchangeRateService.cs`
- Modify: `Ordina.Backend/src/Api/Controllers/AccessPinController.cs`
- Modify: `Ordina.Backend/src/Api/Controllers/TelemetryController.cs` (or specialized endpoint for offline conflicts)

- [ ] **Step 1: Add Notification publishing on Exchange Rate update**

Inject `INotificationService` into `ExchangeRateService`. When a rate is created or updated:
```csharp
await _notificationService.PublishAsync(new CreateNotificationDto(
    Type: "ExchangeRateChanged",
    Title: "Tasa de cambio actualizada",
    Message: $"La tasa de {rate.Currency} se ha actualizado a {rate.Rate:N2}.",
    Severity: "info",
    Link: "/configuracion/tasas"));
```

- [ ] **Step 2: Add Notification publishing on Emergency PIN consumption**

In `AccessPinController.ValidatePin` or `AccessPinService`:
Publish notification with `TargetRoles = new[] { "Administrator", "Super Administrator" }`.

- [ ] **Step 3: Add Notification publishing on offline sync conflict**

When frontend detects `409 Conflict` in outbox draining, it reports to an endpoint or telemetry which publishes an error notification to Administrators.

- [ ] **Step 4: Run tests**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add -u
git commit -m "feat(notifications): integrate exchange rate, pin, and offline conflict triggers"
```

---

### Task 5: Delayed Manufacturing (>25 days) & Expired Reservations (>30 days) Background Worker

**Files:**
- Modify: `Ordina.Backend/src/Infrastructure/Repositories/SpecializedRepositories.cs`
- Create: `Ordina.Backend/src/Infrastructure/BackgroundServices/DelayedOrdersNotifierWorker.cs`
- Modify: `Ordina.Backend/src/Infrastructure/DependencyInjection.cs`

- [ ] **Step 1: Add query filter presets in SpecializedRepositories**

Add `"fabricacion_retrasada"` (manufacturing orders without status change in > 25 days) and `"reservas_vencidas"` (reservations created > 30 days ago).

- [ ] **Step 2: Implement Periodic BackgroundService**

`DelayedOrdersNotifierWorker : BackgroundService`:
- Runs on startup and then every 30 minutes.
- Queries delayed manufacturing orders count. If > 0, publishes/updates consolidated notification (`Type: "ManufacturingDelay"`, `Link: "/pedidos/fabricacion?filter=delayed"`).
- Queries expired reservations grouped by `VendorId`. If > 0, publishes/updates consolidated notification for that vendor (`Type: "ReservationExpiring"`, `Link: "/pedidos/reservas?filter=expired"`).

- [ ] **Step 3: Register HostedService in DependencyInjection**

Register `services.AddHostedService<DelayedOrdersNotifierWorker>()`.

- [ ] **Step 4: Run tests**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add -f Ordina.Backend/src/Infrastructure/BackgroundServices/DelayedOrdersNotifierWorker.cs Ordina.Backend/src/Infrastructure/Repositories/SpecializedRepositories.cs Ordina.Backend/src/Infrastructure/DependencyInjection.cs
git commit -m "feat(notifications): add background worker for manufacturing delay and expired reservations"
```

---

### Task 6: Frontend API Client, `useNotifications` Hook & Sidebar Bell UI

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Create: `Ordina.Frontend/src/hooks/use-notifications.ts`
- Modify: `Ordina.Frontend/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add notification methods to api-client.ts**

`getNotifications()`, `getUnreadNotificationCount()`, `markNotificationAsRead(id)`, `markAllNotificationsAsRead()`.

- [ ] **Step 2: Create useNotifications hook**

Create `use-notifications.ts`:
- Connects to `/api/notifications/stream` via `EventSource`.
- On message, appends to notification state, increments unread counter, and triggers Sonner toast for high severity.
- Handles reconnections and cleanup on unmount.

- [ ] **Step 3: Update Sidebar Bell Icon and Dropdown**

In `sidebar.tsx`:
- Replace the static "No hay tasas de cambio" dropdown with dynamic notifications list.
- Display red badge with `unreadCount` when `unreadCount > 0`.
- Click on notification navigates to `notification.link` and marks as read.
- Include "Marcar todas como leídas" button.

- [ ] **Step 4: Build frontend and verify**

Run: `npm run build` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 5: Commit Task 6**

```bash
git add -f Ordina.Frontend/src/hooks/use-notifications.ts Ordina.Frontend/src/lib/api-client.ts Ordina.Frontend/src/components/dashboard/sidebar.tsx
git commit -m "feat(frontend): add useNotifications hook and interactive sidebar bell"
```

---

### Task 7: Frontend Filters Integration (`delayed` en Fabricación y `expired` en Reservas)

**Files:**
- Modify: `Ordina.Frontend/src/app/pedidos/fabricacion/page.tsx`
- Modify: `Ordina.Frontend/src/app/pedidos/reservas/page.tsx`

- [ ] **Step 1: Add 'delayed' status option in FabricacionPage**

In `fabricacion/page.tsx`:
- Add option `"delayed"` ("Pedidos con retraso (> 25 días)") in the status select dropdown.
- Check `searchParams.get("filter") === "delayed"` on load to auto-select it.
- Filter rows where status is not completed and last activity/creation is older than 25 days.

- [ ] **Step 2: Add 'expired' filter option in ReservasPage**

In `reservas/page.tsx`:
- Add quick filter button/select for "Reservas vencidas (> 30 días)" (`expired`).
- Check `searchParams.get("filter") === "expired"` on load.
- Filter items where `createdAt < Date.now() - 30 * 24 * 60 * 60 * 1000`.

- [ ] **Step 3: Build frontend and verify**

Run: `npm run build` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 4: Commit Task 7**

```bash
git add Ordina.Frontend/src/app/pedidos/fabricacion/page.tsx Ordina.Frontend/src/app/pedidos/reservas/page.tsx
git commit -m "feat(frontend): integrate delayed manufacturing and expired reservations filters"
```

---

### Task 8: Verification & Walkthrough

- [ ] **Step 1: Run all backend tests**
`dotnet run --project tests/Ordina.Application.Tests` in `Ordina.Backend`
- [ ] **Step 2: Run frontend build and linter**
`npm run build` and `npm run lint` in `Ordina.Frontend`
- [ ] **Step 3: Document changes in walkthrough.md**
Update `walkthrough.md` with complete details, API endpoints, and screenshots/instructions.
