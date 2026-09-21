using Ordina.Domain.Finance;
using Ordina.Domain.Orders;

namespace Ordina.Application.Dashboard;

public class DashboardService : IDashboardService
{
    private readonly IDashboardRepository _dashboardRepository;
    private readonly ITimeSeriesForecastingService _forecaster;

    public DashboardService(
        IDashboardRepository dashboardRepository,
        ITimeSeriesForecastingService? forecaster = null)
    {
        _dashboardRepository = dashboardRepository;
        _forecaster = forecaster ?? new HoltWintersForecastingService();
    }

    private static bool IsValidOrder(Order o)
    {
        var type = o.TypeString?.ToLowerInvariant();
        if (type is "budget" or "reservation" or "pendingconfirmation") return false;
        if (o.OrderNumber.StartsWith("RES-", StringComparison.OrdinalIgnoreCase)) return false;
        if (o.OrderNumber.StartsWith("PCF-", StringComparison.OrdinalIgnoreCase)) return false;
        if (o.OrderNumber.StartsWith("PRE-", StringComparison.OrdinalIgnoreCase)) return false;
        if (o.StatusString is "Declinado" or "Cancelado") return false;
        return true;
    }

    private static bool IsCasheaFinancedPayment(PartialPayment p)
    {
        if (p.PaymentDetails?.CasheaFinancedPortion == true) return true;
        if (!string.IsNullOrWhiteSpace(p.Method) &&
            p.Method.Contains("Cashea", StringComparison.OrdinalIgnoreCase) &&
            p.Method.Contains("financia", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        return false;
    }

    private static decimal ConvertOrderTotalToUsd(Order o, decimal liveUsdRate)
    {
        var isBs = string.Equals(o.BaseCurrency, "Bs", StringComparison.OrdinalIgnoreCase)
            || (string.IsNullOrEmpty(o.BaseCurrency) && o.Total > 100_000);

        if (!isBs)
            return o.Total;

        var rate = o.ExchangeRatesAtCreation?.Usd?.Rate ?? 0m;
        if (rate <= 0 && o.PaymentDetails?.ExchangeRate > 0)
            rate = o.PaymentDetails.ExchangeRate.Value;
        if (rate <= 0)
            rate = liveUsdRate;

        if (rate > 0)
            return Math.Round(o.Total / rate, 2);

        return o.Total;
    }

    private static decimal ConvertPaymentToUsd(PartialPayment p, Order o, decimal liveUsdRate, decimal liveEurRate)
    {
        var det = p.PaymentDetails;
        var currency = (det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs").Trim().ToUpperInvariant();
        var amount = det?.OriginalAmount ?? det?.CashReceived ?? p.Amount;

        if (currency is "USD" or "$")
            return amount;

        var usdRate = (det?.ExchangeRate > 0 ? det.ExchangeRate.Value : 0m);
        if (usdRate <= 0 && o.ExchangeRatesAtCreation?.Usd?.Rate > 0)
            usdRate = o.ExchangeRatesAtCreation.Usd.Rate;
        if (usdRate <= 0 && o.PaymentDetails?.ExchangeRate > 0)
            usdRate = o.PaymentDetails.ExchangeRate.Value;
        if (usdRate <= 0)
            usdRate = liveUsdRate;

        if (currency is "EUR" or "€")
        {
            var eurRate = o.ExchangeRatesAtCreation?.Eur?.Rate ?? liveEurRate;
            if (eurRate > 0 && usdRate > 0)
            {
                return Math.Round((amount * eurRate) / usdRate, 2);
            }
            return Math.Round(amount * 1.08m, 2);
        }

        // Bs a USD
        if (usdRate > 0)
            return Math.Round(amount / usdRate, 2);

        return 0m;
    }

    private static DateTime ComputePeriodStart(string period)
    {
        var caracasOffset = TimeSpan.FromHours(-4);
        var localNow = DateTime.UtcNow + caracasOffset;
        return period switch
        {
            "week"  => (new DateTime(localNow.Year, localNow.Month, localNow.Day).AddDays(-6) - caracasOffset),
            "month" => (new DateTime(localNow.Year, localNow.Month, 1) - caracasOffset),
            "year"  => (new DateTime(localNow.Year, 1, 1) - caracasOffset),
            _       => (new DateTime(localNow.Year, localNow.Month, localNow.Day) - caracasOffset),
        };
    }

    public async Task<DashboardMetricsDto> GetDashboardMetricsAsync(string period = "day", CancellationToken cancellationToken = default)
    {
        var nowUtc = DateTime.UtcNow;
        var caracasOffset = TimeSpan.FromHours(-4);
        var localNow = nowUtc.Add(caracasOffset);
        var localTodayStart = localNow.Date;
        var localTodayEnd = localTodayStart.AddDays(1).AddTicks(-1);

        DateTime periodStart;
        DateTime periodEnd;
        DateTime prevPeriodStart;
        DateTime prevPeriodEnd;

        switch (period?.ToLowerInvariant())
        {
            case "week":
                var localWeekStart = localTodayStart.AddDays(-6);
                periodStart = localWeekStart.Subtract(caracasOffset);
                periodEnd = localTodayEnd.Subtract(caracasOffset);
                prevPeriodStart = localWeekStart.AddDays(-7).Subtract(caracasOffset);
                prevPeriodEnd = localWeekStart.Subtract(caracasOffset).AddTicks(-1);
                break;
            case "month":
                var localMonthStart = new DateTime(localNow.Year, localNow.Month, 1);
                periodStart = localMonthStart.Subtract(caracasOffset);
                periodEnd = localTodayEnd.Subtract(caracasOffset);
                var localPrevMonthStart = localMonthStart.AddMonths(-1);
                var localPrevMonthEnd = localMonthStart.AddTicks(-1);
                prevPeriodStart = localPrevMonthStart.Subtract(caracasOffset);
                prevPeriodEnd = localPrevMonthEnd.Subtract(caracasOffset);
                break;
            case "year":
                var localYearStart = new DateTime(localNow.Year, 1, 1);
                periodStart = localYearStart.Subtract(caracasOffset);
                periodEnd = localTodayEnd.Subtract(caracasOffset);
                var localPrevYearStart = localYearStart.AddYears(-1);
                var localPrevYearEnd = localYearStart.AddTicks(-1);
                prevPeriodStart = localPrevYearStart.Subtract(caracasOffset);
                prevPeriodEnd = localPrevYearEnd.Subtract(caracasOffset);
                break;
            case "day":
            default:
                periodStart = localTodayStart.Subtract(caracasOffset);
                periodEnd = localTodayEnd.Subtract(caracasOffset);
                prevPeriodStart = localTodayStart.AddDays(-1).Subtract(caracasOffset);
                prevPeriodEnd = localTodayStart.Subtract(caracasOffset).AddTicks(-1);
                break;
        }

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;
        var liveEurRate = allRates.FirstOrDefault(r => (r.ToCurrency == "EUR" || r.FromCurrency == "EUR") && r.IsActive)?.Rate ?? (liveUsdRate * 1.15m);

        var orders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);

        var currentVentas = orders.Where(o => IsValidOrder(o) && o.CreatedAt >= periodStart && o.CreatedAt <= periodEnd).ToList();
        var currentOrdersCount = currentVentas.Count;
        var currentInvoicedUsd = currentVentas.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));

        var prevVentas = orders.Where(o => IsValidOrder(o) && o.CreatedAt >= prevPeriodStart && o.CreatedAt <= prevPeriodEnd).ToList();
        var previousOrdersCount = prevVentas.Count;
        var previousInvoicedUsd = prevVentas.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));

        decimal currentCollectedUsd = 0m;
        decimal previousCollectedUsd = 0m;
        decimal currentCasheaFinancedUsd = 0m;

        foreach (var order in orders.Where(o => o.StatusString != "Declinado" && o.StatusString != "Cancelado"))
        {
            var payments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());

            foreach (var p in payments)
            {
                var isCashea = IsCasheaFinancedPayment(p);
                var paymentUsd = ConvertPaymentToUsd(p, order, liveUsdRate, liveEurRate);

                if (p.Date >= periodStart && p.Date <= periodEnd)
                {
                    if (isCashea)
                    {
                        currentCasheaFinancedUsd += paymentUsd;
                    }
                    else
                    {
                        currentCollectedUsd += paymentUsd;
                    }
                }
                if (p.Date >= prevPeriodStart && p.Date <= prevPeriodEnd)
                {
                    if (!isCashea)
                    {
                        previousCollectedUsd += paymentUsd;
                    }
                }
            }
        }

        decimal pendingPaymentsUsd = 0m;
        foreach (var order in orders.Where(o => IsValidOrder(o) && o.StatusString != "Entregado" && o.StatusString != "Completado" && o.StatusString != "Completada"))
        {
            var payments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            decimal paid = payments.Where(p => !IsCasheaFinancedPayment(p)).Sum(p => ConvertPaymentToUsd(p, order, liveUsdRate, liveEurRate));
            decimal orderTotalUsd = ConvertOrderTotalToUsd(order, liveUsdRate);
            decimal pending = orderTotalUsd - paid;
            if (pending > 0.01m)
            {
                pendingPaymentsUsd += pending;
            }
        }

        var ninetyDaysAgo = DateTime.UtcNow.AddDays(-90);
        int expiredLayawaysCount = 0;
        decimal expiredLayawaysAmountUsd = 0m;

        var saOrders = orders.Where(o =>
            string.Equals(o.SaleTypeString, "sistema_apartado", StringComparison.OrdinalIgnoreCase) &&
            IsValidOrder(o) &&
            o.CreatedAt < ninetyDaysAgo &&
            o.StatusString != "Entregado" && o.StatusString != "Completado" && o.StatusString != "Completada"
        ).ToList();

        foreach (var order in saOrders)
        {
            var payments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            decimal paid = payments.Where(p => !IsCasheaFinancedPayment(p)).Sum(p => ConvertPaymentToUsd(p, order, liveUsdRate, liveEurRate));
            decimal orderTotalUsd = ConvertOrderTotalToUsd(order, liveUsdRate);
            decimal pending = orderTotalUsd - paid;
            if (pending > 0.01m)
            {
                expiredLayawaysCount++;
                expiredLayawaysAmountUsd += pending;
            }
        }

        int productsToManufactureCount = 0;
        foreach (var order in orders.Where(o => IsValidOrder(o)))
        {
            foreach (var prod in order.Products ?? Enumerable.Empty<OrderProduct>())
            {
                if (prod.LocationStatusString == "FABRICACION" ||
                    prod.ManufacturingStatusString == "por_fabricar" ||
                    prod.ManufacturingStatusString == "debe_fabricar")
                {
                    productsToManufactureCount += (prod.Quantity > 0 ? prod.Quantity : 1);
                }
            }
        }

        static MetricChangeDto CalculateChange(decimal current, decimal previous, string direction = "higher_is_better")
        {
            if (previous == 0)
            {
                return new MetricChangeDto
                {
                    Current = current,
                    Previous = previous,
                    Value = 0,
                    HasBase = false,
                    Direction = direction
                };
            }

            var change = Math.Round(((current - previous) / previous) * 100, 1);
            return new MetricChangeDto
            {
                Current = current,
                Previous = previous,
                Value = change,
                HasBase = true,
                Direction = direction
            };
        }

        var avgCurrentTicket = currentOrdersCount > 0 ? currentInvoicedUsd / currentOrdersCount : 0m;
        var avgPrevTicket = previousOrdersCount > 0 ? previousInvoicedUsd / previousOrdersCount : 0m;

        return new DashboardMetricsDto
        {
            CompletedOrders = currentOrdersCount,
            CompletedOrdersChange = CalculateChange(currentOrdersCount, previousOrdersCount),
            TotalSalesCount = currentOrdersCount,
            TotalInvoiced = Math.Round(currentInvoicedUsd, 2),
            TotalInvoicedChange = CalculateChange(currentInvoicedUsd, previousInvoicedUsd),
            TotalCollected = Math.Round(currentCollectedUsd, 2),
            TotalCollectedChange = CalculateChange(currentCollectedUsd, previousCollectedUsd),
            CasheaFinancedAmount = Math.Round(currentCasheaFinancedUsd, 2),
            AverageOrderValue = Math.Round(avgCurrentTicket, 2),
            AverageOrderValueChange = CalculateChange(avgCurrentTicket, avgPrevTicket),
            PendingPayments = Math.Round(pendingPaymentsUsd, 2),
            ExpiredLayawaysCount = expiredLayawaysCount,
            ExpiredLayawaysAmount = Math.Round(expiredLayawaysAmountUsd, 2),
            ProductsToManufacture = productsToManufactureCount,
            PendingOrders = orders.Count(o => IsValidOrder(o) && (o.StatusString == "Generado" || o.StatusString == "Pendiente"))
        };
    }

    public async Task<IReadOnlyList<TrendDataPointDto>> GetSalesTrendAsync(int days = 30, CancellationToken cancellationToken = default)
    {
        var from = DateTime.UtcNow.AddDays(-days).Date;
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= from).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;
        var liveEurRate = allRates.FirstOrDefault(r => (r.ToCurrency == "EUR" || r.FromCurrency == "EUR") && r.IsActive)?.Rate ?? (liveUsdRate * 1.15m);

        var venezuelaOffset = TimeSpan.FromHours(-4);
        return orders
            .GroupBy(o => (o.CreatedAt + venezuelaOffset).Date)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                decimal invoiced = g.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));
                decimal collected = g.Sum(o =>
                {
                    var payments = (o.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                        .Concat(o.MixedPayments ?? Enumerable.Empty<PartialPayment>());
                    return payments.Where(p => !IsCasheaFinancedPayment(p)).Sum(p => ConvertPaymentToUsd(p, o, liveUsdRate, liveEurRate));
                });
                return new TrendDataPointDto(
                    g.Key.ToString("yyyy-MM-dd"),
                    g.Count(),
                    Math.Round(invoiced, 2),
                    Math.Round(collected, 2));
            })
            .ToList();
    }

    public async Task<IReadOnlyList<SaleTypeDataDto>> GetBySaleTypeAsync(string period = "month", CancellationToken cancellationToken = default)
    {
        var periodStart = ComputePeriodStart(period);
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= periodStart).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;

        var labels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["sistema_apartado"] = "Sistema Apartado",
            ["entrega"]          = "Entrega",
            ["encargo"]          = "Encargo",
            ["encargo_entrega"]  = "Encargo + Entrega",
            ["delivery_express"] = "Delivery Express",
            ["retiro_tienda"]    = "Retiro Tienda",
            ["retiro_almacen"]   = "Retiro Almacén",
        };

        return orders
            .GroupBy(o => string.IsNullOrWhiteSpace(o.SaleTypeString) ? "otros" : o.SaleTypeString.ToLowerInvariant())
            .Select(g => new SaleTypeDataDto(
                g.Key,
                labels.TryGetValue(g.Key, out var lbl) ? lbl : g.Key,
                g.Count(),
                Math.Round(g.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate)), 2)))
            .OrderByDescending(x => x.TotalUsd)
            .ToList();
    }

    public async Task<IReadOnlyList<TopSellerDto>> GetTopSellersAsync(string period = "month", int limit = 10, CancellationToken cancellationToken = default)
    {
        var periodStart = ComputePeriodStart(period);
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= periodStart && !string.IsNullOrWhiteSpace(o.VendorId)).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;

        return orders
            .GroupBy(o => (o.VendorId, Name: o.VendorName ?? "Sin nombre"))
            .Select(g => new TopSellerDto(g.Key.VendorId, g.Key.Name, g.Count(), Math.Round(g.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate)), 2)))
            .OrderByDescending(x => x.TotalUsd)
            .Take(limit)
            .ToList();
    }

    public async Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(string period = "month", int limit = 10, CancellationToken cancellationToken = default)
    {
        var periodStart = ComputePeriodStart(period);
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= periodStart).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;

        var categories = await _dashboardRepository.GetCategoriesAsync(cancellationToken);
        var categoriesWithAttributes = new HashSet<string>(
            categories.Where(c => c.Attributes != null && c.Attributes.Count > 0)
                      .Select(c => c.Name.Trim()),
            StringComparer.OrdinalIgnoreCase);

        return orders
            .SelectMany(o =>
            {
                var orderTotalUsd = ConvertOrderTotalToUsd(o, liveUsdRate);
                var ratio = o.Total > 0 ? (orderTotalUsd / o.Total) : 1m;
                return (o.Products ?? Enumerable.Empty<OrderProduct>()).Select(p => new
                {
                    Product = p,
                    TotalUsd = p.Total * ratio
                });
            })
            .GroupBy(x => (x.Product.Name?.Trim() ?? "Sin nombre"))
            .Select(g =>
            {
                var categoryName = g.FirstOrDefault()?.Product.Category?.Trim() ?? "";
                var hasAttributes = categoriesWithAttributes.Contains(categoryName);
                return new TopProductDto(
                    g.Key,
                    categoryName,
                    g.Sum(x => x.Product.Quantity > 0 ? x.Product.Quantity : 1),
                    Math.Round(g.Sum(x => x.TotalUsd), 2),
                    hasAttributes);
            })
            .OrderByDescending(x => x.UnitsSold)
            .Take(limit)
            .ToList();
    }

    public async Task<PipelineSnapshotDto> GetPipelineSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o =>
            IsValidOrder(o) &&
            o.StatusString != "Declinado" && o.StatusString != "Cancelado" &&
            o.StatusString != "Completado" && o.StatusString != "Completada" && o.StatusString != "Entregado"
        ).ToList();

        var allProducts = orders.SelectMany(o => o.Products ?? Enumerable.Empty<OrderProduct>()).ToList();
        return new PipelineSnapshotDto(
            Manufacturing: allProducts.Count(p => p.LocationStatusString == "FABRICACION"),
            Warehouse:     allProducts.Count(p => p.LocationStatusString is "ALMACEN" or "EN TIENDA"),
            Dispatch:      allProducts.Count(p => p.LocationStatusString == "EN DESPACHO"),
            Delivered:     allProducts.Count(p => p.LocationStatusString == "DESPACHADO"));
    }

    public async Task<IReadOnlyList<ExpiredLayawayAgeRangeDto>> GetExpiredLayawaysByAgeAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var cutoff = now.AddDays(-90);
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o =>
            IsValidOrder(o) &&
            string.Equals(o.SaleTypeString, "sistema_apartado", StringComparison.OrdinalIgnoreCase) &&
            o.CreatedAt < cutoff &&
            o.StatusString != "Entregado" && o.StatusString != "Completado" && o.StatusString != "Completada"
        ).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;
        var liveEurRate = allRates.FirstOrDefault(r => (r.ToCurrency == "EUR" || r.FromCurrency == "EUR") && r.IsActive)?.Rate ?? (liveUsdRate * 1.15m);

        var ranges = new[] {
            (key: "90-120d",  label: "3-4 meses",  min: 90,  max: 120),
            (key: "120-180d", label: "4-6 meses",  min: 120, max: 180),
            (key: "180-365d", label: "6-12 meses", min: 180, max: 365),
            (key: "365d+",    label: "+1 año",      min: 365, max: int.MaxValue),
        };

        var result = new List<ExpiredLayawayAgeRangeDto>();
        foreach (var r in ranges)
        {
            var matching = orders.Where(o => { int age = (int)(now - o.CreatedAt).TotalDays; return age >= r.min && age < r.max; }).ToList();
            decimal totalUsd = matching.Sum(o =>
            {
                var payments = (o.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                    .Concat(o.MixedPayments ?? Enumerable.Empty<PartialPayment>());
                decimal paid = payments.Where(p => !IsCasheaFinancedPayment(p)).Sum(p => ConvertPaymentToUsd(p, o, liveUsdRate, liveEurRate));
                var orderTotalUsd = ConvertOrderTotalToUsd(o, liveUsdRate);
                return Math.Max(0m, orderTotalUsd - paid);
            });
            result.Add(new ExpiredLayawayAgeRangeDto(r.key, r.label, matching.Count, Math.Round(totalUsd, 2)));
        }
        return result;
    }

    public async Task<SalesForecastResponseDto> GetSalesForecastAsync(string period = "month", CancellationToken cancellationToken = default)
    {
        var caracasOffset = TimeSpan.FromHours(-4);
        var localNow = DateTime.UtcNow.Add(caracasOffset);

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;
        var liveEurRate = allRates.FirstOrDefault(r => (r.ToCurrency == "EUR" || r.FromCurrency == "EUR") && r.IsActive)?.Rate ?? (liveUsdRate * 1.15m);

        var isYear = string.Equals(period, "year", StringComparison.OrdinalIgnoreCase);
        int historyDays = isYear ? 1095 : 180;
        var historyStartUtc = DateTime.UtcNow.AddDays(-historyDays);

        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= historyStartUtc).ToList();

        // 6-month historical baseline for collection rate
        var sixMonthsAgoUtc = DateTime.UtcNow.AddDays(-180);
        var last6MonthsOrders = orders.Where(o => o.CreatedAt >= sixMonthsAgoUtc).ToList();

        decimal sixMoInvoiced = last6MonthsOrders.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));
        decimal sixMoCollected = last6MonthsOrders.Sum(o =>
        {
            var payments = (o.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(o.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            return payments.Where(p => !IsCasheaFinancedPayment(p)).Sum(p => ConvertPaymentToUsd(p, o, liveUsdRate, liveEurRate));
        });

        decimal rawCollectionRate = sixMoInvoiced > 0 ? (sixMoCollected / sixMoInvoiced) : 0.45m;
        decimal collectionRate = Math.Clamp(rawCollectionRate, 0.35m, 0.85m);

        if (isYear)
        {
            return CalculateYearlyForecast(orders, localNow, liveUsdRate, liveEurRate, collectionRate);
        }

        return CalculateMonthlyDailyForecast(orders, localNow, liveUsdRate, liveEurRate, collectionRate);
    }

    private SalesForecastResponseDto CalculateYearlyForecast(
        List<Order> orders,
        DateTime localNow,
        decimal liveUsdRate,
        decimal liveEurRate,
        decimal collectionRate)
    {
        var venezuelaOffset = TimeSpan.FromHours(-4);
        int currentYear = localNow.Year;
        int currentMonth = localNow.Month; // 1-12

        var monthNames = new[] { "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic" };

        // 3-year historical benchmark by month
        var threeYearsAgo = currentYear - 3;
        var benchmarkByMonth = new decimal[12];
        var benchmarkCounts = new int[12];

        foreach (var o in orders)
        {
            var localDate = o.CreatedAt + venezuelaOffset;
            if (localDate.Year >= threeYearsAgo && localDate.Year < currentYear)
            {
                int mIdx = localDate.Month - 1;
                benchmarkByMonth[mIdx] += ConvertOrderTotalToUsd(o, liveUsdRate);
                benchmarkCounts[mIdx]++;
            }
        }

        for (int m = 0; m < 12; m++)
        {
            benchmarkByMonth[m] = Math.Round(benchmarkByMonth[m] / 3m, 2);
        }

        // Current year actuals by month
        var currentYearInvoiced = new decimal[12];
        var currentYearCollected = new decimal[12];

        foreach (var o in orders)
        {
            var localDate = o.CreatedAt + venezuelaOffset;
            if (localDate.Year == currentYear)
            {
                int mIdx = localDate.Month - 1;
                currentYearInvoiced[mIdx] += ConvertOrderTotalToUsd(o, liveUsdRate);

                var payments = (o.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                    .Concat(o.MixedPayments ?? Enumerable.Empty<PartialPayment>());
                currentYearCollected[mIdx] += payments.Where(p => !IsCasheaFinancedPayment(p))
                    .Sum(p => ConvertPaymentToUsd(p, o, liveUsdRate, liveEurRate));
            }
        }

        // Monthly time series for past 36 months up to the previous year to run Holt-Winters
        var monthlyHistory = new List<TimeSeriesPoint>();
        for (int yr = threeYearsAgo; yr < currentYear; yr++)
        {
            for (int m = 1; m <= 12; m++)
            {
                var dt = new DateTime(yr, m, 1, 0, 0, 0, DateTimeKind.Utc);
                decimal monthInv = orders
                    .Where(o => { var ld = o.CreatedAt + venezuelaOffset; return ld.Year == yr && ld.Month == m; })
                    .Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));
                monthlyHistory.Add(new TimeSeriesPoint(dt, monthInv));
            }
        }

        var forecastResult = _forecaster.Forecast(
            monthlyHistory,
            horizonSteps: 12,
            seasonalPeriod: 12,
            damping: 0.92);

        var points = new List<ForecastDataPointDto>(12);
        decimal totalProjInvoiced = 0m;
        decimal totalProjCollected = 0m;
        decimal totalBenchmark = benchmarkByMonth.Sum();

        for (int m = 0; m < 12; m++)
        {
            int monthNum = m + 1;
            string label = $"{monthNames[m]} {currentYear}";
            decimal benchVal = benchmarkByMonth[m];

            decimal projInv = Math.Round(forecastResult.ProjectedValues[m], 2);
            if (benchVal > 0)
            {
                projInv = Math.Round((0.6m * projInv) + (0.4m * benchVal), 2);
            }
            decimal projCol = Math.Round(projInv * collectionRate, 2);

            if (monthNum < currentMonth)
            {
                decimal realInv = Math.Round(currentYearInvoiced[m], 2);
                decimal realCol = Math.Round(currentYearCollected[m], 2);
                totalProjInvoiced += realInv;
                totalProjCollected += realCol;

                points.Add(new ForecastDataPointDto(
                    monthNames[m],
                    label,
                    realInv,
                    realCol,
                    projInv,
                    projCol,
                    benchVal > 0 ? benchVal : null));
            }
            else if (monthNum == currentMonth)
            {
                decimal realInv = Math.Round(currentYearInvoiced[m], 2);
                decimal realCol = Math.Round(currentYearCollected[m], 2);

                int daysInMonth = DateTime.DaysInMonth(currentYear, currentMonth);
                int daysPassed = Math.Max(localNow.Day, 1);
                int daysRemaining = Math.Max(daysInMonth - daysPassed, 0);

                decimal dailyRunRate = realInv / daysPassed;
                decimal estRemainingInv = Math.Round(dailyRunRate * daysRemaining * 0.92m, 2);
                decimal fullMonthProjInv = realInv + estRemainingInv;
                decimal fullMonthProjCol = realCol + Math.Round(estRemainingInv * collectionRate, 2);

                totalProjInvoiced += fullMonthProjInv;
                totalProjCollected += fullMonthProjCol;

                points.Add(new ForecastDataPointDto(
                    monthNames[m],
                    $"{label} (En curso)",
                    realInv,
                    realCol,
                    projInv,
                    projCol,
                    benchVal > 0 ? benchVal : null));
            }
            else
            {
                totalProjInvoiced += projInv;
                totalProjCollected += projCol;

                points.Add(new ForecastDataPointDto(
                    monthNames[m],
                    $"{label} (Proyectado)",
                    null,
                    null,
                    projInv,
                    projCol,
                    benchVal > 0 ? benchVal : null));
            }
        }

        var summary = new ForecastSummaryDto(
            Math.Round(totalProjInvoiced, 2),
            Math.Round(totalProjCollected, 2),
            Math.Round(totalBenchmark, 2),
            forecastResult.MapeScore);

        return new SalesForecastResponseDto(points, summary);
    }

    private SalesForecastResponseDto CalculateMonthlyDailyForecast(
        List<Order> orders,
        DateTime localNow,
        decimal liveUsdRate,
        decimal liveEurRate,
        decimal collectionRate)
    {
        var venezuelaOffset = TimeSpan.FromHours(-4);
        string todayDateStr = localNow.ToString("yyyy-MM-dd");
        string currentMonthPrefix = localNow.ToString("yyyy-MM");

        // 1. Group past orders by calendar date
        var dailyActuals = orders
            .GroupBy(o => (o.CreatedAt + venezuelaOffset).Date)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    decimal inv = g.Sum(o => ConvertOrderTotalToUsd(o, liveUsdRate));
                    decimal col = g.Sum(o =>
                    {
                        var payments = (o.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                            .Concat(o.MixedPayments ?? Enumerable.Empty<PartialPayment>());
                        return payments.Where(p => !IsCasheaFinancedPayment(p))
                            .Sum(p => ConvertPaymentToUsd(p, o, liveUsdRate, liveEurRate));
                    });
                    return (Invoiced: Math.Round(inv, 2), Collected: Math.Round(col, 2));
                });

        // 2. Build daily time series for the past 180 days up to the last day of the previous month
        var historyPoints = new List<TimeSeriesPoint>();
        var firstDayOfCurrentMonth = new DateTime(localNow.Year, localNow.Month, 1);
        var lastDayOfPrevMonth = firstDayOfCurrentMonth.AddDays(-1);

        for (int i = 180; i >= 0; i--)
        {
            var d = lastDayOfPrevMonth.AddDays(-i);
            decimal val = dailyActuals.TryGetValue(d, out var actual) ? actual.Invoiced : 0m;
            historyPoints.Add(new TimeSeriesPoint(d, val));
        }

        int daysInMonth = DateTime.DaysInMonth(localNow.Year, localNow.Month);
        int currentDay = localNow.Day;

        var forecastResult = _forecaster.Forecast(
            historyPoints,
            horizonSteps: daysInMonth,
            seasonalPeriod: 7,
            damping: 0.92);

        // 3. Assemble points: past days of this month + today anchor + future days
        var points = new List<ForecastDataPointDto>();
        decimal monthRealInvoiced = 0m;
        decimal monthRealCollected = 0m;
        decimal projectedFutureInvoiced = 0m;
        decimal projectedFutureCollected = 0m;

        for (int day = 1; day <= currentDay; day++)
        {
            var date = new DateTime(localNow.Year, localNow.Month, day);
            string dateStr = date.ToString("yyyy-MM-dd");
            bool isToday = (day == currentDay);

            dailyActuals.TryGetValue(date, out var actual);
            monthRealInvoiced += actual.Invoiced;
            monthRealCollected += actual.Collected;

            decimal projInv = Math.Round(forecastResult.ProjectedValues[day - 1], 2);
            decimal projCol = Math.Round(projInv * collectionRate, 2);

            points.Add(new ForecastDataPointDto(
                dateStr,
                dateStr,
                actual.Invoiced,
                actual.Collected,
                projInv,
                projCol,
                null));
        }

        for (int day = currentDay + 1; day <= daysInMonth; day++)
        {
            var date = new DateTime(localNow.Year, localNow.Month, day);
            string dateStr = date.ToString("yyyy-MM-dd");

            decimal projInv = Math.Round(forecastResult.ProjectedValues[day - 1], 2);
            decimal projCol = Math.Round(projInv * collectionRate, 2);

            projectedFutureInvoiced += projInv;
            projectedFutureCollected += projCol;

            points.Add(new ForecastDataPointDto(
                dateStr,
                $"{dateStr} (Proyectado)",
                null,
                null,
                projInv,
                projCol,
                null));
        }

        var summary = new ForecastSummaryDto(
            Math.Round(monthRealInvoiced + projectedFutureInvoiced, 2),
            Math.Round(monthRealCollected + projectedFutureCollected, 2),
            null,
            forecastResult.MapeScore);

        return new SalesForecastResponseDto(points, summary);
    }

    public async Task<ProductAttributeBreakdownResponseDto> GetProductAttributeBreakdownAsync(
        string productName,
        string period = "month",
        CancellationToken cancellationToken = default)
    {
        var periodStart = ComputePeriodStart(period);
        var allOrders = await _dashboardRepository.GetAllOrdersForDashboardAsync(cancellationToken);
        var orders = allOrders.Where(o => IsValidOrder(o) && o.CreatedAt >= periodStart).ToList();

        var allRates = await _dashboardRepository.GetExchangeRatesAsync(cancellationToken);
        var liveUsdRate = allRates?.FirstOrDefault(r => (r.ToCurrency == "USD" || r.FromCurrency == "USD") && r.IsActive)?.Rate ?? 1.0m;
        if (liveUsdRate <= 0) liveUsdRate = 1.0m;

        var matchingOrders = orders
            .Where(o => (o.Products ?? Enumerable.Empty<OrderProduct>())
                .Any(p => string.Equals(p.Name?.Trim(), productName.Trim(), StringComparison.OrdinalIgnoreCase)))
            .ToList();

        var matchingProductsWithUsd = orders
            .SelectMany(o =>
            {
                var orderTotalUsd = ConvertOrderTotalToUsd(o, liveUsdRate);
                var ratio = o.Total > 0 ? (orderTotalUsd / o.Total) : 1m;
                return (o.Products ?? Enumerable.Empty<OrderProduct>()).Select(p => new
                {
                    Product = p,
                    TotalUsd = p.Total * ratio
                });
            })
            .Where(x => string.Equals(x.Product.Name?.Trim(), productName.Trim(), StringComparison.OrdinalIgnoreCase))
            .ToList();

        var matchingProducts = matchingProductsWithUsd.Select(x => x.Product).ToList();
        var categoryName = matchingProducts.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p.Category))?.Category?.Trim() ?? "";
        var totalUnitsSold = matchingProducts.Sum(p => p.Quantity > 0 ? p.Quantity : 1);
        var totalInvoicedUsd = Math.Round(matchingProductsWithUsd.Sum(x => x.TotalUsd), 2);
        var averageUnitPriceUsd = totalUnitsSold > 0 ? Math.Round(totalInvoicedUsd / totalUnitsSold, 2) : 0m;
        var ordersCount = matchingOrders.Count;

        var categories = await _dashboardRepository.GetCategoriesAsync(cancellationToken);
        var category = categories.FirstOrDefault(c => string.Equals(c.Name?.Trim(), categoryName, StringComparison.OrdinalIgnoreCase));

        var attributeBreakdowns = new List<AttributeBreakdownDto>();

        if (category?.Attributes != null)
        {
            foreach (var catAttr in category.Attributes)
            {
                var optionCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                int totalUnitsWithThisAttr = 0;

                foreach (var p in matchingProducts)
                {
                    if (p.Attributes == null || p.Attributes.Count == 0) continue;

                    // Match attribute by Id or Title (case-insensitive)
                    var attrEntry = p.Attributes.FirstOrDefault(kvp =>
                        string.Equals(kvp.Key, catAttr.Id, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(kvp.Key, catAttr.Title, StringComparison.OrdinalIgnoreCase));

                    if (attrEntry.Value != null)
                    {
                        var extractedValues = ExtractAttributeValues(attrEntry.Value, catAttr);
                        if (extractedValues.Count > 0)
                        {
                            var qty = p.Quantity > 0 ? p.Quantity : 1;
                            totalUnitsWithThisAttr += qty;
                            foreach (var val in extractedValues)
                            {
                                optionCounts[val] = optionCounts.GetValueOrDefault(val) + qty;
                            }
                        }
                    }
                }

                var options = optionCounts
                    .OrderByDescending(kv => kv.Value)
                    .Select(kv => new AttributeOptionStatDto(
                        kv.Key,
                        kv.Value,
                        totalUnitsWithThisAttr > 0 ? Math.Round((decimal)kv.Value / totalUnitsWithThisAttr * 100m, 2) : 0m))
                    .ToList();

                attributeBreakdowns.Add(new AttributeBreakdownDto(
                    catAttr.Id,
                    catAttr.Title,
                    totalUnitsWithThisAttr,
                    options));
            }
        }

        return new ProductAttributeBreakdownResponseDto(
            productName,
            categoryName,
            totalUnitsSold,
            totalInvoicedUsd,
            averageUnitPriceUsd,
            ordersCount,
            attributeBreakdowns);
    }

    private static List<string> ExtractAttributeValues(object? rawValue, Ordina.Domain.Catalog.CategoryAttribute? catAttr)
    {
        var list = new List<string>();
        if (rawValue == null) return list;

        void AddValue(string? val)
        {
            if (string.IsNullOrWhiteSpace(val)) return;
            var trimmed = val.Trim();
            if (trimmed.Equals("System.Object[]", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals("System.Object", StringComparison.OrdinalIgnoreCase))
                return;

            // Resolve label from CategoryAttribute.Values if trimmed matches an Id or Label
            if (catAttr?.Values != null && catAttr.Values.Count > 0)
            {
                var match = catAttr.Values.FirstOrDefault(v =>
                    string.Equals(v.Id, trimmed, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(v.Label, trimmed, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(v.ProductId, trimmed, StringComparison.OrdinalIgnoreCase));
                if (match != null && !string.IsNullOrWhiteSpace(match.Label))
                {
                    list.Add(match.Label.Trim());
                    return;
                }
            }

            list.Add(trimmed);
        }

        if (rawValue is string strVal)
        {
            if (strVal.StartsWith('[') && strVal.EndsWith(']'))
            {
                try
                {
                    var parsed = System.Text.Json.JsonSerializer.Deserialize<List<object>>(strVal);
                    if (parsed != null)
                    {
                        foreach (var item in parsed)
                            AddValue(item?.ToString());
                        return list;
                    }
                }
                catch
                {
                    // Not valid JSON array, fallback to string
                }
            }
            AddValue(strVal);
            return list;
        }

        if (rawValue is System.Text.Json.JsonElement jsonElem)
        {
            if (jsonElem.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in jsonElem.EnumerateArray())
                {
                    if (item.ValueKind == System.Text.Json.JsonValueKind.Object && item.TryGetProperty("label", out var lbl))
                        AddValue(lbl.GetString());
                    else
                        AddValue(item.ToString());
                }
                return list;
            }
            if (jsonElem.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                if (jsonElem.TryGetProperty("label", out var lbl))
                    AddValue(lbl.GetString());
                else if (jsonElem.TryGetProperty("value", out var val))
                    AddValue(val.GetString());
                else
                    AddValue(jsonElem.ToString());
                return list;
            }
            AddValue(jsonElem.GetString() ?? jsonElem.ToString());
            return list;
        }

        if (rawValue is MongoDB.Bson.BsonArray bsonArr)
        {
            foreach (var item in bsonArr)
            {
                AddValue(item.AsString ?? item.ToString());
            }
            return list;
        }

        if (rawValue is System.Collections.IEnumerable enumerable)
        {
            foreach (var item in enumerable)
            {
                if (item != null)
                {
                    if (item is IDictionary<string, object> dict)
                    {
                        if (dict.TryGetValue("label", out var lbl) && lbl != null)
                            AddValue(lbl.ToString());
                        else if (dict.TryGetValue("value", out var val) && val != null)
                            AddValue(val.ToString());
                        else
                            AddValue(item.ToString());
                    }
                    else
                    {
                        AddValue(item.ToString());
                    }
                }
            }
            return list;
        }

        AddValue(rawValue.ToString());
        return list;
    }
}
