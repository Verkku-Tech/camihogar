namespace Ordina.Orders.Application.DTOs;

public class SaleTypeCommissionCompletenessDto
{
    public bool IsComplete { get; set; }
    public int ExpectedRuleCount { get; set; }
    public int ActualRuleCount { get; set; }
    public bool HasLegacyTierZero { get; set; }
    public IReadOnlyList<string> MissingDescriptions { get; set; } = Array.Empty<string>();
}
