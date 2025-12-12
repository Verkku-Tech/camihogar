FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Security/Ordina.Security.Api/Ordina.Security.Api.csproj", "src/Application/Security/Ordina.Security.Api/"]
COPY ["src/Application/Security/Ordina.Security.Application/Ordina.Security.Application.csproj", "src/Application/Security/Ordina.Security.Application/"]
COPY ["src/Application/Security/Ordina.Security.Domain/Ordina.Security.Domain.csproj", "src/Application/Security/Ordina.Security.Domain/"]
COPY ["src/Application/Security/Ordina.Security.Infrastructure/Ordina.Security.Infrastructure.csproj", "src/Application/Security/Ordina.Security.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
RUN dotnet restore "src/Application/Security/Ordina.Security.Api/Ordina.Security.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Security/Ordina.Security.Api"
RUN dotnet build "Ordina.Security.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Security.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Security.Api.dll"] 