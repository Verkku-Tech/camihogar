using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.Services;

namespace Ordina.Orders.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class AccessPinController : ControllerBase
{
    private readonly IAccessPinService _accessPinService;
    private readonly ILogger<AccessPinController> _logger;

    public AccessPinController(IAccessPinService accessPinService, ILogger<AccessPinController> logger)
    {
        _accessPinService = accessPinService;
        _logger = logger;
    }

    private static (string UserId, string UserName) GetActor(ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var name = user.FindFirstValue("full_name")
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue(ClaimTypes.Email)
            ?? "unknown";
        return (id, name);
    }

    private static bool IsAdministratorOrSuperAdministrator(ClaimsPrincipal user)
    {
        var role = user.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role)) return false;
        return string.Equals(role, "Super Administrator", StringComparison.Ordinal)
            || string.Equals(role, "Administrator", StringComparison.Ordinal);
    }

    /// <summary>Genera un PIN de 6 dígitos válido por 2 minutos (solo administradores).</summary>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(GenerateAccessPinResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<GenerateAccessPinResponseDto>> Generate()
    {
        if (!IsAdministratorOrSuperAdministrator(User))
            return Forbid();

        try
        {
            var (userId, userName) = GetActor(User);
            var result = await _accessPinService.GenerateAsync(userId, userName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar PIN de acceso");
            return StatusCode(500, new { message = "Error al generar PIN de acceso" });
        }
    }

    /// <summary>Valida un PIN y abre sesión de edición de 30 minutos para un pedido/reserva.</summary>
    [HttpPost("validate")]
    [ProducesResponseType(typeof(ValidateAccessPinResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ValidateAccessPinResponseDto>> Validate([FromBody] ValidateAccessPinRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
            var result = await _accessPinService.ValidateAsync(request.Pin, request.OrderId, userId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al validar PIN");
            return StatusCode(500, new { message = "Error al validar PIN" });
        }
    }

    /// <summary>Consulta si hay sesión activa de edición para un pedido.</summary>
    [HttpGet("session/{orderId}")]
    [ProducesResponseType(typeof(AccessPinSessionResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AccessPinSessionResponseDto>> GetSession(string orderId)
    {
        if (string.IsNullOrWhiteSpace(orderId))
            return BadRequest(new { message = "El ID del pedido es requerido" });

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var session = await _accessPinService.GetSessionAsync(orderId, userId);
        return Ok(session);
    }

    /// <summary>Historial de PINs generados (solo administradores).</summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(AccessPinHistoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AccessPinHistoryResponseDto>> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (!IsAdministratorOrSuperAdministrator(User))
            return Forbid();

        var history = await _accessPinService.GetHistoryAsync(page, pageSize);
        return Ok(history);
    }
}
