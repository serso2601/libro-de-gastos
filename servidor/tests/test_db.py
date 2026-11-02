import re
import sqlite3

import pytest

from gastos import db


def esquema_v8() -> str:
    """El esquema de la versión 8: el actual sin lo que agregó la 9 (la deuda al corte inicial de la tarjeta)."""
    return re.sub(r"    -- Solo tarjetas: el saldo inicial[^\n]*\n|    (corte_inicial|deuda_al_corte|pagos_tras_corte) [^\n]*\n", "", db.ESQUEMA.read_text(encoding="utf-8"))


def esquema_v7() -> str:
    """El esquema de la versión 7: el de la 8 sin lo que agregó la 8 (el corte del mínimo corregido)."""
    return re.sub(r"    minimo_corte    TEXT[^\n]*\n", "", esquema_v8())


def esquema_v6() -> str:
    """El esquema de la versión 6: el de la 7 sin lo que agregó la 7 (el límite de la tarjeta)."""
    return re.sub(r"    limite          INTEGER[^\n]*\n", "", esquema_v7())


def esquema_v5() -> str:
    """El esquema de la versión 5: el de la 6 sin lo que agregó la 6 (contraparte y referencia de la bandeja)."""
    s = esquema_v6()
    s = re.sub(r"    contraparte   TEXT,[^\n]*\n    referencia    TEXT,[^\n]*\n", "", s)
    return re.sub(r"\nCREATE UNIQUE INDEX IF NOT EXISTS pendiente_referencia[^\n]*", "", s)


def esquema_v4() -> str:
    """El esquema de la versión 4: el actual sin lo que agregó la 5 (banco y terminación de la cuenta, bandeja)."""
    s = re.sub(r",\n    -- Vínculo con el catálogo.*?terminacion     TEXT", "", esquema_v5(), flags=re.S)
    return s[:s.index("-- La bandeja de avisos")]


def esquema_v3() -> str:
    """El esquema de la versión 3: el de la 4 sin lo que agregó la 4 (pasar lo que sobra en la categoría)."""
    return re.sub(r",\n    -- Pasar lo que sobra.*?acumula_desde   TEXT", "", esquema_v4(), flags=re.S)


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

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    categoria = dict(con.execute("SELECT * FROM categoria").fetchone())
    assert (categoria["nombre"], categoria["presupuesto"]) == ("Comida", 30000)
    assert (categoria["acumula"], categoria["acumula_desde"]) == (0, None)
    assert tuple(con.execute("SELECT id, nota FROM movimiento").fetchone()) == ("m", "x")
    assert con.execute("SELECT valor FROM ajuste WHERE clave = 'moneda'").fetchone()[0] == "€"
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []
    # El CHECK de la columna nueva viaja con la migración.
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("UPDATE categoria SET acumula = 2")


