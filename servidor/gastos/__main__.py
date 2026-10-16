"""Arranca el servidor: `uv run python -m servidor`."""

import argparse
import logging
import re
import threading
import time

import uvicorn

from . import db, recurrencias
from .api import create_app
from .config import Config

# El `?t=` de un pedido lleva el token, y uvicorn anota la dirección completa: en el log se tapa.
CLAVE_EN_LA_DIRECCION = re.compile(r"([?&]t=)[^&\s]+")
CADA = 30 * 60  # segundos entre pasadas de mantenimiento


class SinClaveEnLaDireccion(logging.Filter):
    def filter(self, registro: logging.LogRecord) -> bool:
        if isinstance(registro.args, tuple):
            registro.args = tuple(
                CLAVE_EN_LA_DIRECCION.sub(r"\1***", a) if isinstance(a, str) else a for a in registro.args
            )
        return True


def mantenimiento(config: Config, parar: threading.Event) -> None:
    """Cada media hora: crea los movimientos recurrentes que ya tocan y deja el respaldo del día."""
    while not parar.is_set():
        con = db.conectar(config.ruta_db)
        try:
            creados = recurrencias.materializar(con)
            if creados:
                print(f"Recurrencias: {creados} movimientos nuevos", flush=True)
            if copia := db.respaldar(con, config.respaldos):
                print(f"Respaldo: {copia.name}", flush=True)
        except Exception as e:  # que un error no mate el hilo: se reintenta en la próxima pasada
            print(f"Mantenimiento falló: {e!r}", flush=True)
        finally:
            con.close()
        parar.wait(CADA)


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local del Libro de Gastos")
    parser.add_argument("--host", default="127.0.0.1", help="Tailscale Serve lo publica con HTTPS; 0.0.0.0 para abrirlo a la red")
    parser.add_argument("--puerto", type=int, default=8766)
    args = parser.parse_args()

    config = Config.desde_entorno()
    app = create_app(config)
    print(f"Datos en:  {config.carpeta}")
    print(f"Token:     {config.token}")
    print(f"Estado:    http://127.0.0.1:{args.puerto}")

    parar = threading.Event()
    threading.Thread(target=mantenimiento, args=(config, parar), daemon=True, name="mantenimiento").start()
    logging.getLogger("uvicorn.access").addFilter(SinClaveEnLaDireccion())
    uvicorn.run(app, host=args.host, port=args.puerto)


if __name__ == "__main__":
    main()
