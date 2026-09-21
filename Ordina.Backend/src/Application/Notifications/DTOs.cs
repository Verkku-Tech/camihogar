namespace Ordina.Application.Notifications;

public record NotificationDto(
    string Id,
    string Type,
    string Title,
    string Message,
    string Severity,
    string? Link,
    string? TargetUserId,
    List<string> TargetRoles,
    bool IsRead,
    DateTime CreatedAt,
    Dictionary<string, object>? Metadata);

public record CreateNotificationDto(
    string Type,
    string Title,
    string Message,
    string Severity = "info",
    string? Link = null,
    string? TargetUserId = null,
    List<string>? TargetRoles = null,
    Dictionary<string, object>? Metadata = null);
