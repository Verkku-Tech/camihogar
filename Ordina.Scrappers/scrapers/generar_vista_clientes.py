"""Compatibilidad: delega en generar_vista.py."""

from generar_vista import generar_vista_dataset, generar_vistas

DIR_CLIENTES = __import__("scrape_utils", fromlist=["DIR_CLIENTES"]).DIR_CLIENTES


def generar_vista(csv_path: str | None = None, html_path: str | None = None) -> str:
    result = generar_vista_dataset("clientes", csv_path=csv_path, html_path=html_path)
    if result is None:
        raise FileNotFoundError(f"No existe el CSV de clientes.")
    return result


if __name__ == "__main__":
    generar_vista()
