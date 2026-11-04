"""Yappy y Apple Pay que se anotan solos, y los cargos fijos del banco. Todo inventado: ni Gmail ni Claude de verdad."""

import base64
import json
import time
from datetime import date

import pytest
from fastapi.testclient import TestClient

from gastos import correo, db
from gastos.api import create_app

HOY = date(2026, 10, 31)

TE_ENVIARON = """Te enviaron con Yappy
 $30.00
 Enviado
 por
 Ana
 R.
 ****-1234
 Fecha
 30 oct 2026 07:00 p. m.
 Mensaje
 Confirmación
 ABCDE-00000001
 Estamos aquí para ayudarte."""

ENVIASTE = """Enviaste con Yappy
 $8.00
 Enviado
 a
 Luis
 Pérez
 60000000
 Fecha
 01 nov 2026 03:02 a. m.
 Mensaje
 Confirmación
 FGHIJ-00000002"""

PAGASTE = """Pagaste con Yappy
 $34.29
 Pagado a
 Tienda Ejemplo Ecommerce
 Fecha
 30 oct 2026 11:15 a. m.
 Mensaje
 Por pedido XYZ123
 Confirmación
 KLMNO-00000003"""

ASUNTOS = {"ingreso": "¡Te enviaron por Yappy! 💸", "enviaste": "¡Enviaste un Yappy! 💸", "pagaste": "¡Pagaste por Yappy! 💸"}


def yappy(texto, asunto, clave="<y1@x>"):
    return {"remitente": "Yappy <notificaciones@yappy.com.pa>", "asunto": asunto, "texto": texto, "fecha": "2026-10-31",
            "clave": clave, "origen": "correo"}


class Elector:
    """Elige siempre la misma categoría y cuenta cuántas veces lo llamaron."""

    def __init__(self, id_="compras", error=None):
        self.id_, self.error, self.llamadas = id_, error, []

    def __call__(self, datos, categorias):
        self.llamadas.append((datos, [c["id"] for c in categorias]))
        if self.error:
            raise self.error
        return self.id_


class SinClaude:
    def __init__(self):
        self.llamadas = 0

    def __call__(self, *a):
        self.llamadas += 1
        raise AssertionError("un Yappy no se lee con Claude")


@pytest.fixture
def con(config):
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    yield c
    c.close()


def fila(con, clave="<y1@x>"):
    return dict(con.execute("SELECT * FROM pendiente WHERE clave = ?", (clave,)).fetchone())


def poner_cuenta_yappy(con, cuenta="efectivo"):
    with con:
        con.execute("INSERT INTO ajuste VALUES ('cuenta_yappy', ?)", (cuenta,))


# --- El lector --------------------------------------------------------------------------------------
def test_te_enviaron_es_un_ingreso():
    y = correo.leer_yappy(ASUNTOS["ingreso"], TE_ENVIARON)
    assert (y["tipo"], y["monto"], y["contraparte"], y["comercio"], y["mensaje"]) == ("ingreso", 3000, "Ana R.", "Yappy de Ana R.", "")
    assert (y["fecha"], y["hora"], y["confirmacion"]) == ("2026-10-30", "19:00", "ABCDE-00000001")


def test_enviaste_es_un_gasto_y_la_madrugada_va_en_24_horas():
    y = correo.leer_yappy(ASUNTOS["enviaste"], ENVIASTE)
    assert (y["tipo"], y["monto"], y["contraparte"], y["comercio"]) == ("gasto", 800, "Luis Pérez", "Yappy a Luis Pérez")
    assert (y["fecha"], y["hora"], y["confirmacion"]) == ("2026-11-01", "03:02", "FGHIJ-00000002")


def test_pagaste_trae_el_mensaje_en_la_nota():
    y = correo.leer_yappy(ASUNTOS["pagaste"], PAGASTE)
    assert (y["tipo"], y["monto"], y["contraparte"], y["mensaje"]) == ("gasto", 3429, "Tienda Ejemplo Ecommerce", "Por pedido XYZ123")
    assert (y["comercio"], y["hora"], y["confirmacion"]) == ("Yappy en Tienda Ejemplo Ecommerce · Por pedido XYZ123", "11:15", "KLMNO-00000003")


def test_con_mensaje_la_nota_lleva_la_persona_y_el_mensaje():
    texto = TE_ENVIARON.replace(" Mensaje\n Confirmación", " Mensaje\n Por pedido XYZ123\n Confirmación")
    assert correo.leer_yappy(ASUNTOS["ingreso"], texto)["comercio"] == "Yappy de Ana R. · Por pedido XYZ123"


