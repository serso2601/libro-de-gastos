"""La página de estado en / (sin entrar): para ver de un vistazo si el servidor está vivo.

Abierta desde la misma PC muestra además el QR para conectar el teléfono: la cámara del iPhone lo
lee y abre `librogastos://conectar?d=<ip de tailscale>:<puerto>&t=<token>` en la app. Como lleva el
token, a cualquier otro equipo (aunque sea de la tailnet) no se le muestra.
"""

import subprocess
from datetime import date
from functools import cache
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


@cache
def ip_tailscale() -> str | None:
    if not TAILSCALE.exists():
        return None
    try:
        salida = subprocess.run([str(TAILSCALE), "ip", "-4"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    return salida.split()[0] if salida.split() else None


def enlace_para_conectar(token: str, puerto: int) -> str | None:
    ip = ip_tailscale()
    return f"librogastos://conectar?{urlencode({'d': f'{ip}:{puerto}', 't': token})}" if ip else None


def bloque_qr(token: str, puerto: int) -> str:
    enlace = enlace_para_conectar(token, puerto)
    if not enlace:
        return '<div class="tarjeta"><p class="mal">No encontré la IP de Tailscale de esta PC: revisa que Tailscale esté activo.</p></div>'
    svg = segno.make(enlace, error="m").svg_inline(scale=6, dark="#0B0E13", light="#ffffff")
    return f"""<div class="tarjeta"><h1>Conectar el iPhone</h1>
<p>Abre la cámara del iPhone y apunta a este código: abre la app y se conecta sola.</p>
<div class="qr">{svg}</div>
<p>O a mano: dirección <b>{escape(ip_tailscale() or '')}:{puerto}</b> y el token de <b>token.txt</b>.</p></div>"""


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
