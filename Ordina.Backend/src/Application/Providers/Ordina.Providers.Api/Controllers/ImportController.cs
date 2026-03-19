using Microsoft.AspNetCore.Mvc;
using Ordina.Providers.Application.DTOs;
using Ordina.Providers.Application.Services;

namespace Ordina.Providers.Api.Controllers;

[ApiController]
[Route("api/products")]
[Produces("application/json")]
public class ImportController : ControllerBase
{
    private readonly IImportService _importService;
    private readonly ILogger<ImportController> _logger;

    private static readonly string[] AllowedExtensions = [".xlsx"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    public ImportController(IImportService importService, ILogger<ImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>
    /// Importa categorías, atributos, valores y productos desde un archivo Excel (.xlsx).
    /// El archivo debe contener 3 hojas:
    ///   - ESQUEMA_CATEGORIAS: define categorías con sus atributos, tipos de dato y dependencias.
    ///   - VALORES_Y_PRECIOS: define las opciones de cada atributo con su alteración de precio.
    ///   - PRODUCTOS_FINALES: define los productos finales con sus valores fijos preseleccionados.
    /// Las categorías se crean en orden de dependencia (ej: Copete Solo antes de Cama).
    /// </summary>
    [HttpPost("import")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(typeof(ImportProductsResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ImportProductsResultDto>> ImportProducts(
        IFormFile file,
        [FromQuery] string currency = "USD")
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Debe adjuntar un archivo .xlsx" });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return BadRequest(new { message = "Solo se permiten archivos con extensión .xlsx" });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "El archivo supera el límite de 10 MB" });

        var validCurrencies = new[] { "USD", "Bs", "EUR" };
        if (!validCurrencies.Contains(currency))
            return BadRequest(new { message = $"Moneda inválida. Valores aceptados: {string.Join(", ", validCurrencies)}" });

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await _importService.ImportProductsFromExcelAsync(stream, currency);

            _logger.LogInformation(
                "Importación completada: {Sheets} hojas, {Categories} categorías, {Products} productos",
                result.TotalSheets,
                result.TotalCategoriesCreated + result.TotalCategoriesUpdated,
                result.TotalProductsCreated);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error procesando archivo de importación '{FileName}'", file.FileName);
            return StatusCode(500, new { message = $"Error al procesar el archivo: {ex.Message}" });
        }
    }

    /// <summary>
    /// Exporta el formato Excel para importación de productos.
    /// Si includeData=true, incluye las categorías, valores y productos existentes.
    /// Si includeData=false (default), genera una plantilla vacía con solo los headers.
    /// </summary>
    [HttpGet("export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ExportProducts(
        [FromQuery] bool includeData = false,
        [FromQuery] string currency = "USD")
    {
        try
        {
            var bytes = await _importService.ExportProductsToExcelAsync(includeData, currency);
            var fileName = includeData
                ? $"Productos_Camihogar_{DateTime.UtcNow:yyyyMMdd}.xlsx"
                : "Formato_Importacion_Productos.xlsx";

            return File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exportando productos");
            return StatusCode(500, new { message = $"Error al exportar: {ex.Message}" });
        }
    }
}
