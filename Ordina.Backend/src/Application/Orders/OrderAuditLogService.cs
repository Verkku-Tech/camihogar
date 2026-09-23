using System.Globalization;
using System.Text;
using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Orders.Helpers;
using Ordina.Domain.Orders;

namespace Ordina.Application.Orders;

public class OrderAuditLogService(
    IOrderAuditLogRepository repository,
    ILogger<OrderAuditLogService> logger,
    TimeProvider? timeProvider = null) : IOrderAuditLogService
{
    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;

    public const string ActionCreated = "created";
    public const string ActionUpdated = "updated";
    public const string ActionDeleted = "deleted";
    public const string ActionPaymentConciliated = "payment_conciliated";
    public const string ActionItemValidated = "item_validated";
    public const string ActionOrderDeclined = "order_declined";
    public const string ActionOrderDeclineReverted = "order_decline_reverted";

    public async Task LogOrderCreatedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default)
    {
        try
        {
            var changes = BuildCreatedPaymentChanges(order);
            var hasPayments = changes.Count > 0;
            var now = _timeProvider.GetUtcNow().UtcDateTime;

            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionCreated,
                UserId = userId,
                UserName = userName,
                Summary = hasPayments
                    ? $"Creó el pedido {order.OrderNumber} para cliente {order.ClientName}. Agregó pago durante la creación del pedido."
                    : $"Creó el pedido {order.OrderNumber} para cliente {order.ClientName}",
                Changes = changes,
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de creación de pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName, CancellationToken cancellationToken = default)
    {
        try
        {
            var changes = BuildOrderDiff(oldOrder, newOrder);
            if (changes.Count == 0)
            {
                return;
            }

            var manufacturingEvents = AuditManufacturingInference.InferFromChanges(changes);
            var summary = AuditManufacturingInference.BuildSemanticSummary(
                newOrder.OrderNumber ?? string.Empty,
                changes,
                manufacturingEvents);
            var action = AuditManufacturingInference.ResolveAction(manufacturingEvents);
            var now = _timeProvider.GetUtcNow().UtcDateTime;

            var log = new OrderAuditLog
            {
                OrderId = newOrder.Id,
                OrderNumber = newOrder.OrderNumber ?? string.Empty,
                Action = action,
                UserId = userId,
                UserName = userName,
                Summary = summary,
                Changes = changes,
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de actualización de pedido {OrderNumber}", newOrder.OrderNumber);
        }
    }

    public async Task LogOrderDeletedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default)
    {
        try
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionDeleted,
                UserId = userId,
                UserName = userName,
                Summary = $"Eliminó el pedido {order.OrderNumber} (cliente {order.ClientName})",
                Changes = [],
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de eliminación de pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason, CancellationToken cancellationToken = default)
    {
        try
        {
            var summary = string.IsNullOrWhiteSpace(declineReason)
                ? $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName})"
                : $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName}). Razón: {declineReason}";
            var now = _timeProvider.GetUtcNow().UtcDateTime;

            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionOrderDeclined,
                UserId = userId,
                UserName = userName,
                Summary = summary,
                Changes = [],
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de declinación del pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogOrderDeclineRevertedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default)
    {
        try
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionOrderDeclineReverted,
                UserId = userId,
                UserName = userName,
                Summary = $"Reactivó el pedido {order.OrderNumber} (cliente {order.ClientName}); vuelve a estado Generado",
                Changes = [],
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de reactivación del pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogItemValidatedAsync(
        Order order,
        string itemId,
        string userId,
        string userName,
        string? previousLogisticStatus = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var product = order.Products.FirstOrDefault(p => p.Id == itemId);
            var productName = product?.Name ?? itemId;
            var oldStatus = previousLogisticStatus ?? "Generado";
            var newStatus = product?.LogisticStatusString ?? "Validado";
            var oldLabel = AuditLabelFormatter.FormatValue("logisticStatus", oldStatus);
            var newLabel = AuditLabelFormatter.FormatValue("logisticStatus", newStatus);
            var now = _timeProvider.GetUtcNow().UtcDateTime;

            var log = new OrderAuditLog
            {
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                Action = ActionItemValidated,
                UserId = userId,
                UserName = userName,
                Summary = $"Validó ítem en pedido {order.OrderNumber}: {productName} ({oldLabel} → {newLabel})",
                Changes =
                [
                    new AuditChange
                    {
                        Field = $"producto[{productName}].logisticStatus",
                        OldValue = oldStatus,
                        NewValue = newStatus
                    }
                ],
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de validación de ítem en pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task LogPaymentsConciliatedAsync(
        Order orderBefore,
        Order orderAfter,
        IReadOnlyList<ConciliatePaymentRequestDto> requests,
        string userId,
        string userName,
        CancellationToken cancellationToken = default)
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

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var log = new OrderAuditLog
            {
                OrderId = orderAfter.Id,
                OrderNumber = orderAfter.OrderNumber,
                Action = ActionPaymentConciliated,
                UserId = userId,
                UserName = userName,
                Summary = $"Conciliación de pagos en pedido {orderAfter.OrderNumber}",
                Changes = changes,
                Timestamp = now
            };
            await repository.AddAsync(log, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "No se pudo registrar auditoría de conciliación en pedido {OrderNumber}", orderAfter.OrderNumber);
        }
    }

    public async Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc,
        bool sortAscending = false,
        CancellationToken cancellationToken = default)
    {
        var orderForFilter = string.IsNullOrWhiteSpace(orderNumber)
            ? null
            : OrderNumberNormalizer.Normalize(orderNumber);

        var result = await repository.GetPagedLogsAsync(
            page, pageSize, userId, orderForFilter, action, fromUtc, toUtc, sortAscending, cancellationToken);

        var totalPages = (int)Math.Ceiling(result.TotalCount / (double)Math.Max(1, result.PageSize));

        return new PagedAuditLogsResponseDto(
            Items: result.Items.Select(MapToDto).ToList(),
            Page: result.Page,
            PageSize: result.PageSize,
            TotalCount: result.TotalCount,
            TotalPages: totalPages);
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

    private static OrderAuditLogDto MapToDto(OrderAuditLog e)
    {
        var rawChanges = e.Changes ?? [];
        var summary = rawChanges.Count > 0
            ? AuditManufacturingInference.BuildSemanticSummary(
                e.OrderNumber ?? string.Empty,
                rawChanges,
                AuditManufacturingInference.InferFromChanges(rawChanges),
                e.Action)
            : e.Summary;

        return new OrderAuditLogDto(
            Id: e.Id,
            OrderId: e.OrderId,
            OrderNumber: e.OrderNumber,
            Action: e.Action,
            UserId: e.UserId,
            UserName: e.UserName,
            Summary: summary,
            Changes: rawChanges.Select(AuditLabelFormatter.EnrichChangeDto).ToList(),
            Timestamp: e.Timestamp);
    }

    private static List<AuditChange> BuildCreatedPaymentChanges(Order order)
    {
        var changes = new List<AuditChange>();

        var listPayments = new List<(string ListName, PartialPayment Payment)>();
        if (order.PartialPayments != null)
            listPayments.AddRange(order.PartialPayments.Select(p => ("partialPayments", p)));
        if (order.MixedPayments != null)
            listPayments.AddRange(order.MixedPayments.Select(p => ("mixedPayments", p)));

        var loggable = listPayments
            .Where(x => !IsCasheaFinancingStub(x.Payment))
            .ToList();

        foreach (var (listName, payment) in loggable)
        {
            changes.Add(new AuditChange
            {
                Field = $"{listName}[+]",
                OldValue = null,
                NewValue = FormatPartialPaymentFull(payment)
            });
        }

        if (loggable.Count == 0 && order.PaymentDetails != null)
        {
            changes.Add(new AuditChange
            {
                Field = "paymentDetails",
                OldValue = "(ninguno)",
                NewValue = FormatPaymentDetailsFull(order.PaymentDetails)
            });
        }

        return changes;
    }

    internal static List<AuditChange> BuildOrderDiff(Order oldOrder, Order newOrder)
    {
        var changes = new List<AuditChange>();

        void AddIfChanged(string field, string? oldVal, string? newVal)
        {
            if (oldVal == newVal) return;
            changes.Add(new AuditChange { Field = field, OldValue = oldVal, NewValue = newVal });
        }

        AddIfChanged(nameof(Order.Status), oldOrder.StatusString, newOrder.StatusString);
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
        AddIfChanged(nameof(Order.PaymentType), oldOrder.PaymentTypeString, newOrder.PaymentTypeString);
        AddIfChanged(nameof(Order.PaymentMethod), oldOrder.PaymentMethod, newOrder.PaymentMethod);
        AddIfChanged(nameof(Order.PaymentCondition), oldOrder.PaymentCondition, newOrder.PaymentCondition);
        AddIfChanged(nameof(Order.Observations), oldOrder.Observations, newOrder.Observations);
        AddIfChanged(nameof(Order.DispatchObservations), oldOrder.DispatchObservations, newOrder.DispatchObservations);
        AddIfChanged(
            nameof(Order.ProductDiscountTotal),
            FormatNullableDecimal(oldOrder.ProductDiscountTotal),
            FormatNullableDecimal(newOrder.ProductDiscountTotal));
        AddIfChanged(
            "generalDiscount",
            AuditLabelFormatter.FormatGeneralDiscount(oldOrder),
            AuditLabelFormatter.FormatGeneralDiscount(newOrder));
        AddIfChanged(
            nameof(Order.ProductMarkups),
            AuditLabelFormatter.FormatProductMarkups(oldOrder.ProductMarkups),
            AuditLabelFormatter.FormatProductMarkups(newOrder.ProductMarkups));
        AddIfChanged(nameof(Order.SaleType), oldOrder.SaleTypeString, newOrder.SaleTypeString);
        AddIfChanged(nameof(Order.DeliveryType), oldOrder.DeliveryTypeString, newOrder.DeliveryTypeString);
        AddIfChanged(nameof(Order.DeliveryZone), oldOrder.DeliveryZone, newOrder.DeliveryZone);
        AddIfChanged(nameof(Order.DeliveryAddress), oldOrder.DeliveryAddress, newOrder.DeliveryAddress);
        AddIfChanged(nameof(Order.HasDelivery), oldOrder.HasDelivery.ToString(), newOrder.HasDelivery.ToString());

        var oldPd = FormatPaymentDetailsFull(oldOrder.PaymentDetails);
        var newPd = FormatPaymentDetailsFull(newOrder.PaymentDetails);
        AddIfChanged("paymentDetails", oldPd, newPd);

        DiffPartialPayments(changes, "partialPayments", oldOrder.PartialPayments, newOrder.PartialPayments);
        DiffPartialPayments(changes, "mixedPayments", oldOrder.MixedPayments, newOrder.MixedPayments);

        DiffProductStatuses(changes, oldOrder.Products, newOrder.Products);

        return changes;
    }

    private static string D(decimal v) => v.ToString(CultureInfo.InvariantCulture);

    private static string? FormatNullableDecimal(decimal? v) =>
        v.HasValue ? D(v.Value) : null;

    private static void DiffPartialPayments(
        List<AuditChange> changes,
        string listName,
        List<PartialPayment>? oldList,
        List<PartialPayment>? newList)
    {
        oldList ??= [];
        newList ??= [];

        var oldById = oldList.ToDictionary(p => p.Id, p => p);
        var newById = newList.ToDictionary(p => p.Id, p => p);

        var suppressedIds = new HashSet<string>(StringComparer.Ordinal);
        var removedIds = oldById.Keys.Except(newById.Keys).ToList();
        var addedIds = newById.Keys.Except(oldById.Keys).ToList();

        foreach (var oldId in removedIds)
        {
            var op = oldById[oldId];
            if (!IsCasheaFinancingStub(op))
                continue;

            foreach (var newId in addedIds)
            {
                if (suppressedIds.Contains(newId))
                    continue;

                var np = newById[newId];
                if (!AreCasheaFinancingStubsEquivalent(op, np))
                    continue;

                suppressedIds.Add(oldId);
                suppressedIds.Add(newId);
                break;
            }
        }

        foreach (var id in oldById.Keys.Union(newById.Keys))
        {
            if (suppressedIds.Contains(id))
                continue;

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

    private static void DiffProductStatuses(
        List<AuditChange> changes,
        List<OrderProduct>? oldProducts,
        List<OrderProduct>? newProducts)
    {
        oldProducts ??= [];
        newProducts ??= [];

        var oldById = oldProducts.ToDictionary(p => p.Id, p => p);
        var newById = newProducts.ToDictionary(p => p.Id, p => p);

        foreach (var id in oldById.Keys.Except(newById.Keys))
        {
            var op = oldById[id];
            var label = string.IsNullOrWhiteSpace(op.Name) ? op.Id : op.Name;
            changes.Add(new AuditChange
            {
                Field = $"producto[{label}]",
                OldValue = $"{label} × {op.Quantity} — {op.LogisticStatusString}",
                NewValue = "(eliminado)"
            });
        }

        foreach (var id in newById.Keys.Except(oldById.Keys))
        {
            var np = newById[id];
            var label = string.IsNullOrWhiteSpace(np.Name) ? np.Id : np.Name;
            changes.Add(new AuditChange
            {
                Field = $"producto[{label}]",
                OldValue = null,
                NewValue = $"{label} × {np.Quantity} — {np.LogisticStatusString}"
            });
        }

        foreach (var id in oldById.Keys.Intersect(newById.Keys))
        {
            var op = oldById[id];
            var np = newById[id];
            var label = string.IsNullOrWhiteSpace(np.Name) ? np.Id : np.Name;

            if (op.Quantity != np.Quantity)
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].cantidad",
                    OldValue = op.Quantity.ToString(CultureInfo.InvariantCulture),
                    NewValue = np.Quantity.ToString(CultureInfo.InvariantCulture)
                });
            }

            var logisticChanged = !string.Equals(op.LogisticStatusString, np.LogisticStatusString, StringComparison.Ordinal);
            var manufacturingChanged = !string.Equals(
                op.ManufacturingStatusString,
                np.ManufacturingStatusString,
                StringComparison.OrdinalIgnoreCase);
            var locationChanged = !string.Equals(
                op.LocationStatusString,
                np.LocationStatusString,
                StringComparison.OrdinalIgnoreCase);

            if (logisticChanged && manufacturingChanged)
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].fabricacion",
                    OldValue = $"{op.LogisticStatusString ?? "(sin estado)"} / {op.ManufacturingStatusString ?? "(sin estado)"}",
                    NewValue = $"{np.LogisticStatusString ?? "(sin estado)"} / {np.ManufacturingStatusString ?? "(sin estado)"}"
                });
            }
            else
            {
                if (logisticChanged)
                {
                    changes.Add(new AuditChange
                    {
                        Field = $"producto[{label}].logisticStatus",
                        OldValue = op.LogisticStatusString ?? "(sin estado)",
                        NewValue = np.LogisticStatusString ?? "(sin estado)"
                    });
                }

                if (manufacturingChanged)
                {
                    changes.Add(new AuditChange
                    {
                        Field = $"producto[{label}].manufacturingStatus",
                        OldValue = op.ManufacturingStatusString ?? "(sin estado)",
                        NewValue = np.ManufacturingStatusString ?? "(sin estado)"
                    });
                }
            }

            if (locationChanged)
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].locationStatus",
                    OldValue = op.LocationStatusString ?? "(sin estado)",
                    NewValue = np.LocationStatusString ?? "(sin estado)"
                });
            }

            if (!string.Equals(op.Name, np.Name, StringComparison.Ordinal))
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].nombre",
                    OldValue = op.Name,
                    NewValue = np.Name
                });
            }

            var priceChanged = op.Price != np.Price
                || !string.Equals(op.PriceCurrency, np.PriceCurrency, StringComparison.OrdinalIgnoreCase)
                || op.Total != np.Total;
            if (priceChanged)
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].precio",
                    OldValue = AuditLabelFormatter.FormatProductPriceLine(op),
                    NewValue = AuditLabelFormatter.FormatProductPriceLine(np)
                });
            }

            var oldDiscount = op.Discount?.ToString(CultureInfo.InvariantCulture) ?? "0";
            var newDiscount = np.Discount?.ToString(CultureInfo.InvariantCulture) ?? "0";
            if (oldDiscount != newDiscount)
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].descuento",
                    OldValue = oldDiscount,
                    NewValue = newDiscount
                });
            }

            if (!string.Equals(op.Observations, np.Observations, StringComparison.Ordinal))
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].observaciones",
                    OldValue = op.Observations ?? "(vacío)",
                    NewValue = np.Observations ?? "(vacío)"
                });
            }

            var oldAttrs = AuditLabelFormatter.AttributesFingerprint(op.Attributes);
            var newAttrs = AuditLabelFormatter.AttributesFingerprint(np.Attributes);
            if (!string.Equals(oldAttrs, newAttrs, StringComparison.Ordinal))
            {
                changes.Add(new AuditChange
                {
                    Field = $"producto[{label}].atributos",
                    OldValue = string.IsNullOrEmpty(oldAttrs) ? "(sin atributos)" : oldAttrs,
                    NewValue = string.IsNullOrEmpty(newAttrs) ? "(sin atributos)" : newAttrs
                });
            }
        }
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

    private static void FormatPaymentDetailsFullAppend(StringBuilder sb, string label, decimal? value)
    {
        if (value.HasValue)
        {
            sb.Append(label).Append('=').Append(value.Value.ToString(CultureInfo.InvariantCulture)).Append("; ");
        }
    }

    private static string FormatPartialPaymentFull(PartialPayment p)
    {
        var (amount, currency) = AuditLabelFormatter.GetOriginalPaymentDisplay(p);
        var sb = new StringBuilder();
        sb.Append("Id=").Append(p.Id).Append("; ");
        sb.Append("Monto=").Append(Math.Round(amount, 2, MidpointRounding.AwayFromZero).ToString(CultureInfo.InvariantCulture)).Append("; ");
        sb.Append("Moneda=").Append(currency).Append("; ");
        sb.Append("Método=").Append(p.Method).Append("; ");
        sb.Append("Fecha=").Append(p.Date.ToString("o", CultureInfo.InvariantCulture)).Append("; ");
        sb.Append("Detalle: ").Append(FormatPaymentDetailsFull(p.PaymentDetails));
        return sb.ToString();
    }

    private static bool IsCasheaFinancingStub(PartialPayment payment) =>
        payment.PaymentDetails?.CasheaFinancedPortion == true
        || string.Equals(payment.Method, "Cashea (financiación)", StringComparison.Ordinal);

    private static bool AreCasheaFinancingStubsEquivalent(PartialPayment a, PartialPayment b)
    {
        if (!IsCasheaFinancingStub(a) || !IsCasheaFinancingStub(b))
            return false;

        if (!string.Equals(a.Method?.Trim(), b.Method?.Trim(), StringComparison.OrdinalIgnoreCase))
            return false;

        var (amtA, curA) = AuditLabelFormatter.GetOriginalPaymentDisplay(a);
        var (amtB, curB) = AuditLabelFormatter.GetOriginalPaymentDisplay(b);

        if (!string.Equals(curA, curB, StringComparison.OrdinalIgnoreCase))
            return false;

        return Math.Abs(amtA - amtB) <= 0.02m;
    }
}
