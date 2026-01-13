using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using Ordina.Providers.Application.DTOs;
using Ordina.Providers.Application.Services;

namespace Ordina.Providers.Api.Controllers
{
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

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var providers = await _providerService.GetAllAsync();
                return Ok(providers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener todos los proveedores");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(ObjectId id)
        {
            try
            {
                if (id == ObjectId.Empty)
                {
                    return BadRequest("El ID del proveedor es requerido");
                }

                var provider = await _providerService.GetByIdAsync(id);
                if (provider == null)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                return Ok(provider);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener proveedor por ID: {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpGet("rif/{rif}")]
        public async Task<IActionResult> GetByRif(string rif)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(rif))
                {
                    return BadRequest("RIF es requerido");
                }

                var provider = await _providerService.GetByRifAsync(rif);
                if (provider == null)
                {
                    return NotFound($"Proveedor con RIF {rif} no encontrado");
                }

                return Ok(provider);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener proveedor por RIF: {Rif}", rif);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateProviderDto createProviderDto)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var createdProvider = await _providerService.CreateAsync(createProviderDto);
                return CreatedAtAction(
                    nameof(GetById),
                    new { id = createdProvider.Id },
                    createdProvider
                );
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear proveedor");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(ObjectId id, [FromBody] UpdateProviderDto updateProviderDto)
        {
            try
            {
                if (id == ObjectId.Empty)
                {
                    return BadRequest("El ID del proveedor es requerido");
                }

                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var updatedProvider = await _providerService.UpdateAsync(id, updateProviderDto);
                if (updatedProvider == null)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                return Ok(updatedProvider);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar proveedor con ID: {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(ObjectId id)
        {
            try
            {
                if (id == ObjectId.Empty)
                {
                    return BadRequest("El ID del proveedor es requerido");
                }

                var deleted = await _providerService.DeleteAsync(id);
                if (!deleted)
                {
                    return NotFound($"Proveedor con ID {id} no encontrado");
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar proveedor con ID: {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }
    }
}