@pytest.mark.parametrize("hora_12, hora_24", [("12:05 a. m.", "00:05"), ("12:30 p. m.", "12:30"), ("01:00 p. m.", "13:00"),
                                              ("11:59 p. m.", "23:59"), ("09:10 a. m.", "09:10")])
def test_a_m_y_p_m(hora_12, hora_24):
    texto = ENVIASTE.replace("03:02 a. m.", hora_12)
    assert correo.leer_yappy(ASUNTOS["enviaste"], texto)["hora"] == hora_24


@pytest.mark.parametrize("asunto, texto", [
    ("Promoción", "Descubre Yappy"),
    (ASUNTOS["ingreso"], TE_ENVIARON.replace("$30.00", "treinta")),  # sin monto
    (ASUNTOS["ingreso"], TE_ENVIARON.replace("30 oct 2026 07:00 p. m.", "algún día")),  # sin fecha legible
    (ASUNTOS["pagaste"], PAGASTE.replace("Pagado a", "Pagado")),  # no se sabe a quién
    ("", ""),
])
def test_lo_que_no_cuadra_es_none(asunto, texto):
    assert correo.leer_yappy(asunto, texto) is None


# --- Procesar ---------------------------------------------------------------------------------------
def test_sin_cuenta_de_yappy_queda_para_revisar_con_el_motivo(con):
    elector, claude = Elector(), SinClaude()
    assert correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"]), claude, HOY, elector) == "nuevo"
    p = fila(con)
    assert (p["origen"], p["motivo"], p["monto"], p["categoria_id"]) == ("yappy", "¿De qué cuenta sale tu Yappy?", 3429, "compras")
    assert (p["contraparte"], p["referencia"]) == ("Tienda Ejemplo Ecommerce", "KLMNO-00000003")
    assert p["comercio"] == "Yappy en Tienda Ejemplo Ecommerce · Por pedido XYZ123"
    assert claude.llamadas == 0 and elector.llamadas == []  # los Yappy no llaman a Claude


def primera_de(con, tipo):
    return con.execute("SELECT id FROM categoria WHERE tipo = ? ORDER BY orden, creado", (tipo,)).fetchone()[0]


def categoria_del_movimiento(con):
    return con.execute("SELECT categoria_id FROM movimiento WHERE origen = 'yappy' ORDER BY rowid DESC").fetchone()[0]


def test_con_cuenta_de_yappy_entra_sola_con_origen_yappy(con):
    poner_cuenta_yappy(con)
    assert correo.procesar(con, yappy(TE_ENVIARON, ASUNTOS["ingreso"]), SinClaude(), HOY, Elector()) == "agregado"
    m = dict(con.execute("SELECT * FROM movimiento").fetchone())
    assert (m["origen"], m["tipo"], m["monto"], m["nota"], m["cuenta_id"], m["categoria_id"], m["fecha"], m["hora"]) == \
           ("yappy", "ingreso", 3000, "Yappy de Ana R.", "efectivo", primera_de(con, "ingreso"), "2026-10-30", "19:00")


def test_los_tres_formatos_de_nota(con):
    poner_cuenta_yappy(con)
    for i, (t, a) in enumerate([(TE_ENVIARON, "ingreso"), (ENVIASTE, "enviaste"), (PAGASTE, "pagaste")]):
        correo.procesar(con, yappy(t, ASUNTOS[a], f"<n{i}@x>"), SinClaude(), HOY)
    notas = {f[0] for f in con.execute("SELECT nota FROM movimiento")}
    assert notas == {"Yappy de Ana R.", "Yappy a Luis Pérez", "Yappy en Tienda Ejemplo Ecommerce · Por pedido XYZ123"}


