using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Finance;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FinanceController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly ICommissionService _commissionService;

    public FinanceController(
        IPaymentService paymentService,
        IExchangeRateService exchangeRateService,
        ICommissionService commissionService)
    {
        _paymentService = paymentService;
        _exchangeRateService = exchangeRateService;
        _commissionService = commissionService;
    }

    [HttpGet("exchange-rates/latest")]
    [HttpGet("/api/ExchangeRates/latest")]
    [AllowAnonymous] // Allow offline clients or public catalog to fetch exchange rate without bearer token
    public async Task<ActionResult<ExchangeRateResponseDto>> GetLatestRate(
        [FromQuery] string fromCurrency = "Bs",
        [FromQuery] string toCurrency = "USD",
        CancellationToken cancellationToken = default)
    {
        var rate = await _exchangeRateService.GetLatestRateAsync(fromCurrency, toCurrency, cancellationToken);
        if (rate == null)
        {
            return NotFound(new { message = "Exchange rate not found." });
        }
        return Ok(rate);
    }

    [HttpGet("exchange-rates/active")]
    [HttpGet("/api/ExchangeRates/active")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<ExchangeRateResponseDto>>> GetActiveRates(CancellationToken cancellationToken = default)
    {
        var rates = await _exchangeRateService.GetActiveRatesAsync(cancellationToken);
        return Ok(rates);
    }

    [HttpGet("exchange-rates/history")]
    [HttpGet("/api/ExchangeRates/history")]
    public async Task<ActionResult<IReadOnlyList<ExchangeRateResponseDto>>> GetRateHistory(CancellationToken cancellationToken)
    {
        var history = await _exchangeRateService.GetRateHistoryAsync(cancellationToken);
        return Ok(history);
    }

    [HttpPost("exchange-rates")]
    public async Task<ActionResult<ExchangeRateResponseDto>> SetExchangeRate([FromBody] SetExchangeRateDto dto, CancellationToken cancellationToken)
    {
        var rate = await _exchangeRateService.SetRateAsync(dto, cancellationToken);
        return Ok(rate);
    }

    [HttpGet("payments/order/{orderId}")]
    public async Task<ActionResult<IReadOnlyList<PaymentResponseDto>>> GetPaymentsByOrder(string orderId, CancellationToken cancellationToken)
    {
        var payments = await _paymentService.GetByOrderIdAsync(orderId, cancellationToken);
        return Ok(payments);
    }

    [HttpGet("payments/{id}")]
    public async Task<ActionResult<PaymentResponseDto>> GetPaymentById(string id, CancellationToken cancellationToken)
    {
        var payment = await _paymentService.GetByIdAsync(id, cancellationToken);
        if (payment == null)
        {
            return NotFound();
        }
        return Ok(payment);
    }

    [HttpPost("payments")]
    public async Task<ActionResult<PaymentResponseDto>> CreatePayment([FromBody] CreatePaymentDto dto, CancellationToken cancellationToken)
    {
        var payment = await _paymentService.CreatePaymentAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetPaymentById), new { id = payment.Id }, payment);
    }

    [HttpPatch("payments/{id}/status")]
    public async Task<IActionResult> UpdatePaymentStatus(string id, [FromQuery] string status, CancellationToken cancellationToken)
    {
        var updated = await _paymentService.UpdatePaymentStatusAsync(id, status, cancellationToken);
        if (!updated)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpGet("commissions")]
    public async Task<ActionResult<IReadOnlyList<CommissionResponseDto>>> GetCommissions(CancellationToken cancellationToken)
    {
        var commissions = await _commissionService.GetAllCommissionsAsync(cancellationToken);
        return Ok(commissions);
    }

    [HttpPost("commissions")]
    public async Task<ActionResult<CommissionResponseDto>> CreateCommission([FromBody] CreateCommissionDto dto, CancellationToken cancellationToken)
    {
        var commission = await _commissionService.CreateCommissionAsync(dto, cancellationToken);
        return Ok(commission);
    }

    [HttpGet("commissions/rules")]
    public async Task<ActionResult<IReadOnlyList<SaleTypeCommissionRuleDto>>> GetCommissionRules(CancellationToken cancellationToken)
    {
        var rules = await _commissionService.GetSaleTypeRulesAsync(cancellationToken);
        return Ok(rules);
    }
}
