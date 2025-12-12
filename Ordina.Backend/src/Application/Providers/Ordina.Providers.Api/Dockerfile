FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Providers/Ordina.Providers.Api/Ordina.Providers.Api.csproj", "src/Application/Providers/Ordina.Providers.Api/"]
COPY ["src/Application/Providers/Ordina.Providers.Application/Ordina.Providers.Application.csproj", "src/Application/Providers/Ordina.Providers.Application/"]
COPY ["src/Application/Providers/Ordina.Providers.Domain/Ordina.Providers.Domain.csproj", "src/Application/Providers/Ordina.Providers.Domain/"]
COPY ["src/Application/Providers/Ordina.Providers.Infrastructure/Ordina.Providers.Infrastructure.csproj", "src/Application/Providers/Ordina.Providers.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
RUN dotnet restore "src/Application/Providers/Ordina.Providers.Api/Ordina.Providers.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Providers/Ordina.Providers.Api"
RUN dotnet build "Ordina.Providers.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Providers.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Providers.Api.dll"] 