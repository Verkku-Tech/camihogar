using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Domain.Enums;
using Ordina.Domain.Finance;

namespace Ordina.Application.Finance;

public class PaymentService : IPaymentService
{
    private readonly IRepository<Payment> _paymentRepository;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(IRepository<Payment> paymentRepository, ILogger<PaymentService> logger)
    {
        _paymentRepository = paymentRepository;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PaymentResponseDto>> GetByOrderIdAsync(string orderId, CancellationToken cancellationToken = default)
    {
        var payments = await _paymentRepository.FindAsync(p => p.OrderId == orderId, cancellationToken);
        return payments.Select(MapToDto).ToList();
    }

    public async Task<PaymentResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var payment = await _paymentRepository.GetByIdAsync(id, cancellationToken);
        return payment != null ? MapToDto(payment) : null;
    }

    public async Task<PaymentResponseDto> CreatePaymentAsync(CreatePaymentDto createDto, CancellationToken cancellationToken = default)
    {
        var payment = new Payment
        {
            OrderId = createDto.OrderId,
            Amount = createDto.Amount,
            Currency = createDto.Currency,
            StatusString = createDto.Status,
            TransactionId = createDto.TransactionId,
            PaymentMethodId = createDto.PaymentMethodId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _paymentRepository.AddAsync(payment, cancellationToken);
        _logger.LogInformation("Pago registrado para pedido {OrderId}: {Amount} {Currency}", created.OrderId, created.Amount, created.Currency);
        return MapToDto(created);
    }

    public async Task<bool> UpdatePaymentStatusAsync(string id, string status, CancellationToken cancellationToken = default)
    {
        var payment = await _paymentRepository.GetByIdAsync(id, cancellationToken);
        if (payment == null) return false;

        payment.StatusString = status;
        payment.UpdatedAt = DateTime.UtcNow;
        return await _paymentRepository.UpdateAsync(payment, cancellationToken);
    }

    private static PaymentResponseDto MapToDto(Payment p) => new(
        p.Id,
        p.OrderId,
        p.Amount,
        p.Currency,
        p.StatusString,
        p.TransactionId,
        p.PaymentMethodId,
        p.CreatedAt,
        p.UpdatedAt);
}

public class ExchangeRateService : IExchangeRateService
{
    private readonly IExchangeRateRepository _rateRepository;
    private readonly ICacheService _cacheService;
    private readonly ILogger<ExchangeRateService> _logger;
    private readonly INotificationService? _notificationService;

