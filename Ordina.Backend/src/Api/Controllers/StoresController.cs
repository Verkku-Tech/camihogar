using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Stores;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StoresController : ControllerBase
{
    private readonly IStoreService _storeService;
    private readonly IAccountService _accountService;

    public StoresController(IStoreService storeService, IAccountService accountService)
    {
        _storeService = storeService;
        _accountService = accountService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var stores = await _storeService.GetAllAsync(cancellationToken);
        return Ok(stores);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StoreResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var store = await _storeService.GetByIdAsync(id, cancellationToken);
        if (store == null)
        {
            return NotFound();
        }
        return Ok(store);
    }

    [HttpPost]
    public async Task<ActionResult<StoreResponseDto>> Create([FromBody] CreateStoreDto dto, CancellationToken cancellationToken)
    {
        var created = await _storeService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StoreResponseDto>> Update(string id, [FromBody] UpdateStoreDto dto, CancellationToken cancellationToken)
    {
        var updated = await _storeService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await _storeService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpGet("{storeId}/accounts")]
    public async Task<ActionResult<IReadOnlyList<AccountResponseDto>>> GetAccountsByStore(string storeId, CancellationToken cancellationToken)
    {
        var accounts = await _accountService.GetAllAsync(storeId, cancellationToken);
        return Ok(accounts);
    }

    [HttpGet("accounts")]
    public async Task<ActionResult<IReadOnlyList<AccountResponseDto>>> GetAllAccounts(CancellationToken cancellationToken)
    {
        var accounts = await _accountService.GetAllAsync(null, cancellationToken);
        return Ok(accounts);
    }

    [HttpPost("accounts")]
    public async Task<ActionResult<AccountResponseDto>> CreateAccount([FromBody] CreateAccountDto dto, CancellationToken cancellationToken)
    {
        var created = await _accountService.CreateAsync(dto, cancellationToken);
        return Ok(created);
    }

    [HttpPut("accounts/{id}")]
    public async Task<ActionResult<AccountResponseDto>> UpdateAccount(string id, [FromBody] UpdateAccountDto dto, CancellationToken cancellationToken)
    {
        var updated = await _accountService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("accounts/{id}")]
    public async Task<IActionResult> DeleteAccount(string id, CancellationToken cancellationToken)
    {
        var deleted = await _accountService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}
