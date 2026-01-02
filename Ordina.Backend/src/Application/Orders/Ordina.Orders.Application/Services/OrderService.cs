using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using System.Text.Json;

namespace Ordina.Orders.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
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

    public async Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto)
    {
        try
        {
            // Generar número de pedido único
            var existingOrders = await _orderRepository.GetAllAsync();
            var orderNumber = $"ORD-{String.Format("{0:D3}", existingOrders.Count() + 1)}";

            // Verificar que el número no exista (por si acaso)
            int attempts = 0;
            while (await _orderRepository.OrderNumberExistsAsync(orderNumber) && attempts < 10)
            {
                orderNumber = $"ORD-{String.Format("{0:D3}", existingOrders.Count() + attempts + 2)}";
                attempts++;
            }

            var order = new Order
            {
                OrderNumber = orderNumber,
                ClientId = createDto.ClientId,
                ClientName = createDto.ClientName,
                VendorId = createDto.VendorId,
                VendorName = createDto.VendorName,
                ReferrerId = createDto.ReferrerId,
                ReferrerName = createDto.ReferrerName,
                Products = createDto.Products.Select(MapProductFromDto).ToList(),
                Subtotal = createDto.Subtotal,
                TaxAmount = createDto.TaxAmount,
                DeliveryCost = createDto.DeliveryCost,
                Total = createDto.Total,
                SubtotalBeforeDiscounts = createDto.SubtotalBeforeDiscounts,
                ProductDiscountTotal = createDto.ProductDiscountTotal,
                GeneralDiscountAmount = createDto.GeneralDiscountAmount,
                PaymentType = createDto.PaymentType,
                PaymentMethod = createDto.PaymentMethod,
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
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var createdOrder = await _orderRepository.CreateAsync(order);
            return MapToDto(createdOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido");
            throw;
        }
    }

    public async Task<OrderResponseDto> UpdateOrderAsync(string id, UpdateOrderDto updateDto)
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

            existingOrder.UpdatedAt = DateTime.UtcNow;

            var updatedOrder = await _orderRepository.UpdateAsync(existingOrder);
            return MapToDto(updatedOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar pedido con ID {OrderId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteOrderAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("El ID del pedido es requerido", nameof(id));
            }

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
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt
        };
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
            LocationStatus = product.LocationStatus
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
            LocationStatus = dto.LocationStatus
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
            Wallet = paymentDetails.Wallet
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
            Wallet = dto.Wallet
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

