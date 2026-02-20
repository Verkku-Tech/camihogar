using Microsoft.AspNetCore.Mvc;
using Ordina.Payments.Application.Interfaces;
using Ordina.Payments.Domain.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;

namespace Ordina.Payments.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExchangeRatesController : ControllerBase
    {
        private readonly IExchangeRateService _exchangeRateService;

        public ExchangeRatesController(IExchangeRateService exchangeRateService)
        {
            _exchangeRateService = exchangeRateService;
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActiveRates()
        {
            var rates = await _exchangeRateService.GetActiveRatesAsync();
            return Ok(rates);
        }

        [HttpGet("active/{toCurrency}")]
        public async Task<IActionResult> GetActiveRate(string toCurrency, [FromQuery] string fromCurrency = "Bs")
        {
            var rate = await _exchangeRateService.GetLatestRateAsync(fromCurrency, toCurrency);
            if (rate == null)
            {
                return NotFound($"No active exchange rate found for {fromCurrency} to {toCurrency}");
            }
            return Ok(rate);
        }

        [HttpPost]
        public async Task<IActionResult> SetExchangeRate([FromBody] SetExchangeRateRequest request)
        {
            try
            {
                var rate = await _exchangeRateService.SetExchangeRateAsync(request.FromCurrency, request.ToCurrency, request.Rate);
                return CreatedAtAction(nameof(GetActiveRate), new { toCurrency = rate.ToCurrency, fromCurrency = rate.FromCurrency }, rate);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }

    public class SetExchangeRateRequest
    {
        [Required]
        [MaxLength(3)]
        public string FromCurrency { get; set; } = "Bs";

        [Required]
        [MaxLength(3)]
        public string ToCurrency { get; set; } // USD, EUR

        [Required]
        [Range(0.0001, double.MaxValue)]
        public decimal Rate { get; set; }
    }
}
