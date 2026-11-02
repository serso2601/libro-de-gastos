"""Los avisos del banco y las cuentas con banco. Nunca se usa IMAP ni Claude de verdad: el extractor es falso
y los avisos, inventados."""

import time
from datetime import date

import pytest
from fastapi.testclient import TestClient

from gastos import correo, db
from gastos.api import create_app

HOY = date(2026, 10, 31)


class Falso:
    """Un extractor que responde lo que se le diga y cuenta cuántas veces lo llamaron."""

    def __init__(self, **respuesta):
        self.respuesta = {"es_movimiento": True, "tipo": "gasto", "monto": "23.75", "fecha": "2026-10-31", "hora": "18:42",
                          "comercio": "Super 99", "categoria_id": "comida", "terminacion": "4821", **respuesta}
        self.llamadas = 0
        self.error = None

    def __call__(self, aviso, categorias, cuentas):
        self.llamadas += 1
        if self.error:
            raise self.error
        return self.respuesta


def aviso(texto="Compra con su tarjeta terminada en 4821 por USD 23.75 en SUPER 99 el 31/10/2026 18:42", clave="<a@x>", **resto):
    return {"remitente": "avisos@banco.example", "asunto": "Aviso", "texto": texto, "fecha": "2026-10-31",
            "clave": clave, "origen": "correo", **resto}


@pytest.fixture
def falso():
    return Falso()


@pytest.fixture
def con(config):
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    yield c
    c.close()


def poner_terminacion(con, terminacion="4821", cuenta="efectivo"):
    with con:
        con.execute("UPDATE cuenta SET terminacion = ? WHERE id = ?", (terminacion, cuenta))


def fila(con, clave="<a@x>"):
    return dict(con.execute("SELECT * FROM pendiente WHERE clave = ?", (clave,)).fetchone())


# --- Montos ----------------------------------------------------------------------------------------
@pytest.mark.parametrize("texto, centavos", [
    ("23.75", 2375), ("1,234.56", 123456), ("1.234,56", 123456), ("B/. 5.00", 500), ("USD 23.75", 2375),
    ("1,234", 123400), ("12", 1200), ("0.5", 50),
])
def test_montos_a_centavos(texto, centavos):
    assert correo.a_centavos(texto) == centavos


def test_montos_del_texto_junta_todos():
    assert {2375, 123456} <= correo.montos_del_texto("Pagó USD 23.75 de un total de B/. 1,234.56.")


# --- Procesar --------------------------------------------------------------------------------------
def test_agrega_solo_si_se_conoce_la_cuenta(con, falso):
    poner_terminacion(con)
    assert correo.procesar(con, aviso(), falso, HOY) == "agregado"
    p = fila(con)
    mov = dict(con.execute("SELECT * FROM movimiento WHERE id = ?", (p["movimiento_id"],)).fetchone())
    assert (mov["monto"], mov["tipo"], mov["origen"], mov["nota"], mov["cuenta_id"], mov["categoria_id"]) == \
           (2375, "gasto", "correo", "Super 99", "efectivo", "comida")
    assert (mov["fecha"], mov["hora"]) == ("2026-10-31", "18:42")


def test_sin_cuenta_conocida_queda_para_revisar(con, falso):
    assert correo.procesar(con, aviso(), falso, HOY) == "nuevo"
    p = fila(con)
    assert p["motivo"] == "No sé de qué cuenta es la tarjeta •••4821"
    assert (p["monto"], p["comercio"], p["categoria_id"], p["terminacion"]) == (2375, "Super 99", "comida", "4821")
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 0


def test_sin_terminacion_el_motivo_no_la_menciona(con):
    correo.procesar(con, aviso(), Falso(terminacion=""), HOY)
    assert fila(con)["motivo"] == "No sé de qué cuenta es"


def test_el_mismo_correo_dos_veces_no_se_duplica(con, falso):
    poner_terminacion(con)
    assert correo.procesar(con, aviso(), falso, HOY) == "agregado"
    assert correo.procesar(con, aviso(), falso, HOY) is None
    assert falso.llamadas == 1
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 1
    assert con.execute("SELECT COUNT(*) FROM pendiente").fetchone()[0] == 1


def test_duplicado_de_un_movimiento_ya_anotado(con, falso):
    poner_terminacion(con)
    marca = db.ahora()
    with con:
        con.execute("""INSERT INTO movimiento VALUES ('ya', 'gasto', 2375, '2026-10-30', NULL, 'efectivo', NULL, 'comida',
                       'a mano', NULL, 'manual', ?, ?)""", (marca, marca))
    assert correo.procesar(con, aviso(), falso, HOY) == "duplicado"
    assert fila(con)["movimiento_id"] == "ya"
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 1


