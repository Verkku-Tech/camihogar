using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public interface IProviderService
{
    Task<IEnumerable<ProviderResponseDto>> GetAllAsync();
    Task<ProviderResponseDto?> GetByIdAsync(string id);
    Task<ProviderResponseDto?> GetByRifAsync(string rif);
    Task<ProviderResponseDto?> GetByEmailAsync(string email);
    Task<ProviderResponseDto> CreateAsync(CreateProviderDto createProviderDto);
    Task<ProviderResponseDto> UpdateAsync(string id, UpdateProviderDto updateProviderDto);
    Task<bool> DeleteAsync(string id);
    Task<bool> ProviderExistsAsync(string id);
}
