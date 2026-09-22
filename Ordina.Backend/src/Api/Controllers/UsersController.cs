using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Application.Users;
using Ordina.Domain.Users;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController(IUserService userService, IRoleService roleService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserResponseDto>>> GetUsers(
        [FromQuery] int? page = null,
        [FromQuery] int? pageNumber = null,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var curPage = page ?? pageNumber ?? 1;
        var querySearch = !string.IsNullOrWhiteSpace(search) ? search : searchTerm;
        var request = new PagedRequest(Page: Math.Max(1, curPage), PageSize: Math.Clamp(pageSize, 1, 1000), SearchTerm: querySearch, SortBy: sortBy, SortDescending: isDescending);
        var result = await userService.GetPagedUsersAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<UserResponseDto>>> GetAll(
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var users = await userService.GetAllUsersAsync(status, cancellationToken);
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var user = await userService.GetUserByIdAsync(id, cancellationToken);
        if (user == null)
        {
            return NotFound();
        }
        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserResponseDto>> Create([FromBody] CreateUserDto dto, CancellationToken cancellationToken)
    {
        var created = await userService.CreateUserAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserResponseDto>> Update(string id, [FromBody] UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var updated = await userService.UpdateUserAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var result = await userService.DeleteUserAsync(id, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("{id}/regenerate-password")]
    public async Task<ActionResult<RegeneratePasswordResponseDto>> RegeneratePassword(string id, CancellationToken cancellationToken)
    {
        var result = await userService.RegeneratePasswordAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpGet("permissions")]
    public ActionResult<IReadOnlyList<AssignableUserPermissions.AssignablePermission>> GetAssignablePermissions()
    {
        var permissions = userService.GetAssignablePermissions();
        return Ok(permissions);
    }

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyList<RoleResponseDto>>> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await roleService.GetAllRolesAsync(cancellationToken);
        return Ok(roles);
    }

    [HttpGet("roles/{id}")]
    public async Task<ActionResult<RoleResponseDto>> GetRoleById(string id, CancellationToken cancellationToken)
    {
        var role = await roleService.GetRoleByIdAsync(id, cancellationToken);
        if (role == null)
        {
            return NotFound();
        }
        return Ok(role);
    }

    [HttpPost("roles")]
    public async Task<ActionResult<RoleResponseDto>> CreateRole([FromBody] CreateRoleDto dto, CancellationToken cancellationToken)
    {
        var created = await roleService.CreateRoleAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetRoleById), new { id = created.Id }, created);
    }

    [HttpPut("roles/{id}")]
    public async Task<ActionResult<RoleResponseDto>> UpdateRole(string id, [FromBody] UpdateRoleDto dto, CancellationToken cancellationToken)
    {
        var updated = await roleService.UpdateRoleAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteRole(string id, CancellationToken cancellationToken)
    {
        var result = await roleService.DeleteRoleAsync(id, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }
}
