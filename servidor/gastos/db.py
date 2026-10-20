"""La base SQLite: abrirla, crearla o ponerla al día, y respaldarla.

La versión del esquema vive en `PRAGMA user_version`. Una base nueva se crea entera con
`esquema.sql`; cuando el esquema cambie, cada paso va en MIGRACIONES con su número.
"""

import sqlite3
from datetime import date, datetime
from pathlib import Path

ESQUEMA = Path(__file__).with_name("esquema.sql")
VERSION = 4

# {versión a la que lleva: sql}. Cada paso corre con las claves foráneas apagadas: rehacer una
# tabla no debe tocar las filas que la apuntan (movimiento.recurrencia_id es ON DELETE SET NULL).
MIGRACIONES: dict[int, str] = {
    # «quincenal» era cada 14 días: pasa a llamarse «catorcenal» y «quincenal» queda para dos veces
    # al mes. SQLite no cambia un CHECK sin rehacer la tabla.
    2: """
    BEGIN;
    CREATE TABLE recurrencia_nueva (
        id                  TEXT PRIMARY KEY,
        tipo                TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso', 'transferencia')),
        monto               INTEGER NOT NULL CHECK (monto > 0),
        cuenta_id           TEXT NOT NULL REFERENCES cuenta(id),
        cuenta_destino_id   TEXT REFERENCES cuenta(id),
        categoria_id        TEXT REFERENCES categoria(id),
        nota                TEXT NOT NULL DEFAULT '',
        frecuencia          TEXT NOT NULL CHECK (frecuencia IN ('semanal', 'catorcenal', 'quincenal', 'mensual', 'anual')),
        fecha_inicio        TEXT NOT NULL,
        fecha_fin           TEXT,
        generada_hasta      TEXT,
        creado              TEXT NOT NULL,
        actualizado         TEXT NOT NULL
    );
    INSERT INTO recurrencia_nueva
        SELECT id, tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, nota,
               CASE frecuencia WHEN 'quincenal' THEN 'catorcenal' ELSE frecuencia END,
               fecha_inicio, fecha_fin, generada_hasta, creado, actualizado
        FROM recurrencia;
    DROP TABLE recurrencia;
    ALTER TABLE recurrencia_nueva RENAME TO recurrencia;
    COMMIT;
    """,
    # Tarjeta de crédito en la cuenta, y símbolos de la app (`i:<clave>`) como icono de categoría.
    # Los emojis iniciales pasan a símbolo solo si el usuario no los cambió.
    3: """
    BEGIN;
    ALTER TABLE cuenta ADD COLUMN es_credito INTEGER NOT NULL DEFAULT 0 CHECK (es_credito IN (0, 1));
    ALTER TABLE cuenta ADD COLUMN dia_corte INTEGER CHECK (dia_corte BETWEEN 1 AND 31);
    ALTER TABLE cuenta ADD COLUMN dia_pago INTEGER CHECK (dia_pago BETWEEN 1 AND 31);
    ALTER TABLE cuenta ADD COLUMN pago_minimo INTEGER CHECK (pago_minimo >= 0);
    UPDATE categoria SET emoji = 'i:comida' WHERE id = 'comida' AND emoji = '🍔';
    UPDATE categoria SET emoji = 'i:transporte' WHERE id = 'transporte' AND emoji = '🚌';
    UPDATE categoria SET emoji = 'i:casa' WHERE id = 'vivienda' AND emoji = '🏠';
    UPDATE categoria SET emoji = 'i:servicios' WHERE id = 'servicios' AND emoji = '⚡';
    UPDATE categoria SET emoji = 'i:entretenimiento' WHERE id = 'entretenimiento' AND emoji = '🎬';
    UPDATE categoria SET emoji = 'i:salud' WHERE id = 'salud' AND emoji = '❤️';
    UPDATE categoria SET emoji = 'i:compras' WHERE id = 'compras' AND emoji = '🛍️';
    UPDATE categoria SET emoji = 'i:otros' WHERE id = 'otros' AND emoji = '✳️';
    UPDATE categoria SET emoji = 'i:sueldo' WHERE id = 'sueldo' AND emoji = '💼';
    UPDATE categoria SET emoji = 'i:trabajo' WHERE id = 'freelance' AND emoji = '💻';
    UPDATE categoria SET emoji = 'i:regalo' WHERE id = 'regalos' AND emoji = '🎁';
    UPDATE categoria SET emoji = 'i:otros' WHERE id = 'otros-ingresos' AND emoji = '✳️';
    COMMIT;
    """,
    # Presupuesto por categoría que puede pasar lo que sobra al periodo siguiente. El periodo del
    # presupuesto vive en `ajuste` (con valores por defecto en la API), así que no hay más que migrar.
    4: """
    BEGIN;
    ALTER TABLE categoria ADD COLUMN acumula INTEGER NOT NULL DEFAULT 0 CHECK (acumula IN (0, 1));
    ALTER TABLE categoria ADD COLUMN acumula_desde TEXT;
    COMMIT;
    """,
}


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
CATEGORIAS_INICIALES = [  # el icono es un símbolo de la app: 'i:<clave>'
    ("comida", "Comida", "gasto", "i:comida"), ("transporte", "Transporte", "gasto", "i:transporte"),
    ("vivienda", "Vivienda", "gasto", "i:casa"), ("servicios", "Servicios", "gasto", "i:servicios"),
    ("entretenimiento", "Entretenimiento", "gasto", "i:entretenimiento"), ("salud", "Salud", "gasto", "i:salud"),
    ("compras", "Compras", "gasto", "i:compras"), ("otros", "Otros", "gasto", "i:otros"),
    ("sueldo", "Sueldo", "ingreso", "i:sueldo"), ("freelance", "Freelance", "ingreso", "i:trabajo"),
    ("regalos", "Regalos", "ingreso", "i:regalo"), ("otros-ingresos", "Otros ingresos", "ingreso", "i:otros"),
]


def inicializar(con: sqlite3.Connection) -> None:
    version = con.execute("PRAGMA user_version").fetchone()[0]
    if version == 0:
        con.executescript(ESQUEMA.read_text(encoding="utf-8"))
        marca = ahora()
        with con:
            con.executemany("INSERT INTO cuenta (id, nombre, color, saldo_inicial, orden, creado, actualizado) "
                            "VALUES (?, ?, ?, 0, ?, ?, ?)",
                            [(id_, nombre, color, i, marca, marca) for i, (id_, nombre, color) in enumerate(CUENTAS_INICIALES)])
            con.executemany("INSERT INTO categoria (id, nombre, tipo, color, emoji, presupuesto, orden, creado, actualizado) "
                            "VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)",
                            [(id_, nombre, tipo, PALETA[i % len(PALETA)], emoji, i, marca, marca)
                             for i, (id_, nombre, tipo, emoji) in enumerate(CATEGORIAS_INICIALES)])
        con.execute(f"PRAGMA user_version = {VERSION}")
        return
    con.execute("PRAGMA foreign_keys = OFF")
    try:
        for destino in range(version + 1, VERSION + 1):
            con.executescript(MIGRACIONES[destino])
            con.execute(f"PRAGMA user_version = {destino}")
    finally:
        con.execute("PRAGMA foreign_keys = ON")


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
