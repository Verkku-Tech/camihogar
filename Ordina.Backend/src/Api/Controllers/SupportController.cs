using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Support;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SupportController : ControllerBase
{
    private readonly ISupportService _supportService;

    public SupportController(ISupportService supportService)
    {
        _supportService = supportService;
    }

    [HttpPost("tickets")]
    public async Task<IActionResult> CreateTicket([FromBody] CreateSupportTicketDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { message = "El asunto y la descripción son requeridos." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? "Usuario";
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? "";
        var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
        var storeId = User.FindFirstValue("storeId");
        var storeName = User.FindFirstValue("storeName");

        var userContext = new SupportCurrentUserContext(
            UserId: userId,
            UserName: userName,
            UserEmail: userEmail,
            UserRole: userRole,
            StoreId: storeId,
            StoreName: storeName
        );

        var result = await _supportService.CreateTicketAsync(request, userContext, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
