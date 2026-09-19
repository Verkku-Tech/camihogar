# Build stage
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src

# Copy csproj and restore
COPY ["src/Domain/Ordina.Domain.csproj", "src/Domain/"]
COPY ["src/Application/Ordina.Application.csproj", "src/Application/"]
COPY ["src/Infrastructure/Ordina.Infrastructure.csproj", "src/Infrastructure/"]
COPY ["src/Api/Ordina.Api.csproj", "src/Api/"]

RUN dotnet restore "src/Api/Ordina.Api.csproj" -a $TARGETARCH

# Copy source and publish
COPY . .
WORKDIR "/src/src/Api"
RUN dotnet publish "Ordina.Api.csproj" \
    -c Release \
    -a $TARGETARCH \
    -o /app/publish \
    --no-restore \
    -p:PublishReadyToRun=true

# Runtime stage (Chiseled Ubuntu for ARM64/AMD64)
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Ordina.Api.dll"]
