"""Los avisos del banco: se leen del correo (o llegan de un Atajo del iPhone) y se vuelven movimientos.

Cómo va: `revisar` lee Gmail con su API (OAuth, permiso de solo lectura), trae los avisos nuevos
(sin marcarlos leídos) y a cada uno le pasa `procesar`. Claude (`claude -p`, un modelo chico) lee el
texto y saca monto, comercio, fecha, tarjeta y categoría. Lo que Claude diga NO se acepta a ciegas:
el monto tiene que aparecer en el aviso, y el movimiento solo entra solo si se sabe de qué cuenta es
(por los últimos 4 dígitos de la tarjeta guardados en la cuenta). Si algo no cuadra, queda en la
bandeja `pendiente` con un motivo corto, para que el usuario lo revise en la app.

Toda lectura deja una fila en `pendiente` (aunque sea una promoción), y su `clave` (`gmail:<id>`)
evita volver a leerla.

Archivos en `datos/` (git los ignora; sin ellos no se revisa el correo):
- `gmail-cliente.json` (o `client_secret_*.json`): el «ID de cliente de OAuth» de tipo App de escritorio
  que se descarga de Google Cloud.
- `gmail-permiso.json`: lo crea `--autorizar` (el permiso de lectura). Nunca se imprime.
- `correo.json` (opcional, solo ajustes):
    {"buscar": "from:(bgeneral.com) newer_than:3d", "cada_minutos": 5, "modelo": "haiku"}

Autorizar (una sola vez): `uv run python -m gastos.correo --autorizar`.
Para probar la extracción sin guardar nada: `uv run python -m gastos.correo --probar aviso.txt`.
"""

import argparse
import email
import base64
import hashlib
import http.server as http_server
import json
import os
import secrets
import re
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from collections.abc import Callable
from datetime import date, datetime, timedelta
from email import policy
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

from . import db

BUSCAR = "from:(bgeneral.com) newer_than:3d"
CADA_MINUTOS = 5
MODELO = "haiku"
MAX_TEXTO_GUARDADO = 1500  # lo que se guarda del aviso en la bandeja
MAX_TEXTO_CLAUDE = 4000  # lo que se le manda a Claude
TIMEOUT_CLAUDE = 120  # segundos
DIAS_DUPLICADO = 2
LEYENDO = "Leyendo el aviso…"

# Lo que Claude debe devolver (la salida estructurada de `claude -p --json-schema`).
ESQUEMA_SALIDA = {
    "type": "object",
    "properties": {
        "es_movimiento": {"type": "boolean"},
        "tipo": {"type": "string", "enum": ["gasto", "ingreso"]},
        "monto": {"type": "string"},
        "fecha": {"type": "string"},
        "hora": {"type": "string"},
        "comercio": {"type": "string"},
        "categoria_id": {"type": "string"},
        "terminacion": {"type": "string"},
    },
    "required": ["es_movimiento"],
}

# Lo que Claude lee: sin herramientas, sin el CLAUDE.md del proyecto (corre en una carpeta vacía).
SISTEMA = (
    "Eres un extractor de datos. Lees avisos de un banco (compras, retiros, depósitos, transferencias) y "
    "devuelves solo los campos pedidos. No inventes nada: si un dato no aparece en el aviso, déjalo vacío."
)

Extractor = Callable[[dict, list[dict], list[dict]], dict]

# Estado para `GET /api/correo` y la página de estado.
estado = {"configurado": False, "ultima_revision": None, "error": None, "leidos": 0}
pedido = threading.Event()  # `POST /api/correo/revisar` lo activa: revisar ya, sin esperar el turno


class ErrorDeCorreo(Exception):
    """Algo falló al leer el correo o al extraer (mensaje corto, sin datos sensibles)."""


# --- Configuración y permiso de Google ------------------------------------------------------------
ALCANCE = "https://www.googleapis.com/auth/gmail.readonly"
URL_AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth"
URL_TOKEN = "https://oauth2.googleapis.com/token"
URL_GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
MAX_MENSAJES = 200  # tope de mensajes por pasada
ESPERA_AUTORIZAR = 300  # segundos
MENSAJE_RETIRADO = "Google retiró el permiso: vuelve a autorizar (uv run python -m gastos.correo --autorizar)"
Http = Callable[..., dict]