def test_categoria_por_defecto_compras_para_gasto_y_primera_para_ingreso(con):
    poner_cuenta_yappy(con)
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == "compras"
    correo.procesar(con, yappy(TE_ENVIARON, ASUNTOS["ingreso"], "<b@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == primera_de(con, "ingreso")


def test_sin_compras_el_gasto_va_a_la_primera_de_gasto(con):
    poner_cuenta_yappy(con)
    with con:
        con.execute("DELETE FROM categoria WHERE id = 'compras'")
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"]), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == primera_de(con, "gasto")


def test_categoria_configurada_gana_y_si_se_borra_vuelve_a_automatica(con):
    poner_cuenta_yappy(con)
    with con:
        con.execute("INSERT INTO ajuste VALUES ('yappy_categoria_gasto', 'comida')")
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == "comida"
    with con:
        con.execute("UPDATE movimiento SET categoria_id = 'otros'")
        con.execute("DELETE FROM categoria WHERE id = 'comida'")
    correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"], "<b@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == "compras"
    with con:  # una configurada del tipo equivocado tampoco vale
        con.execute("UPDATE ajuste SET valor = 'sueldo' WHERE clave = 'yappy_categoria_gasto'")
    assert correo.categoria_yappy_por_defecto(con, "gasto") == "compras"


def test_memoria_por_contraparte_usa_la_categoria_actual_del_movimiento(con):
    poner_cuenta_yappy(con)
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY)
    # El usuario le cambia la categoría y también el nombre de la nota.
    with con:
        con.execute("UPDATE movimiento SET categoria_id = 'entretenimiento', nota = 'Pizza con Luis'")
    otro = ENVIASTE.replace("FGHIJ-00000002", "FGHIJ-00000010").replace("Luis\n Pérez", "luis\n pérez")
    assert correo.procesar(con, yappy(otro, ASUNTOS["enviaste"], "<b@x>"), SinClaude(), HOY) == "agregado"
    assert categoria_del_movimiento(con) == "entretenimiento"


def test_la_memoria_ignora_otro_tipo_y_movimientos_borrados(con):
    poner_cuenta_yappy(con)
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY)
    with con:
        con.execute("UPDATE movimiento SET categoria_id = 'entretenimiento'")
    # Un ingreso de la misma persona no hereda la categoría de gasto.
    recibido = TE_ENVIARON.replace("Ana\n R.", "Luis\n Pérez")
    correo.procesar(con, yappy(recibido, ASUNTOS["ingreso"], "<b@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == primera_de(con, "ingreso")
    with con:
        con.execute("DELETE FROM movimiento WHERE tipo = 'gasto'")
    otro = ENVIASTE.replace("FGHIJ-00000002", "FGHIJ-00000011")
    correo.procesar(con, yappy(otro, ASUNTOS["enviaste"], "<c@x>"), SinClaude(), HOY)
    assert categoria_del_movimiento(con) == "compras"


def test_sin_categorias_del_tipo_va_a_revisar(con):
    poner_cuenta_yappy(con)
    with con:
        con.execute("DELETE FROM categoria WHERE tipo = 'ingreso'")
    assert correo.procesar(con, yappy(TE_ENVIARON, ASUNTOS["ingreso"]), SinClaude(), HOY) == "nuevo"
    assert fila(con)["motivo"] == "No pude elegir la categoría"


def test_la_misma_referencia_en_otro_correo_no_se_anota_dos_veces(con):
    poner_cuenta_yappy(con)
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY) == "agregado"
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<b@x>"), SinClaude(), HOY) is None
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY) is None
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 1
    assert fila(con, "<b@x>")["estado"] == "ignorado"  # su clave queda: no se vuelve a bajar


def test_lo_borrado_no_se_vuelve_a_crear(con):
    poner_cuenta_yappy(con)
    correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY)
    with con:
        con.execute("DELETE FROM movimiento")
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY) is None  # mismo correo
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<otro@x>"), SinClaude(), HOY) is None  # mismo código
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 0


def test_un_yappy_que_no_se_entiende_sigue_el_camino_de_claude(con):
    class Extractor:
        llamadas = 0

        def __call__(self, aviso, cats, ctas):
            Extractor.llamadas += 1
            return {"es_movimiento": False}

    assert correo.procesar(con, yappy("Yappy te trae descuentos", "Promoción"), Extractor(), HOY, Elector()) == "ignorado"
    assert Extractor.llamadas == 1 and fila(con)["origen"] == "correo"


def anotado_a_mano(con, id_, monto, fecha, tipo="gasto"):
    marca = db.ahora()
    with con:
        con.execute("INSERT INTO movimiento VALUES (?, ?, ?, ?, NULL, 'efectivo', NULL, 'comida', '', NULL, 'manual', ?, ?)",
                    (id_, tipo, monto, fecha, marca, marca))


