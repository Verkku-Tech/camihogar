using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Enums;

namespace Ordina.Application.Catalog;

public class ProductService(
    IProductRepository productRepository,
    ICacheService cacheService,
    ILogger<ProductService> logger) : IProductService
{
    public async Task<IReadOnlyList<ProductResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cacheService.GetAsync<IReadOnlyList<ProductResponseDto>>(CacheKeys.Products, cancellationToken);
        if (cached != null) return cached;

        var products = await productRepository.GetAllAsync(cancellationToken);
        var dtos = products.Select(MapToDto).ToList();
        await cacheService.SetAsync(CacheKeys.Products, dtos, slidingExpiration: CacheTtl.CatalogSliding, cancellationToken: cancellationToken);
        return dtos;
    }

    public async Task<PagedResult<ProductResponseDto>> GetPagedAsync(
        PagedRequest request,
        string? categoryId = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var hasSearch = !string.IsNullOrWhiteSpace(request.SearchTerm);
        var hasCategory = !string.IsNullOrWhiteSpace(categoryId);
        var hasStatus = !string.IsNullOrWhiteSpace(status);

        System.Linq.Expressions.Expression<Func<Product, bool>>? filter = (hasSearch || hasCategory || hasStatus)
            ? p => (!hasSearch || p.Name.Contains(request.SearchTerm!) || p.SKU.Contains(request.SearchTerm!) || p.Category.Contains(request.SearchTerm!))
                && (!hasCategory || p.CategoryId == categoryId)
                && (!hasStatus || p.StatusString == status)
            : null;

        var result = await productRepository.GetPagedAsync(
            request.Page,
            request.PageSize,
            filter,
            cancellationToken);

        return new PagedResult<ProductResponseDto>(
            result.Items.Select(MapToDto).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public async Task<ProductResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetByIdAsync(id, cancellationToken);
        return product != null ? MapToDto(product) : null;
    }

    public async Task<ProductResponseDto?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetBySkuAsync(sku, cancellationToken);
        return product != null ? MapToDto(product) : null;
    }

    public async Task<IReadOnlyList<ProductResponseDto>> GetByCategoryIdAsync(string categoryId, CancellationToken cancellationToken = default)
    {
        var products = await productRepository.GetByCategoryIdAsync(categoryId, cancellationToken);
        return products.Select(MapToDto).ToList();
    }

    public async Task<ProductResponseDto> CreateAsync(CreateProductDto createDto, CancellationToken cancellationToken = default)
    {
        var existingSku = await productRepository.GetBySkuAsync(createDto.SKU, cancellationToken);
        if (existingSku != null)
        {
            throw new InvalidOperationException($"Ya existe un producto con el SKU '{createDto.SKU}'");
        }

        var product = new Product
        {
            Name = createDto.Name.Trim(),
            CategoryId = createDto.CategoryId,
            Category = createDto.Category,
            Price = createDto.Price,
            PriceCurrency = createDto.PriceCurrency,
            Stock = createDto.Stock,
            SKU = createDto.SKU.Trim(),
            StatusString = createDto.Status,
            Attributes = createDto.Attributes,
            ProviderId = createDto.ProviderId,
            Description = createDto.Description,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await productRepository.AddAsync(product, cancellationToken);
        await InvalidateProductCacheAsync(cancellationToken);
        logger.LogInformation("Producto creado: {ProductId} ({SKU})", created.Id, created.SKU);
        return MapToDto(created);
    }

    public async Task<ProductResponseDto> UpdateAsync(string id, UpdateProductDto updateDto, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Producto no encontrado: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Name)) product.Name = updateDto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.CategoryId)) product.CategoryId = updateDto.CategoryId;
        if (!string.IsNullOrWhiteSpace(updateDto.Category)) product.Category = updateDto.Category;
        if (updateDto.Price.HasValue) product.Price = updateDto.Price.Value;
        if (!string.IsNullOrWhiteSpace(updateDto.PriceCurrency)) product.PriceCurrency = updateDto.PriceCurrency;
        if (updateDto.Stock.HasValue) product.Stock = updateDto.Stock.Value;
        if (!string.IsNullOrWhiteSpace(updateDto.Status)) product.StatusString = updateDto.Status;
        if (!string.IsNullOrWhiteSpace(updateDto.SKU) && updateDto.SKU != product.SKU)
        {
            var existingSku = await productRepository.GetBySkuAsync(updateDto.SKU, cancellationToken);
            if (existingSku != null && existingSku.Id != id)
                throw new InvalidOperationException($"El SKU '{updateDto.SKU}' ya está registrado");
            product.SKU = updateDto.SKU.Trim();
        }
        if (updateDto.Attributes != null) product.Attributes = updateDto.Attributes;
        if (updateDto.ProviderId != null) product.ProviderId = updateDto.ProviderId;
        if (updateDto.Description != null) product.Description = updateDto.Description;

        product.UpdatedAt = DateTime.UtcNow;
        await productRepository.UpdateAsync(product, cancellationToken);
        await InvalidateProductCacheAsync(cancellationToken);
        return MapToDto(product);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var deleted = await productRepository.DeleteAsync(id, cancellationToken);
        if (deleted) await InvalidateProductCacheAsync(cancellationToken);
        return deleted;
    }

    private async Task InvalidateProductCacheAsync(CancellationToken cancellationToken)
    {
        await cacheService.RemoveAsync(CacheKeys.Products, cancellationToken);
    }

    private static ProductResponseDto MapToDto(Product p) => new(
        p.Id,
        p.Name,
        p.CategoryId,
        p.Category,
        p.Price,
        p.PriceCurrency,
        p.Stock,
        p.StatusString,
        p.SKU,
        p.Attributes,
        p.ProviderId,
        p.Description,
        p.CreatedAt,
        p.UpdatedAt);
}

