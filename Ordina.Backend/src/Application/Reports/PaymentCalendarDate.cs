using System;

namespace Ordina.Application.Reports;

/// <summary>
/// Fecha calendario de cobro en Venezuela (UTC-4, sin DST).
/// Medianoche VE = 04:00 UTC.
/// </summary>
public static class PaymentCalendarDate
{
    private static readonly TimeSpan VenezuelaOffset = TimeSpan.FromHours(-4);
    private static readonly TimeSpan CanonicalVeMidnightUtc = TimeSpan.FromHours(4);

    public static DateOnly ToCalendarDate(DateTime value)
    {
        if (value.Kind == DateTimeKind.Unspecified)
        {
            return DateOnly.FromDateTime(value.Date);
        }

        var utc = value.Kind == DateTimeKind.Utc
            ? value
            : value.ToUniversalTime();

        if (IsUtcDateOnlyMarker(utc))
        {
            return new DateOnly(utc.Year, utc.Month, utc.Day);
        }

        var veLocal = utc + VenezuelaOffset;
        return new DateOnly(veLocal.Year, veLocal.Month, veLocal.Day);
    }

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

    private static bool IsUtcDateOnlyMarker(DateTime utc) =>
        utc.Millisecond == 0 &&
        (utc.TimeOfDay == TimeSpan.Zero || utc.TimeOfDay == CanonicalVeMidnightUtc);
}
