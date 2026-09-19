using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Dispatch;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;

namespace Ordina.Application.Dispatch;

public class DispatchService : IDispatchService
{
    private readonly IRepository<DispatchRoute> _routeRepository;
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<DispatchService> _logger;

    public DispatchService(
        IRepository<DispatchRoute> routeRepository,
        IOrderRepository orderRepository,
        ILogger<DispatchService> logger)
    {
        _routeRepository = routeRepository;
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DispatchQueueItemDto>> GetDispatchQueueAsync(string? zone = null, CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado" && o.HasDelivery,
            cancellationToken);

        var queue = new List<DispatchQueueItemDto>();

        foreach (var order in orders)
        {
            if (!string.IsNullOrWhiteSpace(zone) && order.DeliveryZone != zone)
                continue;

            foreach (var product in order.Products)
            {
                if (product.LocationStatusString is "EN TIENDA" or "ALMACEN" && product.LogisticStatusString != "Completado")
                {
                    queue.Add(new DispatchQueueItemDto(
                        order.Id,
                        order.OrderNumber,
                        product.Id,
                        product.Name,
                        product.Quantity,
                        order.ClientName,
                        string.Empty,
                        order.DeliveryAddress ?? string.Empty,
                        order.DeliveryZone ?? "caracas",
                        order.DeliveryTypeString ?? "entrega_programada",
                        product.LocationStatusString,
                        product.LogisticStatusString));
                }
            }
        }

        return queue;
    }

    public async Task<IReadOnlyList<DispatchRouteResponseDto>> GetRoutesAsync(DateTime? date = null, string? zone = null, CancellationToken cancellationToken = default)
    {
        var routes = await _routeRepository.GetAllAsync(cancellationToken);

        if (date.HasValue)
        {
            var targetDate = date.Value.Date;
            routes = routes.Where(r => r.RouteDate.Date == targetDate).ToList();
        }

        if (!string.IsNullOrWhiteSpace(zone))
        {
            routes = routes.Where(r => r.Zone == zone).ToList();
        }

        return routes.Select(MapToDto).ToList();
    }

