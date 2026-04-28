using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Audit;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public class OrderAuditLogService : IOrderAuditLogService
{
    public const string ActionCreated = "created";
    public const string ActionUpdated = "updated";
    public const string ActionDeleted = "deleted";
    public const string ActionPaymentConciliated = "payment_conciliated";
    public const string ActionItemValidated = "item_validated";

    private readonly IOrderAuditLogRepository _repository;
    private readonly ILogger<OrderAuditLogService> _logger;

    public OrderAuditLogService(
        IOrderAuditLogRepository repository,
        ILogger<OrderAuditLogService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task LogOrderCreatedAsync(Order order, string userId, string userName)
    {
        try
        {
            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionCreated,
                UserId = userId,
                UserName = userName,
                Summary = $"Creó el pedido {order.OrderNumber} para cliente {order.ClientName}",
                Changes = new List<AuditChange>(),
                Timestamp = DateTime.UtcNow
            };
            await _repository.CreateAsync(log);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar auditoría de creación de pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName)
    {
        try
        {
            var changes = BuildOrderDiff(oldOrder, newOrder);
            if (changes.Count == 0)
            {
                return;
            }

            var summary = $"Actualizó el pedido {newOrder.OrderNumber} ({changes.Count} cambio(s))";
            var statusChange = changes.FirstOrDefault(c => c.Field == nameof(Order.Status));
            if (statusChange != null)
            {
                summary += $" — estado: {statusChange.OldValue} → {statusChange.NewValue}";
            }

            var log = new OrderAuditLog
            {
                OrderId = newOrder.Id,
                OrderNumber = newOrder.OrderNumber,
                Action = ActionUpdated,
                UserId = userId,
                UserName = userName,
                Summary = summary,
                Changes = changes,
                Timestamp = DateTime.UtcNow
            };
            await _repository.CreateAsync(log);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar auditoría de actualización de pedido {OrderNumber}", newOrder.OrderNumber);
        }
    }

    public async Task LogOrderDeletedAsync(Order order, string userId, string userName)
    {
        try
        {
            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionDeleted,
                UserId = userId,
                UserName = userName,
                Summary = $"Eliminó el pedido {order.OrderNumber} (cliente {order.ClientName})",
                Changes = new List<AuditChange>(),
                Timestamp = DateTime.UtcNow
            };
            await _repository.CreateAsync(log);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar auditoría de eliminación de pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogItemValidatedAsync(Order order, string itemId, string userId, string userName)
    {
        try
        {
            var product = order.Products.FirstOrDefault(p => p.Id == itemId);
            var productName = product?.Name ?? itemId;
            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionItemValidated,
                UserId = userId,
                UserName = userName,
                Summary = $"Validó ítem en pedido {order.OrderNumber}: {productName}",
                Changes = new List<AuditChange>
                {
                    new()
                    {
                        Field = "product.logisticStatus",
                        OldValue = "(previo)",
                        NewValue = "Validado"
                    }
                },
                Timestamp = DateTime.UtcNow
            };
            await _repository.CreateAsync(log);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar auditoría de validación de ítem en pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogPaymentsConciliatedAsync(
        Order orderBefore,
        Order orderAfter,
        IReadOnlyList<ConciliatePaymentRequestDto> requests,
        string userId,
        string userName)
    {
        try
        {
            var changes = new List<AuditChange>();
            foreach (var req in requests.Where(r => r.OrderId == orderAfter.Id))
            {
                var label = req.PaymentType switch
                {
                    "main" => "Pago principal",
                    "partial" => $"Pago parcial índice {req.PaymentIndex}",
                    "mixed" => $"Pago mixto índice {req.PaymentIndex}",
                    _ => req.PaymentType
                };

                changes.Add(new AuditChange
                {
                    Field = $"conciliación.{label}",
                    OldValue = DescribeConciliationState(orderBefore, req),
                    NewValue = req.IsConciliated ? "Conciliado" : "No conciliado"
                });
            }

            if (changes.Count == 0)
            {
                return;
            }

            var log = new OrderAuditLog
            {
                OrderId = orderAfter.Id,
                OrderNumber = orderAfter.OrderNumber,
                Action = ActionPaymentConciliated,
                UserId = userId,
                UserName = userName,
                Summary = $"Conciliación de pagos en pedido {orderAfter.OrderNumber}",
                Changes = changes,
                Timestamp = DateTime.UtcNow
            };
            await _repository.CreateAsync(log);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo registrar auditoría de conciliación en pedido {OrderNumber}", orderAfter.OrderNumber);
        }
    }

    public async Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc)
    {
        var orderForFilter = string.IsNullOrWhiteSpace(orderNumber)
            ? null
            : NormalizeOrderNumberForFilter(orderNumber);
        var (items, total) = await _repository.GetPagedAsync(
            page, pageSize, userId, orderForFilter, action, fromUtc, toUtc);
        var totalPages = (int)Math.Ceiling(total / (double)Math.Max(1, pageSize));

        return new PagedAuditLogsResponseDto
        {
            Items = items.Select(MapToDto),
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    private static string? DescribeConciliationState(Order order, ConciliatePaymentRequestDto req)
    {
        try
        {
            if (req.PaymentType == "main")
            {
                return order.PaymentDetails?.IsConciliated == true ? "Conciliado" : "No conciliado";
            }

            if (req.PaymentType == "partial" && order.PartialPayments != null &&
                req.PaymentIndex >= 0 && req.PaymentIndex < order.PartialPayments.Count)
            {
                var pd = order.PartialPayments[req.PaymentIndex].PaymentDetails;
                return pd?.IsConciliated == true ? "Conciliado" : "No conciliado";
            }

            if (req.PaymentType == "mixed" && order.MixedPayments != null &&
                req.PaymentIndex >= 0 && req.PaymentIndex < order.MixedPayments.Count)
            {
                var pd = order.MixedPayments[req.PaymentIndex].PaymentDetails;
                return pd?.IsConciliated == true ? "Conciliado" : "No conciliado";
            }
        }
        catch
        {
            // ignore
        }

        return "?";
    }

    private static OrderAuditLogDto MapToDto(OrderAuditLog e) => new()
    {
        Id = e.Id,
        OrderId = e.OrderId,
        OrderNumber = e.OrderNumber,
        Action = e.Action,
        UserId = e.UserId,
        UserName = e.UserName,
        Summary = e.Summary,
        Changes = e.Changes.Select(c => new AuditChangeDto
        {
            Field = c.Field,
            OldValue = c.OldValue,
            NewValue = c.NewValue
        }).ToList(),
        Timestamp = e.Timestamp
    };

    internal static List<AuditChange> BuildOrderDiff(Order oldOrder, Order newOrder)
    {
        var changes = new List<AuditChange>();

        void AddIfChanged(string field, string? oldVal, string? newVal)
        {
            if (oldVal == newVal) return;
            changes.Add(new AuditChange { Field = field, OldValue = oldVal, NewValue = newVal });
        }

        AddIfChanged(nameof(Order.Status), oldOrder.Status, newOrder.Status);
        AddIfChanged(nameof(Order.ClientName), oldOrder.ClientName, newOrder.ClientName);
        AddIfChanged(nameof(Order.ClientId), oldOrder.ClientId, newOrder.ClientId);
        AddIfChanged(nameof(Order.VendorName), oldOrder.VendorName, newOrder.VendorName);
        AddIfChanged(nameof(Order.VendorId), oldOrder.VendorId, newOrder.VendorId);
        AddIfChanged(nameof(Order.ReferrerName), oldOrder.ReferrerName, newOrder.ReferrerName);
        AddIfChanged(nameof(Order.ReferrerId), oldOrder.ReferrerId, newOrder.ReferrerId);
        AddIfChanged(nameof(Order.Subtotal), D(oldOrder.Subtotal), D(newOrder.Subtotal));
        AddIfChanged(nameof(Order.TaxAmount), D(oldOrder.TaxAmount), D(newOrder.TaxAmount));
        AddIfChanged(nameof(Order.DeliveryCost), D(oldOrder.DeliveryCost), D(newOrder.DeliveryCost));
        AddIfChanged(nameof(Order.Total), D(oldOrder.Total), D(newOrder.Total));
        AddIfChanged(nameof(Order.PaymentType), oldOrder.PaymentType, newOrder.PaymentType);
        AddIfChanged(nameof(Order.PaymentMethod), oldOrder.PaymentMethod, newOrder.PaymentMethod);
        AddIfChanged(nameof(Order.Observations), oldOrder.Observations, newOrder.Observations);
        AddIfChanged(nameof(Order.SaleType), oldOrder.SaleType, newOrder.SaleType);
        AddIfChanged(nameof(Order.DeliveryType), oldOrder.DeliveryType, newOrder.DeliveryType);
        AddIfChanged(nameof(Order.DeliveryZone), oldOrder.DeliveryZone, newOrder.DeliveryZone);
        AddIfChanged(nameof(Order.DeliveryAddress), oldOrder.DeliveryAddress, newOrder.DeliveryAddress);
        AddIfChanged(nameof(Order.HasDelivery), oldOrder.HasDelivery.ToString(), newOrder.HasDelivery.ToString());

        var oldPd = FormatPaymentDetailsFull(oldOrder.PaymentDetails);
        var newPd = FormatPaymentDetailsFull(newOrder.PaymentDetails);
        AddIfChanged("paymentDetails", oldPd, newPd);

        DiffPartialPayments(changes, "partialPayments", oldOrder.PartialPayments, newOrder.PartialPayments);
        DiffPartialPayments(changes, "mixedPayments", oldOrder.MixedPayments, newOrder.MixedPayments);

        var oldProductsSig = ProductsSignature(oldOrder.Products);
        var newProductsSig = ProductsSignature(newOrder.Products);
        AddIfChanged("products", oldProductsSig, newProductsSig);

        return changes;
    }

    private static string D(decimal v) => v.ToString(CultureInfo.InvariantCulture);

    private static void DiffPartialPayments(
        List<AuditChange> changes,
        string listName,
        List<PartialPayment>? oldList,
        List<PartialPayment>? newList)
    {
        oldList ??= new List<PartialPayment>();
        newList ??= new List<PartialPayment>();

        var oldById = oldList.ToDictionary(p => p.Id, p => p);
        var newById = newList.ToDictionary(p => p.Id, p => p);

        foreach (var id in oldById.Keys.Union(newById.Keys))
        {
            oldById.TryGetValue(id, out var op);
            newById.TryGetValue(id, out var np);

            if (op == null && np != null)
            {
                changes.Add(new AuditChange
                {
                    Field = $"{listName}[+]",
                    OldValue = null,
                    NewValue = FormatPartialPaymentFull(np)
                });
            }
            else if (op != null && np == null)
            {
                changes.Add(new AuditChange
                {
                    Field = $"{listName}[-]",
                    OldValue = FormatPartialPaymentFull(op),
                    NewValue = null
                });
            }
            else if (op != null && np != null)
            {
                var oldFmt = FormatPartialPaymentFull(op);
                var newFmt = FormatPartialPaymentFull(np);
                if (oldFmt != newFmt)
                {
                    changes.Add(new AuditChange
                    {
                        Field = $"{listName}[{id[..Math.Min(8, id.Length)]}…]",
                        OldValue = oldFmt,
                        NewValue = newFmt
                    });
                }
            }
        }
    }

    private static string ProductsSignature(List<OrderProduct> products)
    {
        if (products == null || products.Count == 0)
        {
            return "(sin productos)";
        }

        return string.Join(
            "\n",
            products
                .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(p => p.Id, StringComparer.Ordinal)
                .Select(p =>
                {
                    var label = string.IsNullOrWhiteSpace(p.Name) ? p.Id : p.Name;
                    return $"{label} × {p.Quantity} — {p.LogisticStatus}";
                }));
    }

    /// <summary>
    /// Alinea el filtro con ORD-xxx / PRE- / PCF- + 3 dígitos (mismo criterio que en el front).
    /// </summary>
    private static string NormalizeOrderNumberForFilter(string orderNumber)
    {
        var s = orderNumber.Trim();
        if (s.Length == 0)
        {
            return s;
        }

        static string Pad3(int n) => n.ToString("D3", CultureInfo.InvariantCulture);

        var m = Regex.Match(s, @"^(?i)(ord|pre|pcf)\s*-\s*0*(\d+)$");
        if (m.Success && int.TryParse(m.Groups[2].Value, out var n) && n >= 0)
        {
            return m.Groups[1].Value.ToUpperInvariant() switch
            {
                "ORD" => $"ORD-{Pad3(n)}",
                "PRE" => $"PRE-{Pad3(n)}",
                "PCF" => $"PCF-{Pad3(n)}",
                _ => s
            };
        }

        if (Regex.IsMatch(s, @"^\d+$") && int.TryParse(s, out var only) && only >= 0)
        {
            return $"ORD-{Pad3(only)}";
        }

        return s;
    }

    private static string FormatPaymentDetailsFull(PaymentDetails? d)
    {
        if (d == null)
        {
            return "(ninguno)";
        }

        var sb = new StringBuilder();
        sb.Append("Conciliado=").Append(d.IsConciliated).Append("; ");
        AppendIf(sb, "PM ref", d.PagomovilReference);
        AppendIf(sb, "PM bank", d.PagomovilBank);
        AppendIf(sb, "PM phone", d.PagomovilPhone);
        AppendIf(sb, "PM date", d.PagomovilDate);
        AppendIf(sb, "Transf bank", d.TransferenciaBank);
        AppendIf(sb, "Transf ref", d.TransferenciaReference);
        AppendIf(sb, "Transf date", d.TransferenciaDate);
        AppendIf(sb, "Cash amt", d.CashAmount);
        AppendIf(sb, "Cash curr", d.CashCurrency);
        if (d.CashReceived.HasValue)
        {
            sb.Append("CashReceived=").Append(d.CashReceived.Value).Append("; ");
        }

        if (d.ExchangeRate.HasValue)
        {
            sb.Append("Tipo=").Append(d.ExchangeRate.Value).Append("; ");
        }

        AppendIf(sb, "Orig amt", d.OriginalAmount?.ToString(CultureInfo.InvariantCulture));
        AppendIf(sb, "Orig curr", d.OriginalCurrency);
        AppendIf(sb, "Cuenta", d.AccountId);
        AppendIf(sb, "Núm cuenta", d.AccountNumber);
        AppendIf(sb, "Banco", d.Bank);
        AppendIf(sb, "Email", d.Email);
        AppendIf(sb, "Wallet", d.Wallet);
        AppendIf(sb, "Envía (Zelle)", d.Envia);
        return sb.ToString();
    }

    private static void AppendIf(StringBuilder sb, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            sb.Append(label).Append('=').Append(value).Append("; ");
        }
    }

    private static void AppendIf(StringBuilder sb, string label, decimal? value)
    {
        if (value.HasValue)
        {
            sb.Append(label).Append('=').Append(value.Value.ToString(CultureInfo.InvariantCulture)).Append("; ");
        }
    }

    private static string FormatPartialPaymentFull(PartialPayment p)
    {
        var sb = new StringBuilder();
        sb.Append("Id=").Append(p.Id).Append("; ");
        sb.Append("Monto=").Append(p.Amount.ToString(CultureInfo.InvariantCulture)).Append("; ");
        sb.Append("Método=").Append(p.Method).Append("; ");
        sb.Append("Fecha=").Append(p.Date.ToString("o", CultureInfo.InvariantCulture)).Append("; ");
        sb.Append("Detalle: ").Append(FormatPaymentDetailsFull(p.PaymentDetails));
        return sb.ToString();
    }
}
