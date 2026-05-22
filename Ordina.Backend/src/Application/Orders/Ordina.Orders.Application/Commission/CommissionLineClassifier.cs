using System.Text.Json;
using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application.Commission;

public static class CommissionLineClassifier
{
    private sealed class BaselineSlot
    {
        public OrderProduct Product { get; }
        public bool Matched { get; set; }

        public BaselineSlot(OrderProduct product) => Product = product;
    }

    /// <summary>
    /// Clasifica cada línea final y asigna CatalogProductId. Las líneas baseline sin pareja no generan fila (eliminadas).
    /// </summary>
    public static void ClassifyLines(IReadOnlyList<OrderProduct> baseline, IList<OrderProduct> final)
    {
        var slots = baseline.Select(b => new BaselineSlot(b)).ToList();

        foreach (var line in final)
        {
            line.CatalogProductId = GetCatalogProductId(line.Id);

            var exactIdx = FindExactMatch(slots, line);
            if (exactIdx >= 0)
            {
                slots[exactIdx].Matched = true;
                line.CommissionLineSource = CommissionLineSources.ReservationUnchanged;
            }
        }

        foreach (var line in final.Where(l => l.CommissionLineSource == null))
        {
            var modifiedIdx = FindModifiedMatch(slots, line);
            if (modifiedIdx >= 0)
            {
                slots[modifiedIdx].Matched = true;
                line.CommissionLineSource = CommissionLineSources.StoreModified;
            }
        }

        var removalCount = slots.Count(s => !s.Matched);
        var remainingRemovals = removalCount;

        foreach (var line in final.Where(l => l.CommissionLineSource == null))
        {
            if (remainingRemovals > 0)
            {
                line.CommissionLineSource = CommissionLineSources.StoreSubstitution;
                remainingRemovals--;
            }
            else
            {
                line.CommissionLineSource = CommissionLineSources.StoreAdded;
            }
        }
    }

    public static bool HasAnyNonUnchangedLine(IEnumerable<OrderProduct> final) =>
        final.Any(p => p.CommissionLineSource != CommissionLineSources.ReservationUnchanged);

    /// <summary>
    /// Prefijo estable del id de línea: {catalogId}-{timestamp}-{random} → catalogId; si no, id completo.
    /// </summary>
    public static string GetCatalogProductId(string lineId)
    {
        if (string.IsNullOrWhiteSpace(lineId))
            return string.Empty;

        var parts = lineId.Split('-');
        if (parts.Length >= 3 && long.TryParse(parts[^2], out _))
            return string.Join("-", parts.Take(parts.Length - 2));

        return lineId;
    }

    private static int FindExactMatch(List<BaselineSlot> slots, OrderProduct line)
    {
        var catalog = line.CatalogProductId ?? GetCatalogProductId(line.Id);
        var fp = AttributesFingerprint(line.Attributes);

        for (var i = 0; i < slots.Count; i++)
        {
            if (slots[i].Matched)
                continue;

            var b = slots[i].Product;
            if (!string.Equals(GetCatalogProductId(b.Id), catalog, StringComparison.Ordinal))
                continue;
            if (b.Quantity != line.Quantity)
                continue;
            if (!string.Equals(AttributesFingerprint(b.Attributes), fp, StringComparison.Ordinal))
                continue;

            return i;
        }

        return -1;
    }

    private static int FindModifiedMatch(List<BaselineSlot> slots, OrderProduct line)
    {
        var catalog = line.CatalogProductId ?? GetCatalogProductId(line.Id);
        var fp = AttributesFingerprint(line.Attributes);

        for (var i = 0; i < slots.Count; i++)
        {
            if (slots[i].Matched)
                continue;

            var b = slots[i].Product;
            if (!string.Equals(GetCatalogProductId(b.Id), catalog, StringComparison.Ordinal))
                continue;

            if (b.Quantity == line.Quantity &&
                string.Equals(AttributesFingerprint(b.Attributes), fp, StringComparison.Ordinal))
                continue;

            return i;
        }

        return -1;
    }

    private static string AttributesFingerprint(Dictionary<string, object>? attrs)
    {
        if (attrs == null || attrs.Count == 0)
            return "";

        try
        {
            var sorted = attrs.OrderBy(kv => kv.Key).ToDictionary(kv => kv.Key, kv => kv.Value);
            return JsonSerializer.Serialize(sorted);
        }
        catch
        {
            return $"n:{attrs.Count}";
        }
    }
}
