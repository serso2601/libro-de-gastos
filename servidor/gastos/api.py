"""La API del Libro de Gastos.

Todo lo de datos va bajo /api y pide entrar (ver `autorizado`). Los ids los pone el cliente
(UUID) y las escrituras son PUT idempotentes: si el teléfono reintenta un pedido que ya había
llegado, no se duplica nada. Así la app puede guardar sin conexión y mandar todo después.

Montos en centavos (enteros) y fechas ISO, igual que en la base.

La app web (el export de Expo en `app/dist`) se sirve en /app sin pedir entrar: es solo el código;
los datos los pide después a /api con el token, igual que la del iPhone.

Quién puede hablarle: solo esta PC y los equipos de la tailnet (ver `RED_PERMITIDA`). El servidor
escucha en todas las interfaces para que el teléfono llegue por Tailscale, pero un pedido que
viene de la red de la casa o de cualquier otro lado se rechaza antes de mirar el token.
"""

import ipaddress
import json
import mimetypes
import secrets
import sqlite3
import threading
from collections.abc import Iterator
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from . import avisos, correo, db, imagenes, importar, pagina, recurrencias
from .config import Config

SIN_ENTRADA = "Falta el token o no es el de este servidor"
WEB = Path(__file__).resolve().parents[2] / "app" / "dist"  # `npx expo export --platform web` en app/
# Python en Windows no conoce la letra de la app (.ttf) y la mandaba como application/octet-stream.
mimetypes.add_type("font/ttf", ".ttf")

# El catálogo de bancos (tarifas por producto y versión); se lee una vez y viaja tal cual en /api/datos.
CATALOGO = json.loads(Path(__file__).with_name("bancos.json").read_text(encoding="utf-8"))

# Loopback y los rangos que Tailscale usa para sus equipos (IPv4 100.64.0.0/10, IPv6 fd7a:115c:a1e0::/48).
RED_PERMITIDA = [ipaddress.ip_network(r) for r in ("127.0.0.0/8", "::1/128", "100.64.0.0/10", "fd7a:115c:a1e0::/48")]


def desde_red_permitida(host: str | None) -> bool:
    if host == "testclient":  # el cliente de las pruebas no tiene IP
        return True
    if host is None:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return any(ip in red for red in RED_PERMITIDA)

TipoMovimiento = Literal["gasto", "ingreso", "transferencia"]
Hora = Field(default=None, pattern=r"^\d{2}:\d{2}$")
Color = Field(default="#3DA5F5", pattern=r"^#[0-9A-Fa-f]{6}$")


class VinculoBanco(BaseModel):
    """A qué producto del catálogo corresponde la cuenta (ver `bancos.json`)."""

    banco: str
    cuenta: str | None = None
    tarjeta: str | None = None
    membresia: Literal["mensual", "anual"] = "mensual"
    seguro: str | None = None

    @model_validator(mode="after")
    def _contra_el_catalogo(self):
        banco = next((b for b in CATALOGO["bancos"] if b["id"] == self.banco), None)
        if banco is None:
            raise ValueError(f"El banco «{self.banco}» no está en el catálogo")
        if self.cuenta is not None and self.cuenta not in {c["id"] for c in banco["cuentas"]}:
            raise ValueError(f"La cuenta «{self.cuenta}» no es de {banco['nombre']}")
        tarjeta = None
        if self.tarjeta is not None:
            tarjeta = next((t for t in banco["tarjetas"] if t["id"] == self.tarjeta), None)
            if tarjeta is None:
                raise ValueError(f"La tarjeta «{self.tarjeta}» no es de {banco['nombre']}")
        if self.seguro is not None:
            seguros = {s["id"] for v in (tarjeta or {}).get("versiones", []) for s in v.get("seguros", [])}
            if self.seguro not in seguros:
                raise ValueError(f"El seguro «{self.seguro}» no es de esa tarjeta")
        return self


class MinimoPropio(BaseModel):
    porcentaje: float = Field(gt=0, le=100)  # % del saldo al corte
    minimo: int = Field(default=0, ge=0)  # centavos; nunca menos de esto


class SobregiroPropio(BaseModel):
    permitido: float | None = Field(default=None, ge=0, le=100)  # % sobre el límite que se puede pasar sin cargo
    cargo: int = Field(default=0, ge=0)  # centavos; lo que cobra al corte si te pasas de ahí


class ReglasPropias(BaseModel):
    """Las reglas de una tarjeta de crédito de un banco que no está en el catálogo: las pone el usuario.

    Tienen la misma forma que una versión de tarjeta de `bancos.json`, así el mínimo, el sobregiro y la fecha de
    pago se calculan igual. `banco` y `tarjeta` son solo nombres para mostrar.
    """

    banco: str | None = Field(default=None, max_length=40)
    tarjeta: str | None = Field(default=None, max_length=40)
    pago_minimo: MinimoPropio | None = None
    tasa_anual: float | None = Field(default=None, ge=0, le=200)
    pago_atrasado: int | None = Field(default=None, ge=0)
    sobregiro: SobregiroPropio | None = None
    dias_para_pagar: int | None = Field(default=None, ge=1, le=60)


class CuentaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    color: str = Color
    saldo_inicial: int = 0
    es_credito: bool = False
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    dia_pago: int | None = Field(default=None, ge=1, le=31)
    pago_minimo: int | None = Field(default=None, ge=0)  # centavos; lo copia el usuario si su tarjeta no está en el catálogo
    limite: int | None = Field(default=None, gt=0)  # centavos; el límite de crédito de la tarjeta
    minimo_corte: date | None = None  # el corte para el que el usuario corrigió el mínimo (con reglas del banco)
    corte_inicial: date | None = None  # tarjeta: el corte al que se refieren los dos montos siguientes
    deuda_al_corte: int | None = Field(default=None, ge=0)  # centavos; el saldo del estado de cuenta de ese corte
    pagos_tras_corte: int | None = Field(default=None, ge=0)  # centavos; lo pagado después de ese corte y antes de crear la tarjeta
    banco: VinculoBanco | None = None  # vínculo con el catálogo, para calcular intereses y cargos
    terminacion: str | None = Field(default=None, pattern=r"^\d{4}$")  # últimos 4 dígitos de su tarjeta
    reglas: ReglasPropias | None = None  # banco que no está en el catálogo: su nombre y, si es tarjeta, sus reglas

    @model_validator(mode="after")
    def _credito(self):
        if self.es_credito and self.dia_corte is None:
            raise ValueError("Una tarjeta de crédito necesita su día de corte")
        if not self.es_credito:
            self.dia_corte = self.dia_pago = self.pago_minimo = self.limite = self.minimo_corte = None
            self.corte_inicial = self.deuda_al_corte = self.pagos_tras_corte = None
            if self.reglas:  # de un banco fuera del catálogo, una cuenta normal solo guarda el nombre
                self.reglas = ReglasPropias(banco=self.reglas.banco)
        if self.banco is not None and self.banco.tarjeta is not None:  # con tarjeta del catálogo, las reglas son las suyas
            self.reglas = None
        if self.reglas and not any(v not in (None, "") for v in self.reglas.model_dump().values()):
            self.reglas = None
        return self


