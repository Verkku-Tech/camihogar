using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IAccessPinService
{
    Task<GenerateAccessPinResponseDto> GenerateAsync(string userId, string userName);

    Task<ValidateAccessPinResponseDto> ValidateAsync(string pin, string orderId, string userId);

    Task<AccessPinSessionResponseDto> GetSessionAsync(string orderId, string userId);

    Task<bool> HasActiveSessionAsync(string orderId, string userId);

    Task<AccessPinHistoryResponseDto> GetHistoryAsync(int page, int pageSize);
}
