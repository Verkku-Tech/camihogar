"""Scraper de clientes con todas las columnas del listado Abacco."""

from LoginSysAbacco import login_abacco
import os
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from scrape_utils import (
    CLIENTES_CSV_HEADERS,
    DIR_CLIENTES,
    get_row_value,
    iter_tagtable_pages,
    save_csv,
    select_all_columns,
    select_table_limit,
)


def _parse_cliente_rows(resultado: dict, seen_socids: set[str]) -> tuple[list[list[str]], int]:
    headers = resultado["headers"]
    data_headers = [h for h in CLIENTES_CSV_HEADERS if h != "abacco_socid"]
    filas: list[list[str]] = []
    nuevos = 0

    for item in resultado["rows"]:
        socid = item.get("entityId", "")
        if socid and socid in seen_socids:
            continue

        row = {headers[i]: item["cells"][i] if i < len(item["cells"]) else "" for i in range(len(headers))}
        nombre = get_row_value(row, "Nombre del tercero")
        rif = get_row_value(row, "RIF / C.I")
        if not nombre or not rif:
            continue

        if socid:
            seen_socids.add(socid)

        fila = [socid]
        fila.extend(get_row_value(row, header) for header in data_headers)
        filas.append(fila)
        nuevos += 1

    return filas, nuevos


def scrape_clientes(salida_dir: str | None = None) -> str:
    if salida_dir is None:
        salida_dir = DIR_CLIENTES
    driver = login_abacco()
    driver.get("https://sys.abacco.com/societe/list.php?type=c&leftmenu=customers")
    time.sleep(3)

    select_all_columns(driver)
    select_table_limit(driver, "5000")
    WebDriverWait(driver, 30).until(
        lambda d: len(d.find_element(By.CLASS_NAME, "tagtable").find_elements(By.TAG_NAME, "th")) > 15
    )

    filas_csv: list[list[str]] = []
    seen_socids: set[str] = set()

    for pagina, ui_page, resultado in iter_tagtable_pages(driver, id_param="socid"):
        nuevas_filas, nuevos = _parse_cliente_rows(resultado, seen_socids)
        filas_csv.extend(nuevas_filas)
        print(
            f"Pagina {pagina} (UI: {ui_page}): "
            f"+{nuevos} clientes (total acumulado: {len(filas_csv)})"
        )

    if not filas_csv:
        driver.quit()
        raise RuntimeError("No se encontraron clientes en el listado.")

    ruta_csv = os.path.join(salida_dir, "clientes.csv")
    save_csv(ruta_csv, CLIENTES_CSV_HEADERS, filas_csv)

    print(f"Clientes exportados: {len(filas_csv)} -> {ruta_csv}")
    print(f"Columnas exportadas: {len(CLIENTES_CSV_HEADERS)}")
    driver.quit()
    return ruta_csv


if __name__ == "__main__":
    scrape_clientes()
