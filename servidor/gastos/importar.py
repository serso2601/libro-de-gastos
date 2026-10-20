"""Importa el respaldo .json de la app vieja (la PWA con todo en localStorage).

La app vieja guardaba los montos como números con decimales, los tipos en inglés y, sobre todo,
creaba las recurrencias de una vez: 12 movimientos con el mismo `recurrenceGroupId`, incluidos los
futuros. Acá cada grupo se convierte en una recurrencia de verdad:

- Los movimientos del grupo con fecha de hoy o anterior se importan tal cual, ligados a la regla.
- Los futuros no se importan: la regla los va a crear cuando llegue su fecha.
- Si el grupo sigue entero hasta su ocurrencia 12, la regla queda abierta (sin fecha de fin). Si el
  usuario lo había cortado ("esta y futuras"), la regla termina en la última que quedó.
- La regla toma monto, cuenta, categoría y nota de la última ocurrencia ya pasada.
"""

import sqlite3
from datetime import date

from . import recurrencias
from .db import ahora

TIPOS = {"expense": "gasto", "income": "ingreso", "transfer": "transferencia"}
FRECUENCIAS = {"weekly": "semanal", "monthly": "mensual"}
OCURRENCIAS_VIEJAS = 12


class ErrorDeImportacion(ValueError):
    pass


def centavos(valor) -> int:
    return round(float(valor or 0) * 100)


def _indice(tx: dict) -> int | None:
    """La app vieja nombraba las ocurrencias `<grupo>-<n>`."""
    sufijo = str(tx.get("id", "")).rsplit("-", 1)[-1]
    return int(sufijo) if sufijo.isdigit() else None


def _movimiento(tx: dict, marca: str, recurrencia_id: str | None = None) -> tuple:
    tipo = TIPOS[tx["kind"]]
    if tipo == "transferencia":
        cuenta, destino, categoria = tx.get("fromAccountId"), tx.get("toAccountId"), None
    else:
        cuenta, destino, categoria = tx.get("accountId"), None, tx.get("categoryId")
    return (str(tx["id"]), tipo, centavos(tx["amount"]), tx["date"], tx.get("time") or None, cuenta, destino,
            categoria, (tx.get("note") or "").strip(), recurrencia_id, "importado", marca, marca)


