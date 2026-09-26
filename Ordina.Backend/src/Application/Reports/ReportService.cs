using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Commissions;
using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Manufacturing;
using Ordina.Domain.Orders;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;

namespace Ordina.Application.Reports;

public interface IReportService
{
    Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        string? storeId = null,
        string? sellerType = null,
        string? referrerId = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentReportRowDto>> GetPaymentsReportDataAsync(DateTime? startDate = null, DateTime? endDate = null, string? paymentMethod = null, string? accountId = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateCommissionsReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        string? storeId = null,
        string? sellerType = null,
        string? referrerId = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CommissionReferrerOptionDto>> GetCommissionReferrersInRangeAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);
    Task<byte[]> GeneratePaymentsReportExcelAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<byte[]> GeneratePaymentsReportExcelAsync(DateTime? startDate = null, DateTime? endDate = null, string? paymentMethod = null, string? accountId = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateDispatchReportExcelAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateManufacturingReportExcelAsync(DateTime? from = null, DateTime? to = null, string? status = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateExpiredLayawaysReportExcelAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ManufacturingReportPreviewDto>> GetManufacturingPreviewAsync(DateTime? from = null, DateTime? to = null, string? status = null, string? manufacturerId = null, string? orderNumber = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DispatchReportPreviewDto>> GetDispatchPreviewAsync(DateTime? from = null, DateTime? to = null, string? deliveryZone = null, string? location = null, CancellationToken cancellationToken = default);
}

public class ReportService : IReportService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IProductRepository _productRepository;
    private readonly IExchangeRateRepository _exchangeRateRepository;
    private readonly IRepository<ManufacturingOrder>? _mfgOrderRepository;
    private readonly IRepository<Account>? _accountRepository;
    private readonly IRepository<ProductCommission>? _productCommissionRepository;
    private readonly IRepository<SaleTypeCommissionRule>? _saleTypeCommissionRuleRepository;
    private readonly IUserRepository? _userRepository;
    private readonly IRepository<Category>? _categoryRepository;
    private readonly ILogger<ReportService>? _logger;

    public ReportService(
        IOrderRepository orderRepository,
        IClientRepository clientRepository,
        IProductRepository productRepository,
        IExchangeRateRepository exchangeRateRepository,
        IRepository<ManufacturingOrder>? mfgOrderRepository = null,
        IRepository<Account>? accountRepository = null,
        IRepository<ProductCommission>? productCommissionRepository = null,
        IRepository<SaleTypeCommissionRule>? saleTypeCommissionRuleRepository = null,
        IUserRepository? userRepository = null,
        IRepository<Category>? categoryRepository = null,
        ILogger<ReportService>? logger = null)
    {
        _orderRepository = orderRepository;
        _clientRepository = clientRepository;
        _productRepository = productRepository;
        _exchangeRateRepository = exchangeRateRepository;
        _mfgOrderRepository = mfgOrderRepository;
        _accountRepository = accountRepository;
        _productCommissionRepository = productCommissionRepository;
        _saleTypeCommissionRuleRepository = saleTypeCommissionRuleRepository;
        _userRepository = userRepository;
        _categoryRepository = categoryRepository;
        _logger = logger;
    }


    public async Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        string? storeId = null,
        string? sellerType = null,
        string? referrerId = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetFilteredCommissionsDataAsync(from, to, vendorId, storeId, sellerType, referrerId, cancellationToken);
        return data.OrderByDescending(r => r.Fecha).ThenBy(r => r.Cliente).ToList();
    }

    public async Task<IReadOnlyList<CommissionReferrerOptionDto>> GetCommissionReferrersInRangeAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var rangeStart = startDate.HasValue ? DateTime.SpecifyKind(startDate.Value.Date, DateTimeKind.Utc) : DateTime.MinValue;
        var rangeEnd = endDate.HasValue ? DateTime.SpecifyKind(endDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc) : DateTime.MaxValue;

        var orders = await _orderRepository.FindAsync(
            o => o.CreatedAt >= rangeStart && o.CreatedAt <= rangeEnd,
            cancellationToken);

        return orders
            .Where(order =>
                !IsReservation(order)
                && !IsDeclinedOrCancelled(order)
                && !(IsPagoAEntregaCondition(order) && !HasRecordedPaymentsForCommission(order))
                && !string.IsNullOrWhiteSpace(order.ReferrerId))
            .GroupBy(order => order.ReferrerId!.Trim(), StringComparer.Ordinal)
            .Select(group =>
            {
                var first = group.First();
                var name = string.IsNullOrWhiteSpace(first.ReferrerName)
                    ? group.Key
                    : first.ReferrerName.Trim();
                return new CommissionReferrerOptionDto
                {
                    Id = group.Key,
                    Name = name
                };
            })
            .OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static readonly HashSet<string> ForeignCurrencyOnlyPaymentMethods = new(new[]
    {
        "AirTM",
        "Banesco Panamá",
        "Binance",
        "Facebank",
        "Mercantil Panamá",
        "Paypal",
        "Zelle",
    }, StringComparer.OrdinalIgnoreCase);

    private const string CasheaFinancedMethodLabel = "Cashea (financiación)";
    private const string NoAplicaCuentaFilterValue = "__no_aplica__";
    private const string NoAplicaCuentaDisplay = "N/A";

    public async Task<IReadOnlyList<PaymentReportRowDto>> GetPaymentsReportDataAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado" && o.StatusString != "Declinado",
            cancellationToken);

