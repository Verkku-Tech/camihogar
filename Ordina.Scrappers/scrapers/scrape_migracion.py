"""Orquestador: extrae clientes y pedidos esenciales para migración."""

import argparse

from scrape_clientes import scrape_clientes
from scrape_pedidos import scrape_pedidos


def main() -> None:
    parser = argparse.ArgumentParser(description="Migracion Abacco -> CSV estructurado.")
    parser.add_argument("--solo-clientes", action="store_true")
    parser.add_argument("--solo-pedidos", action="store_true")
    parser.add_argument("--max-pedidos", type=int, default=None)
    parser.add_argument("--solo-listado-pedidos", action="store_true")
    args = parser.parse_args()

    run_clientes = not args.solo_pedidos
    run_pedidos = not args.solo_clientes

    if run_clientes:
        scrape_clientes()
    if run_pedidos:
        scrape_pedidos(
            max_pedidos=args.max_pedidos,
            omitir_detalle=args.solo_listado_pedidos,
        )


if __name__ == "__main__":
    main()
