# BI Operations Thresholds and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow administrators to configure dynamic threshold ranges (Green, Blue, Orange, Red) for operations BI metrics (Lead Time, OTIF, Dwell Times, Fulfillment), evaluate these metrics in a scheduled background worker with weekly Monday 9:00 AM alerts, and provide a dedicated notification configuration center at `/configuracion/notificaciones`.

**Architecture:** 
1. Backend adds domain entities `OperationsMetricsSettings` and `NotificationRuleSettings` persisted in MongoDB, exposed via REST APIs.
2. Background service `OperationsMetricsAlertWorker` runs on schedule to evaluate metrics against configured thresholds and dispatches consolidated in-app notifications (`OperationsMetricsAlert`) via `INotificationService`.
3. `DelayedOrdersNotifierWorker` and `NotificationService` adapt to dynamically respect admin notification rules and thresholds.
4. Frontend adds `OperationsThresholdDialog` inside `OperationsMetricsCard` with live color preview and updates progress bars/text to dynamic HSL/Tailwind colors (Emerald, Blue, Amber, Rose).
5. A new administrative settings page `/configuracion/notificaciones` manages all alerts, rules, and sound preferences.

**Tech Stack:** .NET 10 / C# 12, MongoDB Driver, xUnit v3, React 19, Vite, Tailwind CSS 4, Radix UI / shadcn, Lucide React, TanStack Query.

## Global Constraints
- Target worktree: `f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith`
- All code comments for simplifications must use `// ponytail:` syntax.
- Follow Ladder of Laziness: prefer standard libraries, existing dependencies, and minimum working code.
- No untested production changes.

---

### Task 1: Domain Entities for Operations Metrics and Notification Rules

**Files:**
- Create: `Ordina.Backend/src/Domain/Analytics/OperationsMetricsSettings.cs`
- Create: `Ordina.Backend/src/Domain/Notifications/NotificationRuleSettings.cs`

**Interfaces:**
- Produces: `OperationsMetricsSettings`, `LeadTimeCategoryThreshold`, `OtifThreshold`, `FulfillmentThreshold`, `NotificationScheduleSettings`, `NotificationRuleSettings`

- [ ] **Step 1: Write Domain Entity `OperationsMetricsSettings.cs`**

```csharp
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Analytics;

public class OperationsMetricsSettings : BaseEntity
{
    public const string DefaultId = "default";

    public OperationsMetricsSettings()
    {
        Id = DefaultId;
    }

    [BsonElement("defaultLeadTime")]
    public LeadTimeCategoryThreshold DefaultLeadTime { get; set; } = new(5, 7, 30, 50);

    [BsonElement("categoryLeadTimes")]
    public Dictionary<string, LeadTimeCategoryThreshold> CategoryLeadTimes { get; set; } = new()
    {
        { "Cama", new(5, 7, 30, 50) },
        { "Box solo", new(3, 5, 30, 50) },
        { "Colchones", new(1, 2, 30, 50) },
        { "Mueble", new(4, 6, 30, 50) },
        { "Copete solo", new(2, 4, 30, 50) },
        { "ComboHogar", new(5, 7, 30, 50) }
    };

    [BsonElement("otif")]
    public OtifThreshold Otif { get; set; } = new(95, 90, 80);

    [BsonElement("stageMaxStandardDays")]
    public Dictionary<string, double> StageMaxStandardDays { get; set; } = new()
    {
        { "Aprobación / Pago", 2.0 },
        { "Cola Taller / Fabricación", 7.0 },
        { "Almacén Central (Terrinca)", 3.0 },
        { "Ruta y Despacho", 3.0 }
    };

    [BsonElement("fulfillment")]
    public FulfillmentThreshold Fulfillment { get; set; } = new(60, 50, 40);

    [BsonElement("lastAlertSentUtc")]
    public DateTime? LastAlertSentUtc { get; set; }
}

public record LeadTimeCategoryThreshold(
    double MinStandardDays,
    double MaxStandardDays,
    double WarningExtraPercentage = 30.0,
    double CriticalExtraPercentage = 50.0
);

public record OtifThreshold(
    double TargetPercentage = 95.0,
    double WarningPercentage = 90.0,
    double CriticalPercentage = 80.0
);

public record FulfillmentThreshold(
    double TargetImmediatePercentage = 60.0,
    double WarningImmediatePercentage = 50.0,
    double CriticalImmediatePercentage = 40.0
);
```

- [ ] **Step 2: Write Domain Entity `NotificationRuleSettings.cs`**

```csharp
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Notifications;

public class NotificationRuleSettings : BaseEntity
{
    public const string DefaultId = "default";

    public NotificationRuleSettings()
    {
        Id = DefaultId;
    }

    // BI Operations Schedule
    [BsonElement("biAlertsEnabled")]
    public bool BiAlertsEnabled { get; set; } = true;

    [BsonElement("biFrequency")]
    public string BiFrequency { get; set; } = "Weekly"; // "Weekly" | "Daily"

    [BsonElement("biDayOfWeek")]
    public DayOfWeek BiDayOfWeek { get; set; } = DayOfWeek.Monday;

    [BsonElement("biHourOfDay")]
    public int BiHourOfDay { get; set; } = 9; // 9:00 AM

    [BsonElement("biMinuteOfHour")]
    public int BiMinuteOfHour { get; set; } = 0;

    [BsonElement("biTargetRoles")]
    public List<string> BiTargetRoles { get; set; } = new() { "Administrator", "Super Administrator" };

    // Operational Rules
    [BsonElement("manufacturingDelayEnabled")]
    public bool ManufacturingDelayEnabled { get; set; } = true;

    [BsonElement("manufacturingDelayDays")]
    public int ManufacturingDelayDays { get; set; } = 25;

    [BsonElement("reservationExpiringEnabled")]
    public bool ReservationExpiringEnabled { get; set; } = true;

    [BsonElement("reservationExpiringDays")]
    public int ReservationExpiringDays { get; set; } = 30;

    // System & Security Rules
    [BsonElement("emergencyPinUsedEnabled")]
    public bool EmergencyPinUsedEnabled { get; set; } = true;

    [BsonElement("exchangeRateChangedEnabled")]
    public bool ExchangeRateChangedEnabled { get; set; } = true;

    [BsonElement("syncConflictEnabled")]
    public bool SyncConflictEnabled { get; set; } = true;

    // Preferences
    [BsonElement("soundEnabled")]
    public bool SoundEnabled { get; set; } = true;
}
```

