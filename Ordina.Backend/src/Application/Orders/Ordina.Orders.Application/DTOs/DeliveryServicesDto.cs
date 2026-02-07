namespace Ordina.Orders.Application.DTOs;

public class DeliveryServicesDto
{
    public DeliveryServiceDto? DeliveryExpress { get; set; }
    public DeliveryServiceDto? ServicioAcarreo { get; set; }
    public DeliveryServiceDto? ServicioArmado { get; set; }
}

public class DeliveryServiceDto
{
    public bool Enabled { get; set; }
    public decimal? Cost { get; set; } // Opcional para Acarreo, obligatorio para Armado
    public string Currency { get; set; } = "Bs"; // "Bs" | "USD" | "EUR"
}

