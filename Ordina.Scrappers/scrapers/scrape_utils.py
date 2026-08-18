"""Utilidades compartidas para scrapers de migración Abacco."""

from __future__ import annotations

import csv
import os
import time
from typing import Iterable

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

BASE_URL = "https://sys.abacco.com"
# Raíz del proyecto Migración (carpeta padre de scrapers/).
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DIR_CLIENTES = os.path.join(DATA_DIR, "clientes")
DIR_PEDIDOS = os.path.join(DATA_DIR, "pedidos")
DIR_USUARIOS = os.path.join(DATA_DIR, "usuarios")

# Columnas completas del listado Abacco (como en el export original).
CLIENTES_CSV_HEADERS = [
    "abacco_socid",
    "Nombre del tercero",
    "Apodo",
    "RIF / C.I",
    "Cód. proveedor",
    "Cód. cuenta cliente",
    "Cód. cuenta proveedor",
    "Población",
    "Código postal",
    "Provincia",
    "Región",
    "País",
    "Tipo de tercero",
    "Empleados",
    "Correo",
    "Teléfono",
    "Telefono 2",
    "Url",
    "Prof. id 1",
    "Prof. id 2",
    "Prof. id 3",
    "Prof. id 4",
    "Prof. id 5",
    "Prof. id 6",
    "RIF.",
    "",
    "Potencial",
    "Estado prospección",
    "Sede central",
    "Dreccion de envio",
    "Fecha de creación",
    "Fecha modif.",
    "Estado",
    "ID de importación",
]

# Alias por si Abacco varía acentos o nombres en el DOM.
CLIENTES_HEADER_ALIASES: dict[str, list[str]] = {
    "Teléfono": ["Teléfono", "Telefono", "Teléfono "],
    "Telefono 2": ["Telefono 2", "Teléfono 2", "Telefono 2 "],
    "Dreccion de envio": ["Dreccion de envio", "Direccion de envio", "Dirección de envio"],
    "RIF / C.I": ["RIF / C.I", "RIF / C.I.", "RIF / C.I "],
    "Fecha modif.": ["Fecha modif.", "Fecha modif", "Fecha modificación"],
}

PEDIDOS_CSV_HEADERS = [
    "abacco_id",
    "Código",
    "Ref. pedido para el cliente",
    "Tercero",
    "abacco_socid",
    "Población",
    "Código postal",
    "Fecha de pedido",
    "Fecha prevista de entrega",
    "Descuento",
    "Condiciones de pago",
    "Tipo entrega",
    "Origen",
    "Incoterm",
    "Cuota de transporte",
    "Base imponible",
    "Importe IVA",
    "Importe total",
    "Divisa",
    "Autor",
    "fabricante",
    "Estado de fabricacion",
    "Estado",
    "Facturado",
]

PEDIDOS_HEADER_ALIASES: dict[str, list[str]] = {
    "Código": ["Código", "Codigo"],
    "Ref. pedido para el cliente": [
        "Ref. pedido para el cliente",
        "Ref. pedido cliente",
        "Ref. cliente",
        "Ref. client",
    ],
    "Tercero": ["Tercero", "Empresa", "Cliente", "Third party"],
    "Población": ["Población", "Poblacion", "Town"],
    "Código postal": ["Código postal", "Codigo postal", "CP", "Zip"],
    "Fecha de pedido": ["Fecha de pedido", "Fecha", "Date", "Fecha pedido"],
    "Fecha prevista de entrega": [
        "Fecha prevista de entrega",
        "Fecha entrega",
        "Fecha de entrega",
    ],
    "Base imponible": ["Base imponible", "Total HT", "Importe total", "Total TTC"],
    "Autor": ["Autor", "Creado por", "Usuario"],
    "fabricante": ["fabricante", "Fabricante"],
    "Estado de fabricacion": [
        "Estado de fabricacion",
        "Estado de fabricación",
        "Estado fabricacion",
    ],
    "Estado": ["Estado", "Status"],
    "Facturado": ["Facturado", "Facturación", "Billed"],
    "Descuento": ["Descuento"],
    "Condiciones de pago": ["Condiciones de pago", "Condición de pago"],
    "Tipo entrega": ["Tipo entrega", "Tipo de entrega"],
    "Origen": ["Origen"],
    "Incoterm": ["Incoterm"],
    "Cuota de transporte": ["Cuota de transporte"],
    "Importe IVA": ["Importe IVA", "IVA", "Amount VAT"],
    "Importe total": ["Importe total", "Total TTC", "Total"],
    "Divisa": ["Divisa", "Currency"],
}

