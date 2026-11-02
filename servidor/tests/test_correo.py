"""Los avisos del banco y las cuentas con banco. Nunca se usa Gmail ni Claude de verdad: el extractor y Google
son falsos y los avisos, inventados."""

import base64
import hashlib
import json
import threading
import time
import urllib.parse
import urllib.request
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
    poner_cliente(config.carpeta)
    assert api.get("/api/correo").json()["configurado"] is False  # falta el permiso
    poner_permiso(config.carpeta)
    assert api.get("/api/correo").json()["configurado"] is True
    c = correo.leer_config(config.carpeta)
    assert (c["buscar"], c["cada_minutos"], c["modelo"]) == (correo.BUSCAR, 5, "haiku")


def test_la_pagina_de_estado_explica_como_activar_el_correo(anonimo):
    html = anonimo.get("/").text
    assert "Correo del banco" in html and "gastos.correo --autorizar" in html and "gmail-cliente.json" in html
    assert "apppasswords" not in html


# --- Gmail por API (sin red) -----------------------------------------------------------------------
CLIENTE = {"installed": {"client_id": "id-falso.apps.example", "client_secret": "secreto-falso",
                         "auth_uri": "https://auth.example/o", "token_uri": "https://token.example/t",
                         "redirect_uris": ["http://localhost"]}}


def poner_cliente(carpeta, nombre="gmail-cliente.json"):
    (carpeta / nombre).write_text(json.dumps(CLIENTE), encoding="utf-8")


def poner_permiso(carpeta, **extra):
    (carpeta / "gmail-permiso.json").write_text(json.dumps({"refresh_token": "r-falso", **extra}), encoding="utf-8")


def en_base64url(crudo: bytes) -> str:
    return base64.urlsafe_b64encode(crudo).decode().rstrip("=")


CORREO_FALSO = (b"Message-ID: <real@x>\r\nFrom: avisos@banco.example\r\nSubject: Aviso\r\nDate: Sat, 31 Oct 2026 12:00:00 -0500\r\n"
                b"Content-Type: text/plain; charset=utf-8\r\n\r\nCompra con su tarjeta terminada en 4821 por USD 23.75 en SUPER 99")


class GoogleFalso:
    """Hace de `pedir_http`: responde según la URL y apunta qué se pidió."""

    def __init__(self, ids=("m1",), token_error=None):
        self.ids, self.token_error, self.pedidos = list(ids), token_error, []

    def __call__(self, url, datos=None, token=None):
        self.pedidos.append((url, datos, token))
        if url == CLIENTE["installed"]["token_uri"]:
            if self.token_error:
                raise self.token_error
            return {"access_token": "acceso-nuevo", "expires_in": 3600}
        if "/messages?" in url:
            return {"messages": [{"id": i} for i in self.ids]}
        if "/messages/" in url:
            return {"raw": en_base64url(CORREO_FALSO)}
        raise AssertionError(url)

    def bajados(self):
        return [u for u, _, _ in self.pedidos if "format=raw" in u]


def test_configurado_segun_los_archivos(tmp_path):
    assert correo.leer_config(tmp_path) is None
    poner_cliente(tmp_path)
    assert correo.leer_config(tmp_path) is None  # falta el permiso
    poner_permiso(tmp_path)
    assert correo.leer_config(tmp_path) == {"buscar": correo.BUSCAR, "cada_minutos": 5, "modelo": "haiku"}


def test_acepta_el_client_secret_de_google(tmp_path):
    poner_cliente(tmp_path, "client_secret_123-abc.apps.example.json")
    poner_permiso(tmp_path)
    assert correo.leer_config(tmp_path) is not None
    poner_cliente(tmp_path, "client_secret_otro.json")  # con dos ya no se sabe cuál
    assert correo.leer_config(tmp_path) is None
    poner_cliente(tmp_path)  # pero gmail-cliente.json manda
    assert correo.leer_config(tmp_path) is not None


def test_correo_json_solo_trae_ajustes(tmp_path):
    poner_cliente(tmp_path)
    poner_permiso(tmp_path)
    (tmp_path / "correo.json").write_text('{"buscar": "label:avisos", "cada_minutos": 10, "modelo": "sonnet"}', encoding="utf-8")
    assert correo.leer_config(tmp_path) == {"buscar": "label:avisos", "cada_minutos": 10, "modelo": "sonnet"}


