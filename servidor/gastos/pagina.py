"""La página de estado en / (sin entrar): para ver de un vistazo si el servidor está vivo.

Abierta desde la misma PC muestra además los QR para conectar: el de la web (iPad o cualquier
navegador de la tailnet) abre `http://<ip de tailscale>:<puerto>/app/conectar?d=...&t=<token>`, y el
de la app del iPhone abre `librogastos://conectar?d=<ip de tailscale>:<puerto>&t=<token>`. Como llevan
el token, a cualquier otro equipo (aunque sea de la tailnet) no se le muestran.
"""

import subprocess
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlencode

import segno

ESTILO = """
body{font-family:'IBM Plex Sans',system-ui,sans-serif;background:#0B0E13;color:#F5F6F7;margin:0;padding:24px}
.tarjeta{background:#171B22;border-radius:16px;padding:18px 20px;max-width:520px;margin:0 auto 14px}
h1{font-size:20px;margin:0 0 4px} p{margin:6px 0;color:rgba(245,246,247,.6);font-size:14px}
b{color:#F5F6F7;font-weight:600} .ok{color:#34D8A6} .mal{color:#F16565} a{color:#60A5FA}
.qr{background:#fff;border-radius:12px;padding:12px;display:inline-block;margin-top:8px}
"""

TAILSCALE = Path(r"C:\Program Files\Tailscale\tailscale.exe")


_ip_conocida: str | None = None


def ip_tailscale() -> str | None:
    """La IP de Tailscale de la PC. Se recuerda solo cuando se encontró: si Tailscale estaba caído,
    se vuelve a preguntar en el próximo pedido en vez de quedarse con el "no hay"."""
    global _ip_conocida
    if _ip_conocida or not TAILSCALE.exists():
        return _ip_conocida
    try:
        salida = subprocess.run([str(TAILSCALE), "ip", "-4"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    ip = next((p for p in salida.split() if p.startswith("100.")), None)
    _ip_conocida = ip
    return ip


def enlace_para_conectar(token: str, puerto: int) -> str | None:
    ip = ip_tailscale()
    return f"librogastos://conectar?{urlencode({'d': f'{ip}:{puerto}', 't': token})}" if ip else None


def enlace_para_la_web(token: str, puerto: int) -> str | None:
    ip = ip_tailscale()
    return f"http://{ip}:{puerto}/app/conectar?{urlencode({'d': f'{ip}:{puerto}', 't': token})}" if ip else None


PUERTO_METRO = 8082


def enlace_para_abrir() -> str | None:
    """Abre el build de desarrollo directo en Metro de la PC (esquema exp+<slug> de expo-dev-client)."""
    ip = ip_tailscale()
    return f"exp+libro-de-gastos://expo-development-client/?{urlencode({'url': f'http://{ip}:{PUERTO_METRO}'})}" if ip else None


def _qr(enlace: str) -> str:
    return f'<div class="qr">{segno.make(enlace, error="m").svg_inline(scale=5, dark="#0B0E13", light="#ffffff")}</div>'


def bloque_qr(token: str, puerto: int) -> str:
    web, conectar, abrir = enlace_para_la_web(token, puerto), enlace_para_conectar(token, puerto), enlace_para_abrir()
    if not web or not conectar or not abrir:
        return '<div class="tarjeta"><p class="mal">No encontré la IP de Tailscale de esta PC: revisa que Tailscale esté activo y recarga.</p></div>'
    return f"""<div class="tarjeta"><h1>En el navegador (iPad o iPhone)</h1>
<p>Con Tailscale prendido, apunta la cámara a este código y toca el aviso: se abre la app en Safari, ya
conectada. Para tenerla como app, en Safari toca Compartir → «Agregar a pantalla de inicio».</p>
{_qr(web)}
<p>O abre <b>http://{escape(ip_tailscale() or '')}:{puerto}/app</b> y escribe el token de <b>datos\\token.txt</b>.</p></div>
<div class="tarjeta"><h1>App del iPhone · 1 · Abrir la app</h1>
<p>Con Tailscale prendido en el iPhone, apunta la cámara a este código y toca el aviso. La app carga
su código desde esta PC (tarda unos segundos la primera vez).</p>
{_qr(abrir)}
<p>Si sale la pantalla de Expo, toca «Enter URL manually» y escribe <b>http://{escape(ip_tailscale() or '')}:{PUERTO_METRO}</b></p></div>
<div class="tarjeta"><h1>App del iPhone · 2 · Conectar con tus datos</h1>
<p>Cuando la app muestre «Conectar con la PC», vuelve a la cámara y escanea este:</p>
{_qr(conectar)}
<p>O a mano: dirección <b>{escape(ip_tailscale() or '')}:{puerto}</b> y el token de <b>datos\\token.txt</b>.</p></div>"""


def estado(config, conteos: dict, ultimo_respaldo: str | None, qr: str = "") -> str:
    hoy = date.today().isoformat()
    respaldo = (f'<span class="ok">{ultimo_respaldo}</span>' if ultimo_respaldo == hoy
                else f'<span class="mal">{ultimo_respaldo or "ninguno todavía"}</span>')
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60">
<title>Estado · Libro de Gastos</title><style>{ESTILO}</style></head><body>
<div class="tarjeta"><h1>Libro de Gastos <span class="ok">● activo</span></h1>
<p>Datos en <b>{escape(str(config.carpeta))}</b></p></div>
<div class="tarjeta">
<p><b>{conteos['cuenta']}</b> cuentas · <b>{conteos['movimiento']}</b> movimientos · <b>{conteos['recurrencia']}</b> recurrencias</p>
<p>Último respaldo: {respaldo}</p></div>
{qr}
</body></html>"""
