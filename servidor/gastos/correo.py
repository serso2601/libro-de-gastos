"""Los avisos del banco: se leen del correo (o llegan de un Atajo del iPhone) y se vuelven movimientos.

Cómo va: `revisar` entra a Gmail por IMAP con una contraseña de aplicación, trae los avisos nuevos
(sin marcarlos leídos) y a cada uno le pasa `procesar`. Claude (`claude -p`, un modelo chico) lee el
texto y saca monto, comercio, fecha, tarjeta y categoría. Lo que Claude diga NO se acepta a ciegas:
el monto tiene que aparecer en el aviso, y el movimiento solo entra solo si se sabe de qué cuenta es
(por los últimos 4 dígitos de la tarjeta guardados en la cuenta). Si algo no cuadra, queda en la
bandeja `pendiente` con un motivo corto, para que el usuario lo revise en la app.

Toda lectura deja una fila en `pendiente` (aunque sea una promoción), y su `clave` (el Message-ID)
evita volver a leerla.

La configuración vive en `datos/correo.json` (git la ignora; sin ella no se revisa el correo):
    {"usuario": "...@gmail.com", "clave_app": "xxxx xxxx xxxx xxxx",
     "buscar": "from:(bgeneral.com) newer_than:3d", "cada_minutos": 5, "modelo": "haiku"}

Para probar la extracción sin guardar nada: `uv run python -m gastos.correo --probar aviso.txt`.
"""

import argparse
import email
import hashlib
import imaplib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import uuid
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


# --- Configuración ---------------------------------------------------------------------------------
def leer_config(carpeta: Path) -> dict | None:
    """`datos/correo.json` con valores por defecto, o None si no existe o le falta usuario/clave."""
    archivo = carpeta / "correo.json"
    if not archivo.exists():
        return None
    try:
        crudo = json.loads(archivo.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(crudo, dict) or not crudo.get("usuario") or not crudo.get("clave_app"):
        return None
    return {
        "usuario": str(crudo["usuario"]).strip(),
        "clave_app": str(crudo["clave_app"]).replace(" ", ""),
        "buscar": str(crudo.get("buscar") or BUSCAR),
        "cada_minutos": max(1, int(crudo.get("cada_minutos") or CADA_MINUTOS)),
        "modelo": str(crudo.get("modelo") or MODELO),
    }


def estado_actual(carpeta: Path) -> dict:
    return {**estado, "configurado": leer_config(carpeta) is not None}


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


def _carpeta_todos(imap: imaplib.IMAP4_SSL) -> str:
    """La carpeta «Todos» de Gmail (el nombre cambia con el idioma): la que lleva el flag \\All."""
    _, lista = imap.list()
    for linea in lista or []:
        texto = linea.decode("utf-8", errors="replace") if isinstance(linea, bytes) else str(linea)
        m = re.match(r'\((?P<flags>[^)]*)\)\s+"(?P<sep>[^"]*)"\s+(?P<nombre>.+)$', texto)
        if m and "\\All" in m["flags"]:
            return m["nombre"].strip().strip('"')
    return "INBOX"


def traer(config: dict, ya_leida: Callable[[str], bool]) -> list[dict]:
    """Los correos que cumplen `buscar` y que aún no se han leído (según `ya_leida(clave)`)."""
    imap = imaplib.IMAP4_SSL("imap.gmail.com", timeout=60)
    try:
        imap.login(config["usuario"], config["clave_app"])
        carpeta = _carpeta_todos(imap)
        tipo, _ = imap.select(f'"{carpeta}"', readonly=True)
        if tipo != "OK":
            raise ErrorDeCorreo("no pude abrir la carpeta de correo")
        busqueda = config["buscar"].replace("\\", "\\\\").replace('"', '\\"')
        tipo, datos = imap.uid("SEARCH", "X-GM-RAW", f'"{busqueda}"')
        if tipo != "OK":
            raise ErrorDeCorreo("la búsqueda en Gmail falló")
        mensajes = []
        for uid in (datos[0] or b"").split():
            # Primero solo el Message-ID: no se baja el correo entero si ya se leyó.
            _, cab = imap.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])")
            cabecera = cab[0][1].decode("utf-8", errors="replace") if cab and isinstance(cab[0], tuple) else ""
            m = re.search(r"Message-ID:\s*(\S+)", cabecera, re.I)
            if m and ya_leida(m.group(1)):
                continue
            _, cuerpo = imap.uid("FETCH", uid, "(BODY.PEEK[])")  # PEEK: no lo marca como leído
            if cuerpo and isinstance(cuerpo[0], tuple):
                mensajes.append(leer_mensaje(cuerpo[0][1]))
        return mensajes
    except imaplib.IMAP4.error as e:
        raise ErrorDeCorreo(f"Gmail rechazó la entrada o el pedido ({str(e)[:80]})")
    except OSError as e:
        raise ErrorDeCorreo(f"no pude conectar con Gmail ({e.__class__.__name__})")
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def revisar(config_datos: Path, ruta_db: Path, extraer: Extractor | None = None, hoy=date.today) -> int:
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
            mensajes = traer(config, ya_leida)
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
    ap = argparse.ArgumentParser(description="Prueba la extracción de un aviso con Claude, sin guardar nada")
    ap.add_argument("--probar", metavar="ARCHIVO.txt", required=True)
    _probar(ap.parse_args().probar)
