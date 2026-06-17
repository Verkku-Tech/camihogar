namespace Ordina.Orders.Application.DTOs;

public class OrderSearchResultDto
{
    public string OrderId { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string Type { get; set; } = "Order";
    public string? ClientPhone { get; set; }
    public string? ClientRutId { get; set; }
}
