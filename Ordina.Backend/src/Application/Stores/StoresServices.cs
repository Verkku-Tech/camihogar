using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Stores;

namespace Ordina.Application.Stores;

public class StoreService : IStoreService
{
    private readonly IRepository<Store> _storeRepository;
    private readonly ICacheService _cacheService;
    private readonly ILogger<StoreService> _logger;

    public StoreService(
        IRepository<Store> storeRepository,
        ICacheService cacheService,
        ILogger<StoreService> logger)
    {
        _storeRepository = storeRepository;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<StoreResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cacheService.GetAsync<IReadOnlyList<StoreResponseDto>>(CacheKeys.Stores, cancellationToken);
        if (cached != null) return cached;

        var stores = await _storeRepository.GetAllAsync(cancellationToken);
        var dtos = stores.Select(MapToDto).ToList();
        await _cacheService.SetAsync(CacheKeys.Stores, dtos, absoluteExpiration: CacheTtl.StoresAbsolute, cancellationToken: cancellationToken);
        return dtos;
    }

    public async Task<StoreResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var store = await _storeRepository.GetByIdAsync(id, cancellationToken);
        return store != null ? MapToDto(store) : null;
    }

    public async Task<StoreResponseDto> CreateAsync(CreateStoreDto createDto, CancellationToken cancellationToken = default)
    {
        var store = new Store
        {
            Name = createDto.Name.Trim(),
            Code = createDto.Code.Trim().ToUpperInvariant(),
            Address = createDto.Address.Trim(),
            Phone = createDto.Phone.Trim(),
            Email = createDto.Email.Trim().ToLowerInvariant(),
            Rif = createDto.Rif.Trim(),
            Status = createDto.Status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _storeRepository.AddAsync(store, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Stores, cancellationToken);
        _logger.LogInformation("Tienda creada: {StoreId} ({Code})", created.Id, created.Code);
        return MapToDto(created);
    }

    public async Task<StoreResponseDto> UpdateAsync(string id, UpdateStoreDto updateDto, CancellationToken cancellationToken = default)
    {
        var store = await _storeRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Tienda no encontrada: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Name)) store.Name = updateDto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Code)) store.Code = updateDto.Code.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(updateDto.Address)) store.Address = updateDto.Address.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Phone)) store.Phone = updateDto.Phone.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Email)) store.Email = updateDto.Email.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(updateDto.Rif)) store.Rif = updateDto.Rif.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Status)) store.Status = updateDto.Status;

        store.UpdatedAt = DateTime.UtcNow;
        await _storeRepository.UpdateAsync(store, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Stores, cancellationToken);
        return MapToDto(store);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var deleted = await _storeRepository.DeleteAsync(id, cancellationToken);
        if (deleted) await _cacheService.RemoveAsync(CacheKeys.Stores, cancellationToken);
        return deleted;
    }

    private static StoreResponseDto MapToDto(Store s) => new(
        s.Id,
        s.Name,
        s.Code,
        s.Address,
        s.Phone,
        s.Email,
        s.Rif,
        s.Status,
        s.CreatedAt,
        s.UpdatedAt);
}

public class AccountService : IAccountService
{
    private readonly IRepository<Account> _accountRepository;
    private readonly ICacheService _cacheService;
    private readonly ILogger<AccountService> _logger;

    public AccountService(
        IRepository<Account> accountRepository,
        ICacheService cacheService,
        ILogger<AccountService> logger)
    {
        _accountRepository = accountRepository;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<AccountResponseDto>> GetAllAsync(string? storeId = null, CancellationToken cancellationToken = default)
    {
        var accounts = await _accountRepository.GetAllAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(storeId))
        {
            accounts = accounts.Where(a => a.StoreId == storeId).ToList();
        }
        return accounts.Select(MapToDto).ToList();
    }

    public async Task<AccountResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var account = await _accountRepository.GetByIdAsync(id, cancellationToken);
        return account != null ? MapToDto(account) : null;
    }

    public async Task<AccountResponseDto> CreateAsync(CreateAccountDto createDto, CancellationToken cancellationToken = default)
    {
        var account = new Account
        {
            Code = createDto.Code.Trim(),
            Label = createDto.Label.Trim(),
            StoreId = createDto.StoreId,
            IsForeign = createDto.IsForeign,
            AccountType = createDto.AccountType,
            Email = createDto.Email?.Trim().ToLowerInvariant(),
            Wallet = createDto.Wallet?.Trim(),
            IsActive = createDto.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _accountRepository.AddAsync(account, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Accounts, cancellationToken);
        _logger.LogInformation("Cuenta creada: {AccountId} ({Label})", created.Id, created.Label);
        return MapToDto(created);
    }

    public async Task<AccountResponseDto> UpdateAsync(string id, UpdateAccountDto updateDto, CancellationToken cancellationToken = default)
    {
        var account = await _accountRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Cuenta no encontrada: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Code)) account.Code = updateDto.Code.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Label)) account.Label = updateDto.Label.Trim();
        if (updateDto.StoreId != null) account.StoreId = updateDto.StoreId;
        if (updateDto.IsForeign.HasValue) account.IsForeign = updateDto.IsForeign.Value;
        if (!string.IsNullOrWhiteSpace(updateDto.AccountType)) account.AccountType = updateDto.AccountType;
        if (updateDto.Email != null) account.Email = updateDto.Email.Trim().ToLowerInvariant();
        if (updateDto.Wallet != null) account.Wallet = updateDto.Wallet.Trim();
        if (updateDto.IsActive.HasValue) account.IsActive = updateDto.IsActive.Value;

        account.UpdatedAt = DateTime.UtcNow;
        await _accountRepository.UpdateAsync(account, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Accounts, cancellationToken);
        return MapToDto(account);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var deleted = await _accountRepository.DeleteAsync(id, cancellationToken);
        if (deleted) await _cacheService.RemoveAsync(CacheKeys.Accounts, cancellationToken);
        return deleted;
    }

    private static AccountResponseDto MapToDto(Account a) => new(
        a.Id,
        a.Code,
        a.Label,
        a.StoreId,
        a.IsForeign,
        a.AccountType,
        a.Email,
        a.Wallet,
        a.IsActive,
        a.CreatedAt,
        a.UpdatedAt);
}
