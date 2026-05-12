import { NextResponse } from "next/server";
import https from "node:https";
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
 * Obtiene las tasas oficial USD y EUR publicadas por el BCV (bancentralvenezuela).
 * bcv.org.ve no envía su certificado intermedio en el handshake TLS, por lo que
 * se usa un agente HTTPS con rejectUnauthorized:false exclusivamente para esta
 * petición (los datos recibidos son tasas de cambio públicas, sin información sensible).
 */

const MIN_RATE = 1;
const MAX_RATE = 100_000;

// Agente con SSL bypass quirúrgico: aplica solo a las peticiones que lo usen
const bcvAgent = new https.Agent({ rejectUnauthorized: false });

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent: bcvAgent,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
        },
      },
      (res) => {
        // Seguir redirecciones manualmente si fuera necesario
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          resolve(fetchHtml(res.headers.location));
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`HTTP error al contactar BCV: ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error("Timeout al contactar BCV (10s)"));
    });
  });
}

export async function GET() {
  try {
    const html = await fetchHtml("https://www.bcv.org.ve/");

    const $ = cheerio.load(html);

    const usdText = $("#dolar .centrado strong").text().trim();
    const eurText = $("#euro .centrado strong").text().trim();

    if (!usdText || !eurText) {
      throw new Error(
        `No se encontraron tasas en el HTML. USD: "${usdText}", EUR: "${eurText}"`,
      );
    }

    const usdRate = parseFloat(usdText.replace(",", "."));
    const eurRate = parseFloat(eurText.replace(",", "."));

    if (isNaN(usdRate) || isNaN(eurRate)) {
      throw new Error(
        `Valores no numéricos: USD="${usdText}", EUR="${eurText}"`,
      );
    }

    if (
      usdRate < MIN_RATE ||
      usdRate > MAX_RATE ||
      eurRate < MIN_RATE ||
      eurRate > MAX_RATE
    ) {
      throw new Error(
        `Tasas fuera de rango [${MIN_RATE}, ${MAX_RATE}]: USD=${usdRate}, EUR=${eurRate}`,
      );
    }

    return NextResponse.json({
      dolar: usdRate,
      euro: eurRate,
      lastUpdated: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    console.error("Error en scraping BCV:", error);
    if (error instanceof Error && error.cause) {
      console.error("Causa raíz:", error.cause);
    }
    const message =
      error instanceof Error
        ? `${error.message} | causa: ${JSON.stringify(error.cause)}`
        : `${error}`;
    return NextResponse.json(
      {
        dolar: null,
        euro: null,
        lastUpdated: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
