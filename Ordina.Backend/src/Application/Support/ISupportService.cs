namespace Ordina.Application.Support;

public interface ISupportService
{
    Task<SupportTicketResponseDto> CreateTicketAsync(CreateSupportTicketDto dto, SupportCurrentUserContext userContext, CancellationToken cancellationToken = default);
}
