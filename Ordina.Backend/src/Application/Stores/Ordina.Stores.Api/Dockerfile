FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Stores/Ordina.Stores.Api/Ordina.Stores.Api.csproj", "src/Application/Stores/Ordina.Stores.Api/"]
COPY ["src/Application/Stores/Ordina.Stores.Application/Ordina.Stores.Application.csproj", "src/Application/Stores/Ordina.Stores.Application/"]
COPY ["src/Application/Stores/Ordina.Stores.Domain/Ordina.Stores.Domain.csproj", "src/Application/Stores/Ordina.Stores.Domain/"]
COPY ["src/Application/Stores/Ordina.Stores.Infrastructure/Ordina.Stores.Infrastructure.csproj", "src/Application/Stores/Ordina.Stores.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
COPY ["src/Infrastructure/Ordina.Database/Ordina.Database.csproj", "src/Infrastructure/Ordina.Database/"]
RUN dotnet restore "src/Application/Stores/Ordina.Stores.Api/Ordina.Stores.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Stores/Ordina.Stores.Api"
RUN dotnet build "Ordina.Stores.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Stores.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Stores.Api.dll"]