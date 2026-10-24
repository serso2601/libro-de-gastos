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
import secrets
import sqlite3
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, model_validator

from . import db, importar, pagina, recurrencias
from .config import Config

SIN_ENTRADA = "Falta el token o no es el de este servidor"
WEB = Path(__file__).resolve().parents[2] / "app" / "dist"  # `npx expo export --platform web` en app/

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


class CuentaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    color: str = Color
    saldo_inicial: int = 0
    es_credito: bool = False
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    dia_pago: int | None = Field(default=None, ge=1, le=31)
    pago_minimo: int | None = Field(default=None, ge=0)  # centavos; lo copia el usuario de su estado de cuenta

    @model_validator(mode="after")
    def _credito(self):
        if self.es_credito and self.dia_corte is None:
            raise ValueError("Una tarjeta de crédito necesita su día de corte")
        if not self.es_credito:
            self.dia_corte = self.dia_pago = self.pago_minimo = None
        return self


class CategoriaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    tipo: Literal["gasto", "ingreso"]
    color: str = Color
    emoji: str = Field(default="💰", min_length=1, max_length=16)
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


class OrdenIn(BaseModel):
    ids: list[str]


class AjustesIn(BaseModel):
    """Solo se guarda lo que llega: `{"moneda": "$"}` no toca el periodo del presupuesto."""

    moneda: str | None = Field(default=None, min_length=1, max_length=4)
    presupuesto_periodo: Literal["semanal", "catorcenal", "quincenal", "mensual"] | None = None
    presupuesto_inicio: str | None = Field(default=None, max_length=10)


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
    """Una cuenta como la ve la API: `es_credito` sale como booleano, no como 0/1."""
    return {**dict(fila), "es_credito": bool(fila["es_credito"])}


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
    }


def create_app(config: Config | None = None, hoy=date.today, web: Path = WEB) -> FastAPI:
    """`hoy` es una función para que las pruebas puedan mover el reloj; `web`, dónde está la app web."""
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
        return pagina.estado(config, conteos, db.ultimo_respaldo(config.respaldos), qr)

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
                     es_credito, dia_corte, dia_pago, pago_minimo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, color = excluded.color,
                     saldo_inicial = excluded.saldo_inicial, actualizado = excluded.actualizado,
                     es_credito = excluded.es_credito, dia_corte = excluded.dia_corte,
                     dia_pago = excluded.dia_pago, pago_minimo = excluded.pago_minimo""",
                (id_, c.nombre.strip(), c.color, c.saldo_inicial, orden, marca, marca,
                 int(c.es_credito), c.dia_corte, c.dia_pago, c.pago_minimo),
            )
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
            con.execute("DELETE FROM cuenta WHERE id = ?", (id_,))
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
        creados = recurrencias.materializar(con, hoy())
        return {"recurrencia": dict(con.execute("SELECT * FROM recurrencia WHERE id = ?", (id_,)).fetchone()), "creados": creados}

    @r.delete("/recurrencias/{id_}")
    def borrar_recurrencia(id_: str, con: sqlite3.Connection = Depends(conexion)):
        """Deja de repetirse. Los movimientos que ya creó se quedan, sueltos."""
        with con:
            con.execute("DELETE FROM recurrencia WHERE id = ?", (id_,))
        return {"ok": True}

    # --- Ajustes, importar y exportar --------------------------------------------------------
    @r.put("/ajustes")
    def guardar_ajustes(a: AjustesIn, con: sqlite3.Connection = Depends(conexion)):
        guardar = {}
        if a.moneda is not None:
            guardar["moneda"] = a.moneda.strip()
        if a.presupuesto_periodo is not None:
            guardar["presupuesto_periodo"] = a.presupuesto_periodo
            guardar["presupuesto_inicio"] = _inicio_valido(a.presupuesto_periodo, a.presupuesto_inicio)
        with con:
            con.executemany("INSERT INTO ajuste VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
                            list(guardar.items()))
        moneda = con.execute("SELECT valor FROM ajuste WHERE clave = 'moneda'").fetchone()
        return {"moneda": moneda["valor"] if moneda else "$", "presupuesto": _presupuesto(con)}

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
        todo.pop("proximos")
        return {"app": "libro-de-gastos", "version": db.VERSION, "exportado": db.ahora(), **todo}

    app.include_router(r)
    return app
