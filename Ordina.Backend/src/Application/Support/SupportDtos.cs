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