def test_el_mismo_monto_tres_dias_antes_no_es_duplicado(con, falso):
    poner_terminacion(con)
    marca = db.ahora()
    with con:
        con.execute("""INSERT INTO movimiento VALUES ('viejo', 'gasto', 2375, '2026-10-28', NULL, 'efectivo', NULL, 'comida',
                       '', NULL, 'manual', ?, ?)""", (marca, marca))
    assert correo.procesar(con, aviso(), falso, HOY) == "agregado"


def test_lo_que_no_es_un_movimiento_se_ignora_y_no_se_vuelve_a_leer(con):
    promo = Falso(es_movimiento=False)
    assert correo.procesar(con, aviso("Promoción: 20% de descuento"), promo, HOY) == "ignorado"
    assert correo.procesar(con, aviso("Promoción: 20% de descuento"), promo, HOY) is None
    assert promo.llamadas == 1


def test_un_monto_que_no_aparece_en_el_aviso_no_entra(con):
    poner_terminacion(con)
    assert correo.procesar(con, aviso(), Falso(monto="99.99"), HOY) == "nuevo"
    assert fila(con)["motivo"] == "El monto no aparece tal cual en el aviso"
    assert con.execute("SELECT COUNT(*) FROM movimiento").fetchone()[0] == 0


def test_la_categoria_sale_de_la_memoria_antes_que_de_claude(con):
    poner_terminacion(con)
    marca = db.ahora()
    with con:
        con.execute("""INSERT INTO movimiento VALUES ('antes', 'gasto', 500, '2026-09-01', NULL, 'efectivo', NULL, 'salud',
                       'SUPER 99', NULL, 'manual', ?, ?)""", (marca, marca))
    assert correo.procesar(con, aviso(), Falso(categoria_id="comida", comercio="Super 99"), HOY) == "agregado"
    assert con.execute("SELECT categoria_id FROM movimiento WHERE origen = 'correo'").fetchone()[0] == "salud"


def test_categoria_de_otro_tipo_no_vale(con):
    poner_terminacion(con)
    assert correo.procesar(con, aviso(), Falso(categoria_id="sueldo"), HOY) == "nuevo"
    assert fila(con)["motivo"] == "No pude elegir la categoría"


def test_si_claude_falla_queda_para_revisar_a_mano(con, falso):
    falso.error = correo.ErrorDeCorreo("Claude tardó demasiado")
    assert correo.procesar(con, aviso(), falso, HOY) == "nuevo"
    p = fila(con)
    assert p["motivo"] == "No pude leer el aviso: Claude tardó demasiado"
    assert "4821" in p["texto"]


def test_ingreso(con):
    poner_terminacion(con)
    assert correo.procesar(con, aviso("Depósito de USD 23.75 en su cuenta 4821"),
                           Falso(tipo="ingreso", categoria_id="sueldo", comercio="Empresa"), HOY) == "agregado"
    assert con.execute("SELECT tipo, categoria_id FROM movimiento").fetchone()[:] == ("ingreso", "sueldo")


def test_lee_un_correo_html(con):
    crudo = (b"Message-ID: <h@x>\r\nFrom: banco@banco.example\r\nSubject: =?utf-8?q?Aviso?=\r\nDate: Sat, 31 Oct 2026 12:00:00 -0500\r\n"
             b"Content-Type: text/html; charset=utf-8\r\n\r\n<html><style>p{}</style><body><p>Compra por <b>USD&nbsp;23.75</b></p></body></html>")
    m = correo.leer_mensaje(crudo)
    assert (m["clave"], m["asunto"], m["fecha"]) == ("<h@x>", "Aviso", "2026-10-31")
    assert m["texto"] == "Compra por USD 23.75"


# --- API -------------------------------------------------------------------------------------------
@pytest.fixture
def api(config, reloj, falso):
    with TestClient(create_app(config, hoy=reloj, extractor=falso), headers={"Authorization": f"Bearer {config.token}"}) as c:
        yield c


def pendiente_nuevo(config, falso, clave="<a@x>", **cambios):
    """Procesa un aviso por su cuenta (sin la API) y devuelve su id; quedará `nuevo` si no se sabe la cuenta."""
    c = db.conectar(config.ruta_db)
    try:
        correo.procesar(c, aviso(clave=clave, **cambios), falso, HOY)
        return c.execute("SELECT id FROM pendiente WHERE clave = ?", (clave,)).fetchone()[0]
    finally:
        c.close()


