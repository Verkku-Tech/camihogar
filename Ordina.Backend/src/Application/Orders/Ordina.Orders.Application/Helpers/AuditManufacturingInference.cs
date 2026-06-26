using Ordina.Database.Entities.Audit;
using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application.Helpers;

public enum ManufacturingAuditEventKind
{
    None,
    Queued,
    Started,
    Completed,
    Reverted
}

public sealed record ManufacturingAuditEvent(
    ManufacturingAuditEventKind Kind,
    string ProductName,
    string SummaryLine,
    string? OldLogistic,
    string? NewLogistic,
    string? OldManufacturing,
    string? NewManufacturing);

public static class AuditManufacturingInference
{
    public const string ActionManufacturingQueued = "manufacturing_queued";
    public const string ActionManufacturingStarted = "manufacturing_started";
    public const string ActionManufacturingCompleted = "manufacturing_completed";
    public const string ActionManufacturingReverted = "manufacturing_reverted";

    public static ManufacturingAuditEvent? InferFromProductTransition(
        string productName,
        string? oldLogistic,
        string? newLogistic,
        string? oldManufacturing,
        string? newManufacturing)
    {
        var oldM = NormalizeManufacturing(oldManufacturing);
        var newM = NormalizeManufacturing(newManufacturing);

        if (oldM == "debe_fabricar" && newM == "por_fabricar")
        {
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Queued,
                productName,
                $"Envió a reporte de fabricación: {productName}",
                oldLogistic, newLogistic, oldM, newM);
        }

