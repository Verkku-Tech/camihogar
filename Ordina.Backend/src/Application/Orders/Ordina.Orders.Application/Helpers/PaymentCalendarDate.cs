namespace Ordina.Orders.Application.Helpers;

/// <summary>
/// Fecha calendario de cobro en Venezuela (UTC-4, sin DST).
/// Medianoche VE = 04:00 UTC.
/// </summary>
public static class PaymentCalendarDate
{
    private static readonly TimeSpan VenezuelaOffset = TimeSpan.FromHours(-4);

    /// <summary>
    /// Día calendario del cobro.
    /// Unspecified (yyyy-MM-dd del formulario): .Date tal cual.
    /// Utc (BSON/Mongo): instante convertido a calendario VE.
    /// </summary>
    public static DateOnly ToCalendarDate(DateTime value)
    {
        if (value.Kind == DateTimeKind.Unspecified)
        {
            return DateOnly.FromDateTime(value.Date);
        }

        var utc = value.Kind == DateTimeKind.Utc
            ? value
            : value.ToUniversalTime();

        var veLocal = utc + VenezuelaOffset;
        return new DateOnly(veLocal.Year, veLocal.Month, veLocal.Day);
    }

    /// <summary>
    /// Persistencia canónica: medianoche VE del día calendario → 04:00 UTC.
    /// </summary>
    public static DateTime NormalizeForStorage(DateTime value)
    {
        var calendarDay = ToCalendarDate(value);
        return new DateTime(
            calendarDay.Year,
            calendarDay.Month,
            calendarDay.Day,
            4,
            0,
            0,
            DateTimeKind.Utc);
    }

    public static string ToReportString(DateTime value) =>
        ToCalendarDate(value).ToString("yyyy-MM-dd");
}