    public ExchangeRateService(
        IExchangeRateRepository rateRepository,
        ICacheService cacheService,
        ILogger<ExchangeRateService> logger,
        INotificationService? notificationService = null)
    {
        _rateRepository = rateRepository;
        _cacheService = cacheService;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<ExchangeRateResponseDto?> GetLatestRateAsync(string fromCurrency = "Bs", string toCurrency = "USD", CancellationToken cancellationToken = default)
    {
        var cached = await _cacheService.GetAsync<ExchangeRateResponseDto>(CacheKeys.ExchangeRates, cancellationToken);
        if (cached != null && cached.FromCurrency == fromCurrency && cached.ToCurrency == toCurrency)
        {
            return cached;
        }

        var rate = await _rateRepository.GetLatestRateAsync(fromCurrency, toCurrency, cancellationToken);
        if (rate == null) return null;

        var dto = MapToDto(rate);
        await _cacheService.SetAsync(CacheKeys.ExchangeRates, dto, absoluteExpiration: CacheTtl.ExchangeRateAbsolute, cancellationToken: cancellationToken);
        return dto;
    }

    public async Task<IReadOnlyList<ExchangeRateResponseDto>> GetActiveRatesAsync(CancellationToken cancellationToken = default)
    {
        var rates = await _rateRepository.GetActiveRatesAsync(cancellationToken);
        return rates.Select(MapToDto).ToList();
    }

    public async Task<IReadOnlyList<ExchangeRateResponseDto>> GetRateHistoryAsync(CancellationToken cancellationToken = default)
    {
        var rates = await _rateRepository.GetAllAsync(cancellationToken);
        return rates.OrderByDescending(r => r.EffectiveDate).Select(MapToDto).ToList();
    }

    public async Task<ExchangeRateResponseDto> SetRateAsync(SetExchangeRateDto setDto, CancellationToken cancellationToken = default)
    {
        // Desactivar tasas previas para este par de divisas (ej: Bs a USD)
        await _rateRepository.DeactivatePreviousRatesAsync(setDto.FromCurrency, setDto.ToCurrency, cancellationToken);

        var rate = new ExchangeRate
        {
            FromCurrency = setDto.FromCurrency,
            ToCurrency = setDto.ToCurrency,
            Rate = setDto.Rate,
            EffectiveDate = setDto.EffectiveDate ?? DateTime.UtcNow,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _rateRepository.AddAsync(rate, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.ExchangeRates, cancellationToken);

        _logger.LogInformation("Nueva tasa de cambio establecida: 1 {From} = {Rate} {To}", created.FromCurrency, created.Rate, created.ToCurrency);

        if (_notificationService != null)
        {
            try
            {
                await _notificationService.PublishAsync(new CreateNotificationDto(
                    Type: "ExchangeRateChanged",
                    Title: "Tasa de cambio actualizada",
                    Message: $"La tasa de {created.FromCurrency}/{created.ToCurrency} se ha actualizado a {created.Rate:N2}.",
                    Severity: "info",
                    Link: "/configuracion/tasas"), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al emitir notificación de cambio de tasa");
            }
        }

        return MapToDto(created);
    }

    private static ExchangeRateResponseDto MapToDto(ExchangeRate r) => new(
        r.Id,
        r.FromCurrency,
        r.ToCurrency,
        r.Rate,
        r.EffectiveDate,
        r.IsActive,
        r.CreatedAt);
}

public class CommissionService : ICommissionService
{
    private readonly IRepository<Commission> _commissionRepository;
    private readonly IRepository<SaleTypeCommissionRule> _ruleRepository;

    public CommissionService(
        IRepository<Commission> commissionRepository,
        IRepository<SaleTypeCommissionRule> ruleRepository)
    {
        _commissionRepository = commissionRepository;
        _ruleRepository = ruleRepository;
    }

    public async Task<IReadOnlyList<CommissionResponseDto>> GetAllCommissionsAsync(CancellationToken cancellationToken = default)
    {
        var commissions = await _commissionRepository.GetAllAsync(cancellationToken);
        return commissions.Select(c => new CommissionResponseDto(
            c.Id,
            c.CommissionType,
            c.Role,
            c.UserId,
            c.UserName,
            c.CommissionKind,
            c.Value,
            c.Currency,
            c.CreatedAt,
            c.UpdatedAt)).ToList();
    }

    public async Task<CommissionResponseDto> CreateCommissionAsync(CreateCommissionDto createDto, CancellationToken cancellationToken = default)
    {
        var commission = new Commission
        {
            CommissionType = createDto.CommissionType,
            Role = createDto.Role,
            UserId = createDto.UserId,
            UserName = createDto.UserName,
            CommissionKind = createDto.CommissionKind,
            Value = createDto.Value,
            Currency = createDto.Currency,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _commissionRepository.AddAsync(commission, cancellationToken);
        return new CommissionResponseDto(
            created.Id,
            created.CommissionType,
            created.Role,
            created.UserId,
            created.UserName,
            created.CommissionKind,
            created.Value,
            created.Currency,
            created.CreatedAt,
            created.UpdatedAt);
    }

    public async Task<IReadOnlyList<SaleTypeCommissionRuleDto>> GetSaleTypeRulesAsync(CancellationToken cancellationToken = default)
    {
        var rules = await _ruleRepository.GetAllAsync(cancellationToken);
        return rules.Select(r => new SaleTypeCommissionRuleDto(
            r.Id,
            r.SaleType,
            r.SaleTypeLabel,
            r.FamilyCommissionUsdPerUnit,
            r.VendorRate,
            r.ReferrerRate,
            r.PostventaRate)).ToList();
    }
}