        IReadOnlyDictionary<string, Account> accountsById = new Dictionary<string, Account>(StringComparer.OrdinalIgnoreCase);
        Account? filterAccount = null;
        if (_accountRepository != null)
        {
            var accounts = await _accountRepository.GetAllAsync(cancellationToken);
            accountsById = accounts.ToDictionary(a => a.Id, a => a, StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(accountId) && !string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal))
            {
                accountsById.TryGetValue(accountId, out filterAccount);
            }
        }

        var reportData = new List<PaymentReportRowDto>();

        foreach (var order in orders)
        {
            if (string.Equals(order.StatusString, "Cancelado", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(order.StatusString, "Declinado", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (string.Equals(order.TypeString, "Budget", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(order.TypeString, "Reservation", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(order.TypeString, "PendingConfirmation", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var (activePayments, activePaymentType) = GetActivePaymentsForReport(order);
            if (activePayments.Count > 0)
            {
                for (int i = 0; i < activePayments.Count; i++)
                {
                    var payment = activePayments[i];
                    if (payment.PaymentDetails?.CasheaFinancedPortion == true ||
                        string.Equals(payment.Method, CasheaFinancedMethodLabel, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var paymentCalendarDate = PaymentCalendarDate.ToCalendarDate(payment.Date);
                    if (startDate.HasValue && paymentCalendarDate < DateOnly.FromDateTime(startDate.Value.Date))
                        continue;
                    if (endDate.HasValue && paymentCalendarDate > DateOnly.FromDateTime(endDate.Value.Date))
                        continue;

                    if (!string.IsNullOrWhiteSpace(paymentMethod) && !string.Equals(payment.Method, paymentMethod, StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (!string.IsNullOrWhiteSpace(accountId) && !string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal))
                    {
                        if (!PaymentMatchesAccountFilter(payment.PaymentDetails, accountId, filterAccount))
                            continue;
                    }

                    var row = CreatePaymentReportRow(order, payment, payment.Date, activePaymentType, i, accountsById);
                    if (string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal) && row.Cuenta != NoAplicaCuentaDisplay)
                        continue;

                    reportData.Add(row);
                }
            }
            else if (!string.IsNullOrWhiteSpace(order.PaymentMethod))
            {
                var orderCalendarDate = PaymentCalendarDate.ToCalendarDate(order.CreatedAt);
                if (startDate.HasValue && orderCalendarDate < DateOnly.FromDateTime(startDate.Value.Date))
                    continue;
                if (endDate.HasValue && orderCalendarDate > DateOnly.FromDateTime(endDate.Value.Date))
                    continue;

                if (!string.IsNullOrWhiteSpace(paymentMethod) && !string.Equals(order.PaymentMethod, paymentMethod, StringComparison.OrdinalIgnoreCase))
                    continue;

                if (!string.IsNullOrWhiteSpace(accountId) && !string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal))
                {
                    if (!PaymentMatchesAccountFilter(order.PaymentDetails, accountId, filterAccount))
                        continue;
                }

                var row = CreateMainPaymentReportRow(order, accountsById);
                if (string.Equals(accountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal) && row.Cuenta != NoAplicaCuentaDisplay)
                    continue;

                reportData.Add(row);
            }
        }

        return reportData;
    }

    public async Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetPaymentsReportDataAsync(from, to, null, null, cancellationToken);
        return data.Select(r => new PaymentsDetailedReportRowDto(
            r.Pedido,
            DateTime.TryParse(r.Fecha, out var d) ? d : DateTime.UtcNow,
            r.Cliente,
            r.MontoOriginal,
            r.MetodoPago,
            r.Cuenta,
            r.Referencia,
            r.IsConciliated)).ToList();
    }

    public async Task<byte[]> GenerateCommissionsReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        string? storeId = null,
        string? sellerType = null,
        string? referrerId = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetCommissionReportAsync(from, to, vendorId, storeId, sellerType, referrerId, cancellationToken);
        var columns = new (string Header, Func<CommissionReportRowDto, object?> Selector)[]
        {
            ("Fecha", r => r.Fecha),
            ("Cliente", r => r.Cliente),
            ("Pedido", r => r.Pedido),
            ("Vendedor", r => r.Vendedor),
            ("Descripción", r => r.Descripcion),
            ("Cant. Artículos", r => r.CantidadArticulos),
            ("Tipo de venta", r => r.TipoVenta),
            ("Comisión familia USD/u", r => (double)(r.ComisionFamiliaUsdPorUnidad != 0m ? r.ComisionFamiliaUsdPorUnidad : r.TasaComisionBase)),
            ("Comisión Vendedor", r => (double)r.Comision),
            ("Total Comisión + Sueldo", r => (double)r.TotalComisionMasSueldo),
            ("Comisión Post venta", r => r.ComisionPostventa.HasValue ? (double)r.ComisionPostventa.Value : 0.0),
            ("Comisión Referido", r => r.ComisionSecundaria.HasValue ? (double)r.ComisionSecundaria.Value : 0.0)
        };

        return ExcelReportBuilder.CreateTable("Comisiones", data, columns);
    }

    public async Task<byte[]> GeneratePaymentsReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        return await GeneratePaymentsReportExcelAsync(from, to, null, null, cancellationToken);
    }

    public async Task<byte[]> GeneratePaymentsReportExcelAsync(
        DateTime? startDate = null,
        DateTime? endDate = null,
        string? paymentMethod = null,
        string? accountId = null,
        CancellationToken cancellationToken = default)
    {
        var data = await GetPaymentsReportDataAsync(startDate, endDate, paymentMethod, accountId, cancellationToken);
        var sorted = data
            .OrderByDescending(r => r.Fecha)
            .ThenBy(r => r.Pedido)
            .ToList();

        var columns = new (string Header, Func<PaymentReportRowDto, object?> Selector)[]
        {
            ("Fecha", r => r.Fecha),
            ("Pedido", r => r.Pedido),
            ("Cliente", r => r.Cliente),
            ("Método de Pago", r => r.MetodoPago),
            ("Monto", r => r.MontoOriginal),
            ("Moneda", r => r.MonedaOriginal),
            ("Monto en Bs", r => r.MontoBs.HasValue ? (object)r.MontoBs.Value : "—"),
            ("Equiv. USD (tasa cobro)", r => r.MontoUsd.HasValue ? (object)r.MontoUsd.Value : ""),
            ("Cuenta", r => r.Cuenta),
            ("Referencia/Remitente", r => r.Referencia),
            ("Conciliado", r => r.IsConciliated ? "Sí" : "No")
        };

        return ExcelReportBuilder.CreateTable("Pagos", sorted, columns);
    }

    private static PaymentReportRowDto CreatePaymentReportRow(
        Order order,
        PartialPayment payment,
        DateTime paymentDate,
        string paymentType,
        int paymentIndex,
        IReadOnlyDictionary<string, Account> accountsById)
    {
        var referencia = GetPaymentReference(payment.PaymentDetails, payment.Method);
        var cuentaRaw = GetAccountDisplay(payment.PaymentDetails, accountsById);

        var montoOriginal = payment.PaymentDetails?.OriginalAmount ??
                            payment.PaymentDetails?.CashReceived ??
                            payment.Amount;
        var monedaOriginal = payment.PaymentDetails?.OriginalCurrency ??
                             payment.PaymentDetails?.CashCurrency ??
                             "Bs";

        var montoBs = ComputeReportMontoBs(
            payment.Method,
            montoOriginal,
            monedaOriginal,
            payment.PaymentDetails?.ExchangeRate);

        return new PaymentReportRowDto
        {
            Fecha = PaymentCalendarDate.ToReportString(paymentDate),
            Pedido = order.OrderNumber,
            Cliente = order.ClientName,
            MetodoPago = payment.Method,
            MontoOriginal = montoOriginal,
            MonedaOriginal = monedaOriginal,
            MontoBs = montoBs,
            MontoUsd = GetMontoUsdForPaymentReportRow(order, payment.PaymentDetails, monedaOriginal, montoBs),
            Cuenta = ResolveReportCuentaDisplay(monedaOriginal, cuentaRaw),
            Referencia = referencia,
            OrderId = order.Id,
            PaymentType = paymentType,
            PaymentIndex = paymentIndex,
            IsConciliated = payment.PaymentDetails?.IsConciliated ?? false
        };
    }

    private static PaymentReportRowDto CreateMainPaymentReportRow(
        Order order,
        IReadOnlyDictionary<string, Account> accountsById)
    {
        var referencia = GetPaymentReference(order.PaymentDetails, order.PaymentMethod);
        var cuentaRaw = GetAccountDisplay(order.PaymentDetails, accountsById);

        var montoOriginal = order.PaymentDetails?.OriginalAmount ??
                            order.PaymentDetails?.CashReceived ??
                            order.Total;
        var monedaOriginal = order.PaymentDetails?.OriginalCurrency ??
                             order.PaymentDetails?.CashCurrency ??
                             "Bs";

        var montoBs = ComputeReportMontoBs(
            order.PaymentMethod,
            montoOriginal,
            monedaOriginal,
            order.PaymentDetails?.ExchangeRate);

        return new PaymentReportRowDto
        {
            Fecha = PaymentCalendarDate.ToReportString(order.CreatedAt),
            Pedido = order.OrderNumber,
            Cliente = order.ClientName,
            MetodoPago = order.PaymentMethod,
            MontoOriginal = montoOriginal,
            MonedaOriginal = monedaOriginal,
            MontoBs = montoBs,
            MontoUsd = GetMontoUsdForPaymentReportRow(order, order.PaymentDetails, monedaOriginal, montoBs),
            Cuenta = ResolveReportCuentaDisplay(monedaOriginal, cuentaRaw),
            Referencia = referencia,
            OrderId = order.Id,
            PaymentType = "main",
            PaymentIndex = -1,
            IsConciliated = order.PaymentDetails?.IsConciliated ?? false
        };
    }

    private static (List<PartialPayment> Payments, string PaymentType) GetActivePaymentsForReport(Order order)
    {
        if (order.PartialPayments != null && order.PartialPayments.Count > 0)
            return (order.PartialPayments, "partial");
        if (order.MixedPayments != null && order.MixedPayments.Count > 0)
            return (order.MixedPayments, "mixed");
        return (new List<PartialPayment>(), string.Empty);
    }

    private static bool IsBolivaresCurrency(string? monedaOriginal) =>
        string.Equals(monedaOriginal?.Trim(), "Bs", StringComparison.OrdinalIgnoreCase);

    private static bool ShouldOmitBsEquivalent(string paymentMethod, string? monedaOriginal)
    {
        if (IsBolivaresCurrency(monedaOriginal))
            return false;
        return ForeignCurrencyOnlyPaymentMethods.Contains(paymentMethod ?? string.Empty);
    }

    private static decimal? ComputeReportMontoBs(
        string paymentMethod,
        decimal montoOriginal,
        string monedaOriginal,
        decimal? exchangeRate)
    {
        if (IsBolivaresCurrency(monedaOriginal))
            return montoOriginal;
        if (ShouldOmitBsEquivalent(paymentMethod, monedaOriginal))
            return null;
        return montoOriginal * (exchangeRate ?? 1);
    }

    private static decimal? GetMontoUsdForPaymentReportRow(
        Order order,
        PaymentDetails? paymentDetails,
        string monedaOriginal,
        decimal? montoBs)
    {
        if (paymentDetails?.OriginalAmount is > 0 &&
            string.Equals(paymentDetails.OriginalCurrency?.Trim(), "USD", StringComparison.OrdinalIgnoreCase))
        {
            return Math.Round(paymentDetails.OriginalAmount.Value, 2, MidpointRounding.AwayFromZero);
        }

        if (!IsBolivaresCurrency(monedaOriginal))
            return null;

        if (!montoBs.HasValue)
            return null;

        if (paymentDetails?.ExchangeRate is > 0)
        {
            return Math.Round(
                montoBs.Value / paymentDetails.ExchangeRate.Value,
                2,
                MidpointRounding.AwayFromZero);
        }

        try
        {
            var orderRate = GetUsdExchangeRate(order);
            if (orderRate <= 0)
                return null;
            return Math.Round(montoBs.Value / orderRate, 2, MidpointRounding.AwayFromZero);
        }
        catch
        {
            return null;
        }
    }

    private static decimal GetUsdExchangeRate(Order order)
    {
        if (order.ExchangeRatesAtCreation?.Usd != null &&
            order.ExchangeRatesAtCreation.Usd.Rate > 0)
        {
            return order.ExchangeRatesAtCreation.Usd.Rate;
        }

        if (order.PaymentDetails?.ExchangeRate.HasValue == true &&
            order.PaymentDetails.ExchangeRate > 0)
        {
            return order.PaymentDetails.ExchangeRate.Value;
        }

        var (activeForRate, _) = GetActivePaymentsForReport(order);
        if (activeForRate.Count > 0)
        {
            var rate = activeForRate
                .FirstOrDefault(p => p.PaymentDetails?.ExchangeRate.HasValue == true &&
                                     p.PaymentDetails.ExchangeRate > 0)
                ?.PaymentDetails?.ExchangeRate;

            if (rate.HasValue && rate.Value > 0)
                return rate.Value;
        }

        return 0m;
    }

    private static bool PaymentMatchesAccountFilter(
        PaymentDetails? paymentDetails,
        string filterAccountId,
        Account? filterAccount)
    {
        if (string.IsNullOrWhiteSpace(filterAccountId) || string.Equals(filterAccountId, NoAplicaCuentaFilterValue, StringComparison.Ordinal))
            return true;

        if (paymentDetails == null)
            return false;

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountId) &&
            string.Equals(paymentDetails.AccountId, filterAccountId, StringComparison.Ordinal))
            return true;

        if (filterAccount == null)
            return false;

        if (PaymentTextMatchesAccountField(paymentDetails.Bank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.Bank, filterAccount.Code))
            return true;

        if (PaymentTextMatchesAccountField(paymentDetails.PagomovilBank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.PagomovilBank, filterAccount.Code) ||
            PaymentTextMatchesAccountField(paymentDetails.TransferenciaBank, filterAccount.Label) ||
            PaymentTextMatchesAccountField(paymentDetails.TransferenciaBank, filterAccount.Code))
            return true;

        if (!string.IsNullOrWhiteSpace(filterAccount.Email) &&
            PaymentTextMatchesAccountField(paymentDetails.Email, filterAccount.Email))
            return true;

        return false;
    }

    private static bool PaymentTextMatchesAccountField(string? paymentValue, string? accountField)
    {
        if (string.IsNullOrWhiteSpace(paymentValue) || string.IsNullOrWhiteSpace(accountField))
            return false;
        return string.Equals(
            paymentValue.Trim(),
            accountField.Trim(),
            StringComparison.OrdinalIgnoreCase);
    }

    private static string GetPaymentReference(PaymentDetails? paymentDetails, string paymentMethod)
    {
        if (paymentDetails == null) return string.Empty;

        if (string.Equals(paymentMethod, "Zelle", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(paymentDetails.Envia))
                return paymentDetails.Envia.Trim();
            if (!string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
                return paymentDetails.TransferenciaReference;
            return string.Empty;
        }

        if (string.Equals(paymentMethod, "Pago Móvil", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(paymentDetails.PagomovilReference))
        {
            return paymentDetails.PagomovilReference;
        }

        if (string.Equals(paymentMethod, "Transferencia", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(paymentDetails.TransferenciaReference))
        {
            return paymentDetails.TransferenciaReference;
        }

        return string.Empty;
    }

    private static string GetAccountDisplay(PaymentDetails? paymentDetails, IReadOnlyDictionary<string, Account> accountsById)
    {
        if (paymentDetails == null) return "-";

        if (!string.IsNullOrWhiteSpace(paymentDetails.Email))
        {
            return paymentDetails.Email;
        }

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountNumber) &&
            !string.IsNullOrWhiteSpace(paymentDetails.Bank))
        {
            var maskedNumber = MaskAccountNumber(paymentDetails.AccountNumber);
            return $"{maskedNumber} - {paymentDetails.Bank}";
        }

        if (!string.IsNullOrWhiteSpace(paymentDetails.AccountId) &&
            accountsById.TryGetValue(paymentDetails.AccountId, out var acc))
        {
            if (string.Equals(acc.AccountType, "Cuentas Digitales", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(acc.Email))
            {
                return acc.Email;
            }
            if (!string.IsNullOrWhiteSpace(acc.Label)) return acc.Label;
            if (!string.IsNullOrWhiteSpace(acc.Code)) return acc.Code;
        }

        if (!string.IsNullOrWhiteSpace(paymentDetails.Bank))
            return paymentDetails.Bank.Trim();

        return "-";
    }

    private static string MaskAccountNumber(string accountNumber)
    {
        if (string.IsNullOrWhiteSpace(accountNumber) || accountNumber.Length < 8)
            return accountNumber;

        var first4 = accountNumber.Substring(0, 4);
        var last4 = accountNumber.Substring(accountNumber.Length - 4);
        return $"{first4}****{last4}";
    }

    private static string ResolveReportCuentaDisplay(string monedaOriginal, string cuentaRaw)
    {
        var m = (monedaOriginal ?? string.Empty).Trim().ToUpperInvariant();
        bool isForeign = m is "USD" or "EUR";
        var c = (cuentaRaw ?? string.Empty).Trim();
        bool isEmpty = c.Length == 0 || c == "-";
        bool isNoAplica = string.Equals(c, "no aplica", StringComparison.OrdinalIgnoreCase);

        if (isForeign && (isEmpty || isNoAplica))
        {
            return NoAplicaCuentaDisplay;
        }

        return string.IsNullOrWhiteSpace(cuentaRaw) ? "-" : cuentaRaw;
    }

    public async Task<byte[]> GenerateDispatchReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();

        var columns = new (string Header, Func<Order, object?> Selector)[]
        {
            ("Pedido", o => o.OrderNumber),
            ("Fecha Creación", o => o.CreatedAt),
            ("Cliente", o => o.ClientName),
            ("Dirección Despacho", o => o.DeliveryAddress),
            ("Tiene Despacho", o => o.HasDelivery),
            ("Total ($)", o => o.Total),
            ("Estado Pedido", o => o.StatusString)
        };

        return ExcelReportBuilder.CreateTable("Despachos", orders, columns);
    }

    public async Task<byte[]> GenerateManufacturingReportExcelAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();

        var rows = new List<ManufacturingReportExportRow>();
        foreach (var order in orders)
        {
            foreach (var p in order.Products)
            {
                if (!string.IsNullOrWhiteSpace(status) && status != "all" && p.ManufacturingStatusString != status)
                    continue;

                rows.Add(new ManufacturingReportExportRow(
                    order.OrderNumber,
                    order.CreatedAt,
                    order.ClientName,
                    p.Name,
                    p.Quantity,
                    p.ManufacturingStatusString,
                    p.ManufacturingProviderName,
                    p.Observations));
            }
        }

        var columns = new (string Header, Func<ManufacturingReportExportRow, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.CreatedAt),
            ("Cliente", r => r.ClientName),
            ("Producto", r => r.ProductName),
            ("Cantidad", r => r.Quantity),
            ("Estado Fabricación", r => r.ManufacturingStatus),
            ("Proveedor", r => r.ProviderName),
            ("Observaciones", r => r.Observations)
        };

        // Query stock manufacturing orders for Sheet 2
        var mfgOrders = _mfgOrderRepository != null
            ? await _mfgOrderRepository.GetAllAsync(cancellationToken)
            : new List<ManufacturingOrder>();

        if (from.HasValue) mfgOrders = mfgOrders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) mfgOrders = mfgOrders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "all")
            mfgOrders = mfgOrders.Where(o => string.Equals(o.Status, status, StringComparison.OrdinalIgnoreCase)).ToList();

        var mfgRows = mfgOrders.Select(o => new ManufacturingOrderExportRow(
            o.OrderNumber,
            o.CreatedAt,
            o.RequestedBy,
            o.ProductName,
            o.Quantity,
            o.DestinationLocationName,
            o.DestinationLocationType == "warehouse" ? "Almacén" : "Tienda",
            o.Status,
            o.ProviderName ?? "Taller Central",
            o.CostUsd,
            o.Notes
        )).ToList();

        var mfgColumns = new (string Header, Func<ManufacturingOrderExportRow, object?> Selector)[]
        {
            ("Nº Orden", r => r.OrderNumber),
            ("Fecha", r => r.CreatedAt),
            ("Solicitante", r => r.RequestedBy),
            ("Producto", r => r.ProductName),
            ("Cantidad", r => r.Quantity),
            ("Destino", r => r.DestinationLocationName),
            ("Tipo Destino", r => r.DestinationType),
            ("Estado", r => r.Status),
            ("Proveedor / Taller", r => r.ProviderName),
            ("Costo Est. USD", r => r.CostUsd),
            ("Notas", r => r.Notes)
        };

        return ExcelReportBuilder.CreateWorkbook(wb =>
        {
            ExcelReportBuilder.AddWorksheet(wb, "Pedidos", rows, columns);
            ExcelReportBuilder.AddWorksheet(wb, "Órdenes de Fabricación", mfgRows, mfgColumns);
        });
    }

    public async Task<byte[]> GenerateExpiredLayawaysReportExcelAsync(CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" &&
                 o.SaleTypeString == "sistema_apartado" &&
                 !o.OrderNumber.StartsWith("RES-") &&
                 !o.OrderNumber.StartsWith("PCF-") &&
                 o.StatusString != "Declinado" && o.StatusString != "Cancelado" &&
                 o.StatusString != "Entregado" && o.StatusString != "Completado" && o.StatusString != "Completada",
            cancellationToken);

        var now = DateTime.UtcNow;
        var expiredList = new List<ExpiredLayawayExportRow>();

        foreach (var o in orders)
        {
            var diffDays = (int)(now - o.CreatedAt).TotalDays;
            if (diffDays > 90)
            {
                var paid = o.PartialPayments?.Sum(p => p.Amount) ?? 0m;
                var pending = Math.Max(0m, o.Total - paid);
                if (pending > 0.01m)
                {
                    expiredList.Add(new ExpiredLayawayExportRow(
                        o.OrderNumber,
                        o.CreatedAt,
                        o.ClientName,
                        o.Total,
                        paid,
                        pending,
                        diffDays - 90));
                }
            }
        }

        var columns = new (string Header, Func<ExpiredLayawayExportRow, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.CreatedAt),
            ("Cliente", r => r.ClientName),
            ("Total ($)", r => r.Total),
            ("Monto Pagado ($)", r => r.PaidAmount),
            ("Monto Pendiente ($)", r => r.PendingAmount),
            ("Días Vencido", r => r.DaysExpired)
        };

        return ExcelReportBuilder.CreateTable("SA Vencidos", expiredList, columns);
    }

    public async Task<IReadOnlyList<ManufacturingReportPreviewDto>> GetManufacturingPreviewAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? status = null,
        string? manufacturerId = null,
        string? orderNumber = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(orderNumber)) orders = orders.Where(o => o.OrderNumber.Contains(orderNumber, StringComparison.OrdinalIgnoreCase)).ToList();

        var rows = new List<ManufacturingReportPreviewDto>();
        foreach (var order in orders)
        {
            foreach (var p in order.Products)
            {
                if (!string.IsNullOrWhiteSpace(status) && status != "all" && p.ManufacturingStatusString != status)
                    continue;

                if (!string.IsNullOrWhiteSpace(manufacturerId) && manufacturerId != "all" && p.ManufacturingProviderId != manufacturerId)
                    continue;

                rows.Add(new ManufacturingReportPreviewDto(
                    order.OrderNumber,
                    order.CreatedAt,
                    order.ClientName,
                    p.ManufacturingProviderName ?? "",
                    p.Name,
                    p.Quantity,
                    p.ManufacturingStatusString ?? "Por Fabricar",
                    order.Observations ?? "",
                    p.ManufacturingNotes ?? "",
                    p.RefabricationReason ?? ""));
            }
        }

        return rows;
    }

    public async Task<IReadOnlyList<DispatchReportPreviewDto>> GetDispatchPreviewAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? deliveryZone = null,
        string? location = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue) orders = orders.Where(o => o.CreatedAt >= from.Value).ToList();
        if (to.HasValue) orders = orders.Where(o => o.CreatedAt <= to.Value).ToList();
        if (!string.IsNullOrWhiteSpace(deliveryZone) && deliveryZone != "all")
            orders = orders.Where(o => o.DeliveryZone != null && o.DeliveryZone.Contains(deliveryZone, StringComparison.OrdinalIgnoreCase)).ToList();

        var clients = await _clientRepository.GetAllAsync(cancellationToken);
        var clientMap = clients.ToDictionary(c => c.Id, c => c);

        var rows = new List<DispatchReportPreviewDto>();
        foreach (var order in orders)
        {
            clientMap.TryGetValue(order.ClientId, out var client);
            var phone1 = client?.Telefono ?? "";
            var phone2 = client?.Telefono2 ?? "";
            var paid = order.PartialPayments?.Sum(p => p.Amount) ?? 0m;
            var saldoPendiente = Math.Max(0m, order.Total - paid);
            var desc = string.Join(", ", order.Products?.Select(p => $"{p.Quantity}x {p.Name}") ?? Array.Empty<string>());
            var ubicacion = order.Products?.FirstOrDefault()?.LocationStatusString ?? "EN TIENDA";

            if (!string.IsNullOrWhiteSpace(location) && location != "all")
            {
                if (!ubicacion.Contains(location, StringComparison.OrdinalIgnoreCase))
                    continue;
            }

            rows.Add(new DispatchReportPreviewDto(
                order.OrderNumber,
                order.ClientName,
                phone1,
                phone2,
                order.Products?.Sum(p => p.Quantity) ?? 0,
                desc,
                order.DeliveryAddress ?? "",
                order.PaymentTypeString,
                order.Total,
                saldoPendiente,
                order.Observations ?? "",
                order.DispatchObservations ?? "",
                ubicacion));
        }

        return rows;
    }

    private async Task<List<CommissionReportRowDto>> GetFilteredCommissionsDataAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        string? storeId = null,
        string? sellerType = null,
        string? referrerId = null,
        CancellationToken cancellationToken = default)
    {
        var rangeStart = from.HasValue ? DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc) : DateTime.MinValue;
        var rangeEnd = to.HasValue ? DateTime.SpecifyKind(to.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc) : DateTime.MaxValue;

        var orders = await _orderRepository.FindAsync(
            o => o.CreatedAt >= rangeStart && o.CreatedAt <= rangeEnd,
            cancellationToken);

        var productCommissions = _productCommissionRepository != null
            ? await _productCommissionRepository.GetAllAsync(cancellationToken)
            : new List<ProductCommission>();

        var saleTypeRules = _saleTypeCommissionRuleRepository != null
            ? await _saleTypeCommissionRuleRepository.GetAllAsync(cancellationToken)
            : new List<SaleTypeCommissionRule>();

        var users = _userRepository != null
            ? (await _userRepository.GetAllAsync(cancellationToken)).ToList()
            : new List<User>();

        var categories = _categoryRepository != null
            ? (await _categoryRepository.GetAllAsync(cancellationToken)).ToList()
            : new List<Category>();

        var reportData = new List<CommissionReportRowDto>();

        foreach (var order in orders)
        {
            if (IsReservation(order))
                continue;

            if (IsDeclinedOrCancelled(order))
                continue;

            if (IsPagoAEntregaCondition(order) && !HasRecordedPaymentsForCommission(order))
                continue;

            var tipoVentaLabel = GetCommissionSaleTypeLabel(order, saleTypeRules);

            foreach (var product in order.Products)
            {
                var lineCtx = ResolveLineCommissionContext(product, order);
                var postventaId = order.PostventaId?.Trim();

                if (!RowMatchesVendorFilter(vendorId, lineCtx.EffectiveVendorId, lineCtx.EffectiveReferrerId, postventaId))
                    continue;

                if (!RowMatchesStoreFilter(storeId, users, lineCtx.EffectiveVendorId, lineCtx.EffectiveReferrerId, postventaId))
                    continue;

                if (!RowMatchesSellerTypeFilter(sellerType, users, lineCtx.EffectiveVendorId))
                    continue;

                if (!RowMatchesReferrerFilter(referrerId, order, lineCtx.EffectiveReferrerId))
                    continue;

                var mainVendor = users.FirstOrDefault(u => u.Id == lineCtx.EffectiveVendorId);
                mainVendor?.NormalizeCommissionExclusivity();
                var exclusivityMode = mainVendor?.CommissionExclusivityMode ?? CommissionExclusivityModes.Shared;
                var isExclusiveVendor = CommissionExclusivityModes.IsExclusive(exclusivityMode);
                var vendorBaseSalary = mainVendor?.BaseSalary ?? 0m;
                var hasReferrer = !string.IsNullOrWhiteSpace(lineCtx.EffectiveReferrerId);
                var isSharedSale = exclusivityMode == CommissionExclusivityModes.Shared || lineCtx.IsSharedSale;

                var (vendorCommission, referrerCommission, postventaCommission, baseRate, appliedVendorRate, appliedReferrerRate, appliedPostventaRate) =
                    CalculateProductCommission(product, order, productCommissions, saleTypeRules, exclusivityMode, isSharedSale, hasReferrer);

                if (vendorCommission == 0m && referrerCommission == 0m && postventaCommission == 0m)
                    continue;

                var isDistributedSale = referrerCommission > 0m || postventaCommission > 0m;
                var description = FormatProductDescription(product, categories);

                if (isDistributedSale)
                {
                    var postventaLabel = string.IsNullOrWhiteSpace(order.PostventaName)
                        ? "Post venta"
                        : order.PostventaName.Trim();

                    reportData.Add(new CommissionReportRowDto
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName ?? "",
                        Vendedor = lineCtx.EffectiveVendorName,
                        Pedido = order.OrderNumber ?? "",
                        Descripcion = description,
                        CantidadArticulos = product.Quantity,
                        TipoVenta = tipoVentaLabel,
                        ComisionFamiliaUsdPorUnidad = baseRate,
                        Comision = vendorCommission,
                        VendedorSecundario = lineCtx.EffectiveReferrerName,
                        ComisionSecundaria = referrerCommission,
                        VendedorPostventa = postventaCommission > 0m ? postventaLabel : null,
                        ComisionPostventa = postventaCommission > 0m ? postventaCommission : null,
                        SueldoBase = vendorBaseSalary,
                        TasaComisionBase = baseRate,
                        TasaAplicadaVendedor = appliedVendorRate,
                        TasaAplicadaReferido = appliedReferrerRate,
                        TasaAplicadaPostventa = appliedPostventaRate,
                        EsVentaCompartida = true,
                        EsVendedorExclusivo = isExclusiveVendor
                    });
                }
                else
                {
                    reportData.Add(new CommissionReportRowDto
                    {
                        Fecha = order.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                        Cliente = order.ClientName ?? "",
                        Vendedor = lineCtx.EffectiveVendorName,
                        Pedido = order.OrderNumber ?? "",
                        Descripcion = description,
                        CantidadArticulos = product.Quantity,
                        TipoVenta = tipoVentaLabel,
                        ComisionFamiliaUsdPorUnidad = baseRate,
                        Comision = vendorCommission,
                        SueldoBase = vendorBaseSalary,
                        TasaComisionBase = baseRate,
                        TasaAplicadaVendedor = appliedVendorRate,
                        EsVentaCompartida = false,
                        EsVendedorExclusivo = isExclusiveVendor
                    });
                }
            }
        }

        return reportData;
    }

    private (decimal vendorCommission, decimal referrerCommission, decimal postventaCommission, decimal baseRate, decimal appliedVendorRate, decimal appliedReferrerRate, decimal appliedPostventaRate)
        CalculateProductCommission(
            OrderProduct product,
            Order order,
            IEnumerable<ProductCommission> productCommissions,
            IEnumerable<SaleTypeCommissionRule> saleTypeRules,
            string exclusivityMode,
            bool isSharedSale,
            bool hasReferrer)
    {
        var categoryCommission = productCommissions.FirstOrDefault(c =>
            (!string.IsNullOrWhiteSpace(product.Category) && (c.CategoryName.Equals(product.Category, StringComparison.OrdinalIgnoreCase) || c.CategoryId == product.Category)));

        var baseCommissionRate = categoryCommission?.CommissionValue ?? 0m;
        if (baseCommissionRate == 0m)
        {
            return (0m, 0m, 0m, 0m, 0m, 0m, 0m);
        }

        var qty = Math.Max(product.Quantity, 1);
        var familyCommission = baseCommissionRate * qty;
        var saleType = DetermineSaleType(order);
        var rule = SaleTypeCommissionTierResolver.PickRule(saleTypeRules, saleType, baseCommissionRate, _logger);

        var split = CommissionExclusivityCalculator.Calculate(
            exclusivityMode,
            isSharedSale,
            hasReferrer,
            baseCommissionRate,
            qty,
            familyCommission,
            rule);

        return (
            split.VendorCommission,
            split.ReferrerCommission,
            split.PostventaCommission,
            baseCommissionRate,
            split.AppliedVendorRate,
            split.AppliedReferrerRate,
            split.AppliedPostventaRate);
    }

    private static string DetermineSaleType(Order order)
    {
        var saleTypeStr = order.SaleTypeString ?? (order.SaleType.HasValue ? order.SaleType.Value.ToString() : null);
        if (!string.IsNullOrWhiteSpace(saleTypeStr))
            return saleTypeStr.ToLowerInvariant();

        var delTypeStr = order.DeliveryTypeString ?? (order.DeliveryType.HasValue ? order.DeliveryType.Value.ToString() : null);
        if (!string.IsNullOrWhiteSpace(delTypeStr))
            return delTypeStr.ToLowerInvariant();

        return "entrega";
    }

    private static string GetCommissionSaleTypeLabel(Order order, IEnumerable<SaleTypeCommissionRule> rules)
    {
        var code = DetermineSaleType(order);
        var rule = rules
            .Where(r => r.SaleType.Equals(code, StringComparison.OrdinalIgnoreCase))
            .OrderBy(r => r.FamilyCommissionUsdPerUnit)
            .FirstOrDefault();
        if (rule != null && !string.IsNullOrWhiteSpace(rule.SaleTypeLabel))
            return rule.SaleTypeLabel.Trim();

        return code switch
        {
            "delivery_express" => "Delivery express",
            "encargo" => "Encargo",
            "encargo_entrega" => "Encargo con entrega",
            "entrega" => "Entrega",
            "retiro_almacen" => "Retiro por almacén",
            "retiro_tienda" => "Retiro por tienda",
            "sistema_apartado" => "Sistema apartado",
            "entrega_programada" => "Entrega programada",
            _ => code
        };
    }

    private static bool RowMatchesVendorFilter(
        string? vendorId,
        string effectiveVendorId,
        string? effectiveReferrerId,
        string? postventaId)
    {
        if (string.IsNullOrWhiteSpace(vendorId))
            return true;

        var filter = vendorId.Trim();
        return string.Equals(effectiveVendorId, filter, StringComparison.Ordinal)
            || (!string.IsNullOrWhiteSpace(effectiveReferrerId)
                && string.Equals(effectiveReferrerId.Trim(), filter, StringComparison.Ordinal))
            || (!string.IsNullOrWhiteSpace(postventaId)
                && string.Equals(postventaId, filter, StringComparison.Ordinal));
    }

    private static bool RowMatchesSellerTypeFilter(
        string? sellerType,
        IReadOnlyList<User> users,
        string effectiveVendorId)
    {
        if (string.IsNullOrWhiteSpace(sellerType) || sellerType == "all")
            return true;

        var vendor = users.FirstOrDefault(u => u.Id == effectiveVendorId);
        if (vendor == null)
            return false;

        var roleStr = vendor.RoleString ?? vendor.Role.ToString();
        return sellerType switch
        {
            "online" => string.Equals(roleStr, "Online Seller", StringComparison.OrdinalIgnoreCase),
            "store" => string.Equals(roleStr, "Store Seller", StringComparison.OrdinalIgnoreCase),
            _ => true
        };
    }

    private static bool RowMatchesReferrerFilter(
        string? referrerId,
        Order order,
        string? effectiveReferrerId)
    {
        if (string.IsNullOrWhiteSpace(referrerId))
            return true;

        var filter = referrerId.Trim();
        return string.Equals(order.ReferrerId?.Trim(), filter, StringComparison.Ordinal)
            || string.Equals(effectiveReferrerId?.Trim(), filter, StringComparison.Ordinal);
    }

    private static bool RowMatchesStoreFilter(
        string? storeFilter,
        IReadOnlyList<User> users,
        string effectiveVendorId,
        string? effectiveReferrerId,
        string? postventaId)
    {
        if (string.IsNullOrWhiteSpace(storeFilter))
            return true;

        var participantIds = new[]
        {
            effectiveVendorId,
            effectiveReferrerId?.Trim(),
            postventaId,
        }
        .Where(id => !string.IsNullOrWhiteSpace(id))
        .Select(id => id!)
        .Distinct(StringComparer.Ordinal)
        .ToList();

        if (participantIds.Count == 0)
            return false;

        if (storeFilter.Equals("unassigned", StringComparison.OrdinalIgnoreCase))
        {
            return participantIds.Any(pid =>
            {
                var user = users.FirstOrDefault(u => u.Id == pid);
                var roleStr = user?.RoleString ?? user?.Role.ToString();
                return user != null
                    && string.Equals(roleStr, "Store Seller", StringComparison.OrdinalIgnoreCase)
                    && string.IsNullOrWhiteSpace(user.StoreId);
            });
        }

        return participantIds.Any(pid =>
        {
            var user = users.FirstOrDefault(u => u.Id == pid);
            return user != null
                && string.Equals(user.StoreId, storeFilter.Trim(), StringComparison.Ordinal);
        });
    }

    private sealed record LineCommissionContext(
        bool IsSharedSale,
        string EffectiveVendorId,
        string EffectiveVendorName,
        string? EffectiveReferrerId,
        string? EffectiveReferrerName);

    private static LineCommissionContext ResolveLineCommissionContext(OrderProduct product, Order order)
    {
        var source = product.CommissionLineSource;

        if (string.IsNullOrWhiteSpace(source))
        {
            var legacyShared = !string.IsNullOrWhiteSpace(order.ReferrerId);
            return new LineCommissionContext(
                legacyShared,
                order.VendorId ?? "",
                order.VendorName ?? "",
                order.ReferrerId,
                order.ReferrerName);
        }

        switch (source)
        {
            case CommissionLineSources.ReservationUnchanged:
                return new LineCommissionContext(
                    false,
                    order.SourceReservationVendorId ?? order.VendorId ?? "",
                    order.SourceReservationVendorName ?? order.VendorName ?? "",
                    null,
                    null);

            case CommissionLineSources.StoreAdded:
                return new LineCommissionContext(
                    false,
                    order.VendorId ?? "",
                    order.VendorName ?? "",
                    null,
                    null);

            case CommissionLineSources.StoreModified:
            case CommissionLineSources.StoreSubstitution:
                return new LineCommissionContext(
                    true,
                    order.VendorId ?? "",
                    order.VendorName ?? "",
                    order.ReferrerId ?? order.SourceReservationVendorId,
                    order.ReferrerName ?? order.SourceReservationVendorName);

            default:
                var fallbackShared = !string.IsNullOrWhiteSpace(order.ReferrerId);
                return new LineCommissionContext(
                    fallbackShared,
                    order.VendorId ?? "",
                    order.VendorName ?? "",
                    order.ReferrerId,
                    order.ReferrerName);
        }
    }

    private static bool IsReservation(Order order)
    {
        var typeStr = order.TypeString ?? order.Type.ToString();
        if (string.Equals(typeStr, "Reservation", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(typeStr, "PendingConfirmation", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!string.IsNullOrWhiteSpace(order.OrderNumber))
        {
            var num = order.OrderNumber.Trim().ToUpperInvariant();
            if (num.StartsWith("RES-", StringComparison.Ordinal) || num.StartsWith("PCF-", StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private static bool IsDeclinedOrCancelled(Order order)
    {
        var statusStr = order.StatusString ?? order.Status.ToString();
        return string.Equals(statusStr, "Declinado", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(statusStr, "Cancelado", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsPagoAEntregaCondition(Order order) =>
        string.Equals(order.PaymentCondition?.Trim(), "pago_a_entrega", StringComparison.OrdinalIgnoreCase);

    private static bool HasRecordedPaymentsForCommission(Order order)
    {
        var (payments, _) = GetActivePaymentsForReport(order);
        if (payments.Count > 0)
            return true;

        return !string.IsNullOrWhiteSpace(order.PaymentMethod);
    }

    private static bool IsInternalProductAttributeKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return true;
        var lower = key.Trim().ToLowerInvariant();
        return lower is "name" or "price" or "quantity" or "category" or "id" or "_id" or "productid";
    }

    private static string FormatAttributeValue(object? value)
    {
        if (value == null) return "";

        if (value is System.Text.Json.JsonElement jsonElement)
        {
            switch (jsonElement.ValueKind)
            {
                case System.Text.Json.JsonValueKind.String:
                    return jsonElement.GetString() ?? "";
                case System.Text.Json.JsonValueKind.Number:
                    return jsonElement.GetRawText();
                case System.Text.Json.JsonValueKind.Array:
                    return string.Join(", ",
                        jsonElement.EnumerateArray()
                            .Select(e => e.ValueKind == System.Text.Json.JsonValueKind.String
                                ? e.GetString()
                                : e.GetRawText())
                            .Where(s => !string.IsNullOrEmpty(s)));
                default:
                    return jsonElement.GetRawText();
            }
        }

        if (value is System.Collections.IEnumerable enumerable && value is not string)
        {
            return string.Join(", ",
                enumerable.Cast<object>()
                    .Select(v => v?.ToString() ?? "")
                    .Where(s => !string.IsNullOrEmpty(s)));
        }

        return value.ToString() ?? "";
    }

    private static string FormatProductDescription(OrderProduct product, IReadOnlyList<Category> categories)
    {
        var parts = new List<string> { product.Name ?? "Producto sin nombre" };

        if (product.Attributes == null || product.Attributes.Count == 0)
        {
            return string.Join(" | ", parts);
        }

        var category = categories.FirstOrDefault(c =>
            (!string.IsNullOrWhiteSpace(product.Category) && (c.Name.Equals(product.Category, StringComparison.OrdinalIgnoreCase) || c.Id == product.Category)));

        var attributeStrings = new List<string>();

        foreach (var kvp in product.Attributes)
        {
            var attributeKey = kvp.Key;
            var attributeValue = kvp.Value;

            if (IsInternalProductAttributeKey(attributeKey))
                continue;

            if (attributeKey.Contains('_') && attributeKey.Split('_').Length == 2)
                continue;

            string attributeTitle = attributeKey;
            if (category != null)
            {
                var categoryAttribute = category.Attributes?.FirstOrDefault(attr =>
                    (!string.IsNullOrEmpty(attr.Title) && attr.Title.Equals(attributeKey, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(attr.Id) && attr.Id == attributeKey));

                if (categoryAttribute != null && !string.IsNullOrEmpty(categoryAttribute.Title))
                {
                    attributeTitle = categoryAttribute.Title;
                }
            }

            var valueLabel = FormatAttributeValue(attributeValue);
            if (!string.IsNullOrWhiteSpace(valueLabel))
            {
                attributeStrings.Add($"{attributeTitle}: {valueLabel}");
            }
        }

        if (attributeStrings.Count > 0)
        {
            parts.Add(string.Join(", ", attributeStrings));
        }

        return string.Join(" | ", parts);
    }
}

public record ManufacturingReportExportRow(
    string OrderNumber,
    DateTime CreatedAt,
    string ClientName,
    string ProductName,
    int Quantity,
    string ManufacturingStatus,
    string? ProviderName,
    string? Observations);

public record ManufacturingOrderExportRow(
    string OrderNumber,
    DateTime CreatedAt,
    string RequestedBy,
    string ProductName,
    int Quantity,
    string DestinationLocationName,
    string DestinationType,
    string Status,
    string? ProviderName,
    decimal CostUsd,
    string? Notes);

public record ExpiredLayawayExportRow(
    string OrderNumber,
    DateTime CreatedAt,
    string ClientName,
    decimal Total,
    decimal PaidAmount,
    decimal PendingAmount,
    int DaysExpired);