PEDIDOS_LINEAS_CSV_HEADERS = [
    "referencia",
    "abacco_id",
    "linea",
    "descripcion",
    "iva",
    "precio_unitario",
    "cantidad",
    "descuento",
    "total_bruto",
]

EXTRACT_TAGTABLE_JS = """
var table = arguments[0];
var idParam = arguments[1] || 'socid';
var rows = table.querySelectorAll('tbody tr');
if (!rows.length) rows = table.querySelectorAll('tr');
var headers = [];
var dataRows = [];
for (var i = 0; i < rows.length; i++) {
    var tr = rows[i];
    if (tr.classList.contains('liste_titre_filter')) continue;
    var ths = tr.querySelectorAll('th');
    if (ths.length > 0) {
        for (var j = 0; j < ths.length; j++)
            headers.push(ths[j].innerText.trim().replace(/,/g, ''));
        continue;
    }
    var tds = tr.querySelectorAll('td');
    if (tds.length === 0) continue;
    var cells = [];
    for (var k = 0; k < tds.length; k++)
        cells.push(tds[k].innerText.trim().replace(/,/g, ''));
    var entityId = '';
    var link = tr.querySelector('a[href*="' + idParam + '="]');
    if (link) {
        var href = link.getAttribute('href') || '';
        var match = null;
        if (idParam === 'id')
            match = href.match(/[?&]id=(\\d+)/);
        else
            match = href.match(new RegExp(idParam + '=(\\\\d+)'));
        if (match) entityId = match[1];
    }
    dataRows.push({ entityId: entityId, cells: cells });
}
return { headers: headers, rows: dataRows };
"""


def wait_for_table(driver, min_rows: int = 2, timeout: int = 60) -> None:
    def _row_count(drv) -> int:
        for selector in (By.CLASS_NAME, By.CSS_SELECTOR):
            try:
                if selector == By.CLASS_NAME:
                    tabla = drv.find_element(By.CLASS_NAME, "tagtable")
                else:
                    tabla = drv.find_element(By.CSS_SELECTOR, "table.tagtable, table.liste")
                return len(tabla.find_elements(By.TAG_NAME, "tr"))
            except Exception:
                continue
        return 0

    WebDriverWait(driver, timeout).until(lambda d: _row_count(d) >= min_rows)


def select_table_limit(driver, limit: str = "5000", timeout: int = 60) -> None:
    selected = False
    select_el = None
    for by, value in (
        (By.NAME, "limit"),
        (By.CSS_SELECTOR, "select.selectlimit"),
        (By.CSS_SELECTOR, "select[name='limit']"),
    ):
        try:
            select_el = driver.find_element(by, value)
            break
        except Exception:
            pass

    if select_el:
        for selector in (
            lambda: Select(select_el).select_by_value(limit),
            lambda: Select(select_el).select_by_visible_text(limit),
        ):
            try:
                selector()
                selected = True
                break
            except Exception:
                pass

    if not selected and select_el:
        try:
            driver.execute_script(
                "arguments[0].value = arguments[1];"
                "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
                select_el,
                limit,
            )
            selected = True
        except Exception as exc:
            print(f"No se pudo seleccionar límite {limit}: {exc}")

    if selected:
        time.sleep(1)
        min_rows = 26 if int(limit) >= 500 else 5
        wait_timeout = max(timeout, 180) if int(limit) >= 1000 else timeout
        try:
            wait_for_table(driver, min_rows=min_rows, timeout=wait_timeout)
        except Exception:
            wait_for_table(driver, min_rows=2, timeout=30)
        print(f"Tabla recargada con límite {limit}.")
    else:
        print("Se usará el límite por defecto de la tabla.")


