namespace Ordina.Orders.Application.DTOs;

public class GenerateCommissionReportRequestDto
{
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string? Team { get; set; }
    public List<CommissionReportRowDto> Data { get; set; } = new();
}

