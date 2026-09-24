using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Analytics;
using Ordina.Domain.Analytics;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/operations-metrics/settings")]
[Authorize]
public class OperationsMetricsSettingsController : ControllerBase
{
    private readonly IOperationsMetricsSettingsService _service;

    public OperationsMetricsSettingsController(IOperationsMetricsSettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<OperationsMetricsSettings>> Get(CancellationToken ct)
    {
        var settings = await _service.GetSettingsAsync(ct);
        return Ok(settings);
    }

    [HttpPut]
    [Authorize(Roles = "Administrator,Super Administrator")]
    public async Task<ActionResult<OperationsMetricsSettings>> Update([FromBody] OperationsMetricsSettings settings, CancellationToken ct)
    {
        var updated = await _service.UpdateSettingsAsync(settings, ct);
        return Ok(updated);
    }
}
