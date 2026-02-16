using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Users.Application.DTOs;
using Ordina.Users.Application.Services;

namespace Ordina.Users.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Produces("application/json")]
    [Authorize]
    public class ClientsController : ControllerBase
    {
        private readonly IClientService _clientService;
        private readonly ILogger<ClientsController> _logger;

        public ClientsController(
            IClientService clientService,
            ILogger<ClientsController> logger)
        {
            _clientService = clientService;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los clientes paginados y filtrados.
        /// </summary>
        /// <param name="page">Número de página (default: 1)</param>
        /// <param name="pageSize">Tamaño de página (default: 10)</param>
        /// <param name="search">Texto para buscar por nombre, rut o apodo</param>
        [HttpGet]
        [ProducesResponseType(typeof(PagedResult<ClientResponseDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<PagedResult<ClientResponseDto>>> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
        {
            try
            {
                var result = await _clientService.GetAllAsync(page, pageSize, search);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener todos los clientes");
                return StatusCode(500, new { message = "Error interno del servidor al obtener clientes" });
            }
        }

        /// <summary>
        /// Obtiene un cliente por su ID interno.
        /// </summary>
        /// <param name="id">ID del cliente.</param>
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ClientResponseDto>> GetById(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(new { message = "El ID del cliente es requerido" });
                }

                var client = await _clientService.GetByIdAsync(id);

                if (client == null)
                {
                    return NotFound(new { message = $"Cliente con ID {id} no encontrado" });
                }

                return Ok(client);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener cliente por ID: {Id}", id);
                return StatusCode(500, new { message = "Error interno del servidor al obtener el cliente" });
            }
        }

        /// <summary>
        /// Obtiene un cliente por su RUT.
        /// </summary>
        /// <param name="rutId">RUT del cliente.</param>
        [HttpGet("rut/{rutId}")]
        [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ClientResponseDto>> GetByRutId(string rutId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(rutId))
                {
                    return BadRequest(new { message = "El RutId es requerido" });
                }

                var client = await _clientService.GetByRutIdAsync(rutId);

                if (client == null)
                {
                    return NotFound(new { message = $"Cliente con RutId '{rutId}' no encontrado" });
                }

                return Ok(client);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener cliente por RutId: {RutId}", rutId);
                return StatusCode(500, new { message = "Error interno del servidor al obtener el cliente" });
            }
        }

        /// <summary>
        /// Crea un nuevo cliente.
        /// </summary>
        /// <param name="createDto">Datos del cliente a crear.</param>
        [HttpPost]
        [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<ClientResponseDto>> Create([FromBody] CreateClientDto createDto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var clientDto = await _clientService.CreateAsync(createDto);
                return CreatedAtAction(nameof(GetById), new { id = clientDto.Id }, clientDto);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear cliente");
                return StatusCode(500, new { message = "Error interno del servidor al crear el cliente" });
            }
        }

        /// <summary>
        /// Actualiza un cliente existente.
        /// </summary>
        /// <param name="id">ID del cliente a actualizar.</param>
        /// <param name="updateDto">Datos del cliente a actualizar.</param>
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(ClientResponseDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<ActionResult<ClientResponseDto>> Update(string id, [FromBody] UpdateClientDto updateDto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(new { message = "El ID del cliente es requerido" });
                }

                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var clientDto = await _clientService.UpdateAsync(id, updateDto);
                return Ok(clientDto);
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
                _logger.LogError(ex, "Error al actualizar cliente con ID: {Id}", id);
                return StatusCode(500, new { message = "Error interno del servidor al actualizar el cliente" });
            }
        }

        /// <summary>
        /// Elimina un cliente.
        /// </summary>
        /// <param name="id">ID del cliente a eliminar.</param>
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(new { message = "El ID del cliente es requerido" });
                }

                var deleted = await _clientService.DeleteAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = $"Cliente con ID {id} no encontrado" });
                }

                return NoContent();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar cliente con ID: {Id}", id);
                return StatusCode(500, new { message = "Error interno del servidor al eliminar el cliente" });
            }
        }
    }


}
