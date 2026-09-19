using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Application.Orders;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderCoreService _orderService;

    public OrdersController(IOrderCoreService orderService)
    {
        _orderService = orderService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<OrderResponseDto>>> GetPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var request = new PagedRequest(Page: pageNumber, PageSize: pageSize, SearchTerm: searchTerm, SortBy: sortBy, SortDescending: isDescending);
        var result = await _orderService.GetPagedAsync(request, type, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var order = await _orderService.GetByIdAsync(id, cancellationToken);
        if (order == null)
        {
            return NotFound();
        }
        return Ok(order);
    }

    [HttpGet("number/{orderNumber}")]
    public async Task<ActionResult<OrderResponseDto>> GetByOrderNumber(string orderNumber, CancellationToken cancellationToken)
    {
        var order = await _orderService.GetByOrderNumberAsync(orderNumber, cancellationToken);
        if (order == null)
        {
            return NotFound();
        }
        return Ok(order);
    }

    [HttpPost]
    public async Task<ActionResult<OrderResponseDto>> Create([FromBody] CreateOrderDto dto, CancellationToken cancellationToken)
    {
        var created = await _orderService.CreateOrderAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<OrderResponseDto>> Update(
        string id,
        [FromBody] UpdateOrderDto dto,
        [FromHeader(Name = "If-Match")] string? ifMatch = null,
        [FromQuery] DateTime? expectedUpdatedAt = null,
        CancellationToken cancellationToken = default)
    {
        DateTime? parsedExpectedUpdatedAt = expectedUpdatedAt;

        if (parsedExpectedUpdatedAt == null && !string.IsNullOrWhiteSpace(ifMatch))
        {
            var cleanMatch = ifMatch.Trim('\"');
            if (DateTime.TryParse(cleanMatch, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var dt))
            {
                parsedExpectedUpdatedAt = dt;
            }
        }

        var updated = await _orderService.UpdateOrderAsync(id, dto, parsedExpectedUpdatedAt, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("convert-budget")]
    public async Task<ActionResult<OrderResponseDto>> ConvertBudget([FromBody] ConvertBudgetDto dto, CancellationToken cancellationToken)
    {
        var order = await _orderService.ConvertBudgetToOrderAsync(dto, cancellationToken);
        return Ok(order);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Cancel(string id, [FromQuery] string reason = "Cancelled by user", CancellationToken cancellationToken = default)
    {
        var result = await _orderService.CancelOrderAsync(id, reason, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }
}
