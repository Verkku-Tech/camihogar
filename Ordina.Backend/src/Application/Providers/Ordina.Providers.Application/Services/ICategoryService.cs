using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public interface ICategoryService
{
    Task<IEnumerable<CategoryResponseDto>> GetAllCategoriesAsync();
    Task<CategoryResponseDto?> GetCategoryByIdAsync(string id);
    Task<CategoryResponseDto?> GetCategoryByNameAsync(string name);
    Task<CategoryResponseDto> CreateCategoryAsync(CreateCategoryDto createDto);
    Task<CategoryResponseDto> UpdateCategoryAsync(string id, UpdateCategoryDto updateDto);
    Task<bool> DeleteCategoryAsync(string id);
    Task<bool> CategoryExistsAsync(string id);
}
