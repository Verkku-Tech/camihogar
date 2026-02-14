using Microsoft.AspNetCore.Mvc;
using Ordina.Stores.Application.DTOs;
using Ordina.Stores.Application.Services;

namespace Ordina.Stores.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AccountsController : ControllerBase
{
    private readonly IAccountService _accountService;
    private readonly ILogger<AccountsController> _logger;

    public AccountsController(IAccountService accountService, ILogger<AccountsController> logger)
    {
        _accountService = accountService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todas las cuentas bancarias
    /// </summary>
    /// <param name="storeId">Filtro opcional por tienda</param>
    /// <param name="isActive">Filtro opcional por estado activo</param>
    /// <returns>Lista de cuentas</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<AccountResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<AccountResponseDto>>> GetAllAccounts(
        [FromQuery] string? storeId = null,
        [FromQuery] bool? isActive = null)
    {
        try
        {
            var accounts = await _accountService.GetAllAccountsAsync(storeId, isActive);
            return Ok(accounts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener cuentas bancarias");
            return StatusCode(500, new { message = "Error interno del servidor al obtener cuentas" });
        }
    }

    /// <summary>
    /// Obtiene una cuenta por su ID
    /// </summary>
    /// <param name="id">ID de la cuenta</param>
    /// <returns>Cuenta encontrada</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AccountResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountResponseDto>> GetAccountById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la cuenta es requerido" });
            }

            var account = await _accountService.GetAccountByIdAsync(id);

            if (account == null)
            {
                return NotFound(new { message = $"Cuenta con ID {id} no encontrada" });
            }

            return Ok(account);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener cuenta con ID {AccountId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener la cuenta" });
        }
    }

    /// <summary>
    /// Crea una nueva cuenta bancaria
    /// </summary>
    /// <param name="dto">Datos de la cuenta a crear</param>
    /// <returns>Cuenta creada</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AccountResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AccountResponseDto>> CreateAccount(CreateAccountDto dto)
    {
        try
        {
            var account = await _accountService.CreateAccountAsync(dto);
            return CreatedAtAction(nameof(GetAccountById), new { id = account.Id }, account);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear cuenta bancaria");
            return StatusCode(500, new { message = "Error interno del servidor al crear la cuenta" });
        }
    }

    /// <summary>
    /// Actualiza una cuenta bancaria existente
    /// </summary>
    /// <param name="id">ID de la cuenta</param>
    /// <param name="dto">Datos a actualizar</param>
    /// <returns>Cuenta actualizada</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(AccountResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountResponseDto>> UpdateAccount(string id, UpdateAccountDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la cuenta es requerido" });
            }

            var account = await _accountService.UpdateAccountAsync(id, dto);
            return Ok(account);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"Cuenta con ID {id} no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar cuenta con ID {AccountId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar la cuenta" });
        }
    }

    /// <summary>
    /// Elimina una cuenta bancaria
    /// </summary>
    /// <param name="id">ID de la cuenta</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAccount(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la cuenta es requerido" });
            }

            await _accountService.DeleteAccountAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"Cuenta con ID {id} no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar cuenta con ID {AccountId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar la cuenta" });
        }
    }
}