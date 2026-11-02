-- Esquema del Libro de Gastos (versión 5).
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
    pago_minimo     INTEGER CHECK (pago_minimo >= 0),
    -- Vínculo con el catálogo de bancos (bancos.json), en JSON, o NULL; y los últimos 4 dígitos de
    -- su tarjeta, con los que se reconoce de qué cuenta es un aviso del banco.
    banco           TEXT,
    terminacion     TEXT
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
    origen              TEXT NOT NULL DEFAULT 'manual',  -- manual · recurrencia · importado · correo · yappy · wallet
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

-- La bandeja de avisos del banco (correo o atajo del iPhone). Todo aviso leído deja una fila, aunque
-- no sea un movimiento (`ignorado`) o ya estuviera anotado (`duplicado`), para no volver a leerlo
-- (`clave` = Message-ID). `nuevo` = espera que el usuario lo revise en la app; `agregado` = entró solo.
CREATE TABLE IF NOT EXISTS pendiente (
    id            TEXT PRIMARY KEY,
    origen        TEXT NOT NULL,                 -- correo · yappy · wallet · atajo
    clave         TEXT UNIQUE,                   -- Message-ID del correo: no se lee dos veces
    recibido      TEXT NOT NULL,                 -- marca de tiempo ISO
    remitente     TEXT NOT NULL DEFAULT '',
    asunto        TEXT NOT NULL DEFAULT '',
    texto         TEXT NOT NULL DEFAULT '',      -- extracto del aviso (máx. ~1500 caracteres)
    tipo          TEXT CHECK (tipo IN ('gasto', 'ingreso')),
    monto         INTEGER,                       -- centavos
    fecha         TEXT,
    hora          TEXT,
    comercio      TEXT NOT NULL DEFAULT '',
    categoria_id  TEXT,
    cuenta_id     TEXT,
    terminacion   TEXT,
    contraparte   TEXT,                          -- Yappy: la persona o comercio solo
    referencia    TEXT,                          -- Yappy: código de confirmación (no entra dos veces)
    estado        TEXT NOT NULL DEFAULT 'nuevo'
                  CHECK (estado IN ('nuevo', 'agregado', 'aceptado', 'descartado', 'duplicado', 'ignorado')),
    movimiento_id TEXT,
    motivo        TEXT NOT NULL DEFAULT '',      -- por qué quedó para revisar (texto corto para el usuario)
    creado        TEXT NOT NULL,
    actualizado   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS pendiente_referencia ON pendiente (origen, referencia) WHERE referencia IS NOT NULL;
