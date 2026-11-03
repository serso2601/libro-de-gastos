import io

from fastapi.testclient import TestClient
from PIL import Image

from gastos import imagenes
from gastos.api import CATALOGO, create_app
from gastos.config import Config

TOKEN = "token-de-prueba"


def tarjeta_con_borde(transparente: bool) -> bytes:
    """Una «tarjeta» azul de 300×190 en un lienzo de 400×270 con borde vacío (transparente o blanco)."""
    lienzo = Image.new("RGBA", (400, 270), (0, 0, 0, 0) if transparente else (255, 255, 255, 255))
    lienzo.paste(Image.new("RGBA", (300, 190), (20, 60, 160, 255)), (50, 40))
    salida = io.BytesIO()
    lienzo.save(salida, "PNG")
    return salida.getvalue()


def test_recortar_quita_el_borde_transparente_o_blanco():
    for transparente in (True, False):
        im = Image.open(io.BytesIO(imagenes.recortar(tarjeta_con_borde(transparente))))
        assert im.size == (300, 190)


def test_la_imagen_se_baja_una_vez_y_queda_guardada(tmp_path):
    pedidas = []

    def bajador(url):
        pedidas.append(url)
        return tarjeta_con_borde(True)

    cliente = TestClient(create_app(Config(tmp_path, TOKEN), web=tmp_path, bajador=bajador))
    id_ = "bg-credito-estrellas-platinum"
    for _ in range(2):  # sin token: la pide un <img>
        r = cliente.get(f"/tarjetas/{id_}.png")
        assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert len(pedidas) == 1 and pedidas[0].startswith("https://www.bgeneral.com/")
    assert (tmp_path / "tarjetas" / f"{id_}.png").is_file()


def test_sin_imagen_o_si_falla_el_banco_da_404(tmp_path):
    def falla(url):
        raise OSError("sin internet")

    cliente = TestClient(create_app(Config(tmp_path, TOKEN), web=tmp_path, bajador=falla))
    assert cliente.get("/tarjetas/bg-credito-classic.png").status_code == 404  # el banco no publica su imagen
    assert cliente.get("/tarjetas/no-existe.png").status_code == 404
    assert cliente.get("/tarjetas/bg-credito-estrellas-platinum.png").status_code == 404  # no se pudo bajar
    assert not (tmp_path / "tarjetas" / "bg-credito-estrellas-platinum.png").exists()


def test_las_imagenes_del_catalogo_son_de_la_pagina_del_banco():
    for banco in CATALOGO["bancos"]:
        for t in banco["tarjetas"]:
            if "imagen" in t:
                assert t["imagen"]["url"].startswith("https://www.bgeneral.com/wp-content/uploads/")
