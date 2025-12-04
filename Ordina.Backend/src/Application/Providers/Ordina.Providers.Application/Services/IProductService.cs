using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public interface IProductService
{
    Task<IEnumerable<ProductResponseDto>> GetAllProductsAsync();
    Task<IEnumerable<ProductResponseDto>> GetProductsByCategoryIdAsync(string categoryId);
    Task<IEnumerable<ProductResponseDto>> GetProductsByStatusAsync(string status);
    Task<ProductResponseDto?> GetProductByIdAsync(string id);
    Task<ProductResponseDto?> GetProductBySkuAsync(string sku);
    Task<ProductResponseDto> CreateProductAsync(CreateProductDto createDto);
    Task<ProductResponseDto> UpdateProductAsync(string id, UpdateProductDto updateDto);
    Task<bool> DeleteProductAsync(string id);
    Task<bool> ProductExistsAsync(string id);
    Task<bool> SkuExistsAsync(string sku);
}
