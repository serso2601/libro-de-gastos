"""Las recurrencias: cuándo toca cada una y cómo se convierten en movimientos.

Una recurrencia es una regla ("cada mes, $25 de Netflix, desde el 3 de enero"). Nada se crea por
adelantado: `materializar` crea los movimientos cuya fecha ya llegó y anota la última en
`generada_hasta`, así que correrla dos veces no duplica nada, y una ocurrencia que el usuario borró
no vuelve. Lo que viene se muestra con `proximas`, que solo calcula y no guarda.

Las fechas mensuales se cuentan siempre desde la fecha de inicio: algo que empieza el 31 cae el 30
en los meses de 30 días y el 28 (o 29) en febrero, y vuelve al 31 en marzo.
"""

import calendar
import sqlite3
from collections.abc import Iterator
from datetime import date, timedelta

from .db import ahora

FRECUENCIAS = ("semanal", "quincenal", "mensual", "anual")

# Tope de seguridad: una recurrencia semanal de 20 años son ~1000 ocurrencias.
MAXIMO_OCURRENCIAS = 5000


def sumar_meses(d: date, n: int) -> date:
    indice = d.month - 1 + n
    anio, mes = d.year + indice // 12, indice % 12 + 1
    return date(anio, mes, min(d.day, calendar.monthrange(anio, mes)[1]))


def ocurrencia(inicio: date, frecuencia: str, n: int) -> date:
    match frecuencia:
        case "semanal":
            return inicio + timedelta(weeks=n)
        case "quincenal":
            return inicio + timedelta(weeks=2 * n)
        case "mensual":
            return sumar_meses(inicio, n)
        case "anual":
            return sumar_meses(inicio, 12 * n)
    raise ValueError(f"frecuencia desconocida: {frecuencia}")


def fechas(inicio: date, frecuencia: str, despues_de: date | None, hasta: date) -> Iterator[date]:
    """Las ocurrencias en (despues_de, hasta], en orden."""
    for n in range(MAXIMO_OCURRENCIAS):
        f = ocurrencia(inicio, frecuencia, n)
        if f > hasta:
            return
        if despues_de is None or f > despues_de:
            yield f


def _limite(fila: sqlite3.Row, hasta: date) -> date:
    return min(hasta, date.fromisoformat(fila["fecha_fin"])) if fila["fecha_fin"] else hasta


def _desde(fila: sqlite3.Row) -> date | None:
    return date.fromisoformat(fila["generada_hasta"]) if fila["generada_hasta"] else None


def materializar(con: sqlite3.Connection, hoy: date | None = None) -> int:
    """Crea los movimientos de todas las recurrencias hasta `hoy` (incluido). Devuelve cuántos."""
    hoy = hoy or date.today()
    creados = 0
    with con:
        for r in con.execute("SELECT * FROM recurrencia").fetchall():
            nuevas = list(fechas(date.fromisoformat(r["fecha_inicio"]), r["frecuencia"], _desde(r), _limite(r, hoy)))
            if not nuevas:
                continue
            marca = ahora()
            for f in nuevas:
                cursor = con.execute(
                    """INSERT OR IGNORE INTO movimiento
                       (id, tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota,
                        recurrencia_id, origen, creado, actualizado)
                       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'recurrencia', ?, ?)""",
                    (f"{r['id']}@{f.isoformat()}", r["tipo"], r["monto"], f.isoformat(), r["cuenta_id"],
                     r["cuenta_destino_id"], r["categoria_id"], r["nota"], r["id"], marca, marca),
                )
                creados += cursor.rowcount
            con.execute("UPDATE recurrencia SET generada_hasta = ? WHERE id = ?", (nuevas[-1].isoformat(), r["id"]))
    return creados


def proximas(con: sqlite3.Connection, hoy: date | None = None, dias: int = 45) -> list[dict]:
    """Lo que las recurrencias van a crear en los próximos `dias` días, sin guardarlo."""
    hoy = hoy or date.today()
    hasta = hoy + timedelta(days=dias)
    salida = []
    for r in con.execute("SELECT * FROM recurrencia").fetchall():
        desde = max(filter(None, [_desde(r), hoy]))
        for f in fechas(date.fromisoformat(r["fecha_inicio"]), r["frecuencia"], desde, _limite(r, hasta)):
            salida.append({
                "recurrencia_id": r["id"], "fecha": f.isoformat(), "tipo": r["tipo"], "monto": r["monto"],
                "cuenta_id": r["cuenta_id"], "cuenta_destino_id": r["cuenta_destino_id"],
                "categoria_id": r["categoria_id"], "nota": r["nota"],
            })
    return sorted(salida, key=lambda p: p["fecha"])


def ultima_hasta(inicio: date, frecuencia: str, hasta: date) -> date | None:
    """La última ocurrencia que cae en `hasta` o antes (None si todavía no empezó)."""
    ultima = None
    for ultima in fechas(inicio, frecuencia, None, hasta):
        pass
    return ultima
