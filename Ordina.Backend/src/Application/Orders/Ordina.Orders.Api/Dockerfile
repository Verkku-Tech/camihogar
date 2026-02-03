FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Orders/Ordina.Orders.Api/Ordina.Orders.Api.csproj", "src/Application/Orders/Ordina.Orders.Api/"]
COPY ["src/Application/Orders/Ordina.Orders.Application/Ordina.Orders.Application.csproj", "src/Application/Orders/Ordina.Orders.Application/"]
COPY ["src/Application/Orders/Ordina.Orders.Domain/Ordina.Orders.Domain.csproj", "src/Application/Orders/Ordina.Orders.Domain/"]
COPY ["src/Application/Orders/Ordina.Orders.Infrastructure/Ordina.Orders.Infrastructure.csproj", "src/Application/Orders/Ordina.Orders.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
RUN dotnet restore "src/Application/Orders/Ordina.Orders.Api/Ordina.Orders.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Orders/Ordina.Orders.Api"
RUN dotnet build "Ordina.Orders.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Orders.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Install curl for health checks and libgdiplus for SpreadsheetLight (Excel reports on Linux)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl libgdiplus && \
    rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Orders.Api.dll"] 