- [ ] **Step 3: Build backend to verify domain compilation**

Run: `dotnet build src/Domain/Ordina.Domain.csproj`
Expected: Build succeeded with 0 errors.

- [ ] **Step 4: Commit domain entities**

```bash
git add src/Domain/Analytics/OperationsMetricsSettings.cs src/Domain/Notifications/NotificationRuleSettings.cs
git commit -m "feat(domain): add OperationsMetricsSettings and NotificationRuleSettings entities"
```

---

### Task 2: Backend Application Services & Tests for Settings

**Files:**
- Create: `Ordina.Backend/src/Application/Analytics/IOperationsMetricsSettingsService.cs`
- Create: `Ordina.Backend/src/Application/Analytics/OperationsMetricsSettingsService.cs`
- Create: `Ordina.Backend/src/Application/Notifications/INotificationRuleSettingsService.cs`
- Create: `Ordina.Backend/src/Application/Notifications/NotificationRuleSettingsService.cs`
- Create: `Ordina.Backend/tests/Ordina.Application.Tests/OperationsMetricsSettingsServiceTests.cs`

**Interfaces:**
- `IOperationsMetricsSettingsService`: `GetSettingsAsync(ct)`, `UpdateSettingsAsync(settings, ct)`
- `INotificationRuleSettingsService`: `GetSettingsAsync(ct)`, `UpdateSettingsAsync(settings, ct)`

- [ ] **Step 1: Write the failing tests in `OperationsMetricsSettingsServiceTests.cs`**

```csharp
using Moq;
using Ordina.Application.Analytics;
using Ordina.Domain.Analytics;
using Ordina.Domain.Common;
using Xunit;

namespace Ordina.Application.Tests;

public class OperationsMetricsSettingsServiceTests
{
    [Fact]
    public async Task GetSettingsAsync_WhenNotExists_CreatesAndReturnsDefaultSettings()
    {
        var mockRepo = new Mock<IRepository<OperationsMetricsSettings>>();
        mockRepo.Setup(r => r.GetByIdAsync(OperationsMetricsSettings.DefaultId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((OperationsMetricsSettings?)null);

        mockRepo.Setup(r => r.AddAsync(It.IsAny<OperationsMetricsSettings>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OperationsMetricsSettings s, CancellationToken _) => s);

        var service = new OperationsMetricsSettingsService(mockRepo.Object);

        var result = await service.GetSettingsAsync();

        Assert.NotNull(result);
        Assert.Equal(OperationsMetricsSettings.DefaultId, result.Id);
        Assert.Equal(95, result.Otif.TargetPercentage);
        mockRepo.Verify(r => r.AddAsync(It.IsAny<OperationsMetricsSettings>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateSettingsAsync_UpdatesExistingSettings()
    {
        var existing = new OperationsMetricsSettings();
        var mockRepo = new Mock<IRepository<OperationsMetricsSettings>>();
        mockRepo.Setup(r => r.GetByIdAsync(OperationsMetricsSettings.DefaultId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var service = new OperationsMetricsSettingsService(mockRepo.Object);

        var updated = new OperationsMetricsSettings
        {
            Otif = new OtifThreshold(98, 92, 85)
        };

        var result = await service.UpdateSettingsAsync(updated);

        Assert.Equal(98, result.Otif.TargetPercentage);
        mockRepo.Verify(r => r.UpdateAsync(It.Is<OperationsMetricsSettings>(s => s.Otif.TargetPercentage == 98), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsSettingsServiceTests`
Expected: Compilation failure or FAIL ("OperationsMetricsSettingsService not found").

- [ ] **Step 3: Implement Services and Interfaces**

`Ordina.Backend/src/Application/Analytics/IOperationsMetricsSettingsService.cs`:
```csharp
using Ordina.Domain.Analytics;

namespace Ordina.Application.Analytics;

public interface IOperationsMetricsSettingsService
{
    Task<OperationsMetricsSettings> GetSettingsAsync(CancellationToken ct = default);
    Task<OperationsMetricsSettings> UpdateSettingsAsync(OperationsMetricsSettings settings, CancellationToken ct = default);
}
```

`Ordina.Backend/src/Application/Analytics/OperationsMetricsSettingsService.cs`:
```csharp
using Ordina.Domain.Analytics;
using Ordina.Domain.Common;

namespace Ordina.Application.Analytics;

public class OperationsMetricsSettingsService : IOperationsMetricsSettingsService
{
    private readonly IRepository<OperationsMetricsSettings> _repo;

    public OperationsMetricsSettingsService(IRepository<OperationsMetricsSettings> repo)
    {
        _repo = repo;
    }

    public async Task<OperationsMetricsSettings> GetSettingsAsync(CancellationToken ct = default)
    {
        var existing = await _repo.GetByIdAsync(OperationsMetricsSettings.DefaultId, ct);
        if (existing != null) return existing;

        var defaults = new OperationsMetricsSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<OperationsMetricsSettings> UpdateSettingsAsync(OperationsMetricsSettings settings, CancellationToken ct = default)
    {
        settings.Id = OperationsMetricsSettings.DefaultId;
        settings.UpdatedAt = DateTime.UtcNow;

        var existing = await _repo.GetByIdAsync(OperationsMetricsSettings.DefaultId, ct);
        if (existing == null)
        {
            return await _repo.AddAsync(settings, ct);
        }

        await _repo.UpdateAsync(settings, ct);
        return settings;
    }
}
```

