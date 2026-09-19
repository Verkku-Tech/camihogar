namespace Ordina.Domain.Enums;

public enum UserStatus
{
    Active,
    Inactive
}

public static class UserStatusExtensions
{
    public static string ToDbString(this UserStatus status) => status == UserStatus.Active ? "active" : "inactive";

    public static UserStatus ParseUserStatus(string? value) =>
        string.Equals(value?.Trim(), "inactive", StringComparison.OrdinalIgnoreCase)
            ? UserStatus.Inactive
            : UserStatus.Active;
}
