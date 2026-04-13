using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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
    private readonly IOrderAuditLogService _auditLogService;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(
        IOrderService orderService,
        IOrderAuditLogService auditLogService,
        ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private static (string UserId, string UserName) GetActor(ClaimsPrincipal user)
    {
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var name = user.FindFirstValue("full_name")
            ?? user.FindFirstValue(ClaimTypes.Name)
            ?? user.FindFirstValue(ClaimTypes.Email)
            ?? "unknown";
        return (id, name);
    }

    /// <summary>JWT incluye claims "permissions" por permiso; Super Administrator puede todo.</summary>
    private static bool UserHasPermission(ClaimsPrincipal user, string permission)
    {
        var role = user.FindFirstValue(ClaimTypes.Role);
        if (string.Equals(role, "Super Administrator", StringComparison.Ordinal))
            return true;
        return user.Claims.Any(c => c.Type == "permissions" && c.Value == permission);
    }

    /// <summary>Solo Super Administrator o Administrator pueden validar ítems de pedido.</summary>
    private static bool IsAdministratorOrSuperAdministrator(ClaimsPrincipal user)
    {
        var role = user.FindFirstValue(ClaimTypes.Role);
        if (string.IsNullOrWhiteSpace(role)) return false;
        return string.Equals(role, "Super Administrator", StringComparison.Ordinal)
            || string.Equals(role, "Administrator", StringComparison.Ordinal);
    }

    /// <summary>
    /// Obtiene pedidos con paginación y filtro de sincronización incremental
    /// </summary>
    /// <param name="page">Número de página (1-indexed, default: 1)</param>
    /// <param name="pageSize">Cantidad de elementos por página (default: 50, max: 100)</param>
    /// <param name="since">Fecha ISO 8601 opcional para obtener solo pedidos modificados desde esa fecha (sincronización incremental)</param>
    /// <returns>Respuesta paginada con los pedidos</returns>
    /// <remarks>
    /// Para sincronización incremental:
    /// 1. Primera llamada: GET /api/Orders (sin parámetro 'since')
    /// 2. Guardar el 'serverTimestamp' de la respuesta
    /// 3. Siguientes llamadas: GET /api/Orders?since={serverTimestamp guardado}
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(PagedOrdersResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedOrdersResponseDto>> GetOrdersPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] DateTime? since = null)
    {
        try
        {
            var result = await _orderService.GetOrdersPagedAsync(page, pageSize, since);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos paginados");
            return StatusCode(500, new { message = "Error interno del servidor al obtener pedidos" });
        }
    }

    /// <summary>
    /// Registro de auditoría de pedidos (paginado, con filtros)
    /// </summary>
    [HttpGet("audit-logs")]
    [Authorize]
    [ProducesResponseType(typeof(PagedAuditLogsResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedAuditLogsResponseDto>> GetOrderAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? userId = null,
        [FromQuery] string? orderNumber = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        try
        {
            var result = await _auditLogService.GetPagedLogsAsync(page, pageSize, userId, orderNumber, action, from, to);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener logs de auditoría de pedidos");
            return StatusCode(500, new { message = "Error interno del servidor al obtener el registro de auditoría" });
        }
    }

    /// <summary>
    /// Obtiene todos los pedidos (sin paginación - usar solo para compatibilidad)
    /// </summary>
    /// <returns>Lista de todos los pedidos</returns>
    [HttpGet("all")]
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
    [Authorize]
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

            var (userId, userName) = GetActor(User);
            var order = await _orderService.CreateOrderAsync(createDto, userId, userName);
            return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Validación al crear pedido");
            return BadRequest(new { message = ex.Message });
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
    [Authorize]
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

            var (userId, userName) = GetActor(User);
            var order = await _orderService.UpdateOrderAsync(id, updateDto, userId, userName);
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
    /// Valida un ítem específico del pedido (cambiando su estado a Fabricándose)
    /// </summary>
    [HttpPatch("{id}/items/{itemId}/validate")]
    [Authorize]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> ValidateOrderItem(string id, string itemId)
    {
        try
        {
            if (!IsAdministratorOrSuperAdministrator(User))
                return Forbid();

            var (userId, userName) = GetActor(User);
            var order = await _orderService.ValidateOrderItemAsync(id, itemId, userId, userName);
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
            _logger.LogError(ex, "Error al validar ítem del pedido con ID {OrderId}", id);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Elimina un pedido
    /// </summary>
    /// <param name="id">ID del pedido a eliminar</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteOrder(string id)
    {
        try
        {
            if (!UserHasPermission(User, "orders.delete"))
                return Forbid();

            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del pedido es requerido" });
            }

            var (userId, userName) = GetActor(User);
            var deleted = await _orderService.DeleteOrderAsync(id, userId, userName);
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
    /// <summary>
    /// Concilia múltiples pagos de manera masiva
    /// </summary>
    /// <param name="requests">Lista de pagos a conciliar</param>
    /// <returns>Verdadero si se actualizaron pagos</returns>
    [HttpPost("payments/conciliate")]
    [Authorize]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> ConciliatePayments([FromBody] List<ConciliatePaymentRequestDto> requests)
    {
        try
        {
            if (requests == null || !requests.Any())
            {
                return BadRequest(new { message = "Se requiere una lista de pagos a conciliar" });
            }

            var (userId, userName) = GetActor(User);
            var result = await _orderService.ConciliatePaymentsAsync(requests, userId, userName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al conciliar pagos masivamente");
            return StatusCode(500, new { message = "Error interno del servidor al conciliar pagos" });
        }
    }
}