    public async Task<DispatchRouteResponseDto?> GetRouteByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var route = await _routeRepository.GetByIdAsync(id, cancellationToken);
        return route != null ? MapToDto(route) : null;
    }

    public async Task<DispatchRouteResponseDto> CreateRouteAsync(CreateDispatchRouteDto createDto, CancellationToken cancellationToken = default)
    {
        var route = new DispatchRoute
        {
            Name = createDto.Name.Trim(),
            DriverName = createDto.DriverName.Trim(),
            DriverPhone = createDto.DriverPhone?.Trim(),
            VehiclePlate = createDto.VehiclePlate?.Trim(),
            RouteDate = createDto.RouteDate,
            Zone = createDto.Zone,
            StatusString = "Generado",
            Observations = createDto.Observations,
            Items = createDto.Items.Select(i => new DispatchItem
            {
                OrderId = i.OrderId,
                OrderNumber = i.OrderNumber,
                ProductLineId = i.ProductLineId,
                ProductName = i.ProductName,
                Quantity = i.Quantity,
                ClientName = i.ClientName,
                ClientPhone = i.ClientPhone,
                DeliveryAddress = i.DeliveryAddress,
                StatusString = "EN RUTA"
            }).ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _routeRepository.AddAsync(route, cancellationToken);

        // Actualizar el estado de los items del pedido a EN RUTA
        foreach (var item in route.Items)
        {
            var order = await _orderRepository.GetByIdAsync(item.OrderId, cancellationToken);
            if (order != null)
            {
                var product = order.Products.FirstOrDefault(p => p.Id == item.ProductLineId);
                if (product != null)
                {
                    product.LocationStatusString = "EN RUTA";
                    product.LogisticStatusString = "En Ruta";
                    order.UpdatedAt = DateTime.UtcNow;
                    await _orderRepository.UpdateAsync(order, cancellationToken);
                }
            }
        }

        _logger.LogInformation("Ruta de despacho creada: {RouteId} ({Name}) con {Count} ítems", created.Id, created.Name, created.Items.Count);
        return MapToDto(created);
    }

    public async Task<DispatchRouteResponseDto> UpdateRouteAsync(string id, UpdateDispatchRouteDto updateDto, CancellationToken cancellationToken = default)
    {
        var route = await _routeRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Ruta no encontrada: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Name)) route.Name = updateDto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.DriverName)) route.DriverName = updateDto.DriverName.Trim();
        if (updateDto.DriverPhone != null) route.DriverPhone = updateDto.DriverPhone.Trim();
        if (updateDto.VehiclePlate != null) route.VehiclePlate = updateDto.VehiclePlate.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Status)) route.StatusString = updateDto.Status;
        if (updateDto.Observations != null) route.Observations = updateDto.Observations;

        route.UpdatedAt = DateTime.UtcNow;
        await _routeRepository.UpdateAsync(route, cancellationToken);
        return MapToDto(route);
    }

    public async Task<bool> ConfirmDeliveryAsync(ConfirmDeliveryDto confirmDto, CancellationToken cancellationToken = default)
    {
        var route = await _routeRepository.GetByIdAsync(confirmDto.RouteId, cancellationToken)
            ?? throw new KeyNotFoundException($"Ruta no encontrada: {confirmDto.RouteId}");

        var routeItem = route.Items.FirstOrDefault(i => i.OrderId == confirmDto.OrderId && i.ProductLineId == confirmDto.ProductLineId)
            ?? throw new KeyNotFoundException("Ítem no encontrado en la ruta de despacho.");

        routeItem.StatusString = "DESPACHADO";
        routeItem.DeliveredAt = DateTime.UtcNow;
        route.UpdatedAt = DateTime.UtcNow;

        if (route.Items.All(i => i.StatusString == "DESPACHADO"))
        {
            route.StatusString = "Completado";
        }

        await _routeRepository.UpdateAsync(route, cancellationToken);

        // Actualizar el estado del producto en el pedido
        var order = await _orderRepository.GetByIdAsync(confirmDto.OrderId, cancellationToken);
        if (order != null)
        {
            var product = order.Products.FirstOrDefault(p => p.Id == confirmDto.ProductLineId);
            if (product != null)
            {
                product.LocationStatusString = "DESPACHADO";
                product.LogisticStatusString = "Completado";
                product.DeliveredAt = DateTime.UtcNow;

                // Si todos los productos están despachados, marcar pedido como completado
                if (order.Products.All(p => p.LocationStatusString == "DESPACHADO"))
                {
                    order.StatusString = "Completado";
                }

                order.UpdatedAt = DateTime.UtcNow;
                await _orderRepository.UpdateAsync(order, cancellationToken);
            }
        }

        _logger.LogInformation("Entrega confirmada para pedido {OrderId}, producto {ProductId}", confirmDto.OrderId, confirmDto.ProductLineId);
        return true;
    }

    public async Task<bool> DeleteRouteAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _routeRepository.DeleteAsync(id, cancellationToken);
    }

    private static DispatchRouteResponseDto MapToDto(DispatchRoute r) => new(
        r.Id,
        r.Name,
        r.DriverName,
        r.DriverPhone,
        r.VehiclePlate,
        r.RouteDate,
        r.Zone,
        r.StatusString,
        r.Items.Select(i => new DispatchItemDto(
            i.OrderId,
            i.OrderNumber,
            i.ProductLineId,
            i.ProductName,
            i.Quantity,
            i.ClientName,
            i.ClientPhone,
            i.DeliveryAddress,
            i.StatusString,
            i.DeliveredAt)).ToList(),
        r.Observations,
        r.CreatedAt,
        r.UpdatedAt);
}