def importar(con: sqlite3.Connection, datos: dict, hoy: date | None = None, simular: bool = False) -> dict:
    hoy = hoy or date.today()
    if not isinstance(datos, dict) or not isinstance(datos.get("transactions"), list):
        raise ErrorDeImportacion("No parece un respaldo de la app vieja: falta la lista de movimientos")
    if con.execute("SELECT EXISTS (SELECT 1 FROM movimiento)").fetchone()[0]:
        raise ErrorDeImportacion("La base ya tiene movimientos: la importación es solo para empezar")

    marca = ahora()
    cuentas = datos.get("accounts") or []
    categorias = datos.get("categories") or []
    presupuestos = datos.get("budgets") or {}
    transacciones = [t for t in datos["transactions"] if t.get("kind") in TIPOS and centavos(t.get("amount")) > 0]
    ids_cuentas = {str(c["id"]) for c in cuentas}
    ids_categorias = {str(c["id"]) for c in categorias}

    filas_cuentas = [
        (str(c["id"]), (c.get("name") or "Cuenta").strip(), c.get("color") or "#3DA5F5",
         centavos(c.get("initialBalance")), i, marca, marca)
        for i, c in enumerate(cuentas)
    ]
    filas_categorias = []
    for i, c in enumerate(categorias):
        tipo = "ingreso" if c.get("type") == "income" else "gasto"
        presupuesto = centavos(presupuestos.get(c["id"])) if tipo == "gasto" and presupuestos.get(c["id"]) else None
        filas_categorias.append((str(c["id"]), (c.get("name") or "Categoría").strip(), tipo, c.get("color") or "#3DA5F5",
                                 c.get("emoji") or "💰", presupuesto, i, marca, marca))

    # Movimientos que apuntan a una categoría o cuenta que ya no existe: se cuelgan de una de rescate.
    huerfanas = {t["kind"] for t in transacciones if t["kind"] != "transfer" and str(t.get("categoryId")) not in ids_categorias}
    for kind in sorted(huerfanas):
        tipo = TIPOS[kind]
        filas_categorias.append((f"sin-categoria-{tipo}", "Sin categoría", tipo, "#94A3B8", "❔", None,
                                 len(filas_categorias), marca, marca))
    cuentas_usadas = {t.get(k) for t in transacciones for k in ("accountId", "fromAccountId", "toAccountId") if t.get(k)}
    if cuentas_usadas - ids_cuentas or not cuentas:
        filas_cuentas.append(("cuenta-rescatada", "Cuenta rescatada", "#94A3B8", 0, len(filas_cuentas), marca, marca))

    def arreglar(tx: dict) -> dict:
        tx = dict(tx)
        for k in ("accountId", "fromAccountId", "toAccountId"):
            if k in tx and tx[k] is not None and str(tx[k]) not in ids_cuentas:
                tx[k] = "cuenta-rescatada"
        if tx["kind"] != "transfer" and str(tx.get("categoryId")) not in ids_categorias:
            tx["categoryId"] = f"sin-categoria-{TIPOS[tx['kind']]}"
        return tx

    transacciones = [arreglar(t) for t in transacciones]
    sueltas = [t for t in transacciones if not t.get("recurrenceGroupId")]
    grupos: dict[str, list[dict]] = {}
    for t in transacciones:
        if t.get("recurrenceGroupId"):
            grupos.setdefault(t["recurrenceGroupId"], []).append(t)

    filas_movimientos = [_movimiento(t, marca) for t in sueltas]
    filas_recurrencias = []
    futuras_descartadas = 0
    for grupo_id, items in grupos.items():
        items.sort(key=lambda t: t["date"])
        frecuencia = FRECUENCIAS.get(items[0].get("recurrence"), "mensual")
        inicio = date.fromisoformat(items[0]["date"])
        pasadas = [t for t in items if date.fromisoformat(t["date"]) <= hoy]
        futuras_descartadas += len(items) - len(pasadas)
        modelo = pasadas[-1] if pasadas else items[0]
        indices = [i for i in map(_indice, items) if i is not None]
        cortada = indices and max(indices) < OCURRENCIAS_VIEJAS - 1
        fecha_fin = items[-1]["date"] if cortada else None
        generada = recurrencias.ultima_hasta(inicio, frecuencia, min(hoy, date.fromisoformat(fecha_fin)) if fecha_fin else hoy)
        m = _movimiento(modelo, marca)
        filas_recurrencias.append((grupo_id, m[1], m[2], m[5], m[6], m[7], m[8], frecuencia, inicio.isoformat(),
                                   fecha_fin, generada.isoformat() if generada else None, marca, marca))
        filas_movimientos += [_movimiento(t, marca, grupo_id) for t in pasadas]

    resumen = {
        "cuentas": len(filas_cuentas),
        "categorias": len(filas_categorias),
        "movimientos": len(filas_movimientos),
        "recurrencias": len(filas_recurrencias),
        "recurrencias_abiertas": sum(1 for r in filas_recurrencias if r[9] is None),
        "futuras_descartadas": futuras_descartadas,
        "moneda": datos.get("currency") or "$",
    }
    if simular:
        return resumen

    with con:
        con.execute("DELETE FROM recurrencia")
        con.execute("DELETE FROM categoria")
        con.execute("DELETE FROM cuenta")
        con.executemany("INSERT INTO cuenta (id, nombre, color, saldo_inicial, orden, creado, actualizado) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)", filas_cuentas)
        con.executemany("INSERT INTO categoria (id, nombre, tipo, color, emoji, presupuesto, orden, creado, actualizado) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", filas_categorias)
        con.executemany(
            """INSERT INTO recurrencia (id, tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, nota, frecuencia,
               fecha_inicio, fecha_fin, generada_hasta, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            filas_recurrencias,
        )
        con.executemany(
            """INSERT INTO movimiento (id, tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota,
               recurrencia_id, origen, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            filas_movimientos,
        )
        con.execute("INSERT INTO ajuste VALUES ('moneda', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
                    (resumen["moneda"],))
    return resumen
