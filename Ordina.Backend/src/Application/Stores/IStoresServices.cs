using Ordina.Application.Common;

namespace Ordina.Application.Stores;

public interface IStoreService
{
    Task<IReadOnlyList<StoreResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<StoreResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<StoreResponseDto> CreateAsync(CreateStoreDto createDto, CancellationToken cancellationToken = default);
    Task<StoreResponseDto> UpdateAsync(string id, UpdateStoreDto updateDto, CancellationToken cancellationToken = default);
    Task<StoreResponseDto?> UpdateDisplayLimitsAsync(string id, Dictionary<string, int> limits, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

public interface IAccountService
{
    Task<IReadOnlyList<AccountResponseDto>> GetAllAsync(string? storeId = null, CancellationToken cancellationToken = default);
    Task<AccountResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<AccountResponseDto> CreateAsync(CreateAccountDto createDto, CancellationToken cancellationToken = default);
    Task<AccountResponseDto> UpdateAsync(string id, UpdateAccountDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}
