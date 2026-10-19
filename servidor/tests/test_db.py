from gastos import db


def test_migracion_2_pasa_quincenal_a_catorcenal_sin_soltar_movimientos(tmp_path):
    # Una base en la versión 1, con el CHECK viejo y una regla «quincenal» que ya anotó algo.
    con = db.conectar(tmp_path / "vieja.db")
    viejo = db.ESQUEMA.read_text(encoding="utf-8").replace("'semanal', 'catorcenal', 'quincenal'", "'semanal', 'quincenal'")
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
