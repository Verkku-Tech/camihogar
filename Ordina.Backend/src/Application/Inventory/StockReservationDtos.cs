namespace Ordina.Application.Inventory;

public record StockReservationDto(
    string Id,
    string StockId,
    string ProductId,
    string ProductName,
    string LocationId,
    string LocationName,
    string VendorId,
    string VendorName,
    int Quantity,
    string ReservationType,
    string? OrderNumber,
    DateTime ExpiresAt,
    string Status,
    int RemainingSeconds);

public record CreateStockReservationDto(
    string StockId,
    string VendorId,
    string VendorName,
    int Quantity = 1,
    string ReservationType = "counter");

public record ExtendStockReservationDto(string OrderNumber);

public record ConfirmStockReservationDto(string OrderNumber);