def test_refresca_el_token_vencido_y_lo_guarda(tmp_path):
    poner_cliente(tmp_path)
    poner_permiso(tmp_path, access_token="viejo", vence=1000)
    google = GoogleFalso()
    assert correo.obtener_token(tmp_path, google, ahora=lambda: 5000) == "acceso-nuevo"
    _, datos, _ = google.pedidos[0]
    assert (datos["grant_type"], datos["refresh_token"]) == ("refresh_token", "r-falso")
    guardado = json.loads((tmp_path / "gmail-permiso.json").read_text(encoding="utf-8"))
    assert (guardado["access_token"], guardado["vence"], guardado["refresh_token"]) == ("acceso-nuevo", 8600, "r-falso")
    # Vigente: no vuelve a pedir.
    assert correo.obtener_token(tmp_path, google, ahora=lambda: 6000) == "acceso-nuevo"
    assert len(google.pedidos) == 1


def test_invalid_grant_dice_que_hay_que_autorizar_de_nuevo(tmp_path):
    poner_cliente(tmp_path)
    poner_permiso(tmp_path)
    google = GoogleFalso(token_error=correo.ErrorHttp(400, {"error": "invalid_grant"}))
    with pytest.raises(correo.ErrorDeCorreo, match="Google retiró el permiso: vuelve a autorizar"):
        correo.obtener_token(tmp_path, google)


def test_revisar_guarda_el_error_de_invalid_grant_en_el_estado(config, reloj):
    poner_cliente(config.carpeta)
    poner_permiso(config.carpeta)
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    c.close()
    google = GoogleFalso(token_error=correo.ErrorHttp(400, {"error": "invalid_grant"}))
    assert correo.revisar(config.carpeta, config.ruta_db, Falso(), http=google) == 0
    assert correo.estado["error"].startswith("Google retiró el permiso")
    correo.estado.update(error=None, ultima_revision=None, leidos=0)


def test_lista_baja_y_procesa_con_clave_gmail_sin_repetir(config, reloj):
    poner_cliente(config.carpeta)
    poner_permiso(config.carpeta, access_token="vigente", vence=time.time() + 3000)
    c = db.conectar(config.ruta_db)
    db.inicializar(c)
    poner_terminacion(c)
    c.close()
    google, falso = GoogleFalso(), Falso()
    assert correo.revisar(config.carpeta, config.ruta_db, falso, hoy=lambda: HOY, http=google) == 1
    assert len(google.bajados()) == 1 and google.pedidos[0][2] == "vigente"
    c = db.conectar(config.ruta_db)
    try:
        p = fila(c, "gmail:m1")
        assert (p["estado"], p["monto"], p["origen"]) == ("agregado", 2375, "correo")
    finally:
        c.close()
    # Segunda pasada: ya estaba leído, no se baja ni se vuelve a leer.
    assert correo.revisar(config.carpeta, config.ruta_db, falso, hoy=lambda: HOY, http=google) == 0
    assert len(google.bajados()) == 1 and falso.llamadas == 1
    correo.estado.update(error=None, ultima_revision=None, leidos=0)


def test_la_url_de_autorizacion_pide_solo_lectura_con_pkce():
    verificador = "v" * 50
    url = correo.url_autorizacion(CLIENTE["installed"], "http://127.0.0.1:5555", "estado-1", verificador)
    base, _, consulta = url.partition("?")
    q = {k: v[0] for k, v in urllib.parse.parse_qs(consulta).items()}
    assert base == "https://auth.example/o"
    assert q["scope"] == "https://www.googleapis.com/auth/gmail.readonly"
    assert (q["access_type"], q["prompt"], q["response_type"], q["state"]) == ("offline", "consent", "code", "estado-1")
    assert q["code_challenge_method"] == "S256"
    esperado = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b"=").decode()
    assert q["code_challenge"] == esperado
    assert q["redirect_uri"] == "http://127.0.0.1:5555"


def test_autorizar_sin_cliente_explica_donde_ponerlo(tmp_path):
    with pytest.raises(correo.ErrorDeCorreo, match="gmail-cliente.json"):
        correo.autorizar(tmp_path)


def test_autorizar_recibe_el_code_y_guarda_el_permiso(tmp_path):
    poner_cliente(tmp_path)
    google = GoogleFalso()

    def navegador(url):
        q = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(url).query).items()}
        redir = q["redirect_uri"] + "?" + urllib.parse.urlencode({"code": "codigo-falso", "state": q["state"]})
        threading.Thread(target=lambda: urllib.request.urlopen(redir).read(), daemon=True).start()

    def intercambio(url, datos=None, token=None):
        assert datos["code"] == "codigo-falso" and datos["code_verifier"] and datos["grant_type"] == "authorization_code"
        return {"access_token": "a", "refresh_token": "r-nuevo", "expires_in": 3600}

    correo.autorizar(tmp_path, http=intercambio, abrir=navegador, espera=10)
    assert json.loads((tmp_path / "gmail-permiso.json").read_text(encoding="utf-8"))["refresh_token"] == "r-nuevo"
    assert google.pedidos == []
