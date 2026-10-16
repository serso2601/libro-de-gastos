"""Dónde viven los datos y con qué se entra.

Los datos van en la carpeta `datos/` del proyecto (o en `LIBRO_GASTOS_DATOS`), que git ignora: la
base `gastos.db`, el `token.txt` con el que entra la app, los `respaldos/` diarios y los `registros/`.
El token se genera la primera vez y no cambia; la app lo pide una sola vez y lo recuerda.
"""

import os
import secrets
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    carpeta: Path
    token: str

    @classmethod
    def desde_entorno(cls) -> "Config":
        carpeta = Path(os.environ.get("LIBRO_GASTOS_DATOS") or Path(__file__).resolve().parents[2] / "datos")
        return cls.en(carpeta)

    @classmethod
    def en(cls, carpeta: Path) -> "Config":
        carpeta.mkdir(parents=True, exist_ok=True)
        for sub in ("respaldos", "registros"):
            (carpeta / sub).mkdir(exist_ok=True)
        archivo = carpeta / "token.txt"
        if not archivo.exists():
            archivo.write_text(secrets.token_urlsafe(24), encoding="utf-8")
        return cls(carpeta=carpeta, token=archivo.read_text(encoding="utf-8").strip())

    @property
    def ruta_db(self) -> Path:
        return self.carpeta / "gastos.db"

    @property
    def respaldos(self) -> Path:
        return self.carpeta / "respaldos"
