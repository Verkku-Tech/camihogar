using System.Collections.Frozen;

namespace Ordina.Domain.Users;

public static class Permissions
{
    public static class Users
    {
        public const string Read = "users.read";
        public const string Create = "users.create";
        public const string Update = "users.update";
        public const string Delete = "users.delete";
        public const string ViewPermissions = "users.permissions.view";
        public const string ModifyPasswords = "users.passwords.modify";
    }

    public static class Roles
    {
        public const string Read = "roles.read";
        public const string Create = "roles.create";
        public const string Update = "roles.update";
        public const string Delete = "roles.delete";
    }

    public static class Clients
    {
        public const string Read = "clients.read";
        public const string Create = "clients.create";
        public const string Update = "clients.update";
        public const string Delete = "clients.delete";
    }

    public static class Providers
    {
        public const string Read = "providers.read";
        public const string Create = "providers.create";
        public const string Update = "providers.update";
        public const string Delete = "providers.delete";
    }

    public static class Inventory
    {
        public const string ManageWarehouses = "inventory.warehouses.manage";
        public const string DeleteWarehouses = "inventory.warehouses.delete";
        public const string ViewStock = "inventory.stock.view";
        public const string ViewMovements = "inventory.movements.view";
        public const string ManageMovements = "inventory.movements.manage";
    }

    public static class Products
    {
        public const string ManageTags = "products.tags.manage";
        public const string DeleteTags = "products.tags.delete";
        public const string Read = "products.read";
        public const string Create = "products.create";
        public const string Update = "products.update";
        public const string Delete = "products.delete";
        public const string ViewStatistics = "products.statistics.view";
    }

    public static class Finance
    {
        public const string CreateAccounts = "finance.accounts.create";
        public const string ReadAccounts = "finance.accounts.read";
        public const string ManageRecords = "finance.records.manage";
        public const string Conciliate = "finance.conciliate";
        public const string Export = "finance.export";
        public const string Download = "finance.download";
        public const string ViewStatistics = "finance.statistics.view";
    }

    public static class Settings
    {
        public const string ManageCompany = "settings.company.manage";
        public const string ManageCurrency = "settings.currency.manage";
        public const string ManageAlerts = "settings.alerts.manage";
        public const string ManageSystem = "settings.system.manage";
    }

    public static class Budgets
    {
        public const string ReadAll = "budgets.read.all";
        public const string Create = "budgets.create";
        public const string Update = "budgets.update";
        public const string ConvertToOrder = "budgets.convert_to_order";
        public const string Close = "budgets.close";
        public const string Delete = "budgets.delete";
        public const string ViewStatistics = "budgets.statistics.view";
    }

    public static class Orders
    {
        public const string Read = "orders.read";
        public const string Create = "orders.create";
        public const string Update = "orders.update";
        public const string Delete = "orders.delete";
        public const string Export = "orders.export";
        public const string ViewStatistics = "orders.statistics.view";
        public const string ManagePayments = "orders.payments.manage";
    }

    public static class Dispatch
    {
        public const string Read = "dispatch.read";
        public const string Create = "dispatch.create";
        public const string Update = "dispatch.update";
        public const string SendToRoute = "dispatch.send_to_route";
        public const string ConfirmDelivery = "dispatch.confirm_delivery";
        public const string EmitPayment = "dispatch.payment.emit";
        public const string DeletePayment = "dispatch.payment.delete";
        public const string Delete = "dispatch.delete";
        public const string ViewStatistics = "dispatch.statistics.view";
    }

    public static class Manufacturing
    {
        public const string Manage = "manufacturing.manage";
    }

    public static class Reports
    {
        public const string Dispatch = "reports.dispatch.view";
        public const string Commissions = "reports.commissions.view";
        public const string Manufacturing = "reports.manufacturing.view";
        public const string PaymentsDetailed = "reports.payments.detailed.view";
    }

    private static readonly string[] AllArray =
    [
        Users.Read, Users.Create, Users.Update, Users.Delete, Users.ViewPermissions, Users.ModifyPasswords,
        Roles.Read, Roles.Create, Roles.Update, Roles.Delete,
        Clients.Read, Clients.Create, Clients.Update, Clients.Delete,
        Providers.Read, Providers.Create, Providers.Update, Providers.Delete,
        Inventory.ManageWarehouses, Inventory.DeleteWarehouses, Inventory.ViewStock, Inventory.ViewMovements, Inventory.ManageMovements,
        Products.ManageTags, Products.DeleteTags, Products.Read, Products.Create, Products.Update, Products.Delete, Products.ViewStatistics,
        Finance.CreateAccounts, Finance.ReadAccounts, Finance.ManageRecords, Finance.Conciliate, Finance.Export, Finance.Download, Finance.ViewStatistics,
        Settings.ManageCompany, Settings.ManageCurrency, Settings.ManageAlerts, Settings.ManageSystem,
        Budgets.ReadAll, Budgets.Create, Budgets.Update, Budgets.ConvertToOrder, Budgets.Close, Budgets.Delete, Budgets.ViewStatistics,
        Orders.Read, Orders.Create, Orders.Update, Orders.Delete, Orders.Export, Orders.ViewStatistics, Orders.ManagePayments,
        Dispatch.Read, Dispatch.Create, Dispatch.Update, Dispatch.SendToRoute, Dispatch.ConfirmDelivery, Dispatch.EmitPayment, Dispatch.DeletePayment, Dispatch.Delete, Dispatch.ViewStatistics,
        Manufacturing.Manage,
        Reports.Dispatch, Reports.Commissions, Reports.Manufacturing, Reports.PaymentsDetailed
    ];

    public static readonly FrozenSet<string> All = AllArray.ToFrozenSet(StringComparer.Ordinal);

    public static List<string> GetAll() => [.. All];
}
