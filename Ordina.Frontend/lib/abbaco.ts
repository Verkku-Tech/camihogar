import { parseCsvToRecords } from "./csv";

const DATA_DIR = "/data/abbaco";

export interface AbbacoLineView {
  linea: string;
  descripcion: string;
  precio: string;
  cantidad: string;
  descuento: string;
  total: string;
}

export interface AbbacoClientView {
  nombre: string;
  rif: string;
  apodo: string;
  correo: string;
  telefono: string;
  telefono2: string;
  direccion: string;
  poblacion: string;
  pais: string;
}

export interface AbbacoOrderView {
  abaccoId: string;
  codigo: string;
  tercero: string;
  fechaPedido: string;
  baseImponible: string;
  importeIva: string;
  importeTotal: string;
  divisa: string;
  autor: string;
  estado: string;
  facturado: string;
  lines: AbbacoLineView[];
  client: AbbacoClientView | null;
}

async function fetchCsv(name: string): Promise<string> {
  const res = await fetch(`${DATA_DIR}/${name}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${name} (${res.status})`);
  }
  return res.text();
}

/** Carga los CSV de Abbaco (snapshot estático) y devuelve los pedidos con sus líneas y cliente resuelto. */
export async function loadAbbacoOrders(): Promise<AbbacoOrderView[]> {
  const [pedidosText, lineasText, clientesText] = await Promise.all([
    fetchCsv("pedidos.csv"),
    fetchCsv("pedidos_lineas.csv"),
    fetchCsv("clientes.csv"),
  ]);

  const pedidos = parseCsvToRecords(pedidosText);
  const lineas = parseCsvToRecords(lineasText);
  const clientes = parseCsvToRecords(clientesText);

  const lineasByOrder = new Map<string, AbbacoLineView[]>();
  for (const l of lineas) {
    const id = (l["abacco_id"] ?? "").trim();
    if (!id) continue;
    const arr = lineasByOrder.get(id) ?? [];
    arr.push({
      linea: l["linea"] ?? "",
      descripcion: l["descripcion"] ?? "",
      precio: l["precio_unitario"] ?? "",
      cantidad: l["cantidad"] ?? "",
      descuento: l["descuento"] ?? "",
      total: l["total_bruto"] ?? "",
    });
    lineasByOrder.set(id, arr);
  }

  const clientBySocid = new Map<string, AbbacoClientView>();
  for (const c of clientes) {
    const socid = (c["abacco_socid"] ?? "").trim();
    if (!socid || clientBySocid.has(socid)) continue;
    clientBySocid.set(socid, {
      nombre: c["Nombre del tercero"] ?? "",
      rif: c["RIF / C.I"] ?? "",
      apodo: c["Apodo"] ?? "",
      correo: c["Correo"] ?? "",
      telefono: c["Teléfono"] ?? "",
      telefono2: c["Telefono 2"] ?? "",
      direccion: c["Dreccion de envio"] ?? "",
      poblacion: c["Población"] ?? "",
      pais: c["País"] ?? "",
    });
  }

  const orders: AbbacoOrderView[] = [];
  for (const p of pedidos) {
    const abaccoId = (p["abacco_id"] ?? "").trim();
    const socid = (p["abacco_socid"] ?? "").trim();
    orders.push({
      abaccoId,
      codigo: p["Código"] ?? "",
      tercero: p["Tercero"] ?? "",
      fechaPedido: p["Fecha de pedido"] ?? "",
      baseImponible: p["Base imponible"] ?? "",
      importeIva: p["Importe IVA"] ?? "",
      importeTotal: p["Importe total"] ?? "",
      divisa: p["Divisa"] ?? "",
      autor: p["Autor"] ?? "",
      estado: p["Estado"] ?? "",
      facturado: p["Facturado"] ?? "",
      lines: lineasByOrder.get(abaccoId) ?? [],
      client: clientBySocid.get(socid) ?? null,
    });
  }

  return orders;
}

/** Normaliza la divisa de Abbaco (ej. "USD - Dólares USA" → "USD"). */
export function normalizeDivisa(divisa: string): string {
  const v = (divisa ?? "").trim();
  if (!v || v.toLowerCase() === "divisa") return "—";
  return v.split("-")[0].trim();
}
