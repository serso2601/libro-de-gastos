"""La API del Libro de Gastos.

Todo lo de datos va bajo /api y pide entrar (ver `autorizado`). Los ids los pone el cliente
(UUID) y las escrituras son PUT idempotentes: si el teléfono reintenta un pedido que ya había
llegado, no se duplica nada. Así la app puede guardar sin conexión y mandar todo después.

Montos en centavos (enteros) y fechas ISO, igual que en la base.
"""

import secrets
import sqlite3
from collections.abc import Iterator
from datetime import date
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from . import db, importar, pagina, recurrencias, web
from .config import Config

SIN_ENTRADA = "Falta el token o no es el de este servidor"

TipoMovimiento = Literal["gasto", "ingreso", "transferencia"]
Hora = Field(default=None, pattern=r"^\d{2}:\d{2}$")
Color = Field(default="#3DA5F5", pattern=r"^#[0-9A-Fa-f]{6}$")


class CuentaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    color: str = Color
    saldo_inicial: int = 0


class CategoriaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    tipo: Literal["gasto", "ingreso"]
    color: str = Color
    emoji: str = Field(default="💰", min_length=1, max_length=16)
    presupuesto: int | None = Field(default=None, ge=0)


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
    frecuencia: Literal["semanal", "quincenal", "mensual", "anual"]
    fecha_inicio: date
    fecha_fin: date | None = None


class OrdenIn(BaseModel):
    ids: list[str]


class AjustesIn(BaseModel):
    moneda: str = Field(min_length=1, max_length=4)


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


def leer_todo(con: sqlite3.Connection, hoy: date) -> dict:
    cuentas = [dict(f) for f in con.execute(
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
        "categorias": [dict(f) for f in con.execute("SELECT * FROM categoria ORDER BY tipo, orden, creado")],
        "movimientos": [dict(f) for f in con.execute("SELECT * FROM movimiento ORDER BY fecha DESC, hora DESC, creado DESC")],
        "recurrencias": [dict(f) for f in con.execute("SELECT * FROM recurrencia ORDER BY fecha_inicio")],
        "proximos": recurrencias.proximas(con, hoy),
    }


def create_app(config: Config | None = None, hoy=date.today) -> FastAPI:
    """`hoy` es una función para que las pruebas puedan mover el reloj."""
    config = config or Config.desde_entorno()
    inicial = db.conectar(config.ruta_db)
    try:
        db.inicializar(inicial)
    finally:
        inicial.close()

    app = FastAPI(title="Libro de Gastos", docs_url=None, redoc_url=None)
    app.state.config = config

    def conexion() -> Iterator[sqlite3.Connection]:
        con = db.conectar(config.ruta_db)
        try:
            yield con
        finally:
            con.close()

    def autorizado(
        request: Request,
        authorization: str | None = Header(default=None),
        x_app_web: str | None = Header(default=None),
        sesion: str | None = Cookie(default=None, alias=web.COOKIE),
        t: str | None = None,
    ) -> None:
        esperado = f"Bearer {config.token}"
        if authorization and secrets.compare_digest(authorization.encode(), esperado.encode()):
            return
        if t and secrets.compare_digest(t.encode(), config.token.encode()):
            return
        if web.cookie_valida(sesion, config.token):
            # La cookie va sola en cualquier pedido: para escribir, la web además manda su cabecera.
            if request.method in ("GET", "HEAD") or x_app_web == "1":
                return
        raise HTTPException(401, SIN_ENTRADA)

    r = APIRouter(prefix="/api", dependencies=[Depends(autorizado)])

    @app.get("/", response_class=HTMLResponse)
    def estado(con: sqlite3.Connection = Depends(conexion)):
        conteos = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("cuenta", "movimiento", "recurrencia")}
        return pagina.estado(config, conteos, db.ultimo_respaldo(config.respaldos), web.compilada())

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
                """INSERT INTO cuenta (id, nombre, color, saldo_inicial, orden, creado, actualizado)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, color = excluded.color,
                     saldo_inicial = excluded.saldo_inicial, actualizado = excluded.actualizado""",
                (id_, c.nombre.strip(), c.color, c.saldo_inicial, orden, marca, marca),
            )
        return dict(con.execute("SELECT * FROM cuenta WHERE id = ?", (id_,)).fetchone())

    @r.delete("/cuentas/{id_}")
    def borrar_cuenta(id_: str, con: sqlite3.Connection = Depends(conexion)):
        if con.execute("SELECT COUNT(*) FROM cuenta").fetchone()[0] <= 1:
            raise HTTPException(409, "Es la única cuenta: no se puede borrar")
        usada = con.execute(
            """SELECT EXISTS (SELECT 1 FROM movimiento WHERE cuenta_id = :id OR cuenta_destino_id = :id)
                   OR EXISTS (SELECT 1 FROM recurrencia WHERE cuenta_id = :id OR cuenta_destino_id = :id)""",
            {"id": id_},
        ).fetchone()[0]
        if usada:
            raise HTTPException(409, "La cuenta tiene movimientos o recurrencias: no se puede borrar")
        with con:
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
                """INSERT INTO categoria (id, nombre, tipo, color, emoji, presupuesto, orden, creado, actualizado)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, color = excluded.color,
                     emoji = excluded.emoji, presupuesto = excluded.presupuesto, actualizado = excluded.actualizado""",
                (id_, c.nombre.strip(), c.tipo, c.color, c.emoji, presupuesto, orden, marca, marca),
            )
        return dict(con.execute("SELECT * FROM categoria WHERE id = ?", (id_,)).fetchone())

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
        with con:
            con.execute("INSERT INTO ajuste VALUES ('moneda', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
                        (a.moneda.strip(),))
        return {"moneda": a.moneda.strip()}

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
    web.registrar(app, config)
    return app
