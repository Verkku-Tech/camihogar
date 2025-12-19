using Microsoft.AspNetCore.Mvc;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.Services;

namespace Ordina.Orders.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IOrderService orderService, ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los pedidos
    /// </summary>
    /// <returns>Lista de pedidos</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OrderResponseDto>>> GetAllOrders()
    {
        try
        {
            var orders = await _orderService.GetAllOrdersAsync();
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos");
            return StatusCode(500, new { message = "Error interno del servidor al obtener pedidos" });
        }
    }

    /// <summary>
    /// Obtiene un pedido por su ID
    /// </summary>
    /// <param name="id">ID del pedido</param>
    /// <returns>Pedido encontrado</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> GetOrderById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del pedido es requerido" });
            }

            var order = await _orderService.GetOrderByIdAsync(id);
            if (order == null)
            {
                return NotFound(new { message = $"Pedido con ID {id} no encontrado" });
            }

            return Ok(order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedido con ID {OrderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el pedido" });
        }
    }

    /// <summary>
    /// Obtiene un pedido por su número de pedido
    /// </summary>
    /// <param name="orderNumber">Número del pedido (ej: ORD-001)</param>
    /// <returns>Pedido encontrado</returns>
    [HttpGet("number/{orderNumber}")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> GetOrderByNumber(string orderNumber)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(orderNumber))
            {
                return BadRequest(new { message = "El número de pedido es requerido" });
            }

            var order = await _orderService.GetOrderByOrderNumberAsync(orderNumber);
            if (order == null)
            {
                return NotFound(new { message = $"Pedido {orderNumber} no encontrado" });
            }

            return Ok(order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedido con número {OrderNumber}", orderNumber);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el pedido" });
        }
    }

    /// <summary>
    /// Obtiene pedidos por ID de cliente
    /// </summary>
    /// <param name="clientId">ID del cliente</param>
    /// <returns>Lista de pedidos del cliente</returns>
    [HttpGet("client/{clientId}")]
    [ProducesResponseType(typeof(IEnumerable<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OrderResponseDto>>> GetOrdersByClient(string clientId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                return BadRequest(new { message = "El ID del cliente es requerido" });
            }

            var orders = await _orderService.GetOrdersByClientIdAsync(clientId);
            return Ok(orders);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por cliente {ClientId}", clientId);
            return StatusCode(500, new { message = "Error interno del servidor al obtener los pedidos" });
        }
    }

    /// <summary>
    /// Obtiene pedidos por estado
    /// </summary>
    /// <param name="status">Estado del pedido</param>
    /// <returns>Lista de pedidos con el estado</returns>
    [HttpGet("status/{status}")]
    [ProducesResponseType(typeof(IEnumerable<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OrderResponseDto>>> GetOrdersByStatus(string status)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return BadRequest(new { message = "El estado es requerido" });
            }

            var orders = await _orderService.GetOrdersByStatusAsync(status);
            return Ok(orders);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por estado {Status}", status);
            return StatusCode(500, new { message = "Error interno del servidor al obtener los pedidos" });
        }
    }

    /// <summary>
    /// Crea un nuevo pedido
    /// </summary>
    /// <param name="createDto">Datos del pedido a crear</param>
    /// <returns>Pedido creado</returns>
    [HttpPost]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrderResponseDto>> CreateOrder([FromBody] CreateOrderDto createDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var order = await _orderService.CreateOrderAsync(createDto);
            return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido");
            return StatusCode(500, new { message = "Error interno del servidor al crear el pedido" });
        }
    }

    /// <summary>
    /// Actualiza un pedido existente
    /// </summary>
    /// <param name="id">ID del pedido a actualizar</param>
    /// <param name="updateDto">Datos del pedido a actualizar</param>
    /// <returns>Pedido actualizado</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> UpdateOrder(string id, [FromBody] UpdateOrderDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del pedido es requerido" });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var order = await _orderService.UpdateOrderAsync(id, updateDto);
            return Ok(order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar pedido con ID {OrderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar el pedido" });
        }
    }

    /// <summary>
    /// Elimina un pedido
    /// </summary>
    /// <param name="id">ID del pedido a eliminar</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteOrder(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del pedido es requerido" });
            }

            var deleted = await _orderService.DeleteOrderAsync(id);
            if (!deleted)
            {
                return NotFound(new { message = $"Pedido con ID {id} no encontrado" });
            }

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar pedido con ID {OrderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar el pedido" });
        }
    }

    /// <summary>
    /// Verifica si un pedido existe
    /// </summary>
    /// <param name="id">ID del pedido</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("{id}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> OrderExists(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del pedido es requerido" });
            }

            var exists = await _orderService.OrderExistsAsync(id);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del pedido con ID {OrderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el pedido" });
        }
    }

    /// <summary>
    /// Verifica si un número de pedido existe
    /// </summary>
    /// <param name="orderNumber">Número del pedido</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("number/{orderNumber}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> OrderNumberExists(string orderNumber)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(orderNumber))
            {
                return BadRequest(new { message = "El número de pedido es requerido" });
            }

            var exists = await _orderService.OrderNumberExistsAsync(orderNumber);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del número de pedido {OrderNumber}", orderNumber);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el número de pedido" });
        }
    }
}