public class CategoryService : ICategoryService
{
    private readonly IRepository<Category> _categoryRepository;
    private readonly ICacheService _cacheService;
    private readonly ILogger<CategoryService> _logger;

    public CategoryService(
        IRepository<Category> categoryRepository,
        ICacheService cacheService,
        ILogger<CategoryService> logger)
    {
        _categoryRepository = categoryRepository;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<CategoryResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cacheService.GetAsync<IReadOnlyList<CategoryResponseDto>>(CacheKeys.Categories, cancellationToken);
        if (cached != null) return cached;

        var categories = await _categoryRepository.GetAllAsync(cancellationToken);
        var dtos = categories.Select(MapToDto).ToList();
        await _cacheService.SetAsync(CacheKeys.Categories, dtos, slidingExpiration: CacheTtl.CatalogSliding, cancellationToken: cancellationToken);
        return dtos;
    }

    public async Task<CategoryResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var category = await _categoryRepository.GetByIdAsync(id, cancellationToken);
        return category != null ? MapToDto(category) : null;
    }

    public async Task<CategoryResponseDto> CreateAsync(CreateCategoryDto createDto, CancellationToken cancellationToken = default)
    {
        var category = new Category
        {
            Name = createDto.Name.Trim(),
            Description = createDto.Description,
            MaxDiscount = createDto.MaxDiscount,
            MaxDiscountCurrency = createDto.MaxDiscountCurrency,
            Attributes = createDto.Attributes?.Select(MapFromAttributeDto).ToList() ?? new(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _categoryRepository.AddAsync(category, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Categories, cancellationToken);
        return MapToDto(created);
    }

    public async Task<CategoryResponseDto> UpdateAsync(string id, UpdateCategoryDto updateDto, CancellationToken cancellationToken = default)
    {
        var category = await _categoryRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Categoría no encontrada: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Name)) category.Name = updateDto.Name.Trim();
        if (updateDto.Description != null) category.Description = updateDto.Description;
        if (updateDto.MaxDiscount.HasValue) category.MaxDiscount = updateDto.MaxDiscount.Value;
        if (updateDto.MaxDiscountCurrency != null) category.MaxDiscountCurrency = updateDto.MaxDiscountCurrency;
        if (updateDto.Attributes != null) category.Attributes = updateDto.Attributes.Select(MapFromAttributeDto).ToList();

        category.UpdatedAt = DateTime.UtcNow;
        await _categoryRepository.UpdateAsync(category, cancellationToken);
        await _cacheService.RemoveAsync(CacheKeys.Categories, cancellationToken);
        return MapToDto(category);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var deleted = await _categoryRepository.DeleteAsync(id, cancellationToken);
        if (deleted) await _cacheService.RemoveAsync(CacheKeys.Categories, cancellationToken);
        return deleted;
    }

    private static CategoryAttribute MapFromAttributeDto(CategoryAttributeDto dto) => new()
    {
        Id = dto.Id,
        Title = dto.Title,
        Description = dto.Description,
        ValueType = dto.ValueType,
        MaxSelections = dto.MaxSelections,
        MinValue = dto.MinValue,
        MaxValue = dto.MaxValue,
        Required = dto.Required,
        Values = dto.Values.Select(v => new AttributeValue
        {
            Id = v.Id,
            Label = v.Label,
            IsDefault = v.IsDefault,
            PriceAdjustment = v.PriceAdjustment,
            PriceAdjustmentCurrency = v.PriceAdjustmentCurrency,
            ProductId = v.ProductId
        }).ToList()
    };

    private static CategoryResponseDto MapToDto(Category c) => new(
        c.Id,
        c.Name,
        c.Description,
        c.Products,
        c.MaxDiscount,
        c.MaxDiscountCurrency,
        c.Attributes.Select(a => new CategoryAttributeDto(
            a.Id,
            a.Title,
            a.Description,
            a.ValueType,
            a.Values.Select(v => new AttributeValueDto(
                v.Id,
                v.Label,
                v.IsDefault,
                v.PriceAdjustment,
                v.PriceAdjustmentCurrency,
                v.ProductId)).ToList(),
            a.MaxSelections,
            a.MinValue,
            a.MaxValue,
            a.Required)).ToList(),
        c.CreatedAt,
        c.UpdatedAt);
}

