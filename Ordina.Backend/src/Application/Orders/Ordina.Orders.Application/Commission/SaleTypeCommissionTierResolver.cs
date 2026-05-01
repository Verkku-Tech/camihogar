using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Commission;

namespace Ordina.Orders.Application.Commission;

/// <summary>
/// Resuelve el nivel USD/unidad de comisión familia (2.5, 5, 7.5) y elige la regla de reparto correspondiente.
/// Paridad con la lógica equivalente en el frontend (storage.ts).
/// </summary>
public static class SaleTypeCommissionTierResolver
{
    public static readonly decimal[] SupportedTiers = { 2.5m, 5m, 7.5m };

    private const decimal Epsilon = 0.0001m;

    public static bool TryResolveTier(decimal commissionUsdPerUnit, out decimal tier)
    {
        foreach (var t in SupportedTiers)
        {
            if (Math.Abs(commissionUsdPerUnit - t) < Epsilon)
            {
                tier = t;
                return true;
            }
        }

        tier = 0m;
        return false;
    }

    /// <summary>
    /// Elige la regla por tipo de venta y tier. Si el USD/u no coincide con un tier, usa 2.5 como bucket por defecto y registra advertencia.
    /// </summary>
    public static SaleTypeCommissionRule? PickRule(
        IEnumerable<SaleTypeCommissionRule> rules,
        string saleType,
        decimal commissionUsdPerUnit,
        ILogger? logger = null)
    {
        var st = (saleType ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(st))
            st = "entrega";

        if (!TryResolveTier(commissionUsdPerUnit, out var tier))
        {
            logger?.LogWarning(
                "Comisión familia USD/u {Rate} no coincide con tiers 2.5/5/7.5; usando tier 2.5 para tipo de venta {SaleType}.",
                commissionUsdPerUnit,
                st);
            tier = 2.5m;
        }

        var match = rules.FirstOrDefault(r =>
            r.SaleType.Equals(st, StringComparison.OrdinalIgnoreCase) &&
            Math.Abs(r.FamilyCommissionUsdPerUnit - tier) < Epsilon);

        if (match != null)
            return match;

        match = rules.FirstOrDefault(r =>
            r.SaleType.Equals(st, StringComparison.OrdinalIgnoreCase));

        if (match != null)
            logger?.LogWarning(
                "No hay regla para tipo de venta {SaleType} y tier {Tier}; usando primera regla del mismo tipo de venta.",
                st,
                tier);

        return match;
    }
}
