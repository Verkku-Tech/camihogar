using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;

namespace Ordina.Application.Orders;

public class OrderCoreService : IOrderCoreService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderCoreService> _logger;
    private readonly INotificationService? _notificationService;
    private readonly IOrderAuditLogService? _auditLogService;

    public OrderCoreService(
        IOrderRepository orderRepository,
        ILogger<OrderCoreService> logger,
        INotificationService? notificationService = null,
        IOrderAuditLogService? auditLogService = null)
    {
        _orderRepository = orderRepository;
        _logger = logger;
        _notificationService = notificationService;
        _auditLogService = auditLogService;
    }

    public Task<OrderResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        GetByIdAsync(id, includeImages: true, cancellationToken);

    public async Task<OrderResponseDto?> GetByIdAsync(string id, bool includeImages, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken);
        return order != null ? MapToDto(order, includeImages) : null;
    }

    public Task<OrderResponseDto?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default) =>
        GetByOrderNumberAsync(orderNumber, includeImages: true, cancellationToken);

    public async Task<OrderResponseDto?> GetByOrderNumberAsync(string orderNumber, bool includeImages, CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByOrderNumberAsync(orderNumber, cancellationToken);
        return order != null ? MapToDto(order, includeImages) : null;
    }

    public async Task<PagedResult<OrderResponseDto>> GetPagedAsync(
        PagedRequest request,
        OrderQueryFilter? filter = null,
        CancellationToken cancellationToken = default)
    {
        var queryFilter = (filter ?? new OrderQueryFilter()) with { SearchTerm = request.SearchTerm };
        var result = await _orderRepository.GetFilteredPagedAsync(
            request.Page,
            request.PageSize,
            queryFilter,
            cancellationToken);

        var includeImages = queryFilter.IncludeImages;
        return new PagedResult<OrderResponseDto>(
            result.Items.Select(o => MapToDto(o, includeImages)).ToList(),
            result.TotalCount,
            result.Page,
            result.PageSize);
    }

    public Task<PagedResult<OrderResponseDto>> GetPagedAsync(
        PagedRequest request,
        string? type,
        string? status,
        CancellationToken cancellationToken = default)
    {
        return GetPagedAsync(request, new OrderQueryFilter(Type: type, Status: status), cancellationToken);
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
        await CheckAndPublishOperationalAlertsAsync(created, true, cancellationToken);
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

        await CheckAndPublishOperationalAlertsAsync(order, false, cancellationToken);
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

    public async Task<OrderResponseDto> DeclineOrderAsync(
        string id,
        string userId,
        string userName,
        string? declineReason,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido no encontrado: {id}");

        if (!string.Equals(order.TypeString, "Order", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Solo se pueden declinar pedidos (no presupuestos ni reservas).");
        }

        if (order.Products != null)
        {
            foreach (var product in order.Products)
            {
                product.LogisticStatusString = "Declinado";
            }
        }

        order.StatusString = "Declinado";
        order.DeclineReason = declineReason;
        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepository.UpdateAsync(order, cancellationToken);

        if (_auditLogService != null)
        {
            await _auditLogService.LogOrderDeclinedAsync(order, userId, userName, declineReason, cancellationToken);
        }

        _logger.LogInformation("Pedido {OrderNumber} declinado por {UserName}. Motivo: {Reason}", order.OrderNumber, userName, declineReason);
        return MapToDto(order);
    }

    public async Task<OrderResponseDto> ReactivateOrderAsync(
        string id,
        string userId,
        string userName,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido no encontrado: {id}");

        if (!string.Equals(order.StatusString, "Declinado", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Solo se pueden reactivar pedidos que estén declinados.");
        }

        if (order.Products != null)
        {
            foreach (var product in order.Products)
            {
                if (string.Equals(product.LogisticStatusString, "Declinado", StringComparison.OrdinalIgnoreCase))
                {
                    product.LogisticStatusString = "Generado";
                }
            }
        }

        order.DeclineReason = null;
        order.StatusString = "Generado";
        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepository.UpdateAsync(order, cancellationToken);

        if (_auditLogService != null)
        {
            await _auditLogService.LogOrderDeclineRevertedAsync(order, userId, userName, cancellationToken);
        }

        _logger.LogInformation("Pedido {OrderNumber} reactivado a Generado por {UserName}", order.OrderNumber, userName);
        return MapToDto(order);
    }

    public async Task<OrderResponseDto> ValidateOrderItemAsync(
        string id,
        string itemId,
        string userId,
        string userName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(itemId))
        {
            throw new ArgumentException("El ID del pedido y del ítem son requeridos");
        }

        var order = await _orderRepository.GetByIdAsync(id, cancellationToken)
            ?? await _orderRepository.GetByOrderNumberAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pedido con ID {id} no encontrado");

        var product = order.Products?.FirstOrDefault(p => p.Id == itemId)
            ?? throw new KeyNotFoundException($"Producto con ID {itemId} no encontrado en el pedido");

        var previousLogisticStatus = product.LogisticStatusString ?? "Generado";
        product.LogisticStatusString = "Validado";

        if (order.Products != null && order.Products.All(p => p.LogisticStatusString == "Validado"))
        {
            if (order.StatusString == "Generado" || order.StatusString == "Generada" || order.StatusString == "Pendiente")
            {
                order.StatusString = "Validado";
            }
        }

        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepository.UpdateAsync(order, cancellationToken);

        if (_auditLogService != null)
        {
            await _auditLogService.LogItemValidatedAsync(
                order,
                itemId,
                userId,
                userName,
                previousLogisticStatus,
                cancellationToken);
        }

        _logger.LogInformation("Ítem {ItemId} del pedido {OrderNumber} validado por {UserName}", itemId, order.OrderNumber, userName);
        return MapToDto(order);
    }

    public async Task<bool> ConciliatePaymentsAsync(List<ConciliatePaymentRequestDto> requests, CancellationToken cancellationToken = default)
    {
        if (requests == null || requests.Count == 0)
            return false;

        var requestsByOrder = requests.GroupBy(r => r.OrderId);
        bool anyUpdated = false;

        foreach (var orderGroup in requestsByOrder)
        {
            var order = await _orderRepository.GetByIdAsync(orderGroup.Key, cancellationToken);
            if (order == null) continue;

            bool orderUpdated = false;
            foreach (var req in orderGroup)
            {
                if (string.Equals(req.PaymentType, "main", StringComparison.OrdinalIgnoreCase))
                {
                    order.PaymentDetails ??= new PaymentDetails();
                    order.PaymentDetails.IsConciliated = req.IsConciliated;
                    orderUpdated = true;
                }
                else if (string.Equals(req.PaymentType, "partial", StringComparison.OrdinalIgnoreCase))
                {
                    if (order.PartialPayments != null && req.PaymentIndex >= 0 && req.PaymentIndex < order.PartialPayments.Count)
                    {
                        var payment = order.PartialPayments[req.PaymentIndex];
                        payment.PaymentDetails ??= new PaymentDetails();
                        payment.PaymentDetails.IsConciliated = req.IsConciliated;
                        orderUpdated = true;
                    }
                }
                else if (string.Equals(req.PaymentType, "mixed", StringComparison.OrdinalIgnoreCase))
                {
                    if (order.MixedPayments != null && req.PaymentIndex >= 0 && req.PaymentIndex < order.MixedPayments.Count)
                    {
                        var payment = order.MixedPayments[req.PaymentIndex];
                        payment.PaymentDetails ??= new PaymentDetails();
                        payment.PaymentDetails.IsConciliated = req.IsConciliated;
                        orderUpdated = true;
                    }
                }
            }

            if (orderUpdated)
            {
                order.UpdatedAt = DateTime.UtcNow;
                await _orderRepository.UpdateAsync(order, cancellationToken);
                anyUpdated = true;
            }
        }

        return anyUpdated;
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

    private static PartialPaymentDto MapPartialPaymentToDto(PartialPayment p, bool includeImages = true) => new(
        p.Id,
        p.Amount,
        p.Method,
        p.Date,
        includeImages && p.Images != null ? p.Images.Select(MapImageToDto).ToList() : null,
        MapPaymentDetailsToDto(p.PaymentDetails));

    private static OrderResponseDto MapToDto(Order o, bool includeImages = true) => new(
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
            includeImages && p.Images != null ? p.Images.Select(MapImageToDto).ToList() : null,
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
        o.PartialPayments?.Select(p => MapPartialPaymentToDto(p, includeImages)).ToList(),
        o.MixedPayments?.Select(p => MapPartialPaymentToDto(p, includeImages)).ToList(),
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

    public async Task<int> CheckReservationRepescaAsync(CancellationToken cancellationToken = default)
    {
        if (_notificationService == null) return 0;

        var cutoff = DateTime.UtcNow.AddDays(-30);
        var oldReservations = await _orderRepository.FindAsync(
            o => o.TypeString == "Reservation" &&
                 o.StatusString == "Pendiente" &&
                 o.CreatedAt <= cutoff,
            cancellationToken);

        int count = 0;
        foreach (var res in oldReservations)
        {
            await _notificationService.PublishAsync(new CreateNotificationDto(
                Type: "crm.repesca",
                Title: "Oportunidad de Repesca CRM",
                Message: $"La reserva {res.OrderNumber} de {res.ClientName} tiene más de 30 días sin concretarse. Contacte al cliente para cerrar la venta o liberar mercancía.",
                Severity: "info",
                Link: $"/pedidos/{res.OrderNumber}",
                TargetUserId: res.VendorId,
                TargetRoles: new List<string> { "Administrator", "Vendedor" }
            ), cancellationToken);
            count++;
        }

        return count;
    }

    private async Task CheckAndPublishOperationalAlertsAsync(Order order, bool isNewOrder, CancellationToken ct)
    {
        if (_notificationService == null) return;

        try
        {
            // 1. Despacho Express
            if (string.Equals(order.DeliveryZone, "Express", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(order.DeliveryTypeString, "express", StringComparison.OrdinalIgnoreCase) ||
                order.Observations?.Contains("Express", StringComparison.OrdinalIgnoreCase) == true)
            {
                if (isNewOrder)
                {
                    await _notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "order.express",
                        Title: "¡Despacho Express Solicitado!",
                        Message: $"El pedido {order.OrderNumber} ({order.ClientName}) fue registrado como Despacho Express prioritario.",
                        Severity: "warning",
                        Link: $"/pedidos/{order.OrderNumber}",
                        TargetRoles: new List<string> { "Administrator", "Despachador", "Warehouse Manager" }
                    ), ct);
                }
            }

            // 2. Retiro por Tienda
            if (string.Equals(order.DeliveryTypeString, "retiro_tienda", StringComparison.OrdinalIgnoreCase))
            {
                var isReady = order.StatusString == "Listo" || order.StatusString == "Listo para entrega" ||
                              order.Products.All(p => p.LogisticStatusString == "En Tienda" || p.LocationStatusString == "EN TIENDA");
                if (isReady)
                {
                    await _notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "order.pickup_store",
                        Title: "Pedido Listo para Retiro en Tienda",
                        Message: $"El pedido {order.OrderNumber} ({order.ClientName}) está listo para retiro en mostrador de tienda.",
                        Severity: "info",
                        Link: $"/pedidos/{order.OrderNumber}",
                        TargetRoles: new List<string> { "Administrator", "Store Manager", "Vendedor" }
                    ), ct);
                }
            }

            // 3. Retiro por Almacén (Terrinca)
            if (string.Equals(order.DeliveryTypeString, "retiro_almacen", StringComparison.OrdinalIgnoreCase))
            {
                var isReady = order.StatusString == "Listo" || order.StatusString == "Listo para entrega" ||
                              order.Products.All(p => p.LogisticStatusString == "En Almacén" || p.LocationStatusString == "EN ALMACEN");
                if (isReady)
                {
                    await _notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "order.pickup_warehouse",
                        Title: "Pedido Listo para Retiro en Almacén",
                        Message: $"El pedido {order.OrderNumber} ({order.ClientName}) está disponible para retiro en almacén central Terrinca.",
                        Severity: "info",
                        Link: $"/pedidos/{order.OrderNumber}",
                        TargetRoles: new List<string> { "Administrator", "Warehouse Manager", "Despachador" }
                    ), ct);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al publicar alerta operativa de pedido {OrderNumber}", order.OrderNumber);
        }
    }

    public async Task<BulkUpdateProductStatusResponseDto> BulkUpdateProductStatusAsync(
        BulkUpdateProductStatusRequestDto dto,
        string userId,
        string userName,
        string? callerRole = null,
        CancellationToken cancellationToken = default)
    {
        var response = new BulkUpdateProductStatusResponseDto();
        if (dto?.Items == null || dto.Items.Count == 0)
        {
            return response;
        }

        var itemsByOrder = dto.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.OrderId) && !string.IsNullOrWhiteSpace(i.ProductId))
            .GroupBy(i => i.OrderId)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(x => x.ProductId, x => x.DispatchOrigin));

        var action = (dto.Action ?? "").Trim().ToLowerInvariant();

        foreach (var (orderId, productMap) in itemsByOrder)
        {
            try
            {
                var order = await _orderRepository.GetByIdAsync(orderId, cancellationToken)
                    ?? await _orderRepository.GetByOrderNumberAsync(orderId, cancellationToken);
                if (order == null)
                {
                    response.ErrorCount += productMap.Count;
                    response.Errors.Add($"Pedido con ID {orderId} no encontrado.");
                    continue;
                }

                Order? oldOrder = null;
                try
                {
                    oldOrder = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<Order>(order.ToBson());
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo clonar pedido {OrderId} para auditoría previa", orderId);
                }

                bool orderMutated = false;
                int mutatedProductCount = 0;

                foreach (var product in order.Products)
                {
                    if (!productMap.ContainsKey(product.Id)) continue;

                    switch (action)
                    {
                        case "queue":
                            if (OrderStatusAggregation.NormalizeManufacturingStatus(product.ManufacturingStatusString) == "debe_fabricar")
                            {
                                product.LocationStatusString = "FABRICACION";
                                product.ManufacturingStatusString = "por_fabricar";
                                product.ManufacturingProviderId = dto.ProviderId;
                                product.ManufacturingProviderName = dto.ProviderName;
                                product.ManufacturingNotes = dto.Notes;
                                product.AvailabilityStatusString = "no_disponible";
                                orderMutated = true;
                                mutatedProductCount++;
                            }
                            break;

                        case "start":
                            if (OrderStatusAggregation.NormalizeManufacturingStatus(product.ManufacturingStatusString) == "por_fabricar")
                            {
                                product.LocationStatusString = "FABRICACION";
                                product.ManufacturingStatusString = "fabricando";
                                if (!string.IsNullOrWhiteSpace(dto.ProviderId))
                                    product.ManufacturingProviderId = dto.ProviderId;
                                if (!string.IsNullOrWhiteSpace(dto.ProviderName))
                                    product.ManufacturingProviderName = dto.ProviderName;
                                if (!string.IsNullOrWhiteSpace(dto.Notes))
                                    product.ManufacturingNotes = dto.Notes;
                                product.ManufacturingStartedAt = DateTime.UtcNow;
                                product.AvailabilityStatusString = "no_disponible";
                                product.LogisticStatusString = "Fabricándose";
                                orderMutated = true;
                                mutatedProductCount++;
                            }
                            break;

                        case "mark_fabricated":
                            if (OrderStatusAggregation.NormalizeManufacturingStatus(product.ManufacturingStatusString) == "fabricando")
                            {
                                product.LocationStatusString = "FABRICACION";
                                product.ManufacturingStatusString = "almacen_no_fabricado";
                                product.LogisticStatusString = "En Almacén";
                                product.ManufacturingCompletedAt = DateTime.UtcNow;
                                orderMutated = true;
                                mutatedProductCount++;
                            }
                            break;

                        case "refabrication":
                            if (OrderStatusAggregation.NormalizeManufacturingStatus(product.ManufacturingStatusString) == "almacen_no_fabricado")
                            {
                                var historyRecord = new RefabricationRecord
                                {
                                    Reason = dto.RefabricationReason ?? "",
                                    Date = DateTime.UtcNow,
                                    PreviousProviderId = product.ManufacturingProviderId,
                                    PreviousProviderName = product.ManufacturingProviderName,
                                    NewProviderId = dto.ProviderId,
                                    NewProviderName = dto.ProviderName
                                };
                                product.LocationStatusString = "FABRICACION";
                                product.AvailabilityStatusString = "no_disponible";
                                product.ManufacturingStatusString = "fabricando";
                                product.ManufacturingProviderId = dto.ProviderId;
                                product.ManufacturingProviderName = dto.ProviderName;
                                product.ManufacturingStartedAt = DateTime.UtcNow;
                                product.ManufacturingNotes = dto.Notes;
                                product.LogisticStatusString = "Fabricándose";
                                product.ManufacturingCompletedAt = null;
                                product.RefabricationReason = dto.RefabricationReason;
                                product.RefabricatedAt = DateTime.UtcNow;
                                product.RefabricationHistory ??= new List<RefabricationRecord>();
                                product.RefabricationHistory.Add(historyRecord);
                                orderMutated = true;
                                mutatedProductCount++;
                            }
                            break;

                        case "to_dispatch":
                            product.LocationStatusString = "EN DESPACHO";
                            product.LogisticStatusString = "En Ruta";
                            product.DispatchOrigin = productMap[product.Id];
                            orderMutated = true;
                            mutatedProductCount++;
                            break;

                        case "to_delivered":
                            product.LocationStatusString = "DESPACHADO";
                            product.LogisticStatusString = "Completado";
                            product.DeliveredAt = DateTime.UtcNow;
                            orderMutated = true;
                            mutatedProductCount++;
                            break;

                        case "to_store":
                            product.LocationStatusString = "EN TIENDA";
                            product.LogisticStatusString = "En Almacén";
                            orderMutated = true;
                            mutatedProductCount++;
                            break;

                        case "to_manufacturing":
                            product.LocationStatusString = "FABRICACION";
                            product.ManufacturingStatusString = "debe_fabricar";
                            product.LogisticStatusString = "Validado";
                            product.ManufacturingProviderId = null;
                            product.ManufacturingProviderName = null;
                            product.ManufacturingStartedAt = null;
                            product.ManufacturingCompletedAt = null;
                            orderMutated = true;
                            mutatedProductCount++;
                            break;
                    }
                }

                if (orderMutated)
                {
                    RecalculateOrderStatus(order);
                    order.UpdatedAt = DateTime.UtcNow;
                    await _orderRepository.UpdateAsync(order, cancellationToken);

                    if (_auditLogService != null && oldOrder != null)
                    {
                        await _auditLogService.LogOrderUpdatedAsync(oldOrder, order, userId, userName, cancellationToken);
                    }

                    response.SuccessCount += mutatedProductCount;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar actualización masiva para pedido {OrderId}", orderId);
                response.ErrorCount += productMap.Count;
                response.Errors.Add($"Error en pedido {orderId}: {ex.Message}");
            }
        }

        return response;
    }

    private static void RecalculateOrderStatus(Order order)
    {
        if (string.Equals(order.TypeString, "Budget", StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.TypeString, "Reservation", StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.TypeString, "PendingConfirmation", StringComparison.OrdinalIgnoreCase))
            return;

        if (OrderStatusAggregation.IsDeclinedStatus(order.StatusString))
            return;

        if (order.Products == null || order.Products.Count == 0)
            return;

        order.StatusString = OrderStatusAggregation.CalculateFromProducts(order.Products);
    }
}
