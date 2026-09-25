# Sistema de Reporte de Problemas y Submenú de Ayuda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un submenú en el botón de ayuda del Sidebar que permita abrir un diálogo modal para reportar incidencias técnicas con captura automática de contexto, guardando el ticket en MongoDB y enviando una notificación por correo electrónico formateado a `verkkutech@gmail.com`.

**Architecture:** Frontend en React/Vite con un `DropdownMenu` en el `Sidebar` que activa `SupportTicketDialog` (capturando contexto del usuario y ruta activa); Backend en ASP.NET Core 10 con arquitectura modular limpia (`Domain`, `Application`, `Infrastructure`, `Api`), persistiendo la entidad `SupportTicket` mediante `IRepository<SupportTicket>` en MongoDB y despachando el correo a través de `IEmailService` implementado con la librería estándar `System.Net.Mail` con configuración SMTP desacoplada.

**Tech Stack:** ASP.NET Core 10, C# 13, MongoDB.Driver, System.Net.Mail, xUnit, Moq, React 19, TypeScript, Tailwind CSS, Lucide React, Radix UI / Shadcn.

## Global Constraints

- Backend framework: .NET 10.
- Frontend runtime/bundler: Vite + React + TypeScript.
- No external packages for email: Use .NET standard library (`System.Net.Mail.SmtpClient`) adhering to the Ponytail Ladder of Laziness.
- Notification recipient for support tickets: `verkkutech@gmail.com`.
- Extensibility: The help button dropdown must include a placeholder item for "Ventas no concretadas" (marked as "Próximamente") to support future reporting features.

---

### Task 1: Domain Entity `SupportTicket` & Repository Registration

**Files:**
- Create: `Ordina.Backend/src/Domain/Support/SupportTicket.cs`
- Modify: `Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs`

**Interfaces:**
- Consumes: `Ordina.Domain.Common.BaseEntity`
- Produces: `Ordina.Domain.Support.SupportTicket`, `IRepository<SupportTicket>` registered in DI.

- [ ] **Step 1: Create the domain entity `SupportTicket`**

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Support;

public class SupportTicket : BaseEntity
{
    public SupportTicket()
    {
        Id = ObjectId.GenerateNewId().ToString();
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    [BsonElement("ticketCode")]
    public string TicketCode { get; set; } = string.Empty;

    [BsonElement("userId")]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("userName")]
    public string UserName { get; set; } = string.Empty;

    [BsonElement("userEmail")]
    public string UserEmail { get; set; } = string.Empty;

    [BsonElement("userRole")]
    public string UserRole { get; set; } = string.Empty;

    [BsonElement("storeId")]
    public string? StoreId { get; set; }

