namespace Ordina.Payments.Application.Interfaces;

/// <summary>
/// Obtiene las tasas oficiales USD y EUR publicadas en bcv.org.ve.
/// </summary>
public interface IBcvScraperService
{
    /// <summary>
    /// Descarga la página principal del BCV y extrae dólar y euro.
    /// Devuelve null en cada posición si no se pudo obtener un valor válido.
    /// </summary>
    Task<(decimal? Dolar, decimal? Euro)> FetchRatesAsync(CancellationToken cancellationToken = default);
}
