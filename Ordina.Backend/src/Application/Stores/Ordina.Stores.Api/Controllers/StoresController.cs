using Microsoft.AspNetCore.Mvc;
using Ordina.Stores.Application.DTOs;
using Ordina.Stores.Application.Services;

namespace Ordina.Stores.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class StoresController : ControllerBase
{
    private readonly IStoreService _storeService;
    private readonly ILogger<StoresController> _logger;

    public StoresController(IStoreService storeService, ILogger<StoresController> logger)
    {
        _storeService = storeService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todas las tiendas
    /// </summary>
    /// <param name="status">Filtro opcional por estado (active/inactive)</param>
    /// <returns>Lista de tiendas</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<StoreResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<StoreResponseDto>>> GetAllStores(
        [FromQuery] string? status = null)
    {
        try
        {
            var stores = await _storeService.GetAllStoresAsync(status);
            return Ok(stores);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener tiendas");
            return StatusCode(500, new { message = "Error interno del servidor al obtener tiendas" });
        }
    }

    /// <summary>
    /// Obtiene una tienda por su ID
    /// </summary>
    /// <param name="id">ID de la tienda</param>
    /// <returns>Tienda encontrada</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(StoreResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StoreResponseDto>> GetStoreById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la tienda es requerido" });
            }

            var store = await _storeService.GetStoreByIdAsync(id);

            if (store == null)
            {
                return NotFound(new { message = $"Tienda con ID {id} no encontrada" });
            }

            return Ok(store);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener tienda con ID {StoreId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener la tienda" });
        }
    }

    /// <summary>
    /// Obtiene una tienda por su código
    /// </summary>
    /// <param name="code">Código de la tienda</param>
    /// <returns>Tienda encontrada</returns>
    [HttpGet("by-code/{code}")]
    [ProducesResponseType(typeof(StoreResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StoreResponseDto>> GetStoreByCode(string code)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return BadRequest(new { message = "El código de la tienda es requerido" });
            }

            var store = await _storeService.GetStoreByCodeAsync(code);

            if (store == null)
            {
                return NotFound(new { message = $"Tienda con código {code} no encontrada" });
            }

            return Ok(store);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener tienda con código {StoreCode}", code);
            return StatusCode(500, new { message = "Error interno del servidor al obtener la tienda" });
        }
    }

    /// <summary>
    /// Crea una nueva tienda
    /// </summary>
    /// <param name="dto">Datos de la tienda a crear</param>
    /// <returns>Tienda creada</returns>
    [HttpPost]
    [ProducesResponseType(typeof(StoreResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StoreResponseDto>> CreateStore(CreateStoreDto dto)
    {
        try
        {
            var store = await _storeService.CreateStoreAsync(dto);
            return CreatedAtAction(nameof(GetStoreById), new { id = store.Id }, store);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear tienda");
            return StatusCode(500, new { message = "Error interno del servidor al crear la tienda" });
        }
    }

    /// <summary>
    /// Actualiza una tienda existente
    /// </summary>
    /// <param name="id">ID de la tienda</param>
    /// <param name="dto">Datos a actualizar</param>
    /// <returns>Tienda actualizada</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(StoreResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StoreResponseDto>> UpdateStore(string id, UpdateStoreDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la tienda es requerido" });
            }

            var store = await _storeService.UpdateStoreAsync(id, dto);
            return Ok(store);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"Tienda con ID {id} no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar tienda con ID {StoreId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar la tienda" });
        }
    }

    /// <summary>
    /// Elimina una tienda
    /// </summary>
    /// <param name="id">ID de la tienda</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteStore(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID de la tienda es requerido" });
            }

            await _storeService.DeleteStoreAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = $"Tienda con ID {id} no encontrada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar tienda con ID {StoreId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar la tienda" });
        }
    }
}