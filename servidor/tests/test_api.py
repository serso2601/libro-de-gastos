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
    assert d["presupuesto"] == {"periodo": "mensual", "inicio": "1"}
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


def test_los_simbolos_largos_se_pueden_guardar(cliente):
    # «Entretenimiento» viene con i:entretenimiento (17 letras): ponerle tope no puede rechazarse.
    cat = {"nombre": "Entretenimiento", "tipo": "gasto", "emoji": "i:entretenimiento", "presupuesto": 8000}
    assert cliente.put("/api/categorias/entretenimiento", json=cat).status_code == 200
    assert cliente.put("/api/categorias/casa", json={**cat, "emoji": "i:electrodomestico"}).status_code == 200


def test_orden_y_ajustes(cliente):
    cliente.put("/api/cuentas/banco", json={"nombre": "Banco"})
    cliente.put("/api/orden/cuentas", json={"ids": ["banco", "efectivo"]})
    cliente.put("/api/ajustes", json={"moneda": "B/."})
    d = cliente.get("/api/datos").json()
    assert [c["id"] for c in d["cuentas"]] == ["banco", "efectivo"]
    assert d["moneda"] == "B/."


def test_el_qr_con_el_token_solo_se_ve_desde_la_pc(config, reloj, monkeypatch):
    from fastapi.testclient import TestClient

    from gastos import pagina
    from gastos.api import create_app

    monkeypatch.setattr(pagina, "ip_tailscale", lambda: "100.100.10.1")
    app = create_app(config, hoy=reloj)
    with TestClient(app, client=("127.0.0.1", 50000)) as c:
        assert "Conectar con tus datos" in c.get("/").text
    with TestClient(app, client=("100.100.20.2", 50000)) as c:
        pagina_tailnet = c.get("/").text
        assert "Conectar con tus datos" not in pagina_tailnet and config.token not in pagina_tailnet
    assert pagina.enlace_para_abrir() == "exp+libro-de-gastos://expo-development-client/?url=http%3A%2F%2F100.100.10.1%3A8082"
    assert pagina.enlace_para_conectar("abc", 8766) == "librogastos://conectar?d=100.100.10.1%3A8766&t=abc"
    assert pagina.enlace_para_la_web("abc", 8766) == "http://100.100.10.1:8766/app/conectar?d=100.100.10.1%3A8766&t=abc"


def test_sirve_la_app_web(config, reloj, tmp_path):
    from fastapi.testclient import TestClient

    from gastos.api import create_app

    web = tmp_path / "dist"
    (web / "_expo").mkdir(parents=True)
    (web / "index.html").write_text("<div id=root>", encoding="utf-8")
    (web / "_expo" / "entry.js").write_text("app()", encoding="utf-8")
    (web / "_expo" / "grande.js").write_text("x" * 5000, encoding="utf-8")
    (tmp_path / "secreto.txt").write_text("no", encoding="utf-8")
    with TestClient(create_app(config, hoy=reloj, web=web), client=("100.100.20.2", 50000)) as c:
        assert c.get("/app", follow_redirects=False).headers["location"] == "/app/"
        assert c.get("/app/").text == "<div id=root>"
        assert c.get("/app/cuenta/abc").text == "<div id=root>"  # las rutas de la app dan la página
        js = c.get("/app/_expo/entry.js")
        assert js.text == "app()" and "immutable" in js.headers["cache-control"]
        assert c.get("/app/_expo/grande.js").headers["content-encoding"] == "gzip"  # va comprimido
        assert c.post("/app/arranque", content='{"dibujo": 900}').status_code == 200
        assert c.get("/app/%2e%2e/secreto.txt").text == "<div id=root>"  # nada fuera de la carpeta


def test_solo_atiende_a_la_pc_y_a_la_tailnet(config, reloj):
    from fastapi.testclient import TestClient

    from gastos.api import create_app, desde_red_permitida

    app = create_app(config, hoy=reloj)
    cabecera = {"Authorization": f"Bearer {config.token}"}
    for ip, codigo in [("100.100.20.2", 200), ("127.0.0.1", 200), ("192.168.0.20", 403), ("8.8.8.8", 403)]:
        with TestClient(app, headers=cabecera, client=(ip, 50000)) as c:
            assert c.get("/api/datos").status_code == codigo, ip
    assert desde_red_permitida("::ffff:100.100.10.1")
    assert desde_red_permitida("fd7a:115c:a1e0::1")
    assert not desde_red_permitida("no-es-una-ip")


