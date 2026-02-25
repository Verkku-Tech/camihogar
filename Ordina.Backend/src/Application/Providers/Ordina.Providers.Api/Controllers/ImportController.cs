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
    /// Importa categorías, atributos y productos desde un archivo Excel (.xlsx).
    /// Cada pestaña = una categoría.  El encabezado se auto-detecta.
    /// Col B = Productos | Col C = Atributo | Col D = Valor | Col E = Ajuste de precio.
    /// Productos se crean con precio 0; el precio lo definen los atributos.
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
}
