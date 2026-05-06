import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
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
 * cargando https://www.bcv.org.ve/ con Puppeteer (JavaScript ejecutado como en el navegador)
 * y extrayendo el texto de los nodos #dolar y #euro del HTML para devolverlos como JSON.
 */
const execAsync = promisify(exec);
export async function GET() {
  // Valores por defecto si algo falla o aún no se ha parseado bien

  try {
    // Ejecutamos curl exactamente como en la terminal
    // El flag -s es para "silencioso" (sin barra de progreso)
    const { stdout: html, stderr } = await execAsync(
      'curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" https://www.bcv.org.ve/',
    );

    if (stderr) {
      console.warn("curl stderr:", stderr);
    }

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
    console.error("Error en scraping con curl:", error);
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
