using Ordina.Application.Common;

namespace Ordina.Application.Manufacturing;

public interface IManufacturingService
{
    Task<KanbanBoardDto> GetKanbanBoardAsync(string? providerId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<WorkOrderItemDto>> GetItemsByStageAsync(string stage, CancellationToken cancellationToken = default);
    Task<bool> UpdateStageAsync(UpdateManufacturingStageDto dto, CancellationToken cancellationToken = default);
    Task<bool> RefabricateProductAsync(RefabricateProductDto dto, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ManufacturingReportRowDto>> GetManufacturingReportAsync(string? status = null, string? manufacturerId = null, CancellationToken cancellationToken = default);
}