def archivo_cliente(carpeta: Path) -> Path | None:
    """`gmail-cliente.json`, o el único `client_secret_*.json` (el nombre con que Google lo descarga)."""
    directo = carpeta / "gmail-cliente.json"
    if directo.exists():
        return directo
    otros = sorted(carpeta.glob("client_secret_*.json"))
    return otros[0] if len(otros) == 1 else None


def leer_cliente(carpeta: Path) -> dict | None:
    archivo = archivo_cliente(carpeta)
    if archivo is None:
        return None
    try:
        crudo = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    datos = (crudo.get("installed") or crudo.get("web")) if isinstance(crudo, dict) else None
    if not isinstance(datos, dict) or not datos.get("client_id"):
        return None
    return {"client_id": datos["client_id"], "client_secret": datos.get("client_secret", ""),
            "auth_uri": datos.get("auth_uri") or URL_AUTORIZAR, "token_uri": datos.get("token_uri") or URL_TOKEN}


def leer_permiso(carpeta: Path) -> dict | None:
    try:
        crudo = json.loads((carpeta / "gmail-permiso.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return crudo if isinstance(crudo, dict) and crudo.get("refresh_token") else None


def guardar_permiso(carpeta: Path, permiso: dict) -> None:
    (carpeta / "gmail-permiso.json").write_text(json.dumps(permiso), encoding="utf-8")


def ajustes(carpeta: Path) -> dict:
    """`datos/correo.json` (opcional) con valores por defecto."""
    try:
        crudo = json.loads((carpeta / "correo.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        crudo = {}
    if not isinstance(crudo, dict):
        crudo = {}
    try:
        minutos = max(1, int(crudo.get("cada_minutos") or CADA_MINUTOS))
    except (TypeError, ValueError):
        minutos = CADA_MINUTOS
    return {"buscar": str(crudo.get("buscar") or BUSCAR), "cada_minutos": minutos,
            "modelo": str(crudo.get("modelo") or MODELO)}


def leer_config(carpeta: Path) -> dict | None:
    """Los ajustes, o None si falta el cliente de Google o el permiso (no se ha autorizado)."""
    if leer_cliente(carpeta) is None or leer_permiso(carpeta) is None:
        return None
    return ajustes(carpeta)


def estado_actual(carpeta: Path) -> dict:
    return {**estado, "configurado": leer_config(carpeta) is not None}


# --- HTTP y tokens ---------------------------------------------------------------------------------
class ErrorHttp(Exception):
    def __init__(self, codigo: int, cuerpo: dict | None = None):
        super().__init__(f"HTTP {codigo}")
        self.codigo, self.cuerpo = codigo, cuerpo or {}


def pedir_http(url: str, datos: dict | None = None, token: str | None = None) -> dict:
    """GET (o POST de formulario si hay `datos`) y la respuesta JSON. Falla con ErrorHttp u OSError."""
    cuerpo = urllib.parse.urlencode(datos).encode() if datos is not None else None
    req = urllib.request.Request(url, data=cuerpo)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detalle = json.loads(e.read().decode("utf-8"))
        except (ValueError, OSError):
            detalle = {}
        raise ErrorHttp(e.code, detalle if isinstance(detalle, dict) else {})


def _error_http(e: ErrorHttp) -> ErrorDeCorreo:
    if e.codigo in (401, 403):
        return ErrorDeCorreo("Gmail rechazó el permiso: vuelve a autorizar (uv run python -m gastos.correo --autorizar)")
    return ErrorDeCorreo(f"Gmail respondió con error {e.codigo}")


def obtener_token(carpeta: Path, http: Http = pedir_http, ahora: Callable[[], float] = time.time) -> str:
    """El access_token vigente; si venció o falta, pide uno nuevo con el refresh_token y lo guarda."""
    permiso, cliente = leer_permiso(carpeta), leer_cliente(carpeta)
    if permiso is None or cliente is None:
        raise ErrorDeCorreo("falta autorizar Gmail (uv run python -m gastos.correo --autorizar)")
    if permiso.get("access_token") and float(permiso.get("vence") or 0) > ahora() + 60:
        return permiso["access_token"]
    try:
        r = http(cliente["token_uri"], {"client_id": cliente["client_id"], "client_secret": cliente["client_secret"],
                                        "refresh_token": permiso["refresh_token"], "grant_type": "refresh_token"})
    except ErrorHttp as e:
        if e.cuerpo.get("error") == "invalid_grant":
            raise ErrorDeCorreo(MENSAJE_RETIRADO)
        raise _error_http(e)
    except OSError as e:
        raise ErrorDeCorreo(f"no pude conectar con Google ({e.__class__.__name__})")
    if not r.get("access_token"):
        raise ErrorDeCorreo("Google no entregó el permiso de acceso")
    guardar_permiso(carpeta, {**permiso, "access_token": r["access_token"],
                              "vence": ahora() + int(r.get("expires_in") or 3600)})
    return r["access_token"]


# --- Autorizar (una vez) ---------------------------------------------------------------------------
def _desafio(verificador: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b"=").decode()


def url_autorizacion(cliente: dict, redireccion: str, state: str, verificador: str) -> str:
    consulta = urllib.parse.urlencode({
        "client_id": cliente["client_id"], "redirect_uri": redireccion, "response_type": "code", "scope": ALCANCE,
        "access_type": "offline", "prompt": "consent", "state": state,
        "code_challenge": _desafio(verificador), "code_challenge_method": "S256"})
    return f"{cliente['auth_uri']}?{consulta}"


def autorizar(carpeta: Path, http: Http = pedir_http, abrir: Callable[[str], object] = webbrowser.open,
              espera: float = ESPERA_AUTORIZAR) -> None:
    """Flujo OAuth de app instalada (PKCE, redirección a 127.0.0.1) y guarda `gmail-permiso.json`."""
    cliente = leer_cliente(carpeta)
    if cliente is None:
        raise ErrorDeCorreo("Falta el archivo del cliente de Google: descárgalo de Google Cloud (ID de cliente de OAuth, "
                            f"App de escritorio) y guárdalo en {carpeta} como gmail-cliente.json")
    recibido: dict = {}

    class Manejador(http_server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()}
            if "code" in q or "error" in q:
                recibido.update(q)
            texto = ("Listo: el Libro de Gastos ya puede leer los avisos del banco. Puedes cerrar esta pestaña."
                     if "code" in q else "No se pudo autorizar. Puedes cerrar esta pestaña e intentarlo de nuevo.")
            cuerpo = ('<!doctype html><meta charset="utf-8"><title>Libro de Gastos</title>'
                      f'<p style="font:20px sans-serif">{texto}</p>').encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)

        def log_message(self, *args):
            pass

    servidor = http_server.HTTPServer(("127.0.0.1", 0), Manejador)
    redireccion = f"http://127.0.0.1:{servidor.server_port}"
    state, verificador = secrets.token_urlsafe(24), secrets.token_urlsafe(64)
    url = url_autorizacion(cliente, redireccion, state, verificador)
    print("Abriendo el navegador para que aceptes el permiso de solo lectura de Gmail…")
    print(f"Si no se abre, copia este enlace en el navegador:\n{url}")
    abrir(url)
    servidor.timeout = 1
    limite = time.time() + espera
    try:
        while not recibido and time.time() < limite:
            servidor.handle_request()
    finally:
        servidor.server_close()
    if not recibido:
        raise ErrorDeCorreo("se acabó el tiempo esperando la autorización")
    if recibido.get("state") != state:
        raise ErrorDeCorreo("la respuesta de Google no coincide con lo pedido (state); inténtalo de nuevo")
    if "code" not in recibido:
        raise ErrorDeCorreo(f"Google no dio el permiso ({recibido.get('error', 'sin detalle')})")
    try:
        r = http(cliente["token_uri"], {"client_id": cliente["client_id"], "client_secret": cliente["client_secret"],
                                        "code": recibido["code"], "code_verifier": verificador,
                                        "redirect_uri": redireccion, "grant_type": "authorization_code"})
    except ErrorHttp as e:
        raise ErrorDeCorreo(f"Google rechazó el código de autorización (error {e.codigo})")
    except OSError as e:
        raise ErrorDeCorreo(f"no pude conectar con Google ({e.__class__.__name__})")
    if not r.get("refresh_token"):
        raise ErrorDeCorreo("Google no entregó permiso de largo plazo; revoca el acceso en tu cuenta de Google e inténtalo de nuevo")
    guardar_permiso(carpeta, {"refresh_token": r["refresh_token"], "access_token": r.get("access_token", ""),
                              "vence": time.time() + int(r.get("expires_in") or 3600)})
    print("Listo: el permiso quedó guardado en gmail-permiso.json. Reinicia el servidor para que empiece a leer.")


# --- Montos ----------------------------------------------------------------------------------------
def a_centavos(texto: str) -> int | None:
    """«1,234.56», «23.75», «1.234,56», «B/. 5.00», «USD 23.75» → centavos. None si no hay número."""
    m = re.search(r"\d[\d.,]*", texto)
    if not m:
        return None
    return _numero_a_centavos(m.group(0).rstrip(".,"))


def _numero_a_centavos(n: str) -> int | None:
    seps = [i for i, ch in enumerate(n) if ch in ".,"]
    if not seps:
        return int(n) * 100
    ultimo = seps[-1]
    decimales = n[ultimo + 1:]
    # El último separador es el decimal si hay 1 o 2 dígitos después, o si es el único y no son 3;
    # «1,234» (tres dígitos) es mil doscientos treinta y cuatro.
    es_decimal = len(decimales) in (1, 2) or (len(decimales) != 3 and len(seps) == 1)
    if es_decimal:
        entera = re.sub(r"[.,]", "", n[:ultimo])
        return int(entera or "0") * 100 + int(decimales.ljust(2, "0")[:2])
    return int(re.sub(r"[.,]", "", n)) * 100


def montos_del_texto(texto: str) -> set[int]:
    """Todos los montos que aparecen en un texto, en centavos."""
    encontrados = set()
    for m in re.finditer(r"\d[\d.,]*", texto):
        c = _numero_a_centavos(m.group(0).rstrip(".,"))
        if c is not None:
            encontrados.add(c)
    return encontrados


# --- Extraer con Claude ----------------------------------------------------------------------------
def _prompt(aviso: dict, categorias: list[dict], cuentas: list[dict]) -> str:
    cats = "\n".join(f"- {c['id']} · {c['nombre']} · {c['tipo']}" for c in categorias)
    ctas = "\n".join(f"- {c['id']} · {c['nombre']} · terminación {c.get('terminacion') or 'sin guardar'}" for c in cuentas)
    return f"""Lee este aviso de un banco y extrae el movimiento.

AVISO (remitente: {aviso.get('remitente', '')}; asunto: {aviso.get('asunto', '')}; recibido: {aviso.get('fecha', '')})
\"\"\"
{(aviso.get('texto') or '')[:MAX_TEXTO_CLAUDE]}
\"\"\"

Categorías (id · nombre · tipo):
{cats}

Cuentas (id · nombre · terminación de su tarjeta):
{ctas}

Campos:
- es_movimiento: false si NO es un movimiento de dinero ya hecho (promociones, códigos de verificación, estados de cuenta, avisos de seguridad, recordatorios).
- tipo: "gasto" (compra, retiro, pago, cargo) o "ingreso" (depósito, transferencia recibida, abono).
- monto: el monto del movimiento como texto, tal como aparece en el aviso (p. ej. "23.75" o "1,234.56"), sin moneda.
- fecha: AAAA-MM-DD de la operación (la del aviso; si no la dice, la fecha en que se recibió).
- hora: HH:MM de la operación, o vacío si no aparece.
- comercio: nombre corto y legible del comercio, o de quien envía o recibe el dinero.
- categoria_id: UNA de las categorías de la lista, del tipo correcto.
- terminacion: los 4 últimos dígitos de la tarjeta o cuenta si aparecen, o vacío."""


def ejecutable_claude() -> str:
    """`claude` del PATH; si el servidor arrancó con el inicio de Windows sin él, el de ~/.local/bin."""
    if encontrado := shutil.which("claude"):
        return encontrado
    local = Path.home() / ".local" / "bin" / ("claude.exe" if os.name == "nt" else "claude")
    return str(local) if local.exists() else "claude"


def extraer_con_claude(aviso: dict, categorias: list[dict], cuentas: list[dict], modelo: str = MODELO) -> dict:
    """Corre `claude -p` sobre el aviso y devuelve los campos extraídos.

    Sin herramientas, sin sesión guardada, sin los ajustes ni el CLAUDE.md del proyecto (el subproceso
    corre en una carpeta vacía fuera de él): solo lee y responde. El prompt va por stdin.
    """
    carpeta = Path(tempfile.gettempdir()) / "libro-gastos-ia"
    carpeta.mkdir(exist_ok=True)
    cmd = [ejecutable_claude(), "-p", "--model", modelo, "--output-format", "json",
           "--json-schema", json.dumps(ESQUEMA_SALIDA), "--system-prompt", SISTEMA,
           "--tools", "", "--no-session-persistence", "--disable-slash-commands",
           "--strict-mcp-config", "--setting-sources", "user"]
    try:
        r = subprocess.run(cmd, input=_prompt(aviso, categorias, cuentas), capture_output=True, text=True,
                           encoding="utf-8", timeout=TIMEOUT_CLAUDE, cwd=carpeta,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired:
        raise ErrorDeCorreo("Claude tardó demasiado")
    except OSError as e:
        raise ErrorDeCorreo(f"no pude abrir claude ({e.__class__.__name__})")
    if r.returncode != 0:
        raise ErrorDeCorreo(f"claude terminó con error {r.returncode}: {(r.stderr or r.stdout).strip()[:200]}")
    try:
        salida = json.loads(r.stdout)
    except ValueError:
        raise ErrorDeCorreo("la respuesta de claude no es JSON")
    if salida.get("is_error"):
        raise ErrorDeCorreo(f"claude respondió con error: {str(salida.get('result'))[:200]}")
    datos = salida.get("structured_output")
    if not isinstance(datos, dict):  # por si una versión lo deja como texto en `result`
        try:
            datos = json.loads(salida.get("result") or "")
        except ValueError:
            raise ErrorDeCorreo("claude no devolvió los campos pedidos")
    if not isinstance(datos, dict) or "es_movimiento" not in datos:
        raise ErrorDeCorreo("claude no devolvió los campos pedidos")
    return datos


# --- Procesar un aviso -----------------------------------------------------------------------------
def _categorias_y_cuentas(con: sqlite3.Connection) -> tuple[list[dict], list[dict]]:
    cats = [dict(f) for f in con.execute("SELECT id, nombre, tipo FROM categoria ORDER BY tipo, orden")]
    ctas = [dict(f) for f in con.execute("SELECT id, nombre, terminacion FROM cuenta ORDER BY orden, creado")]
    return cats, ctas


def registrar(con: sqlite3.Connection, entrada: dict) -> str | None:
    """Deja el aviso en la bandeja, a la espera de leerlo. None si ya estaba (misma `clave`)."""
    clave = entrada.get("clave")
    if clave and con.execute("SELECT 1 FROM pendiente WHERE clave = ?", (clave,)).fetchone():
        return None
    id_, marca = str(uuid.uuid4()), db.ahora()
    # «ignorado» mientras se lee: así la app no ve una fila a medias; se corrige al terminar.
    with con:
        con.execute(
            """INSERT INTO pendiente (id, origen, clave, recibido, remitente, asunto, texto, estado, motivo, creado, actualizado)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'ignorado', ?, ?, ?)""",
            (id_, entrada.get("origen", "correo"), clave, marca, (entrada.get("remitente") or "")[:200],
             (entrada.get("asunto") or "")[:300], (entrada.get("texto") or "")[:MAX_TEXTO_GUARDADO], LEYENDO, marca, marca))
    return id_


def recuperar_interrumpidos(con: sqlite3.Connection) -> None:
    """Si el servidor se apagó leyendo un aviso, vuelve a la bandeja para revisarlo a mano."""
    with con:
        con.execute("UPDATE pendiente SET estado = 'nuevo', motivo = 'No pude leer el aviso: se interrumpió', actualizado = ? "
                    "WHERE estado = 'ignorado' AND motivo = ?", (db.ahora(), LEYENDO))


def _guardar(con: sqlite3.Connection, id_: str, **campos) -> None:
    campos["actualizado"] = db.ahora()
    with con:
        con.execute(f"UPDATE pendiente SET {', '.join(f'{k} = ?' for k in campos)} WHERE id = ?", [*campos.values(), id_])


def _fecha_valida(texto) -> str | None:
    try:
        return date.fromisoformat(str(texto).strip()[:10]).isoformat()
    except ValueError:
        return None


def _hora_valida(texto) -> str | None:
    texto = str(texto or "").strip()
    return texto if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", texto) else None


def _categoria_por_memoria(con: sqlite3.Connection, tipo: str, comercio: str) -> str | None:
    """La categoría del último movimiento del mismo tipo con ese comercio de nota (sin mayúsculas)."""
    if not comercio:
        return None
    for f in con.execute("SELECT nota, categoria_id FROM movimiento WHERE tipo = ? AND nota <> '' "
                         "AND categoria_id IS NOT NULL ORDER BY fecha DESC, creado DESC", (tipo,)):
        if f["nota"].casefold() == comercio.casefold():
            return f["categoria_id"]
    return None


def _duplicado(con: sqlite3.Connection, cuenta_id: str, tipo: str, monto: int, fecha: str) -> str | None:
    dia = date.fromisoformat(fecha)
    f = con.execute("SELECT id FROM movimiento WHERE cuenta_id = ? AND tipo = ? AND monto = ? AND fecha BETWEEN ? AND ?",
                    (cuenta_id, tipo, monto, (dia - timedelta(days=DIAS_DUPLICADO)).isoformat(),
                     (dia + timedelta(days=DIAS_DUPLICADO)).isoformat())).fetchone()
    return f["id"] if f else None


def _intentar_agregar(con: sqlite3.Connection, p: sqlite3.Row | dict) -> None:
    """Con los datos ya guardados en el pendiente: si se sabe la cuenta, lo anota solo (o lo marca duplicado)."""
    cuenta = con.execute("SELECT id FROM cuenta WHERE terminacion = ? ORDER BY orden, creado", (p["terminacion"],)).fetchone() \
        if p["terminacion"] else None
    if cuenta is None:
        motivo = (f"No sé de qué cuenta es la tarjeta •••{p['terminacion']}" if p["terminacion"] else "No sé de qué cuenta es")
        _guardar(con, p["id"], estado="nuevo", motivo=motivo)
        return
    if (mov := _duplicado(con, cuenta["id"], p["tipo"], p["monto"], p["fecha"])):
        _guardar(con, p["id"], estado="duplicado", cuenta_id=cuenta["id"], movimiento_id=mov, motivo="")
        return
    mov, marca = str(uuid.uuid4()), db.ahora()
    with con:
        con.execute(
            """INSERT INTO movimiento (id, tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota,
                 origen, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'correo', ?, ?)""",
            (mov, p["tipo"], p["monto"], p["fecha"], p["hora"], cuenta["id"], p["categoria_id"], p["comercio"][:200], marca, marca))
    _guardar(con, p["id"], estado="agregado", cuenta_id=cuenta["id"], movimiento_id=mov, motivo="")


def reintentar_por_terminacion(con: sqlite3.Connection, terminacion: str) -> int:
    """Tras aprender una terminación: agrega solos los pendientes que esperaban por no saber la cuenta."""
    filas = con.execute("SELECT * FROM pendiente WHERE estado = 'nuevo' AND terminacion = ? AND cuenta_id IS NULL "
                        "AND motivo LIKE 'No sé de qué cuenta%' AND tipo IS NOT NULL AND monto IS NOT NULL "
                        "AND categoria_id IS NOT NULL AND fecha IS NOT NULL", (terminacion,)).fetchall()
    for f in filas:
        _intentar_agregar(con, f)
    return len(filas)


def resolver(con: sqlite3.Connection, id_: str, entrada: dict, extraer: Extractor, hoy: date) -> str:
    """Lee un aviso ya registrado y decide su destino. Devuelve el estado final."""
    cats, ctas = _categorias_y_cuentas(con)
    fecha_aviso = _fecha_valida(entrada.get("fecha")) or hoy.isoformat()
    aviso = {"remitente": entrada.get("remitente", ""), "asunto": entrada.get("asunto", ""),
             "texto": entrada.get("texto", ""), "fecha": fecha_aviso}
    try:
        r = extraer(aviso, cats, ctas)
    except Exception as e:  # Claude caído, timeout, respuesta rara: se revisa a mano
        _guardar(con, id_, estado="nuevo", motivo=f"No pude leer el aviso: {e}"[:200])
        return "nuevo"
    if not r.get("es_movimiento"):
        _guardar(con, id_, estado="ignorado", motivo="")
        return "ignorado"

    tipo = r.get("tipo") if r.get("tipo") in ("gasto", "ingreso") else None
    comercio = str(r.get("comercio") or "").strip()[:200]
    terminacion = re.sub(r"\D", "", str(r.get("terminacion") or ""))[-4:] or None
    if terminacion and len(terminacion) < 4:
        terminacion = None
    monto = a_centavos(str(r.get("monto") or ""))
    base = dict(tipo=tipo, monto=monto, fecha=_fecha_valida(r.get("fecha")) or fecha_aviso, hora=_hora_valida(r.get("hora")),
                comercio=comercio, terminacion=terminacion)

    texto_completo = f"{entrada.get('asunto', '')}\n{entrada.get('texto', '')}"
    if tipo is None or not monto or monto not in montos_del_texto(texto_completo):
        _guardar(con, id_, estado="nuevo", motivo="El monto no aparece tal cual en el aviso", **base)
        return "nuevo"

    categoria = _categoria_por_memoria(con, tipo, comercio)
    if categoria is None:
        c = next((c for c in cats if c["id"] == r.get("categoria_id") and c["tipo"] == tipo), None)
        categoria = c["id"] if c else None
    if categoria is None:
        _guardar(con, id_, estado="nuevo", motivo="No pude elegir la categoría", **base)
        return "nuevo"

    base["categoria_id"] = categoria
    _guardar(con, id_, **base)
    _intentar_agregar(con, {**base, "id": id_})
    return con.execute("SELECT estado FROM pendiente WHERE id = ?", (id_,)).fetchone()["estado"]


def procesar(con: sqlite3.Connection, entrada: dict, extraer: Extractor, hoy: date) -> str | None:
    """Un aviso (remitente, asunto, texto, fecha, clave, origen) de principio a fin.

    Devuelve el estado en que quedó, o None si ya se había leído (misma `clave`).
    """
    id_ = registrar(con, entrada)
    return None if id_ is None else resolver(con, id_, entrada, extraer, hoy)


# --- Leer el correo --------------------------------------------------------------------------------
class _HtmlATexto(HTMLParser):
    def __init__(self):
        super().__init__()
        self.partes: list[str] = []
        self._callado = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._callado += 1
        elif tag in ("br", "p", "div", "tr", "li", "table"):
            self.partes.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._callado:
            self._callado -= 1

    def handle_data(self, data):
        if not self._callado:
            self.partes.append(data)


def html_a_texto(html: str) -> str:
    p = _HtmlATexto()
    p.feed(html)
    return limpiar("".join(p.partes))


def limpiar(texto: str) -> str:
    texto = texto.replace("\xa0", " ")
    texto = re.sub(r"[ \t]+", " ", texto)
    return re.sub(r"\n\s*\n+", "\n", texto).strip()


def leer_mensaje(crudo: bytes) -> dict:
    """Un correo en bruto → remitente, asunto, fecha (AAAA-MM-DD), texto y clave (Message-ID o hash)."""
    msg = email.message_from_bytes(crudo, policy=policy.default)
    cuerpo = msg.get_body(preferencelist=("plain",))
    texto = limpiar(cuerpo.get_content()) if cuerpo is not None else ""
    if not texto:
        html = msg.get_body(preferencelist=("html",))
        texto = html_a_texto(html.get_content()) if html is not None else ""
    try:
        fecha = parsedate_to_datetime(msg["Date"]).astimezone().date().isoformat()
    except (TypeError, ValueError):
        fecha = None
    clave = (msg["Message-ID"] or "").strip() or "hash:" + hashlib.sha256(crudo).hexdigest()
    return {"remitente": str(msg["From"] or ""), "asunto": str(msg["Subject"] or ""), "fecha": fecha, "texto": texto,
            "clave": clave, "origen": "correo"}


def traer(carpeta: Path, config: dict, ya_leida: Callable[[str], bool], http: Http = pedir_http,
          ahora: Callable[[], float] = time.time) -> list[dict]:
    """Los correos que cumplen `buscar` y que aún no se han leído (según `ya_leida(clave)`)."""
    token = obtener_token(carpeta, http, ahora)
    try:
        ids: list[str] = []
        pagina = None
        while len(ids) < MAX_MENSAJES:
            consulta = {"q": config["buscar"], "maxResults": 50, **({"pageToken": pagina} if pagina else {})}
            r = http(f"{URL_GMAIL}/messages?{urllib.parse.urlencode(consulta)}", None, token)
            ids += [m["id"] for m in r.get("messages") or []]
            pagina = r.get("nextPageToken")
            if not pagina:
                break
        mensajes = []
        for id_ in ids[:MAX_MENSAJES]:
            clave = f"gmail:{id_}"
            if ya_leida(clave):  # no se baja el correo si ya se leyó
                continue
            r = http(f"{URL_GMAIL}/messages/{urllib.parse.quote(id_)}?format=raw", None, token)
            raw = str(r.get("raw") or "")
            crudo = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
            mensajes.append({**leer_mensaje(crudo), "clave": clave})
        return mensajes
    except ErrorHttp as e:
        raise _error_http(e)
    except OSError as e:
        raise ErrorDeCorreo(f"no pude conectar con Gmail ({e.__class__.__name__})")
    except ValueError:
        raise ErrorDeCorreo("Gmail devolvió una respuesta que no entiendo")


def revisar(config_datos: Path, ruta_db: Path, extraer: Extractor | None = None, hoy=date.today,
            http: Http = pedir_http) -> int:
    """Una pasada: trae los avisos nuevos y los procesa. Devuelve cuántos avisos nuevos leyó."""
    config = leer_config(config_datos)
    if config is None:
        return 0
    extraer = extraer or (lambda a, c, k: extraer_con_claude(a, c, k, config["modelo"]))
    con = db.conectar(ruta_db)
    try:
        leidos = 0
        def ya_leida(clave: str) -> bool:
            return con.execute("SELECT 1 FROM pendiente WHERE clave = ?", (clave,)).fetchone() is not None
        try:
            mensajes = traer(config_datos, config, ya_leida, http)
            for aviso in mensajes:
                if procesar(con, aviso, extraer, hoy()) is not None:
                    leidos += 1
            estado.update(error=None, ultima_revision=db.ahora())
        except ErrorDeCorreo as e:
            estado.update(error=str(e), ultima_revision=db.ahora())
        estado["leidos"] += leidos
        return leidos
    finally:
        con.close()


def hilo_de_revision(carpeta: Path, ruta_db: Path, parar: threading.Event) -> None:
    """Revisa el correo cada `cada_minutos`, o antes si llega `pedido`. Sin configuración no hace nada útil."""
    con = db.conectar(ruta_db)
    try:
        recuperar_interrumpidos(con)
    finally:
        con.close()
    while not parar.is_set():
        config = leer_config(carpeta)
        estado["configurado"] = config is not None
        espera = (config["cada_minutos"] if config else CADA_MINUTOS) * 60
        if config:
            try:
                n = revisar(carpeta, ruta_db)
                if n:
                    print(f"Correo: {n} avisos nuevos", flush=True)
            except Exception as e:  # que un error no mate el hilo
                estado["error"] = f"falló la revisión ({e.__class__.__name__})"
        pedido.wait(espera)
        pedido.clear()


# --- Probar la extracción --------------------------------------------------------------------------
def _probar(archivo: str) -> None:
    texto = Path(archivo).read_text(encoding="utf-8")
    cats = [{"id": i, "nombre": n, "tipo": t} for i, n, t, _ in db.CATEGORIAS_INICIALES]
    ctas = [{"id": "visa-debito", "nombre": "Visa Débito", "terminacion": "4821"}, {"id": "efectivo", "nombre": "Efectivo", "terminacion": None}]
    aviso = {"remitente": "avisos@banco.example", "asunto": "Aviso de transacción", "texto": texto, "fecha": date.today().isoformat()}
    r = extraer_con_claude(aviso, cats, ctas)
    print(json.dumps(r, ensure_ascii=False, indent=2))
    monto = a_centavos(str(r.get("monto") or ""))
    print(f"monto en centavos: {monto} · aparece en el texto: {monto in montos_del_texto(texto)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Gmail del Libro de Gastos: dar el permiso de lectura o probar la extracción")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--probar", metavar="ARCHIVO.txt", help="prueba la extracción de un aviso con Claude, sin guardar nada")
    g.add_argument("--autorizar", action="store_true", help="da el permiso de solo lectura de Gmail (una sola vez)")
    args = ap.parse_args()
    if args.autorizar:
        from .config import Config
        try:
            autorizar(Config.desde_entorno().carpeta)
        except ErrorDeCorreo as e:
            raise SystemExit(f"Error: {e}")
    else:
        _probar(args.probar)
