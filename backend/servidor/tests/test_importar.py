"""La importación del respaldo de la app vieja, con su forma real de guardar las recurrencias."""


def vieja(transacciones, **extra):
    return {
        "accounts": [{"id": "acc-efectivo", "name": "Efectivo", "color": "#34D8A6", "initialBalance": 100.5},
                     {"id": "acc-1", "name": "Banco", "color": "#3DA5F5", "initialBalance": 0}],
        "categories": [{"id": "cat-comida", "name": "Comida", "type": "expense", "color": "#3DA5F5", "emoji": "🍔"},
                       {"id": "cat-sueldo", "name": "Sueldo", "type": "income", "color": "#A78BFA", "emoji": "💼"}],
        "transactions": transacciones,
        "budgets": {"cat-comida": 200},
        "currency": "$",
        **extra,
    }


def grupo(gid, kind, fechas_, monto=25, cat="cat-comida", desde=0):
    return [{"id": f"{gid}-{i}", "kind": kind, "amount": monto, "accountId": "acc-efectivo", "categoryId": cat,
             "note": "Netflix", "date": f, "time": None, "recurrence": "monthly", "recurrenceGroupId": gid}
            for i, f in enumerate(fechas_, start=desde)]


DOCE_MESES = [f"2026-{m:02d}-05" for m in range(6, 13)] + [f"2027-{m:02d}-05" for m in range(1, 6)]


def test_simular_no_toca_nada(cliente):
    datos = vieja(grupo("grp-a", "expense", DOCE_MESES))
    r = cliente.post("/api/importar", params={"simular": True}, json=datos).json()
    assert r["movimientos"] == 5 and r["futuras_descartadas"] == 7 and r["recurrencias"] == 1
    assert cliente.get("/api/datos").json()["movimientos"] == []


def test_grupo_entero_queda_como_regla_abierta(cliente):
    sueltos = [{"id": "tx-1", "kind": "expense", "amount": 12.5, "accountId": "acc-efectivo", "categoryId": "cat-comida",
                "note": "almuerzo", "date": "2026-10-01", "time": "13:05", "recurrence": None, "recurrenceGroupId": None},
               {"id": "tf-1", "kind": "transfer", "amount": 50, "fromAccountId": "acc-efectivo", "toAccountId": "acc-1",
                "note": "", "date": "2026-10-02", "time": None}]
    r = cliente.post("/api/importar", json=vieja(sueltos + grupo("grp-a", "expense", DOCE_MESES))).json()
    assert r["recurrencias_abiertas"] == 1

    d = cliente.get("/api/datos").json()
    fechas = sorted(m["fecha"] for m in d["movimientos"] if m["recurrencia_id"] == "grp-a")
    assert fechas == ["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05"]  # nada futuro
    rec = d["recurrencias"][0]
    assert (rec["frecuencia"], rec["fecha_fin"], rec["generada_hasta"], rec["monto"]) == ("mensual", None, "2026-10-05", 2500)
    assert d["proximos"][0]["fecha"] == "2026-11-05"
    saldos = {c["id"]: c["saldo"] for c in d["cuentas"]}
    assert saldos == {"acc-efectivo": 10050 - 1250 - 5000 - 5 * 2500, "acc-1": 5000}
    comida = next(c for c in d["categorias"] if c["id"] == "cat-comida")
    assert comida["presupuesto"] == 20000
    assert next(m for m in d["movimientos"] if m["id"] == "tx-1")["hora"] == "13:05"


def test_grupo_cortado_termina_donde_quedo(cliente):
    cortado = grupo("grp-b", "expense", DOCE_MESES[:4])  # "esta y futuras" desde la 5ª
    cliente.post("/api/importar", json=vieja(cortado))
    d = cliente.get("/api/datos").json()
    assert d["recurrencias"][0]["fecha_fin"] == "2026-09-05"
    assert d["proximos"] == []


def test_ocurrencia_pasada_borrada_no_se_recrea(cliente):
    con_hueco = [t for t in grupo("grp-c", "expense", DOCE_MESES) if t["date"] != "2026-08-05"]
    cliente.post("/api/importar", json=vieja(con_hueco))
    fechas = sorted(m["fecha"] for m in cliente.get("/api/datos").json()["movimientos"])
    assert "2026-08-05" not in fechas and len(fechas) == 4


def test_huerfanos_van_a_rescate(cliente):
    raro = [{"id": "tx-9", "kind": "expense", "amount": 3, "accountId": "acc-borrada", "categoryId": "cat-borrada",
             "note": "", "date": "2026-10-01"}]
    cliente.post("/api/importar", json=vieja(raro))
    m = cliente.get("/api/datos").json()["movimientos"][0]
    assert (m["cuenta_id"], m["categoria_id"]) == ("cuenta-rescatada", "sin-categoria-gasto")


def test_no_importa_encima_de_datos(cliente):
    cliente.post("/api/importar", json=vieja(grupo("grp-a", "expense", DOCE_MESES)))
    assert cliente.post("/api/importar", json=vieja([])).status_code == 409
    assert cliente.post("/api/importar", json={"cualquier": "cosa"}).status_code == 409
