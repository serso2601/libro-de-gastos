from datetime import date

from gastos.recurrencias import fechas, ocurrencia, sumar_meses, ultima_hasta


def test_mensual_desde_el_31_no_se_corre():
    inicio = date(2026, 1, 31)
    assert [ocurrencia(inicio, "mensual", n) for n in range(4)] == [
        date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30),
    ]


def test_anual_desde_el_29_de_febrero():
    assert ocurrencia(date(2028, 2, 29), "anual", 1) == date(2029, 2, 28)
    assert ocurrencia(date(2028, 2, 29), "anual", 4) == date(2032, 2, 29)


def test_semanal_y_catorcenal():
    inicio = date(2026, 10, 1)
    assert ocurrencia(inicio, "semanal", 2) == date(2026, 10, 15)
    assert ocurrencia(inicio, "catorcenal", 2) == date(2026, 10, 29)


def test_quincenal_dos_veces_al_mes():
    assert [ocurrencia(date(2026, 1, 15), "quincenal", n) for n in range(5)] == [
        date(2026, 1, 15), date(2026, 1, 30), date(2026, 2, 15), date(2026, 2, 28), date(2026, 3, 15),
    ]
    assert [ocurrencia(date(2026, 10, 30), "quincenal", n) for n in range(4)] == [
        date(2026, 10, 30), date(2026, 11, 15), date(2026, 11, 30), date(2026, 12, 15),
    ]
    assert [ocurrencia(date(2026, 12, 1), "quincenal", n) for n in range(3)] == [
        date(2026, 12, 1), date(2026, 12, 16), date(2027, 1, 1),
    ]


def test_fechas_respeta_el_rango():
    inicio = date(2026, 1, 5)
    assert list(fechas(inicio, "mensual", date(2026, 2, 5), date(2026, 4, 5))) == [date(2026, 3, 5), date(2026, 4, 5)]
    assert list(fechas(inicio, "mensual", None, date(2026, 1, 4))) == []


def test_ultima_hasta():
    assert ultima_hasta(date(2026, 1, 5), "mensual", date(2026, 3, 20)) == date(2026, 3, 5)
    assert ultima_hasta(date(2026, 1, 5), "mensual", date(2026, 1, 1)) is None


def test_sumar_meses_cruza_el_anio():
    assert sumar_meses(date(2026, 11, 30), 3) == date(2027, 2, 28)
