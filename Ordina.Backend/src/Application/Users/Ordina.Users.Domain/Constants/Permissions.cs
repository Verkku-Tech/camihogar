namespace Ordina.Users.Domain.Constants;

public static class Permissions
{
    public static class Users
    {
        public const string Read = "users.read";
        public const string Create = "users.create"; // Create/Modify users, groups, permissions
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
        public const string ManageWarehouses = "inventory.warehouses.manage"; // Create/Modify
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
        public const string Create = "products.create"; // Includes price bands, commissions
        public const string Update = "products.update";
        public const string Delete = "products.delete";
        public const string ViewStatistics = "products.statistics.view";
    }

    public static class Finance
    {
        public const string CreateAccounts = "finance.accounts.create";
        public const string ReadAccounts = "finance.accounts.read";
        public const string ManageRecords = "finance.records.manage"; // Create, modify amount, delete
        public const string Conciliate = "finance.conciliate";
        public const string Export = "finance.export";
        public const string Download = "finance.download"; // Debits
        public const string ViewStatistics = "finance.statistics.view";
    }

    public static class Settings
    {
        public const string ManageCompany = "settings.company.manage";
        public const string ManageCurrency = "settings.currency.manage";
        public const string ManageAlerts = "settings.alerts.manage";
        public const string ManageSystem = "settings.system.manage"; // Timeouts, sessions, etc.
    }

    public static class Budgets
    {
        public const string ReadAll = "budgets.read.all"; // Consultar toda la base de datos
        public const string Create = "budgets.create";
        public const string Update = "budgets.update";
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
    }

    public static class Dispatch // Facturación / Notas de Despacho
    {
        public const string Read = "dispatch.read";
        public const string Create = "dispatch.create";
        public const string Update = "dispatch.update";
        public const string EmitPayment = "dispatch.payment.emit";
        public const string DeletePayment = "dispatch.payment.delete";
        public const string Delete = "dispatch.delete";
        public const string ViewStatistics = "dispatch.statistics.view";
    }

    public static class Reports
    {
        public const string Dispatch = "reports.dispatch.view";
        public const string Commissions = "reports.commissions.view";
        public const string Manufacturing = "reports.manufacturing.view";
        public const string PaymentsDetailed = "reports.payments.detailed.view";
    }

    public static List<string> GetAll()
    {
        var permissions = new List<string>();
        foreach (var outerClass in typeof(Permissions).GetNestedTypes())
        {
            foreach (var field in outerClass.GetFields())
            {
                if (field.IsLiteral && !field.IsInitOnly && field.FieldType == typeof(string))
                {
                    permissions.Add((string)field.GetValue(null)!);
                }
            }
        }
        return permissions;
    }
}
