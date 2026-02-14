using Ordina.Stores.Application.DTOs;

namespace Ordina.Stores.Application.Services;

public interface IAccountService
{
    Task<IEnumerable<AccountResponseDto>> GetAllAccountsAsync(string? storeId = null, bool? isActive = null);
    Task<AccountResponseDto?> GetAccountByIdAsync(string id);
    Task<AccountResponseDto> CreateAccountAsync(CreateAccountDto dto);
    Task<AccountResponseDto> UpdateAccountAsync(string id, UpdateAccountDto dto);
    Task DeleteAccountAsync(string id);
}