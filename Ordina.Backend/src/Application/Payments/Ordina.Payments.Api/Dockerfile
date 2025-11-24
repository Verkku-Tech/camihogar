FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["src/Application/Payments/Ordina.Payments.Api/Ordina.Payments.Api.csproj", "src/Application/Payments/Ordina.Payments.Api/"]
COPY ["src/Application/Payments/Ordina.Payments.Application/Ordina.Payments.Application.csproj", "src/Application/Payments/Ordina.Payments.Application/"]
COPY ["src/Application/Payments/Ordina.Payments.Domain/Ordina.Payments.Domain.csproj", "src/Application/Payments/Ordina.Payments.Domain/"]
COPY ["src/Application/Payments/Ordina.Payments.Infrastructure/Ordina.Payments.Infrastructure.csproj", "src/Application/Payments/Ordina.Payments.Infrastructure/"]
COPY ["src/Infrastructure/Ordina.ServiceDefaults/Ordina.ServiceDefaults.csproj", "src/Infrastructure/Ordina.ServiceDefaults/"]
RUN dotnet restore "src/Application/Payments/Ordina.Payments.Api/Ordina.Payments.Api.csproj"
COPY . .
WORKDIR "/src/src/Application/Payments/Ordina.Payments.Api"
RUN dotnet build "Ordina.Payments.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "Ordina.Payments.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Ordina.Payments.Api.dll"] 