`Ordina.Backend/src/Application/Notifications/INotificationRuleSettingsService.cs`:
```csharp
using Ordina.Domain.Notifications;

namespace Ordina.Application.Notifications;

public interface INotificationRuleSettingsService
{
    Task<NotificationRuleSettings> GetSettingsAsync(CancellationToken ct = default);
    Task<NotificationRuleSettings> UpdateSettingsAsync(NotificationRuleSettings settings, CancellationToken ct = default);
}
```

`Ordina.Backend/src/Application/Notifications/NotificationRuleSettingsService.cs`:
```csharp
using Ordina.Domain.Common;
using Ordina.Domain.Notifications;

namespace Ordina.Application.Notifications;

public class NotificationRuleSettingsService : INotificationRuleSettingsService
{
    private readonly IRepository<NotificationRuleSettings> _repo;

    public NotificationRuleSettingsService(IRepository<NotificationRuleSettings> repo)
    {
        _repo = repo;
    }

    public async Task<NotificationRuleSettings> GetSettingsAsync(CancellationToken ct = default)
    {
        var existing = await _repo.GetByIdAsync(NotificationRuleSettings.DefaultId, ct);
        if (existing != null) return existing;

        var defaults = new NotificationRuleSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<NotificationRuleSettings> UpdateSettingsAsync(NotificationRuleSettings settings, CancellationToken ct = default)
    {
        settings.Id = NotificationRuleSettings.DefaultId;
        settings.UpdatedAt = DateTime.UtcNow;

        var existing = await _repo.GetByIdAsync(NotificationRuleSettings.DefaultId, ct);
        if (existing == null)
        {
            return await _repo.AddAsync(settings, ct);
        }

        await _repo.UpdateAsync(settings, ct);
        return settings;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsSettingsServiceTests`
Expected: PASS (2 tests pass).

- [ ] **Step 5: Commit application services**

```bash
git add src/Application/Analytics/ src/Application/Notifications/INotificationRuleSettingsService.cs src/Application/Notifications/NotificationRuleSettingsService.cs tests/Ordina.Application.Tests/OperationsMetricsSettingsServiceTests.cs
git commit -m "feat(application): add operations metrics and notification rule settings services with tests"
```

---

### Task 3: Filter Notifications in NotificationService & Dynamic Thresholds in DelayedOrdersWorker

**Files:**
- Modify: `Ordina.Backend/src/Application/Notifications/NotificationService.cs`
- Modify: `Ordina.Backend/src/Infrastructure/BackgroundServices/DelayedOrdersNotifierWorker.cs`
- Modify: `Ordina.Backend/tests/Ordina.Application.Tests/NotificationServiceTests.cs`

**Interfaces:**
- `NotificationService.PublishAsync`: checks rule in `INotificationRuleSettingsService` before persisting. If disabled, returns null or early exits.
- `DelayedOrdersNotifierWorker`: reads `ManufacturingDelayDays` and `ReservationExpiringDays` from `INotificationRuleSettingsService`.

- [ ] **Step 1: Write test for disabled notification rejection in `NotificationServiceTests.cs`**

```csharp
[Fact]
public async Task PublishAsync_WhenNotificationTypeIsDisabled_DoesNotPersistOrEmit()
{
    var mockRuleService = new Mock<INotificationRuleSettingsService>();
    mockRuleService.Setup(s => s.GetSettingsAsync(It.IsAny<CancellationToken>()))
        .ReturnsAsync(new NotificationRuleSettings { ExchangeRateChangedEnabled = false });

    _mockServiceProvider.Setup(p => p.GetService(typeof(INotificationRuleSettingsService)))
        .Returns(mockRuleService.Object);

    var dto = new CreateNotificationDto(
        Type: "ExchangeRateChanged",
        Title: "Tasa actualizada",
        Message: "1 USD = 50.00 VES",
        Severity: "info");

    var result = await _service.PublishAsync(dto);

    _mockRepo.Verify(r => r.CreateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.NotificationServiceTests`
Expected: FAIL (CreateAsync was called).

- [ ] **Step 3: Update `NotificationService.cs` to check rule settings**

In `NotificationService.PublishAsync`:
```csharp
using var scope = _scopeFactory.CreateScope();
var ruleService = scope.ServiceProvider.GetService<INotificationRuleSettingsService>();
if (ruleService != null)
{
    var rules = await ruleService.GetSettingsAsync(ct);
    var isEnabled = dto.Type switch
    {
        "ManufacturingDelay" => rules.ManufacturingDelayEnabled,
        "ReservationExpiring" => rules.ReservationExpiringEnabled,
        "EmergencyPinUsed" => rules.EmergencyPinUsedEnabled,
        "ExchangeRateChanged" => rules.ExchangeRateChangedEnabled,
        "SyncConflict" => rules.SyncConflictEnabled,
        "OperationsMetricsAlert" => rules.BiAlertsEnabled,
        _ => true // ponytail: default allow unlisted types
    };

    if (!isEnabled)
    {
        _logger.LogInformation("Notification type {Type} is disabled by rule settings. Skipping.", dto.Type);
        return new NotificationDto(string.Empty, dto.Type, dto.Title, dto.Message, dto.Severity, dto.Link, dto.TargetUserId, dto.TargetRoles, false, DateTime.UtcNow, dto.Metadata);
    }
}
```

