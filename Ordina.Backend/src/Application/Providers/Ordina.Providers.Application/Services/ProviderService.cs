using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Provider;
using Ordina.Database.MongoContext;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ordina.Providers.Application.Services;

public class ProviderService : IProviderService
{
    private readonly IProviderRepository _providerRepository;
    private readonly IMongoCollection<Provider> _collection;
    private readonly ILogger<ProviderService> _logger;

    public ProviderService(
        IProviderRepository providerRepository,
        ILogger<ProviderService> logger,
        IMongoDatabase database)
    {
        _providerRepository = providerRepository;
        _logger = logger;
        _collection = database.GetCollection<Provider>("providers");

    }

    private void CreateIndexes()
    {
        var indexKeys = Builders<Provider>.IndexKeys.Ascending(p => p.Rif);
        var indexOptions = new CreateIndexOptions { Unique = true };
        var indexModel = new CreateIndexModel<Provider>(indexKeys, indexOptions);
    }

    public async Task<IEnumerable<ProviderResponseDto>> GetAllAsync()
    {
        var providers = await _collection.Find(_ => true).ToListAsync();
        return providers.Select(MapToDto).ToList();
    }

    public async Task<ProviderResponseDto?> GetByIdAsync(ObjectId id)
    {
        
        var provider = await _collection.Find(p => p.Id == id).FirstOrDefaultAsync();
        return provider == null ? null : MapToDto(provider);
    }

    public async Task<ProviderResponseDto?> GetByRifAsync(string rif)
    {
        var provider = await _collection.Find(p => p.Rif == rif).FirstOrDefaultAsync();
        return provider == null ? null : MapToDto(provider);
    }

    public async Task<ProviderResponseDto> CreateAsync(CreateProviderDto createProviderDto)
    {
        // Validación del DTO
        if (createProviderDto == null)
            throw new ArgumentNullException(nameof(createProviderDto));

        if (string.IsNullOrWhiteSpace(createProviderDto.Rif))
            throw new ArgumentException("El RIF no puede estar vacío", nameof(createProviderDto.Rif));

        // Verificar RIF único (case insensitive)
        var existing = await _collection
            .Find(p => p.Rif.ToLower() == createProviderDto.Rif.Trim().ToLower())
            .FirstOrDefaultAsync();

        if (existing != null)
            throw new InvalidOperationException($"Ya existe un proveedor con el RIF {createProviderDto.Rif}");

        // Mapear y asignar valores
        var provider = MapFromCreateDto(createProviderDto);
        //provider.Id = ObjectId.GenerateNewId();
        provider.FechaCreacion = DateTime.UtcNow;
        provider.Estado = "Activo";  // Ejemplo de valor por defecto

        // Insertar
        await _collection.InsertOneAsync(provider);

        // Retornar DTO
        return MapToDto(provider);
    }

    public async Task<ProviderResponseDto?> UpdateAsync(ObjectId id, UpdateProviderDto updateProviderDto)
    {
        // Validaciones iniciales
        if (updateProviderDto == null)
            throw new ArgumentNullException(nameof(updateProviderDto));

        
        var provider = await _collection.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (provider == null) return null;

        
        if (!string.IsNullOrWhiteSpace(updateProviderDto.Rif) &&
            !string.Equals(provider.Rif, updateProviderDto.Rif, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await _collection
                .Find(p => p.Rif.ToLower() == updateProviderDto.Rif.Trim().ToLower())
                .FirstOrDefaultAsync();

            if (existing != null && existing.Id != id)  // Excluir el propio proveedor
                throw new InvalidOperationException($"Ya existe un proveedor con el RIF {updateProviderDto.Rif}");
        }

        // 3. Actualizar propiedades
        MapFromUpdateDto(updateProviderDto, provider);

        // 4. Actualizar metadatos
        provider.FechaActualizacion = DateTime.UtcNow;

        // 5. Reemplazar en BD con filtro por Guid
        var result = await _collection.ReplaceOneAsync(p => p.Id == id, provider);

        // 6. Verificar que se actualizó
        if (result.ModifiedCount == 0)
            throw new InvalidOperationException("No se pudo actualizar el proveedor");

        return MapToDto(provider);
    }

    public async Task<bool> DeleteAsync(ObjectId id)
    {
        // Verificar que existe
        var exists = await _collection.Find(p => p.Id == id).AnyAsync();
        if (!exists) return false;

        // Eliminar
        var result = await _collection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }

    // Métodos de mapeo
    private static ProviderResponseDto MapToDto(Provider provider)
    {
        return new ProviderResponseDto
        {
            Id = provider.Id,
            RazonSocial = provider.RazonSocial,
            Nombre = provider.Nombre,
            Rif = provider.Rif,
            Direccion = provider.Direccion,
            Telefono = provider.Telefono,
            Email = provider.Email,
            Contacto = provider.Contacto,
            Tipo = provider.Tipo,
            Estado = provider.Estado,
            CreatedAt = provider.FechaCreacion,
            UpdatedAt = provider.FechaActualizacion,  // Cambié de null a propiedad real
            ProductsCount = 0  // Considera calcular esto realmente
        };
    }

    private static Provider MapFromCreateDto(CreateProviderDto dto)
    {
        return new Provider
        {
            RazonSocial = dto.RazonSocial,
            Nombre = dto.Nombre,
            Rif = dto.Rif,
            Direccion = dto.Direccion ?? string.Empty,
            Telefono = dto.Telefono ?? string.Empty,
            Email = dto.Email,
            Contacto = dto.Contacto ?? string.Empty,
            Tipo = dto.Tipo ?? string.Empty,
            Estado = dto.Estado
        };
    }

    private static void MapFromUpdateDto(UpdateProviderDto dto, Provider provider)
    {
        if (!string.IsNullOrWhiteSpace(dto.RazonSocial))
            provider.RazonSocial = dto.RazonSocial;

        if (!string.IsNullOrWhiteSpace(dto.Nombre))
            provider.Nombre = dto.Nombre;

        if (!string.IsNullOrWhiteSpace(dto.Rif))
            provider.Rif = dto.Rif;

        if (!string.IsNullOrWhiteSpace(dto.Email))
            provider.Email = dto.Email;

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