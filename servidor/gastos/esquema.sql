-- Esquema del Libro de Gastos (versión 4).
--
-- Los montos son enteros en centavos: $12,50 se guarda como 1250. Las fechas son texto ISO
-- ('2026-10-16'), las horas 'HH:MM' y las marcas de tiempo ISO con segundos.
-- El saldo de una cuenta no se guarda: sale de saldo_inicial más sus movimientos.

CREATE TABLE IF NOT EXISTS cuenta (
    id              TEXT PRIMARY KEY,
    nombre          TEXT NOT NULL,
    color           TEXT NOT NULL DEFAULT '#3DA5F5',
    saldo_inicial   INTEGER NOT NULL DEFAULT 0,
    orden           INTEGER NOT NULL DEFAULT 0,
    creado          TEXT NOT NULL,
    actualizado     TEXT NOT NULL,
    -- Tarjeta de crédito: el día de corte es obligatorio; el día de pago y el pago mínimo (centavos)
    -- los copia el usuario de su estado de cuenta, la app no los calcula.
    es_credito      INTEGER NOT NULL DEFAULT 0 CHECK (es_credito IN (0, 1)),
    dia_corte       INTEGER CHECK (dia_corte BETWEEN 1 AND 31),
    dia_pago        INTEGER CHECK (dia_pago BETWEEN 1 AND 31),
    pago_minimo     INTEGER CHECK (pago_minimo >= 0)
);

CREATE TABLE IF NOT EXISTS categoria (
    id              TEXT PRIMARY KEY,
    nombre          TEXT NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
    color           TEXT NOT NULL DEFAULT '#3DA5F5',
    emoji           TEXT NOT NULL DEFAULT '💰',  -- un emoji o un símbolo de la app: 'i:<clave>'
    presupuesto     INTEGER CHECK (presupuesto IS NULL OR presupuesto >= 0),  -- por periodo del presupuesto (ajuste), solo gastos
    orden           INTEGER NOT NULL DEFAULT 0,
    creado          TEXT NOT NULL,
    actualizado     TEXT NOT NULL,
    -- Pasar lo que sobra: con `acumula`, lo que no se gastó de un periodo se suma al siguiente,
    -- contando desde el inicio del periodo `acumula_desde` (fecha ISO; la manda la app al activarlo).
    acumula         INTEGER NOT NULL DEFAULT 0 CHECK (acumula IN (0, 1)),
    acumula_desde   TEXT
);

-- Una regla que se repite. No genera nada por adelantado: el servidor crea cada movimiento cuando
-- llega su fecha (ver recurrencias.materializar) y anota hasta dónde llegó en generada_hasta.
-- catorcenal = cada 14 días; quincenal = dos veces al mes (el día de inicio y 15 días después).
CREATE TABLE IF NOT EXISTS recurrencia (
    id                  TEXT PRIMARY KEY,
    tipo                TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso', 'transferencia')),
    monto               INTEGER NOT NULL CHECK (monto > 0),
    cuenta_id           TEXT NOT NULL REFERENCES cuenta(id),
    cuenta_destino_id   TEXT REFERENCES cuenta(id),
    categoria_id        TEXT REFERENCES categoria(id),
    nota                TEXT NOT NULL DEFAULT '',
    frecuencia          TEXT NOT NULL CHECK (frecuencia IN ('semanal', 'catorcenal', 'quincenal', 'mensual', 'anual')),
    fecha_inicio        TEXT NOT NULL,
    fecha_fin           TEXT,
    generada_hasta      TEXT,
    creado              TEXT NOT NULL,
    actualizado         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movimiento (
    id                  TEXT PRIMARY KEY,
    tipo                TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso', 'transferencia')),
    monto               INTEGER NOT NULL CHECK (monto > 0),
    fecha               TEXT NOT NULL,
    hora                TEXT,
    cuenta_id           TEXT NOT NULL REFERENCES cuenta(id),
    cuenta_destino_id   TEXT REFERENCES cuenta(id),
    categoria_id        TEXT REFERENCES categoria(id),
    nota                TEXT NOT NULL DEFAULT '',
    recurrencia_id      TEXT REFERENCES recurrencia(id) ON DELETE SET NULL,
    origen              TEXT NOT NULL DEFAULT 'manual',  -- manual · recurrencia · importado
    creado              TEXT NOT NULL,
    actualizado         TEXT NOT NULL,
    CHECK ((tipo = 'transferencia') = (cuenta_destino_id IS NOT NULL)),
    CHECK (tipo = 'transferencia' OR categoria_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS movimiento_fecha ON movimiento (fecha);
CREATE INDEX IF NOT EXISTS movimiento_recurrencia ON movimiento (recurrencia_id);

-- Claves: `moneda`; `presupuesto_periodo` (semanal · catorcenal · quincenal · mensual) y
-- `presupuesto_inicio` (semanal: día de la semana '0'..'6', 0 = domingo; catorcenal: una fecha ISO
-- en que empieza un periodo; quincenal: ''; mensual: día del mes '1'..'28').
CREATE TABLE IF NOT EXISTS ajuste (
    clave   TEXT PRIMARY KEY,
    valor   TEXT NOT NULL
);
