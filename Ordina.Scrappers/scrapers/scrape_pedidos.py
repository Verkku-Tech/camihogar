"""Scraper de pedidos: cabecera completa + lineas de producto.

Solo incluye pedidos cuyo Estado de fabricacion NO sea ENTREGADOS.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import time

from LoginSysAbacco import login_abacco
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from scrape_utils import (
    DIR_PEDIDOS,
    PEDIDOS_CSV_HEADERS,
    PEDIDOS_HEADER_ALIASES,
    PEDIDOS_LINEAS_CSV_HEADERS,
    get_row_value,
    iter_tagtable_pages,
    parse_money,
    save_csv,
    select_columns,
    select_table_limit,
    wait_for_table,
)

LIST_URL = "https://sys.abacco.com/commande/list.php?sortfield=c.date_commande&sortorder=DESC"
ESTADO_FABRICACION_EXCLUIDO = "ENTREGADOS"
CHECKPOINT_EVERY = 50

# Columnas del listado necesarias para filtrar/exportar cabecera.
LISTADO_COLUMNAS = [
    "Código",
    "Ref. pedido para el cliente",
    "Tercero",
    "Población",
    "Código postal",
    "Fecha de pedido",
    "Fecha prevista de entrega",
    "Base imponible",
    "Autor",
    "fabricante",
    "Estado de fabricacion",
    "Estado",
    "Facturado",
]

EXTRACT_PEDIDO_JS = """
function clean(text) {
    return (text || '').replace(/\\s+/g, ' ').trim();
}

function fieldValue(label) {
    var nodes = document.querySelectorAll(
        'table.border.tableforfield tr, .fichehalfleft tr, .fichehalfright tr, .fichecenter tr'
    );
    var target = clean(label).toLowerCase();
    for (var i = 0; i < nodes.length; i++) {
        var tds = nodes[i].querySelectorAll('td');
        if (tds.length < 2) continue;
        var key = clean(tds[0].innerText).toLowerCase();
        if (!key) continue;
        if (key === target || key.indexOf(target) === 0)
            return clean(tds[1].innerText);
    }
    return '';
}

function allFields() {
    var out = {};
    var nodes = document.querySelectorAll(
        'table.border.tableforfield tr, .fichehalfleft tr, .fichehalfright tr, .fichecenter tr'
    );
    for (var i = 0; i < nodes.length; i++) {
        var tds = nodes[i].querySelectorAll('td');
        if (tds.length < 2) continue;
        var key = clean(tds[0].innerText);
        if (!key) continue;
        if (!(key in out) || !out[key])
            out[key] = clean(tds[1].innerText);
    }
    return out;
}

var referencia = '';
var refNode = document.querySelector('.refidno, .refid, .refidval');
if (refNode) {
    var refText = clean(refNode.innerText);
    var refMatch = refText.match(/(COM?\\d+-\\d+|PROV\\d+|PR\\d+-\\d+|CO\\d+-\\d+)/i);
    referencia = refMatch ? refMatch[1] : refText.split(' ')[0];
}

var clienteLink = document.querySelector('a[href*="socid="]');
var socid = '';
var cliente = '';
if (clienteLink) {
    cliente = clean(clienteLink.innerText);
    var m = (clienteLink.getAttribute('href') || '').match(/socid=(\\d+)/);
    if (m) socid = m[1];
}

var estado = '';
var badge = document.querySelector('.statusref .badge, .badge-status, .badge');
if (badge) estado = clean(badge.innerText);

var campos = allFields();

var lineas = [];
var table = document.querySelector('#tablelines');
var lineRows = table
    ? table.querySelectorAll('tr.oddeven, tr.pair, tr.impair, tr.lineodservice')
    : [];

for (var r = 0; r < lineRows.length; r++) {
    var tr = lineRows[r];
    if (tr.querySelector('input[name="mode"], input[name="prod_entry_mode"]')) continue;
    if (tr.classList.contains('liste_titre') || tr.classList.contains('liste_total')) continue;

    var tds = tr.querySelectorAll('td');
    if (tds.length < 4) continue;

    var desc = clean(tds[0].innerText);
    if (!desc) continue;
    if (/^descrip/i.test(desc)) continue;
    if (/^(fabricante|observaciones|estatus|total)$/i.test(desc)) continue;
    if (desc.indexOf('Entrada libre del tipo Producto') >= 0) continue;

    // Columnas tipicas Dolibarr: Desc | IVA | P.U. | Cant | Dto | Total bruto
    // A veces hay columnas extra al inicio/final; tomar las 6 ultimas utiles.
    var iva = '';
    var pu = '';
    var cant = '';
    var dto = '';
    var total = '';
    if (tds.length >= 6) {
        iva = clean(tds[tds.length - 5].innerText);
        pu = clean(tds[tds.length - 4].innerText);
        cant = clean(tds[tds.length - 3].innerText);
        dto = clean(tds[tds.length - 2].innerText);
        total = clean(tds[tds.length - 1].innerText);
    } else {
        iva = clean(tds[1].innerText);
        pu = clean(tds[2].innerText);
        cant = clean(tds[3].innerText);
        total = clean(tds[tds.length - 1].innerText);
    }

    lineas.push({
        descripcion: desc,
        iva: iva,
        precio_unitario: pu,
        cantidad: cant,
        descuento: dto,
        total_bruto: total
    });
}

