using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Ordina.Database.Entities.Audit;
using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Helpers;

public static partial class AuditLabelFormatter
{
    public const string CategoryFabricacion = "fabricacion";
    public const string CategoryPedido = "pedido";
    public const string CategoryPago = "pago";
    public const string CategoryProducto = "producto";
    public const string CategoryGeneral = "general";

    private const string ReporteFabricacionLabel = "Reporte de fabricación";

    private static readonly Dictionary<string, string> PaymentConditionLabels =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["cashea"] = "Cashea",
            ["pagara_en_tienda"] = "Pagará en Tienda",
            ["pago_a_entrega"] = "Pago a la entrega",
            ["pago_parcial"] = "Pago Parcial",
            ["todo_pago"] = "Todo Pago",
        };

    private static readonly Dictionary<string, string> SaleTypeLabels =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["encargo"] = "Encargo",
            ["encargo_entrega"] = "Encargo/Entrega",
            ["entrega"] = "Entrega",
            ["sistema_apartado"] = "SA (Sistema de Apartado)",
            ["delivery_express"] = "Delivery Express",
            ["retiro_almacen"] = "Retiro x Almacén",
            ["retiro_tienda"] = "Retiro x Tienda",
        };

    [GeneratedRegex(@"^producto\[(.+)\](?:\.(.+))?$", RegexOptions.IgnoreCase)]
    private static partial Regex ProductFieldRegex();

    [GeneratedRegex(@"(?:^|;\s*)Método=([^;]+)", RegexOptions.IgnoreCase)]
    private static partial Regex PaymentMethodRegex();

    [GeneratedRegex(@"(?:^|;\s*)Monto=([^;]+)", RegexOptions.IgnoreCase)]
    private static partial Regex PaymentAmountRegex();

    [GeneratedRegex(@"(?:^|;\s*)Moneda=([^;]+)", RegexOptions.IgnoreCase)]
    private static partial Regex PaymentCurrencyRegex();

    private static bool UsesCashPaymentForm(string? method) =>
        string.Equals(method, "Efectivo", StringComparison.OrdinalIgnoreCase)
        || string.Equals(method, "Efectivo contra Entrega", StringComparison.OrdinalIgnoreCase);

    public static (decimal Amount, string Currency) GetOriginalPaymentDisplay(PartialPayment payment)
    {
        var det = payment.PaymentDetails;

        if (UsesCashPaymentForm(payment.Method)
            && det?.CashReceived is > 0)
        {
            return (det.CashReceived.Value, (det.CashCurrency ?? "Bs").Trim());
        }

        if (det?.OriginalAmount is not null)
        {
            return (det.OriginalAmount.Value, (det.OriginalCurrency ?? "Bs").Trim());
        }

        if (det?.CashReceived is > 0)
        {
            return (det.CashReceived.Value, (det.CashCurrency ?? "Bs").Trim());
        }

        return (payment.Amount, "Bs");
    }

    public static string FormatPaymentShort(string method, decimal amount, string currency)
    {
        var cur = (currency ?? "Bs").Trim();
        var rounded = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        var formatted = rounded.ToString("N2", CultureInfo.GetCultureInfo("es-VE"));

        return cur.ToUpperInvariant() switch
        {
            "USD" => $"{method} ${formatted}",
            "EUR" => $"{method} €{formatted}",
            _ => $"{method} Bs. {formatted}",
        };
    }

    private static string? ExtractSemicolonField(string raw, string label)
    {
        var pattern = $@"(?:^|;\s*){Regex.Escape(label)}=([^;]+)";
        var match = Regex.Match(raw, pattern, RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim() : null;
    }

    private static (string? Amount, string? Currency) ResolvePaymentDisplayFromRaw(string rawValue)
    {
        var currency = ExtractSemicolonField(rawValue, "Moneda");
        var amountStr = ExtractSemicolonField(rawValue, "Monto");

        if (!string.IsNullOrEmpty(currency) && !string.IsNullOrEmpty(amountStr))
            return (amountStr, currency);

        var origCurr = ExtractSemicolonField(rawValue, "Orig curr");
        var origAmt = ExtractSemicolonField(rawValue, "Orig amt");
        var cashCurr = ExtractSemicolonField(rawValue, "Cash curr");
        var cashAmt = ExtractSemicolonField(rawValue, "CashReceived");

        if (!string.IsNullOrEmpty(origCurr) && !string.IsNullOrEmpty(origAmt))
            return (origAmt, origCurr);

        if (!string.IsNullOrEmpty(cashCurr) && !string.IsNullOrEmpty(cashAmt))
            return (cashAmt, cashCurr);

        return (amountStr, currency ?? "Bs");
    }

    public static string FormatField(string field)
    {
        if (string.IsNullOrWhiteSpace(field))
            return field;

        if (field is "mixedPayments[+]" or "partialPayments[+]")
            return "Pago agregado";
        if (field is "mixedPayments[-]" or "partialPayments[-]")
            return "Pago eliminado";
        if (field.StartsWith("mixedPayments[", StringComparison.OrdinalIgnoreCase)
            || field.StartsWith("partialPayments[", StringComparison.OrdinalIgnoreCase))
            return "Pago modificado";

        var match = ProductFieldRegex().Match(field.Trim());
        if (match.Success)
        {
            var suffix = match.Groups[2].Value;
            return suffix switch
            {
                "logisticStatus" => "Estado logístico",
                "manufacturingStatus" => "Estado de fabricación",
                "locationStatus" => "Ubicación",
                "cantidad" => "Cantidad",
                "fabricacion" => "Fabricación",
                "nombre" => "Nombre",
                "precio" => "Precio",
                "total" => "Total línea",
                "descuento" => "Descuento",
                "observaciones" => "Observaciones",
                "atributos" => "Atributos",
                "" => "Producto",
                _ => suffix
            };
        }

        return field switch
        {
            nameof(Order.Status) or "Status" => "Estado del pedido",
            nameof(Order.PaymentCondition) => "Condición de pago",
            nameof(Order.SaleType) => "Tipo de venta",
            nameof(Order.DispatchObservations) => "Observaciones de despacho",
            nameof(Order.ProductMarkups) => "Sobreprecios",
            nameof(Order.ProductDiscountTotal) => "Descuento en productos",
            "generalDiscount" => "Descuento general",
            "paymentDetails" => "Detalle de pago",
            "partialPayments" => "Pagos parciales",
            "mixedPayments" => "Pagos mixtos",
            "product.logisticStatus" => "Estado logístico",
            _ when field.StartsWith("conciliación.", StringComparison.OrdinalIgnoreCase) =>
                field["conciliación.".Length..],
            _ => field
        };
    }

    public static string FormatPaymentCondition(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return "(sin condición)";

        var key = code.Trim();
        return PaymentConditionLabels.TryGetValue(key, out var label) ? label : key;
    }

    public static string FormatSaleType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "(sin tipo)";

        var key = value.Trim();
        return SaleTypeLabels.TryGetValue(key, out var label) ? label : key;
    }

    public static string FormatGeneralDiscount(Order order)
    {
        if (order.GeneralDiscountAmount is not > 0 && order.GeneralDiscountPercent is not > 0)
            return "(sin descuento)";

        if (string.Equals(order.GeneralDiscountType, "porcentaje", StringComparison.OrdinalIgnoreCase)
            && order.GeneralDiscountPercent is > 0)
        {
            return $"{order.GeneralDiscountPercent.Value.ToString(CultureInfo.InvariantCulture)}%";
        }

        if (order.GeneralDiscountAmount is > 0)
        {
            return $"${order.GeneralDiscountAmount.Value.ToString(CultureInfo.InvariantCulture)}";
        }

        return "(sin descuento)";
    }

    public static string FormatProductMarkups(Dictionary<string, decimal>? markups)
    {
        if (markups == null || markups.Count == 0)
            return "(ninguno)";

        var total = markups.Values.Sum();
        return $"{markups.Count} producto(s), total markup ${total.ToString(CultureInfo.InvariantCulture)}";
    }

    public static string FormatProductPriceLine(OrderProduct product)
    {
        var currency = string.IsNullOrWhiteSpace(product.PriceCurrency) ? "Bs" : product.PriceCurrency;
        return $"{product.Price.ToString(CultureInfo.InvariantCulture)} {currency} (total línea: {product.Total.ToString(CultureInfo.InvariantCulture)})";
    }

    public static string FormatPaymentListValueForDisplay(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
            return "—";

        var methodMatch = PaymentMethodRegex().Match(rawValue);
        if (!methodMatch.Success && !PaymentAmountRegex().IsMatch(rawValue))
            return rawValue.Length > 120 ? rawValue[..120] + "…" : rawValue;

        var method = methodMatch.Success ? methodMatch.Groups[1].Value.Trim() : "?";
        var (amountStr, currency) = ResolvePaymentDisplayFromRaw(rawValue);

        if (string.IsNullOrEmpty(amountStr)
            || !decimal.TryParse(amountStr, NumberStyles.Float, CultureInfo.InvariantCulture, out var amount))
        {
            return methodMatch.Success ? method : rawValue[..Math.Min(120, rawValue.Length)];
        }

        return FormatPaymentShort(method, amount, currency ?? "Bs");
    }

    public static string AttributesFingerprint(Dictionary<string, object>? attrs)
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

    public static string FormatValue(string field, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value ?? "(sin valor)";

        if (field is nameof(Order.PaymentCondition))
            return FormatPaymentCondition(value);

        if (field is nameof(Order.SaleType))
            return FormatSaleType(value);

        if (field.StartsWith("mixedPayments", StringComparison.OrdinalIgnoreCase)
            || field.StartsWith("partialPayments", StringComparison.OrdinalIgnoreCase))
            return FormatPaymentListValueForDisplay(value);

        if (value == "(sin estado)")
            return value;

        if (value.Contains(" / ", StringComparison.Ordinal))
        {
            var parts = value.Split(" / ", 2, StringSplitOptions.TrimEntries);
            if (parts.Length == 2)
                return $"{FormatSingleValue(field, parts[0])} / {FormatSingleValue(field, parts[1])}";
        }

        return FormatSingleValue(field, value);
    }

    private static string FormatSingleValue(string field, string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "debe_fabricar" => "Debe fabricar",
            "por_fabricar" => ReporteFabricacionLabel,
            "fabricando" => "Fabricando",
            "almacen_no_fabricado" or "fabricado" => "En almacén",
            "generado" => "Generado",
            "pendiente" => "Pendiente",
            "validado" => "Validado",
            "fabricándose" => "Fabricándose",
            "en almacén" => "En almacén",
            "en ruta" => "En Ruta",
            "completado" => "Completado",
            "fabricacion" => "Fabricación",
            "en tienda" => "En tienda",
            "disponibilidad inmediata" => "Disponibilidad inmediata",
            "(eliminado)" => "(eliminado)",
            "(previo)" => "(previo)",
            "(ninguno)" => "(ninguno)",
            "(sin descuento)" => "(sin descuento)",
            "(sin condición)" => "(sin condición)",
            _ => PaymentConditionLabels.TryGetValue(value.Trim(), out var pc) ? pc : value
        };
    }

    public static string? ExtractProductName(string field)
    {
        var match = ProductFieldRegex().Match(field.Trim());
        return match.Success ? match.Groups[1].Value : null;
    }

    public static string GetCategory(string field)
    {
        if (string.IsNullOrWhiteSpace(field))
            return CategoryGeneral;

        if (field.Contains(".fabricacion", StringComparison.OrdinalIgnoreCase)
            || field.Contains("manufacturingStatus", StringComparison.OrdinalIgnoreCase)
            || field.Contains("logisticStatus", StringComparison.OrdinalIgnoreCase)
            || field.Contains("locationStatus", StringComparison.OrdinalIgnoreCase))
            return CategoryFabricacion;

        if (field.StartsWith("conciliación.", StringComparison.OrdinalIgnoreCase)
            || field is "paymentDetails" or "partialPayments" or "mixedPayments"
            || field.StartsWith("mixedPayments", StringComparison.OrdinalIgnoreCase)
            || field.StartsWith("partialPayments", StringComparison.OrdinalIgnoreCase)
            || field is nameof(Order.PaymentCondition))
            return CategoryPago;

        if (field.StartsWith("producto[", StringComparison.OrdinalIgnoreCase))
            return CategoryProducto;

        if (field is nameof(Order.Status) or "Status")
            return CategoryPedido;

        return CategoryGeneral;
    }

    public static AuditChangeDto EnrichChangeDto(AuditChange change)
    {
        var productName = ExtractProductName(change.Field);
        var category = GetCategory(change.Field);
        var displayField = productName != null && change.Field.Contains(".fabricacion", StringComparison.OrdinalIgnoreCase)
            ? "Fabricación"
            : FormatField(change.Field);

        return new AuditChangeDto
        {
            Field = change.Field,
            OldValue = change.OldValue,
            NewValue = change.NewValue,
            DisplayField = displayField,
            DisplayOldValue = FormatValue(change.Field, change.OldValue),
            DisplayNewValue = FormatValue(change.Field, change.NewValue),
            ProductName = productName,
            Category = category
        };
    }
}