def cuenta(api, id_="visa", **cambios):
    r = api.put(f"/api/cuentas/{id_}", json={"nombre": "Visa", **cambios})
    assert r.status_code == 200, r.text
    return r.json()


def test_cuenta_con_banco_y_terminacion(api):
    vinculo = {"banco": "bg", "cuenta": "bg-ahorros-regular", "tarjeta": "bg-visa-debito", "membresia": "anual",
               "seguro": "fraude-1000"}
    c = cuenta(api, banco=vinculo, terminacion="4821")
    assert (c["banco"], c["terminacion"]) == (vinculo, "4821")
    guardada = next(x for x in api.get("/api/datos").json()["cuentas"] if x["id"] == "visa")
    assert guardada["banco"] == vinculo
    # Sin banco, o quitándolo, vuelve a null.
    assert cuenta(api, "efectivo")["banco"] is None
    assert cuenta(api, banco=None, terminacion=None)["banco"] is None


@pytest.mark.parametrize("vinculo", [
    {"banco": "no-existe"},
    {"banco": "bg", "cuenta": "otro-banco-ahorros"},
    {"banco": "bg", "tarjeta": "tarjeta-falsa"},
    {"banco": "bg", "tarjeta": "bg-visa-debito", "seguro": "fraude-999999"},
    {"banco": "bg", "seguro": "fraude-1000"},  # un seguro sin tarjeta
    {"banco": "bg", "membresia": "semestral"},
])
def test_cuenta_con_banco_invalido_es_422(api, vinculo):
    assert api.put("/api/cuentas/x", json={"nombre": "X", "banco": vinculo}).status_code == 422


@pytest.mark.parametrize("terminacion", ["123", "12345", "abcd", "12 4"])
def test_terminacion_invalida_es_422(api, terminacion):
    assert api.put("/api/cuentas/x", json={"nombre": "X", "terminacion": terminacion}).status_code == 422


def test_el_mensaje_del_422_esta_en_espanol(api):
    r = api.put("/api/cuentas/x", json={"nombre": "X", "banco": {"banco": "no-existe"}})
    assert "no está en el catálogo" in r.text


def test_datos_trae_el_catalogo_y_los_pendientes(api, config, falso):
    d = api.get("/api/datos").json()
    assert d["pendientes"] == [] and d["catalogo"]["bancos"][0]["id"] == "bg"
    pendiente_nuevo(config, falso)
    d = api.get("/api/datos").json()
    assert len(d["pendientes"]) == 1
    p = d["pendientes"][0]
    assert set(p) == {"id", "origen", "recibido", "remitente", "asunto", "texto", "tipo", "monto", "fecha", "hora",
                      "comercio", "categoria_id", "cuenta_id", "terminacion", "motivo"}
    assert (p["monto"], p["comercio"], p["terminacion"]) == (2375, "Super 99", "4821")
    assert "catalogo" not in api.get("/api/exportar").json()


def anotar_a_mano(api, id_, cuenta_id, monto=2375):
    r = api.put(f"/api/movimientos/{id_}", json={"tipo": "gasto", "monto": monto, "fecha": "2026-10-31",
                                                  "cuenta_id": cuenta_id, "categoria_id": "comida", "nota": "Super 99"})
    assert r.status_code == 200


def test_aceptar_aprende_la_terminacion_y_agrega_los_otros(api, config, falso):
    cuenta(api)
    primero = pendiente_nuevo(config, falso, clave="<1@x>")
    pendiente_nuevo(config, Falso(monto="40.00", comercio="Otro"), clave="<2@x>", texto="Compra tarjeta 4821 por USD 40.00 en OTRO")
    anotar_a_mano(api, "m1", "visa")
    assert api.put(f"/api/pendientes/{primero}", json={"estado": "aceptado", "movimiento_id": "m1"}).status_code == 200
    d = api.get("/api/datos").json()
    assert next(c for c in d["cuentas"] if c["id"] == "visa")["terminacion"] == "4821"
    assert {m["id"]: m["origen"] for m in d["movimientos"]}["m1"] == "correo"
    # El segundo aviso esperaba por la misma tarjeta: al aprenderla entró solo.
    assert d["pendientes"] == []
    assert len(d["movimientos"]) == 2


