using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Ordina.Application.Common;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;

namespace Ordina.Application.Orders;

public class OrderCoreService : IOrderCoreService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderCoreService> _logger;

    public OrderCoreService(
        IOrderRepository orderRepository,
        ILogger<OrderCoreService> logger)
    {
        _orderRepository = orderRepository;
        _logger = logger;
    }

    public async Task<OrderResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken);
        return order != null ? MapToDto(order) : null;
    }

    public async Task<OrderResponseDto?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByOrderNumberAsync(orderNumber, cancellationToken);
        return order != null ? MapToDto(order) : null;
    }

    public async Task<PagedResult<OrderResponseDto>> GetPagedAsync(
        PagedRequest request,
        string? type = null,
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _orderRepository.GetPagedAsync(
            request.Page,
            request.PageSize,
            o => (string.IsNullOrWhiteSpace(type) || o.TypeString == type) &&
                 (string.IsNullOrWhiteSpace(status) || o.StatusString == status) &&
                 (string.IsNullOrWhiteSpace(request.SearchTerm) ||
                  o.OrderNumber.Contains(request.SearchTerm) ||
                  o.ClientName.Contains(request.SearchTerm) ||
                  o.VendorName.Contains(request.SearchTerm)),
            cancellationToken);

        return new PagedResult<OrderResponseDto>(
            result.Items.Select(MapToDto).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public async Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto, CancellationToken cancellationToken = default)
    {
        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["ClientId"] = createDto.ClientId,
            ["VendorId"] = createDto.VendorId,
            ["Module"] = "Orders"
        });

        var prefix = createDto.Type switch
        {
            "Budget" => "PRE",
            "Reservation" => "RES",
            _ => "ORD"
        };

        var orderNumber = await _orderRepository.GenerateOrderNumberAsync(prefix, cancellationToken);

        var products = createDto.Products.Select(p => new OrderProduct
        {
            Id = string.IsNullOrWhiteSpace(p.Id) ? ObjectId.GenerateNewId().ToString() : p.Id,
            Name = p.Name.Trim(),
            Price = p.Price,
            Quantity = p.Quantity,
            Total = p.Price * p.Quantity - (p.Discount ?? 0),
            Category = p.Category,
            Stock = p.Stock,
            PriceCurrency = p.PriceCurrency ?? "USD",
            Attributes = p.Attributes,
            Discount = p.Discount,
            Observations = p.Observations,
            AvailabilityStatusString = p.AvailabilityStatus ?? "disponible",
            ManufacturingStatusString = p.ManufacturingStatus ?? "debe_fabricar",
            ManufacturingProviderId = p.ManufacturingProviderId,
            ManufacturingProviderName = p.ManufacturingProviderName,
            ManufacturingStartedAt = p.ManufacturingStartedAt,
            ManufacturingCompletedAt = p.ManufacturingCompletedAt,
            ManufacturingNotes = p.ManufacturingNotes,
            LocationStatusString = p.LocationStatus ?? "EN TIENDA",
            DispatchOrigin = p.DispatchOrigin,
            LogisticStatusString = p.LogisticStatus ?? "Generado",
            SurchargeEnabled = p.SurchargeEnabled,
            SurchargeAmount = p.SurchargeAmount,
            SurchargeReason = p.SurchargeReason,
            CommissionLineSource = p.CommissionLineSource,
            CatalogProductId = p.CatalogProductId,
            Images = p.Images?.Select(MapImageFromDto).ToList()
        }).ToList();

        var subtotal = products.Sum(p => p.Total);
        var productDiscounts = products.Sum(p => p.Discount ?? 0);
        var generalDiscount = createDto.GeneralDiscountAmount ?? 
                              (createDto.GeneralDiscountPercent.HasValue ? Math.Round(subtotal * createDto.GeneralDiscountPercent.Value / 100m, 2) : 0);
        var total = Math.Max(0, subtotal + createDto.DeliveryCost - generalDiscount - createDto.AppliedStoreCreditUsd);

        var order = new Order
        {
            OrderNumber = orderNumber,
            ClientId = createDto.ClientId,
            ClientName = createDto.ClientName,
            VendorId = createDto.VendorId,
            VendorName = createDto.VendorName,
            ReferrerId = createDto.ReferrerId,
            ReferrerName = createDto.ReferrerName,
            PostventaId = createDto.PostventaId,
            PostventaName = createDto.PostventaName,
            Products = products,
            Subtotal = subtotal,
            DeliveryCost = createDto.DeliveryCost,
            Total = total,
            SubtotalBeforeDiscounts = subtotal + productDiscounts,
            ProductDiscountTotal = productDiscounts,
            GeneralDiscountAmount = generalDiscount > 0 ? generalDiscount : createDto.GeneralDiscountAmount,
            GeneralDiscountType = createDto.GeneralDiscountType ?? (createDto.GeneralDiscountPercent.HasValue ? "percent" : null),
            GeneralDiscountPercent = createDto.GeneralDiscountPercent,
            PaymentTypeString = createDto.PaymentType,
            PaymentMethod = createDto.PaymentMethod,
            AppliedStoreCreditUsd = createDto.AppliedStoreCreditUsd,
            DeliveryAddress = createDto.DeliveryAddress,
            HasDelivery = createDto.HasDelivery,
            DeliveryServices = MapDeliveryServicesFromDto(createDto.DeliveryServices),
            PaymentDetails = MapPaymentDetailsFromDto(createDto.PaymentDetails),
            PartialPayments = createDto.PartialPayments?.Select(MapPartialPaymentFromDto).ToList(),
            MixedPayments = createDto.MixedPayments?.Select(MapPartialPaymentFromDto).ToList(),
            Observations = createDto.Observations,
            SaleTypeString = createDto.SaleType,
            DeliveryTypeString = createDto.DeliveryType,
            DeliveryZone = createDto.DeliveryZone,
            TypeString = createDto.Type,
            OriginalOrderId = createDto.OriginalOrderId,
            StatusString = createDto.Type == "Order" ? "Pendiente" : "Pendiente",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _orderRepository.AddAsync(order, cancellationToken);
        _logger.LogInformation("Pedido creado: {OrderId} ({OrderNumber})", created.Id, created.OrderNumber);
        return MapToDto(created);
    }

    public async Task<OrderResponseDto> UpdateOrderAsync(
        string id,
        UpdateOrderDto updateDto,
        DateTime? expectedUpdatedAt = null,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido no encontrado: {id}");

        if (updateDto.ClientId != null) order.ClientId = updateDto.ClientId;
        if (updateDto.ClientName != null) order.ClientName = updateDto.ClientName;
        if (updateDto.Status != null) order.StatusString = updateDto.Status;
        if (updateDto.Observations != null) order.Observations = updateDto.Observations;
        if (updateDto.DispatchObservations != null) order.DispatchObservations = updateDto.DispatchObservations;
        if (updateDto.DeclineReason != null) order.DeclineReason = updateDto.DeclineReason;
        if (updateDto.PaymentType != null) order.PaymentTypeString = updateDto.PaymentType;
        if (updateDto.PaymentMethod != null) order.PaymentMethod = updateDto.PaymentMethod;
        if (updateDto.DeliveryAddress != null) order.DeliveryAddress = updateDto.DeliveryAddress;
        if (updateDto.HasDelivery.HasValue) order.HasDelivery = updateDto.HasDelivery.Value;
        if (updateDto.DeliveryCost.HasValue) order.DeliveryCost = updateDto.DeliveryCost.Value;
        if (updateDto.SaleType != null) order.SaleTypeString = updateDto.SaleType;
        if (updateDto.DeliveryType != null) order.DeliveryTypeString = updateDto.DeliveryType;
        if (updateDto.DeliveryZone != null) order.DeliveryZone = updateDto.DeliveryZone;

        if (updateDto.Products != null)
        {
            order.Products = updateDto.Products.Select(p => new OrderProduct
            {
                Id = string.IsNullOrWhiteSpace(p.Id) ? ObjectId.GenerateNewId().ToString() : p.Id,
                Name = p.Name,
                Price = p.Price,
                Quantity = p.Quantity,
                Total = p.Price * p.Quantity - (p.Discount ?? 0),
                Category = p.Category,
                Stock = p.Stock,
                Attributes = p.Attributes,
                Discount = p.Discount,
                Observations = p.Observations,
                AvailabilityStatusString = p.AvailabilityStatus,
                ManufacturingStatusString = p.ManufacturingStatus,
                ManufacturingProviderId = p.ManufacturingProviderId,
                ManufacturingProviderName = p.ManufacturingProviderName,
                ManufacturingStartedAt = p.ManufacturingStartedAt,
                ManufacturingCompletedAt = p.ManufacturingCompletedAt,
                ManufacturingNotes = p.ManufacturingNotes,
                RefabricationReason = p.RefabricationReason,
                RefabricatedAt = p.RefabricatedAt,
                LocationStatusString = p.LocationStatus,
                DispatchOrigin = p.DispatchOrigin,
                LogisticStatusString = p.LogisticStatus,
                DeliveredAt = p.DeliveredAt,
                SurchargeEnabled = p.SurchargeEnabled,
                SurchargeAmount = p.SurchargeAmount,
                SurchargeReason = p.SurchargeReason,
                CommissionLineSource = p.CommissionLineSource,
                CatalogProductId = p.CatalogProductId,
                Images = p.Images?.Select(MapImageFromDto).ToList()
            }).ToList();

            order.Subtotal = order.Products.Sum(p => p.Total);
            order.Total = Math.Max(0, order.Subtotal + order.DeliveryCost - (order.GeneralDiscountAmount ?? 0) - order.AppliedStoreCreditUsd);
        }

        if (updateDto.PaymentDetails != null)
            order.PaymentDetails = MapPaymentDetailsFromDto(updateDto.PaymentDetails);
        if (updateDto.PartialPayments != null)
            order.PartialPayments = updateDto.PartialPayments.Select(MapPartialPaymentFromDto).ToList();
        if (updateDto.MixedPayments != null)
            order.MixedPayments = updateDto.MixedPayments.Select(MapPartialPaymentFromDto).ToList();

        if (expectedUpdatedAt.HasValue)
        {
            var success = await _orderRepository.UpdateWithConcurrencyAsync(order, expectedUpdatedAt.Value, cancellationToken);
            if (!success)
            {
                _logger.LogWarning("Conflicto de concurrencia al actualizar pedido {OrderId}", id);
                throw new InvalidOperationException("CONFLICT: El pedido ha sido modificado por otro usuario o proceso. Recargue la página.");
            }
        }
        else
        {
            order.UpdatedAt = DateTime.UtcNow;
            await _orderRepository.UpdateAsync(order, cancellationToken);
        }

        return MapToDto(order);
    }

    public async Task<OrderResponseDto> ConvertBudgetToOrderAsync(ConvertBudgetDto convertDto, CancellationToken cancellationToken = default)
    {
        var budget = await _orderRepository.GetByIdAsync(convertDto.BudgetId, cancellationToken)
            ?? throw new KeyNotFoundException($"Presupuesto no encontrado: {convertDto.BudgetId}");

        if (budget.TypeString != "Budget")
        {
            throw new InvalidOperationException("Solo se pueden convertir presupuestos (tipo 'Budget').");
        }

        var orderNumber = await _orderRepository.GenerateOrderNumberAsync("ORD", cancellationToken);

        budget.ConvertedFromNumber = budget.OrderNumber;
        budget.OrderNumber = orderNumber;
        budget.TypeString = "Order";
        budget.StatusString = "Pendiente";
        budget.VendorId = convertDto.VendorId;
        budget.VendorName = convertDto.VendorName;
        budget.PaymentTypeString = convertDto.PaymentType;
        budget.PaymentMethod = convertDto.PaymentMethod;

        if (convertDto.PaymentDetails != null)
            budget.PaymentDetails = MapPaymentDetailsFromDto(convertDto.PaymentDetails);
        if (convertDto.PartialPayments != null)
            budget.PartialPayments = convertDto.PartialPayments.Select(MapPartialPaymentFromDto).ToList();

        budget.UpdatedAt = DateTime.UtcNow;
        await _orderRepository.UpdateAsync(budget, cancellationToken);

        _logger.LogInformation("Presupuesto {OldNumber} convertido a pedido {NewNumber}", budget.ConvertedFromNumber, budget.OrderNumber);
        return MapToDto(budget);
    }

    public async Task<bool> CancelOrderAsync(string id, string reason, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken);
        if (order == null) return false;

        order.StatusString = "Cancelado";
        order.DeclineReason = reason;
        order.UpdatedAt = DateTime.UtcNow;

        return await _orderRepository.UpdateAsync(order, cancellationToken);
    }

    private static ProductImage MapImageFromDto(ProductImageDto dto) => new()
    {
        Id = dto.Id,
        Base64 = dto.Base64,
        Filename = dto.Filename,
        Type = dto.Type,
        UploadedAt = dto.UploadedAt,
        Size = dto.Size
    };

    private static ProductImageDto MapImageToDto(ProductImage img) => new(
        img.Id,
        img.Base64,
        img.Filename,
        img.Type,
        img.UploadedAt,
        img.Size);

    private static DeliveryServices? MapDeliveryServicesFromDto(DeliveryServicesDto? dto)
    {
        if (dto == null) return null;
        return new DeliveryServices
        {
            DeliveryExpress = dto.DeliveryExpress != null ? new DeliveryService { Enabled = dto.DeliveryExpress.Enabled, Cost = dto.DeliveryExpress.Cost, Currency = dto.DeliveryExpress.Currency } : null,
            ServicioAcarreo = dto.ServicioAcarreo != null ? new DeliveryService { Enabled = dto.ServicioAcarreo.Enabled, Cost = dto.ServicioAcarreo.Cost, Currency = dto.ServicioAcarreo.Currency } : null,
            ServicioArmado = dto.ServicioArmado != null ? new DeliveryService { Enabled = dto.ServicioArmado.Enabled, Cost = dto.ServicioArmado.Cost, Currency = dto.ServicioArmado.Currency } : null
        };
    }

    private static DeliveryServicesDto? MapDeliveryServicesToDto(DeliveryServices? s)
    {
        if (s == null) return null;
        return new DeliveryServicesDto(
            s.DeliveryExpress != null ? new DeliveryServiceDto(s.DeliveryExpress.Enabled, s.DeliveryExpress.Cost, s.DeliveryExpress.Currency) : null,
            s.ServicioAcarreo != null ? new DeliveryServiceDto(s.ServicioAcarreo.Enabled, s.ServicioAcarreo.Cost, s.ServicioAcarreo.Currency) : null,
            s.ServicioArmado != null ? new DeliveryServiceDto(s.ServicioArmado.Enabled, s.ServicioArmado.Cost, s.ServicioArmado.Currency) : null);
    }

    private static PaymentDetails? MapPaymentDetailsFromDto(PaymentDetailsDto? dto)
    {
        if (dto == null) return null;
        return new PaymentDetails
        {
            PagomovilReference = dto.PagomovilReference,
            PagomovilBank = dto.PagomovilBank,
            PagomovilPhone = dto.PagomovilPhone,
            PagomovilDate = dto.PagomovilDate,
            TransferenciaBank = dto.TransferenciaBank,
            TransferenciaReference = dto.TransferenciaReference,
            TransferenciaDate = dto.TransferenciaDate,
            CashAmount = dto.CashAmount,
            CashCurrency = dto.CashCurrency,
            CashReceived = dto.CashReceived,
            ExchangeRate = dto.ExchangeRate,
            OriginalAmount = dto.OriginalAmount,
            OriginalCurrency = dto.OriginalCurrency,
            AccountId = dto.AccountId,
            AccountNumber = dto.AccountNumber,
            Bank = dto.Bank,
            Email = dto.Email,
            Wallet = dto.Wallet,
            Envia = dto.Envia,
            IsConciliated = dto.IsConciliated,
            CasheaFinancedPortion = dto.CasheaFinancedPortion,
            CardCommissionApplied = dto.CardCommissionApplied,
            CardCommissionAmount = dto.CardCommissionAmount
        };
    }

    private static PaymentDetailsDto? MapPaymentDetailsToDto(PaymentDetails? p)
    {
        if (p == null) return null;
        return new PaymentDetailsDto(
            p.PagomovilReference,
            p.PagomovilBank,
            p.PagomovilPhone,
            p.PagomovilDate,
            p.TransferenciaBank,
            p.TransferenciaReference,
            p.TransferenciaDate,
            p.CashAmount,
            p.CashCurrency,
            p.CashReceived,
            p.ExchangeRate,
            p.OriginalAmount,
            p.OriginalCurrency,
            p.AccountId,
            p.AccountNumber,
            p.Bank,
            p.Email,
            p.Wallet,
            p.Envia,
            p.IsConciliated,
            p.CasheaFinancedPortion,
            p.CardCommissionApplied,
            p.CardCommissionAmount);
    }

    private static PartialPayment MapPartialPaymentFromDto(PartialPaymentDto dto) => new()
    {
        Id = string.IsNullOrWhiteSpace(dto.Id) ? ObjectId.GenerateNewId().ToString() : dto.Id,
        Amount = dto.Amount,
        Method = dto.Method,
        Date = dto.Date,
        Images = dto.Images?.Select(MapImageFromDto).ToList(),
        PaymentDetails = MapPaymentDetailsFromDto(dto.PaymentDetails)
    };

    private static PartialPaymentDto MapPartialPaymentToDto(PartialPayment p) => new(
        p.Id,
        p.Amount,
        p.Method,
        p.Date,
        p.Images?.Select(MapImageToDto).ToList(),
        MapPaymentDetailsToDto(p.PaymentDetails));

    private static OrderResponseDto MapToDto(Order o) => new(
        o.Id,
        o.OrderNumber,
        o.ConvertedFromNumber,
        o.ClientId,
        o.ClientName,
        o.VendorId,
        o.VendorName,
        o.ReferrerId,
        o.ReferrerName,
        o.PostventaId,
        o.PostventaName,
        o.Products.Select(p => new OrderProductDto(
            p.Id,
            p.Name,
            p.Price,
            p.Quantity,
            p.Total,
            p.Category,
            p.Stock,
            p.PriceCurrency,
            p.Attributes,
            p.Discount,
            p.Observations,
            p.AvailabilityStatusString,
            p.ManufacturingStatusString,
            p.ManufacturingProviderId,
            p.ManufacturingProviderName,
            p.ManufacturingStartedAt,
            p.ManufacturingCompletedAt,
            p.ManufacturingNotes,
            p.RefabricationReason,
            p.RefabricatedAt,
            p.LocationStatusString,
            p.DispatchOrigin,
            p.LogisticStatusString,
            p.DeliveredAt,
            p.SurchargeEnabled,
            p.SurchargeAmount,
            p.SurchargeReason,
            p.Images?.Select(MapImageToDto).ToList(),
            p.CommissionLineSource,
            p.CatalogProductId)).ToList(),
        o.Subtotal,
        o.TaxAmount,
        o.DeliveryCost,
        o.Total,
        o.SubtotalBeforeDiscounts,
        o.ProductDiscountTotal,
        o.GeneralDiscountAmount,
        o.GeneralDiscountType,
        o.GeneralDiscountPercent,
        o.PaymentTypeString,
        o.PaymentMethod,
        o.PaymentCondition,
        MapPaymentDetailsToDto(o.PaymentDetails),
        o.PartialPayments?.Select(MapPartialPaymentToDto).ToList(),
        o.MixedPayments?.Select(MapPartialPaymentToDto).ToList(),
        o.AppliedStoreCreditUsd,
        o.DeliveryAddress,
        o.HasDelivery,
        MapDeliveryServicesToDto(o.DeliveryServices),
        o.StatusString,
        o.Observations,
        o.DispatchObservations,
        o.DeclineReason,
        o.SaleTypeString,
        o.DeliveryTypeString,
        o.DeliveryZone,
        o.BaseCurrency,
        o.TypeString,
        o.CreatedAt,
        o.UpdatedAt);
}
