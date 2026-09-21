using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Security;
using Ordina.Domain.Security;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NavigationSettingsController : ControllerBase
{
    private readonly INavigationSettingsService _navigationSettingsService;

    public NavigationSettingsController(INavigationSettingsService navigationSettingsService)
    {
        _navigationSettingsService = navigationSettingsService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NavigationItemSetting>>> Get(CancellationToken cancellationToken)
    {
        var items = await _navigationSettingsService.GetSettingsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPut]
    public async Task<ActionResult<IEnumerable<NavigationItemSetting>>> Update(
        [FromBody] List<NavigationItemSetting> items,
        CancellationToken cancellationToken)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        try
        {
            var updated = await _navigationSettingsService.UpdateSettingsAsync(items, role, cancellationToken);
            return Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
