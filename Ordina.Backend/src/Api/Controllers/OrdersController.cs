using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using Ordina.Application.Common;
using Ordina.Application.Orders;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController(
    IOrderCoreService orderService,
    IOrderAuditLogService auditLogService) : ControllerBase
{
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
        [FromQuery] bool includeImages = false,
        [FromQuery] bool? getImage = null,
        CancellationToken cancellationToken = default)
    {
        var currentPage = page ?? pageNumber ?? 1;
        var querySearch = !string.IsNullOrWhiteSpace(search) ? search : searchTerm;
        var request = new PagedRequest(Page: Math.Max(1, currentPage), PageSize: Math.Clamp(pageSize, 1, 200), SearchTerm: querySearch, SortBy: sortBy, SortDescending: isDescending);
        var finalIncludeImages = getImage ?? includeImages;
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
            IncludeBudgets: includeBudgets,
            IncludeImages: finalIncludeImages);
        var result = await orderService.GetPagedAsync(request, filter, cancellationToken);
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

    [HttpGet("audit-logs")]
    [ProducesResponseType(typeof(PagedAuditLogsResponseDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedAuditLogsResponseDto>> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? userId = null,
        [FromQuery] string? orderNumber = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] bool sortAscending = false,
        CancellationToken cancellationToken = default)
    {
        var result = await auditLogService.GetPagedLogsAsync(
            page, pageSize, userId, orderNumber, action, from, to, sortAscending, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrderResponseDto>> GetById(
        string id,
        CancellationToken cancellationToken = default,
        [FromQuery] bool includeImages = true,
        [FromQuery] bool? getImage = null)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length != 24 || !ObjectId.TryParse(id, out _))
        {
            return NotFound();
        }

        var finalIncludeImages = getImage ?? includeImages;
        var order = finalIncludeImages
            ? await orderService.GetByIdAsync(id, cancellationToken)
            : await orderService.GetByIdAsync(id, false, cancellationToken);
        if (order == null)
        {
            return NotFound();
        }
        return Ok(order);
    }

    [HttpGet("number/{orderNumber}")]
    public async Task<ActionResult<OrderResponseDto>> GetByOrderNumber(
        string orderNumber,
        CancellationToken cancellationToken = default,
        [FromQuery] bool includeImages = true,
        [FromQuery] bool? getImage = null)
    {
        var finalIncludeImages = getImage ?? includeImages;
        var order = finalIncludeImages
            ? await orderService.GetByOrderNumberAsync(orderNumber, cancellationToken)
            : await orderService.GetByOrderNumberAsync(orderNumber, false, cancellationToken);
        if (order == null)
        {
            return NotFound();
        }
        return Ok(order);
    }

    [HttpPost]
    public async Task<ActionResult<OrderResponseDto>> Create([FromBody] CreateOrderDto dto, CancellationToken cancellationToken)
    {
        var created = await orderService.CreateOrderAsync(dto, cancellationToken);
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

        var updated = await orderService.UpdateOrderAsync(id, dto, parsedExpectedUpdatedAt, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("convert-budget")]
    public async Task<ActionResult<OrderResponseDto>> ConvertBudget([FromBody] ConvertBudgetDto dto, CancellationToken cancellationToken)
    {
        var order = await orderService.ConvertBudgetToOrderAsync(dto, cancellationToken);
        return Ok(order);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Cancel(string id, [FromQuery] string reason = "Cancelled by user", CancellationToken cancellationToken = default)
    {
        var result = await orderService.CancelOrderAsync(id, reason, cancellationToken);
        if (!result)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("payments/conciliate")]
    public async Task<ActionResult<bool>> ConciliatePayments(
        [FromBody] List<ConciliatePaymentRequestDto> requests,
        CancellationToken cancellationToken)
    {
        var result = await orderService.ConciliatePaymentsAsync(requests, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id}/decline")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> Decline(
        string id,
        [FromBody] DeclineOrderRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system";
            var userName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Usuario";
            var order = await orderService.DeclineOrderAsync(id, userId, userName, request?.GetReason(), cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/reactivate")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponseDto>> Reactivate(
        string id,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "system";
            var userName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Usuario";
            var order = await orderService.ReactivateOrderAsync(id, userId, userName, cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