def test_dos_yappy_iguales_no_son_duplicados_entre_si(con):
    poner_cuenta_yappy(con)
    elector = Elector("comida")
    segundo = ENVIASTE.replace("FGHIJ-00000002", "FGHIJ-00000009")
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<a@x>"), SinClaude(), HOY, elector) == "agregado"
    assert correo.procesar(con, yappy(segundo, ASUNTOS["enviaste"], "<b@x>"), SinClaude(), HOY, elector) == "agregado"
    assert con.execute("SELECT COUNT(*) FROM movimiento WHERE origen = 'yappy'").fetchone()[0] == 2


def test_un_yappy_anotado_a_mano_el_mismo_dia_si_es_duplicado(con):
    poner_cuenta_yappy(con)
    anotado_a_mano(con, "mano", 3429, "2026-10-30")
    assert correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"]), SinClaude(), HOY, Elector()) == "duplicado"
    assert fila(con)["movimiento_id"] == "mano"
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 1


def test_la_ventana_de_yappy_es_de_un_dia_y_la_del_correo_de_cuatro(con):
    poner_cuenta_yappy(con)
    anotado_a_mano(con, "dos-dias", 3429, "2026-10-28")  # 2 días antes del Yappy del 30
    assert correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"]), SinClaude(), HOY, Elector()) == "agregado"
    anotado_a_mano(con, "un-dia", 800, "2026-11-02", "gasto")
    assert correo.procesar(con, yappy(ENVIASTE, ASUNTOS["enviaste"], "<2@x>"), SinClaude(), HOY, Elector()) == "duplicado"


def test_lo_ya_tomado_por_otro_aviso_no_cuenta_como_duplicado(con):
    poner_cuenta_yappy(con)
    anotado_a_mano(con, "mano", 3429, "2026-10-30")
    marca = db.ahora()
    with con:  # otro aviso ya se ligó a ese movimiento
        con.execute("INSERT INTO pendiente (id, origen, clave, recibido, estado, movimiento_id, creado, actualizado) "
                    "VALUES ('otro', 'yappy', 'k', ?, 'aceptado', 'mano', ?, ?)", (marca, marca, marca))
    assert correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"]), SinClaude(), HOY, Elector()) == "agregado"


def test_un_movimiento_de_otra_via_no_es_duplicado(con):
    poner_cuenta_yappy(con)
    anotado_a_mano(con, "mano", 3429, "2026-10-30")
    con.execute("UPDATE movimiento SET origen = 'recurrencia' WHERE id = 'mano'")
    assert correo.procesar(con, yappy(PAGASTE, ASUNTOS["pagaste"]), SinClaude(), HOY, Elector()) == "agregado"


# --- API --------------------------------------------------------------------------------------------
@pytest.fixture
def elector():
    return Elector()


@pytest.fixture
def api(config, reloj, elector):
    with TestClient(create_app(config, hoy=reloj, extractor=SinClaude(), elector=elector),
                    headers={"Authorization": f"Bearer {config.token}"}) as c:
        yield c


def yappy_pendiente(config, texto=PAGASTE, asunto=ASUNTOS["pagaste"], clave="<y1@x>"):
    c = db.conectar(config.ruta_db)
    try:
        correo.procesar(c, yappy(texto, asunto, clave), SinClaude(), HOY, Elector("compras"))
        return c.execute("SELECT id FROM pendiente WHERE clave = ?", (clave,)).fetchone()[0]
    finally:
        c.close()


def cuenta(api, id_, **cambios):
    r = api.put(f"/api/cuentas/{id_}", json={"nombre": id_.title(), **cambios})
    assert r.status_code == 200, r.text
    return r.json()


def test_datos_trae_cuenta_yappy_y_el_ajuste_la_guarda(api):
    assert api.get("/api/datos").json()["cuenta_yappy"] is None
    r = api.put("/api/ajustes", json={"cuenta_yappy": "efectivo"})
    assert r.status_code == 200 and r.json()["cuenta_yappy"] == "efectivo"
    assert api.get("/api/datos").json()["cuenta_yappy"] == "efectivo"
    assert "cuenta_yappy" not in api.get("/api/exportar").json()
    assert api.put("/api/ajustes", json={"moneda": "$"}).json()["cuenta_yappy"] == "efectivo"  # no se pierde
    assert api.put("/api/ajustes", json={"cuenta_yappy": ""}).json()["cuenta_yappy"] is None
    assert api.get("/api/datos").json()["cuenta_yappy"] is None


def test_cuenta_yappy_inexistente_es_422(api):
    assert api.put("/api/ajustes", json={"cuenta_yappy": "fantasma"}).status_code == 422


