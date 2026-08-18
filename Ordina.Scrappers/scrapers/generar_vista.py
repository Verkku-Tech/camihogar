"""Genera vistas HTML de revisión para todos los CSV de migración."""

from __future__ import annotations

import csv
import html
import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from scrape_utils import (
    CLIENTES_CSV_HEADERS,
    DATA_DIR,
    DIR_CLIENTES,
    DIR_PEDIDOS,
    DIR_USUARIOS,
    PEDIDOS_CSV_HEADERS,
    PEDIDOS_LINEAS_CSV_HEADERS,
)


@dataclass
class VistaConfig:
    dataset_id: str
    title: str
    subtitle: str
    csv_path: str
    html_path: str
    search_placeholder: str
    sticky_keys: list[str] = field(default_factory=list)
    badge_keys: set[str] = field(default_factory=set)
    date_keys: set[str] = field(default_factory=set)
    num_keys: set[str] = field(default_factory=set)
    label_map: dict[str, str] = field(default_factory=dict)
    headers: list[str] | None = None
    stats_builder: Callable[[list[dict[str, str]]], list[tuple[str, int | float | str]]] | None = None


def _column_type(header: str, config: VistaConfig) -> str:
    if header in config.badge_keys:
        return "badge"
    if header in config.date_keys:
        return "date"
    if header in config.num_keys:
        return "num"
    return "text"


def _column_label(header: str, config: VistaConfig) -> str:
    if not header:
        return "(vacío)"
    return config.label_map.get(header, header)


def _build_columns(headers: list[str], config: VistaConfig) -> list[dict[str, str]]:
    return [
        {
            "key": header,
            "label": _column_label(header, config),
            "type": _column_type(header, config),
        }
        for header in headers
    ]


def _build_sticky_css(sticky_keys: list[str], headers: list[str]) -> str:
    if not sticky_keys:
        return ""

    positions: list[tuple[int, int]] = []
    left = 0
    for key in sticky_keys:
        if key not in headers:
            continue
        index = headers.index(key) + 1
        width = 180 if "nombre" in key.lower() or "tercero" in key.lower() else 130
        if key in {"abacco_socid", "abacco_id", "linea"}:
            width = 72
        positions.append((index, width))

    rules: list[str] = []
    left = 0
    for index, width in positions:
        selector = f"th:nth-child({index}), td:nth-child({index})"
        rules.append(
            f"{selector} {{ position: sticky; left: {left}px; min-width: {width}px; z-index: 2; }}"
        )
        rules.append(f"thead {selector} {{ background: #f8fafc; z-index: 3; }}")
        rules.append(f"tbody {selector} {{ background: #fff; }}")
        rules.append(
            f"tbody tr:hover {selector} {{ background: #f8fbff; }}"
        )
        left += width
    return "\n    ".join(rules)


def _usuarios_stats(rows: list[dict[str, str]]) -> list[tuple[str, int | float | str]]:
    login_key = next((k for k in rows[0] if "login" in k.lower()), None) if rows else None
    email_key = next((k for k in rows[0] if "mail" in k.lower() or "correo" in k.lower()), None) if rows else None
    stats: list[tuple[str, int | float | str]] = [("Total usuarios", len(rows))]
    if login_key:
        stats.append(("Con login", sum(1 for r in rows if (r.get(login_key) or "").strip())))
    if email_key:
        stats.append(("Con correo", sum(1 for r in rows if (r.get(email_key) or "").strip())))
    return stats


def _default_stats(label: str) -> Callable[[list[dict[str, str]]], list[tuple[str, int | float | str]]]:
    def builder(rows: list[dict[str, str]]) -> list[tuple[str, int | float | str]]:
        return [(label, len(rows))]

    return builder


def _resolve_usuarios_sticky(headers: list[str]) -> list[str]:
    preferred = ["Login", "Nombre", "Apellidos", "Correo", "Email"]
    sticky = [h for h in preferred if h in headers]
    return sticky[:3]


def _clientes_stats(rows: list[dict[str, str]]) -> list[tuple[str, int | float | str]]:
    return [
        ("Total clientes", len(rows)),
        ("Con correo", sum(1 for r in rows if (r.get("Correo") or "").strip())),
        ("Con dirección", sum(1 for r in rows if (r.get("Dreccion de envio") or "").strip())),
        ("Estado Abierta", sum(1 for r in rows if (r.get("Estado") or "").lower() == "abierta")),
    ]