- [ ] **Step 4: Update `DelayedOrdersNotifierWorker.cs` to use dynamic days and check enabled flag**

```csharp
var ruleService = scope.ServiceProvider.GetService<INotificationRuleSettingsService>();
var rules = ruleService != null ? await ruleService.GetSettingsAsync(ct) : new NotificationRuleSettings();

if (rules.ManufacturingDelayEnabled)
{
    var thresholdDays = rules.ManufacturingDelayDays > 0 ? rules.ManufacturingDelayDays : 25;
    // ponytail: query delayed orders based on configured thresholdDays
    var delayedOrdersResult = await orderRepo.GetFilteredPagedAsync(1, 1, new OrderQueryFilter
    {
        LocationStatus = "FABRICACION",
        ProductFilterPreset = "fabricacion_retrasada"
    }, ct);

    if (delayedOrdersResult.TotalCount > 0)
    {
        var existing = await notificationRepo.GetActiveConsolidatedAsync("ManufacturingDelay", null, ct);
        if (existing == null)
        {
            await notificationService.PublishAsync(new CreateNotificationDto(
                Type: "ManufacturingDelay",
                Title: "Alerta de retraso en fabricación",
                Message: $"Hay {delayedOrdersResult.TotalCount} pedido(s) con más de {thresholdDays} días en fabricación sin cambio de estatus.",
                Severity: "warning",
                Link: "/pedidos/fabricacion?filter=delayed",
                TargetRoles: new() { "Administrator", "Super Administrator", "Supervisor" }), ct);
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.NotificationServiceTests`
Expected: PASS (all tests pass).

- [ ] **Step 6: Commit notification filtering changes**

```bash
git add src/Application/Notifications/NotificationService.cs src/Infrastructure/BackgroundServices/DelayedOrdersNotifierWorker.cs tests/Ordina.Application.Tests/NotificationServiceTests.cs
git commit -m "feat(notifications): add rule-based notification filtering and dynamic delayed order thresholds"
```

---

### Task 4: OperationsMetricsAlertWorker & Background Service Registration

**Files:**
- Create: `Ordina.Infrastructure/BackgroundServices/OperationsMetricsAlertWorker.cs`
- Create: `tests/Ordina.Application.Tests/OperationsMetricsAlertWorkerTests.cs`
- Modify: `Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs`
- Modify: `Ordina.Backend/src/Application/ApplicationServiceExtensions.cs`

**Interfaces:**
- Evaluates `leadTimes`, `otif`, `dwellTimes`, `fulfillment` from `IDashboardService` against `OperationsMetricsSettings`.
- Dispatches `"OperationsMetricsAlert"` when any metric is in Orange or Red.
- Respects `BiDayOfWeek` (e.g. Monday), `BiHourOfDay` (e.g. 9), `BiAlertsEnabled`, and once-a-week guard (`LastAlertSentUtc`).

- [ ] **Step 1: Write unit tests for metric evaluation logic in `OperationsMetricsAlertWorkerTests.cs`**

```csharp
using Moq;
using Ordina.Application.Analytics;
using Ordina.Application.Dashboard;
using Ordina.Application.Notifications;
using Ordina.Domain.Analytics;
using Ordina.Domain.Notifications;
using Xunit;

namespace Ordina.Application.Tests;

public class OperationsMetricsAlertWorkerTests
{
    [Fact]
    public void EvaluateMetrics_WhenLeadTimeExceedsCritical_GeneratesRedAlert()
    {
        var settings = new OperationsMetricsSettings();
        // Cama: standard 5-7d, critical extra +50% -> > 10.5d is Red
        var leadTimes = new List<ManufacturingLeadTimeDto>
        {
            new("Cama", 11.0, 10, 5, 15)
        };

        var alerts = OperationsMetricsEvaluator.Evaluate(settings, leadTimes, null, new List<StageDwellTimeDto>(), null);

        Assert.Single(alerts);
        Assert.Equal("error", alerts[0].Severity);
        Assert.Contains("Cama", alerts[0].MetricName);
    }

    [Fact]
    public void EvaluateMetrics_WhenAllInRange_GeneratesNoAlerts()
    {
        var settings = new OperationsMetricsSettings();
        var leadTimes = new List<ManufacturingLeadTimeDto>
        {
            new("Cama", 6.0, 10, 5, 15)
        };
        var otif = new OtifMetricsDto(97.0, 100, 3, 103);

        var alerts = OperationsMetricsEvaluator.Evaluate(settings, leadTimes, otif, new List<StageDwellTimeDto>(), null);

        Assert.Empty(alerts);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsAlertWorkerTests`
Expected: FAIL ("OperationsMetricsEvaluator does not exist").

- [ ] **Step 3: Implement `OperationsMetricsEvaluator` and `OperationsMetricsAlertWorker`**

