# Dockerfile unificado para el backend .NET
# Uso: docker build --build-arg PROJECT_PATH="src/Presentation/Ordina.ApiGateway/Ordina.ApiGateway.csproj" -t camihogar-backend .

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
ARG PROJECT_PATH

WORKDIR /src

# Copiar solución primero
COPY ["Ordina.sln", "./"]

# Copiar archivos .csproj de forma estructurada para aprovechar cache de Docker
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
COPY ["src/Infrastructure/Ordina.Database/Ordina.Database.csproj", "src/Infrastructure/Ordina.Database/"]

# Copiar proyectos de Application (estructura común)
COPY ["src/Application/Security/Ordina.Security.Api/Ordina.Security.Api.csproj", "src/Application/Security/Ordina.Security.Api/"]
COPY ["src/Application/Security/Ordina.Security.Application/Ordina.Security.Application.csproj", "src/Application/Security/Ordina.Security.Application/"]
COPY ["src/Application/Security/Ordina.Security.Domain/Ordina.Security.Domain.csproj", "src/Application/Security/Ordina.Security.Domain/"]
COPY ["src/Application/Security/Ordina.Security.Infrastructure/Ordina.Security.Infrastructure.csproj", "src/Application/Security/Ordina.Security.Infrastructure/"]

COPY ["src/Application/Users/Ordina.Users.Api/Ordina.Users.Api.csproj", "src/Application/Users/Ordina.Users.Api/"]
COPY ["src/Application/Users/Ordina.Users.Application/Ordina.Users.Application.csproj", "src/Application/Users/Ordina.Users.Application/"]
COPY ["src/Application/Users/Ordina.Users.Domain/Ordina.Users.Domain.csproj", "src/Application/Users/Ordina.Users.Domain/"]
COPY ["src/Application/Users/Ordina.Users.Infrastructure/Ordina.Users.Infrastructure.csproj", "src/Application/Users/Ordina.Users.Infrastructure/"]

COPY ["src/Application/Providers/Ordina.Providers.Api/Ordina.Providers.Api.csproj", "src/Application/Providers/Ordina.Providers.Api/"]
COPY ["src/Application/Providers/Ordina.Providers.Application/Ordina.Providers.Application.csproj", "src/Application/Providers/Ordina.Providers.Application/"]
COPY ["src/Application/Providers/Ordina.Providers.Domain/Ordina.Providers.Domain.csproj", "src/Application/Providers/Ordina.Providers.Domain/"]
COPY ["src/Application/Providers/Ordina.Providers.Infrastructure/Ordina.Providers.Infrastructure.csproj", "src/Application/Providers/Ordina.Providers.Infrastructure/"]

COPY ["src/Application/Orders/Ordina.Orders.Api/Ordina.Orders.Api.csproj", "src/Application/Orders/Ordina.Orders.Api/"]
COPY ["src/Application/Orders/Ordina.Orders.Application/Ordina.Orders.Application.csproj", "src/Application/Orders/Ordina.Orders.Application/"]
COPY ["src/Application/Orders/Ordina.Orders.Domain/Ordina.Orders.Domain.csproj", "src/Application/Orders/Ordina.Orders.Domain/"]
COPY ["src/Application/Orders/Ordina.Orders.Infrastructure/Ordina.Orders.Infrastructure.csproj", "src/Application/Orders/Ordina.Orders.Infrastructure/"]

COPY ["src/Application/Payments/Ordina.Payments.Api/Ordina.Payments.Api.csproj", "src/Application/Payments/Ordina.Payments.Api/"]
COPY ["src/Application/Payments/Ordina.Payments.Application/Ordina.Payments.Application.csproj", "src/Application/Payments/Ordina.Payments.Application/"]
COPY ["src/Application/Payments/Ordina.Payments.Domain/Ordina.Payments.Domain.csproj", "src/Application/Payments/Ordina.Payments.Domain/"]
COPY ["src/Application/Payments/Ordina.Payments.Infrastructure/Ordina.Payments.Infrastructure.csproj", "src/Application/Payments/Ordina.Payments.Infrastructure/"]

COPY ["src/Presentation/Ordina.ApiGateway/Ordina.ApiGateway.csproj", "src/Presentation/Ordina.ApiGateway/"]
COPY ["src/Presentation/Ordina.AppHost/Ordina.AppHost.csproj", "src/Presentation/Ordina.AppHost/"]

# Restaurar dependencias usando la solución
RUN dotnet restore "Ordina.sln"

# Copiar todo el código fuente
COPY . .

# Publicar el proyecto específico
ARG PROJECT_PATH
RUN dotnet publish "${PROJECT_PATH}" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    /p:UseAppHost=false \
    --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "*.dll"]

