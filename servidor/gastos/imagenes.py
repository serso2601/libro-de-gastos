"""Las imágenes de las tarjetas del catálogo (las que publica cada banco en su página).

No van en el repo (es público y las imágenes son del banco): el catálogo solo guarda de dónde salen
(`imagen.url` de cada tarjeta en `bancos.json`). La primera vez que la app pide una, el servidor la baja,
le quita el borde vacío (transparente o blanco) para que quede solo la tarjeta y la guarda en
`datos/tarjetas/<id>.png`. De ahí en adelante se sirve de ese archivo, aunque no haya internet.
"""

import io
import urllib.request
from collections.abc import Callable
from pathlib import Path

from PIL import Image, ImageChops

AGENTE = "Mozilla/5.0 (Libro de Gastos; uso personal)"
MAXIMO = 4 * 1024 * 1024  # una imagen de tarjeta pesa 20–100 KB: más que esto no es una tarjeta
ANCHO = 640  # suficiente para la pantalla del iPhone a 2× o 3×


def bajar(url: str) -> bytes:
    """Los bytes de la imagen; un error si no responde o no es una imagen."""
    pedido = urllib.request.Request(url.replace(" ", "%20"), headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(pedido, timeout=15) as r:
        if not r.headers.get("Content-Type", "").startswith("image/"):
            raise ValueError(f"{url} no es una imagen")
        datos = r.read(MAXIMO + 1)
    if len(datos) > MAXIMO:
        raise ValueError(f"{url} pesa demasiado")
    return datos


def recortar(datos: bytes) -> bytes:
    """La imagen sin el borde vacío alrededor de la tarjeta, como PNG de `ANCHO` px de ancho a lo más."""
    im = Image.open(io.BytesIO(datos))
    im.load()
    im = im.convert("RGBA")
    # Lo que no es transparente; si no hay transparencia, lo que no es casi blanco.
    caja = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if caja is None or caja == (0, 0, im.width, im.height):
        fondo = Image.new("RGB", im.size, (255, 255, 255))
        dif = ImageChops.difference(im.convert("RGB"), fondo).convert("L").point(lambda v: 255 if v > 18 else 0)
        caja = dif.getbbox() or (0, 0, im.width, im.height)
    im = im.crop(caja)
    if im.width > ANCHO:
        im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
    salida = io.BytesIO()
    im.save(salida, "PNG", optimize=True)
    return salida.getvalue()


def ruta_de(carpeta: Path, catalogo: dict, id_: str, bajador: Callable[[str], bytes] = bajar) -> Path | None:
    """El archivo de la imagen de la tarjeta `id_` (lo baja y recorta si aún no está); None si no tiene."""
    url = next((t.get("imagen", {}).get("url") for b in catalogo["bancos"] for t in b["tarjetas"] if t["id"] == id_), None)
    if not url:
        return None
    destino = carpeta / "tarjetas" / f"{id_}.png"
    if not destino.is_file():
        destino.parent.mkdir(parents=True, exist_ok=True)
        temporal = destino.with_suffix(".tmp")
        temporal.write_bytes(recortar(bajador(url)))
        temporal.replace(destino)
    return destino
