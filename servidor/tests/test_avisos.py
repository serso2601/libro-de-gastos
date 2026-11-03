from datetime import date

import pytest

from gastos import avisos

VISA = {"nombre": "Visa Estrellas", "es_credito": True, "dia_corte": 18, "saldo_inicial": -80000, "limite": 100000,
        "banco": {"banco": "bg", "tarjeta": "bg-credito-estrellas-classic"}}


@pytest.fixture
def visa(cliente):
    assert cliente.put("/api/cuentas/visa", json=VISA).status_code == 200
    return cliente


def aviso(cliente, reloj, dia: date) -> str:
    reloj.dia = dia
    r = cliente.get("/api/avisos/pagos")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    return r.text


def test_avisa_tres_dias_antes_la_vispera_y_el_dia(visa, reloj):
    # Corte el 18 de octubre + 28 días (Banco General) = paga el 15 de noviembre; mínimo 3% de $800 = $24.
    assert aviso(visa, reloj, date(2026, 11, 12)) == (
        "Visa Estrellas: paga el 15 nov (mínimo $24.00, del corte $800.00).\n"
        "Si ya pagaste, anótalo en la app como pago de la tarjeta.")
    assert aviso(visa, reloj, date(2026, 11, 13)) == ""
    assert "paga mañana" in aviso(visa, reloj, date(2026, 11, 14))
    assert "paga hoy" in aviso(visa, reloj, date(2026, 11, 15))
    assert aviso(visa, reloj, date(2026, 11, 16)) == ""


def test_deuda_al_corte_inicial_separa_lo_posterior_al_corte(cliente, reloj):
    tarjeta = {**VISA, "limite": 500000, "saldo_inicial": -228643, "corte_inicial": "2026-10-18", "deuda_al_corte": 200000, "pagos_tras_corte": 0}
    cliente.put("/api/cuentas/visa", json=tarjeta)
    assert "(mínimo $60.00, del corte $2,000.00)" in aviso(cliente, reloj, date(2026, 11, 12))
    cliente.put("/api/cuentas/visa", json={**tarjeta, "pagos_tras_corte": 1000})
    assert "(mínimo $50.00, del corte $1,990.00)" in aviso(cliente, reloj, date(2026, 11, 12))
    # El corte siguiente (18 nov, paga el 16 dic) usa la deuda completa.
    assert "(mínimo $68.59, del corte $2,286.43)" in aviso(cliente, reloj, date(2026, 12, 13))


def test_no_avisa_si_ya_pago_el_minimo(visa, reloj):
    visa.put("/api/movimientos/p1", json={"tipo": "transferencia", "monto": 1000, "fecha": "2026-11-01",
                                          "cuenta_id": "efectivo", "cuenta_destino_id": "visa"})
    assert "mínimo $14.00" in aviso(visa, reloj, date(2026, 11, 14))  # pagó $10 de $24
    visa.put("/api/movimientos/p2", json={"tipo": "transferencia", "monto": 1400, "fecha": "2026-11-02",
                                          "cuenta_id": "efectivo", "cuenta_destino_id": "visa"})
    assert aviso(visa, reloj, date(2026, 11, 14)) == ""


def test_el_minimo_corregido_vale_solo_para_su_corte(visa, reloj):
    visa.put("/api/cuentas/visa", json={**VISA, "pago_minimo": 5000, "minimo_corte": "2026-10-18"})
    assert "mínimo $50.00" in aviso(visa, reloj, date(2026, 11, 15))
    # El corte siguiente (18 nov, paga el 16 dic) vuelve a la regla del banco.
    assert "mínimo $24.00" in aviso(visa, reloj, date(2026, 12, 16))


def test_sin_fecha_de_pago_ni_deuda_al_corte_no_avisa(cliente, reloj):
    cliente.put("/api/cuentas/suelta", json={"nombre": "Suelta", "es_credito": True, "dia_corte": 18, "saldo_inicial": -5000})
    assert aviso(cliente, reloj, date(2026, 11, 15)) == ""  # sin día de pago ni banco: no se sabe cuándo
    cliente.put("/api/cuentas/suelta", json={"nombre": "Suelta", "es_credito": True, "dia_corte": 18, "dia_pago": 15})
    assert aviso(cliente, reloj, date(2026, 11, 15)) == ""  # no debía nada al corte


def test_ciclo_con_dia_de_pago_y_con_dias_para_pagar():
    assert avisos.ciclo(18, None, 28, date(2026, 11, 2)) == (date(2026, 10, 18), date(2026, 11, 15))
    assert avisos.ciclo(18, 10, None, date(2026, 11, 2)) == (date(2026, 10, 18), date(2026, 11, 10))
    assert avisos.ciclo(31, None, 28, date(2026, 11, 2)) == (date(2026, 10, 31), date(2026, 11, 28))
    assert avisos.ciclo(18, None, None, date(2026, 11, 2)) == (date(2026, 10, 18), None)


def test_minimo_con_exceso_del_limite_y_piso():
    reglas = {"pago_minimo": {"porcentaje": 3, "minimo": 2000}}
    corte = date(2026, 10, 18)
    assert avisos.minimo(30000, None, reglas, None, None, corte) == 2000  # 3% de $300 = $9 → piso $20
    assert avisos.minimo(1500, None, reglas, None, None, corte) == 1500  # nunca más de lo que se debe
    assert avisos.minimo(103000, 100000, reglas, None, None, corte) == 3090 + 3000  # más lo que pasa del límite
    assert avisos.minimo(80000, None, reglas, 5000, "2026-09-18", corte) == 2400  # corregido para otro corte
    assert avisos.minimo(80000, None, None, 4500, None, corte) == 4500  # sin reglas: el copiado


def test_un_ingreso_en_la_tarjeta_tambien_cuenta_como_pago(visa, reloj):
    visa.put("/api/movimientos/i1", json={"tipo": "ingreso", "monto": 2400, "fecha": "2026-11-01",
                                          "cuenta_id": "visa", "categoria_id": "otros-ingresos"})
    assert aviso(visa, reloj, date(2026, 11, 14)) == ""


def test_el_minimo_confirmado_del_corte_manda(visa, reloj):
    visa.put("/api/cuentas/visa/cortes/2026-10-18", json={"minimo": 3000, "dias": 2})
    assert "mínimo $30.00" in aviso(visa, reloj, date(2026, 11, 14))
    visa.put("/api/movimientos/p1", json={"tipo": "transferencia", "monto": 3000, "fecha": "2026-11-01",
                                          "cuenta_id": "efectivo", "cuenta_destino_id": "visa"})
    assert aviso(visa, reloj, date(2026, 11, 14)) == ""
