using System.Text.Json;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IClientCreditService
{
    Task<decimal> GetBalanceUsdAsync(string clientId, CancellationToken cancellationToken = default);

    Task<RecordOverpaymentCreditResponseDto> RecordOverpaymentCreditAsync(
        string orderId,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tras crear un pedido: descuenta del ledger el crédito aplicado (si &gt; 0).
    /// </summary>
    Task DebitAppliedCreditForNewOrderAsync(
        Order order,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tras actualizar appliedStoreCreditUsd: ajusta el ledger según delta.
    /// </summary>
    Task SyncAppliedCreditAfterOrderUpdateAsync(
        Order order,
        decimal previousAppliedUsd,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default);
}

public class ClientCreditService : IClientCreditService
{
    private readonly IClientCreditLedgerRepository _ledger;
    private readonly IOrderRepository _orders;
    private readonly ILogger<ClientCreditService> _logger;

    public ClientCreditService(
        IClientCreditLedgerRepository ledger,
        IOrderRepository orders,
        ILogger<ClientCreditService> logger)
    {
        _ledger = ledger;
        _orders = orders;
        _logger = logger;
    }

    public async Task<decimal> GetBalanceUsdAsync(string clientId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(clientId))
            return 0;
        return await _ledger.SumAmountUsdByClientIdAsync(clientId, cancellationToken);
    }

    public async Task<RecordOverpaymentCreditResponseDto> RecordOverpaymentCreditAsync(
        string orderId,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(orderId))
            throw new ArgumentException("orderId requerido", nameof(orderId));

        var order = await _orders.GetByIdAsync(orderId);
        if (order == null)
            throw new KeyNotFoundException($"Pedido {orderId} no encontrado");

        if (await _ledger.ExistsOverpaymentForOrderAsync(orderId, cancellationToken))
            throw new InvalidOperationException("Ya se registró crédito por sobrepago para este pedido.");

        decimal excess;
        try
        {
            excess = OrderPaymentUsdConverter.ComputeOverpaymentUsd(order);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo calcular sobrepago en USD para pedido {OrderId}", orderId);
            throw new InvalidOperationException(
                "No se pudo calcular el sobrepago en USD. Verifique tasas del pedido y monedas de los pagos.", ex);
        }

        if (excess <= 0)
            throw new InvalidOperationException("No hay sobrepago en USD para acreditar.");

        var metadata = JsonSerializer.Serialize(new
        {
            orderNumber = order.OrderNumber,
            paymentCondition = order.PaymentCondition,
            paidUsd = OrderPaymentUsdConverter.SumPaymentsUsd(order),
            totalUsd = OrderPaymentUsdConverter.OrderTotalToUsd(order),
        });

        var entry = new ClientCreditLedger
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = order.ClientId,
            CreatedAt = DateTime.UtcNow,
            AmountUsd = excess,
            Type = "overpayment",
            OrderId = order.Id,
            CreatedByUserId = userId,
            Metadata = metadata,
        };

        await _ledger.InsertAsync(entry, cancellationToken);
        var balance = await _ledger.SumAmountUsdByClientIdAsync(order.ClientId, cancellationToken);

        return new RecordOverpaymentCreditResponseDto
        {
            AmountCreditedUsd = excess,
            NewBalanceUsd = balance,
        };
    }

    public async Task DebitAppliedCreditForNewOrderAsync(
        Order order,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default)
    {
        var amount = order.AppliedStoreCreditUsd;
        if (amount <= 0)
            return;

        var balance = await _ledger.SumAmountUsdByClientIdAsync(order.ClientId, cancellationToken);
        if (balance < amount)
            throw new InvalidOperationException(
                $"Saldo a favor insuficiente. Disponible: USD {balance:F2}, solicitado: USD {amount:F2}.");

        var entry = new ClientCreditLedger
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = order.ClientId,
            CreatedAt = DateTime.UtcNow,
            AmountUsd = -amount,
            Type = "apply_order",
            OrderId = order.Id,
            CreatedByUserId = userId,
            Metadata = JsonSerializer.Serialize(new { orderNumber = order.OrderNumber, note = "applied_on_create" }),
        };
        await _ledger.InsertAsync(entry, cancellationToken);
    }

    public async Task SyncAppliedCreditAfterOrderUpdateAsync(
        Order order,
        decimal previousAppliedUsd,
        string userId,
        string? userName,
        CancellationToken cancellationToken = default)
    {
        var newApplied = order.AppliedStoreCreditUsd;
        var delta = newApplied - previousAppliedUsd;
        if (delta == 0)
            return;

        if (delta > 0)
        {
            var balance = await _ledger.SumAmountUsdByClientIdAsync(order.ClientId, cancellationToken);
            if (balance < delta)
                throw new InvalidOperationException(
                    $"Saldo a favor insuficiente para aumentar el crédito aplicado. Disponible: USD {balance:F2}, adicional: USD {delta:F2}.");

            await _ledger.InsertAsync(new ClientCreditLedger
            {
                Id = ObjectId.GenerateNewId().ToString(),
                ClientId = order.ClientId,
                CreatedAt = DateTime.UtcNow,
                AmountUsd = -delta,
                Type = "apply_order",
                OrderId = order.Id,
                CreatedByUserId = userId,
                Metadata = JsonSerializer.Serialize(new { orderNumber = order.OrderNumber, deltaAppliedUsd = delta }),
            }, cancellationToken);
            return;
        }

        // delta < 0: se redujo crédito aplicado; devolver al saldo a favor
        var returnUsd = -delta;
        await _ledger.InsertAsync(new ClientCreditLedger
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = order.ClientId,
            CreatedAt = DateTime.UtcNow,
            AmountUsd = returnUsd,
            Type = "adjustment",
            OrderId = order.Id,
            CreatedByUserId = userId,
            Metadata = JsonSerializer.Serialize(new { orderNumber = order.OrderNumber, reason = "reduce_applied_store_credit" }),
        }, cancellationToken);
    }
}
