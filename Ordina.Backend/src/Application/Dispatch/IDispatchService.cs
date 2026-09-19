using Ordina.Application.Common;

namespace Ordina.Application.Dispatch;

public interface IDispatchService
{
    Task<IReadOnlyList<DispatchQueueItemDto>> GetDispatchQueueAsync(string? zone = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DispatchRouteResponseDto>> GetRoutesAsync(DateTime? date = null, string? zone = null, CancellationToken cancellationToken = default);
    Task<DispatchRouteResponseDto?> GetRouteByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<DispatchRouteResponseDto> CreateRouteAsync(CreateDispatchRouteDto createDto, CancellationToken cancellationToken = default);
    Task<DispatchRouteResponseDto> UpdateRouteAsync(string id, UpdateDispatchRouteDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> ConfirmDeliveryAsync(ConfirmDeliveryDto confirmDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteRouteAsync(string id, CancellationToken cancellationToken = default);
}