def _normalize_label(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _checkbox_label(checkbox) -> str:
    try:
        parent = checkbox.find_element(By.XPATH, "./ancestor::label[1]")
        return parent.text
    except Exception:
        pass

    checkbox_id = checkbox.get_attribute("id")
    if checkbox_id:
        try:
            label = checkbox.find_element(By.XPATH, f"//label[@for='{checkbox_id}']")
            return label.text
        except Exception:
            pass

    return checkbox.get_attribute("value") or ""


def _find_column_checkboxes(driver) -> list:
    """Localiza checkboxes del selector de columnas (Abacco/Dolibarr varía el DOM)."""
    selectors = (
        "input[type='checkbox'][name*='selectedfield']",
        "input[type='checkbox'][name*='arrayfields']",
        "div.multiselectcheckbox input[type='checkbox']",
        "#selectedfields input[type='checkbox']",
        "a[name='selectedfields'] ~ * input[type='checkbox']",
    )
    for selector in selectors:
        checkboxes = driver.find_elements(By.CSS_SELECTOR, selector)
        if checkboxes:
            return checkboxes

    # Fallback: tras abrir el panel, usar checkboxes fuera de la fila de filtros.
    all_boxes = driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
    filtered = []
    for checkbox in all_boxes:
        name = (checkbox.get_attribute("name") or "").lower()
        if "search_" in name or name in {"all", "checkall"}:
            continue
        filtered.append(checkbox)
    return filtered


def _open_column_selector(driver, timeout: int = 30) -> bool:
    try:
        boton = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'a[href="#selectedfields"]'))
        )
        driver.execute_script("arguments[0].click();", boton)
        time.sleep(1)
    except Exception as exc:
        print(f"No se pudo abrir el selector de columnas: {exc}")
        return False

    driver.execute_script(
        """
        var panel = document.getElementById('selectedfields')
            || document.querySelector('[name="selectedfields"]')
            || document.querySelector('div.multiselectcheckbox');
        if (panel) {
            panel.style.display = 'block';
            panel.hidden = false;
        }
        """
    )
    return True


def _activate_column_checkboxes_js(driver, max_rounds: int = 80) -> int:
    """Activa checkboxes uno a uno reconsultando el DOM para evitar StaleElementReference."""
    return driver.execute_script(
        """
        var maxRounds = arguments[0];
        var total = 0;

        function isColumnCheckbox(cb) {
            var name = (cb.name || '').toLowerCase();
            if (!name || name.indexOf('search_') >= 0) return false;
            if (name === 'all' || name === 'checkall') return false;
            return true;
        }

        function findBoxes() {
            var selectors = [
                '#selectedfields input[type="checkbox"]',
                'div.multiselectcheckbox input[type="checkbox"]',
                'form[name="searchFormList"] input[type="checkbox"]'
            ];
            var seen = [];
            var out = [];
            for (var s = 0; s < selectors.length; s++) {
                var nodes = document.querySelectorAll(selectors[s]);
                for (var i = 0; i < nodes.length; i++) {
                    var cb = nodes[i];
                    if (!isColumnCheckbox(cb)) continue;
                    if (seen.indexOf(cb) >= 0) continue;
                    seen.push(cb);
                    out.push(cb);
                }
            }
            if (out.length) return out;
            var all = document.querySelectorAll("input[type='checkbox']");
            for (var j = 0; j < all.length; j++) {
                if (isColumnCheckbox(all[j])) out.push(all[j]);
            }
            return out;
        }

        var master = document.querySelector(
            'input[type="checkbox"][name="all"], input[type="checkbox"][name="checkall"]'
        );
        if (master && !master.checked) {
            master.click();
            total++;
        }

        for (var round = 0; round < maxRounds; round++) {
            var boxes = findBoxes();
            var clicked = false;
            for (var i = 0; i < boxes.length; i++) {
                if (!boxes[i].checked) {
                    boxes[i].click();
                    total++;
                    clicked = true;
                    break;
                }
            }
            if (!clicked) break;
        }
        return total;
        """,
        max_rounds,
    )


