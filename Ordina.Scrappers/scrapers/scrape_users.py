from LoginSysAbacco import login_abacco
import os
import time

from scrape_utils import (
    DIR_USUARIOS,
    iter_tagtable_pages,
    save_csv,
    wait_for_table,
)


def _normalize_cells(cells: list[str], num_headers: int) -> list[str] | None:
    if not cells:
        return None
    if len(cells) == num_headers:
        return cells
    if len(cells) > num_headers:
        return cells[:num_headers]
    return cells + [""] * (num_headers - len(cells))


def scrape_usuarios(salida_dir: str | None = None) -> str:
    if salida_dir is None:
        salida_dir = DIR_USUARIOS

    driver = login_abacco()
    print("Cargando listado de usuarios...")
    driver.get("https://sys.abacco.com/user/list.php")
    time.sleep(3)
    print("Esperando tabla del listado...")
    wait_for_table(driver, min_rows=2, timeout=30)

    encabezados: list[str] = []
    datos: list[list[str]] = []
    seen_ids: set[str] = set()

    print("Recopilando usuarios...")
    for pagina, ui_page, resultado in iter_tagtable_pages(driver, id_param="id"):
        if not encabezados:
            encabezados = resultado["headers"]

        nuevos = 0
        for item in resultado["rows"]:
            user_id = item.get("entityId", "")
            if user_id and user_id in seen_ids:
                continue
            if user_id:
                seen_ids.add(user_id)

            cells = _normalize_cells(item["cells"], len(encabezados))
            if not cells:
                continue
            datos.append(cells)
            nuevos += 1

        print(
            f"Usuarios pagina {pagina} (UI: {ui_page}): "
            f"+{nuevos} (total acumulado: {len(datos)})"
        )

    if not encabezados:
        driver.quit()
        raise RuntimeError("No se encontraron usuarios en el listado.")

    ruta_csv = os.path.join(salida_dir, "usuarios.csv")
    save_csv(ruta_csv, encabezados, datos)

    print(f"Usuarios exportados: {len(datos)} -> {ruta_csv}")
    driver.quit()
    return ruta_csv


if __name__ == "__main__":
    scrape_usuarios()