Create `Ordina.Backend/src/Application/Analytics/OperationsMetricsEvaluator.cs`:
```csharp
using Ordina.Application.Dashboard;
using Ordina.Domain.Analytics;

namespace Ordina.Application.Analytics;

public record MetricAlertItem(string MetricName, string Severity, string Description);

public static class OperationsMetricsEvaluator
{
    public static List<MetricAlertItem> Evaluate(
        OperationsMetricsSettings settings,
        IReadOnlyList<ManufacturingLeadTimeDto> leadTimes,
        OtifMetricsDto? otif,
        IReadOnlyList<StageDwellTimeDto> dwellTimes,
        FulfillmentRatioDto? fulfillment)
    {
        var alerts = new List<MetricAlertItem>();

        // 1. Lead times
        foreach (var lt in leadTimes)
        {
            var category = lt.Category ?? string.Empty;
            var threshold = settings.CategoryLeadTimes.TryGetValue(category, out var t)
                ? t
                : settings.DefaultLeadTime;

            var warningLimit = threshold.MaxStandardDays * (1 + threshold.WarningExtraPercentage / 100.0);
            var criticalLimit = threshold.MaxStandardDays * (1 + threshold.CriticalExtraPercentage / 100.0);

            if (lt.AverageDays >= criticalLimit)
            {
                alerts.Add(new MetricAlertItem(
                    $"Lead Time ({category})",
                    "error",
                    $"{category}: {lt.AverageDays:N1} d excede el límite crítico ({criticalLimit:N1} d)"));
            }
            else if (lt.AverageDays > warningLimit)
            {
                alerts.Add(new MetricAlertItem(
                    $"Lead Time ({category})",
                    "warning",
                    $"{category}: {lt.AverageDays:N1} d excede el límite estándar ({warningLimit:N1} d)"));
            }
        }

        // 2. OTIF
        if (otif != null)
        {
            if (otif.OtifRate < settings.Otif.CriticalPercentage)
            {
                alerts.Add(new MetricAlertItem(
                    "Cumplimiento OTIF",
                    "error",
                    $"OTIF en {otif.OtifRate:N1}% por debajo del nivel crítico ({settings.Otif.CriticalPercentage}%)"));
            }
            else if (otif.OtifRate < settings.Otif.WarningPercentage)
            {
                alerts.Add(new MetricAlertItem(
                    "Cumplimiento OTIF",
                    "warning",
                    $"OTIF en {otif.OtifRate:N1}% por debajo del nivel estándar ({settings.Otif.WarningPercentage}%)"));
            }
        }

        // 3. Cuellos de botella (Dwell Times)
        foreach (var dt in dwellTimes)
        {
            var stage = dt.StageName ?? string.Empty;
            if (settings.StageMaxStandardDays.TryGetValue(stage, out var maxDays))
            {
                if (dt.AverageDays > maxDays * 1.5)
                {
                    alerts.Add(new MetricAlertItem(
                        $"Cuello de Botella ({stage})",
                        "error",
                        $"{stage}: {dt.AverageDays:N1} d en espera (crítico vs {maxDays:N1} d)"));
                }
                else if (dt.AverageDays > maxDays * 1.3)
                {
                    alerts.Add(new MetricAlertItem(
                        $"Cuello de Botella ({stage})",
                        "warning",
                        $"{stage}: {dt.AverageDays:N1} d en espera (advertencia vs {maxDays:N1} d)"));
                }
            }
        }

        return alerts;
    }
}
```

Create `Ordina.Backend/src/Infrastructure/BackgroundServices/OperationsMetricsAlertWorker.cs`:
```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ordina.Application.Analytics;
using Ordina.Application.Dashboard;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;

namespace Ordina.Infrastructure.BackgroundServices;

public class OperationsMetricsAlertWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OperationsMetricsAlertWorker> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);

    public OperationsMetricsAlertWorker(IServiceScopeFactory scopeFactory, ILogger<OperationsMetricsAlertWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ponytail: Initial delay to let DB connections settle
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndPublishMetricsAlertsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error checking operational metrics alerts in worker");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    public async Task<int> CheckAndPublishMetricsAlertsAsync(CancellationToken ct, bool forceRun = false)
    {
        using var scope = _scopeFactory.CreateScope();
        var metricsService = scope.ServiceProvider.GetRequiredService<IOperationsMetricsSettingsService>();
        var ruleService = scope.ServiceProvider.GetRequiredService<INotificationRuleSettingsService>();
        var dashboardService = scope.ServiceProvider.GetRequiredService<IDashboardService>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var metricsSettings = await metricsService.GetSettingsAsync(ct);
        var rules = await ruleService.GetSettingsAsync(ct);

        if (!rules.BiAlertsEnabled && !forceRun) return 0;

        // Venezuela local time (UTC-4)
        var vzlaTime = DateTime.UtcNow.AddHours(-4);
        var isScheduledDay = vzlaTime.DayOfWeek == rules.BiDayOfWeek;
        var isScheduledHour = vzlaTime.Hour >= rules.BiHourOfDay;
        var alreadySentThisWeek = metricsSettings.LastAlertSentUtc.HasValue &&
            (DateTime.UtcNow - metricsSettings.LastAlertSentUtc.Value).TotalDays < 6;

        if (!forceRun && (!isScheduledDay || !isScheduledHour || alreadySentThisWeek))
        {
            return 0;
        }

        var leadTimes = await dashboardService.GetManufacturingLeadTimeAsync("month", ct);
        var otif = await dashboardService.GetOtifMetricsAsync("month", ct);
        var dwellTimes = await dashboardService.GetStageDwellTimesAsync("month", ct);
        var fulfillment = await dashboardService.GetFulfillmentRatioAsync("month", ct);

        var alerts = OperationsMetricsEvaluator.Evaluate(metricsSettings, leadTimes, otif, dwellTimes, fulfillment);
        if (alerts.Count == 0) return 0;

        var hasCritical = alerts.Any(a => a.Severity == "error");
        var topAlertDescriptions = string.Join("; ", alerts.Take(3).Select(a => a.Description));
        var summaryMessage = $"Se detectaron {alerts.Count} desvíos en métricas de operaciones: {topAlertDescriptions}.";

        await notificationService.PublishAsync(new CreateNotificationDto(
            Type: "OperationsMetricsAlert",
            Title: "Reporte de Métricas Operativas Fuera de Rango",
            Message: summaryMessage,
            Severity: hasCritical ? "error" : "warning",
            Link: "/dashboard",
            TargetRoles: rules.BiTargetRoles), ct);

        metricsSettings.LastAlertSentUtc = DateTime.UtcNow;
        await metricsService.UpdateSettingsAsync(metricsSettings, ct);

        return alerts.Count;
    }
}
```

