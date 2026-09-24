using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Notifications;

public class NotificationRuleSettings : BaseEntity
{

    // BI Operations Schedule
    [BsonElement("biAlertsEnabled")]
    public bool BiAlertsEnabled { get; set; } = true;

    [BsonElement("biFrequency")]
    public string BiFrequency { get; set; } = "Weekly"; // "Weekly" | "Daily"

    [BsonElement("biDayOfWeek")]
    public DayOfWeek BiDayOfWeek { get; set; } = DayOfWeek.Monday;

    [BsonElement("biHourOfDay")]
    public int BiHourOfDay { get; set; } = 9; // 9:00 AM

    [BsonElement("biMinuteOfHour")]
    public int BiMinuteOfHour { get; set; } = 0;

    [BsonElement("biTargetRoles")]
    public List<string> BiTargetRoles { get; set; } = new() { "Administrator", "Super Administrator" };

    // Operational Rules
    [BsonElement("manufacturingDelayEnabled")]
    public bool ManufacturingDelayEnabled { get; set; } = true;

    [BsonElement("manufacturingDelayDays")]
    public int ManufacturingDelayDays { get; set; } = 25;

    [BsonElement("reservationExpiringEnabled")]
    public bool ReservationExpiringEnabled { get; set; } = true;

    [BsonElement("reservationExpiringDays")]
    public int ReservationExpiringDays { get; set; } = 30;

    // System & Security Rules
    [BsonElement("emergencyPinUsedEnabled")]
    public bool EmergencyPinUsedEnabled { get; set; } = true;

    [BsonElement("exchangeRateChangedEnabled")]
    public bool ExchangeRateChangedEnabled { get; set; } = true;

    [BsonElement("syncConflictEnabled")]
    public bool SyncConflictEnabled { get; set; } = true;

    // Preferences
    [BsonElement("soundEnabled")]
    public bool SoundEnabled { get; set; } = true;
}