def test_poner_la_cuenta_de_yappy_anota_los_que_esperaban(api, config):
    cuenta(api, "banco")
    yappy_pendiente(config, PAGASTE, ASUNTOS["pagaste"], "<1@x>")
    yappy_pendiente(config, ENVIASTE, ASUNTOS["enviaste"], "<2@x>")
    d = api.get("/api/datos").json()
    assert [p["motivo"] for p in d["pendientes"]] == ["¿De qué cuenta sale tu Yappy?"] * 2 and d["movimientos"] == []
    api.put("/api/ajustes", json={"cuenta_yappy": "banco"})
    d = api.get("/api/datos").json()
    assert d["pendientes"] == []
    assert {(m["origen"], m["cuenta_id"]) for m in d["movimientos"]} == {("yappy", "banco")} and len(d["movimientos"]) == 2


def test_aceptar_un_yappy_aprende_la_cuenta_y_anota_los_otros(api, config):
    cuenta(api, "banco")
    primero = yappy_pendiente(config, PAGASTE, ASUNTOS["pagaste"], "<1@x>")
    yappy_pendiente(config, ENVIASTE, ASUNTOS["enviaste"], "<2@x>")
    r = api.put("/api/movimientos/m1", json={"tipo": "gasto", "monto": 3429, "fecha": "2026-10-30", "cuenta_id": "banco",
                                              "categoria_id": "compras", "nota": "Tienda"})
    assert r.status_code == 200
    assert api.put(f"/api/pendientes/{primero}", json={"estado": "aceptado", "movimiento_id": "m1"}).status_code == 200
    d = api.get("/api/datos").json()
    assert d["cuenta_yappy"] == "banco" and d["pendientes"] == []
    assert {m["id"]: m["origen"] for m in d["movimientos"]}["m1"] == "yappy"
    assert len(d["movimientos"]) == 2


def test_aceptar_no_cambia_la_cuenta_de_yappy_si_ya_estaba(api, config):
    cuenta(api, "banco")
    api.put("/api/ajustes", json={"cuenta_yappy": "efectivo"})
    p = yappy_pendiente(config)
    api.put("/api/movimientos/m1", json={"tipo": "gasto", "monto": 3429, "fecha": "2026-10-30", "cuenta_id": "banco",
                                          "categoria_id": "compras"})
    api.put(f"/api/pendientes/{p}", json={"estado": "aceptado", "movimiento_id": "m1"})
    assert api.get("/api/datos").json()["cuenta_yappy"] == "efectivo"


def test_ajustes_de_categoria_de_yappy(api):
    assert api.get("/api/datos").json()["yappy_categorias"] == {"gasto": None, "ingreso": None}
    r = api.put("/api/ajustes", json={"yappy_categoria_gasto": "comida", "yappy_categoria_ingreso": "sueldo"})
    assert r.status_code == 200 and r.json()["yappy_categorias"] == {"gasto": "comida", "ingreso": "sueldo"}
    assert api.get("/api/datos").json()["yappy_categorias"] == {"gasto": "comida", "ingreso": "sueldo"}
    assert "yappy_categorias" not in api.get("/api/exportar").json()
    assert api.put("/api/ajustes", json={"moneda": "$"}).json()["yappy_categorias"]["gasto"] == "comida"  # no se pierde
    r = api.put("/api/ajustes", json={"yappy_categoria_gasto": ""})
    assert r.json()["yappy_categorias"] == {"gasto": None, "ingreso": "sueldo"}


@pytest.mark.parametrize("cuerpo", [{"yappy_categoria_gasto": "sueldo"}, {"yappy_categoria_ingreso": "comida"},
                                    {"yappy_categoria_gasto": "fantasma"}])
def test_categoria_de_yappy_invalida_es_422(api, cuerpo):
    assert api.put("/api/ajustes", json=cuerpo).status_code == 422
    assert api.get("/api/datos").json()["yappy_categorias"] == {"gasto": None, "ingreso": None}


# --- Apple Pay --------------------------------------------------------------------------------------
def esperar(api, id_):
    c = db.conectar(api.app.state.config.ruta_db)
    try:
        for _ in range(100):
            f = c.execute("SELECT * FROM pendiente WHERE id = ?", (id_,)).fetchone()
            if f["motivo"] != correo.LEYENDO and f["estado"] != "ignorado":
                return dict(f)
            time.sleep(0.05)
    finally:
        c.close()
    raise AssertionError("el pendiente no se resolvió")


