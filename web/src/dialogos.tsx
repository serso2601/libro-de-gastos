import { useState } from 'react';
import { useAcciones } from './acciones';
import { useDatos } from './datos';
import { aCentavos, aTexto, etiquetaCorta, nuevoId } from './formato';
import { FRECUENCIAS, type Categoria, type Cuenta, type Frecuencia, type Movimiento, type Recurrencia, type TipoCategoria, type TipoMovimiento } from './tipos';
import { BotonPrincipal, C, CampoMonto, Colores, Etiqueta, Modal, PALETA, Selector, estiloCampo } from './ui';

const TIPOS: [TipoMovimiento, string][] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];
const COLORES_TIPO = { gasto: C.alerta, ingreso: C.bien, transferencia: C.acento };

function Error({ texto }: { texto: string }) {
  return texto ? <p className="text-xs mb-3" style={{ color: C.alerta }}>{texto}</p> : null;
}

function ElegirCuenta({ valor, alCambiar, cuentas }: { valor: string; alCambiar: (v: string) => void; cuentas: Cuenta[] }) {
  return (
    <select value={valor} onChange={(e) => alCambiar(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none text-sm" style={estiloCampo}>
      {cuentas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
    </select>
  );
}

function ElegirCategoria({ tipo, valor, alCambiar }: { tipo: TipoCategoria; valor: string; alCambiar: (id: string) => void }) {
  const { categorias } = useDatos();
  const { guardarCategoria } = useAcciones();
  const [nueva, setNueva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [color, setColor] = useState(PALETA[0]);
  const disponibles = categorias.filter((c) => c.tipo === tipo);

  function crear() {
    if (!nombre.trim()) return;
    const c: Categoria = { id: nuevoId(), nombre: nombre.trim(), tipo, color, emoji: emoji || '💰', presupuesto: null, orden: 999 };
    guardarCategoria(c);
    alCambiar(c.id);
    setNueva(false);
    setNombre('');
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <Etiqueta>Categoría</Etiqueta>
        <button type="button" onClick={() => setNueva((v) => !v)} className="text-xs font-medium" style={{ color: C.acento }}>+ nueva</button>
      </div>
      {nueva && (
        <div className="rounded-xl p-3 mb-3" style={estiloCampo}>
          <div className="flex gap-2 mb-2">
            <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-12 text-center rounded-lg py-2 outline-none bg-transparent" style={{ border: `1px solid ${C.linea}` }} />
            <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2.5 outline-none text-sm bg-transparent" style={{ border: `1px solid ${C.linea}`, color: C.tinta }} />
          </div>
          <Colores valor={color} alCambiar={setColor} />
          <button type="button" onClick={crear} className="w-full rounded-lg py-2 text-xs font-medium" style={{ background: C.acento, color: C.sobreAcento }}>Crear categoría</button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {disponibles.map((c) => {
          const activa = valor === c.id;
          return (
            <button key={c.id} type="button" onClick={() => alCambiar(c.id)} className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
              style={{ border: `1px solid ${activa ? c.color : C.linea}`, background: activa ? `${c.color}1F` : 'transparent' }}>
              <span className="text-base">{c.emoji}</span>
              <span className="leading-tight px-0.5" style={{ fontSize: 10, color: activa ? c.color : C.tenue }}>{c.nombre}</span>
            </button>
          );
        })}
        {disponibles.length === 0 && <p className="col-span-4 text-xs" style={{ color: C.tenue }}>No hay categorías de {tipo}s todavía. Crea una arriba.</p>}
      </div>
    </>
  );
}

type Repetir = 'no' | Frecuencia;

/** Crear o editar un gasto, ingreso o transferencia. Al crear se puede volver una recurrencia. */
export function DialogoMovimiento({ inicial, tipoInicial = 'gasto', alCerrar, alEditarRegla }: {
  inicial?: Movimiento; tipoInicial?: TipoMovimiento; alCerrar: () => void; alEditarRegla: (r: Recurrencia) => void;
}) {
  const { cuentas, categorias, moneda, hoy, recurrencias } = useDatos();
  const acciones = useAcciones();
  const editando = !!inicial;
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? tipoInicial);
  const [monto, setMonto] = useState(inicial ? aTexto(inicial.monto) : '');
  const [cuenta, setCuenta] = useState(inicial?.cuenta_id ?? cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState(inicial?.cuenta_destino_id ?? cuentas[1]?.id ?? cuentas[0]?.id ?? '');
  const primeraDe = (t: TipoMovimiento) => categorias.find((c) => c.tipo === t)?.id ?? '';
  const [categoria, setCategoria] = useState(inicial?.categoria_id ?? primeraDe(tipo));
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [hora, setHora] = useState(inicial?.hora ?? '');
  const [repetir, setRepetir] = useState<Repetir>('no');
  const [error, setError] = useState('');
  const regla = inicial?.recurrencia_id ? recurrencias.find((r) => r.id === inicial.recurrencia_id) : undefined;

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    if (t !== 'transferencia' && categorias.find((c) => c.id === categoria)?.tipo !== t) setCategoria(primeraDe(t));
  }

  function guardar() {
    const centavos = aCentavos(monto);
    if (!(centavos > 0)) return setError('Escribe un monto válido');
    if (!cuenta) return setError('Elige una cuenta');
    if (tipo === 'transferencia' && (!destino || destino === cuenta)) return setError('Elige dos cuentas distintas');
    if (tipo !== 'transferencia' && !categoria) return setError('Elige o crea una categoría');
    if (!fecha) return setError('Elige una fecha');
    const comun = {
      tipo, monto: centavos, cuenta_id: cuenta, nota: nota.trim(),
      cuenta_destino_id: tipo === 'transferencia' ? destino : null,
      categoria_id: tipo === 'transferencia' ? null : categoria,
    };
    if (!editando && repetir !== 'no') {
      const id = nuevoId();
      acciones.guardarRecurrencia({ ...comun, id, frecuencia: repetir, fecha_inicio: fecha, fecha_fin: null, generada_hasta: null });
      // El servidor crea la primera ocurrencia si la fecha ya llegó; se muestra ya con el mismo id que le va a dar.
      if (fecha <= hoy) acciones.guardarMovimiento({ ...comun, id: `${id}@${fecha}`, fecha, hora: null, recurrencia_id: id, origen: 'recurrencia' });
    } else {
      acciones.guardarMovimiento({ ...comun, id: inicial?.id ?? nuevoId(), fecha, hora: hora || null,
        recurrencia_id: inicial?.recurrencia_id ?? null, origen: inicial?.origen ?? 'manual' });
    }
    alCerrar();
  }

  function borrar(ySiguientes: boolean) {
    if (inicial) acciones.borrarMovimiento(inicial, ySiguientes);
    alCerrar();
  }

  const titulo = editando ? 'Editar movimiento' : 'Nuevo movimiento';
  return (
    <Modal titulo={titulo} alCerrar={alCerrar}>
      <Selector opciones={TIPOS} valor={tipo} alCambiar={cambiarTipo} colores={COLORES_TIPO} />

      <Etiqueta>Monto</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} autoFocus={!editando} />

      <Etiqueta>{tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</Etiqueta>
      <ElegirCuenta valor={cuenta} alCambiar={setCuenta} cuentas={cuentas} />
      {tipo === 'transferencia'
        ? <><Etiqueta>Hacia</Etiqueta><ElegirCuenta valor={destino} alCambiar={setDestino} cuentas={cuentas} /></>
        : <ElegirCategoria tipo={tipo} valor={categoria} alCambiar={setCategoria} />}

      <Etiqueta>Descripción</Etiqueta>
      <input type="text" placeholder="¿De qué se trata?" value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none text-sm" style={estiloCampo} />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <Etiqueta>{repetir === 'no' ? 'Fecha' : 'Primera vez'}</Etiqueta>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-xl px-3 py-2.5 outline-none text-sm" style={estiloCampo} />
        </div>
        {repetir === 'no' && (
          <div>
            <Etiqueta>Hora (opcional)</Etiqueta>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full rounded-xl px-3 py-2.5 outline-none text-sm" style={estiloCampo} />
          </div>
        )}
      </div>

      {!editando && (
        <>
          <Etiqueta>Repetir</Etiqueta>
          <Selector<Repetir> opciones={[['no', 'No'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']]} valor={repetir} alCambiar={setRepetir} />
          {repetir !== 'no' && (
            <p className="text-xs -mt-2 mb-4" style={{ color: C.tenue }}>
              Se anota solo cada vez que llega la fecha, sin crear nada por adelantado. Lo que viene lo ves en «Próximos».
            </p>
          )}
        </>
      )}

      {regla && (
        <button type="button" onClick={() => alEditarRegla(regla)} className="w-full rounded-xl px-3 py-2.5 mb-4 text-left text-xs flex items-center gap-2" style={{ background: C.tarjetaAlt, color: C.tenue }}>
          <span>🔁</span>
          <span className="flex-1">Se repite {FRECUENCIAS.find(([f]) => f === regla.frecuencia)?.[1].toLowerCase()}{regla.fecha_fin ? ` hasta el ${etiquetaCorta(regla.fecha_fin)}` : ''}.</span>
          <span style={{ color: C.acento, fontWeight: 600 }}>Editar la regla</span>
        </button>
      )}

      <Error texto={error} />
      <BotonPrincipal onClick={guardar}>{editando ? 'Guardar cambios' : 'Guardar'}</BotonPrincipal>

      {editando && (inicial?.recurrencia_id
        ? <div className="flex gap-2">
            <div className="flex-1"><BotonPrincipal tipo="peligro" onClick={() => borrar(false)}>Borrar esta</BotonPrincipal></div>
            <div className="flex-1"><BotonPrincipal tipo="peligro" onClick={() => borrar(true)}>Esta y las siguientes</BotonPrincipal></div>
          </div>
        : <BotonPrincipal tipo="peligro" onClick={() => borrar(false)}>Borrar</BotonPrincipal>)}
    </Modal>
  );
}

/** Editar una regla que se repite. Los cambios valen para lo que viene; lo ya anotado no se toca. */
export function DialogoRecurrencia({ regla, alCerrar }: { regla: Recurrencia; alCerrar: () => void }) {
  const { cuentas, moneda } = useDatos();
  const acciones = useAcciones();
  const [monto, setMonto] = useState(aTexto(regla.monto));
  const [cuenta, setCuenta] = useState(regla.cuenta_id);
  const [destino, setDestino] = useState(regla.cuenta_destino_id ?? '');
  const [categoria, setCategoria] = useState(regla.categoria_id ?? '');
  const [nota, setNota] = useState(regla.nota);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(regla.frecuencia);
  const [fin, setFin] = useState(regla.fecha_fin ?? '');
  const [error, setError] = useState('');

  function guardar() {
    const centavos = aCentavos(monto);
    if (!(centavos > 0)) return setError('Escribe un monto válido');
    if (fin && fin < regla.fecha_inicio) return setError('El fin no puede ser antes del inicio');
    acciones.guardarRecurrencia({
      ...regla, monto: centavos, cuenta_id: cuenta, nota: nota.trim(), frecuencia, fecha_fin: fin || null,
      cuenta_destino_id: regla.tipo === 'transferencia' ? destino : null,
      categoria_id: regla.tipo === 'transferencia' ? null : categoria,
    });
    alCerrar();
  }

  return (
    <Modal titulo="Regla que se repite" alCerrar={alCerrar}>
      <p className="text-xs mb-4" style={{ color: C.tenue }}>
        Empezó el {etiquetaCorta(regla.fecha_inicio)}. Lo que cambies vale para lo que viene; lo ya anotado se queda como está.
      </p>
      <Etiqueta>Monto</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} />
      <Etiqueta>{regla.tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</Etiqueta>
      <ElegirCuenta valor={cuenta} alCambiar={setCuenta} cuentas={cuentas} />
      {regla.tipo === 'transferencia'
        ? <><Etiqueta>Hacia</Etiqueta><ElegirCuenta valor={destino} alCambiar={setDestino} cuentas={cuentas} /></>
        : <ElegirCategoria tipo={regla.tipo} valor={categoria} alCambiar={setCategoria} />}
      <Etiqueta>Descripción</Etiqueta>
      <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none text-sm" style={estiloCampo} />
      <Etiqueta>Frecuencia</Etiqueta>
      <Selector<Frecuencia> opciones={FRECUENCIAS.map(([f, t]) => [f, t.replace('Cada ', '')])} valor={frecuencia} alCambiar={setFrecuencia} />
      <Etiqueta>Termina (opcional)</Etiqueta>
      <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none text-sm" style={estiloCampo} />
      <Error texto={error} />
      <BotonPrincipal onClick={guardar}>Guardar regla</BotonPrincipal>
      <BotonPrincipal tipo="peligro" onClick={() => { acciones.borrarRecurrencia(regla); alCerrar(); }}>Dejar de repetir</BotonPrincipal>
    </Modal>
  );
}

export function DialogoCuenta({ inicial, alCerrar }: { inicial?: Cuenta; alCerrar: () => void }) {
  const { cuentas, movimientos, recurrencias } = useDatos();
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [saldo, setSaldo] = useState(inicial ? aTexto(inicial.saldo_inicial) : '0');
  const [error, setError] = useState('');
  const usada = !!inicial && (movimientos.some((m) => m.cuenta_id === inicial.id || m.cuenta_destino_id === inicial.id)
    || recurrencias.some((r) => r.cuenta_id === inicial.id || r.cuenta_destino_id === inicial.id));
  const borrable = !!inicial && cuentas.length > 1 && !usada;

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la cuenta');
    const negativo = saldo.trim().startsWith('-');
    const abs = saldo.trim() === '' ? 0 : aCentavos(saldo.trim().replace(/^-/, ''));
    if (Number.isNaN(abs)) return setError('El saldo inicial no es un número');
    acciones.guardarCuenta({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), color, saldo_inicial: negativo ? -abs : abs, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Modal titulo={inicial ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar={alCerrar}>
      <Etiqueta>Nombre</Etiqueta>
      <input type="text" placeholder="Ej: Efectivo, Banco, Ahorros" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none text-sm" style={estiloCampo} />
      <Etiqueta>Color</Etiqueta>
      <Colores valor={color} alCambiar={setColor} />
      <Etiqueta>Saldo inicial</Etiqueta>
      <input type="text" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mb-4 outline-none font-mono text-sm" style={estiloCampo} />
      <Error texto={error} />
      <BotonPrincipal onClick={guardar}>{inicial ? 'Guardar cambios' : 'Crear cuenta'}</BotonPrincipal>
      {inicial && (borrable
        ? <BotonPrincipal tipo="peligro" onClick={() => { acciones.borrarCuenta(inicial); alCerrar(); }}>Borrar cuenta</BotonPrincipal>
        : <p className="text-xs text-center" style={{ color: C.tenue }}>No se puede borrar: es la única cuenta o tiene movimientos.</p>)}
    </Modal>
  );
}

export function DialogoCategoria({ inicial, tipoInicial = 'gasto', alCerrar }: { inicial?: Categoria; tipoInicial?: TipoCategoria; alCerrar: () => void }) {
  const { movimientos, recurrencias } = useDatos();
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [emoji, setEmoji] = useState(inicial?.emoji ?? '💰');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [error, setError] = useState('');
  const borrable = !!inicial && !movimientos.some((m) => m.categoria_id === inicial.id) && !recurrencias.some((r) => r.categoria_id === inicial.id);

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la categoría');
    acciones.guardarCategoria({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), tipo, color, emoji: emoji || '💰', presupuesto: inicial?.presupuesto ?? null, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Modal titulo={inicial ? 'Editar categoría' : 'Nueva categoría'} alCerrar={alCerrar}>
      {inicial
        ? <p className="text-xs mb-4" style={{ color: C.tenue }}>Categoría de {tipo}s</p>
        : <Selector<TipoCategoria> opciones={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} valor={tipo} alCambiar={setTipo} />}
      <div className="flex gap-2 mb-4">
        <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-14 text-center rounded-xl py-2.5 outline-none text-lg" style={estiloCampo} />
        <input type="text" placeholder="Nombre de la categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} className="flex-1 min-w-0 rounded-xl px-3 outline-none text-sm" style={estiloCampo} />
      </div>
      <Etiqueta>Color</Etiqueta>
      <Colores valor={color} alCambiar={setColor} />
      <Error texto={error} />
      <BotonPrincipal onClick={guardar}>{inicial ? 'Guardar cambios' : 'Crear categoría'}</BotonPrincipal>
      {inicial && (borrable
        ? <BotonPrincipal tipo="peligro" onClick={() => { acciones.borrarCategoria(inicial); alCerrar(); }}>Borrar categoría</BotonPrincipal>
        : <p className="text-xs text-center" style={{ color: C.tenue }}>No se puede borrar: tiene movimientos o recurrencias.</p>)}
    </Modal>
  );
}

export function DialogoPresupuesto({ categoria, alCerrar }: { categoria: Categoria; alCerrar: () => void }) {
  const { moneda } = useDatos();
  const { guardarCategoria } = useAcciones();
  const [monto, setMonto] = useState(categoria.presupuesto ? aTexto(categoria.presupuesto) : '');
  function guardar(valor: number | null) {
    guardarCategoria({ ...categoria, presupuesto: valor });
    alCerrar();
  }
  return (
    <Modal titulo={`Presupuesto · ${categoria.nombre}`} alCerrar={alCerrar}>
      <Etiqueta>Monto por mes</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} autoFocus />
      <BotonPrincipal onClick={() => { const c = aCentavos(monto); guardar(c > 0 ? c : null); }}>Guardar</BotonPrincipal>
      {categoria.presupuesto ? <BotonPrincipal tipo="peligro" onClick={() => guardar(null)}>Quitar presupuesto</BotonPrincipal> : null}
    </Modal>
  );
}
