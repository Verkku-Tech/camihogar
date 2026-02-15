using Ordina.Users.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Users.Application.Services
{
    public interface IClientService
    {
        Task<PagedResult<ClientResponseDto>> GetAllAsync(int page, int pageSize, string? search);
        Task<ClientResponseDto?> GetByIdAsync(string id);
        Task<ClientResponseDto?> GetByRutIdAsync(string rutId);
        Task<ClientResponseDto> CreateAsync(CreateClientDto createClientDto);
        Task<ClientResponseDto> UpdateAsync(string id, UpdateClientDto updateClientDto);
        Task<bool> DeleteAsync(string id);
        Task<bool> ClientExistsAsync(string id);
    }
}