def select_columns(driver, wanted_labels: Iterable[str], timeout: int = 30) -> None:
    wanted = {_normalize_label(label) for label in wanted_labels}
    if not _open_column_selector(driver, timeout=timeout):
        return

    toggled = driver.execute_script(
        """
        var wanted = arguments[0];
        var total = 0;

        function norm(text) {
            return (text || '').toLowerCase().replace(/\\s+/g, ' ').trim();
        }

        function labelFor(cb) {
            var parent = cb.closest('label, li, div, td, span');
            return parent ? parent.innerText : '';
        }

        function findBoxes() {
            var nodes = document.querySelectorAll(
                '#selectedfields input[type="checkbox"], div.multiselectcheckbox input[type="checkbox"]'
            );
            if (nodes.length) return Array.prototype.slice.call(nodes);
            return Array.prototype.slice.call(document.querySelectorAll("input[type='checkbox']"));
        }

        for (var round = 0; round < 80; round++) {
            var boxes = findBoxes();
            var clicked = false;
            for (var i = 0; i < boxes.length; i++) {
                var cb = boxes[i];
                var name = (cb.name || '').toLowerCase();
                if (!name || name.indexOf('search_') >= 0 || name === 'all' || name === 'checkall') continue;
                var label = norm(labelFor(cb));
                if (!label) continue;
                var shouldSelect = false;
                for (var j = 0; j < wanted.length; j++) {
                    var w = wanted[j];
                    if (label.indexOf(w) >= 0 || w.indexOf(label) >= 0) {
                        shouldSelect = true;
                        break;
                    }
                }
                if (shouldSelect && !cb.checked) {
                    cb.click();
                    total++;
                    clicked = true;
                    break;
                }
            }
            if (!clicked) break;
        }
        return total;
        """,
        list(wanted),
    )

    if toggled:
        time.sleep(2)
        try:
            wait_for_table(driver, min_rows=2, timeout=timeout)
        except Exception:
            time.sleep(2)
        print(f"Columnas ajustadas ({toggled} cambios).")
        return

    activados = _activate_column_checkboxes_js(driver)
    if activados:
        time.sleep(2)
        try:
            wait_for_table(driver, min_rows=2, timeout=timeout)
        except Exception:
            time.sleep(2)
    print(f"No hubo coincidencias por nombre; se activaron {activados} columnas extra.")


def select_all_columns(driver, timeout: int = 30) -> None:
    """Activa todas las columnas disponibles en el listado."""
    if not _open_column_selector(driver, timeout=timeout):
        return

    checkboxes = _find_column_checkboxes(driver)
    if not checkboxes:
        print("No se encontraron checkboxes; se exportan columnas visibles.")
        return

    activados = _activate_column_checkboxes_js(driver)

    if activados:
        time.sleep(2)
        try:
            wait_for_table(driver, min_rows=2, timeout=timeout)
        except Exception:
            time.sleep(2)
    print(f"Columnas activadas: {activados} (todas las disponibles).")


def _find_next_page_link(driver):
    """Busca enlace a la pagina siguiente (paginationnext o numero mayor al activo)."""
    for link in driver.find_elements(By.CSS_SELECTOR, "a.paginationnext"):
        href = (link.get_attribute("href") or "").strip()
        if href and href != "#" and "javascript:" not in href.lower():
            return link

    try:
        active = int(driver.find_element(By.CSS_SELECTOR, "li.pagination span.active").text.strip())
    except Exception:
        active = None

    for link in driver.find_elements(By.CSS_SELECTOR, "li.pagination a[href*='page=']"):
        if "paginationprevious" in (link.get_attribute("class") or ""):
            continue
        href = (link.get_attribute("href") or "").strip()
        if not href or href == "#" or "javascript:" in href.lower():
            continue
        if active is not None:
            try:
                page_num = int(link.text.strip())
                if page_num <= active:
                    continue
            except ValueError:
                pass
        return link
    return None


