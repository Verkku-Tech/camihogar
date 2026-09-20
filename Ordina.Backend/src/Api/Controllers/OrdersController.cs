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
    public async Task<ActionResult<object>> GetPaged(
        [FromQuery] int? page = null,
        [FromQuery] int? pageNumber = null,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        [FromQuery] string? saleType = null,
        [FromQuery] string? excludeStatuses = null,
        [FromQuery] string? productFilterPreset = null,
        [FromQuery] string? locationStatus = null,
        [FromQuery] string? manufacturingStatus = null,
        [FromQuery] string? vendor = null,
        [FromQuery] string? clientSearch = null,
        [FromQuery] string? clientId = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] bool? includeBudgets = null,
        CancellationToken cancellationToken = default)
    {
        var currentPage = page ?? pageNumber ?? 1;
        var querySearch = !string.IsNullOrWhiteSpace(search) ? search : searchTerm;
        var request = new PagedRequest(Page: Math.Max(1, currentPage), PageSize: Math.Clamp(pageSize, 1, 200), SearchTerm: querySearch, SortBy: sortBy, SortDescending: isDescending);
        var filter = new OrderQueryFilter(
            Type: type,
            Status: status,
            SaleType: saleType,
            ExcludeStatuses: excludeStatuses,
            ProductFilterPreset: productFilterPreset,
            LocationStatus: locationStatus,
            ManufacturingStatus: manufacturingStatus,
            Vendor: vendor,
            ClientSearch: clientSearch,
            ClientId: clientId,
            DateFrom: dateFrom,
            DateTo: dateTo,
            IncludeBudgets: includeBudgets);
        var result = await _orderService.GetPagedAsync(request, filter, cancellationToken);
        var totalPages = result.PageSize > 0 ? (int)Math.Ceiling((double)result.TotalCount / result.PageSize) : 1;

        return Ok(new
        {
            orders = result.Items,
            items = result.Items,
            totalCount = result.TotalCount,
            page = result.Page,
            pageSize = result.PageSize,
            totalPages,
            hasNextPage = result.Page < totalPages,
            hasPreviousPage = result.Page > 1
        });
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