def test_tarjeta_de_credito(cliente):
    tarjeta = {"nombre": "Visa", "es_credito": True, "dia_corte": 15, "dia_pago": 5, "pago_minimo": 45000}
    r = cliente.put("/api/cuentas/visa", json=tarjeta)
    assert r.status_code == 200
    assert r.json()["es_credito"] is True and (r.json()["dia_corte"], r.json()["dia_pago"], r.json()["pago_minimo"]) == (15, 5, 45000)

    por_id = {c["id"]: c for c in cliente.get("/api/datos").json()["cuentas"]}
    assert por_id["visa"]["es_credito"] is True and por_id["visa"]["dia_corte"] == 15
    assert por_id["efectivo"]["es_credito"] is False and por_id["efectivo"]["dia_corte"] is None
    exportada = {c["id"]: c for c in cliente.get("/api/exportar").json()["cuentas"]}
    assert exportada["visa"]["es_credito"] is True and exportada["efectivo"]["es_credito"] is False

    # Si deja de ser tarjeta, los tres datos se limpian.
    r = cliente.put("/api/cuentas/visa", json={**tarjeta, "es_credito": False})
    assert r.json()["es_credito"] is False and (r.json()["dia_corte"], r.json()["dia_pago"], r.json()["pago_minimo"]) == (None, None, None)


def test_tarjeta_de_credito_pide_dia_de_corte(cliente):
    r = cliente.put("/api/cuentas/visa", json={"nombre": "Visa", "es_credito": True})
    assert r.status_code == 422 and "día de corte" in r.text
    assert cliente.put("/api/cuentas/visa", json={"nombre": "Visa", "es_credito": True, "dia_corte": 32}).status_code == 422
    assert cliente.put("/api/cuentas/visa", json={"nombre": "Visa", "es_credito": True, "dia_corte": 10, "pago_minimo": -1}).status_code == 422
    assert [c["id"] for c in cliente.get("/api/datos").json()["cuentas"]] == ["efectivo"]


def test_borrar_cuenta_con_todo(cliente):
    cliente.put("/api/cuentas/banco", json={"nombre": "Banco", "saldo_inicial": 50000})
    cliente.put("/api/cuentas/ahorro", json={"nombre": "Ahorro"})
    cliente.put("/api/movimientos/g1", json=gasto(cuenta_id="banco"))
    cliente.put("/api/movimientos/g2", json=gasto(cuenta_id="efectivo"))
    cliente.put("/api/movimientos/t1", json={"tipo": "transferencia", "monto": 700, "fecha": "2026-10-16",
                                             "cuenta_id": "efectivo", "cuenta_destino_id": "banco"})
    cliente.put("/api/movimientos/t2", json={"tipo": "transferencia", "monto": 300, "fecha": "2026-10-16",
                                             "cuenta_id": "efectivo", "cuenta_destino_id": "ahorro"})
    regla = {"tipo": "gasto", "monto": 900, "categoria_id": "transporte", "frecuencia": "semanal", "fecha_inicio": "2026-10-02"}
    cliente.put("/api/recurrencias/r-banco", json={**regla, "cuenta_id": "banco"})
    cliente.put("/api/recurrencias/r-efectivo", json={**regla, "cuenta_id": "efectivo"})
    cliente.put("/api/recurrencias/r-trans", json={"tipo": "transferencia", "monto": 100, "cuenta_id": "ahorro",
                                                   "cuenta_destino_id": "banco", "frecuencia": "mensual", "fecha_inicio": "2026-10-01"})

    # Sin con_todo sigue como antes: la cuenta en uso no se borra.
    assert cliente.delete("/api/cuentas/banco").status_code == 409
    assert cliente.delete("/api/cuentas/banco", params={"con_todo": False}).status_code == 409
    assert len(cliente.get("/api/datos").json()["cuentas"]) == 3

    assert cliente.delete("/api/cuentas/banco", params={"con_todo": True}).status_code == 200
    d = cliente.get("/api/datos").json()
    assert sorted(c["id"] for c in d["cuentas"]) == ["ahorro", "efectivo"]
    assert {m["id"] for m in d["movimientos"] if m["origen"] == "manual"} == {"g2", "t2"}
    assert all("banco" not in (m["cuenta_id"], m["cuenta_destino_id"]) for m in d["movimientos"])
    assert [r["id"] for r in d["recurrencias"]] == ["r-efectivo"]


def test_borrar_la_unica_cuenta_sigue_siendo_409_aun_con_todo(cliente):
    cliente.put("/api/movimientos/m1", json=gasto())
    assert cliente.delete("/api/cuentas/efectivo", params={"con_todo": True}).status_code == 409
    assert len(cliente.get("/api/datos").json()["movimientos"]) == 1


