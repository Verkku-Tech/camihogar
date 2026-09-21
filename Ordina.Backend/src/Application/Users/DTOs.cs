namespace Ordina.Application.Users;

public record UserResponseDto(
    string Id,
    string Username,
    string Email,
    string Name,
    string Role,
    string Status,
    DateTime? CreatedAt,
    string CommissionExclusivityMode,
    decimal BaseSalary,
    string BaseSalaryCurrency,
    string? StoreId,
    string? StoreName,
    IReadOnlyList<string> ExtraPermissions,
    string? AvatarUrl = null);

public record CreateUserDto(
    string Username,
    string Email,
    string Name,
    string Role,
    string Status = "active",
    string? Password = null,
    string? StoreId = null,
    string? StoreName = null,
    decimal BaseSalary = 0,
    string BaseSalaryCurrency = "USD",
    string CommissionExclusivityMode = "shared",
    IReadOnlyList<string>? ExtraPermissions = null,
    string? AvatarUrl = null);

public record UpdateUserDto(
    string? Name = null,
    string? Email = null,
    string? Role = null,
    string? Status = null,
    string? StoreId = null,
    string? StoreName = null,
    decimal? BaseSalary = null,
    string? BaseSalaryCurrency = null,
    string? CommissionExclusivityMode = null,
    IReadOnlyList<string>? ExtraPermissions = null,
    string? AvatarUrl = null);

public record RegeneratePasswordResponseDto(string TemporaryPassword);

public record RoleResponseDto(
    string Id,
    string Name,
    string? Description,
    IReadOnlyList<string> Permissions,
    bool IsSystem,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateRoleDto(
    string Name,
    string? Description,
    IReadOnlyList<string> Permissions);

public record UpdateRoleDto(
    string? Description,
    IReadOnlyList<string>? Permissions);
