def _visa(cliente):
    cliente.put("/api/cuentas/visa", json={"nombre": "Visa", "es_credito": True, "dia_corte": 18}).raise_for_status()


def _cortes(cliente):
    return cliente.get("/api/datos").json()["cortes_tarjeta"]


def test_guardar_actualizar_y_borrar_un_corte(cliente):
    _visa(cliente)
    r = cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 2500, "dias": 3})
    assert r.status_code == 200
    assert r.json() == {"cuenta_id": "visa", "corte": "2026-10-18", "minimo": 2500, "dias": 3}
    assert _cortes(cliente) == [{"cuenta_id": "visa", "corte": "2026-10-18", "minimo": 2500, "dias": 3}]

    cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 3000}).raise_for_status()
    assert _cortes(cliente) == [{"cuenta_id": "visa", "corte": "2026-10-18", "minimo": 3000, "dias": None}]

    assert cliente.delete("/api/cuentas/visa/cortes/2026-10-18").json() == {"ok": True}
    assert _cortes(cliente) == []
    assert cliente.delete("/api/cuentas/visa/cortes/2026-10-18").json() == {"ok": True}


def test_solo_las_tarjetas_de_credito_tienen_cortes(cliente):
    assert cliente.put("/api/cuentas/efectivo/cortes/2026-10-18", json={"minimo": 100}).status_code == 404
    assert cliente.put("/api/cuentas/no-existe/cortes/2026-10-18", json={"minimo": 100}).status_code == 404


def test_corte_con_datos_invalidos(cliente):
    _visa(cliente)
    assert cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": -1}).status_code == 422
    assert cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 1, "dias": -2}).status_code == 422
    assert cliente.put("/api/cuentas/visa/cortes/nunca", json={"minimo": 100}).status_code == 422


def test_borrar_la_cuenta_borra_sus_cortes(cliente):
    _visa(cliente)
    cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 2500}).raise_for_status()
    assert cliente.delete("/api/cuentas/visa?con_todo=true").status_code == 200
    assert _cortes(cliente) == []


def test_el_respaldo_incluye_los_cortes(cliente):
    _visa(cliente)
    cliente.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 2500, "dias": 2}).raise_for_status()
    assert cliente.get("/api/exportar").json()["cortes_tarjeta"] == [
        {"cuenta_id": "visa", "corte": "2026-10-18", "minimo": 2500, "dias": 2}]