class CorteIn(BaseModel):
    minimo: int = Field(ge=0)
    dias: int | None = Field(default=None, ge=0)


class CategoriaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    tipo: Literal["gasto", "ingreso"]
    color: str = Color
    emoji: str = Field(default="💰", min_length=1, max_length=32)  # un emoji o «i:<símbolo>» (i:electrodomestico)
    presupuesto: int | None = Field(default=None, ge=0)
    acumula: bool = False  # pasa lo que sobra del periodo al siguiente
    acumula_desde: date | None = None  # inicio del periodo desde el que se acumula; sin acumular, se descarta

    @model_validator(mode="after")
    def _acumula(self):
        if not self.acumula:
            self.acumula_desde = None
        return self


class MovimientoIn(BaseModel):
    tipo: TipoMovimiento
    monto: int = Field(gt=0)
    fecha: date
    hora: str | None = Hora
    cuenta_id: str
    cuenta_destino_id: str | None = None
    categoria_id: str | None = None
    nota: str = Field(default="", max_length=200)


class RecurrenciaIn(BaseModel):
    tipo: TipoMovimiento
    monto: int = Field(gt=0)
    cuenta_id: str
    cuenta_destino_id: str | None = None
    categoria_id: str | None = None
    nota: str = Field(default="", max_length=200)
    frecuencia: Literal["semanal", "catorcenal", "quincenal", "mensual", "anual"]
    fecha_inicio: date
    fecha_fin: date | None = None


class PendienteIn(BaseModel):
    estado: Literal["aceptado", "descartado"]
    movimiento_id: str | None = None  # el movimiento que la app creó al aceptar


class EntradaIn(BaseModel):
    """Un aviso: o su `texto` (lo lee Claude), o los campos sueltos de Apple Pay (`monto` y `comercio`)."""

    texto: str | None = Field(default=None, min_length=1, max_length=20000)
    origen: Literal["atajo", "correo", "wallet"] = "atajo"
    monto: str | None = Field(default=None, max_length=30)  # «$12.50», tal como lo da el Atajo (un número también vale)
    comercio: str | None = Field(default=None, max_length=200)  # puede venir vacío: hay terminales sin nombre
    terminacion: str | None = Field(default=None, max_length=30)  # los 4 dígitos de la tarjeta (se toman los últimos 4)

    @field_validator("monto", mode="before")
    @classmethod
    def _monto_como_texto(cls, v):
        return str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v

    @model_validator(mode="after")
    def _algo_que_leer(self):
        # Un pago de Apple Pay nunca se rechaza: si algo no se entiende, queda en «Por revisar» (un 422 el iPhone
        # no lo muestra y el pago se perdería sin aviso).
        if self.texto is None and self.monto is None:
            raise ValueError("Falta el texto del aviso, o el monto y el comercio")
        return self


class OrdenIn(BaseModel):
    ids: list[str]


class AjustesIn(BaseModel):
    """Solo se guarda lo que llega: `{"moneda": "$"}` no toca el periodo del presupuesto."""

    moneda: str | None = Field(default=None, min_length=1, max_length=4)
    presupuesto_periodo: Literal["semanal", "catorcenal", "quincenal", "mensual"] | None = None
    presupuesto_inicio: str | None = Field(default=None, max_length=10)
    cuenta_yappy: str | None = Field(default=None, max_length=100)  # id de la cuenta; "" la quita
    yappy_categoria_gasto: str | None = Field(default=None, max_length=100)  # id de categoría; "" = automática
    yappy_categoria_ingreso: str | None = Field(default=None, max_length=100)


def _existe(con: sqlite3.Connection, tabla: str, id_: str | None) -> bool:
    return id_ is not None and con.execute(f"SELECT 1 FROM {tabla} WHERE id = ?", (id_,)).fetchone() is not None


def _validar(con: sqlite3.Connection, m: MovimientoIn | RecurrenciaIn) -> None:
    """Las mismas reglas para un movimiento y para una recurrencia."""
    if not _existe(con, "cuenta", m.cuenta_id):
        raise HTTPException(422, "La cuenta no existe")
    if m.tipo == "transferencia":
        if not _existe(con, "cuenta", m.cuenta_destino_id):
            raise HTTPException(422, "Falta la cuenta de destino")
        if m.cuenta_destino_id == m.cuenta_id:
            raise HTTPException(422, "La transferencia necesita dos cuentas distintas")
        m.categoria_id = None
        return
    m.cuenta_destino_id = None
    fila = con.execute("SELECT tipo FROM categoria WHERE id = ?", (m.categoria_id,)).fetchone() if m.categoria_id else None
    if fila is None:
        raise HTTPException(422, "Falta la categoría")
    if fila["tipo"] != m.tipo:
        raise HTTPException(422, f"Esa categoría es de {fila['tipo']}s, no de {m.tipo}s")


def _cuenta(fila: sqlite3.Row | dict) -> dict:
    """Una cuenta como la ve la API: `es_credito` sale como booleano y `banco` como objeto (o null)."""
    return {**dict(fila), "es_credito": bool(fila["es_credito"]), "banco": json.loads(fila["banco"]) if fila["banco"] else None,
            "reglas": json.loads(fila["reglas"]) if fila["reglas"] else None}


