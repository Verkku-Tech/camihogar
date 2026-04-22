using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using System.Text.Json;
using System.Linq;

namespace Ordina.Orders.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderAuditLogService _auditLogService;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        IOrderAuditLogService auditLogService,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<IEnumerable<OrderResponseDto>> GetAllOrdersAsync()
    {
        try
        {
            var orders = await _orderRepository.GetAllAsync();
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos");
            throw;
        }
    }

    public async Task<PagedOrdersResponseDto> GetOrdersPagedAsync(int page = 1, int pageSize = 50, DateTime? since = null)
    {
        try
        {
            // Validar parámetros
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 50;
            if (pageSize > 100) pageSize = 100; // Límite máximo para evitar sobrecarga

            var (orders, totalCount) = await _orderRepository.GetPagedAsync(page, pageSize, since);

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

    public async Task<IEnumerable<OrderResponseDto>> GetOrdersByClientIdAsync(string clientId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new ArgumentException("El ID del cliente es requerido", nameof(clientId));
            }

            var orders = await _orderRepository.GetByClientIdAsync(clientId);
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por cliente {ClientId}", clientId);
            throw;
        }
    }

    public async Task<IEnumerable<OrderResponseDto>> GetOrdersByStatusAsync(string status)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                throw new ArgumentException("El estado es requerido", nameof(status));
            }

            var orders = await _orderRepository.GetByStatusAsync(status);
            return orders.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos por estado {Status}", status);
            throw;
        }
    }

    public async Task<OrderResponseDto?> GetOrderByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del pedido es requerido", nameof(id));
            }

            var order = await _orderRepository.GetByIdAsync(id);
            return order == null ? null : MapToDto(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<OrderResponseDto?> GetOrderByOrderNumberAsync(string orderNumber)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(orderNumber))
            {
                throw new ArgumentException("El número de pedido es requerido", nameof(orderNumber));
            }

            var order = await _orderRepository.GetByOrderNumberAsync(orderNumber);
            return order == null ? null : MapToDto(order);
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
            var isPendingConfirmation = string.Equals(createDto.Type, "PendingConfirmation", StringComparison.Ordinal);
            var requiresPayment = !isBudget && !isPendingConfirmation;
            if (requiresPayment)
            {
                if (string.IsNullOrWhiteSpace(createDto.PaymentType))
                    throw new ArgumentException("El tipo de pago es requerido para pedidos", nameof(createDto.PaymentType));
                if (string.IsNullOrWhiteSpace(createDto.PaymentMethod))
                    throw new ArgumentException("El método de pago es requerido para pedidos", nameof(createDto.PaymentMethod));
            }

            var existingOrders = (await _orderRepository.GetAllAsync()).ToList();
            var typeForCount = isBudget ? "Budget" : isPendingConfirmation ? "PendingConfirmation" : "Order";
            var prefix = isBudget ? "PRE-" : isPendingConfirmation ? "PCF-" : "ORD-";
            var countForType = existingOrders.Count(o => string.Equals(o.Type, typeForCount, StringComparison.Ordinal));
            var orderNumber = $"{prefix}{String.Format("{0:D3}", countForType + 1)}";

            int attempts = 0;
            while (await _orderRepository.OrderNumberExistsAsync(orderNumber) && attempts < 10)
            {
                orderNumber = $"{prefix}{String.Format("{0:D3}", countForType + attempts + 2)}";
                attempts++;
            }

            var paymentType = isBudget || isPendingConfirmation
                ? (string.IsNullOrWhiteSpace(createDto.PaymentType) ? "N/A" : createDto.PaymentType!)
                : createDto.PaymentType!;
            var paymentMethod = isBudget || isPendingConfirmation
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
                SaleType = createDto.SaleType,
                DeliveryType = createDto.DeliveryType,
                DeliveryZone = createDto.DeliveryZone,
                ExchangeRatesAtCreation = createDto.ExchangeRatesAtCreation != null ? MapExchangeRatesFromDto(createDto.ExchangeRatesAtCreation) : null,
                Type = createDto.Type,
                OriginalProducts = isPendingConfirmation ? CloneOrderProducts(mappedProducts) : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            RecalculateOrderStatus(order);
            var createdOrder = await _orderRepository.CreateAsync(order);
            await _auditLogService.LogOrderCreatedAsync(createdOrder, userId, userName);
            return MapToDto(createdOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido");
            throw;
        }
    }

    public async Task<OrderResponseDto> ConfirmPendingOrderAsync(string pendingOrderId, ConfirmOrderDto confirmDto, string userId, string userName)
    {
        if (string.IsNullOrWhiteSpace(pendingOrderId))
            throw new ArgumentException("El ID del pedido por confirmar es requerido", nameof(pendingOrderId));

        var pcf = await _orderRepository.GetByIdAsync(pendingOrderId);
        if (pcf == null)
            throw new KeyNotFoundException($"Pedido con ID {pendingOrderId} no encontrado");

        if (!string.Equals(pcf.Type, "PendingConfirmation", StringComparison.Ordinal))
            throw new ArgumentException("El documento no es un pedido por confirmar (PendingConfirmation).");

        if (!string.Equals(pcf.Status, "Por Confirmar", StringComparison.Ordinal))
            throw new ArgumentException($"Solo se pueden confirmar pedidos en estado «Por Confirmar». Estado actual: {pcf.Status}");

        var baseline = pcf.OriginalProducts is { Count: > 0 } ? pcf.OriginalProducts : pcf.Products;
        List<OrderProduct> finalProducts;
        if (confirmDto.Products != null && confirmDto.Products.Count > 0)
            finalProducts = confirmDto.Products.Select(MapProductFromDto).ToList();
        else
            finalProducts = CloneOrderProducts(pcf.Products);

        var structureChanged = HasProductStructureChanges(baseline, finalProducts);

        string vendorId;
        string vendorName;
        string? referrerId;
        string? referrerName;
        if (structureChanged)
        {
            vendorId = confirmDto.StoreVendorId;
            vendorName = confirmDto.StoreVendorName;
            var onlineId = !string.IsNullOrWhiteSpace(pcf.ReferrerId) ? pcf.ReferrerId! : pcf.VendorId;
            var onlineName = !string.IsNullOrWhiteSpace(pcf.ReferrerName) ? pcf.ReferrerName! : pcf.VendorName;
            referrerId = onlineId;
            referrerName = onlineName;
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
            Type = "Order",
            OriginalOrderId = pcf.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var existingOrders = (await _orderRepository.GetAllAsync()).ToList();
        var ordCount = existingOrders.Count(o => string.Equals(o.Type, "Order", StringComparison.Ordinal));
        var orderNumber = $"ORD-{String.Format("{0:D3}", ordCount + 1)}";
        var attempts = 0;
        while (await _orderRepository.OrderNumberExistsAsync(orderNumber) && attempts < 10)
        {
            orderNumber = $"ORD-{String.Format("{0:D3}", ordCount + attempts + 2)}";
            attempts++;
        }
        newOrder.OrderNumber = orderNumber;

        RecalculateOrderStatus(newOrder);
        var created = await _orderRepository.CreateAsync(newOrder);
        await _auditLogService.LogOrderCreatedAsync(created, userId, userName);

        var pcfBefore = OrderDeepClone.Clone(pcf);
        pcf.Status = "Convertido";
        pcf.UpdatedAt = DateTime.UtcNow;
        var updatedPcf = await _orderRepository.UpdateAsync(pcf);
        await _auditLogService.LogOrderUpdatedAsync(pcfBefore, updatedPcf, userId, userName);

        return MapToDto(created);
    }

    public async Task<OrderResponseDto> UpdateOrderAsync(string id, UpdateOrderDto updateDto, string userId, string userName)
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

            var oldSnapshot = OrderDeepClone.Clone(existingOrder);

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
                existingOrder.GeneralDiscountAmount = updateDto.GeneralDiscountAmount;
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
            if (!string.IsNullOrEmpty(updateDto.SaleType))
                existingOrder.SaleType = updateDto.SaleType;
            if (!string.IsNullOrEmpty(updateDto.DeliveryType))
                existingOrder.DeliveryType = updateDto.DeliveryType;
            if (!string.IsNullOrEmpty(updateDto.DeliveryZone))
                existingOrder.DeliveryZone = updateDto.DeliveryZone;
            if (updateDto.ExchangeRatesAtCreation != null)
                existingOrder.ExchangeRatesAtCreation = MapExchangeRatesFromDto(updateDto.ExchangeRatesAtCreation);
            if (!string.IsNullOrEmpty(updateDto.Type))
                existingOrder.Type = updateDto.Type;

            existingOrder.UpdatedAt = DateTime.UtcNow;

            RecalculateOrderStatus(existingOrder);
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

    public async Task<bool> DeleteOrderAsync(string id, string userId, string userName)
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
    private OrderResponseDto MapToDto(Order order)
    {
        return new OrderResponseDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
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
            SaleType = order.SaleType,
            DeliveryType = order.DeliveryType,
            DeliveryZone = order.DeliveryZone,
            ExchangeRatesAtCreation = order.ExchangeRatesAtCreation != null ? MapExchangeRatesToDto(order.ExchangeRatesAtCreation) : null,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            Type = order.Type,
            OriginalOrderId = order.OriginalOrderId,
            OriginalProducts = order.OriginalProducts?.Select(MapProductToDto).ToList()
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
            || string.Equals(order.Type, "PendingConfirmation", StringComparison.Ordinal))
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
            }).ToList()
        };
    }

    private OrderProduct MapProductFromDto(OrderProductDto dto)
    {
        return new OrderProduct
        {
            Id = string.IsNullOrEmpty(dto.Id) || !ObjectId.TryParse(dto.Id, out _) 
                ? ObjectId.GenerateNewId().ToString() 
                : dto.Id,
            Name = dto.Name,
            Price = dto.Price,
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
            }).ToList()
        };
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
            IsConciliated = paymentDetails.IsConciliated
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
            IsConciliated = dto.IsConciliated
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