def get_active_page_number(driver) -> str:
    try:
        return driver.find_element(By.CSS_SELECTOR, "li.pagination span.active").text.strip()
    except Exception:
        return "?"


def has_next_page(driver) -> bool:
    return _find_next_page_link(driver) is not None


def go_next_page(driver, timeout: int = 120) -> bool:
    link = _find_next_page_link(driver)
    if not link:
        return False

    href = (link.get_attribute("href") or "").strip()
    if href.startswith("/"):
        href = BASE_URL + href

    if href:
        driver.get(href)
    else:
        driver.execute_script("arguments[0].click();", link)

    time.sleep(2)
    wait_for_table(driver, min_rows=2, timeout=timeout)
    return True


def get_row_value(
    row: dict[str, str],
    header: str,
    aliases: dict[str, list[str]] | None = None,
) -> str:
    if not header:
        return ""
    if header in row:
        return (row[header] or "").strip()
    alias_map = aliases if aliases is not None else CLIENTES_HEADER_ALIASES
    for alias in alias_map.get(header, [header]):
        if alias in row:
            return (row[alias] or "").strip()
    target = _normalize_label(header)
    for key, value in row.items():
        if _normalize_label(key) == target:
            return (value or "").strip()
    return ""


def extract_tagtable(driver, id_param: str = "socid") -> dict:
    for selector in ("table.tagtable", "table.liste", ".tagtable"):
        try:
            tabla = driver.find_element(By.CSS_SELECTOR, selector)
            return driver.execute_script(EXTRACT_TAGTABLE_JS, tabla, id_param)
        except Exception:
            continue
    tabla = driver.find_element(By.CLASS_NAME, "tagtable")
    return driver.execute_script(EXTRACT_TAGTABLE_JS, tabla, id_param)


def iter_tagtable_pages(driver, id_param: str = "socid", page_timeout: int = 120):
    """Itera el listado paginado de Abacco (tagtable) pagina a pagina."""
    pagina = 1
    while True:
        resultado = extract_tagtable(driver, id_param=id_param)
        if not resultado["headers"]:
            break
        yield pagina, get_active_page_number(driver), resultado
        if not go_next_page(driver, timeout=page_timeout):
            break
        pagina += 1


def row_to_dict(headers: list[str], cells: list[str]) -> dict[str, str]:
    data = {headers[i]: cells[i] if i < len(cells) else "" for i in range(len(headers))}
    return data


def merge_direccion(row: dict[str, str]) -> str:
    return (row.get("Dreccion de envio") or row.get("Sede central") or "").strip()


DATASET_BY_FILENAME = {
    "clientes.csv": "clientes",
    "pedidos.csv": "pedidos",
    "pedidos_lineas.csv": "pedidos_lineas",
    "usuarios.csv": "usuarios",
}


def save_csv(
    path: str,
    headers: list[str],
    rows: list[list[str]],
    *,
    dataset_id: str | None = None,
    refresh_vista: bool = True,
    refresh_index: bool = True,
) -> str:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(rows)

    effective_dataset = dataset_id or DATASET_BY_FILENAME.get(os.path.basename(path))
    if refresh_vista and effective_dataset:
        from generar_vista import generar_indice, generar_vista_dataset

        generar_vista_dataset(effective_dataset, csv_path=path)
        if refresh_index:
            generar_indice()

    return path


def parse_money(value: str) -> str:
    cleaned = (value or "").replace("$", "").replace(" ", "").strip()
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", ".")
    return cleaned
