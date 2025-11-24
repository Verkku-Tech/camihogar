using Microsoft.AspNetCore.Mvc;
using Ordina.Users.Application.DTOs;
using Ordina.Users.Application.Services;

namespace Ordina.Users.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los usuarios
    /// </summary>
    /// <param name="status">Filtro opcional por estado (active/inactive)</param>
    /// <returns>Lista de usuarios</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<UserResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserResponseDto>>> GetAllUsers([FromQuery] string? status = null)
    {
        try
        {
            var users = await _userService.GetAllUsersAsync(status);
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuarios");
            return StatusCode(500, new { message = "Error interno del servidor al obtener usuarios" });
        }
    }

    /// <summary>
    /// Obtiene un usuario por su ID
    /// </summary>
    /// <param name="id">ID del usuario</param>
    /// <returns>Usuario encontrado</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UserResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponseDto>> GetUserById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del usuario es requerido" });
            }

            var user = await _userService.GetUserByIdAsync(id);

            if (user == null)
            {
                return NotFound(new { message = $"Usuario con ID {id} no encontrado" });
            }

            return Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con ID {UserId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el usuario" });
        }
    }

    /// <summary>
    /// Obtiene un usuario por su nombre de usuario
    /// </summary>
    /// <param name="username">Nombre de usuario</param>
    /// <returns>Usuario encontrado</returns>
    [HttpGet("username/{username}")]
    [ProducesResponseType(typeof(UserResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponseDto>> GetUserByUsername(string username)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return BadRequest(new { message = "El nombre de usuario es requerido" });
            }

            var user = await _userService.GetUserByUsernameAsync(username);

            if (user == null)
            {
                return NotFound(new { message = $"Usuario con nombre de usuario '{username}' no encontrado" });
            }

            return Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con username {Username}", username);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el usuario" });
        }
    }

    /// <summary>
    /// Obtiene un usuario por su email
    /// </summary>
    /// <param name="email">Email del usuario</param>
    /// <returns>Usuario encontrado</returns>
    [HttpGet("email/{email}")]
    [ProducesResponseType(typeof(UserResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserResponseDto>> GetUserByEmail(string email)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "El email es requerido" });
            }

            var user = await _userService.GetUserByEmailAsync(email);

            if (user == null)
            {
                return NotFound(new { message = $"Usuario con email '{email}' no encontrado" });
            }

            return Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener usuario con email {Email}", email);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el usuario" });
        }
    }

    /// <summary>
    /// Crea un nuevo usuario
    /// </summary>
    /// <param name="createDto">Datos del usuario a crear</param>
    /// <returns>Usuario creado</returns>
    [HttpPost]
    [ProducesResponseType(typeof(UserResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponseDto>> CreateUser([FromBody] CreateUserDto createDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userDto = await _userService.CreateUserAsync(createDto);
            return CreatedAtAction(nameof(GetUserById), new { id = userDto.Id }, userDto);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear usuario");
            return StatusCode(500, new { message = "Error interno del servidor al crear el usuario" });
        }
    }

    /// <summary>
    /// Actualiza un usuario existente
    /// </summary>
    /// <param name="id">ID del usuario a actualizar</param>
    /// <param name="updateDto">Datos del usuario a actualizar</param>
    /// <returns>Usuario actualizado</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(UserResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponseDto>> UpdateUser(string id, [FromBody] UpdateUserDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del usuario es requerido" });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userDto = await _userService.UpdateUserAsync(id, updateDto);
            return Ok(userDto);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar usuario con ID {UserId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar el usuario" });
        }
    }

    /// <summary>
    /// Elimina un usuario
    /// </summary>
    /// <param name="id">ID del usuario a eliminar</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del usuario es requerido" });
            }

            var deleted = await _userService.DeleteUserAsync(id);
            if (!deleted)
            {
                return NotFound(new { message = $"Usuario con ID {id} no encontrado" });
            }

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar usuario con ID {UserId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar el usuario" });
        }
    }

    /// <summary>
    /// Verifica si un usuario existe
    /// </summary>
    /// <param name="id">ID del usuario</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("{id}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> UserExists(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del usuario es requerido" });
            }

            var exists = await _userService.UserExistsAsync(id);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del usuario con ID {UserId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el usuario" });
        }
    }
}

