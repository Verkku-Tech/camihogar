namespace Ordina.Application.Stores;

public record StoreResponseDto(
    string Id,
    string Name,
    string Code,
    string Address,
    string Phone,
    string Email,
    string Rif,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateStoreDto(
    string Name,
    string Code,
    string Address,
    string Phone,
    string Email,
    string Rif,
    string Status = "active");

public record UpdateStoreDto(
    string? Name = null,
    string? Code = null,
    string? Address = null,
    string? Phone = null,
    string? Email = null,
    string? Rif = null,
    string? Status = null);

public record AccountResponseDto(
    string Id,
    string Code,
    string Label,
    string StoreId,
    bool IsForeign,
    string AccountType,
    string? Email,
    string? Wallet,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateAccountDto(
    string Code,
    string Label,
    string StoreId,
    bool IsForeign,
    string AccountType,
    string? Email = null,
    string? Wallet = null,
    bool IsActive = true);

public record UpdateAccountDto(
    string? Code = null,
    string? Label = null,
    string? StoreId = null,
    bool? IsForeign = null,
    string? AccountType = null,
    string? Email = null,
    string? Wallet = null,
    bool? IsActive = null);
