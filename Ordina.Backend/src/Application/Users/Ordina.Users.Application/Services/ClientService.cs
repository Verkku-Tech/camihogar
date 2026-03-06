using Microsoft.Extensions.Logging;
using Ordina.Database.Repositories;
using Ordina.Users.Application.DTOs;
using Ordina.Users.Application.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ClientEntity = Ordina.Database.Entities.Client.Client;

namespace Ordina.Users.Application.Services;

public class ClientService : IClientService
{
    private readonly IClientRepository _clientRepository;
    private readonly ILogger<ClientService> _logger;

    public ClientService(
        IClientRepository clientRepository,
        ILogger<ClientService> logger)
    {
        _clientRepository = clientRepository;
        _logger = logger;
    }

    public async Task<PagedResult<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? search)
    {
        try
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 10;
            if (pageSize > 100) pageSize = 100;

            var (clients, totalCount) = await _clientRepository.GetAllAsync(page, pageSize, search);
            
            var dtos = clients.Select(MapToDto);
            
            return new PagedResult<ClientResponseDto>(dtos, (int)totalCount, page, pageSize);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener clientes");
            throw;
        }
    }

    public async Task<ClientResponseDto?> GetByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(id));
            }

            var client = await _clientRepository.GetByIdAsync(id);
            return client == null ? null : MapToDto(client);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener cliente con ID {ClientId}", id);
            throw;
        }
    }

    public async Task<ClientResponseDto?> GetByRutIdAsync(string rutId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(rutId))
            {
                throw new ArgumentException("El RutId es requerido", nameof(rutId));
            }

            var client = await _clientRepository.GetByRutIdAsync(rutId);
            return client == null ? null : MapToDto(client);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener cliente con RutId {RutId}", rutId);
            throw;
        }
    }

    public async Task<ClientResponseDto> CreateAsync(CreateClientDto createClientDto)
    {
        try
        {
            if (createClientDto == null)
            {
                throw new ArgumentNullException(nameof(createClientDto));
            }

            if (string.IsNullOrWhiteSpace(createClientDto.NombreRazonSocial))
            {
                throw new ArgumentException("El nombre o razón social es requerido", nameof(createClientDto.NombreRazonSocial));
            }

            if (string.IsNullOrWhiteSpace(createClientDto.RutId))
            {
                throw new ArgumentException("El RutId es requerido", nameof(createClientDto.RutId));
            }

            ValidateTipoCliente(createClientDto.TipoCliente);
            ValidateEstado(createClientDto.Estado);

            // Validar duplicidad de RutId
            var rutExists = await _clientRepository.RutIdExistsAsync(createClientDto.RutId.Trim());
            if (rutExists)
            {
                throw new InvalidOperationException($"Ya existe un cliente con el RutId '{createClientDto.RutId}'");
            }

            var client = MapFromCreateDto(createClientDto);
            client.FechaCreacion = DateTime.UtcNow;

            var createdClient = await _clientRepository.CreateAsync(client);
            return MapToDto(createdClient);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear cliente");
            throw;
        }
    }

    public async Task<ClientResponseDto> UpdateAsync(string id, UpdateClientDto updateClientDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(id));
            }

            if (updateClientDto == null)
            {
                throw new ArgumentNullException(nameof(updateClientDto));
            }

            var existingClient = await _clientRepository.GetByIdAsync(id);
            if (existingClient == null)
            {
                throw new KeyNotFoundException($"Cliente con ID {id} no encontrado");
            }

            // Validar y comprobar duplicidad de RutId si cambia
            if (!string.IsNullOrWhiteSpace(updateClientDto.RutId) &&
                !string.Equals(existingClient.RutId, updateClientDto.RutId, StringComparison.OrdinalIgnoreCase))
            {
                var rutExists = await _clientRepository.RutIdExistsAsync(updateClientDto.RutId.Trim());
                if (rutExists)
                {
                    throw new InvalidOperationException($"Ya existe un cliente con el RutId '{updateClientDto.RutId}'");
                }
            }

            if (!string.IsNullOrWhiteSpace(updateClientDto.TipoCliente))
            {
                ValidateTipoCliente(updateClientDto.TipoCliente);
            }

            if (!string.IsNullOrWhiteSpace(updateClientDto.Estado))
            {
                ValidateEstado(updateClientDto.Estado);
            }

            MapFromUpdateDto(updateClientDto, existingClient);

            var updatedClient = await _clientRepository.UpdateAsync(existingClient);
            return MapToDto(updatedClient);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar cliente con ID {ClientId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(id));
            }

            var exists = await _clientRepository.ExistsAsync(id);
            if (!exists)
            {
                return false;
            }

            return await _clientRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar cliente con ID {ClientId}", id);
            throw;
        }
    }

    public async Task<bool> ClientExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(id));
            }

            return await _clientRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del cliente con ID {ClientId}", id);
            throw;
        }
    }

    public async Task<ImportClientsResultDto> ImportClientsFromCsvAsync(Stream fileStream)
    {
        var result = new ImportClientsResultDto();
        int rowsProcessed = 0;
        int errors = 0;
        int rowIndex = 0;

        using var reader = new StreamReader(fileStream, Encoding.UTF8);
        
        // Determinar índices de columnas de forma dinámica
        var headerLine = await reader.ReadLineAsync();
        if (string.IsNullOrWhiteSpace(headerLine))
        {
            result.Message = "El archivo CSV está vacío o no tiene encabezados.";
            return result;
        }

        var headers = ParseCsvLine(headerLine);
        
        int idxNombre = FindColumnIndex(headers, "Nombre del tercero", "nombreRazonSocial");
        int idxApodo = FindColumnIndex(headers, "Apodo");
        int idxRutId = FindColumnIndex(headers, "RIF / C.I", "rutId", "rut");
        int idxDireccion = FindColumnIndex(headers, "Dreccion de envio", "direccion");
        int idxTelefono = FindColumnIndex(headers, "Teléfono", "telefono");
        int idxTelefono2 = FindColumnIndex(headers, "Telefono 2", "telefono2");
        int idxEmail = FindColumnIndex(headers, "Correo", "email");
        int idxTipo = FindColumnIndex(headers, "Tipo de tercero", "tipoCliente");
        int idxEstado = FindColumnIndex(headers, "Estado", "estado");

        if (idxNombre == -1 || idxRutId == -1)
        {
            result.Message = "El CSV debe contener al menos las columnas 'Nombre del tercero' y 'RIF / C.I'.";
            return result;
        }

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(line)) continue;

            rowIndex++;
            try
            {
                var values = ParseCsvLine(line);
                if (values.Count < 2) continue; // línea inválida muy corta

                string rutIdRaw = GetValueOrEmpty(values, idxRutId);
                string nombreRaw = GetValueOrEmpty(values, idxNombre);

                if (string.IsNullOrWhiteSpace(rutIdRaw) || string.IsNullOrWhiteSpace(nombreRaw))
                {
                    errors++;
                    continue; // Requeridos
                }

                string rutId = rutIdRaw.Trim();
                
                // Buscar si existe para no duplicar por número de ID
                var existingClient = await _clientRepository.GetByRutIdAsync(rutId);
                if (existingClient != null)
                {
                    // Saltar si ya existe (o podríamos actualizarlo)
                    // TODO: implementar actualización si es necesario
                    continue; 
                }

                string tipoRaw = GetValueOrEmpty(values, idxTipo).ToLowerInvariant();
                string estadoRaw = GetValueOrEmpty(values, idxEstado).ToLowerInvariant();
                
                var client = new ClientEntity
                {
                    NombreRazonSocial = nombreRaw.Trim(),
                    Apodo = GetValueOrEmpty(values, idxApodo).Trim(),
                    RutId = rutId,
                    Direccion = GetValueOrEmpty(values, idxDireccion).Trim(),
                    Telefono = GetValueOrEmpty(values, idxTelefono).Trim(),
                    Telefono2 = GetValueOrEmpty(values, idxTelefono2).Trim(),
                    Email = GetValueOrEmpty(values, idxEmail).Trim(),
                    TipoCliente = (tipoRaw.Contains("empresa")) ? "empresa" : "particular",
                    Estado = (estadoRaw.Contains("inactiv")) ? "inactivo" : "activo",
                    FechaCreacion = DateTime.UtcNow,
                    TieneNotasDespacho = false
                };

                // Si la dirección viene vacía, le ponemos un valor por defecto requerido
                if (string.IsNullOrWhiteSpace(client.Direccion)) 
                    client.Direccion = "Sin dirección provista";

                await _clientRepository.CreateAsync(client);
                rowsProcessed++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al procesar línea {RowIndex} del CSV", rowIndex);
                errors++;
            }
        }

        result.RowsProcessed = rowsProcessed;
        result.Errors = errors;
        result.Total = rowsProcessed + errors;
        result.Message = $"Procesamiento de archivo finalizado. Se han guardado {rowsProcessed} clientes correctamente.";

        return result;
    }

    private static int FindColumnIndex(List<string> headers, params string[] possibleNames)
    {
        for (int i = 0; i < headers.Count; i++)
        {
            var header = headers[i]?.Trim();
            if (string.IsNullOrWhiteSpace(header)) continue;
            
            foreach (var possible in possibleNames)
            {
                if (header.Equals(possible, StringComparison.OrdinalIgnoreCase))
                    return i;
            }
        }
        return -1;
    }

    private static string GetValueOrEmpty(List<string> values, int index)
    {
        if (index < 0 || index >= values.Count) return string.Empty;
        return values[index];
    }

    /// <summary>
    /// Mini-parser de CSV que respeta comas dentro de comillas
    /// </summary>
    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var currentToken = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char ch = line[i];

            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                result.Add(currentToken.ToString());
                currentToken.Clear();
            }
            else
            {
                currentToken.Append(ch);
            }
        }
        
        result.Add(currentToken.ToString()); // El último token
        return result;
    }

    #region Métodos de validación

    private static void ValidateTipoCliente(string tipoCliente)
    {
        if (string.IsNullOrWhiteSpace(tipoCliente))
        {
            throw new ArgumentException("El TipoCliente es requerido", nameof(tipoCliente));
        }

        var normalized = tipoCliente.Trim().ToLowerInvariant();
        if (normalized is not ("empresa" or "particular"))
        {
            throw new ArgumentException("El TipoCliente debe ser 'empresa' o 'particular'", nameof(tipoCliente));
        }
    }

    private static void ValidateEstado(string estado)
    {
        if (string.IsNullOrWhiteSpace(estado))
        {
            throw new ArgumentException("El Estado es requerido", nameof(estado));
        }

        var normalized = estado.Trim().ToLowerInvariant();
        if (normalized is not ("activo" or "inactivo"))
        {
            throw new ArgumentException("El Estado debe ser 'activo' o 'inactivo'", nameof(estado));
        }
    }

    #endregion

    #region Métodos de mapeo

    private static ClientResponseDto MapToDto(ClientEntity client)
    {
        return new ClientResponseDto
        {
            Id = client.Id,
            NombreRazonSocial = client.NombreRazonSocial,
            Apodo = client.Apodo,
            RutId = client.RutId,
            Direccion = client.Direccion,
            Telefono = client.Telefono,
            Telefono2 = client.Telefono2,
            Email = client.Email,
            TipoCliente = client.TipoCliente,
            Estado = client.Estado,
            FechaCreacion = client.FechaCreacion.ToString("o"),
            TieneNotasDespacho = client.TieneNotasDespacho
        };
    }

    private static ClientEntity MapFromCreateDto(CreateClientDto dto)
    {
        return new ClientEntity
        {
            NombreRazonSocial = dto.NombreRazonSocial.Trim(),
            Apodo = dto.Apodo,
            RutId = dto.RutId.Trim(),
            Direccion = dto.Direccion.Trim(),
            Telefono = dto.Telefono.Trim(),
            Telefono2 = dto.Telefono2,
            Email = dto.Email?.Trim(),
            TipoCliente = dto.TipoCliente.Trim().ToLowerInvariant(),
            Estado = dto.Estado.Trim().ToLowerInvariant(),
            TieneNotasDespacho = dto.TieneNotasDespacho
        };
    }

    private static void MapFromUpdateDto(UpdateClientDto dto, ClientEntity client)
    {
        if (!string.IsNullOrWhiteSpace(dto.NombreRazonSocial))
            client.NombreRazonSocial = dto.NombreRazonSocial.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Apodo))
            client.Apodo = dto.Apodo.Trim();

        if (!string.IsNullOrWhiteSpace(dto.RutId))
            client.RutId = dto.RutId.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Direccion))
            client.Direccion = dto.Direccion.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Telefono))
            client.Telefono = dto.Telefono.Trim();

        if (dto.Telefono2 != null)
            client.Telefono2 = dto.Telefono2.Trim();

        if (dto.Email != null)
            client.Email = dto.Email.Trim();

        if (!string.IsNullOrWhiteSpace(dto.TipoCliente))
            client.TipoCliente = dto.TipoCliente.Trim().ToLowerInvariant();

        if (!string.IsNullOrWhiteSpace(dto.Estado))
            client.Estado = dto.Estado.Trim().ToLowerInvariant();

        if (dto.TieneNotasDespacho.HasValue)
            client.TieneNotasDespacho = dto.TieneNotasDespacho.Value;
    }

    #endregion
}

