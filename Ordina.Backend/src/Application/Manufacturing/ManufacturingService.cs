using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Orders;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;

namespace Ordina.Application.Manufacturing;

public class ManufacturingService : IManufacturingService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<ManufacturingService> _logger;

    public ManufacturingService(
        IOrderRepository orderRepository,
        ILogger<ManufacturingService> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<KanbanBoardDto> GetKanbanBoardAsync(string? providerId = null, CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        var allItems = new List<WorkOrderItemDto>();

        foreach (var order in orders)
        {
            foreach (var product in order.Products)
            {
                if (string.IsNullOrWhiteSpace(product.ManufacturingStatusString))
                    continue;

                if (!string.IsNullOrWhiteSpace(providerId) && product.ManufacturingProviderId != providerId)
                    continue;

                allItems.Add(MapToWorkOrderItem(order, product));
            }
        }

        var must = allItems.Where(i => i.ManufacturingStatus == "debe_fabricar").ToList();
        var toMfg = allItems.Where(i => i.ManufacturingStatus == "por_fabricar").ToList();
        var mfg = allItems.Where(i => i.ManufacturingStatus == "fabricando").ToList();
        var warehouse = allItems.Where(i => i.ManufacturingStatus == "almacen_no_fabricado").ToList();

        return new KanbanBoardDto(must, toMfg, mfg, warehouse);
    }

    public async Task<IReadOnlyList<WorkOrderItemDto>> GetItemsByStageAsync(string stage, CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        var items = new List<WorkOrderItemDto>();
        foreach (var order in orders)
        {
            foreach (var product in order.Products)
            {
                if (product.ManufacturingStatusString == stage)
                {
                    items.Add(MapToWorkOrderItem(order, product));
                }
            }
        }

        return items;
    }

    public async Task<bool> UpdateStageAsync(UpdateManufacturingStageDto dto, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(dto.OrderId, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido no encontrado: {dto.OrderId}");

        var product = order.Products.FirstOrDefault(p => p.Id == dto.ProductId)
            ?? throw new KeyNotFoundException($"Producto no encontrado en el pedido: {dto.ProductId}");

        product.ManufacturingStatusString = dto.NewStage;
        if (dto.Notes != null) product.ManufacturingNotes = dto.Notes;
        if (dto.ProviderId != null) product.ManufacturingProviderId = dto.ProviderId;
        if (dto.ProviderName != null) product.ManufacturingProviderName = dto.ProviderName;

        if (dto.NewStage == "fabricando")
        {
            product.ManufacturingStartedAt ??= DateTime.UtcNow;
            product.LocationStatusString = "FABRICACION";
            product.LogisticStatusString = "Fabricándose";
        }
        else if (dto.NewStage == "almacen_no_fabricado")
        {
            product.ManufacturingCompletedAt ??= DateTime.UtcNow;
            product.LocationStatusString = "EN TIENDA";
            product.LogisticStatusString = "En Almacén";
        }

        order.UpdatedAt = DateTime.UtcNow;
        var success = await _orderRepository.UpdateAsync(order, cancellationToken);

        _logger.LogInformation("Etapa de fabricación actualizada para pedido {OrderId}, producto {ProductId} -> {NewStage}",
            dto.OrderId, dto.ProductId, dto.NewStage);

        return success;
    }

    public async Task<bool> RefabricateProductAsync(RefabricateProductDto dto, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(dto.OrderId, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido no encontrado: {dto.OrderId}");

        var product = order.Products.FirstOrDefault(p => p.Id == dto.ProductId)
            ?? throw new KeyNotFoundException($"Producto no encontrado en el pedido: {dto.ProductId}");

        product.RefabricationHistory ??= new List<RefabricationRecord>();
        product.RefabricationHistory.Add(new RefabricationRecord
        {
            Reason = dto.Reason,
            Date = DateTime.UtcNow,
            PreviousProviderId = product.ManufacturingProviderId,
            PreviousProviderName = product.ManufacturingProviderName,
            NewProviderId = dto.NewProviderId ?? product.ManufacturingProviderId,
            NewProviderName = dto.NewProviderName ?? product.ManufacturingProviderName
        });

        product.RefabricationReason = dto.Reason;
        product.RefabricatedAt = DateTime.UtcNow;
        product.ManufacturingStatusString = "debe_fabricar";
        product.LocationStatusString = "FABRICACION";
        product.LogisticStatusString = "Fabricándose";

        if (dto.NewProviderId != null) product.ManufacturingProviderId = dto.NewProviderId;
        if (dto.NewProviderName != null) product.ManufacturingProviderName = dto.NewProviderName;

        order.UpdatedAt = DateTime.UtcNow;
        return await _orderRepository.UpdateAsync(order, cancellationToken);
    }

    public async Task<IReadOnlyList<ManufacturingReportRowDto>> GetManufacturingReportAsync(
        string? status = null,
        string? manufacturerId = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.FindAsync(
            o => o.TypeString == "Order" && o.StatusString != "Cancelado",
            cancellationToken);

        var report = new List<ManufacturingReportRowDto>();

        foreach (var order in orders)
        {
            foreach (var product in order.Products)
            {
                if (string.IsNullOrWhiteSpace(product.ManufacturingStatusString))
                    continue;

                if (!string.IsNullOrWhiteSpace(status) && product.ManufacturingStatusString != status)
                    continue;

                if (!string.IsNullOrWhiteSpace(manufacturerId) && product.ManufacturingProviderId != manufacturerId)
                    continue;

                report.Add(new ManufacturingReportRowDto(
                    order.OrderNumber,
                    product.Name,
                    product.Quantity,
                    product.Category,
                    product.ManufacturingStatusString,
                    product.ManufacturingProviderName ?? "-",
                    product.ManufacturingStartedAt,
                    product.ManufacturingCompletedAt,
                    product.ManufacturingNotes ?? string.Empty));
            }
        }

        return report;
    }

    private static WorkOrderItemDto MapToWorkOrderItem(Order order, OrderProduct p) => new(
        order.Id,
        order.OrderNumber,
        p.Id,
        p.Name,
        p.Quantity,
        p.Category,
        p.Attributes,
        p.ManufacturingStatusString ?? "debe_fabricar",
        p.ManufacturingProviderId,
        p.ManufacturingProviderName,
        p.ManufacturingStartedAt,
        p.ManufacturingCompletedAt,
        p.ManufacturingNotes,
        p.RefabricationReason,
        p.RefabricatedAt,
        p.LocationStatusString,
        p.Images?.Select(img => new ProductImageDto(img.Id, img.Base64, img.Filename, img.Type, img.UploadedAt, img.Size)).ToList());
}
