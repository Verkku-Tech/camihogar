using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Application.Users;
using Ordina.Domain.Users;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IRoleService _roleService;

    public UsersController(IUserService userService, IRoleService roleService)
    {
        _userService = userService;
        _roleService = roleService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<UserResponseDto>>> GetUsers(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var request = new PagedRequest(Page: pageNumber, PageSize: pageSize, SearchTerm: searchTerm, SortBy: sortBy, SortDescending: isDescending);
        var result = await _userService.GetPagedUsersAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var user = await _userService.GetUserByIdAsync(id, cancellationToken);
        if (user == null)
        {
            return NotFound();
        }
        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserResponseDto>> Create([FromBody] CreateUserDto dto, CancellationToken cancellationToken)
    {
        var created = await _userService.CreateUserAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserResponseDto>> Update(string id, [FromBody] UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var updated = await _userService.UpdateUserAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await _userService.DeleteUserAsync(id, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("{id}/regenerate-password")]
    public async Task<ActionResult<RegeneratePasswordResponseDto>> RegeneratePassword(string id, CancellationToken cancellationToken)
    {
        var result = await _userService.RegeneratePasswordAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpGet("permissions")]
    public ActionResult<IReadOnlyList<AssignableUserPermissions.AssignablePermission>> GetAssignablePermissions()
    {
        var permissions = _userService.GetAssignablePermissions();
        return Ok(permissions);
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleResponseDto>>> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await _roleService.GetAllRolesAsync(cancellationToken);
        return Ok(roles);
    }

    [HttpGet("roles/{id}")]
    public async Task<ActionResult<RoleResponseDto>> GetRoleById(string id, CancellationToken cancellationToken)
    {
        var role = await _roleService.GetRoleByIdAsync(id, cancellationToken);
        if (role == null)
        {
            return NotFound();
        }
        return Ok(role);
    }

    [HttpPost("roles")]
    public async Task<ActionResult<RoleResponseDto>> CreateRole([FromBody] CreateRoleDto dto, CancellationToken cancellationToken)
    {
        var created = await _roleService.CreateRoleAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetRoleById), new { id = created.Id }, created);
    }

    [HttpPut("roles/{id}")]
    public async Task<ActionResult<RoleResponseDto>> UpdateRole(string id, [FromBody] UpdateRoleDto dto, CancellationToken cancellationToken)
    {
        var updated = await _roleService.UpdateRoleAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteRole(string id, CancellationToken cancellationToken)
    {
        var result = await _roleService.DeleteRoleAsync(id, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }
}
