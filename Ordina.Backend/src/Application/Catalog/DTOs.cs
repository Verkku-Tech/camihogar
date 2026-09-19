namespace Ordina.Application.Catalog;

public record ProductResponseDto(
    string Id,
    string Name,
    string CategoryId,
    string Category,
    decimal Price,
    string? PriceCurrency,
    int Stock,
    string Status,
    string SKU,
    Dictionary<string, object>? Attributes,
    string? ProviderId,
    string? Description,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateProductDto(
    string Name,
    string CategoryId,
    string Category,
    decimal Price,
    int Stock,
    string SKU,
    string? PriceCurrency = "USD",
    string Status = "active",
    Dictionary<string, object>? Attributes = null,
    string? ProviderId = null,
    string? Description = null);

public record UpdateProductDto(
    string? Name = null,
    string? CategoryId = null,
    string? Category = null,
    decimal? Price = null,
    string? PriceCurrency = null,
    int? Stock = null,
    string? Status = null,
    string? SKU = null,
    Dictionary<string, object>? Attributes = null,
    string? ProviderId = null,
    string? Description = null);

public record CategoryAttributeDto(
    string Id,
    string Title,
    string Description,
    string ValueType,
    IReadOnlyList<AttributeValueDto> Values,
    int? MaxSelections = null,
    decimal? MinValue = null,
    decimal? MaxValue = null,
    bool? Required = true);

public record AttributeValueDto(
    string Id,
    string Label,
    bool? IsDefault = false,
    decimal? PriceAdjustment = null,
    string? PriceAdjustmentCurrency = "USD",
    string? ProductId = null);

public record CategoryResponseDto(
    string Id,
    string Name,
    string Description,
    int Products,
    decimal MaxDiscount,
    string? MaxDiscountCurrency,
    IReadOnlyList<CategoryAttributeDto> Attributes,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record CreateCategoryDto(
    string Name,
    string Description,
    decimal MaxDiscount = 0,
    string? MaxDiscountCurrency = "USD",
    IReadOnlyList<CategoryAttributeDto>? Attributes = null);

public record UpdateCategoryDto(
    string? Name = null,
    string? Description = null,
    decimal? MaxDiscount = null,
    string? MaxDiscountCurrency = null,
    IReadOnlyList<CategoryAttributeDto>? Attributes = null);

public record ProviderResponseDto(
    string Id,
    string Nombre,
    string? RazonSocial,
    string? Rif,
    string? Direccion,
    string Telefono,
    string? Email,
    string? Contacto,
    string? Tipo,
    string Estado,
    DateTime FechaCreacion,
    DateTime? FechaActualizacion);

public record CreateProviderDto(
    string Nombre,
    string Telefono,
    string? RazonSocial = null,
    string? Rif = null,
    string? Direccion = null,
    string? Email = null,
    string? Contacto = null,
    string? Tipo = null,
    string Estado = "activo");

public record UpdateProviderDto(
    string? Nombre = null,
    string? RazonSocial = null,
    string? Rif = null,
    string? Direccion = null,
    string? Telefono = null,
    string? Email = null,
    string? Contacto = null,
    string? Tipo = null,
    string? Estado = null);