def test_periodo_del_presupuesto_por_defecto_tambien_se_exporta(cliente):
    assert cliente.get("/api/datos").json()["presupuesto"] == {"periodo": "mensual", "inicio": "1"}
    assert cliente.get("/api/exportar").json()["presupuesto"] == {"periodo": "mensual", "inicio": "1"}


def test_ajustes_con_cada_periodo_valido(cliente):
    casos = [("semanal", "0", "0"), ("semanal", "6", "6"), ("catorcenal", "2026-10-05", "2026-10-05"),
             ("quincenal", "", ""), ("quincenal", "15", ""), ("quincenal", None, ""),
             ("mensual", "1", "1"), ("mensual", "28", "28")]
    for periodo, inicio, guardado in casos:
        cuerpo = {"presupuesto_periodo": periodo}
        if inicio is not None:
            cuerpo["presupuesto_inicio"] = inicio
        r = cliente.put("/api/ajustes", json=cuerpo)
        esperado = {"periodo": periodo, "inicio": guardado}
        assert r.status_code == 200 and r.json() == {"moneda": "$", "presupuesto": esperado}, (periodo, inicio)
        assert cliente.get("/api/datos").json()["presupuesto"] == esperado
        assert cliente.get("/api/exportar").json()["presupuesto"] == esperado


def test_ajustes_rechaza_un_inicio_que_no_corresponde(cliente):
    cliente.put("/api/ajustes", json={"presupuesto_periodo": "semanal", "presupuesto_inicio": "3"})
    malos = [("semanal", "7"), ("semanal", "lunes"), ("semanal", None), ("catorcenal", "5"), ("catorcenal", "2026-13-40"),
             ("catorcenal", ""), ("mensual", "0"), ("mensual", "29"), ("mensual", "uno"), ("mensual", None),
             ("anual", "1")]
    for periodo, inicio in malos:
        cuerpo = {"presupuesto_periodo": periodo, "presupuesto_inicio": inicio}
        r = cliente.put("/api/ajustes", json=cuerpo)
        assert r.status_code == 422, (periodo, inicio)
    assert "semanal" in cliente.put("/api/ajustes", json={"presupuesto_periodo": "semanal", "presupuesto_inicio": "9"}).text
    # Nada de lo rechazado se guardó.
    assert cliente.get("/api/datos").json()["presupuesto"] == {"periodo": "semanal", "inicio": "3"}


def test_cambiar_solo_la_moneda_no_borra_el_periodo(cliente):
    cliente.put("/api/ajustes", json={"presupuesto_periodo": "catorcenal", "presupuesto_inicio": "2026-10-05"})
    r = cliente.put("/api/ajustes", json={"moneda": "€"})
    assert r.json() == {"moneda": "€", "presupuesto": {"periodo": "catorcenal", "inicio": "2026-10-05"}}
    d = cliente.get("/api/datos").json()
    assert d["moneda"] == "€" and d["presupuesto"] == {"periodo": "catorcenal", "inicio": "2026-10-05"}
    # Y al revés: cambiar el periodo no toca la moneda.
    r = cliente.put("/api/ajustes", json={"presupuesto_periodo": "mensual", "presupuesto_inicio": "15"})
    assert r.json() == {"moneda": "€", "presupuesto": {"periodo": "mensual", "inicio": "15"}}


def test_categoria_que_pasa_lo_que_sobra(cliente):
    cat = {"nombre": "Comida", "tipo": "gasto", "presupuesto": 30000, "acumula": True, "acumula_desde": "2026-10-01"}
    r = cliente.put("/api/categorias/comida", json=cat)
    assert r.status_code == 200 and r.json()["acumula"] is True and r.json()["acumula_desde"] == "2026-10-01"

    por_id = {c["id"]: c for c in cliente.get("/api/datos").json()["categorias"]}
    assert por_id["comida"]["acumula"] is True and por_id["comida"]["acumula_desde"] == "2026-10-01"
    assert por_id["salud"]["acumula"] is False and por_id["salud"]["acumula_desde"] is None
    exportada = {c["id"]: c for c in cliente.get("/api/exportar").json()["categorias"]}
    assert exportada["comida"]["acumula"] is True and exportada["salud"]["acumula"] is False

    # Sin decir nada, `acumula` queda apagado; con acumula en false la fecha se limpia aunque llegue.
    r = cliente.put("/api/categorias/comida", json={**cat, "acumula": False})
    assert r.json()["acumula"] is False and r.json()["acumula_desde"] is None
    assert cliente.put("/api/categorias/nueva", json={"nombre": "Nueva", "tipo": "gasto"}).json()["acumula"] is False
    por_id = {c["id"]: c for c in cliente.get("/api/datos").json()["categorias"]}
    assert por_id["comida"]["acumula"] is False and por_id["comida"]["acumula_desde"] is None
