using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Enums;
using Ordina.Domain.Users;

namespace Ordina.Application.Clients;

public class ClientService : IClientService
{
    private readonly IClientRepository _clientRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<ClientService> _logger;

    public ClientService(
        IClientRepository clientRepository,
        IOrderRepository orderRepository,
        ILogger<ClientService> logger)
    {
        _clientRepository = clientRepository;
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<PagedResult<ClientResponseDto>> GetAllAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        var result = await _clientRepository.GetPagedAsync(
            request.Page,
            request.PageSize,
            string.IsNullOrWhiteSpace(request.SearchTerm) ? null : c => c.NombreRazonSocial.Contains(request.SearchTerm) || c.RutId.Contains(request.SearchTerm) || (c.Apodo != null && c.Apodo.Contains(request.SearchTerm)),
            cancellationToken);

        return new PagedResult<ClientResponseDto>(
            result.Items.Select(MapToDto).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public async Task<ClientResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var client = await _clientRepository.GetByIdAsync(id, cancellationToken);
        return client != null ? MapToDto(client) : null;
    }

    public async Task<ClientResponseDto?> GetByRutIdAsync(string rutId, CancellationToken cancellationToken = default)
    {
        var normalized = RutValidator.Normalize(rutId);
        var client = await _clientRepository.GetByRutAsync(normalized, cancellationToken)
                     ?? await _clientRepository.GetByRutAsync(rutId, cancellationToken);
        return client != null ? MapToDto(client) : null;
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto createClientDto, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(createClientDto.NombreRazonSocial))
        {
            throw new ArgumentException("El nombre o razón social es requerido", nameof(createClientDto.NombreRazonSocial));
        }

        if (string.IsNullOrWhiteSpace(createClientDto.RutId))
        {
            throw new ArgumentException("El RutId es requerido", nameof(createClientDto.RutId));
        }

        var normalizedRut = RutValidator.Normalize(createClientDto.RutId);
        var existing = await _clientRepository.GetByRutAsync(normalizedRut, cancellationToken)
                       ?? await _clientRepository.GetByRutAsync(createClientDto.RutId, cancellationToken);

        if (existing != null)
        {
            throw new InvalidOperationException($"Ya existe un cliente con el RutId '{createClientDto.RutId}'");
        }

        var client = new Client
        {
            NombreRazonSocial = createClientDto.NombreRazonSocial.Trim(),
            Apodo = createClientDto.Apodo?.Trim(),
            RutId = normalizedRut,
            Direccion = createClientDto.Direccion.Trim(),
            Telefono = createClientDto.Telefono.Trim(),
            Telefono2 = createClientDto.Telefono2?.Trim(),
            Email = createClientDto.Email?.Trim().ToLowerInvariant(),
            TipoClienteString = createClientDto.TipoCliente,
            EstadoString = createClientDto.Estado,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _clientRepository.AddAsync(client, cancellationToken);
        _logger.LogInformation("Cliente creado: {ClientId} ({RutId})", created.Id, created.RutId);
        return MapToDto(created);
    }

    public async Task<ClientResponseDto> UpdateAsync(string id, UpdateClientDto updateClientDto, CancellationToken cancellationToken = default)
    {
        var client = await _clientRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Cliente no encontrado: {id}");

        if (!string.IsNullOrWhiteSpace(updateClientDto.NombreRazonSocial))
            client.NombreRazonSocial = updateClientDto.NombreRazonSocial.Trim();
        if (updateClientDto.Apodo != null)
            client.Apodo = updateClientDto.Apodo.Trim();
        if (!string.IsNullOrWhiteSpace(updateClientDto.RutId))
        {
            var normalizedRut = RutValidator.Normalize(updateClientDto.RutId);
            if (normalizedRut != client.RutId)
            {
                var existing = await _clientRepository.GetByRutAsync(normalizedRut, cancellationToken);
                if (existing != null && existing.Id != id)
                    throw new InvalidOperationException($"Ya existe un cliente con el RutId '{updateClientDto.RutId}'");
                client.RutId = normalizedRut;
            }
        }
        if (!string.IsNullOrWhiteSpace(updateClientDto.Direccion))
            client.Direccion = updateClientDto.Direccion.Trim();
        if (!string.IsNullOrWhiteSpace(updateClientDto.Telefono))
            client.Telefono = updateClientDto.Telefono.Trim();
        if (updateClientDto.Telefono2 != null)
            client.Telefono2 = updateClientDto.Telefono2.Trim();
        if (updateClientDto.Email != null)
            client.Email = updateClientDto.Email.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(updateClientDto.TipoCliente))
            client.TipoClienteString = updateClientDto.TipoCliente;
        if (!string.IsNullOrWhiteSpace(updateClientDto.Estado))
            client.EstadoString = updateClientDto.Estado;

        client.UpdatedAt = DateTime.UtcNow;
        await _clientRepository.UpdateAsync(client, cancellationToken);
        return MapToDto(client);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var client = await _clientRepository.GetByIdAsync(id, cancellationToken);
        if (client == null) return false;

        var orders = await _orderRepository.FindAsync(o => o.ClientId == id, cancellationToken);
        if (orders.Count > 0)
        {
            throw new InvalidOperationException("No se puede eliminar un cliente con pedidos asociados. Desactívelo en su lugar.");
        }

        return await _clientRepository.DeleteAsync(id, cancellationToken);
    }

    public async Task<bool> ClientExistsAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _clientRepository.ExistsAsync(id, cancellationToken);
    }

    public async Task<ImportClientsResultDto> ImportClientsFromCsvAsync(Stream fileStream, CancellationToken cancellationToken = default)
    {
        using var reader = new StreamReader(fileStream);
        var errors = new List<string>();
        int processed = 0, created = 0, updated = 0;

        string? header = await reader.ReadLineAsync(cancellationToken);
        if (header == null) return new ImportClientsResultDto(0, 0, 0, 0, errors);

        string? line;
        while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            processed++;

            var parts = line.Split(',');
            if (parts.Length < 4)
            {
                errors.Add($"Línea {processed}: formato insuficiente");
                continue;
            }

            var nombre = parts[0].Trim();
            var rut = RutValidator.Normalize(parts[1].Trim());
            var telefono = parts[2].Trim();
            var direccion = parts[3].Trim();

            if (string.IsNullOrEmpty(nombre) || string.IsNullOrEmpty(rut))
            {
                errors.Add($"Línea {processed}: Nombre o RUT faltante");
                continue;
            }

            var existing = await _clientRepository.GetByRutAsync(rut, cancellationToken);
            if (existing != null)
            {
                existing.NombreRazonSocial = nombre;
                existing.Telefono = telefono;
                existing.Direccion = direccion;
                existing.UpdatedAt = DateTime.UtcNow;
                await _clientRepository.UpdateAsync(existing, cancellationToken);
                updated++;
            }
            else
            {
                var newClient = new Client
                {
                    NombreRazonSocial = nombre,
                    RutId = rut,
                    Telefono = telefono,
                    Direccion = direccion,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _clientRepository.AddAsync(newClient, cancellationToken);
                created++;
            }
        }

        return new ImportClientsResultDto(processed, created, updated, errors.Count, errors);
    }

    private static ClientResponseDto MapToDto(Client c) => new(
        c.Id,
        c.NombreRazonSocial,
        c.Apodo,
        c.RutId,
        c.Direccion,
        c.Telefono,
        c.Telefono2,
        c.Email,
        c.TipoClienteString,
        c.EstadoString,
        c.CreatedAt,
        c.TieneNotasDespacho);
}