def _categoria(fila: sqlite3.Row | dict) -> dict:
    """Una categoría como la ve la API: `acumula` sale como booleano, no como 0/1."""
    return {**dict(fila), "acumula": bool(fila["acumula"])}


def _presupuesto(con: sqlite3.Connection) -> dict:
    """El periodo del presupuesto; sin nada guardado, mensual desde el día 1."""
    ajustes = {f["clave"]: f["valor"] for f in con.execute(
        "SELECT clave, valor FROM ajuste WHERE clave IN ('presupuesto_periodo', 'presupuesto_inicio')")}
    return {"periodo": ajustes.get("presupuesto_periodo", "mensual"), "inicio": ajustes.get("presupuesto_inicio", "1")}


def _inicio_valido(periodo: str, inicio: str | None) -> str:
    """Revisa `presupuesto_inicio` según el periodo y lo devuelve listo para guardar."""
    if periodo == "quincenal":
        return ""
    if inicio is None:
        raise HTTPException(422, "Falta el inicio del periodo del presupuesto")
    if periodo == "semanal":
        if inicio not in ("0", "1", "2", "3", "4", "5", "6"):
            raise HTTPException(422, "En un presupuesto semanal el inicio es el día de la semana, de 0 (domingo) a 6 (sábado)")
    elif periodo == "mensual":
        if not (inicio.isascii() and inicio.isdigit() and 1 <= int(inicio) <= 28):
            raise HTTPException(422, "En un presupuesto mensual el inicio es el día del mes, de 1 a 28")
    else:  # catorcenal
        try:
            date.fromisoformat(inicio)
        except ValueError:
            raise HTTPException(422, "En un presupuesto cada 2 semanas el inicio es una fecha (AAAA-MM-DD)")
    return inicio


CAMPOS_PENDIENTE = ("id, origen, recibido, remitente, asunto, texto, tipo, monto, fecha, hora, comercio, "
                    "categoria_id, cuenta_id, terminacion, motivo")


def _pendientes(con: sqlite3.Connection) -> list[dict]:
    """Los avisos del banco que esperan revisión, los más recientes primero."""
    return [dict(f) for f in con.execute(
        f"SELECT {CAMPOS_PENDIENTE} FROM pendiente WHERE estado = 'nuevo' ORDER BY recibido DESC, creado DESC")]


def _yappy_categorias(con: sqlite3.Connection) -> dict:
    """Lo guardado para los Yappy (null = automática, o la elegida ya no existe)."""
    salida = {}
    for tipo in ("gasto", "ingreso"):
        f = con.execute("SELECT c.id FROM ajuste a JOIN categoria c ON c.id = a.valor "
                        "WHERE a.clave = ? AND c.tipo = ?", (f"yappy_categoria_{tipo}", tipo)).fetchone()
        salida[tipo] = f["id"] if f else None
    return salida


def leer_todo(con: sqlite3.Connection, hoy: date) -> dict:
    cuentas = [_cuenta(f) for f in con.execute(
        """SELECT c.*, c.saldo_inicial
             + COALESCE((SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto
                                         WHEN m.tipo = 'gasto' THEN -m.monto
                                         ELSE -m.monto END)
                         FROM movimiento m WHERE m.cuenta_id = c.id), 0)
             + COALESCE((SELECT SUM(m.monto) FROM movimiento m WHERE m.cuenta_destino_id = c.id), 0) AS saldo
           FROM cuenta c ORDER BY c.orden, c.creado""")]
    moneda = con.execute("SELECT valor FROM ajuste WHERE clave = 'moneda'").fetchone()
    return {
        "hoy": hoy.isoformat(),
        "moneda": moneda["valor"] if moneda else "$",
        "cuentas": cuentas,
        "categorias": [_categoria(f) for f in con.execute("SELECT * FROM categoria ORDER BY tipo, orden, creado")],
        "movimientos": [dict(f) for f in con.execute("SELECT * FROM movimiento ORDER BY fecha DESC, hora DESC, creado DESC")],
        "recurrencias": [dict(f) for f in con.execute("SELECT * FROM recurrencia ORDER BY fecha_inicio")],
        "presupuesto": _presupuesto(con),
        "proximos": recurrencias.proximas(con, hoy),
        "cortes_tarjeta": [dict(f) for f in con.execute(
            "SELECT cuenta_id, corte, minimo, dias FROM corte_tarjeta ORDER BY cuenta_id, corte")],
        "catalogo": CATALOGO,
        "pendientes": _pendientes(con),
        "cuenta_yappy": correo.cuenta_yappy(con),
        "yappy_categorias": _yappy_categorias(con),
    }


def _guardar_regla(con: sqlite3.Connection, id_: str, rec: RecurrenciaIn) -> None:
    """Crea o cambia una regla que se repite. Lo ya creado no se toca: el cambio vale para lo que viene."""
    _validar(con, rec)
    if rec.fecha_fin and rec.fecha_fin < rec.fecha_inicio:
        raise HTTPException(422, "La fecha de fin es anterior a la de inicio")
    actual = con.execute("SELECT fecha_inicio FROM recurrencia WHERE id = ?", (id_,)).fetchone()
    if actual and actual["fecha_inicio"] != rec.fecha_inicio.isoformat():
        raise HTTPException(422, "La fecha de inicio no se cambia: termina esta recurrencia y crea otra")
    marca = db.ahora()
    with con:
        con.execute(
            """INSERT INTO recurrencia (id, tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, nota, frecuencia,
                 fecha_inicio, fecha_fin, creado, actualizado)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (id) DO UPDATE SET tipo = excluded.tipo, monto = excluded.monto,
                 cuenta_id = excluded.cuenta_id, cuenta_destino_id = excluded.cuenta_destino_id,
                 categoria_id = excluded.categoria_id, nota = excluded.nota, frecuencia = excluded.frecuencia,
                 fecha_fin = excluded.fecha_fin, actualizado = excluded.actualizado""",
            (id_, rec.tipo, rec.monto, rec.cuenta_id, rec.cuenta_destino_id, rec.categoria_id, rec.nota.strip(),
             rec.frecuencia, rec.fecha_inicio.isoformat(), rec.fecha_fin.isoformat() if rec.fecha_fin else None,
             marca, marca),
        )


