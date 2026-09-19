namespace Ordina.Application.Clients;

public record ClientResponseDto(
    string Id,
    string NombreRazonSocial,
    string? Apodo,
    string RutId,
    string Direccion,
    string Telefono,
    string? Telefono2,
    string? Email,
    string TipoCliente,
    string Estado,
    DateTime FechaCreacion,
    bool TieneNotasDespacho);

public record CreateClientDto(
    string NombreRazonSocial,
    string RutId,
    string Direccion,
    string Telefono,
    string? Apodo = null,
    string? Telefono2 = null,
    string? Email = null,
    string TipoCliente = "particular",
    string Estado = "activo");

public record UpdateClientDto(
    string? NombreRazonSocial = null,
    string? Apodo = null,
    string? RutId = null,
    string? Direccion = null,
    string? Telefono = null,
    string? Telefono2 = null,
    string? Email = null,
    string? TipoCliente = null,
    string? Estado = null);

public record ImportClientsResultDto(
    int TotalProcessed,
    int CreatedCount,
    int UpdatedCount,
    int ErrorCount,
    IReadOnlyList<string> Errors);
