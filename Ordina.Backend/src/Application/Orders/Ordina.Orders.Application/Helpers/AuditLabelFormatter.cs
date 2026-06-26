using System.Text.RegularExpressions;
using Ordina.Database.Entities.Audit;
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

    [GeneratedRegex(@"^producto\[(.+)\](?:\.(.+))?$", RegexOptions.IgnoreCase)]
    private static partial Regex ProductFieldRegex();

    public static string FormatField(string field)
    {
        if (string.IsNullOrWhiteSpace(field))
            return field;

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
                "" => "Producto",
                _ => suffix
            };
        }

        return field switch
        {
            nameof(Database.Entities.Order.Order.Status) or "Status" => "Estado del pedido",
            "paymentDetails" => "Detalle de pago",
            "partialPayments" => "Pagos parciales",
            "mixedPayments" => "Pagos mixtos",
            "product.logisticStatus" => "Estado logístico",
            _ when field.StartsWith("conciliación.", StringComparison.OrdinalIgnoreCase) =>
                field["conciliación.".Length..],
            _ => field
        };
    }

    public static string FormatValue(string field, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return value ?? "(sin valor)";

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
            _ => value
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
            || field is "paymentDetails" or "partialPayments" or "mixedPayments")
            return CategoryPago;

        if (field.StartsWith("producto[", StringComparison.OrdinalIgnoreCase))
            return CategoryProducto;

        if (field is nameof(Database.Entities.Order.Order.Status) or "Status")
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
