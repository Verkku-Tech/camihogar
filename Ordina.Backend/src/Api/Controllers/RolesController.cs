using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Users;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly IUserService _userService;

    public RolesController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("permissions")]
    public ActionResult<IReadOnlyList<string>> GetPermissions()
    {
        return Ok(Ordina.Domain.Users.Permissions.GetAll());
    }
}