def _pedidos_stats(rows: list[dict[str, str]]) -> list[tuple[str, int | float | str]]:
    total_base = 0.0
    for row in rows:
        raw = (row.get("Base imponible") or row.get("Importe total") or "").replace(".", "").replace(",", ".")
        try:
            total_base += float(raw)
        except ValueError:
            pass
    return [
        ("Total pedidos", len(rows)),
        ("Con tercero", sum(1 for r in rows if (r.get("Tercero") or "").strip())),
        ("No ENTREGADOS", len(rows)),
        ("Facturados", sum(1 for r in rows if (r.get("Facturado") or "").strip())),
        ("Importe acumulado", f"{total_base:,.2f}"),
    ]


def _lineas_stats(rows: list[dict[str, str]]) -> list[tuple[str, int | float | str]]:
    refs = {(r.get("referencia") or "").strip() for r in rows if (r.get("referencia") or "").strip()}
    return [
        ("Total líneas", len(rows)),
        ("Pedidos con líneas", len(refs)),
        ("Con descripción", sum(1 for r in rows if (r.get("descripcion") or "").strip())),
        ("Con cantidad", sum(1 for r in rows if (r.get("cantidad") or "").strip())),
    ]


VISTA_CONFIGS: dict[str, VistaConfig] = {
    "clientes": VistaConfig(
        dataset_id="clientes",
        title="Clientes",
        subtitle="Terceros exportados desde Abacco (sys.abacco.com)",
        csv_path=os.path.join(DIR_CLIENTES, "clientes.csv"),
        html_path=os.path.join(DIR_CLIENTES, "vista.html"),
        search_placeholder="Buscar por nombre, RIF, teléfono, correo, dirección…",
        sticky_keys=["abacco_socid", "Nombre del tercero", "RIF / C.I"],
        badge_keys={"Estado"},
        date_keys={"Fecha de creación", "Fecha modif."},
        num_keys={"abacco_socid", "ID de importación", "Empleados"},
        label_map={"abacco_socid": "ID Abacco"},
        headers=CLIENTES_CSV_HEADERS,
        stats_builder=_clientes_stats,
    ),
    "pedidos": VistaConfig(
        dataset_id="pedidos",
        title="Pedidos",
        subtitle="Cabeceras de pedidos para migración",
        csv_path=os.path.join(DIR_PEDIDOS, "pedidos.csv"),
        html_path=os.path.join(DIR_PEDIDOS, "vista.html"),
        search_placeholder="Buscar por código, tercero, fabricante, estado fabricación…",
        sticky_keys=["abacco_id", "Código", "Tercero"],
        badge_keys={"Estado", "Estado de fabricacion", "Facturado"},
        date_keys={"Fecha de pedido", "Fecha prevista de entrega"},
        num_keys={"abacco_id", "Base imponible", "Importe IVA", "Importe total"},
        label_map={"abacco_id": "ID Abacco", "abacco_socid": "ID Cliente"},
        headers=PEDIDOS_CSV_HEADERS,
        stats_builder=_pedidos_stats,
    ),
    "pedidos_lineas": VistaConfig(
        dataset_id="pedidos_lineas",
        title="Líneas de pedido",
        subtitle="Detalle de productos por pedido",
        csv_path=os.path.join(DIR_PEDIDOS, "pedidos_lineas.csv"),
        html_path=os.path.join(DIR_PEDIDOS, "vista_lineas.html"),
        search_placeholder="Buscar por referencia, descripción, cantidad…",
        sticky_keys=["referencia", "linea", "descripcion"],
        num_keys={"linea", "cantidad", "precio_unitario", "descuento", "total_bruto", "abacco_id"},
        headers=PEDIDOS_LINEAS_CSV_HEADERS,
        stats_builder=_lineas_stats,
    ),
    "usuarios": VistaConfig(
        dataset_id="usuarios",
        title="Usuarios",
        subtitle="Usuarios internos de Abacco",
        csv_path=os.path.join(DIR_USUARIOS, "usuarios.csv"),
        html_path=os.path.join(DIR_USUARIOS, "vista.html"),
        search_placeholder="Buscar por login, nombre, email, perfil…",
        sticky_keys=[],
        stats_builder=_usuarios_stats,
    ),
}


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CamiHogar — __TITLE__</title>
  <style>
    :root {
      --bg: #f4f6f9;
      --card: #ffffff;
      --text: #1a2332;
      --muted: #5c6b7a;
      --accent: #2563eb;
      --border: #e2e8f0;
      --ok: #059669;
      --ok-bg: #d1fae5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 1400px; margin: 0 auto; padding: 24px 20px 48px; }
    .nav {
      margin-bottom: 16px;
      font-size: 0.9rem;
    }
    .nav a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    .nav a:hover { text-decoration: underline; }
    header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: #fff;
      padding: 28px 32px;
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
    }
    header h1 { margin: 0 0 8px; font-size: 1.6rem; font-weight: 700; }
    header p { margin: 0; opacity: 0.9; font-size: 0.95rem; }
    .meta { margin-top: 12px; font-size: 0.85rem; opacity: 0.85; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
    }
    .stat label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .stat strong { font-size: 1.5rem; font-weight: 700; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
    }
    .toolbar input[type="search"] {
      flex: 1;
      min-width: 220px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.95rem;
    }
    .toolbar select {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    .toolbar .info { color: var(--muted); font-size: 0.9rem; margin-left: auto; }
    .table-wrap {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      max-height: 70vh;
    }
    table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    thead { position: sticky; top: 0; z-index: 1; }
    th {
      background: #f8fafc;
      text-align: left;
      padding: 12px 14px;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--muted);
    }
    td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      max-width: 220px;
      word-break: break-word;
    }
    __STICKY_CSS__
    tbody tr:hover { background: #f8fbff; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--ok-bg);
      color: var(--ok);
    }
    .empty { color: var(--muted); font-style: italic; }
    .pager {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: center;
      margin-top: 16px;
    }
    .pager button {
      padding: 8px 14px;
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .pager button:disabled { opacity: 0.45; cursor: not-allowed; }
    .pager button:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
    .pager span { color: var(--muted); font-size: 0.9rem; }
    footer {
      margin-top: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 0.82rem;
    }
    @media print {
      .toolbar, .pager, .nav { display: none; }
      header { background: #1e3a5f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="nav"><a href="../index.html">← Volver al índice de migración</a></div>
    <header>
      <h1>CamiHogar — __TITLE__</h1>
      <p>__SUBTITLE__</p>
      <div class="meta">Generado: __GENERATED_AT__ · Fuente: __CSV_SOURCE__</div>
    </header>

    <div class="stats" id="stats"></div>

    <div class="toolbar">
      <input type="search" id="search" placeholder="__SEARCH_PLACEHOLDER__" autocomplete="off">
      <select id="pageSize">
        <option value="25">25 por página</option>
        <option value="50" selected>50 por página</option>
        <option value="100">100 por página</option>
      </select>
      <span class="info" id="resultInfo"></span>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr id="headRow"></tr></thead>
        <tbody id="body"></tbody>
      </table>
    </div>

    <div class="pager">
      <button type="button" id="prev">Anterior</button>
      <span id="pageLabel"></span>
      <button type="button" id="next">Siguiente</button>
    </div>

    <footer>Vista de revisión — CamiHogar / Verkku</footer>
  </div>

  <script>
    const COLUMNS = __COLUMNS_JSON__;
    const ROWS = __ROWS_JSON__;
    const STATS = __STATS_JSON__;

    let filtered = ROWS.slice();
    let page = 1;
    let pageSize = 50;

    function esc(value) {
      const d = document.createElement("div");
      d.textContent = value ?? "";
      return d.innerHTML;
    }

    function formatStatValue(value) {
      if (typeof value === "number") return value.toLocaleString("es-VE");
      return String(value);
    }

    function renderStats() {
      document.getElementById("stats").innerHTML = STATS.map(([label, val]) =>
        `<div class="stat"><label>${esc(label)}</label><strong>${esc(formatStatValue(val))}</strong></div>`
      ).join("");
    }

    function renderHead() {
      document.getElementById("headRow").innerHTML = COLUMNS
        .map(c => `<th>${esc(c.label)}</th>`).join("");
    }

    function renderCell(row, col) {
      const val = row[col.key] || "";
      if (!val) return `<td><span class="empty">—</span></td>`;
      if (col.type === "badge") return `<td><span class="badge">${esc(val)}</span></td>`;
      return `<td>${esc(val)}</td>`;
    }

    function renderTable() {
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (page > totalPages) page = totalPages;
      const start = (page - 1) * pageSize;
      const slice = filtered.slice(start, start + pageSize);
      document.getElementById("body").innerHTML = slice.map(row =>
        `<tr>${COLUMNS.map(c => renderCell(row, c)).join("")}</tr>`
      ).join("") || `<tr><td colspan="${COLUMNS.length}">Sin resultados</td></tr>`;
      document.getElementById("pageLabel").textContent = `Página ${page} de ${totalPages}`;
      document.getElementById("resultInfo").textContent =
        `${filtered.length.toLocaleString("es-VE")} registros mostrados`;
      document.getElementById("prev").disabled = page <= 1;
      document.getElementById("next").disabled = page >= totalPages;
    }

    function applyFilter(q) {
      const term = q.trim().toLowerCase();
      filtered = !term
        ? ROWS.slice()
        : ROWS.filter(row => COLUMNS.some(c => (row[c.key] || "").toLowerCase().includes(term)));
      page = 1;
      renderTable();
    }

    document.getElementById("search").addEventListener("input", e => applyFilter(e.target.value));
    document.getElementById("pageSize").addEventListener("change", e => {
      pageSize = Number(e.target.value);
      page = 1;
      renderTable();
    });
    document.getElementById("prev").addEventListener("click", () => { page--; renderTable(); });
    document.getElementById("next").addEventListener("click", () => { page++; renderTable(); });

    renderStats();
    renderHead();
    renderTable();
  </script>
</body>
</html>
"""


INDEX_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CamiHogar — Migración Abacco</title>
  <style>
    :root {
      --bg: #f4f6f9;
      --card: #ffffff;
      --text: #1a2332;
      --muted: #5c6b7a;
      --accent: #2563eb;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 48px; }
    header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: #fff;
      padding: 32px;
      border-radius: 16px;
      margin-bottom: 28px;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25);
    }
    header h1 { margin: 0 0 8px; font-size: 1.8rem; }
    header p { margin: 0; opacity: 0.9; }
    .meta { margin-top: 12px; font-size: 0.85rem; opacity: 0.85; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .card h2 { margin: 0; font-size: 1.15rem; }
    .card p { margin: 0; color: var(--muted); font-size: 0.92rem; flex: 1; }
    .card .count {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }
    .card .status {
      font-size: 0.82rem;
      color: var(--muted);
    }
    .card a {
      display: inline-block;
      margin-top: 6px;
      padding: 10px 16px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      width: fit-content;
    }
    .card a:hover { filter: brightness(1.08); }
    .card.missing .count { color: var(--muted); font-size: 1.2rem; }
    .card.missing a {
      background: #94a3b8;
      pointer-events: none;
    }
    footer {
      margin-top: 32px;
      text-align: center;
      color: var(--muted);
      font-size: 0.82rem;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>CamiHogar — Migración Abacco</h1>
      <p>Vistas de revisión para validar datos antes de importar a MongoDB</p>
      <div class="meta">Índice generado: __GENERATED_AT__</div>
    </header>

    <div class="grid">
      __CARDS__
    </div>

    <footer>Vista de revisión — CamiHogar / Verkku</footer>
  </div>
</body>
</html>
"""


def load_rows(csv_path: str) -> tuple[list[str], list[dict[str, str]]]:
    with open(csv_path, encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = list(reader.fieldnames or [])
        rows = [dict(row) for row in reader]
    return headers, rows


def _resolve_headers(config: VistaConfig, csv_headers: list[str]) -> list[str]:
    if config.headers:
        return config.headers
    return csv_headers


def generar_vista_dataset(
    dataset_id: str,
    csv_path: str | None = None,
    html_path: str | None = None,
) -> str | None:
    if dataset_id not in VISTA_CONFIGS:
        raise ValueError(f"Dataset desconocido: {dataset_id}")

    config = VISTA_CONFIGS[dataset_id]
    csv_path = csv_path or config.csv_path
    html_path = html_path or config.html_path

    if not os.path.isfile(csv_path):
        print(f"Vista omitida ({dataset_id}): no existe {csv_path}")
        return None

    csv_headers, rows = load_rows(csv_path)
    headers = _resolve_headers(config, csv_headers)
    columns = _build_columns(headers, config)
    stats_builder = config.stats_builder or _default_stats(f"Total {config.title.lower()}")
    stats = stats_builder(rows)
    sticky_keys = config.sticky_keys
    if dataset_id == "usuarios" and not sticky_keys:
        sticky_keys = _resolve_usuarios_sticky(headers)

    content = (
        HTML_TEMPLATE.replace("__TITLE__", html.escape(config.title))
        .replace("__SUBTITLE__", html.escape(config.subtitle))
        .replace("__GENERATED_AT__", html.escape(datetime.now().strftime("%d/%m/%Y %H:%M")))
        .replace("__CSV_SOURCE__", html.escape(os.path.basename(csv_path)))
        .replace("__SEARCH_PLACEHOLDER__", html.escape(config.search_placeholder))
        .replace("__STICKY_CSS__", _build_sticky_css(sticky_keys, headers))
        .replace("__COLUMNS_JSON__", json.dumps(columns, ensure_ascii=False))
        .replace("__ROWS_JSON__", json.dumps(rows, ensure_ascii=False))
        .replace("__STATS_JSON__", json.dumps(stats, ensure_ascii=False))
    )

    os.makedirs(os.path.dirname(html_path) or ".", exist_ok=True)
    with open(html_path, "w", encoding="utf-8") as handle:
        handle.write(content)

    if dataset_id == "clientes":
        legacy_path = os.path.join(os.path.dirname(html_path), "vista_clientes.html")
        with open(legacy_path, "w", encoding="utf-8") as handle:
            handle.write(content)

    print(f"Vista HTML ({dataset_id}): {len(rows)} registros -> {html_path}")
    return html_path


def _count_csv_rows(csv_path: str) -> int | None:
    if not os.path.isfile(csv_path):
        return None
    with open(csv_path, encoding="utf-8", newline="") as handle:
        return max(0, sum(1 for _ in handle) - 1)


def _file_mtime_label(path: str) -> str:
    if not os.path.isfile(path):
        return "Sin datos"
    mtime = datetime.fromtimestamp(os.path.getmtime(path))
    return mtime.strftime("%d/%m/%Y %H:%M")


def generar_indice(html_path: str | None = None) -> str:
    html_path = html_path or os.path.join(DATA_DIR, "index.html")
    cards: list[str] = []

    index_items = [
        ("clientes", "Clientes", "Terceros y datos de contacto", "clientes/vista.html"),
        ("pedidos", "Pedidos", "Cabeceras de pedidos", "pedidos/vista.html"),
        ("pedidos_lineas", "Líneas de pedido", "Productos por pedido", "pedidos/vista_lineas.html"),
        ("usuarios", "Usuarios", "Usuarios internos de Abacco", "usuarios/vista.html"),
    ]

    for dataset_id, title, description, link in index_items:
        config = VISTA_CONFIGS[dataset_id]
        count = _count_csv_rows(config.csv_path)
        missing = count is None
        card_class = "card missing" if missing else "card"
        count_html = "Pendiente de extracción" if missing else f"{count:,}".replace(",", ".")
        status = "CSV no encontrado" if missing else f"CSV: {os.path.basename(config.csv_path)} · {_file_mtime_label(config.csv_path)}"

        cards.append(
            f"""<article class="{card_class}">
      <h2>{html.escape(title)}</h2>
      <p>{html.escape(description)}</p>
      <div class="count">{count_html}</div>
      <div class="status">{html.escape(status)}</div>
      <a href="{html.escape(link)}">Abrir vista</a>
    </article>"""
        )

    content = (
        INDEX_TEMPLATE.replace("__GENERATED_AT__", html.escape(datetime.now().strftime("%d/%m/%Y %H:%M")))
        .replace("__CARDS__", "\n      ".join(cards))
    )

    os.makedirs(os.path.dirname(html_path) or ".", exist_ok=True)
    with open(html_path, "w", encoding="utf-8") as handle:
        handle.write(content)

    print(f"Indice de vistas generado -> {html_path}")
    return html_path


def generar_vistas(
    datasets: list[str] | None = None,
    incluir_indice: bool = True,
) -> list[str]:
    dataset_ids = datasets or list(VISTA_CONFIGS.keys())
    generated: list[str] = []
    for dataset_id in dataset_ids:
        path = generar_vista_dataset(dataset_id)
        if path:
            generated.append(path)
    if incluir_indice:
        generated.append(generar_indice())
    return generated


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Genera vistas HTML desde los CSV de migración.")
    parser.add_argument(
        "--solo",
        choices=list(VISTA_CONFIGS.keys()),
        help="Generar solo un dataset.",
    )
    parser.add_argument("--sin-indice", action="store_true", help="No regenerar index.html.")
    args = parser.parse_args()

    datasets = [args.solo] if args.solo else None
    generar_vistas(datasets=datasets, incluir_indice=not args.sin_indice)