    [BsonElement("storeName")]
    public string? StoreName { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = "system_error"; // system_error, performance, data, question, other

    [BsonElement("priority")]
    public string Priority { get; set; } = "medium"; // low, medium, high, critical

    [BsonElement("subject")]
    public string Subject { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("currentUrl")]
    public string CurrentUrl { get; set; } = string.Empty;

    [BsonElement("clientInfo")]
    public string? ClientInfo { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "Open";

    [BsonElement("emailSent")]
    public bool EmailSent { get; set; }

    [BsonElement("emailSentAt")]
    public DateTime? EmailSentAt { get; set; }

    [BsonElement("emailError")]
    public string? EmailError { get; set; }
}
```

- [ ] **Step 2: Register `IRepository<SupportTicket>` in `InfrastructureServiceExtensions.cs`**

Add the namespace `using Ordina.Domain.Support;` and line:
```csharp
services.AddScoped<IRepository<SupportTicket>>(sp => new MongoRepository<SupportTicket>(sp.GetRequiredService<MongoDbContext>().Database, "support_tickets"));
```

- [ ] **Step 3: Verify build of Domain & Infrastructure**

Run: `dotnet build .\Ordina.Backend\src\Infrastructure\Ordina.Infrastructure.csproj`
Expected: Build succeeded with 0 errors.

- [ ] **Step 4: Commit Task 1**

```bash
git add Ordina.Backend/src/Domain/Support/SupportTicket.cs Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs
git commit -m "feat(support): add SupportTicket domain entity and register MongoDB repository"
```

---

### Task 2: Email Service & Smtp Settings

**Files:**
- Create: `Ordina.Backend/src/Application/Common/IEmailService.cs`
- Create: `Ordina.Backend/src/Infrastructure/Email/SmtpSettings.cs`
- Create: `Ordina.Backend/src/Infrastructure/Email/SmtpEmailService.cs`
- Modify: `Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs`
- Modify: `Ordina.Backend/src/Api/appsettings.json`

**Interfaces:**
- Produces: `IEmailService.SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken)`

- [ ] **Step 1: Create `IEmailService` in `Application/Common`**

```csharp
namespace Ordina.Application.Common;

public interface IEmailService
{
    Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 2: Create `SmtpSettings` in `Infrastructure/Email`**

```csharp
namespace Ordina.Infrastructure.Email;

public class SmtpSettings
{
    public const string SectionName = "SmtpSettings";

    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = "soporte@camihogar.com";
    public string SenderName { get; set; } = "CamiHogar ERP Soporte";
    public string SupportRecipientEmail { get; set; } = "verkkutech@gmail.com";
}
```

- [ ] **Step 3: Create `SmtpEmailService` in `Infrastructure/Email`**

```csharp
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Ordina.Application.Common;

namespace Ordina.Infrastructure.Email;

public class SmtpEmailService : IEmailService
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IOptions<SmtpSettings> settings, ILogger<SmtpEmailService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.UserName) || string.IsNullOrWhiteSpace(_settings.Password))
        {
            _logger.LogWarning("SMTP credentials not configured. Email to {ToEmail} with subject '{Subject}' was skipped.", toEmail, subject);
            return false;
        }

        try
        {
            using var client = new SmtpClient(_settings.Host, _settings.Port)
            {
                EnableSsl = _settings.EnableSsl,
                Credentials = new NetworkCredential(_settings.UserName, _settings.Password),
                DeliveryMethod = SmtpDeliveryMethod.Network
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };

            message.To.Add(toEmail);

            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Support email sent successfully to {ToEmail} (Subject: {Subject})", toEmail, subject);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail} (Subject: {Subject}): {ErrorMessage}", toEmail, subject, ex.Message);
            return false;
        }
    }
}
```

- [ ] **Step 4: Register `SmtpEmailService` and update `appsettings.json`**

In `Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs`:
```csharp
services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));
services.AddScoped<IEmailService, SmtpEmailService>();
```

In `Ordina.Backend/src/Api/appsettings.json`:
```json
  "SmtpSettings": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "EnableSsl": true,
    "UserName": "",
    "Password": "",
    "SenderEmail": "soporte@camihogar.com",
    "SenderName": "CamiHogar ERP Soporte",
    "SupportRecipientEmail": "verkkutech@gmail.com"
  }
```

- [ ] **Step 5: Verify build**

Run: `dotnet build .\Ordina.Backend\src\Infrastructure\Ordina.Infrastructure.csproj`
Expected: Build succeeded with 0 errors.

- [ ] **Step 6: Commit Task 2**

```bash
git add Ordina.Backend/src/Application/Common/IEmailService.cs Ordina.Backend/src/Infrastructure/Email/ Ordina.Backend/src/Infrastructure/InfrastructureServiceExtensions.cs Ordina.Backend/src/Api/appsettings.json
git commit -m "feat(email): add IEmailService and SmtpEmailService with SmtpSettings configuration"
```

---

### Task 3: Application DTOs, Service & Unit Tests (TDD)

**Files:**
- Create: `Ordina.Backend/src/Application/Support/SupportDtos.cs`
- Create: `Ordina.Backend/src/Application/Support/ISupportService.cs`
- Create: `Ordina.Backend/src/Application/Support/SupportService.cs`
- Create: `Ordina.Backend/tests/Ordina.Application.Tests/SupportServiceTests.cs`
- Modify: `Ordina.Backend/src/Application/ApplicationServiceExtensions.cs`

**Interfaces:**
- Produces: `ISupportService.CreateTicketAsync(CreateSupportTicketDto dto, CurrentUserDto user, CancellationToken ct)`

- [ ] **Step 1: Define DTOs in `SupportDtos.cs`**

```csharp
namespace Ordina.Application.Support;

public record CreateSupportTicketDto(
    string Category,
    string Priority,
    string Subject,
    string Description,
    string CurrentUrl,
    string? ClientInfo
);

public record SupportTicketResponseDto(
    string Id,
    string TicketCode,
    string Status,
    bool EmailSent,
    string Message
);

public record SupportCurrentUserContext(
    string UserId,
    string UserName,
    string UserEmail,
    string UserRole,
    string? StoreId = null,
    string? StoreName = null
);
```

- [ ] **Step 2: Define `ISupportService` interface**

```csharp
namespace Ordina.Application.Support;

public interface ISupportService
{
    Task<SupportTicketResponseDto> CreateTicketAsync(CreateSupportTicketDto dto, SupportCurrentUserContext userContext, CancellationToken cancellationToken = default);
}
```

- [ ] **Step 3: Write failing unit test in `SupportServiceTests.cs`**

```csharp
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Support;
using Ordina.Domain.Support;
using Ordina.Infrastructure.Email;
using Xunit;

namespace Ordina.Application.Tests;

public class SupportServiceTests
{
    private readonly Mock<IRepository<SupportTicket>> _ticketRepoMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<SupportService>> _loggerMock;
    private readonly IOptions<SmtpSettings> _smtpOptions;
    private readonly SupportService _service;

    public SupportServiceTests()
    {
        _ticketRepoMock = new Mock<IRepository<SupportTicket>>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<SupportService>>();
        _smtpOptions = Options.Create(new SmtpSettings
        {
            SupportRecipientEmail = "verkkutech@gmail.com"
        });

        _ticketRepoMock.Setup(r => r.AddAsync(It.IsAny<SupportTicket>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SupportTicket t, CancellationToken _) => t);

        _emailServiceMock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _service = new SupportService(
            _ticketRepoMock.Object,
            _emailServiceMock.Object,
            _smtpOptions,
            _loggerMock.Object);
    }

    [Fact]
    public async Task CreateTicketAsync_PersistsTicket_AndDispatchesEmailToVerkkuTech()
    {
        var dto = new CreateSupportTicketDto(
            Category: "system_error",
            Priority: "high",
            Subject: "Error en pago",
            Description: "No se guardó el abono",
            CurrentUrl: "/pedidos/123",
            ClientInfo: "Chrome 120"
        );

        var userContext = new SupportCurrentUserContext(
            UserId: "user-1",
            UserName: "Juan Perez",
            UserEmail: "juan@camihogar.com",
            UserRole: "Vendedor",
            StoreId: "store-1",
            StoreName: "Guatire"
        );

        var result = await _service.CreateTicketAsync(dto, userContext);

        Assert.NotNull(result);
        Assert.StartsWith("TCK-", result.TicketCode);
        Assert.True(result.EmailSent);
        _ticketRepoMock.Verify(r => r.AddAsync(It.Is<SupportTicket>(t =>
            t.Subject == dto.Subject &&
            t.UserId == userContext.UserId &&
            t.StoreName == "Guatire"
        ), It.IsAny<CancellationToken>()), Times.Once);

        _emailServiceMock.Verify(e => e.SendEmailAsync(
            "verkkutech@gmail.com",
            It.Is<string>(s => s.Contains(dto.Subject)),
            It.Is<string>(b => b.Contains("Juan Perez") && b.Contains(dto.Description)),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `dotnet test .\Ordina.Backend\tests\Ordina.Application.Tests\Ordina.Application.Tests.csproj --filter FullyQualifiedName~SupportServiceTests`
Expected: FAIL (types / service not implemented yet).

- [ ] **Step 5: Implement `SupportService.cs`**

```csharp
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Ordina.Application.Common;
using Ordina.Domain.Support;
using Ordina.Infrastructure.Email;

namespace Ordina.Application.Support;

public class SupportService : ISupportService
{
    private readonly IRepository<SupportTicket> _ticketRepository;
    private readonly IEmailService _emailService;
    private readonly SmtpSettings _smtpSettings;
    private readonly ILogger<SupportService> _logger;

