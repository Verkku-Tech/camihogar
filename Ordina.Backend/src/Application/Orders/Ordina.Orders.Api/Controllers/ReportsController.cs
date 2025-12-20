using Microsoft.AspNetCore.Mvc;
using Ordina.Orders.Application.Services;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(
        IReportService reportService,
        ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    /// <summary>
    /// Genera el reporte de fabricación en formato Excel
    /// </summary>
    /// <param name="status">Estado de fabricación: debe_fabricar, fabricando o fabricado</param>
    /// <param name="manufacturerId">ID opcional del fabricante para filtrar</param>
    /// <param name="orderNumber">Número de pedido opcional para filtrar</param>
    /// <param name="startDate">Fecha de inicio opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="endDate">Fecha de fin opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="searchTerm">Término de búsqueda opcional para filtrar por cliente, pedido o producto</param>
    /// <returns>Archivo Excel con el reporte</returns>
    [HttpGet("Manufacturing")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetManufacturingReport(
        [FromQuery] string status = "debe_fabricar",
        [FromQuery] string? manufacturerId = null,
        [FromQuery] string? orderNumber = null,
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? searchTerm = null)
    {
        try
        {
            // Validar estado
            if (string.IsNullOrWhiteSpace(status) || 
                !new[] { "debe_fabricar", "fabricando", "fabricado" }.Contains(status))
            {
                return BadRequest(new { message = "El estado debe ser: debe_fabricar, fabricando o fabricado" });
            }

            // Parsear fechas
            DateTime? parsedStartDate = null;
            DateTime? parsedEndDate = null;

            if (!string.IsNullOrWhiteSpace(startDate))
            {
                if (!DateTime.TryParse(startDate, out var start))
                {
                    return BadRequest(new { message = "Formato de fecha de inicio inválido. Use yyyy-MM-dd" });
                }
                parsedStartDate = start;
            }

            if (!string.IsNullOrWhiteSpace(endDate))
            {
                if (!DateTime.TryParse(endDate, out var end))
                {
                    return BadRequest(new { message = "Formato de fecha de fin inválido. Use yyyy-MM-dd" });
                }
                parsedEndDate = end;
            }

            var stream = await _reportService.GenerateManufacturingReportAsync(
                status, 
                manufacturerId, 
                orderNumber, 
                parsedStartDate, 
                parsedEndDate,
                searchTerm);
            
            var statusName = status switch
            {
                "debe_fabricar" => "PorFabricar",
                "fabricando" => "Fabricando",
                "fabricado" => "Fabricado",
                _ => "Fabricacion"
            };
            
            var fileName = $"Reporte_Fabricacion_{statusName}_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            
            return File(stream, 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                fileName);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de fabricación");
            return StatusCode(500, new { message = "Error interno del servidor al generar el reporte" });
        }
    }

    /// <summary>
    /// Obtiene los datos del reporte de fabricación para vista previa (formato JSON)
    /// </summary>
    /// <param name="status">Estado de fabricación: debe_fabricar, fabricando o fabricado</param>
    /// <param name="manufacturerId">ID opcional del fabricante para filtrar</param>
    /// <param name="orderNumber">Número de pedido opcional para filtrar</param>
    /// <param name="startDate">Fecha de inicio opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="endDate">Fecha de fin opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="searchTerm">Término de búsqueda opcional para filtrar por cliente, pedido o producto</param>
    /// <returns>Lista de datos del reporte en formato JSON</returns>
    [HttpGet("Manufacturing/Preview")]
    [ProducesResponseType(typeof(List<ManufacturingReportRowDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetManufacturingReportPreview(
        [FromQuery] string status = "debe_fabricar",
        [FromQuery] string? manufacturerId = null,
        [FromQuery] string? orderNumber = null,
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? searchTerm = null)
    {
        try
        {
            // Validar estado
            if (string.IsNullOrWhiteSpace(status) || 
                !new[] { "debe_fabricar", "fabricando", "fabricado" }.Contains(status))
            {
                return BadRequest(new { message = "El estado debe ser: debe_fabricar, fabricando o fabricado" });
            }

            // Parsear fechas
            DateTime? parsedStartDate = null;
            DateTime? parsedEndDate = null;

            if (!string.IsNullOrWhiteSpace(startDate))
            {
                if (!DateTime.TryParse(startDate, out var start))
                {
                    return BadRequest(new { message = "Formato de fecha de inicio inválido. Use yyyy-MM-dd" });
                }
                parsedStartDate = start;
            }

            if (!string.IsNullOrWhiteSpace(endDate))
            {
                if (!DateTime.TryParse(endDate, out var end))
                {
                    return BadRequest(new { message = "Formato de fecha de fin inválido. Use yyyy-MM-dd" });
                }
                parsedEndDate = end;
            }

            var reportData = await _reportService.GetManufacturingReportDataAsync(
                status, 
                manufacturerId, 
                orderNumber, 
                parsedStartDate, 
                parsedEndDate,
                searchTerm);
            
            return Ok(reportData);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de fabricación");
            return StatusCode(500, new { message = "Error interno del servidor al obtener los datos del reporte" });
        }
    }

    /// <summary>
    /// Genera el reporte de pagos en formato Excel
    /// </summary>
    /// <param name="startDate">Fecha de inicio opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="endDate">Fecha de fin opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="paymentMethod">Método de pago opcional para filtrar</param>
    /// <param name="accountId">ID de cuenta opcional para filtrar</param>
    /// <returns>Archivo Excel con el reporte</returns>
    [HttpGet("Payments/Excel")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetPaymentsReport(
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? paymentMethod = null,
        [FromQuery] string? accountId = null)
    {
        try
        {
            // Parsear fechas
            DateTime? parsedStartDate = null;
            DateTime? parsedEndDate = null;

            if (!string.IsNullOrWhiteSpace(startDate))
            {
                if (!DateTime.TryParse(startDate, out var start))
                {
                    return BadRequest(new { message = "Formato de fecha de inicio inválido. Use yyyy-MM-dd" });
                }
                parsedStartDate = start;
            }

            if (!string.IsNullOrWhiteSpace(endDate))
            {
                if (!DateTime.TryParse(endDate, out var end))
                {
                    return BadRequest(new { message = "Formato de fecha de fin inválido. Use yyyy-MM-dd" });
                }
                parsedEndDate = end;
            }

            var stream = await _reportService.GeneratePaymentsReportAsync(
                parsedStartDate,
                parsedEndDate,
                paymentMethod,
                accountId);
            
            var fileName = $"Reporte_Pagos_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            
            return File(stream, 
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                fileName);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al generar reporte de pagos");
            return StatusCode(500, new { message = "Error interno del servidor al generar el reporte" });
        }
    }

    /// <summary>
    /// Obtiene los datos del reporte de pagos para vista previa (formato JSON)
    /// </summary>
    /// <param name="startDate">Fecha de inicio opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="endDate">Fecha de fin opcional para filtrar (formato: yyyy-MM-dd)</param>
    /// <param name="paymentMethod">Método de pago opcional para filtrar</param>
    /// <param name="accountId">ID de cuenta opcional para filtrar</param>
    /// <returns>Lista de datos del reporte en formato JSON</returns>
    [HttpGet("Payments/Preview")]
    [ProducesResponseType(typeof(List<PaymentReportRowDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetPaymentsReportPreview(
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        [FromQuery] string? paymentMethod = null,
        [FromQuery] string? accountId = null)
    {
        try
        {
            // Parsear fechas
            DateTime? parsedStartDate = null;
            DateTime? parsedEndDate = null;

            if (!string.IsNullOrWhiteSpace(startDate))
            {
                if (!DateTime.TryParse(startDate, out var start))
                {
                    return BadRequest(new { message = "Formato de fecha de inicio inválido. Use yyyy-MM-dd" });
                }
                parsedStartDate = start;
            }

            if (!string.IsNullOrWhiteSpace(endDate))
            {
                if (!DateTime.TryParse(endDate, out var end))
                {
                    return BadRequest(new { message = "Formato de fecha de fin inválido. Use yyyy-MM-dd" });
                }
                parsedEndDate = end;
            }

            var reportData = await _reportService.GetPaymentsReportDataAsync(
                parsedStartDate,
                parsedEndDate,
                paymentMethod,
                accountId);
            
            return Ok(reportData);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos del reporte de pagos");
            return StatusCode(500, new { message = "Error interno del servidor al obtener los datos del reporte" });
        }
    }
}

