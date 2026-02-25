namespace Ordina.Providers.Application.DTOs;

public class ImportProductsResultDto
{
    public int TotalSheets { get; set; }
    public int TotalCategoriesCreated { get; set; }
    public int TotalCategoriesUpdated { get; set; }
    public int TotalValuesAdded { get; set; }
    public List<SheetImportResultDto> Sheets { get; set; } = new();
}

public class SheetImportResultDto
{
    public string SheetName { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public bool CategoryCreated { get; set; }
    public bool CategoryUpdated { get; set; }
    public int ValuesAdded { get; set; }
    public List<string> Errors { get; set; } = new();
}
