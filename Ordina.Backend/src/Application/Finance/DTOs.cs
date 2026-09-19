namespace Ordina.Application.Finance;

public record PaymentResponseDto(
    string Id,
    string OrderId,
    decimal Amount,
    string Currency,
    string Status,
    string? TransactionId,
    string PaymentMethodId,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreatePaymentDto(
    string OrderId,
    decimal Amount,
    string PaymentMethodId,
    string Currency = "USD",
    string? TransactionId = null,
    string Status = "Pending");

public record ExchangeRateResponseDto(
    string Id,
    string FromCurrency,
    string ToCurrency,
    decimal Rate,
    DateTime EffectiveDate,
    bool IsActive,
    DateTime CreatedAt);

public record SetExchangeRateDto(
    string FromCurrency,
    string ToCurrency,
    decimal Rate,
    DateTime? EffectiveDate = null);

public record CommissionResponseDto(
    string Id,
    string CommissionType,
    string? Role,
    string? UserId,
    string? UserName,
    string CommissionKind,
    decimal Value,
    string Currency,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateCommissionDto(
    string CommissionType,
    string CommissionKind,
    decimal Value,
    string Currency = "USD",
    string? Role = null,
    string? UserId = null,
    string? UserName = null);

public record SaleTypeCommissionRuleDto(
    string Id,
    string SaleType,
    string SaleTypeLabel,
    decimal FamilyCommissionUsdPerUnit,
    decimal VendorRate,
    decimal ReferrerRate,
    decimal PostventaRate);
