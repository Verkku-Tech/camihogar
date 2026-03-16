using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public interface IImportService
{
    Task<ImportProductsResultDto> ImportProductsFromExcelAsync(Stream fileStream, string currency);
    Task<byte[]> ExportProductsToExcelAsync(bool includeData, string currency);
}

