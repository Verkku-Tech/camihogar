using Ordina.Stores.Application.DTOs;

namespace Ordina.Stores.Application.Services;

public interface IStoreService
{
    Task<IEnumerable<StoreResponseDto>> GetAllStoresAsync(string? status = null);
    Task<StoreResponseDto?> GetStoreByIdAsync(string id);
    Task<StoreResponseDto?> GetStoreByCodeAsync(string code);
    Task<StoreResponseDto> CreateStoreAsync(CreateStoreDto dto);
    Task<StoreResponseDto> UpdateStoreAsync(string id, UpdateStoreDto dto);
    Task DeleteStoreAsync(string id);
}