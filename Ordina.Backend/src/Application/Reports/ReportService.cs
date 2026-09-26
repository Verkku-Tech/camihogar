using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Manufacturing;
using Ordina.Domain.Orders;

using Ordina.Domain.Stores;

namespace Ordina.Application.Reports;

public interface IReportService
{
    Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(DateTime? from = null, DateTime? to = null, string? vendorId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentsDetailedReportRowDto>> GetPaymentsDetailedReportAsync(DateTime? from = null, DateTime? to = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentReportRowDto>> GetPaymentsReportDataAsync(DateTime? startDate = null, DateTime? endDate = null, string? paymentMethod = null, string? accountId = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateCommissionsReportExcelAsync(DateTime? from = null, DateTime? to = null, string? vendorId = null, CancellationToken cancellationToken = default);
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

    public ReportService(
        IOrderRepository orderRepository,
        IClientRepository clientRepository,
        IProductRepository productRepository,
        IExchangeRateRepository exchangeRateRepository,
        IRepository<ManufacturingOrder>? mfgOrderRepository = null,
        IRepository<Account>? accountRepository = null)
    {
        _orderRepository = orderRepository;
        _clientRepository = clientRepository;
        _productRepository = productRepository;
        _exchangeRateRepository = exchangeRateRepository;
        _mfgOrderRepository = mfgOrderRepository;
        _accountRepository = accountRepository;
    }


    public async Task<IReadOnlyList<CommissionReportRowDto>> GetCommissionReportAsync(
        DateTime? from = null,
        DateTime? to = null,
        string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        if (from.HasValue)
        {
            var start = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
            orders = orders.Where(o => o.CreatedAt >= start).ToList();
        }
        if (to.HasValue)
        {
            var end = DateTime.SpecifyKind(to.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            orders = orders.Where(o => o.CreatedAt <= end).ToList();
        }
        if (!string.IsNullOrWhiteSpace(vendorId)) orders = orders.Where(o => o.VendorId == vendorId).ToList();

        var rows = new List<CommissionReportRowDto>();
        foreach (var order in orders)
        {
            var firstProdDesc = order.Products.FirstOrDefault()?.Name ?? "Venta de productos";
            var itemCount = order.Products.Sum(p => p.Quantity);
            var commission = Math.Round(order.Total * 0.03m, 2);

            rows.Add(new CommissionReportRowDto(
                OrderNumber: order.OrderNumber,
                Date: order.CreatedAt,
                SellerName: string.IsNullOrWhiteSpace(order.VendorName) ? "Sin Asignar" : order.VendorName,
                ClientName: string.IsNullOrWhiteSpace(order.ClientName) ? "Cliente" : order.ClientName,
                OrderTotal: order.Total,
                CommissionAmount: commission,
                CommissionMode: "Standard",
                Description: firstProdDesc,
                ItemsCount: itemCount,
                SaleType: order.SaleTypeString,
                ComisionFamiliaUsdPorUnidad: 0,
                Comision: commission,
                ComisionPostventa: 0,
                ComisionSecundaria: 0,
                VendedorPostventa: order.PostventaName,
                VendedorSecundario: order.ReferrerName,
                Fecha: order.CreatedAt.ToString("o"),
                Cliente: string.IsNullOrWhiteSpace(order.ClientName) ? "Cliente" : order.ClientName,
                Pedido: order.OrderNumber,
                Vendedor: string.IsNullOrWhiteSpace(order.VendorName) ? "Sin Asignar" : order.VendorName,
                Descripcion: firstProdDesc,
                CantidadArticulos: itemCount,
                TipoVenta: order.SaleTypeString));
        }

        return rows;
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
        CancellationToken cancellationToken = default)
    {
        var data = await GetCommissionReportAsync(from, to, vendorId, cancellationToken);
        var columns = new (string Header, Func<CommissionReportRowDto, object?> Selector)[]
        {
            ("Pedido", r => r.OrderNumber),
            ("Fecha", r => r.Date),
            ("Vendedor", r => r.SellerName),
            ("Cliente", r => r.ClientName),
            ("Total Venta ($)", r => r.OrderTotal),
            ("Comisión ($)", r => r.CommissionAmount),
            ("Tipo Comisión", r => r.CommissionMode)
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
