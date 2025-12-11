using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Category;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;

namespace Ordina.Providers.Application.Services;

public class CategoryService : ICategoryService
{
    private readonly ICategoryRepository _categoryRepository;
    private readonly IProductRepository _productRepository;
    private readonly ILogger<CategoryService> _logger;

    public CategoryService(
        ICategoryRepository categoryRepository,
        IProductRepository productRepository,
        ILogger<CategoryService> logger)
    {
        _categoryRepository = categoryRepository;
        _productRepository = productRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<CategoryResponseDto>> GetAllCategoriesAsync()
    {
        try
        {
            var categories = await _categoryRepository.GetAllAsync();
            var result = new List<CategoryResponseDto>();

            foreach (var category in categories)
            {
                // Contar productos en esta categoría
                var products = await _productRepository.GetByCategoryIdAsync(category.Id);
                var categoryDto = MapToDto(category);
                categoryDto.Products = products.Count();
                result.Add(categoryDto);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener categorías");
            throw;
        }
    }

    public async Task<CategoryResponseDto?> GetCategoryByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID de la categoría es requerido", nameof(id));
            }

            var category = await _categoryRepository.GetByIdAsync(id);
            if (category == null)
            {
                return null;
            }

            // Contar productos en esta categoría
            var products = await _productRepository.GetByCategoryIdAsync(category.Id);
            var categoryDto = MapToDto(category);
            categoryDto.Products = products.Count();

            return categoryDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener categoría con ID {CategoryId}", id);
            throw;
        }
    }

    public async Task<CategoryResponseDto?> GetCategoryByNameAsync(string name)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("El nombre de la categoría es requerido", nameof(name));
            }

            var category = await _categoryRepository.GetByNameAsync(name);
            if (category == null)
            {
                return null;
            }

            // Contar productos en esta categoría
            var products = await _productRepository.GetByCategoryIdAsync(category.Id);
            var categoryDto = MapToDto(category);
            categoryDto.Products = products.Count();

            return categoryDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener categoría con nombre {CategoryName}", name);
            throw;
        }
    }

    public async Task<CategoryResponseDto> CreateCategoryAsync(CreateCategoryDto createDto)
    {
        try
        {
            // Verificar si el nombre ya existe
            var existingCategory = await _categoryRepository.GetByNameAsync(createDto.Name);
            if (existingCategory != null)
            {
                throw new InvalidOperationException($"Ya existe una categoría con el nombre '{createDto.Name}'");
            }

            var category = new Category
            {
                Name = createDto.Name,
                Description = createDto.Description ?? string.Empty,
                MaxDiscount = createDto.MaxDiscount,
                MaxDiscountCurrency = createDto.MaxDiscountCurrency,
                Products = 0, // Se calculará dinámicamente
                Attributes = createDto.Attributes.Select(a => MapAttributeFromDto(a)).ToList(),
                CreatedAt = DateTime.UtcNow
            };

            var createdCategory = await _categoryRepository.CreateAsync(category);
            return MapToDto(createdCategory);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear categoría");
            throw;
        }
    }

    public async Task<CategoryResponseDto> UpdateCategoryAsync(string id, UpdateCategoryDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID de la categoría es requerido", nameof(id));
            }

            var existingCategory = await _categoryRepository.GetByIdAsync(id);
            if (existingCategory == null)
            {
                throw new KeyNotFoundException($"Categoría con ID {id} no encontrada");
            }

            // Verificar si el nuevo nombre ya existe (si se está cambiando)
            if (!string.IsNullOrWhiteSpace(updateDto.Name) && updateDto.Name != existingCategory.Name)
            {
                var categoryWithName = await _categoryRepository.GetByNameAsync(updateDto.Name);
                if (categoryWithName != null && categoryWithName.Id != id)
                {
                    throw new InvalidOperationException($"Ya existe una categoría con el nombre '{updateDto.Name}'");
                }
            }

            // Actualizar solo los campos proporcionados
            if (!string.IsNullOrWhiteSpace(updateDto.Name))
                existingCategory.Name = updateDto.Name;

            if (updateDto.Description != null)
                existingCategory.Description = updateDto.Description;

            if (updateDto.MaxDiscount.HasValue)
                existingCategory.MaxDiscount = updateDto.MaxDiscount.Value;

            if (updateDto.MaxDiscountCurrency != null)
                existingCategory.MaxDiscountCurrency = updateDto.MaxDiscountCurrency;

            if (updateDto.Attributes != null)
                existingCategory.Attributes = updateDto.Attributes.Select(a => MapAttributeFromUpdateDto(a, existingCategory.Attributes)).ToList();

            existingCategory.UpdatedAt = DateTime.UtcNow;

            var updatedCategory = await _categoryRepository.UpdateAsync(existingCategory);
            return MapToDto(updatedCategory);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar categoría con ID {CategoryId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteCategoryAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID de la categoría es requerido", nameof(id));
            }

            // Verificar si hay productos asociados
            var products = await _productRepository.GetByCategoryIdAsync(id);
            if (products.Any())
            {
                throw new InvalidOperationException($"No se puede eliminar la categoría porque tiene {products.Count()} producto(s) asociado(s)");
            }

            var exists = await _categoryRepository.ExistsAsync(id);
            if (!exists)
            {
                return false;
            }

            return await _categoryRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría con ID {CategoryId}", id);
            throw;
        }
    }

    public async Task<bool> CategoryExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID de la categoría es requerido", nameof(id));
            }

            return await _categoryRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia de la categoría con ID {CategoryId}", id);
            throw;
        }
    }

    private static CategoryResponseDto MapToDto(Category category)
    {
        return new CategoryResponseDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            Products = category.Products,
            MaxDiscount = category.MaxDiscount,
            MaxDiscountCurrency = category.MaxDiscountCurrency,
            Attributes = category.Attributes.Select(a => new CategoryAttributeDto
            {
                Id = a.Id,
                Title = a.Title,
                Description = a.Description,
                ValueType = a.ValueType,
                MaxSelections = a.MaxSelections,
                MinValue = a.MinValue,
                MaxValue = a.MaxValue,
                Values = a.Values.Select(v => new AttributeValueDto
                {
                    Id = v.Id,
                    Label = v.Label,
                    IsDefault = v.IsDefault,
                    PriceAdjustment = v.PriceAdjustment,
                    PriceAdjustmentCurrency = v.PriceAdjustmentCurrency,
                    ProductId = v.ProductId
                }).ToList()
            }).ToList(),
            CreatedAt = category.CreatedAt,
            UpdatedAt = category.UpdatedAt
        };
    }

    private static CategoryAttribute MapAttributeFromDto(CreateCategoryAttributeDto dto)
    {
        return new CategoryAttribute
        {
            Id = Guid.NewGuid().ToString(),
            Title = dto.Title,
            Description = dto.Description,
            ValueType = dto.ValueType,
            MaxSelections = dto.MaxSelections,
            MinValue = dto.MinValue,
            MaxValue = dto.MaxValue,
            Values = dto.Values.Select(v => new AttributeValue
            {
                Id = Guid.NewGuid().ToString(),
                Label = v.Label,
                IsDefault = v.IsDefault,
                PriceAdjustment = v.PriceAdjustment,
                PriceAdjustmentCurrency = v.PriceAdjustmentCurrency,
                ProductId = v.ProductId
            }).ToList()
        };
    }

    private static CategoryAttribute MapAttributeFromUpdateDto(UpdateCategoryAttributeDto dto, List<CategoryAttribute> existingAttributes)
    {
        var existing = existingAttributes.FirstOrDefault(a => a.Id == dto.Id);
        
        return new CategoryAttribute
        {
            Id = dto.Id ?? Guid.NewGuid().ToString(),
            Title = dto.Title ?? existing?.Title ?? string.Empty,
            Description = dto.Description ?? existing?.Description ?? string.Empty,
            ValueType = dto.ValueType ?? existing?.ValueType ?? string.Empty,
            MaxSelections = dto.MaxSelections ?? existing?.MaxSelections,
            MinValue = dto.MinValue ?? existing?.MinValue,
            MaxValue = dto.MaxValue ?? existing?.MaxValue,
            Values = dto.Values?.Select(v => new AttributeValue
            {
                Id = v.Id ?? Guid.NewGuid().ToString(),
                Label = v.Label ?? string.Empty,
                IsDefault = v.IsDefault,
                PriceAdjustment = v.PriceAdjustment,
                PriceAdjustmentCurrency = v.PriceAdjustmentCurrency,
                ProductId = v.ProductId
            }).ToList() ?? existing?.Values ?? new List<AttributeValue>()
        };
    }
}