return {
    referencia: referencia,
    abacco_socid: socid,
    cliente_nombre: cliente,
    estado: estado,
    descuento: fieldValue('Descuento') || campos['Descuento'] || '',
    fecha: fieldValue('Fecha') || campos['Fecha'] || '',
    fecha_entrega: fieldValue('Fecha prevista de entrega') || campos['Fecha prevista de entrega'] || '',
    condiciones_pago: fieldValue('Condiciones de pago') || campos['Condiciones de pago'] || '',
    tipo_entrega: fieldValue('Tipo entrega') || campos['Tipo entrega'] || '',
    origen: fieldValue('Origen') || campos['Origen'] || '',
    incoterm: fieldValue('Incoterm') || campos['Incoterm'] || '',
    fabricante: fieldValue('Fabricante') || campos['Fabricante'] || '',
    estado_fabricacion: fieldValue('Estado de fabricación') || fieldValue('Estado de fabricacion')
        || campos['Estado de fabricación'] || campos['Estado de fabricacion'] || '',
    cuota_transporte: fieldValue('Cuota de transporte') || campos['Cuota de transporte'] || '',
    base_imponible: fieldValue('Base imponible') || campos['Base imponible'] || '',
    importe_iva: fieldValue('Importe IVA') || campos['Importe IVA'] || '',
    importe_total: fieldValue('Importe total') || fieldValue('Total TTC') || campos['Importe total'] || '',
    divisa: fieldValue('Divisa') || campos['Divisa'] || '',
    campos: campos,
    lineas: lineas
};
"""


def _norm_estado_fab(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip()).upper()


def _is_entregado(order: dict[str, str]) -> bool:
    return _norm_estado_fab(order.get("Estado de fabricacion", "")) == ESTADO_FABRICACION_EXCLUIDO


def _parse_order_row(headers: list[str], item: dict) -> dict[str, str]:
    cells = item["cells"]
    raw = {headers[i]: cells[i] if i < len(cells) else "" for i in range(len(headers))}
    order: dict[str, str] = {"abacco_id": item.get("entityId", "")}
    for header in PEDIDOS_CSV_HEADERS:
        if header == "abacco_id":
            continue
        value = get_row_value(raw, header, PEDIDOS_HEADER_ALIASES)
        if header in {"Base imponible", "Importe IVA", "Importe total"} and value:
            value = parse_money(value)
        order[header] = value
    return order


def _order_to_csv_row(order: dict[str, str]) -> list[str]:
    return [order.get(header, "") for header in PEDIDOS_CSV_HEADERS]


def _order_referencia(order: dict[str, str]) -> str:
    return (
        order.get("Código", "")
        or order.get("Ref. pedido para el cliente", "")
        or ""
    )


def _collect_orders(driver, max_items: int | None = None) -> list[dict[str, str]]:
    orders: list[dict[str, str]] = []
    seen: set[str] = set()
    excluidos = 0

    for pagina, ui_page, resultado in iter_tagtable_pages(driver, id_param="id"):
        headers = resultado["headers"]
        nuevos = 0

        for item in resultado["rows"]:
            order_id = item.get("entityId", "")
            if not order_id or order_id in seen:
                continue
            seen.add(order_id)
            order = _parse_order_row(headers, item)
            if _is_entregado(order):
                excluidos += 1
                continue
            orders.append(order)
            nuevos += 1
            if max_items is not None and len(orders) >= max_items:
                break

        print(
            f"Listado pedidos pagina {pagina} (UI: {ui_page}): "
            f"+{nuevos} validos (acumulado: {len(orders)}, excluidos ENTREGADOS: {excluidos})"
        )

        if max_items is not None and len(orders) >= max_items:
            break

    if max_items is not None:
        return orders[:max_items]
    return orders


def _is_valid_line(descripcion: str) -> bool:
    if not descripcion:
        return False
    if "Entrada libre del tipo Producto" in descripcion:
        return False
    # Evitar filas basura del catalogo de productos en borradores.
    if descripcion.count("Sin IVA - Stock:") > 1:
        return False
    return True


def _extract_order_detail(driver, order_id: str) -> dict:
    driver.get(f"https://sys.abacco.com/commande/card.php?id={order_id}")
    WebDriverWait(driver, 30).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".fiche, table.border, #tablelines")
    )
    time.sleep(0.5)
    detail = driver.execute_script(EXTRACT_PEDIDO_JS) or {}
    detail["abacco_id"] = order_id
    for money_key in ("base_imponible", "importe_iva", "importe_total"):
        if detail.get(money_key):
            detail[money_key] = parse_money(detail[money_key])
    return detail


def _merge_detail_into_order(order: dict[str, str], detail: dict) -> None:
    """Completa la cabecera del pedido con todos los campos de la ficha."""
    mapping = {
        "Código": detail.get("referencia"),
        "Tercero": detail.get("cliente_nombre"),
        "abacco_socid": detail.get("abacco_socid"),
        "Fecha de pedido": detail.get("fecha"),
        "Fecha prevista de entrega": detail.get("fecha_entrega"),
        "Descuento": detail.get("descuento"),
        "Condiciones de pago": detail.get("condiciones_pago"),
        "Tipo entrega": detail.get("tipo_entrega"),
        "Origen": detail.get("origen"),
        "Incoterm": detail.get("incoterm"),
        "Cuota de transporte": detail.get("cuota_transporte"),
        "Base imponible": detail.get("base_imponible"),
        "Importe IVA": detail.get("importe_iva"),
        "Importe total": detail.get("importe_total"),
        "Divisa": detail.get("divisa"),
        "fabricante": detail.get("fabricante"),
        "Estado de fabricacion": detail.get("estado_fabricacion"),
        "Estado": detail.get("estado"),
    }
    for key, value in mapping.items():
        if value and not (order.get(key) or "").strip():
            order[key] = value
        elif value and key in {
            "Descuento",
            "Condiciones de pago",
            "Tipo entrega",
            "Origen",
            "Incoterm",
            "Cuota de transporte",
            "Importe IVA",
            "Importe total",
            "Divisa",
            "abacco_socid",
            "Estado de fabricacion",
            "fabricante",
            "Estado",
        }:
            # Campos de ficha: preferir valor del detalle.
            order[key] = value


def _resolve_list_limit(max_pedidos: int | None) -> str | None:
    """Con --max pequeño no recargar 5000 filas: la pagina tarda mucho en responder."""
    if max_pedidos is None:
        return "5000"
    if max_pedidos <= 50:
        return None
    return str(min(max(max_pedidos * 2, 50), 500))


def _load_progreso(salida_dir: str) -> tuple[list[list[str]], list[list[str]], set[str]]:
    """Recupera filas ya exportadas y los ids ya procesados (para reanudar)."""
    ruta_pedidos = os.path.join(salida_dir, "pedidos.csv")
    ruta_lineas = os.path.join(salida_dir, "pedidos_lineas.csv")

    pedidos_rows: list[list[str]] = []
    lineas_rows: list[list[str]] = []
    done_ids: set[str] = set()

    if os.path.isfile(ruta_pedidos):
        with open(ruta_pedidos, encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle)
            header = next(reader, None)
            if header == PEDIDOS_CSV_HEADERS:
                for row in reader:
                    if not row:
                        continue
                    pedidos_rows.append(row)
                    if row[0]:
                        done_ids.add(row[0])

    if os.path.isfile(ruta_lineas):
        with open(ruta_lineas, encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle)
            next(reader, None)
            for row in reader:
                if row:
                    lineas_rows.append(row)

    return pedidos_rows, lineas_rows, done_ids


def _guardar_checkpoint(
    salida_dir: str,
    pedidos_rows: list[list[str]],
    lineas_rows: list[list[str]],
) -> None:
    ruta_pedidos = os.path.join(salida_dir, "pedidos.csv")
    ruta_lineas = os.path.join(salida_dir, "pedidos_lineas.csv")
    save_csv(ruta_pedidos, PEDIDOS_CSV_HEADERS, pedidos_rows, refresh_vista=False, refresh_index=False)
    save_csv(ruta_lineas, PEDIDOS_LINEAS_CSV_HEADERS, lineas_rows, refresh_vista=False, refresh_index=False)


def scrape_pedidos(
    salida_dir: str | None = None,
    max_pedidos: int | None = None,
    omitir_detalle: bool = False,
    reiniciar: bool = False,
) -> tuple[str, str]:
    if salida_dir is None:
        salida_dir = DIR_PEDIDOS
    os.makedirs(salida_dir, exist_ok=True)

    pedidos_rows: list[list[str]] = []
    lineas_rows: list[list[str]] = []
    done_ids: set[str] = set()
    if reiniciar:
        print("Modo reinicio: se ignora cualquier CSV previo en la carpeta de salida.")
    else:
        pedidos_rows, lineas_rows, done_ids = _load_progreso(salida_dir)
        if done_ids:
            print(f"Reanudando: {len(done_ids)} pedidos ya procesados en {salida_dir}.")

    driver = login_abacco(headless=True)
    print("Cargando listado de pedidos...")
    driver.get(LIST_URL)
    time.sleep(3)
    print("Esperando tabla del listado...")
    wait_for_table(driver, min_rows=5)
    select_columns(driver, LISTADO_COLUMNAS)

    list_limit = _resolve_list_limit(max_pedidos)
    if list_limit:
        print(f"Ajustando limite de pagina a {list_limit}...")
        select_table_limit(driver, list_limit)
    else:
        print("Usando limite por defecto del listado (prueba rapida).")

    print(f"Recopilando pedidos (excluye Estado de fabricacion = {ESTADO_FABRICACION_EXCLUIDO})...")
    orders = _collect_orders(driver, max_items=max_pedidos)
    print(f"Pedidos a procesar (no ENTREGADOS): {len(orders)}")

    pendientes = [o for o in orders if o["abacco_id"] not in done_ids]
    if done_ids:
        print(f"Pendientes de detalle: {len(pendientes)} (ya procesados: {len(orders) - len(pendientes)})")

    excluidos_detalle = 0
    total_pendientes = len(pendientes)

    for index, order in enumerate(pendientes, start=1):
        order_id = order["abacco_id"]

        if omitir_detalle:
            if _is_entregado(order):
                excluidos_detalle += 1
                continue
            pedidos_rows.append(_order_to_csv_row(order))
        else:
            print(f"Procesando detalle {index}/{total_pendientes} (id={order_id})...")
            try:
                detail = _extract_order_detail(driver, order_id)
            except Exception as exc:
                print(f"Pedido {order_id}: error en detalle ({exc}), se usa solo listado.")
                detail = {"lineas": []}

            _merge_detail_into_order(order, detail)

            # Doble chequeo con el valor de la ficha.
            if _is_entregado(order):
                excluidos_detalle += 1
                print(f"  -> omitido (Estado de fabricacion = ENTREGADOS)")
                continue

            pedidos_rows.append(_order_to_csv_row(order))

            referencia = _order_referencia(order) or detail.get("referencia", "")
            for line_num, linea in enumerate(detail.get("lineas", []), start=1):
                descripcion = re.sub(r"\s+", " ", linea.get("descripcion", "")).strip()
                if not _is_valid_line(descripcion):
                    continue
                lineas_rows.append([
                    referencia,
                    order_id,
                    str(line_num),
                    descripcion,
                    linea.get("iva", "").strip(),
                    parse_money(linea.get("precio_unitario", "")),
                    linea.get("cantidad", "").strip(),
                    linea.get("descuento", "").strip(),
                    parse_money(linea.get("total_bruto", "")),
                ])

        if index % CHECKPOINT_EVERY == 0:
            _guardar_checkpoint(salida_dir, pedidos_rows, lineas_rows)
            print(f"  [checkpoint] {index}/{total_pendientes} - guardado parcial.")

    ruta_pedidos = os.path.join(salida_dir, "pedidos.csv")
    ruta_lineas = os.path.join(salida_dir, "pedidos_lineas.csv")
    save_csv(ruta_pedidos, PEDIDOS_CSV_HEADERS, pedidos_rows, refresh_index=False)
    save_csv(ruta_lineas, PEDIDOS_LINEAS_CSV_HEADERS, lineas_rows)

    print(f"Pedidos exportados: {len(pedidos_rows)} -> {ruta_pedidos}")
    print(f"Lineas exportadas: {len(lineas_rows)} -> {ruta_lineas}")
    if excluidos_detalle:
        print(f"Omitidos por ENTREGADOS en ficha: {excluidos_detalle}")
    driver.quit()
    return ruta_pedidos, ruta_lineas


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper de pedidos Abacco (excluye ENTREGADOS, detalle completo)."
    )
    parser.add_argument("--max", type=int, default=None, help="Limitar cantidad de pedidos (pruebas).")
    parser.add_argument("--solo-listado", action="store_true", help="No abrir ficha de cada pedido.")
    parser.add_argument("--salida", default=None, help="Carpeta de salida.")
    parser.add_argument("--reiniciar", action="store_true", help="Ignora CSV previos y parte de cero.")
    args = parser.parse_args()
    scrape_pedidos(
        salida_dir=args.salida,
        max_pedidos=args.max,
        omitir_detalle=args.solo_listado,
        reiniciar=args.reiniciar,
    )


if __name__ == "__main__":
    main()