CATEGORIA_CARGOS = "cargos-banco"
DIA_DE_CARGOS = 3  # el banco cobra la membresía y el seguro el día 3


def _version_vigente(producto: dict, hoy: date) -> dict:
    """La última versión del catálogo ya vigente hoy (antes de la primera, la primera)."""
    versiones = sorted(producto["versiones"], key=lambda v: v["vigente_desde"])
    return next((v for v in reversed(versiones) if v["vigente_desde"] <= hoy.isoformat()), versiones[0])


def _cargos_deseados(vinculo: VinculoBanco | None, hoy: date) -> dict[str, tuple[int, str]]:
    """Los cargos fijos mensuales de la cuenta según el catálogo: {«membresia»/«seguro»: (centavos, nota)}."""
    if vinculo is None or vinculo.tarjeta is None:
        return {}
    banco = next(b for b in CATALOGO["bancos"] if b["id"] == vinculo.banco)
    tarjeta = next(t for t in banco["tarjetas"] if t["id"] == vinculo.tarjeta)
    if tarjeta.get("clase") != "debito":
        return {}
    version = _version_vigente(tarjeta, hoy)
    deseados = {}
    mensual = (version.get("membresia") or {}).get("mensual")
    if vinculo.membresia == "mensual" and mensual:
        deseados["membresia"] = (mensual, f"Membresía {tarjeta['nombre']}")
    seguro = next((x for x in version.get("seguros", []) if x["id"] == vinculo.seguro), None)
    if seguro:
        deseados["seguro"] = (seguro["mensual"], seguro["nombre"])
    return deseados


def _proximo_dia_de_cargos(hoy: date) -> date:
    """El próximo día 3 (nunca hoy ni antes): lo que ya pasó no se anota."""
    if hoy.day < DIA_DE_CARGOS:
        return hoy.replace(day=DIA_DE_CARGOS)
    return recurrencias.sumar_meses(hoy.replace(day=DIA_DE_CARGOS), 1)


def _sincronizar_cargos(con: sqlite3.Connection, cuenta_id: str, vinculo: VinculoBanco | None, hoy: date) -> None:
    """Deja las reglas `banco-<cuenta>-membresia` y `-seguro` como pide el vínculo con el banco.

    Las que hacen falta se crean o se ponen al día (monto y nota de hoy, sin fecha de fin); las que ya
    no corresponden (se quitó la tarjeta, el seguro o el vínculo, o la membresía pasó a anual) terminan hoy.
    """
    deseados = _cargos_deseados(vinculo, hoy)
    for clave in ("membresia", "seguro"):
        id_ = f"banco-{cuenta_id}-{clave}"
        existente = con.execute("SELECT * FROM recurrencia WHERE id = ?", (id_,)).fetchone()
        if clave not in deseados:
            if existente and (existente["fecha_fin"] is None or existente["fecha_fin"] > hoy.isoformat()):
                with con:
                    con.execute("UPDATE recurrencia SET fecha_fin = ?, actualizado = ? WHERE id = ?",
                                (hoy.isoformat(), db.ahora(), id_))
            continue
        if not con.execute("SELECT 1 FROM categoria WHERE id = ?", (CATEGORIA_CARGOS,)).fetchone():
            marca = db.ahora()
            with con:
                orden = con.execute("SELECT COALESCE(MAX(orden) + 1, 0) FROM categoria WHERE tipo = 'gasto'").fetchone()[0]
                con.execute("INSERT INTO categoria (id, nombre, tipo, color, emoji, presupuesto, orden, creado, actualizado) "
                            "VALUES (?, 'Cargos del banco', 'gasto', ?, 'i:banco', NULL, ?, ?, ?)",
                            (CATEGORIA_CARGOS, db.PALETA[9], orden, marca, marca))
        monto, nota = deseados[clave]
        reactivada = existente is not None and existente["fecha_fin"] is not None
        inicio = date.fromisoformat(existente["fecha_inicio"]) if existente else _proximo_dia_de_cargos(hoy)
        _guardar_regla(con, id_, RecurrenciaIn(tipo="gasto", monto=monto, cuenta_id=cuenta_id, categoria_id=CATEGORIA_CARGOS,
                                               nota=nota, frecuencia="mensual", fecha_inicio=inicio))
        if reactivada:  # lo que pasó mientras estuvo terminada no se anota
            with con:
                con.execute("UPDATE recurrencia SET generada_hasta = ? WHERE id = ?", (hoy.isoformat(), id_))
    recurrencias.materializar(con, hoy)


