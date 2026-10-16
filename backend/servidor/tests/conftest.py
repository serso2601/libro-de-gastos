from datetime import date

import pytest
from fastapi.testclient import TestClient

from servidor.api import create_app
from servidor.config import Config


class Reloj:
    """Un `hoy` que las pruebas pueden mover."""

    def __init__(self, dia: date):
        self.dia = dia

    def __call__(self) -> date:
        return self.dia


@pytest.fixture
def config(tmp_path):
    return Config.en(tmp_path / "datos")


@pytest.fixture
def reloj():
    return Reloj(date(2026, 10, 16))


@pytest.fixture
def cliente(config, reloj):
    app = create_app(config, hoy=reloj)
    with TestClient(app, headers={"Authorization": f"Bearer {config.token}"}) as c:
        yield c


@pytest.fixture
def anonimo(config, reloj):
    with TestClient(create_app(config, hoy=reloj)) as c:
        yield c