        if (oldM == "por_fabricar" && newM == "fabricando")
        {
            var logisticPart = FormatLogisticTransition(oldLogistic, newLogistic);
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Started,
                productName,
                $"Inició fabricación: {productName}{logisticPart}",
                oldLogistic, newLogistic, oldM, newM);
        }

        if (oldM == "fabricando" && newM is "almacen_no_fabricado")
        {
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Completed,
                productName,
                $"Completó fabricación: {productName} → En almacén",
                oldLogistic, newLogistic, oldM, newM);
        }

        if (oldM == "fabricando" && newM == "por_fabricar")
        {
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Reverted,
                productName,
                $"Devolvió a reporte de fabricación: {productName}",
                oldLogistic, newLogistic, oldM, newM);
        }

        if (string.Equals(oldLogistic, "Validado", StringComparison.Ordinal)
            && string.Equals(newLogistic, "Fabricándose", StringComparison.Ordinal)
            && newM == "fabricando")
        {
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Started,
                productName,
                $"Inició fabricación: {productName} (Validado → Fabricándose)",
                oldLogistic, newLogistic, oldM, newM);
        }

        if (string.Equals(oldLogistic, "Fabricándose", StringComparison.Ordinal)
            && string.Equals(newLogistic, "En Almacén", StringComparison.Ordinal))
        {
            return new ManufacturingAuditEvent(
                ManufacturingAuditEventKind.Completed,
                productName,
                $"Completó fabricación: {productName} → En almacén",
                oldLogistic, newLogistic, oldM, newM);
        }

        return null;
    }

    public static ManufacturingAuditEvent? InferFromConsolidatedChange(AuditChange change)
    {
        var productName = AuditLabelFormatter.ExtractProductName(change.Field);
        if (productName == null || !change.Field.Contains(".fabricacion", StringComparison.OrdinalIgnoreCase))
            return null;

        var (oldLog, oldMfg) = SplitFabricacionValue(change.OldValue);
        var (newLog, newMfg) = SplitFabricacionValue(change.NewValue);
        return InferFromProductTransition(productName, oldLog, newLog, oldMfg, newMfg);
    }

    public static List<ManufacturingAuditEvent> InferFromChanges(IReadOnlyList<AuditChange> changes)
    {
        var events = new List<ManufacturingAuditEvent>();

        foreach (var change in changes)
        {
            if (change.Field.Contains(".fabricacion", StringComparison.OrdinalIgnoreCase))
            {
                var consolidatedEvent = InferFromConsolidatedChange(change);
                if (consolidatedEvent != null)
                    events.Add(consolidatedEvent);
                continue;
            }

            var productName = AuditLabelFormatter.ExtractProductName(change.Field);
            if (productName == null)
                continue;

            string? oldLog = null, newLog = null, oldMfg = null, newMfg = null;

            if (change.Field.EndsWith(".logisticStatus", StringComparison.OrdinalIgnoreCase))
            {
                oldLog = change.OldValue;
                newLog = change.NewValue;
            }
            else if (change.Field.EndsWith(".manufacturingStatus", StringComparison.OrdinalIgnoreCase))
            {
                oldMfg = change.OldValue;
                newMfg = change.NewValue;
            }
            else
            {
                continue;
            }

            var paired = changes.FirstOrDefault(c =>
                c != change
                && AuditLabelFormatter.ExtractProductName(c.Field) == productName
                && (c.Field.EndsWith(".logisticStatus", StringComparison.OrdinalIgnoreCase)
                    || c.Field.EndsWith(".manufacturingStatus", StringComparison.OrdinalIgnoreCase)));

            if (paired != null)
            {
                if (paired.Field.EndsWith(".logisticStatus", StringComparison.OrdinalIgnoreCase))
                {
                    oldLog ??= paired.OldValue;
                    newLog ??= paired.NewValue;
                }
                else
                {
                    oldMfg ??= paired.OldValue;
                    newMfg ??= paired.NewValue;
                }
            }

            var ev = InferFromProductTransition(productName, oldLog, newLog, oldMfg, newMfg);
            if (ev != null && !events.Any(e => e.ProductName == ev.ProductName && e.Kind == ev.Kind))
                events.Add(ev);
        }

        return events
            .GroupBy(e => (e.ProductName, e.Kind))
            .Select(g => g.First())
            .ToList();
    }

    public static string ResolveAction(IReadOnlyList<ManufacturingAuditEvent> events)
    {
        if (events.Count != 1)
            return "updated";

        return events[0].Kind switch
        {
            ManufacturingAuditEventKind.Queued => ActionManufacturingQueued,
            ManufacturingAuditEventKind.Started => ActionManufacturingStarted,
            ManufacturingAuditEventKind.Completed => ActionManufacturingCompleted,
            ManufacturingAuditEventKind.Reverted => ActionManufacturingReverted,
            _ => "updated"
        };
    }

    public static string BuildSemanticSummary(
        string orderNumber,
        IReadOnlyList<AuditChange> changes,
        IReadOnlyList<ManufacturingAuditEvent> manufacturingEvents)
    {
        var parts = new List<string>();

        if (manufacturingEvents.Count > 0)
        {
            parts.AddRange(FormatEventList(manufacturingEvents.Select(e => e.SummaryLine)));
        }

        var paymentConditionChange = changes.FirstOrDefault(c =>
            c.Field is nameof(Order.PaymentCondition));
        if (paymentConditionChange != null)
        {
            var oldLabel = AuditLabelFormatter.FormatPaymentCondition(paymentConditionChange.OldValue);
            var newLabel = AuditLabelFormatter.FormatPaymentCondition(paymentConditionChange.NewValue);
            parts.Add($"Condición de pago: {oldLabel} → {newLabel}");
        }

        var paymentAdded = changes.Where(c =>
            c.Field is "mixedPayments[+]" or "partialPayments[+]");
        foreach (var added in paymentAdded)
        {
            var detail = AuditLabelFormatter.FormatPaymentListValueForDisplay(added.NewValue);
            parts.Add($"Agregó pago: {detail}");
        }

        var paymentRemoved = changes.Where(c =>
            c.Field is "mixedPayments[-]" or "partialPayments[-]");
        foreach (var removed in paymentRemoved)
        {
            var detail = AuditLabelFormatter.FormatPaymentListValueForDisplay(removed.OldValue);
            parts.Add($"Eliminó pago: {detail}");
        }

        var storeCreditChange = changes.FirstOrDefault(c =>
            c.Field is nameof(Order.AppliedStoreCreditUsd));
        if (storeCreditChange != null)
        {
            parts.Add(
                $"Crédito de tienda: ${storeCreditChange.OldValue ?? "0"} → ${storeCreditChange.NewValue ?? "0"}");
        }

        var statusChange = changes.FirstOrDefault(c =>
            c.Field is nameof(Order.Status) or "Status");
        if (statusChange != null)
        {
            var oldLabel = AuditLabelFormatter.FormatValue(statusChange.Field, statusChange.OldValue);
            var newLabel = AuditLabelFormatter.FormatValue(statusChange.Field, statusChange.NewValue);
            parts.Add($"Estado del pedido: {oldLabel} → {newLabel}");
        }

        if (parts.Count > 0)
            return string.Join(" — ", parts);

        if (changes.Any(c => c.Field.StartsWith("conciliación.", StringComparison.OrdinalIgnoreCase)))
            return $"Conciliación de pagos en pedido {orderNumber}";

        var priceChange = changes.FirstOrDefault(c => c.Field.Contains(".precio", StringComparison.OrdinalIgnoreCase));
        if (priceChange != null && changes.Count == 1)
        {
            var productName = AuditLabelFormatter.ExtractProductName(priceChange.Field) ?? "producto";
            return $"Precio {productName}: {priceChange.OldValue} → {priceChange.NewValue}";
        }

        if (changes.Count == 1)
        {
            var c = changes[0];
            var field = AuditLabelFormatter.FormatField(c.Field);
            var oldLabel = AuditLabelFormatter.FormatValue(c.Field, c.OldValue);
            var newLabel = AuditLabelFormatter.FormatValue(c.Field, c.NewValue);
            return $"Actualizó {field}: {oldLabel} → {newLabel}";
        }

        var preview = changes.Take(2)
            .Select(c =>
            {
                var field = AuditLabelFormatter.FormatField(c.Field);
                return $"{field}: {AuditLabelFormatter.FormatValue(c.Field, c.OldValue)} → {AuditLabelFormatter.FormatValue(c.Field, c.NewValue)}";
            })
            .ToList();

        var suffix = changes.Count > 2 ? $" y {changes.Count - 2} más" : "";
        return $"Actualizó el pedido {orderNumber} ({string.Join("; ", preview)}{suffix})";
    }

    private static IEnumerable<string> FormatEventList(IEnumerable<string> lines)
    {
        var list = lines.ToList();
        if (list.Count <= 2)
            return list;
        return list.Take(2).Append($"y {list.Count - 2} producto(s) más");
    }

    private static string FormatLogisticTransition(string? oldLogistic, string? newLogistic)
    {
        if (string.IsNullOrWhiteSpace(oldLogistic) || string.IsNullOrWhiteSpace(newLogistic)
            || string.Equals(oldLogistic, newLogistic, StringComparison.Ordinal))
            return "";

        var oldLabel = AuditLabelFormatter.FormatValue("logisticStatus", oldLogistic);
        var newLabel = AuditLabelFormatter.FormatValue("logisticStatus", newLogistic);
        return $" ({oldLabel} → {newLabel})";
    }

    private static (string? logistic, string? manufacturing) SplitFabricacionValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return (null, null);

        var parts = value.Split(" / ", 2, StringSplitOptions.TrimEntries);
        if (parts.Length == 2)
            return (parts[0], parts[1]);
        return (value, null);
    }

    private static string NormalizeManufacturing(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return "debe_fabricar";

        var normalized = status.Trim().ToLowerInvariant();
        if (normalized == "fabricado")
            return "almacen_no_fabricado";

        return normalized switch
        {
            "debe_fabricar" or "por_fabricar" or "fabricando" or "almacen_no_fabricado" => normalized,
            _ => "debe_fabricar"
        };
    }
}
