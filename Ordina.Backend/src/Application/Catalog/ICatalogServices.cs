using Ordina.Application.Common;

namespace Ordina.Application.Catalog;

public interface IProductService
{
    Task<IReadOnlyList<ProductResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PagedResult<ProductResponseDto>> GetPagedAsync(
        PagedRequest request,
        string? categoryId = null,
        string? status = null,
        CancellationToken cancellationToken = default);
    Task<ProductResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<ProductResponseDto?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProductResponseDto>> GetByCategoryIdAsync(string categoryId, CancellationToken cancellationToken = default);
    Task<ProductResponseDto> CreateAsync(CreateProductDto createDto, CancellationToken cancellationToken = default);
    Task<ProductResponseDto> UpdateAsync(string id, UpdateProductDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<CategoryResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<CategoryResponseDto> CreateAsync(CreateCategoryDto createDto, CancellationToken cancellationToken = default);
    Task<CategoryResponseDto> UpdateAsync(string id, UpdateCategoryDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

public interface IProviderService
{
    Task<IReadOnlyList<ProviderResponseDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PagedResult<ProviderResponseDto>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default);
    Task<ProviderResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<ProviderResponseDto> CreateAsync(CreateProviderDto createDto, CancellationToken cancellationToken = default);
    Task<ProviderResponseDto> UpdateAsync(string id, UpdateProviderDto updateDto, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}
