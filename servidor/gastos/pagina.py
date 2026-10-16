"""La página de estado en / (sin entrar): para ver de un vistazo si el servidor está vivo."""

from datetime import date
from html import escape

ESTILO = """
body{font-family:'IBM Plex Sans',system-ui,sans-serif;background:#0B0E13;color:#F5F6F7;margin:0;padding:24px}
.tarjeta{background:#171B22;border-radius:16px;padding:18px 20px;max-width:520px;margin:0 auto 14px}
h1{font-size:20px;margin:0 0 4px} p{margin:6px 0;color:rgba(245,246,247,.6);font-size:14px}
b{color:#F5F6F7;font-weight:600} .ok{color:#34D8A6} .mal{color:#F16565} a{color:#60A5FA}
"""


def estado(config, conteos: dict, ultimo_respaldo: str | None, web_compilada: bool) -> str:
    hoy = date.today().isoformat()
    respaldo = (f'<span class="ok">{ultimo_respaldo}</span>' if ultimo_respaldo == hoy
                else f'<span class="mal">{ultimo_respaldo or "ninguno todavía"}</span>')
    web = ('<a href="/web/">Abrir la app web</a>' if web_compilada
           else '<span class="mal">sin compilar (cd web; npm run build)</span>')
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30">
<title>Estado · Libro de Gastos</title><style>{ESTILO}</style></head><body>
<div class="tarjeta"><h1>Libro de Gastos <span class="ok">● activo</span></h1>
<p>Datos en <b>{escape(str(config.carpeta))}</b></p></div>
<div class="tarjeta">
<p><b>{conteos['cuenta']}</b> cuentas · <b>{conteos['movimiento']}</b> movimientos · <b>{conteos['recurrencia']}</b> recurrencias</p>
<p>Último respaldo: {respaldo}</p>
<p>App web: {web}</p></div>
</body></html>"""
