"""La app web: se sirve desde /web y entra con una cookie que sale del token.

La cookie es `httponly` y `SameSite=Strict`, y para escribir la web manda además `x-app-web: 1`
(ver `autorizado` en api.py), igual que en la app universitaria. La app compilada vive en
`web/dist` del repo; si no está compilada, /web lo dice en vez de dar un 404.
"""

import hashlib
import hmac
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from pydantic import BaseModel

COOKIE = "libro_gastos"
UN_ANIO = 365 * 24 * 3600
CARPETA = Path(__file__).resolve().parents[3] / "web" / "dist"

SIN_COMPILAR = """<!doctype html><meta charset="utf-8"><title>Libro de Gastos</title>
<body style="font-family:system-ui;background:#0B0E13;color:#F5F6F7;padding:24px">
<h2>La app web no está compilada</h2><p>En la PC: <code>cd web; npm install; npm run build</code></p></body>"""


def valor_cookie(token: str) -> str:
    return hmac.new(token.encode(), b"libro-gastos-web", hashlib.sha256).hexdigest()


def cookie_valida(valor: str | None, token: str) -> bool:
    return valor is not None and secrets.compare_digest(valor, valor_cookie(token))


def compilada() -> bool:
    return (CARPETA / "index.html").exists()


class Entrada(BaseModel):
    token: str


def registrar(app: FastAPI, config) -> None:
    @app.post("/web/entrar")
    def entrar(e: Entrada, response: Response):
        if not secrets.compare_digest(e.token.strip().encode(), config.token.encode()):
            raise HTTPException(401, "Ese no es el token de este servidor")
        response.set_cookie(COOKIE, valor_cookie(config.token), max_age=UN_ANIO, httponly=True,
                            samesite="strict", secure=False, path="/")
        return {"ok": True}

    @app.post("/web/salir")
    def salir(response: Response):
        response.delete_cookie(COOKIE, path="/")
        return {"ok": True}

    @app.get("/web")
    def sin_barra():
        return RedirectResponse("/web/")

    @app.get("/web/{ruta:path}")
    def archivo(ruta: str):
        indice = CARPETA / "index.html"
        if not indice.exists():
            return HTMLResponse(SIN_COMPILAR, status_code=503)
        pedido = (CARPETA / ruta).resolve()
        if ruta and pedido.is_file() and pedido.is_relative_to(CARPETA):
            # Lo de assets/ lleva un hash en el nombre: se puede guardar para siempre.
            cache = "public, max-age=31536000, immutable" if ruta.startswith("assets/") else "no-cache"
            return FileResponse(pedido, headers={"Cache-Control": cache})
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})
