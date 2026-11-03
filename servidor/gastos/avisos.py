"""El aviso de pagos de tarjeta que lee un Atajo del iPhone una vez al día (`GET /api/avisos/pagos`).

Devuelve un texto corto solo los días en que conviene acordarse: 3 días antes de la fecha de pago, la víspera
y el mismo día, mientras no esté pagado el mínimo (o, sin mínimo conocido, mientras no haya ningún pago desde
el corte). Los demás días devuelve vacío y el Atajo no muestra nada. Es la misma cuenta que hace la app
(`calculos.estadoTarjeta`/`pagoSugerido`): el ciclo, lo que se debía al corte y el mínimo.
"""

import calendar
import json
import sqlite3
from datetime import date, timedelta

AVISAR_A = (3, 1, 0)  # días que faltan para la fecha de pago en que se avisa
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _dia_del_mes(anio: int, mes: int, dia: int) -> date:
    """El día `dia` de un mes (mes puede pasarse de 1–12), o el último si el mes es más corto."""
    anio, mes = anio + (mes - 1) // 12, (mes - 1) % 12 + 1
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


def ciclo(dia_corte: int, dia_pago: int | None, dias_para_pagar: int | None, hoy: date) -> tuple[date, date | None]:
    """El último corte que ya pasó (el de hoy, si hoy no es día de corte) y la fecha de pago que le sigue."""
    proximo = _dia_del_mes(hoy.year, hoy.month, dia_corte)
    if proximo < hoy:
        proximo = _dia_del_mes(hoy.year, hoy.month + 1, dia_corte)
    anterior = _dia_del_mes(proximo.year, proximo.month - 1, dia_corte)
    if dia_pago:
        pago = _dia_del_mes(anterior.year, anterior.month, dia_pago)
        if pago <= anterior:
            pago = _dia_del_mes(anterior.year, anterior.month + 1, dia_pago)
        return anterior, pago
    return anterior, (anterior + timedelta(days=dias_para_pagar)) if dias_para_pagar else None


def _reglas(catalogo: dict, banco: dict | None, hoy: date) -> dict | None:
    """La versión vigente de la tarjeta del catálogo a la que está vinculada la cuenta, o None."""
    if not banco or not banco.get("tarjeta"):
        return None
    for b in catalogo["bancos"]:
        if b["id"] != banco.get("banco"):
            continue
        for t in b["tarjetas"]:
            if t["id"] == banco["tarjeta"]:
                versiones = sorted(t["versiones"], key=lambda v: v["vigente_desde"])
                elegida = versiones[0]
                for v in versiones:
                    if v["vigente_desde"] <= hoy.isoformat():
                        elegida = v
                return elegida
    return None


def minimo(al_corte: int, limite: int | None, reglas: dict | None, pago_minimo: int | None,
           minimo_corte: str | None, corte: date) -> int | None:
    """El pago mínimo de ese corte: el que el usuario corrigió para él, el de las reglas del banco o el copiado."""
    if pago_minimo and minimo_corte == corte.isoformat():
        return pago_minimo
    if reglas and reglas.get("pago_minimo"):
        regla = reglas["pago_minimo"]
        exceso = max(0, al_corte - limite) if limite else 0
        return min(al_corte, max(round(al_corte * regla["porcentaje"] / 100), regla["minimo"]) + exceso)
    return pago_minimo or None


def _dinero(centavos: int) -> str:
    return f"${centavos / 100:,.2f}"


def texto_de_pagos(con: sqlite3.Connection, catalogo: dict, hoy: date) -> str:
    """Una línea por tarjeta que toca recordar hoy; vacío si ninguna.

    La deuda al corte parte de lo que se debía al crear la tarjeta (-saldo_inicial) más lo anotado hasta el corte;
    si el corte es el `corte_inicial` de la tarjeta, parte de `deuda_al_corte` (el estado de cuenta) y a lo pagado
    se suman los `pagos_tras_corte`, porque el saldo inicial ya traía lo hecho efectivo después del corte.
    """
    lineas = []
    for c in con.execute("SELECT * FROM cuenta WHERE es_credito = 1 AND dia_corte IS NOT NULL ORDER BY orden, creado"):
        banco = json.loads(c["banco"]) if c["banco"] else None
        reglas = _reglas(catalogo, banco, hoy)
        corte, pago = ciclo(c["dia_corte"], c["dia_pago"], (reglas or {}).get("dias_para_pagar"), hoy)
        if pago is None:
            continue
        faltan = (pago - hoy).days
        if faltan not in AVISAR_A:
            continue
        # Lo que se debía al cerrar el día del corte: la deuda de partida con lo anotado hasta ese día. La deuda de
        # partida es la de hoy (-saldo_inicial) o, si el corte es el inicial de la tarjeta, la de su estado de cuenta.
        al_corte_inicial = c["corte_inicial"] == corte.isoformat() and c["deuda_al_corte"] is not None
        efecto = con.execute(
            """SELECT COALESCE(SUM(CASE WHEN cuenta_id = :id AND tipo = 'ingreso' THEN monto
                                        WHEN cuenta_id = :id THEN -monto ELSE 0 END), 0)
                    + COALESCE(SUM(CASE WHEN cuenta_destino_id = :id THEN monto ELSE 0 END), 0)
               FROM movimiento WHERE fecha <= :corte AND (cuenta_id = :id OR cuenta_destino_id = :id)""",
            {"id": c["id"], "corte": corte.isoformat()}).fetchone()[0]
        al_corte = max(0, (c["deuda_al_corte"] if al_corte_inicial else -c["saldo_inicial"]) - efecto)
        if al_corte <= 0:
            continue
        pagado = con.execute(
            # Todo dinero que entra a la tarjeta es pago: la transferencia hacia ella o un «ingreso» anotado en ella.
            """SELECT COALESCE(SUM(monto), 0) FROM movimiento WHERE fecha > :corte
                 AND ((tipo = 'transferencia' AND cuenta_destino_id = :id) OR (tipo = 'ingreso' AND cuenta_id = :id))""",
            {"id": c["id"], "corte": corte.isoformat()}).fetchone()[0]
        if al_corte_inicial:
            pagado += c["pagos_tras_corte"] or 0
        m = minimo(al_corte, c["limite"], reglas, c["pago_minimo"], c["minimo_corte"], corte)
        if (m is not None and pagado >= m) or (m is None and pagado > 0) or pagado >= al_corte:
            continue
        cuando = "hoy" if faltan == 0 else "mañana" if faltan == 1 else f"el {pago.day} {MESES[pago.month - 1]}"
        detalle = f"mínimo {_dinero(max(0, m - pagado))}, " if m else ""
        lineas.append(f"{c['nombre']}: paga {cuando} ({detalle}del corte {_dinero(al_corte - pagado)}).")
    if not lineas:
        return ""
    return "\n".join(lineas) + "\nSi ya pagaste, anótalo en la app como pago de la tarjeta."