    public SupportService(
        IRepository<SupportTicket> ticketRepository,
        IEmailService emailService,
        IOptions<SmtpSettings> smtpSettings,
        ILogger<SupportService> logger)
    {
        _ticketRepository = ticketRepository;
        _emailService = emailService;
        _smtpSettings = smtpSettings.Value;
        _logger = logger;
    }

    public async Task<SupportTicketResponseDto> CreateTicketAsync(CreateSupportTicketDto dto, SupportCurrentUserContext userContext, CancellationToken cancellationToken = default)
    {
        var randomSuffix = Path.GetRandomFileName().Replace(".", "").Substring(0, 4).ToUpperInvariant();
        var ticketCode = $"TCK-{DateTime.UtcNow:yyMMdd}-{randomSuffix}";

        var ticket = new SupportTicket
        {
            TicketCode = ticketCode,
            UserId = userContext.UserId,
            UserName = userContext.UserName,
            UserEmail = userContext.UserEmail,
            UserRole = userContext.UserRole,
            StoreId = userContext.StoreId,
            StoreName = userContext.StoreName,
            Category = dto.Category,
            Priority = dto.Priority,
            Subject = dto.Subject.Trim(),
            Description = dto.Description.Trim(),
            CurrentUrl = dto.CurrentUrl,
            ClientInfo = dto.ClientInfo,
            Status = "Open",
            CreatedAt = DateTime.UtcNow
        };

        // 1. Persistir primero en MongoDB
        await _ticketRepository.AddAsync(ticket, cancellationToken);

        // 2. Formatear y despachar correo hacia verkkutech@gmail.com
        var recipient = string.IsNullOrWhiteSpace(_smtpSettings.SupportRecipientEmail)
            ? "verkkutech@gmail.com"
            : _smtpSettings.SupportRecipientEmail;

        var emailSubject = $"[SOPORTE ORDINA] [{ticket.Priority.ToUpperInvariant()}] {ticket.TicketCode}: {ticket.Subject}";
        var emailHtml = BuildEmailHtml(ticket);

        try
        {
            var emailSuccess = await _emailService.SendEmailAsync(recipient, emailSubject, emailHtml, cancellationToken);
            ticket.EmailSent = emailSuccess;
            ticket.EmailSentAt = emailSuccess ? DateTime.UtcNow : null;
            if (emailSuccess)
            {
                await _ticketRepository.UpdateAsync(ticket, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dispatching support email for ticket {TicketCode}: {Message}", ticket.TicketCode, ex.Message);
            ticket.EmailSent = false;
            ticket.EmailError = ex.Message;
        }

        return new SupportTicketResponseDto(
            Id: ticket.Id,
            TicketCode: ticket.TicketCode,
            Status: ticket.Status,
            EmailSent: ticket.EmailSent,
            Message: "Ticket de soporte creado y registrado exitosamente."
        );
    }

    private static string BuildEmailHtml(SupportTicket ticket)
    {
        var priorityColor = ticket.Priority.ToLowerInvariant() switch
        {
            "critical" => "#dc2626",
            "high" => "#ea580c",
            "low" => "#16a34a",
            _ => "#2563eb"
        };

        var sb = new StringBuilder();
        sb.Append("<div style='font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;'>");
        sb.Append("<div style='background: #0f172a; color: #ffffff; padding: 20px;'>");
        sb.Append($"<h2 style='margin: 0; font-size: 20px;'>Nuevo Reporte de Soporte Técnico - {ticket.TicketCode}</h2>");
        sb.Append($"<span style='display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 4px; background: {priorityColor}; font-weight: bold; font-size: 12px; color: #ffffff;'>PRIORIDAD: {ticket.Priority.ToUpperInvariant()}</span>");
        sb.Append($"<span style='display: inline-block; margin-left: 8px; margin-top: 8px; padding: 4px 10px; border-radius: 4px; background: #334155; font-size: 12px; color: #ffffff;'>CATEGORÍA: {ticket.Category}</span>");
        sb.Append("</div>");

        sb.Append("<div style='padding: 24px; color: #1e293b; line-height: 1.6;'>");
        sb.Append($"<h3 style='margin-top: 0; color: #0f172a;'>Asunto: {WebUtility.HtmlEncode(ticket.Subject)}</h3>");
        
        sb.Append("<div style='background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;'>");
        sb.Append("<h4 style='margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b;'>Descripción de la Incidencia</h4>");
        sb.Append($"<p style='margin: 0; white-space: pre-wrap; font-size: 14px;'>{WebUtility.HtmlEncode(ticket.Description)}</p>");
        sb.Append("</div>");

        sb.Append("<h4 style='margin: 20px 0 8px 0; font-size: 13px; text-transform: uppercase; color: #64748b;'>Información del Solicitante</h4>");
        sb.Append("<table style='width: 100%; border-collapse: collapse; font-size: 13px;'>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b; width: 120px;'><strong>Usuario:</strong></td><td>{WebUtility.HtmlEncode(ticket.UserName)} ({WebUtility.HtmlEncode(ticket.UserEmail)})</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Rol:</strong></td><td>{WebUtility.HtmlEncode(ticket.UserRole)}</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Sucursal:</strong></td><td>{WebUtility.HtmlEncode(ticket.StoreName ?? "N/A")}</td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Ruta / Pantalla:</strong></td><td><code>{WebUtility.HtmlEncode(ticket.CurrentUrl)}</code></td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Dispositivo:</strong></td><td><small>{WebUtility.HtmlEncode(ticket.ClientInfo ?? "N/A")}</small></td></tr>");
        sb.Append($"<tr><td style='padding: 4px 0; color: #64748b;'><strong>Fecha y Hora:</strong></td><td>{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC</td></tr>");
        sb.Append("</table>");

        sb.Append("</div>");
        sb.Append("<div style='background: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 11px; color: #64748b;'>");
        sb.Append("Generado automáticamente desde Ordina ERP CamiHogar");
        sb.Append("</div></div>");

        return sb.ToString();
    }
}
```

- [ ] **Step 6: Register `ISupportService` in `ApplicationServiceExtensions.cs`**

```csharp
services.AddScoped<ISupportService, SupportService>();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `dotnet test .\Ordina.Backend\tests\Ordina.Application.Tests\Ordina.Application.Tests.csproj --filter FullyQualifiedName~SupportServiceTests`
Expected: PASS (1 passed).

- [ ] **Step 8: Commit Task 3**

```bash
git add Ordina.Backend/src/Application/Support/ Ordina.Backend/src/Application/ApplicationServiceExtensions.cs Ordina.Backend/tests/Ordina.Application.Tests/SupportServiceTests.cs
git commit -m "feat(support): implement ISupportService, SupportService and unit tests"
```

---

### Task 4: API Controller `SupportController`

**Files:**
- Create: `Ordina.Backend/src/Api/Controllers/SupportController.cs`

**Interfaces:**
- Produces: `POST /api/support/tickets` (requires authorization)

- [ ] **Step 1: Create `SupportController`**

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Support;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SupportController : ControllerBase
{
    private readonly ISupportService _supportService;

    public SupportController(ISupportService supportService)
    {
        _supportService = supportService;
    }

    [HttpPost("tickets")]
    public async Task<IActionResult> CreateTicket([FromBody] CreateSupportTicketDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { message = "El asunto y la descripción son requeridos." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? "Usuario";
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? "";
        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
        var storeId = User.FindFirstValue("storeId");
        var storeName = User.FindFirstValue("storeName");

        var userContext = new SupportCurrentUserContext(
            UserId: userId,
            UserName: userName,
            UserEmail: userEmail,
            UserRole: userRole,
            StoreId: storeId,
            StoreName: storeName
        );

        var result = await _supportService.CreateTicketAsync(request, userContext, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
```

- [ ] **Step 2: Verify build**

Run: `dotnet build .\Ordina.Backend\src\Api\Ordina.Api.csproj`
Expected: Build succeeded with 0 errors.

- [ ] **Step 3: Commit Task 4**

```bash
git add Ordina.Backend/src/Api/Controllers/SupportController.cs
git commit -m "feat(api): add SupportController with POST /api/support/tickets endpoint"
```

---

### Task 5: Frontend API Client Support

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client-dtos.ts`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`

**Interfaces:**
- Produces: `apiClient.createSupportTicket(dto: CreateSupportTicketDto): Promise<SupportTicketResponseDto>`

- [ ] **Step 1: Add DTOs to `api-client-dtos.ts`**

```typescript
export interface CreateSupportTicketDto {
  category: string
  priority: string
  subject: string
  description: string
  currentUrl: string
  clientInfo?: string
}

export interface SupportTicketResponseDto {
  id: string
  ticketCode: string
  status: string
  emailSent: boolean
  message: string
}
```

- [ ] **Step 2: Add method to `apiClient` in `api-client.ts`**

```typescript
  async createSupportTicket(dto: CreateSupportTicketDto): Promise<SupportTicketResponseDto> {
    return this.fetchWithAuth('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  }
```

- [ ] **Step 3: Verify frontend type check / lint**

Run: `bun run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 4: Commit Task 5**

```bash
git add Ordina.Frontend/src/lib/api-client-dtos.ts Ordina.Frontend/src/lib/api-client.ts
git commit -m "feat(api-client): add support ticket DTOs and createSupportTicket method"
```

---

### Task 6: Frontend Dialog Component `SupportTicketDialog`

**Files:**
- Create: `Ordina.Frontend/src/components/support/support-ticket-dialog.tsx`

**Interfaces:**
- Produces: `<SupportTicketDialog open={open} onOpenChange={setOpen} />`

- [ ] **Step 1: Implement `SupportTicketDialog`**

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'

interface SupportTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupportTicketDialog({ open, onOpenChange }: SupportTicketDialogProps) {
  const { user } = useAuthStore()
  const [category, setCategory] = useState('system_error')
  const [priority, setPriority] = useState('medium')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast.error('Por favor escribe un asunto breve')
      return
    }

    if (!description.trim()) {
      toast.error('Por favor detalla la descripción del problema')
      return
    }

    setIsSubmitting(true)
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''
      const clientInfo = typeof window !== 'undefined' 
        ? `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})` 
        : ''

      const response = await apiClient.createSupportTicket({
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        currentUrl,
        clientInfo,
      })

      toast.success(`Ticket #${response.ticketCode} creado con éxito`, {
        description: 'El equipo de soporte técnico (verkkutech@gmail.com) ha sido notificado.',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      })

      // Reset
      setSubject('')
      setDescription('')
      setCategory('system_error')
      setPriority('medium')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('No se pudo enviar el reporte', {
        description: err?.message || 'Ocurrió un error inesperado al registrar el ticket.',
        icon: <AlertCircle className="w-5 h-5 text-destructive" />
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Reportar un Problema / Soporte
            </DialogTitle>
            <DialogDescription>
              Describe la incidencia o duda técnica. Se enviará a soporte con el contexto de tu sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Context Badge */}
            <div className="p-2.5 rounded-lg bg-muted/60 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border border-border">
              <span><strong>Usuario:</strong> {user?.name || user?.email || 'N/A'}</span>
              <span><strong>Rol:</strong> {user?.role || 'N/A'}</span>
              <span className="truncate max-w-[200px]" title={typeof window !== 'undefined' ? window.location.pathname : ''}>
                <strong>Pantalla:</strong> {typeof window !== 'undefined' ? window.location.pathname : '/'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-medium">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="h-9">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_error">Error de Sistema</SelectItem>
                    <SelectItem value="data">Datos o Inventario</SelectItem>
                    <SelectItem value="performance">Lentitud / Rendimiento</SelectItem>
                    <SelectItem value="question">Duda Operativa</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-medium">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" className="h-9">
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica / Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs font-medium">Asunto breve *</Label>
              <Input
                id="subject"
                placeholder="Ej. Error al guardar pedido #1042"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">Descripción detallada *</Label>
              <Textarea
                id="description"
                placeholder="Indica qué intentabas hacer, los pasos para reproducirlo o el mensaje de error observado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Reporte
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify component lint**

Run: `bun run lint` in `Ordina.Frontend`
Expected: 0 errors.

- [ ] **Step 3: Commit Task 6**

```bash
git add Ordina.Frontend/src/components/support/support-ticket-dialog.tsx
git commit -m "feat(support): add SupportTicketDialog modal component"
```

---

### Task 7: Integrate Help Dropdown in Sidebar

**Files:**
- Modify: `Ordina.Frontend/src/components/layout/sidebar.tsx`

**Interfaces:**
- Replaces static `<Button title="Ayuda">` with a `DropdownMenu` containing "Reportar un problema" and "Ventas no concretadas (Próximamente)".

- [ ] **Step 1: Add Dropdown and Dialog State to `sidebar.tsx`**

1. Import `SupportTicketDialog`:
   ```tsx
   import { SupportTicketDialog } from '@/components/support/support-ticket-dialog'
   ```
2. Import Lucide icons if not already present: `LifeBuoy`, `TrendingDown`.
3. Add state:
   ```tsx
   const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false)
   ```
4. Replace the static help button (lines ~749-757) with:
```tsx
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    title="Centro de Ayuda y Soporte"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span className="sr-only">Ayuda</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" className="w-56 z-[9999] mb-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Centro de Ayuda
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => setIsSupportDialogOpen(true)}
                  >
                    <LifeBuoy className="w-4 h-4 text-primary" />
                    <span>Reportar un problema</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled
                    className="gap-2 opacity-60 cursor-not-allowed"
                  >
                    <TrendingDown className="w-4 h-4 text-muted-foreground" />
                    <div className="flex items-center justify-between flex-1">
                      <span>Ventas no concretadas</span>
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">Próx.</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
```
5. Add `<SupportTicketDialog open={isSupportDialogOpen} onOpenChange={setIsSupportDialogOpen} />` before the closing tag of the component.

- [ ] **Step 2: Verify frontend build & lint**

Run: `bun run lint` in `Ordina.Frontend`
Expected: 0 errors.

Run: `bun run build` in `Ordina.Frontend`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit Task 7**

```bash
git add Ordina.Frontend/src/components/layout/sidebar.tsx
git commit -m "feat(sidebar): replace static help button with dropdown menu and integrate support dialog"
```

---

### Task 8: Full End-to-End Build & Test Verification

**Files:**
- None (verification task)

- [ ] **Step 1: Run Backend Tests**

Run: `dotnet test .\Ordina.Backend\tests\Ordina.Application.Tests\Ordina.Application.Tests.csproj --filter FullyQualifiedName~SupportServiceTests`
Expected: PASS (1 passed).

- [ ] **Step 2: Build Entire Backend Solution**

Run: `dotnet build .\Ordina.Backend\Ordina.Backend.sln`
Expected: Build succeeded with 0 errors.

- [ ] **Step 3: Build Entire Frontend**

Run: `bun run build` in `Ordina.Frontend`
Expected: Vite build completes cleanly.
