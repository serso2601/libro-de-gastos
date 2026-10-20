import re
import sqlite3

import pytest

from gastos import db


def esquema_v3() -> str:
    """El esquema de la versión 3: el actual sin lo que agregó la 4 (pasar lo que sobra en la categoría)."""
    return re.sub(r",\n    -- Pasar lo que sobra.*?acumula_desde   TEXT", "", db.ESQUEMA.read_text(encoding="utf-8"), flags=re.S)


def esquema_v2() -> str:
    """El esquema de la versión 2: el de la 3 sin lo que agregó la 3 (tarjeta de crédito en la cuenta)."""
    return re.sub(r",\n    -- Tarjeta de crédito.*?CHECK \(pago_minimo >= 0\)", "", esquema_v3(), flags=re.S)


def test_migracion_2_pasa_quincenal_a_catorcenal_sin_soltar_movimientos(tmp_path):
    # Una base en la versión 1, con el CHECK viejo y una regla «quincenal» que ya anotó algo.
    con = db.conectar(tmp_path / "vieja.db")
    viejo = esquema_v2().replace("'semanal', 'catorcenal', 'quincenal'", "'semanal', 'quincenal'")
    con.executescript(viejo)
    con.execute("PRAGMA user_version = 1")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta VALUES ('c', 'Cuenta', '#000', 0, 0, ?, ?)", (marca, marca))
        con.execute("INSERT INTO categoria VALUES ('k', 'Comida', 'gasto', '#000', '🍔', NULL, 0, ?, ?)", (marca, marca))
        con.execute("""INSERT INTO recurrencia VALUES ('r', 'gasto', 500, 'c', NULL, 'k', '', 'quincenal',
                       '2026-10-01', NULL, '2026-10-15', ?, ?)""", (marca, marca))
        con.execute("""INSERT INTO movimiento VALUES ('r@2026-10-01', 'gasto', 500, '2026-10-01', NULL, 'c', NULL, 'k', '',
                       'r', 'recurrencia', ?, ?)""", (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert con.execute("SELECT frecuencia FROM recurrencia").fetchone()[0] == "catorcenal"
    assert con.execute("SELECT recurrencia_id FROM movimiento").fetchone()[0] == "r"
    assert con.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []


def test_migracion_3_agrega_la_tarjeta_y_pasa_los_emojis_iniciales_a_simbolos(tmp_path):
    con = db.conectar(tmp_path / "v2.db")
    con.executescript(esquema_v2())
    con.execute("PRAGMA user_version = 2")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta VALUES ('c', 'Cuenta', '#000', 1500, 0, ?, ?)", (marca, marca))
        con.executemany("INSERT INTO categoria VALUES (?, ?, ?, '#000', ?, NULL, 0, ?, ?)", [
            ("comida", "Comida", "gasto", "🍔", marca, marca),
            ("salud", "Salud", "gasto", "🩺", marca, marca),  # el usuario ya la había cambiado: no se toca
            ("otros", "Otros", "gasto", "✳️", marca, marca),
            ("otros-ingresos", "Otros ingresos", "ingreso", "✳️", marca, marca),
            ("sueldo", "Sueldo", "ingreso", "💼", marca, marca),
            ("viajes", "Viajes", "gasto", "🍔", marca, marca),  # no es una inicial: se queda
        ])
        con.execute("""INSERT INTO movimiento VALUES ('m', 'gasto', 500, '2026-10-01', NULL, 'c', NULL, 'comida', 'x',
                       NULL, 'manual', ?, ?)""", (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    cuenta = dict(con.execute("SELECT * FROM cuenta").fetchone())
    assert cuenta["saldo_inicial"] == 1500
    assert (cuenta["es_credito"], cuenta["dia_corte"], cuenta["dia_pago"], cuenta["pago_minimo"]) == (0, None, None, None)
    emojis = {f["id"]: f["emoji"] for f in con.execute("SELECT id, emoji FROM categoria")}
    assert emojis == {"comida": "i:comida", "salud": "🩺", "otros": "i:otros", "otros-ingresos": "i:otros",
                      "sueldo": "i:sueldo", "viajes": "🍔"}
    assert tuple(con.execute("SELECT id, nota FROM movimiento").fetchone()) == ("m", "x")
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []


def test_migracion_4_agrega_acumular_a_las_categorias(tmp_path):
    con = db.conectar(tmp_path / "v3.db")
    con.executescript(esquema_v3())
    assert "acumula" not in {f["name"] for f in con.execute("PRAGMA table_info(categoria)")}
    con.execute("PRAGMA user_version = 3")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta (id, nombre, creado, actualizado) VALUES ('c', 'Cuenta', ?, ?)", (marca, marca))
        con.execute("INSERT INTO categoria VALUES ('comida', 'Comida', 'gasto', '#000', 'i:comida', 30000, 0, ?, ?)", (marca, marca))
        con.execute("""INSERT INTO movimiento VALUES ('m', 'gasto', 500, '2026-10-01', NULL, 'c', NULL, 'comida', 'x',
                       NULL, 'manual', ?, ?)""", (marca, marca))
        con.execute("INSERT INTO ajuste VALUES ('moneda', '€')")

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == 4
    categoria = dict(con.execute("SELECT * FROM categoria").fetchone())
    assert (categoria["nombre"], categoria["presupuesto"]) == ("Comida", 30000)
    assert (categoria["acumula"], categoria["acumula_desde"]) == (0, None)
    assert tuple(con.execute("SELECT id, nota FROM movimiento").fetchone()) == ("m", "x")
    assert con.execute("SELECT valor FROM ajuste WHERE clave = 'moneda'").fetchone()[0] == "€"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    # El CHECK de la columna nueva viaja con la migración.
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("UPDATE categoria SET acumula = 2")


def test_base_nueva_trae_simbolos_y_la_version_actual(tmp_path):
    con = db.conectar(tmp_path / "nueva.db")
    db.inicializar(con)
    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert {f[0] for f in con.execute("SELECT emoji FROM categoria")} >= {"i:comida", "i:casa", "i:trabajo", "i:regalo"}
