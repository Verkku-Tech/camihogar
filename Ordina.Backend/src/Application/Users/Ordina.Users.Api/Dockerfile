FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Users/Ordina.Users.Api/Ordina.Users.Api.csproj", "src/Application/Users/Ordina.Users.Api/"]
COPY ["src/Application/Users/Ordina.Users.Application/Ordina.Users.Application.csproj", "src/Application/Users/Ordina.Users.Application/"]
COPY ["src/Application/Users/Ordina.Users.Domain/Ordina.Users.Domain.csproj", "src/Application/Users/Ordina.Users.Domain/"]
COPY ["src/Application/Users/Ordina.Users.Infrastructure/Ordina.Users.Infrastructure.csproj", "src/Application/Users/Ordina.Users.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
RUN dotnet restore "src/Application/Users/Ordina.Users.Api/Ordina.Users.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Users/Ordina.Users.Api"
RUN dotnet build "Ordina.Users.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Users.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
# Install curl for health checks
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Users.Api.dll"] 