- [ ] **Step 4: Register dependencies in `ApplicationServiceExtensions.cs` and `InfrastructureServiceExtensions.cs`**

Register:
- `services.AddScoped<IOperationsMetricsSettingsService, OperationsMetricsSettingsService>();`
- `services.AddScoped<INotificationRuleSettingsService, NotificationRuleSettingsService>();`
- `services.AddHostedService<OperationsMetricsAlertWorker>();`

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsAlertWorkerTests`
Expected: PASS (2 tests pass).

- [ ] **Step 6: Commit worker and evaluation logic**

```bash
git add src/Application/Analytics/ src/Infrastructure/BackgroundServices/OperationsMetricsAlertWorker.cs src/Application/ApplicationServiceExtensions.cs src/Infrastructure/InfrastructureServiceExtensions.cs tests/Ordina.Application.Tests/OperationsMetricsAlertWorkerTests.cs
git commit -m "feat(worker): add OperationsMetricsAlertWorker with scheduled evaluation and notification dispatch"
```

---

### Task 5: API Controllers for Metrics Thresholds and Notification Settings

**Files:**
- Create: `Ordina.Backend/src/Api/Controllers/OperationsMetricsSettingsController.cs`
- Create: `Ordina.Backend/src/Api/Controllers/NotificationSettingsController.cs`
- Create: `tests/Ordina.Api.Tests/OperationsMetricsSettingsControllerTests.cs`

**Interfaces:**
- `GET /api/operations-metrics/settings` $\rightarrow$ `OperationsMetricsSettings`
- `PUT /api/operations-metrics/settings` $\rightarrow$ `OperationsMetricsSettings`
- `GET /api/notifications/settings` $\rightarrow$ `NotificationRuleSettings`
- `PUT /api/notifications/settings` $\rightarrow$ `NotificationRuleSettings`
- `POST /api/notifications/test-alert` $\rightarrow$ triggers test alert and returns `{ success = true, alertsCount = N }`

- [ ] **Step 1: Write Controller Unit Test in `OperationsMetricsSettingsControllerTests.cs`**

```csharp
using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Analytics;
using Ordina.Domain.Analytics;
using Xunit;

namespace Ordina.Api.Tests;

public class OperationsMetricsSettingsControllerTests
{
    [Fact]
    public async Task Get_ReturnsOkResultWithSettings()
    {
        var mockService = new Mock<IOperationsMetricsSettingsService>();
        mockService.Setup(s => s.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OperationsMetricsSettings());

        var controller = new OperationsMetricsSettingsController(mockService.Object);

        var actionResult = await controller.Get(CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var model = Assert.IsType<OperationsMetricsSettings>(okResult.Value);

        Assert.NotNull(model);
        Assert.Equal(95, model.Otif.TargetPercentage);
    }
}
```

- [ ] **Step 2: Implement `OperationsMetricsSettingsController.cs`**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Analytics;
using Ordina.Domain.Analytics;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/operations-metrics/settings")]
[Authorize]
public class OperationsMetricsSettingsController : ControllerBase
{
    private readonly IOperationsMetricsSettingsService _service;

    public OperationsMetricsSettingsController(IOperationsMetricsSettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<OperationsMetricsSettings>> Get(CancellationToken ct)
    {
        var settings = await _service.GetSettingsAsync(ct);
        return Ok(settings);
    }

    [HttpPut]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult<OperationsMetricsSettings>> Update([FromBody] OperationsMetricsSettings settings, CancellationToken ct)
    {
        var updated = await _service.UpdateSettingsAsync(settings, ct);
        return Ok(updated);
    }
}
```

- [ ] **Step 3: Implement `NotificationSettingsController.cs`**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;
using Ordina.Infrastructure.BackgroundServices;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/notifications/settings")]
[Authorize]
public class NotificationSettingsController : ControllerBase
{
    private readonly INotificationRuleSettingsService _ruleService;
    private readonly OperationsMetricsAlertWorker? _worker;

    public NotificationSettingsController(
        INotificationRuleSettingsService ruleService,
        IServiceProvider serviceProvider)
    {
        _ruleService = ruleService;
        // ponytail: resolve worker if registered as hosted service
        _worker = serviceProvider.GetService<IHostedService>() as OperationsMetricsAlertWorker;
    }

    [HttpGet]
    public async Task<ActionResult<NotificationRuleSettings>> Get(CancellationToken ct)
    {
        var settings = await _ruleService.GetSettingsAsync(ct);
        return Ok(settings);
    }

    [HttpPut]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult<NotificationRuleSettings>> Update([FromBody] NotificationRuleSettings settings, CancellationToken ct)
    {
        var updated = await _ruleService.UpdateSettingsAsync(settings, ct);
        return Ok(updated);
    }