def create_app(config: Config | None = None, hoy=date.today, web: Path = WEB, extractor=None, elector=None,
               bajador=imagenes.bajar) -> FastAPI:
    """`hoy` es una función para que las pruebas puedan mover el reloj; `web`, dónde está la app web;
    `extractor`, la función que lee un aviso del banco (por defecto Claude; las pruebas ponen una falsa);
    `elector`, la que elige la categoría de un Yappy o un Apple Pay (igual: Claude, o una falsa);
    `bajador`, el que trae la imagen de una tarjeta de la página del banco (las pruebas ponen uno falso)."""
    config = config or Config.desde_entorno()
    inicial = db.conectar(config.ruta_db)
    try:
        db.inicializar(inicial)
    finally:
        inicial.close()

    app = FastAPI(title="Libro de Gastos", docs_url=None, redoc_url=None)
    # Comprimido: el código de la app web pesa 1 MB y por Tailscale se nota (queda en ~¼).
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.state.config = config

    def conexion() -> Iterator[sqlite3.Connection]:
        con = db.conectar(config.ruta_db)
        try:
            yield con
        finally:
            con.close()

    def anotar_entrada(texto: str) -> None:
        """Una línea en datos/registros/entradas.log (no se pisa al reiniciar, como servidor.log): qué llegó de los
        Atajos del iPhone y con qué respondió la PC, para saber por qué un pago de Apple Pay no se anotó."""
        try:
            ruta = config.carpeta / "registros" / "entradas.log"
            ruta.parent.mkdir(parents=True, exist_ok=True)
            with ruta.open("a", encoding="utf-8") as f:
                f.write(f"{datetime.now().isoformat(timespec='seconds')}  {texto}\n")
        except OSError:
            pass

    def ultimo_intento() -> str | None:
        """La última respuesta a /api/entrada («2026-11-04T08:12:03 → 200»), para la página de estado."""
        ruta = config.carpeta / "registros" / "entradas.log"
        try:
            lineas = [x for x in ruta.read_text(encoding="utf-8").splitlines() if "→" in x]
        except OSError:
            return None
        if not lineas:
            return None
        fecha, _, resto = lineas[-1].partition("  ")
        return f"{fecha.replace('T', ' ')[:16]} → {resto.rsplit('→', 1)[-1].strip()}"

    @app.middleware("http")
    async def registrar_entradas(request: Request, siguiente):
        respuesta = await siguiente(request)
        if request.url.path == "/api/entrada":
            anotar_entrada(f"{request.client.host if request.client else '?'} → {respuesta.status_code}")
        return respuesta

    @app.exception_handler(RequestValidationError)
    async def entrada_que_no_se_entiende(request: Request, exc: RequestValidationError):
        if request.url.path == "/api/entrada":
            anotar_entrada(f"no se entendió: {str(exc.errors())[:300]}")
        return await request_validation_exception_handler(request, exc)

    @app.middleware("http")
    async def solo_la_tailnet(request: Request, siguiente):
        if not desde_red_permitida(request.client.host if request.client else None):
            return JSONResponse({"detail": "Este servidor solo atiende a esta PC y a la tailnet"}, status_code=403)
        return await siguiente(request)

    def autorizado(authorization: str | None = Header(default=None), t: str | None = None) -> None:
        esperado = f"Bearer {config.token}"
        if authorization and secrets.compare_digest(authorization.encode(), esperado.encode()):
            return
        if t and secrets.compare_digest(t.encode(), config.token.encode()):
            return
        raise HTTPException(401, SIN_ENTRADA)

    r = APIRouter(prefix="/api", dependencies=[Depends(autorizado)])

    @app.get("/", response_class=HTMLResponse)
    def estado(request: Request, con: sqlite3.Connection = Depends(conexion)):
        conteos = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("cuenta", "movimiento", "recurrencia")}
        # El QR lleva el token: solo se muestra a quien abre la página desde esta misma PC.
        host = request.client.host if request.client else ""
        local = host in ("127.0.0.1", "::1") or host.startswith("::ffff:127.")
        qr = pagina.bloque_qr(config.token, request.url.port or 8766) if local else ""
        ultimos = {f["origen"]: f["creado"] for f in con.execute(
            "SELECT origen, MAX(creado) AS creado FROM pendiente WHERE origen IN ('yappy', 'wallet') GROUP BY origen")}
        return pagina.estado(config, conteos, db.ultimo_respaldo(config.respaldos), qr,
                              {**correo.estado_actual(config.carpeta), "ultimos": ultimos, "ultimo_intento": ultimo_intento()})

    @app.get("/app", include_in_schema=False)
    def app_web_sin_barra():
        return RedirectResponse("/app/")

    @app.get("/app/{ruta:path}", include_in_schema=False)
    def app_web(ruta: str):
        """Los archivos del export; cualquier otra ruta (/app/ajustes, /app/cuenta/x) es la página de la
        app, que elige la pantalla. Lo que lleva huella en el nombre (_expo/) no cambia nunca."""
        raiz = web.resolve()
        archivo = (raiz / ruta).resolve()
        if ruta and archivo.is_file() and archivo.is_relative_to(raiz):
            fija = ruta.startswith(("_expo/", "assets/"))
            return FileResponse(archivo, headers={"Cache-Control": "public, max-age=31536000, immutable" if fija else "no-cache"})
        indice = raiz / "index.html"
        if not indice.is_file():
            raise HTTPException(404, "Falta compilar la app web: npx expo export --platform web en app/")
        return FileResponse(indice, headers={"Cache-Control": "no-cache"})

    @app.post("/app/arranque", include_in_schema=False)
    async def arranque(request: Request):
        """La web avisa cuánto tardó en abrir (ver public/index.html); queda en el registro."""
        print(f"Arranque web desde {request.client.host if request.client else '?'}: {(await request.body())[:300].decode(errors='replace')}", flush=True)
        return {"ok": True}

    @app.get("/tarjetas/{id_}.png", include_in_schema=False)
    def imagen_tarjeta(id_: str):
        """La imagen de una tarjeta del catálogo, sin pedir entrar (como /app: es pública, la publica el banco y
        un <img> no manda el token). Se baja una vez de la página del banco y queda en datos/tarjetas/."""
        try:
            archivo = imagenes.ruta_de(config.carpeta, CATALOGO, id_, bajador)
        except Exception as e:  # sin internet, el banco cambió la imagen de lugar…: la app dibuja la tarjeta
            print(f"No se pudo traer la imagen de {id_}: {e}", flush=True)
            raise HTTPException(404, "No se pudo traer la imagen de esa tarjeta")
        if archivo is None:
            raise HTTPException(404, "Esa tarjeta no tiene imagen")
        return FileResponse(archivo, media_type="image/png", headers={"Cache-Control": "public, max-age=604800"})

    @app.get("/salud")
    def salud():
        return {"ok": True}

    @r.get("/datos")
    def datos(con: sqlite3.Connection = Depends(conexion)):
        recurrencias.materializar(con, hoy())
        return leer_todo(con, hoy())

    # --- Cuentas -----------------------------------------------------------------------------
    @r.put("/cuentas/{id_}")
    def guardar_cuenta(id_: str, c: CuentaIn, con: sqlite3.Connection = Depends(conexion)):
        marca = db.ahora()
        with con:
            orden = con.execute("SELECT COALESCE(MAX(orden) + 1, 0) FROM cuenta").fetchone()[0]
            con.execute(
                """INSERT INTO cuenta (id, nombre, color, saldo_inicial, orden, creado, actualizado,
                     es_credito, dia_corte, dia_pago, pago_minimo, limite, minimo_corte,
                     corte_inicial, deuda_al_corte, pagos_tras_corte, banco, terminacion, reglas)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, color = excluded.color,
                     saldo_inicial = excluded.saldo_inicial, actualizado = excluded.actualizado,
                     es_credito = excluded.es_credito, dia_corte = excluded.dia_corte,
                     dia_pago = excluded.dia_pago, pago_minimo = excluded.pago_minimo, limite = excluded.limite,
                     minimo_corte = excluded.minimo_corte, corte_inicial = excluded.corte_inicial,
                     deuda_al_corte = excluded.deuda_al_corte, pagos_tras_corte = excluded.pagos_tras_corte,
                     banco = excluded.banco, terminacion = excluded.terminacion, reglas = excluded.reglas""",
                (id_, c.nombre.strip(), c.color, c.saldo_inicial, orden, marca, marca,
                 int(c.es_credito), c.dia_corte, c.dia_pago, c.pago_minimo, c.limite,
                 c.minimo_corte.isoformat() if c.minimo_corte else None,
                 c.corte_inicial.isoformat() if c.corte_inicial else None, c.deuda_al_corte, c.pagos_tras_corte,
                 json.dumps(c.banco.model_dump(), ensure_ascii=False) if c.banco else None, c.terminacion,
                 json.dumps(c.reglas.model_dump(exclude_none=True), ensure_ascii=False) if c.reglas else None),
            )
        _sincronizar_cargos(con, id_, c.banco, hoy())
        return _cuenta(con.execute("SELECT * FROM cuenta WHERE id = ?", (id_,)).fetchone())

    @r.delete("/cuentas/{id_}")
    def borrar_cuenta(id_: str, con_todo: bool = False, con: sqlite3.Connection = Depends(conexion)):
        """Con `con_todo`, se van también los movimientos y las reglas que la tocan (de origen o de destino)."""
        if con.execute("SELECT COUNT(*) FROM cuenta").fetchone()[0] <= 1:
            raise HTTPException(409, "Es la única cuenta: no se puede borrar")
        usada = con.execute(
            """SELECT EXISTS (SELECT 1 FROM movimiento WHERE cuenta_id = :id OR cuenta_destino_id = :id)
                   OR EXISTS (SELECT 1 FROM recurrencia WHERE cuenta_id = :id OR cuenta_destino_id = :id)""",
            {"id": id_},
        ).fetchone()[0]
        if usada and not con_todo:
            raise HTTPException(409, "La cuenta tiene movimientos o recurrencias: no se puede borrar")
        with con:
            if con_todo:
                con.execute("DELETE FROM movimiento WHERE cuenta_id = :id OR cuenta_destino_id = :id", {"id": id_})
                con.execute("DELETE FROM recurrencia WHERE cuenta_id = :id OR cuenta_destino_id = :id", {"id": id_})
            con.execute("DELETE FROM corte_tarjeta WHERE cuenta_id = ?", (id_,))
            con.execute("DELETE FROM cuenta WHERE id = ?", (id_,))
        return {"ok": True}

    # --- Cortes de tarjeta ---------------------------------------------------------------------
    @r.put("/cuentas/{id_}/cortes/{corte}")
    def guardar_corte(id_: str, corte: date, c: CorteIn, con: sqlite3.Connection = Depends(conexion)):
        """El mínimo del estado de cuenta de un corte y, si se pudo saber, los días de atraso del banco."""
        cuenta = con.execute("SELECT es_credito FROM cuenta WHERE id = ?", (id_,)).fetchone()
        if not cuenta or not cuenta["es_credito"]:
            raise HTTPException(404, "No hay una tarjeta de crédito con ese id")
        with con:
            con.execute(
                """INSERT INTO corte_tarjeta (cuenta_id, corte, minimo, dias, creado) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT (cuenta_id, corte) DO UPDATE SET minimo = excluded.minimo, dias = excluded.dias""",
                (id_, corte.isoformat(), c.minimo, c.dias, db.ahora()),
            )
        return {"cuenta_id": id_, "corte": corte.isoformat(), "minimo": c.minimo, "dias": c.dias}

    @r.delete("/cuentas/{id_}/cortes/{corte}")
    def borrar_corte(id_: str, corte: str, con: sqlite3.Connection = Depends(conexion)):
        with con:
            con.execute("DELETE FROM corte_tarjeta WHERE cuenta_id = ? AND corte = ?", (id_, corte))
        return {"ok": True}

    # --- Categorías --------------------------------------------------------------------------
    @r.put("/categorias/{id_}")
    def guardar_categoria(id_: str, c: CategoriaIn, con: sqlite3.Connection = Depends(conexion)):
        actual = con.execute("SELECT tipo FROM categoria WHERE id = ?", (id_,)).fetchone()
        if actual and actual["tipo"] != c.tipo:
            raise HTTPException(422, "Una categoría no cambia de tipo: crea otra")
        presupuesto = c.presupuesto if c.tipo == "gasto" and c.presupuesto else None
        marca = db.ahora()
        with con:
            orden = con.execute("SELECT COALESCE(MAX(orden) + 1, 0) FROM categoria WHERE tipo = ?", (c.tipo,)).fetchone()[0]
            con.execute(
                """INSERT INTO categoria (id, nombre, tipo, color, emoji, presupuesto, orden, creado, actualizado,
                     acumula, acumula_desde)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, color = excluded.color,
                     emoji = excluded.emoji, presupuesto = excluded.presupuesto, actualizado = excluded.actualizado,
                     acumula = excluded.acumula, acumula_desde = excluded.acumula_desde""",
                (id_, c.nombre.strip(), c.tipo, c.color, c.emoji, presupuesto, orden, marca, marca,
                 int(c.acumula), c.acumula_desde.isoformat() if c.acumula_desde else None),
            )
        return _categoria(con.execute("SELECT * FROM categoria WHERE id = ?", (id_,)).fetchone())

    @r.delete("/categorias/{id_}")
    def borrar_categoria(id_: str, con: sqlite3.Connection = Depends(conexion)):
        usada = con.execute(
            """SELECT EXISTS (SELECT 1 FROM movimiento WHERE categoria_id = :id)
                   OR EXISTS (SELECT 1 FROM recurrencia WHERE categoria_id = :id)""",
            {"id": id_},
        ).fetchone()[0]
        if usada:
            raise HTTPException(409, "La categoría tiene movimientos o recurrencias: no se puede borrar")
        with con:
            con.execute("DELETE FROM categoria WHERE id = ?", (id_,))
        return {"ok": True}

    @r.put("/orden/{tabla}")
    def ordenar(tabla: Literal["cuentas", "categorias"], o: OrdenIn, con: sqlite3.Connection = Depends(conexion)):
        nombre = {"cuentas": "cuenta", "categorias": "categoria"}[tabla]
        with con:
            con.executemany(f"UPDATE {nombre} SET orden = ? WHERE id = ?", [(i, id_) for i, id_ in enumerate(o.ids)])
        return {"ok": True}

    # --- Movimientos -------------------------------------------------------------------------
    @r.put("/movimientos/{id_}")
    def guardar_movimiento(id_: str, m: MovimientoIn, con: sqlite3.Connection = Depends(conexion)):
        _validar(con, m)
        marca = db.ahora()
        with con:
            con.execute(
                """INSERT INTO movimiento (id, tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota,
                     origen, creado, actualizado)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
                   ON CONFLICT (id) DO UPDATE SET tipo = excluded.tipo, monto = excluded.monto, fecha = excluded.fecha,
                     hora = excluded.hora, cuenta_id = excluded.cuenta_id, cuenta_destino_id = excluded.cuenta_destino_id,
                     categoria_id = excluded.categoria_id, nota = excluded.nota, actualizado = excluded.actualizado""",
                (id_, m.tipo, m.monto, m.fecha.isoformat(), m.hora, m.cuenta_id, m.cuenta_destino_id, m.categoria_id,
                 m.nota.strip(), marca, marca),
            )
        return dict(con.execute("SELECT * FROM movimiento WHERE id = ?", (id_,)).fetchone())

    @r.delete("/movimientos/{id_}")
    def borrar_movimiento(id_: str, y_siguientes: bool = False, con: sqlite3.Connection = Depends(conexion)):
        """Con `y_siguientes`, si el movimiento es de una recurrencia, la recurrencia termina antes de él."""
        fila = con.execute("SELECT * FROM movimiento WHERE id = ?", (id_,)).fetchone()
        if fila is None:
            return {"ok": True}  # ya estaba borrado: el reintento no es un error
        with con:
            if y_siguientes and fila["recurrencia_id"]:
                rec = fila["recurrencia_id"]
                con.execute("DELETE FROM movimiento WHERE recurrencia_id = ? AND fecha >= ?", (rec, fila["fecha"]))
                anterior = date.fromisoformat(fila["fecha"]).toordinal() - 1
                con.execute("UPDATE recurrencia SET fecha_fin = ?, actualizado = ? WHERE id = ?",
                            (date.fromordinal(anterior).isoformat(), db.ahora(), rec))
            else:
                con.execute("DELETE FROM movimiento WHERE id = ?", (id_,))
        return {"ok": True}

    # --- Recurrencias ------------------------------------------------------------------------
    @r.put("/recurrencias/{id_}")
    def guardar_recurrencia(id_: str, rec: RecurrenciaIn, con: sqlite3.Connection = Depends(conexion)):
        """Crear o cambiar la regla. Lo ya creado no se toca: el cambio vale para lo que viene."""
        _guardar_regla(con, id_, rec)
        creados = recurrencias.materializar(con, hoy())
        return {"recurrencia": dict(con.execute("SELECT * FROM recurrencia WHERE id = ?", (id_,)).fetchone()), "creados": creados}

    @r.delete("/recurrencias/{id_}")
    def borrar_recurrencia(id_: str, con: sqlite3.Connection = Depends(conexion)):
        """Deja de repetirse. Los movimientos que ya creó se quedan, sueltos."""
        with con:
            con.execute("DELETE FROM recurrencia WHERE id = ?", (id_,))
        return {"ok": True}

    # --- Avisos del banco (correo y atajo) -----------------------------------------------------
    def extraer(aviso: dict, categorias: list[dict], cuentas: list[dict]) -> dict:
        if extractor is not None:
            return extractor(aviso, categorias, cuentas)
        ajustes = correo.leer_config(config.carpeta)
        return correo.extraer_con_claude(aviso, categorias, cuentas, ajustes["modelo"] if ajustes else correo.MODELO)

    def elegir(datos: dict, categorias: list[dict]) -> str:
        if elector is not None:
            return elector(datos, categorias)
        ajustes = correo.leer_config(config.carpeta)
        return correo.elegir_categoria(datos, categorias, ajustes["modelo"] if ajustes else correo.MODELO)

    def leer_en_hilo(id_: str, entrada: dict) -> None:
        con = db.conectar(config.ruta_db)
        try:
            correo.resolver(con, id_, entrada, extraer, hoy(), elegir)
        except Exception as e:  # que la fila no se quede «leyendo» para siempre
            correo.recuperar_interrumpidos(con)
            print(f"Entrada: falló ({e.__class__.__name__})", flush=True)
        finally:
            con.close()

    @r.get("/avisos/pagos", response_class=PlainTextResponse)
    def avisos_de_pago(con: sqlite3.Connection = Depends(conexion)):
        """Para el Atajo diario del iPhone: qué tarjeta toca pagar (3 días antes, la víspera y el día), o vacío."""
        return avisos.texto_de_pagos(con, CATALOGO, hoy())

    @r.post("/entrada")
    def entrada(e: EntradaIn, con: sqlite3.Connection = Depends(conexion)):
        """Un aviso del banco: un texto (p. ej. un SMS que manda un Atajo del iPhone) o los campos sueltos de
        Apple Pay (`monto`, `comercio`, `terminacion`). Responde ya y lo lee aparte."""
        aviso = {"texto": e.texto or "", "origen": e.origen, "fecha": hoy().isoformat()}
        if e.monto is not None:  # Apple Pay: no hay nada que extraer del texto
            comercio = (e.comercio or "").strip() or "Apple Pay"
            aviso.update(origen="wallet", remitente="Apple Pay", monto=e.monto, comercio=comercio,
                         terminacion=e.terminacion, hora=datetime.now().strftime("%H:%M"))
            aviso["texto"] = aviso["texto"] or f"{comercio} · {e.monto}"
        anotar_entrada(f"recibido: monto={e.monto!r} comercio={e.comercio!r} terminacion={e.terminacion!r} texto={(e.texto or '')[:80]!r}")
        id_ = correo.registrar(con, aviso)
        threading.Thread(target=leer_en_hilo, args=(id_, aviso), daemon=True, name="entrada").start()
        return {"ok": True, "id": id_}

    @r.put("/pendientes/{id_}")
    def resolver_pendiente(id_: str, p: PendienteIn, con: sqlite3.Connection = Depends(conexion)):
        """Aceptar (la app ya creó el movimiento) o descartar un aviso. Idempotente.

        Al aceptar, el movimiento queda con el origen del aviso (`correo`, `yappy` o `wallet`); en un Yappy,
        si aún no se sabía de qué cuenta sale, esa es la cuenta del movimiento y se anotan solos los otros Yappy; si el aviso traía los 4 dígitos de una tarjeta y
        la cuenta del movimiento no tiene los suyos, los aprende, y entonces anota solos los demás
        avisos que esperaban por esa tarjeta."""
        fila = con.execute("SELECT * FROM pendiente WHERE id = ?", (id_,)).fetchone()
        if fila is None:
            raise HTTPException(404, "Ese aviso no existe")
        cuenta_id = fila["cuenta_id"]
        with con:
            if p.estado == "aceptado" and p.movimiento_id:
                mov = con.execute("SELECT cuenta_id FROM movimiento WHERE id = ?", (p.movimiento_id,)).fetchone()
                if mov is None:
                    raise HTTPException(422, "El movimiento no existe")
                cuenta_id = mov["cuenta_id"]
                con.execute("UPDATE movimiento SET origen = ? WHERE id = ?",
                            (fila["origen"] if fila["origen"] in ("yappy", "wallet") else "correo", p.movimiento_id))
                if fila["origen"] == "yappy" and correo.cuenta_yappy(con) is None:  # la primera vez enseña de qué cuenta sale
                    con.execute("INSERT INTO ajuste VALUES ('cuenta_yappy', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
                                (cuenta_id,))
                if fila["terminacion"]:
                    # Solo si ninguna otra cuenta ya la tiene: dos cuentas con la misma terminación confundirían.
                    con.execute("""UPDATE cuenta SET terminacion = ?, actualizado = ?
                                   WHERE id = ? AND terminacion IS NULL
                                     AND NOT EXISTS (SELECT 1 FROM cuenta WHERE terminacion = ?)""",
                                (fila["terminacion"], db.ahora(), cuenta_id, fila["terminacion"]))
            con.execute("UPDATE pendiente SET estado = ?, movimiento_id = ?, cuenta_id = ?, motivo = '', actualizado = ? WHERE id = ?",
                        (p.estado, p.movimiento_id if p.estado == "aceptado" else None, cuenta_id, db.ahora(), id_))
        if p.estado == "aceptado" and fila["terminacion"]:
            correo.reintentar_por_terminacion(con, fila["terminacion"])
        if p.estado == "aceptado" and fila["origen"] == "yappy":
            correo.reintentar_yappy(con)
        return {"ok": True, "estado": p.estado}

    @r.post("/correo/revisar")
    def revisar_correo():
        """Pide revisar el correo ya (el hilo de fondo lo hace; no espera)."""
        correo.pedido.set()
        return {"ok": True}

    @r.get("/correo")
    def estado_correo():
        return correo.estado_actual(config.carpeta)

    # --- Ajustes, importar y exportar --------------------------------------------------------
    @r.put("/ajustes")
    def guardar_ajustes(a: AjustesIn, con: sqlite3.Connection = Depends(conexion)):
        guardar = {}
        if a.moneda is not None:
            guardar["moneda"] = a.moneda.strip()
        if a.presupuesto_periodo is not None:
            guardar["presupuesto_periodo"] = a.presupuesto_periodo
            guardar["presupuesto_inicio"] = _inicio_valido(a.presupuesto_periodo, a.presupuesto_inicio)
        if a.cuenta_yappy:
            if not _existe(con, "cuenta", a.cuenta_yappy):
                raise HTTPException(422, "La cuenta de Yappy no existe")
            guardar["cuenta_yappy"] = a.cuenta_yappy
        borrar = ["cuenta_yappy"] if a.cuenta_yappy == "" else []
        for tipo, valor in (("gasto", a.yappy_categoria_gasto), ("ingreso", a.yappy_categoria_ingreso)):
            if valor is None:
                continue
            if valor == "":
                borrar.append(f"yappy_categoria_{tipo}")
            elif con.execute("SELECT 1 FROM categoria WHERE id = ? AND tipo = ?", (valor, tipo)).fetchone():
                guardar[f"yappy_categoria_{tipo}"] = valor
            else:
                raise HTTPException(422, f"La categoría de los Yappy de {tipo}s no existe o no es de ese tipo")
        with con:
            con.executemany("INSERT INTO ajuste VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
                            list(guardar.items()))
            for clave in borrar:
                con.execute("DELETE FROM ajuste WHERE clave = ?", (clave,))
        if a.cuenta_yappy:
            correo.reintentar_yappy(con)
        moneda = con.execute("SELECT valor FROM ajuste WHERE clave = 'moneda'").fetchone()
        return {"moneda": moneda["valor"] if moneda else "$", "presupuesto": _presupuesto(con),
                "cuenta_yappy": correo.cuenta_yappy(con), "yappy_categorias": _yappy_categorias(con)}

    @r.post("/importar")
    async def importar_vieja(request: Request, simular: bool = False, con: sqlite3.Connection = Depends(conexion)):
        try:
            datos = await request.json()
        except ValueError:
            raise HTTPException(422, "El archivo no es un JSON válido")
        try:
            if not simular:
                db.respaldar(con, config.respaldos)
            resumen = importar.importar(con, datos, hoy(), simular)
        except importar.ErrorDeImportacion as e:
            raise HTTPException(409, str(e))
        if not simular:
            recurrencias.materializar(con, hoy())
        return resumen

    @r.get("/exportar")
    def exportar(con: sqlite3.Connection = Depends(conexion)):
        todo = leer_todo(con, hoy())
        for clave in ("proximos", "catalogo", "pendientes", "cuenta_yappy", "yappy_categorias"):
            todo.pop(clave)
        return {"app": "libro-de-gastos", "version": db.VERSION, "exportado": db.ahora(), **todo}

    app.include_router(r)
    return app
