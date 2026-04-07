namespace Ordina.Orders.Application.DTOs;

public class RefabricationRecordDto
{
    public string Reason { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? PreviousProviderId { get; set; }
    public string? PreviousProviderName { get; set; }
    public string? NewProviderId { get; set; }
    public string? NewProviderName { get; set; }
}