public class ProviderService : IProviderService
{
    private readonly IRepository<Provider> _providerRepository;
    private readonly ILogger<ProviderService> _logger;

    public ProviderService(IRepository<Provider> providerRepository, ILogger<ProviderService> logger)
    {
        _providerRepository = providerRepository;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ProviderResponseDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var providers = await _providerRepository.GetAllAsync(cancellationToken);
        return providers.Select(MapToDto).ToList();
    }

    public async Task<PagedResult<ProviderResponseDto>> GetPagedAsync(PagedRequest request, CancellationToken cancellationToken = default)
    {
        var result = await _providerRepository.GetPagedAsync(
            request.Page,
            request.PageSize,
            string.IsNullOrWhiteSpace(request.SearchTerm) ? null : p => p.Nombre.Contains(request.SearchTerm) || (p.Rif != null && p.Rif.Contains(request.SearchTerm)),
            cancellationToken);

        return new PagedResult<ProviderResponseDto>(
            result.Items.Select(MapToDto).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public async Task<ProviderResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var provider = await _providerRepository.GetByIdAsync(id, cancellationToken);
        return provider != null ? MapToDto(provider) : null;
    }

    public async Task<ProviderResponseDto> CreateAsync(CreateProviderDto createDto, CancellationToken cancellationToken = default)
    {
        var provider = new Provider
        {
            Nombre = createDto.Nombre.Trim(),
            Telefono = createDto.Telefono.Trim(),
            RazonSocial = createDto.RazonSocial?.Trim(),
            Rif = createDto.Rif?.Trim(),
            Direccion = createDto.Direccion?.Trim(),
            Email = createDto.Email?.Trim().ToLowerInvariant(),
            Contacto = createDto.Contacto?.Trim(),
            TipoString = createDto.Tipo,
            EstadoString = createDto.Estado,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _providerRepository.AddAsync(provider, cancellationToken);
        return MapToDto(created);
    }

    public async Task<ProviderResponseDto> UpdateAsync(string id, UpdateProviderDto updateDto, CancellationToken cancellationToken = default)
    {
        var provider = await _providerRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Proveedor no encontrado: {id}");

        if (!string.IsNullOrWhiteSpace(updateDto.Nombre)) provider.Nombre = updateDto.Nombre.Trim();
        if (!string.IsNullOrWhiteSpace(updateDto.Telefono)) provider.Telefono = updateDto.Telefono.Trim();
        if (updateDto.RazonSocial != null) provider.RazonSocial = updateDto.RazonSocial.Trim();
        if (updateDto.Rif != null) provider.Rif = updateDto.Rif.Trim();
        if (updateDto.Direccion != null) provider.Direccion = updateDto.Direccion.Trim();
        if (updateDto.Email != null) provider.Email = updateDto.Email.Trim().ToLowerInvariant();
        if (updateDto.Contacto != null) provider.Contacto = updateDto.Contacto.Trim();
        if (updateDto.Tipo != null) provider.TipoString = updateDto.Tipo;
        if (!string.IsNullOrWhiteSpace(updateDto.Estado)) provider.EstadoString = updateDto.Estado;

        provider.UpdatedAt = DateTime.UtcNow;
        await _providerRepository.UpdateAsync(provider, cancellationToken);
        return MapToDto(provider);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _providerRepository.DeleteAsync(id, cancellationToken);
    }

    private static ProviderResponseDto MapToDto(Provider p) => new(
        p.Id,
        p.Nombre,
        p.RazonSocial,
        p.Rif,
        p.Direccion,
        p.Telefono,
        p.Email,
        p.Contacto,
        p.TipoString,
        p.EstadoString,
        p.CreatedAt,
        p.UpdatedAt);
}
