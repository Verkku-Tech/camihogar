using MongoDB.Bson.Serialization;
using Ordina.Database.Entities.User;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class UserSerializationTests
{
    [Fact]
    public void Should_Deserialize_User_When_Bson_Contains_UpdatedAt_And_Extra_Fields()
    {
        var json = """
        {
            "_id": "64b8f0f0f0f0f0f0f0f0f0f0",
            "username": "admin",
            "email": "admin@ordina.com",
            "role": "Super Administrator",
            "name": "Admin",
            "status": "active",
            "createdAt": ISODate("2024-01-01T00:00:00Z"),
            "updatedAt": ISODate("2024-01-02T00:00:00Z"),
            "legacyExtraField": "some_value"
        }
        """;

        var user = BsonSerializer.Deserialize<User>(json);

        Assert.NotNull(user);
        Assert.Equal("admin", user.Username);
        Assert.NotNull(user.UpdatedAt);
    }

    [Fact]
    public void Should_Deserialize_Client_When_Bson_Contains_Extra_Or_Legacy_Fields()
    {
        Ordina.Database.MongoContext.MongoDbServiceExtensions.RegisterConventions();

        var json = """
        {
            "_id": "64b8f0f0f0f0f0f0f0f0f0f1",
            "nombreRazonSocial": "Acme Corp",
            "rutId": "J-12345678",
            "direccion": "Av. Principal",
            "telefono": "04141234567",
            "tipoCliente": "empresa",
            "estado": "activo",
            "fechaCreacion": ISODate("2024-01-01T00:00:00Z"),
            "updatedAt": ISODate("2024-01-02T00:00:00Z"),
            "__v": 0
        }
        """;

        var client = BsonSerializer.Deserialize<Ordina.Database.Entities.Client.Client>(json);

        Assert.NotNull(client);
        Assert.Equal("Acme Corp", client.NombreRazonSocial);
    }

    [Fact]
    public void Should_Deserialize_Vendor_When_Bson_Contains_Extra_Timestamps()
    {
        Ordina.Database.MongoContext.MongoDbServiceExtensions.RegisterConventions();

        var json = """
        {
            "_id": "64b8f0f0f0f0f0f0f0f0f0f2",
            "name": "Vendedor 1",
            "role": "Store Seller",
            "type": "vendor",
            "createdAt": ISODate("2024-01-01T00:00:00Z"),
            "updatedAt": ISODate("2024-01-02T00:00:00Z")
        }
        """;

        var vendor = BsonSerializer.Deserialize<Ordina.Database.Entities.Vendor.Vendor>(json);

        Assert.NotNull(vendor);
        Assert.Equal("Vendedor 1", vendor.Name);
    }
}