def test_apple_pay_con_campos_sueltos_entra_sin_extraer_nada(api, elector):
    cuenta(api, "visa", terminacion="4821")
    r = api.post("/api/entrada", json={"origen": "wallet", "monto": "$12.50", "comercio": "Super 99", "terminacion": "4821"})
    assert r.status_code == 200 and r.json()["ok"]
    p = esperar(api, r.json()["id"])
    assert (p["estado"], p["origen"], p["cuenta_id"], p["monto"], p["comercio"], p["fecha"]) == \
           ("agregado", "wallet", "visa", 1250, "Super 99", "2026-10-16")
    assert len(p["hora"]) == 5 and len(elector.llamadas) == 1  # la categoría la eligió el elector; nada se extrajo del texto
    m = api.get("/api/datos").json()["movimientos"][0]
    assert (m["origen"], m["tipo"], m["monto"], m["nota"], m["cuenta_id"], m["categoria_id"]) == \
           ("wallet", "gasto", 1250, "Super 99", "visa", "compras")


def test_apple_pay_sin_cuenta_conocida_espera_y_luego_entra(api):
    r = api.post("/api/entrada", json={"monto": "$3.00", "comercio": "Cafe", "terminacion": "4821"})
    p = esperar(api, r.json()["id"])
    assert (p["estado"], p["origen"], p["motivo"]) == ("nuevo", "wallet", "No sé de qué cuenta es la tarjeta •••4821")
    cuenta(api, "visa", terminacion="4821")
    api.put("/api/movimientos/m1", json={"tipo": "gasto", "monto": 300, "fecha": "2026-10-16", "cuenta_id": "visa",
                                          "categoria_id": "comida"})
    api.put(f"/api/pendientes/{p['id']}", json={"estado": "aceptado", "movimiento_id": "m1"})
    assert api.get("/api/datos").json()["pendientes"] == []


def test_apple_pay_repetido_el_mismo_dia_es_duplicado_de_lo_anotado_a_mano(api):
    cuenta(api, "visa", terminacion="4821")
    api.put("/api/movimientos/m1", json={"tipo": "gasto", "monto": 1250, "fecha": "2026-10-16", "cuenta_id": "visa",
                                          "categoria_id": "comida"})
    r = api.post("/api/entrada", json={"monto": 12.5, "comercio": "Super 99", "terminacion": "4821"})  # número, no texto
    assert esperar(api, r.json()["id"])["estado"] == "duplicado"


@pytest.mark.parametrize("cuerpo", [{}, {"comercio": "Super 99"}, {"origen": "wallet"}])
def test_entrada_sin_texto_ni_monto_es_422(api, cuerpo):
    assert api.post("/api/entrada", json=cuerpo).status_code == 422


def test_apple_pay_sin_comercio_entra_como_apple_pay(api, elector):
    # Hay terminales que no mandan el nombre del comercio: el pago no se pierde.
    cuenta(api, "visa", terminacion="4821")
    for comercio in (None, ""):
        cuerpo = {"monto": "$4.00", "terminacion": "4821", **({} if comercio is None else {"comercio": comercio})}
        r = api.post("/api/entrada", json=cuerpo)
        assert r.status_code == 200
        p = esperar(api, r.json()["id"])
        assert p["comercio"] == "Apple Pay" and p["monto"] == 400


@pytest.mark.parametrize("monto", ["gratis", "$0.00"])
def test_apple_pay_con_monto_raro_queda_por_revisar(api, monto):
    r = api.post("/api/entrada", json={"monto": monto, "comercio": "Super 99", "terminacion": "4821"})
    assert r.status_code == 200
    assert esperar(api, r.json()["id"])["estado"] == "nuevo"  # en «Por revisar», no perdido


def test_cada_pedido_de_entrada_queda_en_su_registro(api, config):
    api.post("/api/entrada", json={"monto": "$4.00", "comercio": "Cafe", "terminacion": "4821"})
    api.post("/api/entrada", json={})
    sin_llave = TestClient(api.app).post("/api/entrada", json={"monto": "$4.00"})
    assert sin_llave.status_code == 401
    lineas = (config.carpeta / "registros" / "entradas.log").read_text(encoding="utf-8").splitlines()
    assert any("recibido: monto='$4.00' comercio='Cafe'" in x for x in lineas)
    assert sum(x.endswith("→ 200") for x in lineas) == 1
    assert any("no se entendió" in x for x in lineas) and any(x.endswith("→ 422") for x in lineas)
    assert any(x.endswith("→ 401") for x in lineas)