def test_aceptar_es_idempotente(api, config, falso):
    cuenta(api)
    p = pendiente_nuevo(config, falso)
    anotar_a_mano(api, "m1", "visa")
    for _ in range(2):
        assert api.put(f"/api/pendientes/{p}", json={"estado": "aceptado", "movimiento_id": "m1"}).status_code == 200
    d = api.get("/api/datos").json()
    assert d["pendientes"] == [] and len(d["movimientos"]) == 1


def test_no_pisa_la_terminacion_que_ya_tiene_la_cuenta(api, config, falso):
    cuenta(api, terminacion="1111")
    p = pendiente_nuevo(config, falso)
    anotar_a_mano(api, "m1", "visa")
    api.put(f"/api/pendientes/{p}", json={"estado": "aceptado", "movimiento_id": "m1"})
    assert next(c for c in api.get("/api/datos").json()["cuentas"] if c["id"] == "visa")["terminacion"] == "1111"


def test_descartar(api, config, falso):
    p = pendiente_nuevo(config, falso)
    for _ in range(2):
        assert api.put(f"/api/pendientes/{p}", json={"estado": "descartado"}).status_code == 200
    d = api.get("/api/datos").json()
    assert d["pendientes"] == [] and d["movimientos"] == []


def test_pendiente_que_no_existe_es_404(api):
    assert api.put("/api/pendientes/nada", json={"estado": "descartado"}).status_code == 404


def test_aceptar_con_un_movimiento_que_no_existe_es_422(api, config, falso):
    p = pendiente_nuevo(config, falso)
    assert api.put(f"/api/pendientes/{p}", json={"estado": "aceptado", "movimiento_id": "fantasma"}).status_code == 422


def esperar(api, id_, estado):
    """La entrada se lee en un hilo aparte: se espera a que termine."""
    c = db.conectar(api.app.state.config.ruta_db)
    try:
        for _ in range(100):
            fila = c.execute("SELECT * FROM pendiente WHERE id = ?", (id_,)).fetchone()
            if fila["estado"] == estado and fila["motivo"] != correo.LEYENDO:
                return dict(fila)
            time.sleep(0.05)
    finally:
        c.close()
    raise AssertionError(f"el pendiente no llegó a {estado}")


def test_entrada_se_lee_con_el_extractor_inyectado(api, falso):
    r = api.post("/api/entrada", json={"texto": "SMS: compra tarjeta 4821 USD 23.75 en SUPER 99", "origen": "atajo"})
    assert r.status_code == 200 and r.json()["ok"]
    p = esperar(api, r.json()["id"], "nuevo")
    assert (p["origen"], p["monto"], p["motivo"]) == ("atajo", 2375, "No sé de qué cuenta es la tarjeta •••4821")
    assert falso.llamadas == 1
    assert [x["id"] for x in api.get("/api/datos").json()["pendientes"]] == [p["id"]]


def test_entrada_agrega_sola_si_la_cuenta_se_conoce(api):
    cuenta(api, terminacion="4821")
    r = api.post("/api/entrada", json={"texto": "compra tarjeta 4821 USD 23.75 en SUPER 99"})
    p = esperar(api, r.json()["id"], "agregado")
    assert p["cuenta_id"] == "visa"
    assert len(api.get("/api/datos").json()["movimientos"]) == 1


def test_entrada_vacia_es_422(api):
    assert api.post("/api/entrada", json={"texto": ""}).status_code == 422


def test_estado_del_correo_sin_configurar(api, config):
    assert api.get("/api/correo").json() == {"configurado": False, "ultima_revision": None, "error": None, "leidos": 0}
    correo.pedido.clear()
    assert api.post("/api/correo/revisar").json() == {"ok": True}
    assert correo.pedido.is_set()
    correo.pedido.clear()


def test_estado_del_correo_configurado(api, config):
    (config.carpeta / "correo.json").write_text('{"usuario": "yo@example.com", "clave_app": "abcd efgh ijkl mnop"}', encoding="utf-8")
    assert api.get("/api/correo").json()["configurado"] is True
    c = correo.leer_config(config.carpeta)
    assert (c["buscar"], c["cada_minutos"], c["modelo"], c["clave_app"]) == (correo.BUSCAR, 5, "haiku", "abcdefghijklmnop")


def test_la_pagina_de_estado_explica_como_activar_el_correo(anonimo):
    html = anonimo.get("/").text
    assert "Correo del banco" in html and "apppasswords" in html