def test_migracion_5_agrega_banco_terminacion_y_la_bandeja(tmp_path):
    con = db.conectar(tmp_path / "v4.db")
    con.executescript(esquema_v4())
    assert "banco" not in {f["name"] for f in con.execute("PRAGMA table_info(cuenta)")}
    assert con.execute("SELECT name FROM sqlite_master WHERE name = 'pendiente'").fetchone() is None
    con.execute("PRAGMA user_version = 4")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta (id, nombre, creado, actualizado) VALUES ('c', 'Cuenta', ?, ?)", (marca, marca))
        con.execute("INSERT INTO categoria (id, nombre, tipo, creado, actualizado) VALUES ('comida', 'Comida', 'gasto', ?, ?)",
                    (marca, marca))
        con.execute("""INSERT INTO movimiento VALUES ('m', 'gasto', 500, '2026-10-01', NULL, 'c', NULL, 'comida', 'x',
                       NULL, 'manual', ?, ?)""", (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    cuenta = dict(con.execute("SELECT * FROM cuenta").fetchone())
    assert (cuenta["nombre"], cuenta["banco"], cuenta["terminacion"]) == ("Cuenta", None, None)
    assert tuple(con.execute("SELECT id, nota FROM movimiento").fetchone()) == ("m", "x")
    with con:
        con.execute("INSERT INTO pendiente (id, origen, recibido, creado, actualizado) VALUES ('p', 'correo', ?, ?, ?)",
                    (marca, marca, marca))
    assert con.execute("SELECT estado FROM pendiente").fetchone()[0] == "nuevo"
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("UPDATE pendiente SET estado = 'raro'")
    assert con.execute("PRAGMA foreign_key_check").fetchall() == []


def test_migracion_6_agrega_contraparte_y_referencia_unica(tmp_path):
    con = db.conectar(tmp_path / "v5.db")
    con.executescript(esquema_v5())
    assert "referencia" not in {f["name"] for f in con.execute("PRAGMA table_info(pendiente)")}
    con.execute("PRAGMA user_version = 5")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO pendiente (id, origen, recibido, creado, actualizado) VALUES ('p', 'yappy', ?, ?, ?)",
                    (marca, marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert tuple(con.execute("SELECT contraparte, referencia FROM pendiente").fetchone()) == (None, None)
    with con:
        con.execute("UPDATE pendiente SET referencia = 'X-1'")
        con.execute("INSERT INTO pendiente (id, origen, referencia, recibido, creado, actualizado) VALUES ('q', 'wallet', 'X-1', ?, ?, ?)",
                    (marca, marca, marca))  # otro origen: puede
    with pytest.raises(sqlite3.IntegrityError):
        con.execute("INSERT INTO pendiente (id, origen, referencia, recibido, creado, actualizado) VALUES ('r', 'yappy', 'X-1', ?, ?, ?)",
                    (marca, marca, marca))


def test_base_nueva_trae_simbolos_y_la_version_actual(tmp_path):
    con = db.conectar(tmp_path / "nueva.db")
    db.inicializar(con)
    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert {f[0] for f in con.execute("SELECT emoji FROM categoria")} >= {"i:comida", "i:casa", "i:trabajo", "i:regalo"}


def test_migracion_7_agrega_el_limite_de_la_tarjeta(tmp_path):
    con = db.conectar(tmp_path / "v6.db")
    con.executescript(esquema_v6())
    assert "limite" not in {f["name"] for f in con.execute("PRAGMA table_info(cuenta)")}
    con.execute("PRAGMA user_version = 6")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta (id, nombre, creado, actualizado, es_credito, dia_corte) VALUES ('visa', 'Visa', ?, ?, 1, 18)",
                    (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert tuple(con.execute("SELECT dia_corte, limite FROM cuenta").fetchone()) == (18, None)


def test_migracion_8_agrega_el_corte_del_minimo_corregido(tmp_path):
    con = db.conectar(tmp_path / "v7.db")
    con.executescript(esquema_v7())
    assert "minimo_corte" not in {f["name"] for f in con.execute("PRAGMA table_info(cuenta)")}
    con.execute("PRAGMA user_version = 7")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta (id, nombre, creado, actualizado, es_credito, dia_corte, limite) "
                    "VALUES ('visa', 'Visa', ?, ?, 1, 18, 100000)", (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert tuple(con.execute("SELECT limite, minimo_corte FROM cuenta").fetchone()) == (100000, None)


def test_migracion_9_agrega_la_deuda_al_corte_inicial(tmp_path):
    con = db.conectar(tmp_path / "v8.db")
    con.executescript(esquema_v8())
    assert "deuda_al_corte" not in {f["name"] for f in con.execute("PRAGMA table_info(cuenta)")}
    con.execute("PRAGMA user_version = 8")
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO cuenta (id, nombre, creado, actualizado, es_credito, dia_corte, limite) "
                    "VALUES ('visa', 'Visa', ?, ?, 1, 18, 100000)", (marca, marca))

    db.inicializar(con)

    assert con.execute("PRAGMA user_version").fetchone()[0] == db.VERSION
    assert tuple(con.execute("SELECT limite, corte_inicial, deuda_al_corte, pagos_tras_corte FROM cuenta").fetchone()) == (
        100000, None, None, None)
