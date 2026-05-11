import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export type ScrappingExchangeRates = {
  dolar: number | null;
  euro: number | null;
  lastUpdated: string | null;
  error: string | null;
};
/**
 * GET /api/scrapping
 *
 * Obtiene las tasas oficial USD y EUR publicadas por el BCV (bancentralvenezuela)
 * cargando https://www.bcv.org.ve/ con fetch nativo de Node.js
 * y extrayendo el texto de los nodos #dolar y #euro del HTML para devolverlos como JSON.
 */
export async function GET() {
  // Valores por defecto si algo falla o aún no se ha parseado bien

  try {
    const response = await fetch("https://www.bcv.org.ve/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error al contactar BCV: ${response.status}`);
    }

    const html = await response.text();

    // Cargamos el HTML obtenido con cheerio
    const $ = cheerio.load(html);

    // Extraemos los textos
    const usdText = $("#dolar .centrado strong").text().trim();
    const eurText = $("#euro .centrado strong").text().trim();

    if (!usdText || !eurText) {
      throw new Error(
        `No se encontraron tasas. USD: "${usdText}", EUR: "${eurText}"`,
      );
    }

    const usdRate = parseFloat(usdText.replace(",", "."));
    const eurRate = parseFloat(eurText.replace(",", "."));

    if (isNaN(usdRate) || isNaN(eurRate)) {
      throw new Error(
        `Valores no numéricos: USD="${usdText}", EUR="${eurText}"`,
      );
    }

    return NextResponse.json({
      dolar: usdRate,
      euro: eurRate,
      lastUpdated: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    console.error("Error en scraping con fetch:", error);
    return NextResponse.json(
      {
        dolar: null,
        euro: null,
        lastUpdated: null,
        error: `${error}`,
      },
      { status: 500 },
    );
  }
}
