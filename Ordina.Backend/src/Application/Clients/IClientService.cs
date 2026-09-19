using Ordina.Application.Common;

namespace Ordina.Application.Clients;

public interface IClientService
{
    Task<PagedResult<ClientResponseDto>> GetAllAsync(PagedRequest request, CancellationToken cancellationToken = default);
    Task<ClientResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<ClientResponseDto?> GetByRutIdAsync(string rutId, CancellationToken cancellationToken = default);
    Task<ClientResponseDto> CreateAsync(CreateClientDto createClientDto, CancellationToken cancellationToken = default);
    Task<ClientResponseDto> UpdateAsync(string id, UpdateClientDto updateClientDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> ClientExistsAsync(string id, CancellationToken cancellationToken = default);
    Task<ImportClientsResultDto> ImportClientsFromCsvAsync(Stream fileStream, CancellationToken cancellationToken = default);
}
