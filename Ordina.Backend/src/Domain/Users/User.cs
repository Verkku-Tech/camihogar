using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Users;

public class User : BaseEntity
{
    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("role")]
    public string RoleString { get; set; } = "Store Seller";

    [BsonIgnore]
    public UserRole Role
    {
        get => UserRoleExtensions.ParseUserRole(RoleString);
        set => RoleString = value.ToDbString();
    }

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("status")]
    public string StatusString { get; set; } = "active";

    [BsonIgnore]
    public UserStatus Status
    {
        get => UserStatusExtensions.ParseUserStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("passwordHash")]
    public string? PasswordHash { get; set; }

    [BsonElement("password")]
    public string? Password { get; set; }

    [BsonIgnore]
    public string? EffectivePasswordHash => !string.IsNullOrEmpty(PasswordHash) ? PasswordHash : Password;

    [BsonElement("commissionExclusivityMode")]
    public string? CommissionExclusivityModeStored { get; set; }

    [BsonElement("exclusiveCommission")]
    public bool ExclusiveCommissionStored { get; set; } = false;

    [BsonIgnore]
    public string CommissionExclusivityMode
    {
        get => CommissionExclusivityModes.Normalize(CommissionExclusivityModeStored, ExclusiveCommissionStored);
        set => CommissionExclusivityModeStored = value;
    }

    [BsonIgnore]
    public bool ExclusiveCommission =>
        CommissionExclusivityModes.IsExclusive(CommissionExclusivityMode);

    [BsonElement("baseSalary")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal BaseSalary { get; set; } = 0;

    [BsonElement("baseSalaryCurrency")]
    public string BaseSalaryCurrency { get; set; } = "USD";

    private string? _storeId;

    [BsonElement("storeId")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? StoreId
    {
        get => string.IsNullOrWhiteSpace(_storeId) ? null : _storeId;
        set => _storeId = string.IsNullOrWhiteSpace(value) ? null : value;
    }

    [BsonElement("storeName")]
    public string? StoreName { get; set; }

    [BsonElement("extraPermissions")]
    public List<string> ExtraPermissions { get; set; } = new();

    [BsonElement("avatarUrl")]
    public string? AvatarUrl { get; set; }

    public void NormalizeCommissionExclusivity()
    {
        var normalized = CommissionExclusivityModes.Normalize(
            CommissionExclusivityModeStored,
            ExclusiveCommissionStored);
        CommissionExclusivityModeStored = normalized;
        ExclusiveCommissionStored = CommissionExclusivityModes.IsExclusive(normalized);
    }
}
