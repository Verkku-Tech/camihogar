using Microsoft.AspNetCore.Mvc;
using Ordina.Providers.Application.DTOs;
using Ordina.Providers.Application.Services;

namespace Ordina.Providers.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProvidersController : ControllerBase
{
    private readonly IProviderService _providerService;
    private readonly ILogger<ProvidersController> _logger;

    public ProvidersController(
        IProviderService providerService,
        ILogger<ProvidersController> logger)
    {
        _providerService = providerService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los proveedores
    /// </summary>
    /// <returns>Lista de proveedores</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ProviderResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProviderResponseDto>>> GetAll()
    {
        try
        {
            var providers = await _providerService.GetAllAsync();
            return Ok(providers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener todos los proveedores");
            return StatusCode(500, new { message = "Error interno del servidor al obtener proveedores" });
        }
    }

    /// <summary>
    /// Obtiene un proveedor por su ID
    /// </summary>
    /// <param name="id">ID del proveedor</param>
    /// <returns>Proveedor encontrado</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ProviderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProviderResponseDto>> GetById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del proveedor es requerido" });
            }

            var provider = await _providerService.GetByIdAsync(id);

            if (provider == null)
            {
                return NotFound(new { message = $"Proveedor con ID {id} no encontrado" });
            }

            return Ok(provider);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor por ID: {Id}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el proveedor" });
        }
    }

    /// <summary>
    /// Obtiene un proveedor por su RIF
    /// </summary>
    /// <param name="rif">RIF del proveedor</param>
    /// <returns>Proveedor encontrado</returns>
    [HttpGet("rif/{rif}")]
    [ProducesResponseType(typeof(ProviderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProviderResponseDto>> GetByRif(string rif)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(rif))
            {
                return BadRequest(new { message = "El RIF es requerido" });
            }

            var provider = await _providerService.GetByRifAsync(rif);

            if (provider == null)
            {
                return NotFound(new { message = $"Proveedor con RIF '{rif}' no encontrado" });
            }

            return Ok(provider);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor por RIF: {Rif}", rif);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el proveedor" });
        }
    }

    /// <summary>
    /// Obtiene un proveedor por su email
    /// </summary>
    /// <param name="email">Email del proveedor</param>
    /// <returns>Proveedor encontrado</returns>
    [HttpGet("email/{email}")]
    [ProducesResponseType(typeof(ProviderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProviderResponseDto>> GetByEmail(string email)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest(new { message = "El email es requerido" });
            }

            var provider = await _providerService.GetByEmailAsync(email);

            if (provider == null)
            {
                return NotFound(new { message = $"Proveedor con email '{email}' no encontrado" });
            }

            return Ok(provider);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener proveedor con email {Email}", email);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el proveedor" });
        }
    }

    /// <summary>
    /// Crea un nuevo proveedor
    /// </summary>
    /// <param name="createDto">Datos del proveedor a crear</param>
    /// <returns>Proveedor creado</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ProviderResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProviderResponseDto>> Create([FromBody] CreateProviderDto createDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var providerDto = await _providerService.CreateAsync(createDto);
            return CreatedAtAction(nameof(GetById), new { id = providerDto.Id }, providerDto);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear proveedor");
            return StatusCode(500, new { message = "Error interno del servidor al crear el proveedor" });
        }
    }

    /// <summary>
    /// Actualiza un proveedor existente
    /// </summary>
    /// <param name="id">ID del proveedor a actualizar</param>
    /// <param name="updateDto">Datos del proveedor a actualizar</param>
    /// <returns>Proveedor actualizado</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ProviderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProviderResponseDto>> Update(string id, [FromBody] UpdateProviderDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del proveedor es requerido" });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var providerDto = await _providerService.UpdateAsync(id, updateDto);
            return Ok(providerDto);
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
            _logger.LogError(ex, "Error al actualizar proveedor con ID: {Id}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar el proveedor" });
        }
    }

    /// <summary>
    /// Elimina un proveedor
    /// </summary>
    /// <param name="id">ID del proveedor a eliminar</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del proveedor es requerido" });
            }

            var deleted = await _providerService.DeleteAsync(id);
            if (!deleted)
            {
                return NotFound(new { message = $"Proveedor con ID {id} no encontrado" });
            }

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar proveedor con ID: {Id}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar el proveedor" });
        }
    }

    /// <summary>
    /// Verifica si un proveedor existe
    /// </summary>
    /// <param name="id">ID del proveedor</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("{id}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> ProviderExists(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del proveedor es requerido" });
            }

            var exists = await _providerService.ProviderExistsAsync(id);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del proveedor con ID {ProviderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el proveedor" });
        }
    }
}
