using System.Linq;
using System.Text.Json;
using System.Globalization;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application;
using Ordina.Orders.Application.Commission;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.OnlineSeller;

namespace Ordina.Orders.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderAuditLogService _auditLogService;
    private readonly IClientCreditService _clientCreditService;
    private readonly IAccessPinService _accessPinService;
    private readonly IOnlineSellerVisibilityService _onlineSellerVisibility;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        IOrderAuditLogService auditLogService,
        IClientCreditService clientCreditService,
        IAccessPinService accessPinService,
        IOnlineSellerVisibilityService onlineSellerVisibility,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _auditLogService = auditLogService;
        _clientCreditService = clientCreditService;
        _accessPinService = accessPinService;
        _onlineSellerVisibility = onlineSellerVisibility;
        _logger = logger;
    }

    private async Task<IReadOnlyCollection<string>?> ResolveTeamFilterAsync(string? callerRole) =>
        await _onlineSellerVisibility.ResolveTeamFilterIdsAsync(callerRole);

    private async Task<bool> IsOrderVisibleToCallerAsync(Order order, string? callerRole)
    {
        if (!OrderOnlineSellerVisibility.IsOnlineSellerRole(callerRole))
            return true;

        var ids = await _onlineSellerVisibility.GetOnlineSellerUserIdsAsync();
        return OrderOnlineSellerVisibility.IsVisibleToTeam(order, ids);
    }

    private static void EnsureOnlineSellerCanMutate(Order order, string userId, string? callerRole)
    {
        if (!OrderOnlineSellerVisibility.IsOnlineSellerRole(callerRole))
            return;

        if (!OrderOnlineSellerVisibility.IsOwnedBySeller(order, userId))
            throw new UnauthorizedAccessException(
                "No autorizado a modificar pedidos de otros vendedores online.");
    }

    private static bool IsAdministratorOrSuperAdministrator(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        return string.Equals(role, "Super Administrator", StringComparison.Ordinal)
            || string.Equals(role, "Administrator", StringComparison.Ordinal);
    }

    private static string NormalizeDispatchField(string? value) => (value ?? "").Trim();

    /// <summary>
    /// Detecta cambios en ubicación / logística de líneas que corresponden a despacho (ruta, entrega, devolución a almacén).
    /// </summary>
    private static bool DispatchLogisticsWouldChange(Order existing, UpdateOrderDto dto)
    {
        if (dto.Products == null) return false;
        foreach (var p in dto.Products)
        {
            var ex = existing.Products.FirstOrDefault(x => x.Id == p.Id);
            if (ex == null) continue;
            if (!string.Equals(
                    NormalizeDispatchField(ex.LocationStatus),
                    NormalizeDispatchField(p.LocationStatus),
                    StringComparison.OrdinalIgnoreCase))
                return true;
            if (!string.Equals(
                    NormalizeDispatchField(ex.LogisticStatus),
                    NormalizeDispatchField(p.LogisticStatus),
                    StringComparison.OrdinalIgnoreCase))
                return true;
            var exDel = ex.DeliveredAt.HasValue;
            var dtoDel = p.DeliveredAt.HasValue;
            if (exDel != dtoDel) return true;
            if (exDel && dtoDel && ex.DeliveredAt!.Value != p.DeliveredAt!.Value) return true;
        }

        return false;
    }

    public async Task<IEnumerable<OrderResponseDto>> GetAllOrdersAsync(string? callerRole = null)
    {
        try
        {
            var teamFilter = await ResolveTeamFilterAsync(callerRole);
            var orders = await _orderRepository.GetAllAsync(teamFilter);
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos");
            throw;
        }
    }

    public async Task<PagedOrdersResponseDto> GetOrdersPagedAsync(
        int page = 1,
        int pageSize = 50,
        DateTime? since = null,
        string? callerRole = null)
    {
        try
        {
            // Validar parámetros
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 50;
            if (pageSize > 100) pageSize = 100; // Límite máximo para evitar sobrecarga

            var teamFilter = await ResolveTeamFilterAsync(callerRole);
            var (orders, totalCount) = await _orderRepository.GetPagedAsync(
                page, pageSize, since, teamFilter);

            return new PagedOrdersResponseDto
            {
                Orders = orders.Select(MapToDto),
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                ServerTimestamp = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos paginados (page: {Page}, pageSize: {PageSize}, since: {Since})",
                page, pageSize, since);
            throw;
        }
    }

    public async Task<IEnumerable<OrderResponseDto>> GetOrdersByClientIdAsync(
        string clientId,
        string? callerRole = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(clientId));
            }

            var teamFilter = await ResolveTeamFilterAsync(callerRole);
            var orders = await _orderRepository.GetByClientIdAsync(clientId, teamFilter);
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por cliente {ClientId}", clientId);
            throw;
        }
    }

    public async Task<IEnumerable<OrderResponseDto>> GetOrdersByStatusAsync(
        string status,
        string? callerRole = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                throw new ArgumentException("El estado es requerido", nameof(status));
            }

            var teamFilter = await ResolveTeamFilterAsync(callerRole);
            var orders = await _orderRepository.GetByStatusAsync(status, teamFilter);
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por estado {Status}", status);
            throw;
        }
    }

    public async Task<OrderResponseDto?> GetOrderByIdAsync(string id, string? callerRole = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del pedido es requerido", nameof(id));
            }

            var order = await _orderRepository.GetByIdAsync(id);
            if (order == null)
                return null;

            if (!await IsOrderVisibleToCallerAsync(order, callerRole))
                return null;

            return MapToDto(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<OrderResponseDto?> GetOrderByOrderNumberAsync(
        string orderNumber,
        string? callerRole = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(orderNumber))
            {
                throw new ArgumentException("El número de pedido es requerido", nameof(orderNumber));
            }

            var order = await _orderRepository.GetByOrderNumberAsync(orderNumber);
            if (order == null)
                return null;

            if (!await IsOrderVisibleToCallerAsync(order, callerRole))
                return null;

            return MapToDto(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedido con número {OrderNumber}", orderNumber);
            throw;
        }
    }

    public async Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto, string userId, string userName)
    {
        try
        {
            var isBudget = string.Equals(createDto.Type, "Budget", StringComparison.Ordinal);
            var isReservation = OrderDocumentTypes.IsReservationType(createDto.Type);
            var requiresPayment = !isBudget && !isReservation;
            if (requiresPayment)
            {
                if (string.IsNullOrWhiteSpace(createDto.PaymentType))
                    throw new ArgumentException("El tipo de pago es requerido para pedidos", nameof(createDto.PaymentType));
                if (string.IsNullOrWhiteSpace(createDto.PaymentMethod))
                    throw new ArgumentException("El método de pago es requerido para pedidos", nameof(createDto.PaymentMethod));
            }

            var typeForCount = isBudget ? "Budget" : isReservation ? OrderDocumentTypes.Reservation : "Order";
            var prefix = isBudget ? "PRE-" : isReservation ? OrderDocumentTypes.ReservationPrefix : "ORD-";
            var orderNumber = await AllocateNextOrderNumberAsync(typeForCount, prefix);

            var paymentType = isBudget || isReservation
                ? (string.IsNullOrWhiteSpace(createDto.PaymentType) ? "N/A" : createDto.PaymentType!)
                : createDto.PaymentType!;
            var paymentMethod = isBudget || isReservation
                ? (string.IsNullOrWhiteSpace(createDto.PaymentMethod) ? "N/A" : createDto.PaymentMethod!)
                : createDto.PaymentMethod!;

            var mappedProducts = createDto.Products.Select(MapProductFromDto).ToList();

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
                Products = mappedProducts,
                Subtotal = createDto.Subtotal,
                TaxAmount = createDto.TaxAmount,
                DeliveryCost = createDto.DeliveryCost,
                Total = createDto.Total,
                SubtotalBeforeDiscounts = createDto.SubtotalBeforeDiscounts,
                ProductDiscountTotal = createDto.ProductDiscountTotal,
                GeneralDiscountAmount = createDto.GeneralDiscountAmount,
                GeneralDiscountType = createDto.GeneralDiscountType,
                GeneralDiscountPercent = createDto.GeneralDiscountPercent,
                PaymentType = paymentType,
                PaymentMethod = paymentMethod,
                PaymentCondition = createDto.PaymentCondition,
                PaymentDetails = createDto.PaymentDetails != null ? MapPaymentDetailsFromDto(createDto.PaymentDetails) : null,
                PartialPayments = createDto.PartialPayments?.Select(MapPartialPaymentFromDto).ToList(),
                MixedPayments = createDto.MixedPayments?.Select(MapPartialPaymentFromDto).ToList(),
                DeliveryAddress = createDto.DeliveryAddress,
                HasDelivery = createDto.HasDelivery,
                DeliveryServices = createDto.DeliveryServices != null ? MapDeliveryServicesFromDto(createDto.DeliveryServices) : null,
                Status = createDto.Status,
                ProductMarkups = createDto.ProductMarkups,
                CreateSupplierOrder = createDto.CreateSupplierOrder,
                Observations = createDto.Observations,
                DispatchObservations = createDto.DispatchObservations,
                SaleType = createDto.SaleType,
                DeliveryType = createDto.DeliveryType,
                DeliveryZone = createDto.DeliveryZone,
                ExchangeRatesAtCreation = createDto.ExchangeRatesAtCreation != null ? MapExchangeRatesFromDto(createDto.ExchangeRatesAtCreation) : null,
                BaseCurrency = string.IsNullOrWhiteSpace(createDto.BaseCurrency) ? null : createDto.BaseCurrency.Trim(),
                Type = isReservation ? OrderDocumentTypes.Reservation : createDto.Type,
                OriginalProducts = isReservation ? CloneOrderProducts(mappedProducts) : null,
                AppliedStoreCreditUsd = requiresPayment && createDto.AppliedStoreCreditUsd is > 0
                    ? Math.Round(createDto.AppliedStoreCreditUsd.Value, 2, MidpointRounding.AwayFromZero)
                    : 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            NormalizeGeneralDiscountFields(order);

            RecalculateOrderStatus(order);
            var createdOrder = await CreateOrderAndAuditAsync(order, typeForCount, prefix, userId, userName);

            if (requiresPayment && createdOrder.AppliedStoreCreditUsd > 0)
            {
                await _clientCreditService.DebitAppliedCreditForNewOrderAsync(createdOrder, userId, userName);
            }

            return MapToDto(createdOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido");
            throw;
        }
    }

    public async Task<OrderResponseDto> ConfirmPendingOrderAsync(
        string pendingOrderId,
        ConfirmOrderDto confirmDto,
        string userId,
        string userName,
        string? callerRole = null)
    {
        if (string.IsNullOrWhiteSpace(pendingOrderId))
            throw new ArgumentException("El ID de la reserva es requerido", nameof(pendingOrderId));

        var pcf = await _orderRepository.GetByIdAsync(pendingOrderId);
        if (pcf == null)
            throw new KeyNotFoundException($"Pedido con ID {pendingOrderId} no encontrado");

        if (!OrderDocumentTypes.IsReservationType(pcf.Type))
            throw new ArgumentException("El documento no es una reserva.");

        if (!OrderDocumentTypes.IsActiveReservationStatus(pcf.Status))
            throw new ArgumentException($"Solo se pueden confirmar reservas en estado «{OrderDocumentTypes.ReservationStatus}». Estado actual: {pcf.Status}");

        var baseline = pcf.OriginalProducts is { Count: > 0 } ? pcf.OriginalProducts : pcf.Products;
        List<OrderProduct> finalProducts;
        if (confirmDto.Products != null && confirmDto.Products.Count > 0)
            finalProducts = confirmDto.Products.Select(MapProductFromDto).ToList();
        else
            finalProducts = CloneOrderProducts(pcf.Products);

        EnrichProductsFromReservationBaseline(finalProducts, baseline);

        // PIN DESHABILITADO TEMPORALMENTE - vendedores de tienda pueden confirmar reservas con cambios de productos sin PIN
        // var structureChanged = HasProductStructureChanges(baseline, finalProducts);
        // if (structureChanged && !IsAdministratorOrSuperAdministrator(callerRole))
        // {
        //     var hasSession = await _accessPinService.HasActiveSessionAsync(pendingOrderId, userId);
        //     if (!hasSession)
        //         throw new ArgumentException(
        //             "Se requiere PIN de acceso para modificar productos de la reserva. Solicita un PIN al administrador.");
        // }

        CommissionLineClassifier.ClassifyLines(baseline, finalProducts);

        var onlineVendorId = !string.IsNullOrWhiteSpace(pcf.ReferrerId) ? pcf.ReferrerId! : pcf.VendorId;
        var onlineVendorName = !string.IsNullOrWhiteSpace(pcf.ReferrerName) ? pcf.ReferrerName! : pcf.VendorName;
        var commissionStructureChanged = CommissionLineClassifier.HasAnyNonUnchangedLine(finalProducts);

        string vendorId;
        string vendorName;
        string? referrerId;
        string? referrerName;
        if (commissionStructureChanged)
        {
            vendorId = confirmDto.StoreVendorId;
            vendorName = confirmDto.StoreVendorName;
            referrerId = onlineVendorId;
            referrerName = onlineVendorName;
        }
        else
        {
            vendorId = pcf.VendorId;
            vendorName = pcf.VendorName;
            referrerId = null;
            referrerName = null;
        }

        var partialPayments = confirmDto.PartialPayments?.Select(MapPartialPaymentFromDto).ToList();
        var mixedPayments = confirmDto.MixedPayments?.Select(MapPartialPaymentFromDto).ToList();
        var partialCount = partialPayments?.Count ?? 0;
        var mixedCount = mixedPayments?.Count ?? 0;
        var multi = partialCount > 1 || mixedCount > 1;

        var paymentMethodResolved = confirmDto.PaymentMethod;
        if (multi && string.IsNullOrWhiteSpace(paymentMethodResolved))
            paymentMethodResolved = "Mixto";

        PaymentDetails? paymentDetailsEntity = confirmDto.PaymentDetails != null
            ? MapPaymentDetailsFromDto(confirmDto.PaymentDetails)
            : null;
        if (paymentDetailsEntity == null && !multi && partialCount == 1 && partialPayments != null &&
            partialPayments[0].PaymentDetails != null)
            paymentDetailsEntity = partialPayments[0].PaymentDetails;
        if (paymentDetailsEntity == null && !multi && mixedCount == 1 && mixedPayments != null &&
            mixedPayments[0].PaymentDetails != null)
            paymentDetailsEntity = mixedPayments[0].PaymentDetails;

        var newOrder = new Order
        {
            ConvertedFromNumber = pcf.OrderNumber,
            ClientId = pcf.ClientId,
            ClientName = pcf.ClientName,
            VendorId = vendorId,
            VendorName = vendorName,
            ReferrerId = referrerId,
            ReferrerName = referrerName,
            PostventaId = confirmDto.PostventaId ?? pcf.PostventaId,
            PostventaName = confirmDto.PostventaName ?? pcf.PostventaName,
            Products = finalProducts,
            Subtotal = confirmDto.Subtotal ?? pcf.Subtotal,
            TaxAmount = confirmDto.TaxAmount ?? pcf.TaxAmount,
            DeliveryCost = confirmDto.DeliveryCost ?? pcf.DeliveryCost,
            Total = confirmDto.Total ?? pcf.Total,
            SubtotalBeforeDiscounts = confirmDto.SubtotalBeforeDiscounts ?? pcf.SubtotalBeforeDiscounts,
            ProductDiscountTotal = confirmDto.ProductDiscountTotal ?? pcf.ProductDiscountTotal,
            GeneralDiscountAmount = confirmDto.GeneralDiscountAmount ?? pcf.GeneralDiscountAmount,
            GeneralDiscountType = confirmDto.GeneralDiscountType ?? pcf.GeneralDiscountType,
            GeneralDiscountPercent = confirmDto.GeneralDiscountPercent ?? pcf.GeneralDiscountPercent,
            PaymentType = confirmDto.PaymentType,
            PaymentMethod = paymentMethodResolved,
            PaymentCondition = confirmDto.PaymentCondition,
            PaymentDetails = paymentDetailsEntity,
            PartialPayments = multi ? new List<PartialPayment>() : partialPayments,
            MixedPayments = multi ? mixedPayments : null,
            DeliveryAddress = confirmDto.DeliveryAddress ?? pcf.DeliveryAddress,
            HasDelivery = confirmDto.HasDelivery ?? pcf.HasDelivery,
            DeliveryServices = confirmDto.DeliveryServices != null ? MapDeliveryServicesFromDto(confirmDto.DeliveryServices) : pcf.DeliveryServices,
            Status = "Generado",
            ProductMarkups = confirmDto.ProductMarkups ?? pcf.ProductMarkups,
            CreateSupplierOrder = confirmDto.CreateSupplierOrder ?? pcf.CreateSupplierOrder,
            Observations = confirmDto.Observations ?? pcf.Observations,
            SaleType = confirmDto.SaleType ?? pcf.SaleType,
            DeliveryType = confirmDto.DeliveryType ?? pcf.DeliveryType,
            DeliveryZone = confirmDto.DeliveryZone ?? pcf.DeliveryZone,
            ExchangeRatesAtCreation = confirmDto.ExchangeRatesAtCreation != null
                ? MapExchangeRatesFromDto(confirmDto.ExchangeRatesAtCreation)
                : pcf.ExchangeRatesAtCreation,
            BaseCurrency = !string.IsNullOrWhiteSpace(confirmDto.BaseCurrency)
                ? confirmDto.BaseCurrency.Trim()
                : pcf.BaseCurrency,
            Type = "Order",
            OriginalOrderId = pcf.Id,
            OriginalProducts = CloneOrderProducts(baseline),
            SourceReservationVendorId = onlineVendorId,
            SourceReservationVendorName = onlineVendorName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        newOrder.OrderNumber = await AllocateNextOrderNumberAsync("Order", "ORD-");

        RecalculateOrderStatus(newOrder);
        var created = await CreateOrderAndAuditAsync(newOrder, "Order", "ORD-", userId, userName);

        var pcfBefore = OrderDeepClone.Clone(pcf);
        pcf.Status = "Convertido";
        pcf.UpdatedAt = DateTime.UtcNow;
        var updatedPcf = await _orderRepository.UpdateAsync(pcf);
        await _auditLogService.LogOrderUpdatedAsync(pcfBefore, updatedPcf, userId, userName);

        return MapToDto(created);
    }

    public async Task<OrderResponseDto> ConvertBudgetToOrderAsync(string budgetId, ConvertBudgetToOrderDto dto, string userId, string userName)
    {
        if (string.IsNullOrWhiteSpace(budgetId))
            throw new ArgumentException("El ID del presupuesto es requerido", nameof(budgetId));

        var budget = await _orderRepository.GetByIdAsync(budgetId);
        if (budget == null)
            throw new KeyNotFoundException($"Presupuesto con ID {budgetId} no encontrado");

        if (!string.Equals(budget.Type, "Budget", StringComparison.Ordinal))
            throw new ArgumentException("El documento no es un presupuesto (Budget).");

        if (string.Equals(budget.Status, "Convertido", StringComparison.Ordinal))
            throw new ArgumentException("Este presupuesto ya fue convertido a pedido.");

        List<OrderProduct> finalProducts;
        if (dto.Products != null && dto.Products.Count > 0)
            finalProducts = dto.Products.Select(MapProductFromDto).ToList();
        else
            finalProducts = CloneOrderProducts(budget.Products);

        if (string.IsNullOrWhiteSpace(dto.PaymentType))
            throw new ArgumentException("El tipo de pago es requerido para convertir a pedido", nameof(dto.PaymentType));
        if (string.IsNullOrWhiteSpace(dto.PaymentMethod))
            throw new ArgumentException("El método de pago es requerido para convertir a pedido", nameof(dto.PaymentMethod));

        var partialPayments = dto.PartialPayments?.Select(MapPartialPaymentFromDto).ToList();
        var mixedPayments = dto.MixedPayments?.Select(MapPartialPaymentFromDto).ToList();
        var partialCount = partialPayments?.Count ?? 0;
        var mixedCount = mixedPayments?.Count ?? 0;
        var multi = partialCount > 1 || mixedCount > 1;

        var paymentMethodResolved = dto.PaymentMethod;
        if (multi && string.IsNullOrWhiteSpace(paymentMethodResolved))
            paymentMethodResolved = "Mixto";

        PaymentDetails? paymentDetailsEntity = dto.PaymentDetails != null
            ? MapPaymentDetailsFromDto(dto.PaymentDetails)
            : null;
        if (paymentDetailsEntity == null && !multi && partialCount == 1 && partialPayments != null &&
            partialPayments[0].PaymentDetails != null)
            paymentDetailsEntity = partialPayments[0].PaymentDetails;
        if (paymentDetailsEntity == null && !multi && mixedCount == 1 && mixedPayments != null &&
            mixedPayments[0].PaymentDetails != null)
            paymentDetailsEntity = mixedPayments[0].PaymentDetails;

        var newOrder = new Order
        {
            ConvertedFromNumber = budget.OrderNumber,
            ClientId = budget.ClientId,
            ClientName = budget.ClientName,
            VendorId = budget.VendorId,
            VendorName = budget.VendorName,
            ReferrerId = budget.ReferrerId,
            ReferrerName = budget.ReferrerName,
            PostventaId = dto.PostventaId ?? budget.PostventaId,
            PostventaName = dto.PostventaName ?? budget.PostventaName,
            Products = finalProducts,
            Subtotal = dto.Subtotal ?? budget.Subtotal,
            TaxAmount = dto.TaxAmount ?? budget.TaxAmount,
            DeliveryCost = dto.DeliveryCost ?? budget.DeliveryCost,
            Total = dto.Total ?? budget.Total,
            SubtotalBeforeDiscounts = dto.SubtotalBeforeDiscounts ?? budget.SubtotalBeforeDiscounts,
            ProductDiscountTotal = dto.ProductDiscountTotal ?? budget.ProductDiscountTotal,
            GeneralDiscountAmount = dto.GeneralDiscountAmount ?? budget.GeneralDiscountAmount,
            GeneralDiscountType = dto.GeneralDiscountType ?? budget.GeneralDiscountType,
            GeneralDiscountPercent = dto.GeneralDiscountPercent ?? budget.GeneralDiscountPercent,
            PaymentType = dto.PaymentType,
            PaymentMethod = paymentMethodResolved,
            PaymentCondition = dto.PaymentCondition,
            PaymentDetails = paymentDetailsEntity,
            PartialPayments = multi ? new List<PartialPayment>() : partialPayments,
            MixedPayments = multi ? mixedPayments : null,
            DeliveryAddress = dto.DeliveryAddress ?? budget.DeliveryAddress,
            HasDelivery = dto.HasDelivery ?? budget.HasDelivery,
            DeliveryServices = dto.DeliveryServices != null ? MapDeliveryServicesFromDto(dto.DeliveryServices) : budget.DeliveryServices,
            Status = "Generado",
            ProductMarkups = dto.ProductMarkups ?? budget.ProductMarkups,
            CreateSupplierOrder = dto.CreateSupplierOrder ?? budget.CreateSupplierOrder,
            Observations = dto.Observations ?? budget.Observations,
            SaleType = dto.SaleType ?? budget.SaleType,
            DeliveryType = dto.DeliveryType ?? budget.DeliveryType,
            DeliveryZone = dto.DeliveryZone ?? budget.DeliveryZone,
            ExchangeRatesAtCreation = dto.ExchangeRatesAtCreation != null
                ? MapExchangeRatesFromDto(dto.ExchangeRatesAtCreation)
                : budget.ExchangeRatesAtCreation,
            Type = "Order",
            OriginalOrderId = budget.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        newOrder.OrderNumber = await AllocateNextOrderNumberAsync("Order", "ORD-");

        RecalculateOrderStatus(newOrder);
        var created = await CreateOrderAndAuditAsync(newOrder, "Order", "ORD-", userId, userName);

        var budgetBefore = OrderDeepClone.Clone(budget);
        budget.Status = "Convertido";
        budget.UpdatedAt = DateTime.UtcNow;
        var updatedBudget = await _orderRepository.UpdateAsync(budget);
        await _auditLogService.LogOrderUpdatedAsync(budgetBefore, updatedBudget, userId, userName);

        return MapToDto(created);
    }

    public async Task<OrderResponseDto> UpdateOrderAsync(
        string id,
        UpdateOrderDto updateDto,
        string userId,
        string userName,
        string? callerRole = null,
        bool callerHasDispatchUpdate = false)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del pedido es requerido", nameof(id));
            }

            var existingOrder = await _orderRepository.GetByIdAsync(id);
            if (existingOrder == null)
            {
                throw new KeyNotFoundException($"Pedido con ID {id} no encontrado");
            }

            EnsureOnlineSellerCanMutate(existingOrder, userId, callerRole);

            if (DispatchLogisticsWouldChange(existingOrder, updateDto) &&
                !IsAdministratorOrSuperAdministrator(callerRole) &&
                !callerHasDispatchUpdate)
            {
                throw new UnauthorizedAccessException(
                    "No autorizado a modificar la logística de despacho (ubicación o estado de entrega de productos).");
            }

            var oldSnapshot = OrderDeepClone.Clone(existingOrder);
            var previousAppliedStoreCreditUsd = existingOrder.AppliedStoreCreditUsd;

            // Actualizar campos si están presentes
            if (!string.IsNullOrEmpty(updateDto.ClientId))
                existingOrder.ClientId = updateDto.ClientId;
            if (!string.IsNullOrEmpty(updateDto.ClientName))
                existingOrder.ClientName = updateDto.ClientName;
            if (!string.IsNullOrEmpty(updateDto.VendorId))
                existingOrder.VendorId = updateDto.VendorId;
            if (!string.IsNullOrEmpty(updateDto.VendorName))
                existingOrder.VendorName = updateDto.VendorName;
            if (updateDto.ReferrerId != null)
                existingOrder.ReferrerId = updateDto.ReferrerId;
            if (updateDto.ReferrerName != null)
                existingOrder.ReferrerName = updateDto.ReferrerName;
            if (updateDto.PostventaId != null)
                existingOrder.PostventaId = updateDto.PostventaId;
            if (updateDto.PostventaName != null)
                existingOrder.PostventaName = updateDto.PostventaName;
            if (updateDto.Products != null)
                existingOrder.Products = updateDto.Products.Select(MapProductFromDto).ToList();
            if (updateDto.Subtotal.HasValue)
                existingOrder.Subtotal = updateDto.Subtotal.Value;
            if (updateDto.TaxAmount.HasValue)
                existingOrder.TaxAmount = updateDto.TaxAmount.Value;
            if (updateDto.DeliveryCost.HasValue)
                existingOrder.DeliveryCost = updateDto.DeliveryCost.Value;
            if (updateDto.Total.HasValue)
                existingOrder.Total = updateDto.Total.Value;
            if (updateDto.SubtotalBeforeDiscounts.HasValue)
                existingOrder.SubtotalBeforeDiscounts = updateDto.SubtotalBeforeDiscounts;
            if (updateDto.ProductDiscountTotal.HasValue)
                existingOrder.ProductDiscountTotal = updateDto.ProductDiscountTotal;
            if (updateDto.GeneralDiscountAmount.HasValue)
            {
                existingOrder.GeneralDiscountAmount = updateDto.GeneralDiscountAmount;
                if ((existingOrder.GeneralDiscountAmount ?? 0m) <= 0m)
                {
                    existingOrder.GeneralDiscountType = null;
                    existingOrder.GeneralDiscountPercent = null;
                }
                else if (!string.IsNullOrWhiteSpace(updateDto.GeneralDiscountType))
                {
                    var t = updateDto.GeneralDiscountType.Trim().ToLowerInvariant();
                    if (t is "porcentaje" or "monto")
                    {
                        existingOrder.GeneralDiscountType = t;
                        existingOrder.GeneralDiscountPercent = t == "porcentaje" && updateDto.GeneralDiscountPercent.HasValue
                            ? updateDto.GeneralDiscountPercent
                            : null;
                    }
                }
            }
            if (!string.IsNullOrEmpty(updateDto.PaymentType))
                existingOrder.PaymentType = updateDto.PaymentType;
            if (!string.IsNullOrEmpty(updateDto.PaymentMethod))
                existingOrder.PaymentMethod = updateDto.PaymentMethod;
            if (updateDto.PaymentCondition != null)
                existingOrder.PaymentCondition = updateDto.PaymentCondition;
            if (updateDto.PaymentDetails != null)
                existingOrder.PaymentDetails = MapPaymentDetailsFromDto(updateDto.PaymentDetails);
            if (updateDto.PartialPayments != null)
                existingOrder.PartialPayments = updateDto.PartialPayments.Select(MapPartialPaymentFromDto).ToList();
            if (updateDto.MixedPayments != null)
                existingOrder.MixedPayments = updateDto.MixedPayments.Select(MapPartialPaymentFromDto).ToList();
            if (updateDto.DeliveryAddress != null)
                existingOrder.DeliveryAddress = updateDto.DeliveryAddress;
            if (updateDto.HasDelivery.HasValue)
                existingOrder.HasDelivery = updateDto.HasDelivery.Value;
            if (updateDto.DeliveryServices != null)
                existingOrder.DeliveryServices = MapDeliveryServicesFromDto(updateDto.DeliveryServices);
            if (!string.IsNullOrEmpty(updateDto.Status))
                existingOrder.Status = updateDto.Status;
            if (updateDto.ProductMarkups != null)
                existingOrder.ProductMarkups = updateDto.ProductMarkups;
            if (updateDto.CreateSupplierOrder.HasValue)
                existingOrder.CreateSupplierOrder = updateDto.CreateSupplierOrder;
            if (updateDto.Observations != null)
                existingOrder.Observations = updateDto.Observations;
            if (updateDto.DispatchObservations != null)
                existingOrder.DispatchObservations = updateDto.DispatchObservations;
            if (!string.IsNullOrEmpty(updateDto.SaleType))
                existingOrder.SaleType = updateDto.SaleType;
            if (!string.IsNullOrEmpty(updateDto.DeliveryType))
                existingOrder.DeliveryType = updateDto.DeliveryType;
            if (!string.IsNullOrEmpty(updateDto.DeliveryZone))
                existingOrder.DeliveryZone = updateDto.DeliveryZone;
            if (updateDto.ExchangeRatesAtCreation != null)
                existingOrder.ExchangeRatesAtCreation = MapExchangeRatesFromDto(updateDto.ExchangeRatesAtCreation);
            if (!string.IsNullOrWhiteSpace(updateDto.BaseCurrency))
                existingOrder.BaseCurrency = updateDto.BaseCurrency.Trim();
            if (!string.IsNullOrEmpty(updateDto.Type))
                existingOrder.Type = updateDto.Type;
            if (updateDto.AppliedStoreCreditUsd.HasValue)
                existingOrder.AppliedStoreCreditUsd = Math.Round(updateDto.AppliedStoreCreditUsd.Value, 2, MidpointRounding.AwayFromZero);

            existingOrder.UpdatedAt = DateTime.UtcNow;

            RecalculateOrderStatus(existingOrder);
            await _clientCreditService.SyncAppliedCreditAfterOrderUpdateAsync(
                existingOrder,
                previousAppliedStoreCreditUsd,
                userId,
                userName);
            var updatedOrder = await _orderRepository.UpdateAsync(existingOrder);
            await _auditLogService.LogOrderUpdatedAsync(oldSnapshot, updatedOrder, userId, userName);
            return MapToDto(updatedOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<OrderResponseDto> ValidateOrderItemAsync(string id, string itemId, string userId, string userName)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(itemId))
            {
                throw new ArgumentException("El ID del pedido y del ítem son requeridos");
            }

            var existingOrder = await _orderRepository.GetByIdAsync(id);
            if (existingOrder == null)
            {
                throw new KeyNotFoundException($"Pedido con ID {id} no encontrado");
            }

            var product = existingOrder.Products.FirstOrDefault(p => p.Id == itemId);
            if (product == null)
            {
                throw new KeyNotFoundException($"Producto con ID {itemId} no encontrado en el pedido");
            }

            product.LogisticStatus = "Validado";

            existingOrder.UpdatedAt = DateTime.UtcNow;

            RecalculateOrderStatus(existingOrder);
            var updatedOrder = await _orderRepository.UpdateAsync(existingOrder);
            await _auditLogService.LogItemValidatedAsync(updatedOrder, itemId, userId, userName);
            return MapToDto(updatedOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al validar ítem {ItemId} del pedido con ID {OrderId}", itemId, id);
            throw;
        }
    }

    public async Task<bool> DeleteOrderAsync(
        string id,
        string userId,
        string userName,
        string? callerRole = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del pedido es requerido", nameof(id));
            }

            var existing = await _orderRepository.GetByIdAsync(id);
            if (existing == null)
            {
                return false;
            }

            EnsureOnlineSellerCanMutate(existing, userId, callerRole);

            await _auditLogService.LogOrderDeletedAsync(existing, userId, userName);
            return await _orderRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<bool> OrderExistsAsync(string id)
    {
        try
        {
            return await _orderRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<bool> OrderNumberExistsAsync(string orderNumber)
    {
        try
        {
            return await _orderRepository.OrderNumberExistsAsync(orderNumber);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del número de pedido {OrderNumber}", orderNumber);
            throw;
        }
    }

    public async Task<bool> ConciliatePaymentsAsync(List<ConciliatePaymentRequestDto> requests, string userId, string userName)
    {
        try
        {
            if (requests == null || !requests.Any())
                return false;

            // Group requests by OrderId to minimize DB updates
            var requestsByOrder = requests.GroupBy(r => r.OrderId);
            bool anyUpdated = false;

            foreach (var orderGroup in requestsByOrder)
            {
                var order = await _orderRepository.GetByIdAsync(orderGroup.Key);
                if (order == null) continue;

                var orderBefore = OrderDeepClone.Clone(order);

                bool orderUpdated = false;
                foreach (var req in orderGroup)
                {
                    if (req.PaymentType == "main")
                    {
                        if (order.PaymentDetails != null)
                        {
                            order.PaymentDetails.IsConciliated = req.IsConciliated;
                            orderUpdated = true;
                        }
                    }
                    else if (req.PaymentType == "partial")
                    {
                        if (order.PartialPayments != null && req.PaymentIndex >= 0 && req.PaymentIndex < order.PartialPayments.Count)
                        {
                            var payment = order.PartialPayments[req.PaymentIndex];
                            if (payment.PaymentDetails != null)
                            {
                                payment.PaymentDetails.IsConciliated = req.IsConciliated;
                                orderUpdated = true;
                            }
                        }
                    }
                    else if (req.PaymentType == "mixed")
                    {
                        if (order.MixedPayments != null && req.PaymentIndex >= 0 && req.PaymentIndex < order.MixedPayments.Count)
                        {
                            var payment = order.MixedPayments[req.PaymentIndex];
                            if (payment.PaymentDetails != null)
                            {
                                payment.PaymentDetails.IsConciliated = req.IsConciliated;
                                orderUpdated = true;
                            }
                        }
                    }
                }

                if (orderUpdated)
                {
                    order.UpdatedAt = DateTime.UtcNow;
                    await _orderRepository.UpdateAsync(order);
                    var groupList = orderGroup.ToList();
                    await _auditLogService.LogPaymentsConciliatedAsync(orderBefore, order, groupList, userId, userName);
                    anyUpdated = true;
                }
            }

            return anyUpdated;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al conciliar pagos");
            throw;
        }
    }

    // Mappers
    private static string FormatOrderNumberWithPrefix(string prefix, int suffix) =>
        $"{prefix}{suffix.ToString("D3", CultureInfo.InvariantCulture)}";

    private async Task<string> AllocateNextOrderNumberAsync(string orderType, string prefix)
    {
        var maxSuffix = await _orderRepository.GetMaxNumericSuffixForTypeAndPrefixAsync(orderType, prefix);
        if (string.Equals(orderType, OrderDocumentTypes.Reservation, StringComparison.Ordinal)
            && string.Equals(prefix, OrderDocumentTypes.ReservationPrefix, StringComparison.Ordinal))
        {
            var legacyMax = await _orderRepository.GetMaxNumericSuffixForTypeAndPrefixAsync(
                OrderDocumentTypes.LegacyReservation,
                OrderDocumentTypes.LegacyReservationPrefix);
            maxSuffix = Math.Max(maxSuffix, legacyMax);
        }
        var candidate = maxSuffix + 1;
        const int cap = 5000;
        for (var i = 0; i < cap; i++)
        {
            var orderNumber = FormatOrderNumberWithPrefix(prefix, candidate);
            if (!await _orderRepository.OrderNumberExistsAsync(orderNumber))
                return orderNumber;
            candidate++;
        }

        throw new InvalidOperationException(
            $"No se pudo generar un número único para el prefijo {prefix} (tipo {orderType}).");
    }

    private static bool IsDuplicateKeyWrite(MongoWriteException ex) =>
        ex.WriteError?.Code == 11000;

    private async Task<Order> CreateOrderAndAuditAsync(
        Order order,
        string orderTypeForNumber,
        string orderNumberPrefix,
        string userId,
        string userName)
    {
        const int maxDupRetries = 10;
        for (var attempt = 0; attempt < maxDupRetries; attempt++)
        {
            try
            {
                var created = await _orderRepository.CreateAsync(order);
                await _auditLogService.LogOrderCreatedAsync(created, userId, userName);
                return created;
            }
            catch (MongoWriteException ex) when (IsDuplicateKeyWrite(ex))
            {
                _logger.LogWarning(
                    ex,
                    "Clave duplicada al insertar pedido (orderNumber {OrderNumber}, intento {Attempt}). Reasignando.",
                    order.OrderNumber,
                    attempt + 1);

                if (attempt == maxDupRetries - 1)
                    throw;

                order.OrderNumber = await AllocateNextOrderNumberAsync(orderTypeForNumber, orderNumberPrefix);
            }
        }

        throw new InvalidOperationException("Fallo inesperado al persistir el pedido.");
    }

    private OrderResponseDto MapToDto(Order order)
    {
        return new OrderResponseDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            ConvertedFromNumber = order.ConvertedFromNumber,
            ClientId = order.ClientId,
            ClientName = order.ClientName,
            VendorId = order.VendorId,
            VendorName = order.VendorName,
            ReferrerId = order.ReferrerId,
            ReferrerName = order.ReferrerName,
            PostventaId = order.PostventaId,
            PostventaName = order.PostventaName,
            Products = order.Products.Select(MapProductToDto).ToList(),
            Subtotal = order.Subtotal,
            TaxAmount = order.TaxAmount,
            DeliveryCost = order.DeliveryCost,
            Total = order.Total,
            SubtotalBeforeDiscounts = order.SubtotalBeforeDiscounts,
            ProductDiscountTotal = order.ProductDiscountTotal,
            GeneralDiscountAmount = order.GeneralDiscountAmount,
            GeneralDiscountType = order.GeneralDiscountType,
            GeneralDiscountPercent = order.GeneralDiscountPercent,
            PaymentType = order.PaymentType,
            PaymentMethod = order.PaymentMethod,
            PaymentCondition = order.PaymentCondition,
            PaymentDetails = order.PaymentDetails != null ? MapPaymentDetailsToDto(order.PaymentDetails) : null,
            PartialPayments = order.PartialPayments?.Select(MapPartialPaymentToDto).ToList(),
            MixedPayments = order.MixedPayments?.Select(MapPartialPaymentToDto).ToList(),
            DeliveryAddress = order.DeliveryAddress,
            HasDelivery = order.HasDelivery,
            DeliveryServices = order.DeliveryServices != null ? MapDeliveryServicesToDto(order.DeliveryServices) : null,
            Status = order.Status,
            ProductMarkups = order.ProductMarkups,
            CreateSupplierOrder = order.CreateSupplierOrder,
            Observations = order.Observations,
            DispatchObservations = order.DispatchObservations,
            SaleType = order.SaleType,
            DeliveryType = order.DeliveryType,
            DeliveryZone = order.DeliveryZone,
            ExchangeRatesAtCreation = order.ExchangeRatesAtCreation != null ? MapExchangeRatesToDto(order.ExchangeRatesAtCreation) : null,
            BaseCurrency = order.BaseCurrency,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            Type = order.Type,
            OriginalOrderId = order.OriginalOrderId,
            OriginalProducts = order.OriginalProducts?.Select(MapProductToDto).ToList(),
            SourceReservationVendorId = order.SourceReservationVendorId,
            SourceReservationVendorName = order.SourceReservationVendorName,
            AppliedStoreCreditUsd = order.AppliedStoreCreditUsd,
        };
    }

    private static List<OrderProduct> CloneOrderProducts(IEnumerable<OrderProduct> products)
    {
        return products.Select(p => BsonSerializer.Deserialize<OrderProduct>(p.ToBsonDocument())).ToList();
    }

    private static string AttributesFingerprint(Dictionary<string, object>? attrs)
    {
        if (attrs == null || attrs.Count == 0)
            return "";

        try
        {
            var sorted = attrs.OrderBy(kv => kv.Key).ToDictionary(kv => kv.Key, kv => kv.Value);
            return JsonSerializer.Serialize(sorted);
        }
        catch
        {
            return $"n:{attrs.Count}";
        }
    }

    private static bool HasProductStructureChanges(IReadOnlyList<OrderProduct> original, IReadOnlyList<OrderProduct> current)
    {
        var o = original.OrderBy(p => p.Id).ToList();
        var c = current.OrderBy(p => p.Id).ToList();
        if (o.Count != c.Count)
            return true;

        for (var i = 0; i < o.Count; i++)
        {
            if (!string.Equals(o[i].Id, c[i].Id, StringComparison.Ordinal))
                return true;
            if (o[i].Quantity != c[i].Quantity)
                return true;
            if (!string.Equals(AttributesFingerprint(o[i].Attributes), AttributesFingerprint(c[i].Attributes), StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private void RecalculateOrderStatus(Order order)
    {
        if (string.Equals(order.Type, "Budget", StringComparison.Ordinal)
            || OrderDocumentTypes.IsReservationType(order.Type))
            return;

        if (order.Products == null || !order.Products.Any())
            return;

        bool hasGenerado = false;
        bool hasValidado = false;
        bool hasFabricandose = false;
        bool hasEnAlmacen = false;
        bool hasEnRuta = false;
        bool allCompletado = true;

        foreach (var product in order.Products)
        {
            var status = product.LogisticStatus ?? "Generado";
            if (status != "Completado")
                allCompletado = false;

            if (status == "Generado" || status == "Pendiente")
                hasGenerado = true;
            else if (status == "Validado")
                hasValidado = true;
            else if (status == "Fabricándose")
                hasFabricandose = true;
            else if (status == "En Almacén")
                hasEnAlmacen = true;
            else if (status == "En Ruta")
                hasEnRuta = true;
        }

        if (allCompletado)
            order.Status = "Completado";
        else if (hasGenerado)
            order.Status = "Generado";
        else if (hasValidado)
            order.Status = "Validado";
        else if (hasFabricandose)
            order.Status = "Fabricándose";
        else if (hasEnAlmacen)
            order.Status = "En Almacén";
        else if (hasEnRuta)
            order.Status = "En Ruta";
        else
            order.Status = "Generado";
    }

    private OrderProductDto MapProductToDto(OrderProduct product)
    {
        return new OrderProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Price,
            PriceCurrency = product.PriceCurrency,
            Quantity = product.Quantity,
            Total = product.Total,
            Category = product.Category,
            Stock = product.Stock,
            Attributes = product.Attributes,
            Discount = product.Discount,
            Observations = product.Observations,
            AvailabilityStatus = product.AvailabilityStatus,
            ManufacturingStatus = product.ManufacturingStatus,
            ManufacturingProviderId = product.ManufacturingProviderId,
            ManufacturingProviderName = product.ManufacturingProviderName,
            ManufacturingStartedAt = product.ManufacturingStartedAt,
            ManufacturingCompletedAt = product.ManufacturingCompletedAt,
            ManufacturingNotes = product.ManufacturingNotes,
            LocationStatus = product.LocationStatus,
            LogisticStatus = product.LogisticStatus,
            DeliveredAt = product.DeliveredAt,
            RefabricationReason = product.RefabricationReason,
            RefabricatedAt = product.RefabricatedAt,
            RefabricationHistory = product.RefabricationHistory?.Select(r => new RefabricationRecordDto
            {
                Reason = r.Reason,
                Date = r.Date,
                PreviousProviderId = r.PreviousProviderId,
                PreviousProviderName = r.PreviousProviderName,
                NewProviderId = r.NewProviderId,
                NewProviderName = r.NewProviderName
            }).ToList(),
            SurchargeEnabled = product.SurchargeEnabled,
            SurchargeAmount = product.SurchargeAmount,
            SurchargeReason = product.SurchargeReason,
            Images = product.Images?.Select(img => new ProductImageDto
            {
                Id = img.Id,
                Base64 = img.Base64,
                Filename = img.Filename,
                Type = img.Type,
                UploadedAt = img.UploadedAt,
                Size = img.Size
            }).ToList(),
            CommissionLineSource = product.CommissionLineSource,
            CatalogProductId = product.CatalogProductId
        };
    }

    // OrderProduct.Id es [BsonRepresentation(BsonType.ObjectId)]: Mongo solo acepta ObjectId hex.
    // Para enlazar al catálogo se usa CatalogProductId (string libre), no el Id de línea.
    private static string ResolveOrderProductLineId(string? dtoId)
    {
        if (string.IsNullOrWhiteSpace(dtoId))
            return ObjectId.GenerateNewId().ToString();

        var trimmed = dtoId.Trim();
        return ObjectId.TryParse(trimmed, out _)
            ? trimmed
            : ObjectId.GenerateNewId().ToString();
    }

    private static void EnrichProductsFromReservationBaseline(
        IList<OrderProduct> finalProducts,
        IReadOnlyList<OrderProduct> baseline)
    {
        foreach (var line in finalProducts)
        {
            var match = baseline.FirstOrDefault(b => string.Equals(b.Id, line.Id, StringComparison.Ordinal));
            if (match == null && !string.IsNullOrWhiteSpace(line.CatalogProductId))
            {
                match = baseline.FirstOrDefault(b =>
                    string.Equals(b.CatalogProductId, line.CatalogProductId, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(
                        CommissionLineClassifier.GetCatalogProductId(b.Id),
                        line.CatalogProductId,
                        StringComparison.OrdinalIgnoreCase));
            }

            if (match == null)
                continue;

            if (string.IsNullOrWhiteSpace(line.PriceCurrency))
                line.PriceCurrency = match.PriceCurrency;

            if (string.IsNullOrWhiteSpace(line.CatalogProductId))
            {
                line.CatalogProductId = !string.IsNullOrWhiteSpace(match.CatalogProductId)
                    ? match.CatalogProductId
                    : CommissionLineClassifier.GetCatalogProductId(match.Id);
            }
        }
    }

    private OrderProduct MapProductFromDto(OrderProductDto dto)
    {
        return new OrderProduct
        {
            Id = ResolveOrderProductLineId(dto.Id),
            Name = dto.Name,
            Price = dto.Price,
            PriceCurrency = dto.PriceCurrency,
            Quantity = dto.Quantity,
            Total = dto.Total,
            Category = dto.Category,
            Stock = dto.Stock,
            Attributes = ConvertAttributesFromJsonElement(dto.Attributes),
            Discount = dto.Discount,
            Observations = dto.Observations,
            AvailabilityStatus = dto.AvailabilityStatus,
            ManufacturingStatus = dto.ManufacturingStatus,
            ManufacturingProviderId = dto.ManufacturingProviderId,
            ManufacturingProviderName = dto.ManufacturingProviderName,
            ManufacturingStartedAt = dto.ManufacturingStartedAt,
            ManufacturingCompletedAt = dto.ManufacturingCompletedAt,
            ManufacturingNotes = dto.ManufacturingNotes,
            LocationStatus = dto.LocationStatus,
            LogisticStatus = dto.LogisticStatus ?? "Generado",
            DeliveredAt = dto.DeliveredAt,
            RefabricationReason = dto.RefabricationReason,
            RefabricatedAt = dto.RefabricatedAt,
            RefabricationHistory = dto.RefabricationHistory?.Select(r => new RefabricationRecord
            {
                Reason = r.Reason,
                Date = r.Date,
                PreviousProviderId = r.PreviousProviderId,
                PreviousProviderName = r.PreviousProviderName,
                NewProviderId = r.NewProviderId,
                NewProviderName = r.NewProviderName
            }).ToList(),
            SurchargeEnabled = dto.SurchargeEnabled,
            SurchargeAmount = dto.SurchargeAmount,
            SurchargeReason = dto.SurchargeReason,
            Images = dto.Images?.Select(img => new ProductImage
            {
                Id = img.Id,
                Base64 = img.Base64,
                Filename = img.Filename,
                Type = img.Type,
                UploadedAt = img.UploadedAt,
                Size = img.Size
            }).ToList(),
            CommissionLineSource = dto.CommissionLineSource,
            CatalogProductId = ResolveCatalogProductId(dto)
        };
    }

    // CatalogProductId del DTO o derivado del id compuesto {catalogId}-{timestamp}-{random}.
    // Nunca un ObjectId suelto (eso no identifica al catálogo).
    private static string? ResolveCatalogProductId(OrderProductDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.CatalogProductId))
            return dto.CatalogProductId;

        if (string.IsNullOrWhiteSpace(dto.Id) || ObjectId.TryParse(dto.Id, out _))
            return null;

        var derived = CommissionLineClassifier.GetCatalogProductId(dto.Id);
        return string.IsNullOrWhiteSpace(derived) || string.Equals(derived, dto.Id, StringComparison.Ordinal)
            ? null
            : derived;
    }

    private PaymentDetailsDto MapPaymentDetailsToDto(PaymentDetails paymentDetails)
    {
        return new PaymentDetailsDto
        {
            PagomovilReference = paymentDetails.PagomovilReference,
            PagomovilBank = paymentDetails.PagomovilBank,
            PagomovilPhone = paymentDetails.PagomovilPhone,
            PagomovilDate = paymentDetails.PagomovilDate,
            TransferenciaBank = paymentDetails.TransferenciaBank,
            TransferenciaReference = paymentDetails.TransferenciaReference,
            TransferenciaDate = paymentDetails.TransferenciaDate,
            CashAmount = paymentDetails.CashAmount,
            CashCurrency = paymentDetails.CashCurrency,
            CashReceived = paymentDetails.CashReceived,
            ExchangeRate = paymentDetails.ExchangeRate,
            OriginalAmount = paymentDetails.OriginalAmount,
            OriginalCurrency = paymentDetails.OriginalCurrency,
            AccountId = paymentDetails.AccountId,
            AccountNumber = paymentDetails.AccountNumber,
            Bank = paymentDetails.Bank,
            Email = paymentDetails.Email,
            Wallet = paymentDetails.Wallet,
            Envia = paymentDetails.Envia,
            IsConciliated = paymentDetails.IsConciliated,
            CasheaFinancedPortion = paymentDetails.CasheaFinancedPortion
        };
    }

    private PaymentDetails MapPaymentDetailsFromDto(PaymentDetailsDto dto)
    {
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
            CasheaFinancedPortion = dto.CasheaFinancedPortion
        };
    }

    private PartialPaymentDto MapPartialPaymentToDto(PartialPayment payment)
    {
        return new PartialPaymentDto
        {
            Id = payment.Id,
            Amount = payment.Amount,
            Method = payment.Method,
            Date = payment.Date,
            Images = payment.Images?.Select(img => new ProductImageDto
            {
                Id = img.Id,
                Base64 = img.Base64,
                Filename = img.Filename,
                Type = img.Type,
                UploadedAt = img.UploadedAt,
                Size = img.Size
            }).ToList(),
            PaymentDetails = payment.PaymentDetails != null ? MapPaymentDetailsToDto(payment.PaymentDetails) : null
        };
    }

    private PartialPayment MapPartialPaymentFromDto(PartialPaymentDto dto)
    {
        return new PartialPayment
        {
            Id = string.IsNullOrEmpty(dto.Id) || !ObjectId.TryParse(dto.Id, out _)
                ? ObjectId.GenerateNewId().ToString()
                : dto.Id,
            Amount = dto.Amount,
            Method = dto.Method,
            Date = dto.Date,
            Images = dto.Images?.Select(img => new ProductImage
            {
                Id = img.Id,
                Base64 = img.Base64,
                Filename = img.Filename,
                Type = img.Type,
                UploadedAt = img.UploadedAt,
                Size = img.Size
            }).ToList(),
            PaymentDetails = dto.PaymentDetails != null ? MapPaymentDetailsFromDto(dto.PaymentDetails) : null
        };
    }

    private DeliveryServicesDto MapDeliveryServicesToDto(DeliveryServices deliveryServices)
    {
        return new DeliveryServicesDto
        {
            DeliveryExpress = deliveryServices.DeliveryExpress != null ? MapDeliveryServiceToDto(deliveryServices.DeliveryExpress) : null,
            ServicioAcarreo = deliveryServices.ServicioAcarreo != null ? MapDeliveryServiceToDto(deliveryServices.ServicioAcarreo) : null,
            ServicioArmado = deliveryServices.ServicioArmado != null ? MapDeliveryServiceToDto(deliveryServices.ServicioArmado) : null
        };
    }

    private DeliveryServices MapDeliveryServicesFromDto(DeliveryServicesDto dto)
    {
        return new DeliveryServices
        {
            DeliveryExpress = dto.DeliveryExpress != null ? MapDeliveryServiceFromDto(dto.DeliveryExpress) : null,
            ServicioAcarreo = dto.ServicioAcarreo != null ? MapDeliveryServiceFromDto(dto.ServicioAcarreo) : null,
            ServicioArmado = dto.ServicioArmado != null ? MapDeliveryServiceFromDto(dto.ServicioArmado) : null
        };
    }

    private DeliveryServiceDto MapDeliveryServiceToDto(DeliveryService deliveryService)
    {
        return new DeliveryServiceDto
        {
            Enabled = deliveryService.Enabled,
            Cost = deliveryService.Cost,
            Currency = deliveryService.Currency
        };
    }

    private DeliveryService MapDeliveryServiceFromDto(DeliveryServiceDto dto)
    {
        return new DeliveryService
        {
            Enabled = dto.Enabled,
            Cost = dto.Cost,
            Currency = dto.Currency
        };
    }

    private ExchangeRatesAtCreationDto MapExchangeRatesToDto(ExchangeRatesAtCreation entity)
    {
        return new ExchangeRatesAtCreationDto
        {
            Usd = entity.Usd != null ? new ExchangeRateInfoDto { Rate = entity.Usd.Rate, EffectiveDate = entity.Usd.EffectiveDate } : null,
            Eur = entity.Eur != null ? new ExchangeRateInfoDto { Rate = entity.Eur.Rate, EffectiveDate = entity.Eur.EffectiveDate } : null
        };
    }

    private ExchangeRatesAtCreation MapExchangeRatesFromDto(ExchangeRatesAtCreationDto dto)
    {
        return new ExchangeRatesAtCreation
        {
            Usd = dto.Usd != null ? new ExchangeRateInfo { Rate = dto.Usd.Rate, EffectiveDate = dto.Usd.EffectiveDate } : null,
            Eur = dto.Eur != null ? new ExchangeRateInfo { Rate = dto.Eur.Rate, EffectiveDate = dto.Eur.EffectiveDate } : null
        };
    }

    /// <summary>
    /// Alinea tipo/% con el monto: sin descuento limpia metadatos; si dice «porcentaje» pero el % no es válido (p. ej. bug antiguo que guardaba Bs como %), fuerza «monto».
    /// </summary>
    private static void NormalizeGeneralDiscountFields(Order order)
    {
        var amt = order.GeneralDiscountAmount ?? 0m;
        if (amt <= 0m)
        {
            order.GeneralDiscountAmount = null;
            order.GeneralDiscountType = null;
            order.GeneralDiscountPercent = null;
            return;
        }

        var t = order.GeneralDiscountType?.Trim().ToLowerInvariant();
        if (t == "porcentaje")
        {
            var p = order.GeneralDiscountPercent;
            if (p is null || p <= 0m || p > 100m)
            {
                order.GeneralDiscountType = "monto";
                order.GeneralDiscountPercent = null;
            }
            else
            {
                order.GeneralDiscountPercent = decimal.Round(p.Value, 4, MidpointRounding.AwayFromZero);
            }
        }
        else
        {
            order.GeneralDiscountType = "monto";
            order.GeneralDiscountPercent = null;
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
}

