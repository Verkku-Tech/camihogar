using System.Text.Json.Serialization;

namespace Ordina.Orders.Application.DTOs;

public class DeclineOrderRequestDto
{
    [JsonPropertyName("reason")]
    public string? Reason { get; set; }

    [JsonPropertyName("declineReason")]
    public string? DeclineReason { get; set; }

    public string? GetReason() => !string.IsNullOrWhiteSpace(Reason) ? Reason : DeclineReason;
}