# --- Cargos fijos del banco -------------------------------------------------------------------------
VINCULO = {"banco": "bg", "cuenta": "bg-ahorros-regular", "tarjeta": "bg-visa-debito", "membresia": "mensual",
           "seguro": "fraude-1000"}


def reglas(api):
    return {r["id"]: r for r in api.get("/api/datos").json()["recurrencias"]}


def test_el_vinculo_crea_las_reglas_desde_el_proximo_dia_3(api):
    cuenta(api, "visa", banco=VINCULO)
    r = reglas(api)
    assert set(r) == {"banco-visa-membresia", "banco-visa-seguro"}
    m, s = r["banco-visa-membresia"], r["banco-visa-seguro"]
    assert (m["monto"], m["frecuencia"], m["fecha_inicio"], m["fecha_fin"], m["categoria_id"], m["nota"], m["tipo"], m["cuenta_id"]) == \
           (268, "mensual", "2026-11-03", None, "cargos-banco", "Membresía Visa Débito", "gasto", "visa")
    assert (s["monto"], s["nota"], s["fecha_inicio"]) == (105, "Seguro contra fraude (hasta $1,000)", "2026-11-03")
    cat = next(c for c in api.get("/api/datos").json()["categorias"] if c["id"] == "cargos-banco")
    assert (cat["nombre"], cat["tipo"], cat["emoji"]) == ("Cargos del banco", "gasto", "i:banco")
    assert api.get("/api/datos").json()["movimientos"] == []  # nada de lo que ya pasó


@pytest.mark.parametrize("hoy, inicio", [(date(2026, 10, 1), "2026-10-03"), (date(2026, 10, 2), "2026-10-03"),
                                         (date(2026, 10, 3), "2026-11-03"), (date(2026, 10, 4), "2026-11-03"),
                                         (date(2026, 12, 20), "2027-01-03")])
def test_el_inicio_nunca_es_hoy_ni_antes(api, reloj, hoy, inicio):
    reloj.dia = hoy
    cuenta(api, "visa", banco=VINCULO)
    assert reglas(api)["banco-visa-membresia"]["fecha_inicio"] == inicio


def test_las_reglas_se_anotan_solas_el_dia_3(api, reloj):
    cuenta(api, "visa", banco=VINCULO)
    reloj.dia = date(2026, 11, 3)
    movs = [m for m in api.get("/api/datos").json()["movimientos"] if m["cuenta_id"] == "visa"]
    assert sorted(m["monto"] for m in movs) == [105, 268] and {m["categoria_id"] for m in movs} == {"cargos-banco"}


def test_guardar_otra_vez_pone_al_dia_sin_cambiar_el_inicio(api, reloj):
    cuenta(api, "visa", banco=VINCULO)
    reloj.dia = date(2026, 10, 20)
    cuenta(api, "visa", banco={**VINCULO, "seguro": "fraude-5000"})
    r = reglas(api)
    assert (r["banco-visa-seguro"]["monto"], r["banco-visa-seguro"]["nota"], r["banco-visa-seguro"]["fecha_inicio"]) == \
           (210, "Seguro contra fraude (hasta $5,000)", "2026-11-03")
    assert len(api.get("/api/datos").json()["recurrencias"]) == 2


def test_quitar_el_seguro_o_pasar_a_anual_termina_la_regla(api):
    cuenta(api, "visa", banco=VINCULO)
    cuenta(api, "visa", banco={**VINCULO, "seguro": None})
    r = reglas(api)
    assert r["banco-visa-seguro"]["fecha_fin"] == "2026-10-16" and r["banco-visa-membresia"]["fecha_fin"] is None
    cuenta(api, "visa", banco={**VINCULO, "seguro": None, "membresia": "anual"})
    assert reglas(api)["banco-visa-membresia"]["fecha_fin"] == "2026-10-16"


def test_quitar_el_vinculo_o_la_tarjeta_termina_las_reglas_y_volver_las_reactiva(api, reloj):
    cuenta(api, "visa", banco=VINCULO)
    cuenta(api, "visa", banco=None)
    assert {r["fecha_fin"] for r in reglas(api).values()} == {"2026-10-16"}
    cuenta(api, "visa", banco={"banco": "bg", "cuenta": "bg-ahorros-regular"})  # sin tarjeta
    assert {r["fecha_fin"] for r in reglas(api).values()} == {"2026-10-16"}
    reloj.dia = date(2026, 12, 10)
    cuenta(api, "visa", banco=VINCULO)
    r = reglas(api)
    assert {x["fecha_fin"] for x in r.values()} == {None} and r["banco-visa-membresia"]["fecha_inicio"] == "2026-11-03"
    # Los meses que estuvo terminada no se anotan de golpe.
    assert [m for m in api.get("/api/datos").json()["movimientos"] if m["cuenta_id"] == "visa"] == []


