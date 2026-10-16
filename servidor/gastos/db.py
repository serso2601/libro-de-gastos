"""La base SQLite: abrirla, crearla o ponerla al día, y respaldarla.

La versión del esquema vive en `PRAGMA user_version`. Una base nueva se crea entera con
`esquema.sql`; cuando el esquema cambie, cada paso va en MIGRACIONES con su número.
"""

import sqlite3
from datetime import date, datetime
from pathlib import Path

ESQUEMA = Path(__file__).with_name("esquema.sql")
VERSION = 1

# {versión a la que lleva: sql}. Vacío mientras el esquema siga en la versión 1.
MIGRACIONES: dict[int, str] = {}


def conectar(ruta: Path | str) -> sqlite3.Connection:
    con = sqlite3.connect(ruta, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA busy_timeout = 5000")
    return con


# Con lo que arranca una base nueva (las mismas de la app vieja). Importar un respaldo las reemplaza.
PALETA = ["#3DA5F5", "#34D8A6", "#F16565", "#F5B942", "#A78BFA", "#F472B6", "#4ADE80", "#38BDF8", "#FB923C", "#94A3B8"]
CUENTAS_INICIALES = [("efectivo", "Efectivo", PALETA[1])]
CATEGORIAS_INICIALES = [
    ("comida", "Comida", "gasto", "🍔"), ("transporte", "Transporte", "gasto", "🚌"),
    ("vivienda", "Vivienda", "gasto", "🏠"), ("servicios", "Servicios", "gasto", "⚡"),
    ("entretenimiento", "Entretenimiento", "gasto", "🎬"), ("salud", "Salud", "gasto", "❤️"),
    ("compras", "Compras", "gasto", "🛍️"), ("otros", "Otros", "gasto", "✳️"),
    ("sueldo", "Sueldo", "ingreso", "💼"), ("freelance", "Freelance", "ingreso", "💻"),
    ("regalos", "Regalos", "ingreso", "🎁"), ("otros-ingresos", "Otros ingresos", "ingreso", "✳️"),
]


def inicializar(con: sqlite3.Connection) -> None:
    version = con.execute("PRAGMA user_version").fetchone()[0]
    if version == 0:
        con.executescript(ESQUEMA.read_text(encoding="utf-8"))
        marca = ahora()
        with con:
            con.executemany("INSERT INTO cuenta VALUES (?, ?, ?, 0, ?, ?, ?)",
                            [(id_, nombre, color, i, marca, marca) for i, (id_, nombre, color) in enumerate(CUENTAS_INICIALES)])
            con.executemany("INSERT INTO categoria VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)",
                            [(id_, nombre, tipo, PALETA[i % len(PALETA)], emoji, i, marca, marca)
                             for i, (id_, nombre, tipo, emoji) in enumerate(CATEGORIAS_INICIALES)])
        con.execute(f"PRAGMA user_version = {VERSION}")
        return
    for destino in range(version + 1, VERSION + 1):
        con.executescript(MIGRACIONES[destino])
        con.execute(f"PRAGMA user_version = {destino}")


def ahora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def respaldar(con: sqlite3.Connection, carpeta: Path, conservar: int = 30) -> Path | None:
    """Deja una copia del día en `carpeta` (una por día) y borra las más viejas.

    Devuelve la ruta si hizo una copia nueva, None si la de hoy ya existía.
    """
    destino = carpeta / f"gastos-{date.today().isoformat()}.db"
    if destino.exists():
        return None
    copia = sqlite3.connect(destino)
    try:
        con.backup(copia)
    finally:
        copia.close()
    viejas = sorted(carpeta.glob("gastos-*.db"))[:-conservar]
    for vieja in viejas:
        vieja.unlink(missing_ok=True)
    return destino


def ultimo_respaldo(carpeta: Path) -> str | None:
    copias = sorted(carpeta.glob("gastos-*.db"))
    return copias[-1].stem.removeprefix("gastos-") if copias else None