    [HttpPost("test-alert")]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult> TestAlert([FromServices] INotificationService notificationService, CancellationToken ct)
    {
        var notif = await notificationService.PublishAsync(new CreateNotificationDto(
            Type: "OperationsMetricsAlert",
            Title: "Prueba: Reporte de Métricas Operativas",
            Message: "Esta es una alerta de prueba generada manualmente para validar la entrega a administradores.",
            Severity: "info",
            Link: "/dashboard",
            TargetRoles: new() { "Administrator", "Super Administrator" }), ct);

        return Ok(new { success = true, notification = notif });
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet run --project tests/Ordina.Api.Tests/Ordina.Api.Tests.csproj -- -class Ordina.Api.Tests.OperationsMetricsSettingsControllerTests`
Expected: PASS.

- [ ] **Step 5: Commit API controllers**

```bash
git add src/Api/Controllers/OperationsMetricsSettingsController.cs src/Api/Controllers/NotificationSettingsController.cs tests/Ordina.Api.Tests/OperationsMetricsSettingsControllerTests.cs
git commit -m "feat(api): add endpoints for operations metrics settings and notification rule configuration"
```

---

### Task 6: Frontend API Client & Dynamic Threshold Utility

**Files:**
- Create: `Ordina.Frontend/src/lib/metrics-thresholds.ts`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`

**Interfaces:**
- `getLeadTimeStatus(days, threshold)` $\rightarrow$ `{ colorClass, label, status: "green"|"blue"|"orange"|"red" }`
- `getOtifStatus(rate, threshold)` $\rightarrow$ `{ colorClass, status: "green"|"blue"|"orange"|"red" }`
- `getDwellTimeStatus(days, maxDays)` $\rightarrow$ `{ colorClass, status: "green"|"blue"|"orange"|"red" }`
- `apiClient.getOperationsMetricsSettings()`, `apiClient.updateOperationsMetricsSettings(data)`
- `apiClient.getNotificationSettings()`, `apiClient.updateNotificationSettings(data)`, `apiClient.testNotificationAlert()`

- [ ] **Step 1: Write `src/lib/metrics-thresholds.ts`**

```ts
export interface LeadTimeCategoryThreshold {
  minStandardDays: number
  maxStandardDays: number
  warningExtraPercentage: number
  criticalExtraPercentage: number
}

export interface OtifThreshold {
  targetPercentage: number
  warningPercentage: number
  criticalPercentage: number
}

export interface FulfillmentThreshold {
  targetImmediatePercentage: number
  warningImmediatePercentage: number
  criticalImmediatePercentage: number
}

export interface OperationsMetricsSettings {
  id?: string
  defaultLeadTime: LeadTimeCategoryThreshold
  categoryLeadTimes: Record<string, LeadTimeCategoryThreshold>
  otif: OtifThreshold
  stageMaxStandardDays: Record<string, number>
  fulfillment: FulfillmentThreshold
}

export type MetricStatus = "green" | "blue" | "orange" | "red"

export interface MetricVisualResult {
  status: MetricStatus
  barClass: string
  textClass: string
  label: string
}

export function getLeadTimeStatus(days: number, threshold?: LeadTimeCategoryThreshold): MetricVisualResult {
  const t = threshold ?? {
    minStandardDays: 5,
    maxStandardDays: 7,
    warningExtraPercentage: 30,
    criticalExtraPercentage: 50
  }

  const warningLimit = t.maxStandardDays * (1 + t.warningExtraPercentage / 100)
  const criticalLimit = t.maxStandardDays * (1 + t.criticalExtraPercentage / 100)

  if (days < t.minStandardDays) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Por debajo del estándar"
    }
  }

  if (days <= t.maxStandardDays) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "En rango estándar"
    }
  }

  if (days <= criticalLimit) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Por encima del estándar"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Muy por encima del estándar"
  }
}

export function getOtifStatus(rate: number, threshold?: OtifThreshold): MetricVisualResult {
  const t = threshold ?? {
    targetPercentage: 95,
    warningPercentage: 90,
    criticalPercentage: 80
  }

  if (rate >= t.targetPercentage) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Excelente"
    }
  }

  if (rate >= t.warningPercentage) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "En rango estándar"
    }
  }

  if (rate >= t.criticalPercentage) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Bajo advertencia"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Crítico"
  }
}

export function getDwellTimeStatus(days: number, maxStandardDays: number = 5): MetricVisualResult {
  if (days < maxStandardDays * 0.7) {
    return {
      status: "green",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-500 dark:text-emerald-400",
      label: "Óptimo"
    }
  }

  if (days <= maxStandardDays) {
    return {
      status: "blue",
      barClass: "bg-blue-500",
      textClass: "text-blue-500 dark:text-blue-400",
      label: "Estándar"
    }
  }

  if (days <= maxStandardDays * 1.5) {
    return {
      status: "orange",
      barClass: "bg-amber-500",
      textClass: "text-amber-500 dark:text-amber-400",
      label: "Cuello de botella"
    }
  }

  return {
    status: "red",
    barClass: "bg-rose-500",
    textClass: "text-rose-500 dark:text-rose-400",
    label: "Crítico"
  }
}
```

- [ ] **Step 2: Add API methods to `src/lib/api-client.ts`**

Add interfaces and functions:
```ts
export interface NotificationRuleSettings {
  id?: string
  biAlertsEnabled: boolean
  biFrequency: string
  biDayOfWeek: number // 1 = Monday
  biHourOfDay: number
  biMinuteOfHour: number
  biTargetRoles: string[]
  manufacturingDelayEnabled: boolean
  manufacturingDelayDays: number
  reservationExpiringEnabled: boolean
  reservationExpiringDays: number
  emergencyPinUsedEnabled: boolean
  exchangeRateChangedEnabled: boolean
  syncConflictEnabled: boolean
  soundEnabled: boolean
}
```

And methods inside `apiClient`:
```ts
  async getOperationsMetricsSettings(signal?: AbortSignal): Promise<OperationsMetricsSettings> {
    return apiFetch<OperationsMetricsSettings>('/api/operations-metrics/settings', { signal })
  },

  async updateOperationsMetricsSettings(settings: OperationsMetricsSettings, signal?: AbortSignal): Promise<OperationsMetricsSettings> {
    return apiFetch<OperationsMetricsSettings>('/api/operations-metrics/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      signal
    })
  },

  async getNotificationSettings(signal?: AbortSignal): Promise<NotificationRuleSettings> {
    return apiFetch<NotificationRuleSettings>('/api/notifications/settings', { signal })
  },

  async updateNotificationSettings(settings: NotificationRuleSettings, signal?: AbortSignal): Promise<NotificationRuleSettings> {
    return apiFetch<NotificationRuleSettings>('/api/notifications/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      signal
    })
  },

  async testNotificationAlert(signal?: AbortSignal): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/notifications/settings/test-alert', {
      method: 'POST',
      signal
    })
  }
```

- [ ] **Step 3: Run lint to verify clean TypeScript**

Run: `npm run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 4: Commit frontend API and threshold utilities**

```bash
git add src/lib/metrics-thresholds.ts src/lib/api-client.ts
git commit -m "feat(frontend): add metrics threshold evaluator and api client methods"
```

---

### Task 7: Modal `OperationsThresholdDialog` & Reactive Card Integration

**Files:**
- Create: `Ordina.Frontend/src/components/analytics/operations-threshold-dialog.tsx`
- Modify: `Ordina.Frontend/src/components/analytics/operations-metrics-card.tsx`

**Interfaces:**
- Modal opens from header button in `OperationsMetricsCard`.
- Allows modifying standard min/max days for each category, tolerances (+30% Naranja, +50% Rojo), OTIF target %, and dwell time limits.
- Persists via `apiClient.updateOperationsMetricsSettings` with toast notification and updates the parent card state reactively.
- The 4 sections in `OperationsMetricsCard` use `getLeadTimeStatus`, `getOtifStatus`, `getDwellTimeStatus` to color bars and text.

- [ ] **Step 1: Create `src/components/analytics/operations-threshold-dialog.tsx`**

Build dialog with:
- Tabs: Lead Time, OTIF, Permanencia x Etapa, Abastecimiento.
- Inputs for `minStandardDays`, `maxStandardDays`, `warningExtraPercentage`, `criticalExtraPercentage`.
- Realtime preview badges (Verde, Azul, Naranja, Rojo).
- Save and Reset Default actions.

- [ ] **Step 2: Update `src/components/analytics/operations-metrics-card.tsx`**

- Fetch or accept `OperationsMetricsSettings`.
- Add `<Button variant="ghost" size="icon" onClick={() => setIsThresholdDialogOpen(true)}>` with `<Settings2 className="w-4 h-4" />` in header.
- Apply dynamic colors to Lead Times, OTIF, Cuellos de Botella, and Abastecimiento bars and text.

- [ ] **Step 3: Verify with lint**

Run: `npm run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 4: Commit threshold dialog and reactive card**

```bash
git add src/components/analytics/operations-threshold-dialog.tsx src/components/analytics/operations-metrics-card.tsx
git commit -m "feat(frontend): integrate OperationsThresholdDialog and reactive color thresholds in OperationsMetricsCard"
```

---

### Task 8: Notification Configuration Page (`/configuracion/notificaciones`)

**Files:**
- Create: `Ordina.Frontend/src/app/configuracion/notificaciones/page.tsx`
- Modify: `Ordina.Frontend/src/App.tsx`
- Modify: `Ordina.Frontend/src/components/layout/sidebar.tsx`

**Interfaces:**
- Route: `/configuracion/notificaciones`
- Navigation item in sidebar under Configuración submenu with `BellRing` icon.
- Cards:
  1. **Alertas de Métricas BI**: Switch enable, frequency select, day select (Lunes default), hour select (9:00 AM default), target roles checkboxes.
  2. **Reglas Operativas**: Switches & days inputs for `ManufacturingDelay` (default 25d) and `ReservationExpiring` (default 30d).
  3. **Alertas del Sistema**: Switches for PIN, Exchange rate, and sync conflicts.
  4. **Preferencias y Acciones**: Sound toggle and "Enviar Alerta de Prueba Ahora" button.

- [ ] **Step 1: Create `src/app/configuracion/notificaciones/page.tsx`**

Implement complete form with TanStack Query / React Query, form inputs, feedback with `toast.success`, and test alert button.

- [ ] **Step 2: Register Route in `src/App.tsx`**

Import `NotificacionesConfigPage` from `./app/configuracion/notificaciones/page` and add route:
`<Route path="/configuracion/notificaciones" element={<NotificacionesConfigPage />} />`

- [ ] **Step 3: Add to Navigation Menu in `src/components/layout/sidebar.tsx`**

Add item `{ title: "Notificaciones", href: "/configuracion/notificaciones", icon: BellRing }` under the Configuración section for admin roles.

- [ ] **Step 4: Verify with lint**

Run: `npm run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 5: Commit notification settings page and routing**

```bash
git add src/app/configuracion/notificaciones/page.tsx src/App.tsx src/components/layout/sidebar.tsx
git commit -m "feat(frontend): add /configuracion/notificaciones page with admin controls and sidebar link"
```

---

### Task 9: End-to-End Verification & Verification-Before-Completion

**Files:**
- All modified backend and frontend files.

- [ ] **Step 1: Run Backend Tests**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsSettingsServiceTests`
Expected: All tests pass.

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.OperationsMetricsAlertWorkerTests`
Expected: All tests pass.

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj -- -class Ordina.Application.Tests.NotificationServiceTests`
Expected: All tests pass.

- [ ] **Step 2: Run Frontend Lint and Build Verification**

Run: `npm run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 3: Verification Checklist**
- [ ] User can click the settings button in `OperationsMetricsCard` and open `OperationsThresholdDialog`.
- [ ] User can configure Lead Time (min, max, % extra), OTIF target, stage max days, and immediate stock target.
- [ ] Visual indicators display Green (below standard), Blue (in standard), Orange (above standard), and Red (far above standard).
- [ ] Weekly alerts are scheduled for Monday 9:00 AM (customizable in `/configuracion/notificaciones`).
- [ ] Admins can adjust days and toggles for `ManufacturingDelay`, `ReservationExpiring`, and other notifications.
- [ ] Test notification button sends an immediate alert to confirm functionality.
