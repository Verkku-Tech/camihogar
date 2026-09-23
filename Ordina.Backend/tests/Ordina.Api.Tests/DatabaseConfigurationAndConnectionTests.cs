using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Ordina.Infrastructure;
using Ordina.Infrastructure.Mongo;
using Xunit;

namespace Ordina.Api.Tests;

public class DatabaseConfigurationAndConnectionTests
{
    private readonly string _apiProjectDir;
    private readonly string _appsettingsPath;
    private readonly string _appsettingsDevPath;

    public DatabaseConfigurationAndConnectionTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var apiDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "src", "Api"));

        if (!Directory.Exists(apiDir))
        {
            var current = new DirectoryInfo(baseDir);
            while (current != null && !Directory.Exists(Path.Combine(current.FullName, "src", "Api")))
            {
                current = current.Parent;
            }

            if (current != null)
            {
                apiDir = Path.Combine(current.FullName, "src", "Api");
            }
        }

        _apiProjectDir = apiDir;
        _appsettingsPath = Path.Combine(_apiProjectDir, "appsettings.json");
        _appsettingsDevPath = Path.Combine(_apiProjectDir, "appsettings.Development.json");
    }

    [Fact]
    public void PhysicalConfigurationFiles_MustExist_WithoutFallbacks()
    {
        Assert.True(File.Exists(_appsettingsPath), $"appsettings.json not found at {_appsettingsPath}");
        Assert.True(File.Exists(_appsettingsDevPath), $"appsettings.Development.json not found at {_appsettingsDevPath}");
    }

    [Theory]
    [InlineData("appsettings.json")]
    [InlineData("appsettings.Development.json")]
    public void Appsettings_MustContainValidMongoAndJwtContracts(string fileName)
    {
        var filePath = Path.Combine(_apiProjectDir, fileName);
        var config = new ConfigurationBuilder().AddJsonFile(filePath, optional: false).Build();

        // 1. MongoDB Connection String
        var connectionString = config.GetConnectionString("MongoDB");
        Assert.False(string.IsNullOrWhiteSpace(connectionString), $"Missing ConnectionStrings:MongoDB in {fileName}");
        Assert.True(connectionString!.StartsWith("mongodb://", StringComparison.OrdinalIgnoreCase) || connectionString.StartsWith("mongodb+srv://", StringComparison.OrdinalIgnoreCase),
            $"Invalid MongoDB connection string scheme in {fileName}: {connectionString}");

        // 2. Database Name
        var dbName = config["ConnectionStrings:DatabaseName"];
        Assert.False(string.IsNullOrWhiteSpace(dbName), $"Missing ConnectionStrings:DatabaseName in {fileName}");
        Assert.Equal("ordina_db", dbName);

        // 3. JWT Security
        var jwtSecret = config["Jwt:SecretKey"];
        Assert.False(string.IsNullOrWhiteSpace(jwtSecret), $"Missing Jwt:SecretKey in {fileName}");
        Assert.True(jwtSecret!.Length >= 32, $"Jwt:SecretKey in {fileName} must be at least 32 characters long for HMAC-SHA256 security.");

        Assert.False(string.IsNullOrWhiteSpace(config["Jwt:Issuer"]), $"Missing Jwt:Issuer in {fileName}");
        Assert.False(string.IsNullOrWhiteSpace(config["Jwt:Audience"]), $"Missing Jwt:Audience in {fileName}");

        // 4. CORS
        var corsOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>();
        Assert.NotNull(corsOrigins);
        Assert.NotEmpty(corsOrigins);
    }

    [Fact]
    public void AddInfrastructure_ThrowsInvalidOperationException_WhenMongoConnectionStringIsMissing()
    {
        // Empty configuration without ConnectionStrings
        var emptyConfig = new ConfigurationBuilder().Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMemoryCache();

        // Must throw immediately on AddInfrastructure or when resolving IMongoClient
        Assert.Throws<InvalidOperationException>(() =>
        {
            services.AddInfrastructure(emptyConfig);
            var sp = services.BuildServiceProvider();
            sp.GetRequiredService<IMongoClient>();
        });
    }

    [Fact]
    public void MongoDbContext_ThrowsInvalidOperationException_WhenDatabaseNameIsMissing()
    {
        var client = new MongoClient("mongodb://localhost:27017");
        var configWithoutDbName = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:MongoDB"] = "mongodb://localhost:27017"
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() =>
        {
            _ = new MongoDbContext(client, configWithoutDbName);
        });
    }

    [Fact]
    public void DependencyInjection_RegistersMongoDbServices_Successfully_WithRealDevSettings()
    {
        var config = new ConfigurationBuilder()
            .AddJsonFile(_appsettingsDevPath, optional: false)
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMemoryCache();

        services.AddInfrastructure(config);
        var provider = services.BuildServiceProvider();

        var client = provider.GetService<IMongoClient>();
        var context = provider.GetService<MongoDbContext>();
        var database = provider.GetService<IMongoDatabase>();

        Assert.NotNull(client);
        Assert.NotNull(context);
        Assert.NotNull(database);
        Assert.Equal("ordina_db", context.Database.DatabaseNamespace.DatabaseName);
        Assert.Equal("ordina_db", database.DatabaseNamespace.DatabaseName);
    }
}
