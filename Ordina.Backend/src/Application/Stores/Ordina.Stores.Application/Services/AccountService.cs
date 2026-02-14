using Ordina.Database.Entities.Account;
using Ordina.Database.Repositories;
using Ordina.Stores.Application.DTOs;
using Ordina.Stores.Application.Services;

namespace Ordina.Stores.Application.Services;

public class AccountService : IAccountService
{
    private readonly IAccountRepository _accountRepository;

    public AccountService(IAccountRepository accountRepository)
    {
        _accountRepository = accountRepository;
    }

    public async Task<IEnumerable<AccountResponseDto>> GetAllAccountsAsync(string? storeId = null, bool? isActive = null)
    {
        IEnumerable<Account> accounts;

        if (storeId != null && isActive.HasValue)
        {
            // Ambos filtros
            accounts = (await _accountRepository.GetByStoreIdAsync(storeId))
                .Where(a => a.IsActive == isActive.Value);
        }
        else if (storeId != null)
        {
            accounts = await _accountRepository.GetByStoreIdAsync(storeId);
        }
        else if (isActive.HasValue)
        {
            accounts = await _accountRepository.GetByActiveStatusAsync(isActive.Value);
        }
        else
        {
            accounts = await _accountRepository.GetAllAsync();
        }

        return accounts.Select(MapToResponseDto);
    }

    public async Task<AccountResponseDto?> GetAccountByIdAsync(string id)
    {
        var account = await _accountRepository.GetByIdAsync(id);
        return account != null ? MapToResponseDto(account) : null;
    }

    public async Task<AccountResponseDto> CreateAccountAsync(CreateAccountDto dto)
    {
        // Validar que el código no exista
        var existingAccount = await _accountRepository.GetByCodeAsync(dto.Code);
        if (existingAccount != null)
        {
            throw new ArgumentException($"Ya existe una cuenta con el código '{dto.Code}'");
        }

        var account = new Account
        {
            Code = dto.Code,
            Label = dto.Label,
            StoreId = dto.StoreId,
            IsForeign = dto.IsForeign,
            AccountType = dto.AccountType,
            Email = dto.Email,
            Wallet = dto.Wallet,
            IsActive = dto.IsActive
        };

        var createdAccount = await _accountRepository.CreateAsync(account);
        return MapToResponseDto(createdAccount);
    }

    public async Task<AccountResponseDto> UpdateAccountAsync(string id, UpdateAccountDto dto)
    {
        var existingAccount = await _accountRepository.GetByIdAsync(id);
        if (existingAccount == null)
        {
            throw new KeyNotFoundException($"Cuenta con ID {id} no encontrada");
        }

        // Validar código único si se está cambiando
        if (dto.Code != null && dto.Code != existingAccount.Code)
        {
            var accountWithCode = await _accountRepository.GetByCodeAsync(dto.Code);
            if (accountWithCode != null)
            {
                throw new ArgumentException($"Ya existe una cuenta con el código '{dto.Code}'");
            }
        }

        // Actualizar campos
        if (dto.Code != null) existingAccount.Code = dto.Code;
        if (dto.Label != null) existingAccount.Label = dto.Label;
        if (dto.StoreId != null) existingAccount.StoreId = dto.StoreId;
        if (dto.IsForeign.HasValue) existingAccount.IsForeign = dto.IsForeign.Value;
        if (dto.AccountType != null) existingAccount.AccountType = dto.AccountType;
        if (dto.Email != null) existingAccount.Email = dto.Email;
        if (dto.Wallet != null) existingAccount.Wallet = dto.Wallet;
        if (dto.IsActive.HasValue) existingAccount.IsActive = dto.IsActive.Value;

        var updatedAccount = await _accountRepository.UpdateAsync(existingAccount);
        return MapToResponseDto(updatedAccount);
    }

    public async Task DeleteAccountAsync(string id)
    {
        var exists = await _accountRepository.ExistsAsync(id);
        if (!exists)
        {
            throw new KeyNotFoundException($"Cuenta con ID {id} no encontrada");
        }

        await _accountRepository.DeleteAsync(id);
    }

    private static AccountResponseDto MapToResponseDto(Account account)
    {
        return new AccountResponseDto
        {
            Id = account.Id,
            Code = account.Code,
            Label = account.Label,
            StoreId = account.StoreId,
            IsForeign = account.IsForeign,
            AccountType = account.AccountType,
            Email = account.Email,
            Wallet = account.Wallet,
            IsActive = account.IsActive,
            CreatedAt = account.CreatedAt,
            UpdatedAt = account.UpdatedAt
        };
    }
}