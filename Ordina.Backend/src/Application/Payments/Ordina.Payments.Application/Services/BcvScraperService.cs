using System.Globalization;
using System.Net.Http.Headers;
using AngleSharp.Html.Parser;
using Microsoft.Extensions.Logging;
using Ordina.Payments.Application.Interfaces;

namespace Ordina.Payments.Application.Services;

/// <summary>
/// Cliente HTTP tipado para leer tasas del BCV (mismo criterio que el route Next.js).
/// </summary>
public sealed class BcvScraperService : IBcvScraperService
{
    private const string BcvUrl = "https://www.bcv.org.ve/";
    private const decimal MinRate = 1;
    private const decimal MaxRate = 100_000;

    private readonly HttpClient _httpClient;
    private readonly ILogger<BcvScraperService> _logger;

    public BcvScraperService(HttpClient httpClient, ILogger<BcvScraperService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);

        if (_httpClient.DefaultRequestHeaders.UserAgent.Count == 0)
        {
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        }

        if (_httpClient.DefaultRequestHeaders.Accept.Count == 0)
        {
            _httpClient.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("text/html"));
        }

        if (_httpClient.DefaultRequestHeaders.AcceptLanguage.Count == 0)
        {
            _httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("es-VE,es;q=0.9,en;q=0.8");
        }
    }

    public async Task<(decimal? Dolar, decimal? Euro)> FetchRatesAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await _httpClient.GetAsync(BcvUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            var html = await response.Content.ReadAsStringAsync(cancellationToken);

            var parser = new HtmlParser();
            var document = await parser.ParseDocumentAsync(html, cancellationToken);

            var usdText = document.QuerySelector("#dolar .centrado strong")?.TextContent?.Trim();
            var eurText = document.QuerySelector("#euro .centrado strong")?.TextContent?.Trim();

            if (string.IsNullOrEmpty(usdText) || string.IsNullOrEmpty(eurText))
            {
                _logger.LogWarning(
                    "BCV: no se encontraron nodos esperados. USD=\"{Usd}\", EUR=\"{Eur}\"",
                    usdText,
                    eurText);
                return (null, null);
            }

            var usd = ParseRate(usdText);
            var eur = ParseRate(eurText);

            if (usd is not { } usdVal || eur is not { } eurVal)
            {
                _logger.LogWarning(
                    "BCV: valores no numéricos. USD=\"{Usd}\", EUR=\"{Eur}\"",
                    usdText,
                    eurText);
                return (null, null);
            }

            if (usdVal < MinRate || usdVal > MaxRate || eurVal < MinRate || eurVal > MaxRate)
            {
                _logger.LogWarning(
                    "BCV: tasas fuera de rango [{Min},{Max}]. USD={Usd}, EUR={Eur}",
                    MinRate,
                    MaxRate,
                    usdVal,
                    eurVal);
                return (null, null);
            }

            return (usdVal, eurVal);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BCV: error al obtener o parsear la página");
            return (null, null);
        }
    }

    private static decimal? ParseRate(string text)
    {
        var normalized = text.Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(
            normalized,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out var value)
            ? value
            : null;
    }
}
