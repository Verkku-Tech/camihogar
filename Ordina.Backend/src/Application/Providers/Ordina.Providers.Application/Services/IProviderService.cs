using MongoDB.Bson;
using Ordina.Providers.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ordina.Providers.Application.Services
{
    public interface IProviderService
    {
        Task<IEnumerable<ProviderResponseDto>> GetAllAsync();
        Task<ProviderResponseDto?> GetByIdAsync(ObjectId id);
        Task<ProviderResponseDto?> GetByRifAsync(string rif);
        Task<ProviderResponseDto> CreateAsync(CreateProviderDto createProviderDto);
        Task<ProviderResponseDto?> UpdateAsync(ObjectId id, UpdateProviderDto updateProviderDto);
        Task<bool> DeleteAsync(ObjectId id);
    }
}