def test_una_tarjeta_de_credito_no_crea_cargos(api):
    cuenta(api, "visa", banco={"banco": "bg", "tarjeta": "bg-credito-classic"}, es_credito=True, dia_corte=10)
    assert reglas(api) == {}
    assert not any(c["id"] == "cargos-banco" for c in api.get("/api/datos").json()["categorias"])


def test_borrar_la_cuenta_con_todo_se_lleva_sus_reglas(api):
    cuenta(api, "visa", banco=VINCULO)
    assert api.delete("/api/cuentas/visa?con_todo=true").status_code == 200
    assert reglas(api) == {}


# --- --simular --------------------------------------------------------------------------------------
YAPPY_CRUDO = ("Message-ID: <sim@x>\r\nFrom: Yappy <notificaciones@yappy.com.pa>\r\nSubject: =?utf-8?q?=C2=A1Pagaste_por_Yappy!?=\r\n"
               "Date: Sat, 31 Oct 2026 12:00:00 -0500\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n"
               + PAGASTE.replace("\n", "\r\n")).encode()


class GoogleYappy:
    def __init__(self):
        self.pedidos = []

    def __call__(self, url, datos=None, token=None):
        self.pedidos.append(url)
        if "/messages?" in url:
            return {"messages": [{"id": "s1"}]}
        if "/messages/" in url:
            return {"raw": base64.urlsafe_b64encode(YAPPY_CRUDO).decode().rstrip("=")}
        raise AssertionError(url)


def test_simular_cuenta_lo_que_haria_y_no_escribe_nada(config, capsys):
    carpeta = config.carpeta
    (carpeta / "gmail-cliente.json").write_text(json.dumps({"installed": {"client_id": "id", "client_secret": "s"}}), encoding="utf-8")
    (carpeta / "gmail-permiso.json").write_text(json.dumps({"refresh_token": "r", "access_token": "a", "vence": time.time() + 3000}),
                                                encoding="utf-8")
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    poner_cuenta_yappy(c)
    anotado_a_mano(c, "mano", 3429, "2026-10-30")
    c.close()
    elector = Elector()
    avisos = correo.simular(carpeta, config.ruta_db, SinClaude(), elector, hoy=lambda: HOY, http=GoogleYappy())
    assert len(avisos) == 1
    a = avisos[0]
    assert (a["origen"], a["tipo"], a["monto"], a["fecha"], a["hora"], a["categoria"], a["destino"]) == \
           ("yappy", "gasto", 3429, "2026-10-30", "11:15", "Compras", "duplicado")
    correo._imprimir_simulacion(avisos)
    salida = capsys.readouterr().out
    assert "$34.29" in salida and "Tienda Ejemplo Ecommerce" in salida and "duplicado" in salida and "no se guardó nada" in salida
    # La base real quedó igual: ni pendientes ni movimientos nuevos.
    c = db.conectar(config.ruta_db)
    try:
        assert c.execute("SELECT COUNT(*) FROM pendiente").fetchone()[0] == 0
        assert c.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 1
    finally:
        c.close()


def test_simular_sin_gmail_configurado_explica(config):
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    c.close()
    with pytest.raises(correo.ErrorDeCorreo, match="no está configurado"):
        correo.simular(config.carpeta, config.ruta_db)


# --- Página de estado -------------------------------------------------------------------------------
def test_la_pagina_muestra_lo_ultimo_de_cada_via_sin_montos_ni_nombres(api, anonimo, config):
    cuenta(api, "visa", terminacion="4821")
    api.put("/api/ajustes", json={"cuenta_yappy": "visa"})
    yappy_pendiente(config, TE_ENVIARON, ASUNTOS["ingreso"])
    html = anonimo.get("/").text
    assert "Avisos (Yappy y Apple Pay)" in html and "Último Yappy: <b>hace un momento</b>" in html
    assert "último Apple Pay: <b>todavía nada</b>" in html
    assert "Ana" not in html and "30.00" not in html
