using Microsoft.Extensions.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// 1. Contenedor de MongoDB para Desarrollo (puerto 27017, credenciales estáticas y volumen persistente)
var mongoUserName = builder.AddParameter("mongo-user", "admin");
var mongoPassword = builder.AddParameter("mongo-password", "OrdinaPassword123!", secret: true);

var mongo = builder.AddMongoDB("mongodb", port: 27017, userName: mongoUserName, password: mongoPassword)
                   .WithDataVolume("ordina_mongo_data_dev")
                   .WithLifetime(ContainerLifetime.Persistent);


// 2. Monolito .NET 10 (Backend)
var api = builder.AddProject<Projects.Ordina_Api>("backend-api")
                 .WithReference(mongo);

// 3. Frontend Vite + React 19 ejecutado a través de Bun
var frontend = builder.AddExecutable("frontend", "bun", "../Ordina.Frontend", "run", "dev")
                      .WithReference(api)
                      .WithEnvironment("VITE_API_URL", api.GetEndpoint("https"))
                      .WithHttpsEndpoint(env: "PORT", port: 5173);

builder.Build().Run();
