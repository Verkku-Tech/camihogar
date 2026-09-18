using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// ================================================================
// MICROSERVICES (Using MongoDB from appsettings / docker-compose)
// ================================================================

// Security Service
var securityApi = builder.AddProject<Projects.Ordina_Security_Api>("security-api");

// Users Service
var usersApi = builder.AddProject<Projects.Ordina_Users_Api>("users-api");

// Providers Service
var providersApi = builder.AddProject<Projects.Ordina_Providers_Api>("providers-api");

// Orders Service
var ordersApi = builder.AddProject<Projects.Ordina_Orders_Api>("orders-api");

// Payments Service
var paymentsApi = builder.AddProject<Projects.Ordina_Payments_Api>("payments-api");

// Stores Service
var storesApi = builder.AddProject<Projects.Ordina_Stores_Api>("stores-api");

// ================================================================
// API GATEWAY LAYER
// ================================================================

// API Gateway - Entry point for all services
var apiGateway = builder.AddProject<Projects.Ordina_ApiGateway>("api-gateway")
    .WithReference(securityApi)
    .WithReference(usersApi)
    .WithReference(providersApi)
    .WithReference(ordersApi)
    .WithReference(paymentsApi)
    .WithReference(storesApi);

// ================================================================
// BUILD APPLICATION
// ================================================================

var app = builder.Build();

await app.RunAsync();
