namespace Ordina.Domain.Enums;

public enum UserRole
{
    SuperAdministrator,
    Administrator,
    Supervisor,
    StoreSeller,
    OnlineSeller,
    Workshop,
    Dispatcher
}

public static class UserRoleExtensions
{
    public static string ToDbString(this UserRole role) => role switch
    {
        UserRole.SuperAdministrator => "Super Administrator",
        UserRole.Administrator => "Administrator",
        UserRole.Supervisor => "Supervisor",
        UserRole.StoreSeller => "Store Seller",
        UserRole.OnlineSeller => "Online Seller",
        UserRole.Workshop => "Workshop",
        UserRole.Dispatcher => "Dispatcher",
        _ => "Store Seller"
    };

    public static UserRole ParseUserRole(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "super administrator" or "superadministrator" or "super_admin" => UserRole.SuperAdministrator,
        "administrator" or "admin" => UserRole.Administrator,
        "supervisor" => UserRole.Supervisor,
        "online seller" or "onlineseller" => UserRole.OnlineSeller,
        "workshop" or "taller" => UserRole.Workshop,
        "dispatcher" or "despacho" => UserRole.Dispatcher,
        _ => UserRole.StoreSeller
    };
}
