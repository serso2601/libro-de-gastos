from datetime import date


def gasto(**cambios):
    return {"tipo": "gasto", "monto": 1250, "fecha": "2026-10-16", "cuenta_id": "efectivo", "categoria_id": "comida",
            "nota": "almuerzo", **cambios}


def test_sin_token_no_entra(anonimo):
    assert anonimo.get("/api/datos").status_code == 401
    assert anonimo.get("/").status_code == 200  # la página de estado es pública
    assert anonimo.get("/salud").json() == {"ok": True}


def test_base_nueva_trae_lo_basico(cliente):
    d = cliente.get("/api/datos").json()
    assert [c["nombre"] for c in d["cuentas"]] == ["Efectivo"]
    assert len(d["categorias"]) == 12
    assert d["moneda"] == "$"
    assert d["hoy"] == "2026-10-16"


def test_guardar_es_idempotente_y_mueve_el_saldo(cliente):
    for _ in range(2):  # el teléfono reintenta: no se duplica
        assert cliente.put("/api/movimientos/m1", json=gasto()).status_code == 200
    cliente.put("/api/movimientos/m2", json=gasto(tipo="ingreso", categoria_id="sueldo", monto=10000))
    d = cliente.get("/api/datos").json()
    assert len(d["movimientos"]) == 2
    assert d["cuentas"][0]["saldo"] == 10000 - 1250


def test_transferencia_mueve_entre_cuentas(cliente):
    cliente.put("/api/cuentas/banco", json={"nombre": "Banco", "saldo_inicial": 50000})
    r = cliente.put("/api/movimientos/t1", json={"tipo": "transferencia", "monto": 20000, "fecha": "2026-10-16",
                                                 "cuenta_id": "banco", "cuenta_destino_id": "efectivo", "categoria_id": "comida"})
    assert r.status_code == 200 and r.json()["categoria_id"] is None
    saldos = {c["id"]: c["saldo"] for c in cliente.get("/api/datos").json()["cuentas"]}
    assert saldos == {"efectivo": 20000, "banco": 30000}


def test_validaciones(cliente):
    assert cliente.put("/api/movimientos/x", json=gasto(categoria_id="sueldo")).status_code == 422
    assert cliente.put("/api/movimientos/x", json=gasto(cuenta_id="no-existe")).status_code == 422
    assert cliente.put("/api/movimientos/x", json=gasto(monto=0)).status_code == 422
    assert cliente.put("/api/movimientos/x", json={"tipo": "transferencia", "monto": 5, "fecha": "2026-10-16",
                                                   "cuenta_id": "efectivo", "cuenta_destino_id": "efectivo"}).status_code == 422


def test_no_se_borra_lo_que_esta_en_uso(cliente):
    cliente.put("/api/movimientos/m1", json=gasto())
    assert cliente.delete("/api/categorias/comida").status_code == 409
    assert cliente.delete("/api/cuentas/efectivo").status_code == 409
    assert cliente.delete("/api/categorias/salud").status_code == 200


def test_recurrencia_crea_solo_hasta_hoy(cliente, reloj):
    rec = {"tipo": "gasto", "monto": 2500, "cuenta_id": "efectivo", "categoria_id": "servicios", "nota": "Netflix",
           "frecuencia": "mensual", "fecha_inicio": "2026-08-20"}
    r = cliente.put("/api/recurrencias/netflix", json=rec).json()
    assert r["creados"] == 2  # 20/ago y 20/sep; el 20/oct todavía no llegó
    d = cliente.get("/api/datos").json()
    assert sorted(m["fecha"] for m in d["movimientos"]) == ["2026-08-20", "2026-09-20"]
    assert d["proximos"][0]["fecha"] == "2026-10-20"

    reloj.dia = date(2026, 10, 20)
    d = cliente.get("/api/datos").json()
    assert len(d["movimientos"]) == 3
    assert cliente.get("/api/datos").json()["movimientos"] == d["movimientos"]  # pedirlo otra vez no duplica


def test_ocurrencia_borrada_no_vuelve(cliente, reloj):
    rec = {"tipo": "gasto", "monto": 900, "cuenta_id": "efectivo", "categoria_id": "transporte",
           "frecuencia": "semanal", "fecha_inicio": "2026-10-02"}
    cliente.put("/api/recurrencias/bus", json=rec)
    cliente.delete("/api/movimientos/bus@2026-10-09")
    reloj.dia = date(2026, 10, 24)
    fechas = sorted(m["fecha"] for m in cliente.get("/api/datos").json()["movimientos"])
    assert fechas == ["2026-10-02", "2026-10-16", "2026-10-23"]


def test_borrar_esta_y_las_siguientes_termina_la_regla(cliente, reloj):
    rec = {"tipo": "gasto", "monto": 900, "cuenta_id": "efectivo", "categoria_id": "transporte",
           "frecuencia": "semanal", "fecha_inicio": "2026-10-02"}
    cliente.put("/api/recurrencias/bus", json=rec)
    cliente.delete("/api/movimientos/bus@2026-10-09", params={"y_siguientes": True})
    reloj.dia = date(2026, 12, 1)
    d = cliente.get("/api/datos").json()
    assert [m["fecha"] for m in d["movimientos"]] == ["2026-10-02"]
    assert d["recurrencias"][0]["fecha_fin"] == "2026-10-08"
    assert d["proximos"] == []


def test_cambiar_la_regla_vale_para_lo_que_viene(cliente, reloj):
    rec = {"tipo": "gasto", "monto": 2500, "cuenta_id": "efectivo", "categoria_id": "servicios",
           "frecuencia": "mensual", "fecha_inicio": "2026-09-01"}
    cliente.put("/api/recurrencias/r", json=rec)
    cliente.put("/api/recurrencias/r", json={**rec, "monto": 3000})
    reloj.dia = date(2026, 11, 1)
    montos = {m["fecha"]: m["monto"] for m in cliente.get("/api/datos").json()["movimientos"]}
    assert montos == {"2026-09-01": 2500, "2026-10-01": 2500, "2026-11-01": 3000}
    assert cliente.put("/api/recurrencias/r", json={**rec, "fecha_inicio": "2026-09-02"}).status_code == 422


def test_orden_y_ajustes(cliente):
    cliente.put("/api/cuentas/banco", json={"nombre": "Banco"})
    cliente.put("/api/orden/cuentas", json={"ids": ["banco", "efectivo"]})
    cliente.put("/api/ajustes", json={"moneda": "B/."})
    d = cliente.get("/api/datos").json()
    assert [c["id"] for c in d["cuentas"]] == ["banco", "efectivo"]
    assert d["moneda"] == "B/."


def test_la_web_entra_con_cookie_y_escribe_con_su_cabecera(anonimo, config):
    assert anonimo.post("/web/entrar", json={"token": "otro"}).status_code == 401
    assert anonimo.post("/web/entrar", json={"token": config.token}).status_code == 200
    assert anonimo.get("/api/datos").status_code == 200
    assert anonimo.put("/api/movimientos/m1", json=gasto()).status_code == 401
    assert anonimo.put("/api/movimientos/m1", json=gasto(), headers={"x-app-web": "1"}).status_code == 200
