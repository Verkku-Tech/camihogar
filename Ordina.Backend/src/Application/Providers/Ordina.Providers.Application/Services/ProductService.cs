using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Product;
using Ordina.Database.Entities.Category;
using Ordina.Database.Repositories;
using Ordina.Providers.Application.DTOs;
using MongoDB.Bson;
using System.Text.Json;
using System.Linq;
using System.Collections.Generic;

namespace Ordina.Providers.Application.Services;

public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ILogger<ProductService> _logger;

    public ProductService(
        IProductRepository productRepository,
        ICategoryRepository categoryRepository,
        ILogger<ProductService> logger)
    {
        _productRepository = productRepository;
        _categoryRepository = categoryRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<ProductResponseDto>> GetAllProductsAsync()
    {
        try
        {
            var products = await _productRepository.GetAllAsync();
            var result = new List<ProductResponseDto>();

            foreach (var product in products)
            {
                result.Add(await MapToDtoAsync(product));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos");
            throw;
        }
    }

    public async Task<IEnumerable<ProductResponseDto>> GetProductsByCategoryIdAsync(string categoryId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(categoryId))
            {
                throw new ArgumentException("El ID de la categoría es requerido", nameof(categoryId));
            }

            var products = await _productRepository.GetByCategoryIdAsync(categoryId);
            var result = new List<ProductResponseDto>();

            foreach (var product in products)
            {
                result.Add(await MapToDtoAsync(product));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos por categoría {CategoryId}", categoryId);
            throw;
        }
    }

    public async Task<IEnumerable<ProductResponseDto>> GetProductsByStatusAsync(string status)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                throw new ArgumentException("El estado es requerido", nameof(status));
            }

            var products = await _productRepository.GetByStatusAsync(status);
            var result = new List<ProductResponseDto>();

            foreach (var product in products)
            {
                result.Add(await MapToDtoAsync(product));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos por estado {Status}", status);
            throw;
        }
    }

    public async Task<ProductResponseDto?> GetProductByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del producto es requerido", nameof(id));
            }

            var product = await _productRepository.GetByIdAsync(id);
            return product == null ? null : await MapToDtoAsync(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener producto con ID {ProductId}", id);
            throw;
        }
    }

    public async Task<ProductResponseDto?> GetProductBySkuAsync(string sku)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(sku))
            {
                throw new ArgumentException("El SKU es requerido", nameof(sku));
            }

            var product = await _productRepository.GetBySkuAsync(sku);
            return product == null ? null : await MapToDtoAsync(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener producto con SKU {SKU}", sku);
            throw;
        }
    }

    public async Task<ProductResponseDto> CreateProductAsync(CreateProductDto createDto)
    {
        try
        {
            // Verificar si el SKU ya existe
            var existingProduct = await _productRepository.GetBySkuAsync(createDto.SKU);
            if (existingProduct != null)
            {
                throw new InvalidOperationException($"Ya existe un producto con el SKU '{createDto.SKU}'");
            }

            // Resolver la categoría: si CategoryId está vacío o no es válido, buscar por nombre
            Category? category = null;
            if (!string.IsNullOrWhiteSpace(createDto.CategoryId))
            {
                category = await _categoryRepository.GetByIdAsync(createDto.CategoryId);
            }
            
            // Si no se encontró por ID y tenemos nombre de categoría, buscar por nombre
            if (category == null && !string.IsNullOrWhiteSpace(createDto.Category))
            {
                category = await _categoryRepository.GetByNameAsync(createDto.Category);
                
                // Si no existe, crear automáticamente con datos mínimos (para PWA offline-first)
                if (category == null)
                {
                    category = new Category
                    {
                        Name = createDto.Category,
                        Description = string.Empty,
                        MaxDiscount = 0,
                        Attributes = new List<CategoryAttribute>(),
                        Products = 0,
                        CreatedAt = DateTime.UtcNow
                    };
                    category = await _categoryRepository.CreateAsync(category);
                    _logger.LogInformation("Categoría '{CategoryName}' creada automáticamente para producto '{ProductName}'", createDto.Category, createDto.Name);
                }
            }
            
            // Si aún no tenemos categoría, lanzar error
            if (category == null)
            {
                throw new InvalidOperationException($"No se pudo encontrar ni crear la categoría para el producto. CategoryId: '{createDto.CategoryId}', Category: '{createDto.Category}'");
            }

            var product = new Product
            {
                Name = createDto.Name,
                SKU = createDto.SKU,
                Description = createDto.Description,
                CategoryId = category.Id, // Usar el ID real de la categoría (ya sea la encontrada o la creada)
                Category = createDto.Category, // Usar el nombre proporcionado
                Price = createDto.Price,
                PriceCurrency = createDto.PriceCurrency,
                Stock = createDto.Stock,
                Status = createDto.Status,
                Attributes = ConvertAttributesFromJsonElement(createDto.Attributes),
                ProviderId = createDto.ProviderId,
                CreatedAt = DateTime.UtcNow
            };

            var createdProduct = await _productRepository.CreateAsync(product);
            return await MapToDtoAsync(createdProduct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear producto");
            throw;
        }
    }

    public async Task<ProductResponseDto> UpdateProductAsync(string id, UpdateProductDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del producto es requerido", nameof(id));
            }

            var existingProduct = await _productRepository.GetByIdAsync(id);
            if (existingProduct == null)
            {
                throw new KeyNotFoundException($"Producto con ID {id} no encontrado");
            }

            // Verificar si el nuevo SKU ya existe (si se está cambiando)
            if (!string.IsNullOrWhiteSpace(updateDto.SKU) && updateDto.SKU != existingProduct.SKU)
            {
                var productWithSku = await _productRepository.GetBySkuAsync(updateDto.SKU);
                if (productWithSku != null && productWithSku.Id != id)
                {
                    throw new InvalidOperationException($"Ya existe un producto con el SKU '{updateDto.SKU}'");
                }
            }

            // Manejar actualización de categoría
            // Si se proporciona Category o CategoryId, resolver la categoría
            if (!string.IsNullOrWhiteSpace(updateDto.Category) || !string.IsNullOrWhiteSpace(updateDto.CategoryId))
            {
                try
                {
                    string categoryIdToUse = updateDto.CategoryId ?? string.Empty;
                    Category? category = null;

                    // Si se proporciona un CategoryId, intentar buscar por ID
                    if (!string.IsNullOrWhiteSpace(categoryIdToUse) && ObjectId.TryParse(categoryIdToUse, out _))
                    {
                        category = await _categoryRepository.GetByIdAsync(categoryIdToUse);
                    }

                    // Si no se encontró por ID o no se proporcionó un ID válido, intentar buscar por nombre
                    if (category == null && !string.IsNullOrWhiteSpace(updateDto.Category))
                    {
                        category = await _categoryRepository.GetByNameAsync(updateDto.Category);

                        // Si la categoría no existe por nombre, crearla automáticamente
                        if (category == null)
                        {
                            _logger.LogInformation("Categoría '{CategoryName}' no encontrada, creando automáticamente.", updateDto.Category);
                            var newCategory = new Category
                            {
                                Name = updateDto.Category,
                                Description = $"Categoría creada automáticamente para el producto {existingProduct.Name}",
                                MaxDiscount = 0,
                                Products = 0,
                                Attributes = new List<CategoryAttribute>(),
                                CreatedAt = DateTime.UtcNow
                            };
                            category = await _categoryRepository.CreateAsync(newCategory);
                            categoryIdToUse = category.Id;
                        }
                        else
                        {
                            categoryIdToUse = category.Id;
                        }
                    }

                    // Si después de todos los intentos no hay categoría, lanzar error solo si se proporcionó CategoryId explícitamente
                    if (category == null && !string.IsNullOrWhiteSpace(updateDto.CategoryId))
                    {
                        throw new InvalidOperationException($"La categoría con ID {updateDto.CategoryId} no existe");
                    }

                    // Actualizar la categoría si se encontró o se creó una nueva
                    if (category != null && !string.IsNullOrWhiteSpace(categoryIdToUse))
                    {
                        existingProduct.CategoryId = categoryIdToUse;
                        existingProduct.Category = updateDto.Category ?? category.Name;
                    }
                }
                catch (Exception categoryEx)
                {
                    _logger.LogError(categoryEx, "Error al procesar categoría durante actualización de producto. Continuando sin actualizar categoría.");
                    // No lanzar error, continuar con la actualización sin cambiar la categoría
                }
            }

            // Actualizar solo los campos proporcionados
            if (!string.IsNullOrWhiteSpace(updateDto.Name))
                existingProduct.Name = updateDto.Name;

            if (!string.IsNullOrWhiteSpace(updateDto.SKU))
                existingProduct.SKU = updateDto.SKU;

            if (updateDto.Description != null)
                existingProduct.Description = updateDto.Description;

            if (updateDto.Price.HasValue)
                existingProduct.Price = updateDto.Price.Value;

            if (updateDto.PriceCurrency != null)
                existingProduct.PriceCurrency = updateDto.PriceCurrency;

            if (updateDto.Stock.HasValue)
                existingProduct.Stock = updateDto.Stock.Value;

            if (!string.IsNullOrWhiteSpace(updateDto.Status))
                existingProduct.Status = updateDto.Status;

            if (updateDto.Attributes != null)
                existingProduct.Attributes = ConvertAttributesFromJsonElement(updateDto.Attributes);

            if (updateDto.ProviderId != null)
                existingProduct.ProviderId = updateDto.ProviderId;

            existingProduct.UpdatedAt = DateTime.UtcNow;

            var updatedProduct = await _productRepository.UpdateAsync(existingProduct);
            return await MapToDtoAsync(updatedProduct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar producto con ID {ProductId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteProductAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del producto es requerido", nameof(id));
            }

            var exists = await _productRepository.ExistsAsync(id);
            if (!exists)
            {
                return false;
            }

            return await _productRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar producto con ID {ProductId}", id);
            throw;
        }
    }

    public async Task<bool> ProductExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del producto es requerido", nameof(id));
            }

            return await _productRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del producto con ID {ProductId}", id);
            throw;
        }
    }

    public async Task<bool> SkuExistsAsync(string sku)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(sku))
            {
                throw new ArgumentException("El SKU es requerido", nameof(sku));
            }

            return await _productRepository.SkuExistsAsync(sku);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del SKU {SKU}", sku);
            throw;
        }
    }

    /// <summary>
    /// Convierte un Dictionary que puede contener JsonElement a tipos nativos compatibles con MongoDB
    /// </summary>
    private static Dictionary<string, object>? ConvertAttributesFromJsonElement(Dictionary<string, object>? attributes)
    {
        if (attributes == null)
            return null;

        var converted = new Dictionary<string, object>();

        foreach (var kvp in attributes)
        {
            converted[kvp.Key] = ConvertJsonElementToNativeType(kvp.Value);
        }

        return converted;
    }

    /// <summary>
    /// Convierte un JsonElement o cualquier valor a un tipo nativo compatible con MongoDB
    /// </summary>
    private static object ConvertJsonElementToNativeType(object value)
    {
        if (value == null)
            return null!;

        // Si es un JsonElement, convertirlo
        if (value is JsonElement jsonElement)
        {
            return jsonElement.ValueKind switch
            {
                JsonValueKind.String => jsonElement.GetString() ?? string.Empty,
                JsonValueKind.Number => jsonElement.TryGetInt32(out var intVal) ? intVal : jsonElement.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null!,
                JsonValueKind.Array => jsonElement.EnumerateArray()
                    .Select(item => ConvertJsonElementToNativeType(item))
                    .ToArray(),
                JsonValueKind.Object => jsonElement.EnumerateObject()
                    .ToDictionary(
                        prop => prop.Name,
                        prop => ConvertJsonElementToNativeType(prop.Value)
                    ),
                _ => jsonElement.GetRawText()
            };
        }

        // Si es un array o lista, convertir sus elementos
        if (value is System.Collections.IEnumerable enumerable && !(value is string))
        {
            var list = new List<object>();
            foreach (var item in enumerable)
            {
                list.Add(ConvertJsonElementToNativeType(item!));
            }
            return list.ToArray();
        }

        // Si es un diccionario, convertir sus valores
        if (value is Dictionary<string, object> dict)
        {
            return dict.ToDictionary(
                kvp => kvp.Key,
                kvp => ConvertJsonElementToNativeType(kvp.Value)
            );
        }

        // Si ya es un tipo nativo, retornarlo tal cual
        return value;
    }

    private async Task<ProductResponseDto> MapToDtoAsync(Product product)
    {
        // Obtener el nombre de la categoría si no está en el producto
        string categoryName = product.Category;
        if (string.IsNullOrWhiteSpace(categoryName) && !string.IsNullOrWhiteSpace(product.CategoryId))
        {
            var category = await _categoryRepository.GetByIdAsync(product.CategoryId);
            categoryName = category?.Name ?? string.Empty;
        }

        return new ProductResponseDto
        {
            Id = product.Id,
            Name = product.Name,
            CategoryId = product.CategoryId,
            Category = categoryName,
            Price = product.Price,
            PriceCurrency = product.PriceCurrency,
            Stock = product.Stock,
            Status = product.Status,
            SKU = product.SKU,
            Description = product.Description,
            Attributes = product.Attributes,
            ProviderId = product.ProviderId,
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt
        };
    }
}
