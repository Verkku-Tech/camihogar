using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Stores;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StoresController(IStoreService storeService, IAccountService accountService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var stores = await storeService.GetAllAsync(cancellationToken);
        return Ok(stores);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StoreResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var store = await storeService.GetByIdAsync(id, cancellationToken);
        if (store == null)
        {
            return NotFound();
        }
        return Ok(store);
    }

    [HttpPost]
    public async Task<ActionResult<StoreResponseDto>> Create([FromBody] CreateStoreDto dto, CancellationToken cancellationToken)
    {
        var created = await storeService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StoreResponseDto>> Update(string id, [FromBody] UpdateStoreDto dto, CancellationToken cancellationToken)
    {
        var updated = await storeService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await storeService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpGet("{storeId}/accounts")]
    public async Task<ActionResult<IReadOnlyList<AccountResponseDto>>> GetAccountsByStore(string storeId, CancellationToken cancellationToken)
    {
        var accounts = await accountService.GetAllAsync(storeId, cancellationToken);
        return Ok(accounts);
    }

    [HttpGet("accounts")]
    public async Task<ActionResult<IReadOnlyList<AccountResponseDto>>> GetAllAccounts(CancellationToken cancellationToken)
    {
        var accounts = await accountService.GetAllAsync(null, cancellationToken);
        return Ok(accounts);
    }

    [HttpPost("accounts")]
    public async Task<ActionResult<AccountResponseDto>> CreateAccount([FromBody] CreateAccountDto dto, CancellationToken cancellationToken)
    {
        var created = await accountService.CreateAsync(dto, cancellationToken);
        return Ok(created);
    }

    [HttpPut("accounts/{id}")]
    public async Task<ActionResult<AccountResponseDto>> UpdateAccount(string id, [FromBody] UpdateAccountDto dto, CancellationToken cancellationToken)
    {
        var updated = await accountService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("accounts/{id}")]
    public async Task<IActionResult> DeleteAccount(string id, CancellationToken cancellationToken)
    {
        var deleted = await accountService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}
