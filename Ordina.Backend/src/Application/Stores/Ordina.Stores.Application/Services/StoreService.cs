using Ordina.Database.Entities.Store;
using Ordina.Database.Repositories;
using Ordina.Stores.Application.DTOs;
using Ordina.Stores.Application.Services;

namespace Ordina.Stores.Application.Services;

public class StoreService : IStoreService
{
    private readonly IStoreRepository _storeRepository;

    public StoreService(IStoreRepository storeRepository)
    {
        _storeRepository = storeRepository;
    }

    public async Task<IEnumerable<StoreResponseDto>> GetAllStoresAsync(string? status = null)
    {
        IEnumerable<Store> stores;

        if (status != null)
        {
            stores = await _storeRepository.GetByStatusAsync(status);
        }
        else
        {
            stores = await _storeRepository.GetAllAsync();
        }

        return stores.Select(MapToResponseDto);
    }

    public async Task<StoreResponseDto?> GetStoreByIdAsync(string id)
    {
        var store = await _storeRepository.GetByIdAsync(id);
        return store != null ? MapToResponseDto(store) : null;
    }

    public async Task<StoreResponseDto?> GetStoreByCodeAsync(string code)
    {
        var store = await _storeRepository.GetByCodeAsync(code);
        return store != null ? MapToResponseDto(store) : null;
    }

    public async Task<StoreResponseDto> CreateStoreAsync(CreateStoreDto dto)
    {
        // Validar que el código no exista
        var existingStore = await _storeRepository.GetByCodeAsync(dto.Code);
        if (existingStore != null)
        {
            throw new ArgumentException($"Ya existe una tienda con el código '{dto.Code}'");
        }

        var store = new Store
        {
            Name = dto.Name,
            Code = dto.Code,
            Address = dto.Address,
            Phone = dto.Phone,
            Email = dto.Email,
            Rif = dto.Rif,
            Status = dto.Status
        };

        var createdStore = await _storeRepository.CreateAsync(store);
        return MapToResponseDto(createdStore);
    }

    public async Task<StoreResponseDto> UpdateStoreAsync(string id, UpdateStoreDto dto)
    {
        var existingStore = await _storeRepository.GetByIdAsync(id);
        if (existingStore == null)
        {
            throw new KeyNotFoundException($"Tienda con ID {id} no encontrada");
        }

        // Validar código único si se está cambiando
        if (dto.Code != null && dto.Code != existingStore.Code)
        {
            var storeWithCode = await _storeRepository.GetByCodeAsync(dto.Code);
            if (storeWithCode != null)
            {
                throw new ArgumentException($"Ya existe una tienda con el código '{dto.Code}'");
            }
        }

        // Actualizar campos
        if (dto.Name != null) existingStore.Name = dto.Name;
        if (dto.Code != null) existingStore.Code = dto.Code;
        if (dto.Address != null) existingStore.Address = dto.Address;
        if (dto.Phone != null) existingStore.Phone = dto.Phone;
        if (dto.Email != null) existingStore.Email = dto.Email;
        if (dto.Rif != null) existingStore.Rif = dto.Rif;
        if (dto.Status != null) existingStore.Status = dto.Status;

        var updatedStore = await _storeRepository.UpdateAsync(existingStore);
        return MapToResponseDto(updatedStore);
    }

    public async Task DeleteStoreAsync(string id)
    {
        var exists = await _storeRepository.ExistsAsync(id);
        if (!exists)
        {
            throw new KeyNotFoundException($"Tienda con ID {id} no encontrada");
        }

        await _storeRepository.DeleteAsync(id);
    }

    private static StoreResponseDto MapToResponseDto(Store store)
    {
        return new StoreResponseDto
        {
            Id = store.Id,
            Name = store.Name,
            Code = store.Code,
            Address = store.Address,
            Phone = store.Phone,
            Email = store.Email,
            Rif = store.Rif,
            Status = store.Status,
            CreatedAt = store.CreatedAt,
            UpdatedAt = store.UpdatedAt
        };
    }
}