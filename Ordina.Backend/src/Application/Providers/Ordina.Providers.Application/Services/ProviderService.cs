using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Ordina.Database.Entities.Provider;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public class ProviderService : IProviderService
{
    private readonly IProviderRepository _providerRepository;
    private readonly ILogger<ProviderService> _logger;

    public ProviderService(
        IProviderRepository providerRepository,
        ILogger<ProviderService> logger)
    {
        _providerRepository = providerRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<ProviderResponseDto>> GetAllAsync()
    {
        try
        {
            var providers = await _providerRepository.GetAllAsync();
            return providers.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedores");
            throw;
        }
    }

    public async Task<ProviderResponseDto?> GetByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del proveedor es requerido", nameof(id));
            }

            if (!ObjectId.TryParse(id, out var objectId))
            {
                throw new ArgumentException("El ID del proveedor no es válido", nameof(id));
            }

            var provider = await _providerRepository.GetByIdAsync(objectId);
            return provider == null ? null : MapToDto(provider);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor con ID {ProviderId}", id);
            throw;
        }
    }

    public async Task<ProviderResponseDto?> GetByRifAsync(string rif)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(rif))
            {
                throw new ArgumentException("El RIF es requerido", nameof(rif));
            }

            var provider = await _providerRepository.GetByRifAsync(rif);
            return provider == null ? null : MapToDto(provider);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor con RIF {Rif}", rif);
            throw;
        }
    }

    public async Task<ProviderResponseDto?> GetByEmailAsync(string email)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                throw new ArgumentException("El email es requerido", nameof(email));
            }

            var provider = await _providerRepository.GetByEmailAsync(email);
            return provider == null ? null : MapToDto(provider);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor con email {Email}", email);
            throw;
        }
    }

    public async Task<ProviderResponseDto> CreateAsync(CreateProviderDto createProviderDto)
    {
        try
        {
            if (createProviderDto == null)
            {
                throw new ArgumentNullException(nameof(createProviderDto));
            }

            // Verificar RIF único solo si se proporciona
            if (!string.IsNullOrWhiteSpace(createProviderDto.Rif))
            {
                var existingByRif = await _providerRepository.GetByRifAsync(createProviderDto.Rif.Trim());
                if (existingByRif != null)
                {
                    throw new InvalidOperationException($"Ya existe un proveedor con el RIF '{createProviderDto.Rif}'");
                }
            }

            // Verificar email único si se proporciona
            if (!string.IsNullOrWhiteSpace(createProviderDto.Email))
            {
                var existingByEmail = await _providerRepository.GetByEmailAsync(createProviderDto.Email.Trim());
                if (existingByEmail != null)
                {
                    throw new InvalidOperationException($"Ya existe un proveedor con el email '{createProviderDto.Email}'");
                }
            }

            // Mapear y asignar valores
            var provider = MapFromCreateDto(createProviderDto);
            provider.FechaCreacion = DateTime.UtcNow;
            provider.Estado = createProviderDto.Estado ?? "Activo";

            // Crear proveedor
            var createdProvider = await _providerRepository.CreateAsync(provider);

            // Retornar DTO
            return MapToDto(createdProvider);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear proveedor");
            throw;
        }
    }

    public async Task<ProviderResponseDto> UpdateAsync(string id, UpdateProviderDto updateProviderDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del proveedor es requerido", nameof(id));
            }

            if (!ObjectId.TryParse(id, out var objectId))
            {
                throw new ArgumentException("El ID del proveedor no es válido", nameof(id));
            }

            if (updateProviderDto == null)
            {
                throw new ArgumentNullException(nameof(updateProviderDto));
            }

            // Obtener proveedor existente
            var existingProvider = await _providerRepository.GetByIdAsync(objectId);
            if (existingProvider == null)
            {
                throw new KeyNotFoundException($"Proveedor con ID {id} no encontrado");
            }

            // Verificar RIF único si se está cambiando
            if (!string.IsNullOrWhiteSpace(updateProviderDto.Rif) &&
                !string.Equals(existingProvider.Rif, updateProviderDto.Rif, StringComparison.OrdinalIgnoreCase))
            {
                var existingByRif = await _providerRepository.GetByRifAsync(updateProviderDto.Rif.Trim());
                if (existingByRif != null && existingByRif.Id != objectId)
                {
                    throw new InvalidOperationException($"Ya existe un proveedor con el RIF '{updateProviderDto.Rif}'");
                }
            }

            // Verificar email único si se está cambiando
            if (!string.IsNullOrWhiteSpace(updateProviderDto.Email) &&
                !string.Equals(existingProvider.Email, updateProviderDto.Email, StringComparison.OrdinalIgnoreCase))
            {
                var existingByEmail = await _providerRepository.GetByEmailAsync(updateProviderDto.Email.Trim());
                if (existingByEmail != null && existingByEmail.Id != objectId)
                {
                    throw new InvalidOperationException($"Ya existe un proveedor con el email '{updateProviderDto.Email}'");
                }
            }

            // Actualizar propiedades
            MapFromUpdateDto(updateProviderDto, existingProvider);

            // Actualizar metadatos
            existingProvider.FechaActualizacion = DateTime.UtcNow;

            // Actualizar proveedor
            var updatedProvider = await _providerRepository.UpdateAsync(existingProvider);

            return MapToDto(updatedProvider);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar proveedor con ID {ProviderId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del proveedor es requerido", nameof(id));
            }

            if (!ObjectId.TryParse(id, out var objectId))
            {
                throw new ArgumentException("El ID del proveedor no es válido", nameof(id));
            }

            var exists = await _providerRepository.ExistsAsync(objectId);
            if (!exists)
            {
                return false;
            }

            return await _providerRepository.DeleteAsync(objectId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar proveedor con ID {ProviderId}", id);
            throw;
        }
    }

    public async Task<bool> ProviderExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del proveedor es requerido", nameof(id));
            }

            if (!ObjectId.TryParse(id, out var objectId))
            {
                throw new ArgumentException("El ID del proveedor no es válido", nameof(id));
            }

            return await _providerRepository.ExistsAsync(objectId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del proveedor con ID {ProviderId}", id);
            throw;
        }
    }

    // Métodos de mapeo
    private static ProviderResponseDto MapToDto(Provider provider)
    {
        return new ProviderResponseDto
        {
            Id = provider.Id.ToString(),
            RazonSocial = provider.RazonSocial ?? provider.Nombre,
            Nombre = provider.Nombre,
            Rif = provider.Rif,
            Direccion = provider.Direccion,
            Telefono = provider.Telefono,
            Email = provider.Email,
            Contacto = provider.Contacto,
            Tipo = provider.Tipo,
            Estado = provider.Estado,
            CreatedAt = provider.FechaCreacion,
            UpdatedAt = provider.FechaActualizacion,
            ProductsCount = 0  // Considera calcular esto realmente
        };
    }

    private static Provider MapFromCreateDto(CreateProviderDto dto)
    {
        return new Provider
        {
            RazonSocial = dto.RazonSocial ?? dto.Nombre,
            Nombre = dto.Nombre,
            Rif = dto.Rif?.Trim(),
            Direccion = dto.Direccion,
            Telefono = dto.Telefono,
            Email = dto.Email?.Trim(),
            Contacto = dto.Contacto,
            Tipo = dto.Tipo,
            Estado = dto.Estado ?? "Activo"
        };
    }

    private static void MapFromUpdateDto(UpdateProviderDto dto, Provider provider)
    {
        if (!string.IsNullOrWhiteSpace(dto.RazonSocial))
            provider.RazonSocial = dto.RazonSocial;

        if (!string.IsNullOrWhiteSpace(dto.Nombre))
            provider.Nombre = dto.Nombre;

        if (!string.IsNullOrWhiteSpace(dto.Rif))
            provider.Rif = dto.Rif.Trim();

        if (!string.IsNullOrWhiteSpace(dto.Email))
            provider.Email = dto.Email.Trim();

        if (dto.Telefono != null)
            provider.Telefono = dto.Telefono;

        if (dto.Direccion != null)
            provider.Direccion = dto.Direccion;

        if (dto.Contacto != null)
            provider.Contacto = dto.Contacto;

        if (dto.Tipo != null)
            provider.Tipo = dto.Tipo;

        if (dto.Estado != null)
            provider.Estado = dto.Estado;
    }
}
