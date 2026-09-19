using Ordina.Application.Common;

namespace Ordina.Application.Finance;

public interface IPaymentService
{
    Task<IReadOnlyList<PaymentResponseDto>> GetByOrderIdAsync(string orderId, CancellationToken cancellationToken = default);
    Task<PaymentResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<PaymentResponseDto> CreatePaymentAsync(CreatePaymentDto createDto, CancellationToken cancellationToken = default);
    Task<bool> UpdatePaymentStatusAsync(string id, string status, CancellationToken cancellationToken = default);
}

public interface IExchangeRateService
{
    Task<ExchangeRateResponseDto?> GetLatestRateAsync(string fromCurrency = "Bs", string toCurrency = "USD", CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExchangeRateResponseDto>> GetRateHistoryAsync(CancellationToken cancellationToken = default);
    Task<ExchangeRateResponseDto> SetRateAsync(SetExchangeRateDto setDto, CancellationToken cancellationToken = default);
}

public interface ICommissionService
{
    Task<IReadOnlyList<CommissionResponseDto>> GetAllCommissionsAsync(CancellationToken cancellationToken = default);
    Task<CommissionResponseDto> CreateCommissionAsync(CreateCommissionDto createDto, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SaleTypeCommissionRuleDto>> GetSaleTypeRulesAsync(CancellationToken cancellationToken = default);
}
