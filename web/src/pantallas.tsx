import { useMemo, useState } from 'react';
import { useAbrir } from './abrir';
import { useDatos } from './datos';
import { diasHasta, dinero, etiquetaCorta, etiquetaDia, MESES_CORTOS, ordenarPorFecha, saldo } from './formato';
import { Barras, Dona } from './graficos';
import type { Movimiento } from './tipos';
import { C, FilaMovimiento, Icono, NavegadorMes, Placa, Tarjeta, Vacio } from './ui';

function useMes() {
  const { hoy } = useDatos();
  const [y, m] = hoy.split('-').map(Number);
  const [mes, setMes] = useState({ anio: y, mes: m });
  const clave = `${mes.anio}-${String(mes.mes).padStart(2, '0')}`;
  return { ...mes, clave, cambiar: (anio: number, m: number) => setMes({ anio, mes: m }) };
}

function sumar(movs: Movimiento[], tipo: 'gasto' | 'ingreso') {
  return movs.reduce((s, m) => s + (m.tipo === tipo ? m.monto : 0), 0);
}

function Balance({ titulo, monto, grande = 34 }: { titulo: string; monto: number; grande?: number }) {
  const { moneda } = useDatos();
  return (
    <Tarjeta className="p-5 mb-4">
      <p className="text-sm font-semibold mb-1" style={{ color: C.tinta }}>{titulo}</p>
      <p className="font-mono font-bold" style={{ fontSize: grande, color: monto < 0 ? C.alerta : C.bien }}>{dinero(monto, moneda)}</p>
    </Tarjeta>
  );
}

function MiniDato({ texto, monto, color, flecha }: { texto: string; monto: string; color: string; flecha: 'arriba' | 'abajo' }) {
  return (
    <div className="flex-1 flex items-center gap-2.5 rounded-xl p-3 min-w-0" style={{ background: C.tarjetaAlt }}>
      <span className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: `${color}26` }}>
        <Icono nombre={flecha} tam={16} style={{ color }} />
      </span>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: C.tenue }}>{texto}</p>
        <p className="font-mono text-sm font-semibold truncate" style={{ color }}>{monto}</p>
      </div>
    </div>
  );
}

export function Resumen() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const total = d.cuentas.reduce((s, c) => s + saldo(c, d.movimientos), 0);
  const delMes = d.movimientos.filter((m) => m.fecha.startsWith(mes.clave));
  const ingresos = sumar(delMes, 'ingreso');
  const gastos = sumar(delMes, 'gasto');
  const neto = ingresos - gastos;
  const recientes = [...d.movimientos].sort(ordenarPorFecha).slice(0, 5);
  const proximos = d.proximos.slice(0, 4);

  return (
    <div>
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />
      <Balance titulo="Balance total" monto={total} />

      <Tarjeta className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold" style={{ color: C.tinta }}>Este mes</span>
          <span className="font-mono text-xs font-semibold" style={{ color: neto >= 0 ? C.bien : C.alerta }}>Neto {neto >= 0 ? '+' : '−'}{dinero(Math.abs(neto), d.moneda)}</span>
        </div>
        <div className="flex gap-3">
          <MiniDato texto="Gastos" monto={`−${dinero(gastos, d.moneda)}`} color={C.alerta} flecha="abajo" />
          <MiniDato texto="Ingresos" monto={`+${dinero(ingresos, d.moneda)}`} color={C.bien} flecha="arriba" />
        </div>
      </Tarjeta>

      {proximos.length > 0 && (
        <Tarjeta className="p-4 mb-4">
          <p className="text-sm font-semibold mb-2" style={{ color: C.tinta }}>Próximos</p>
          {proximos.map((p) => {
            const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
            const dias = diasHasta(p.fecha, d.hoy);
            return (
              <FilaMovimiento key={`${p.recurrencia_id}@${p.fecha}`} m={p} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda}
                onClick={() => regla && abrir.dialogo({ tipo: 'recurrencia', regla })}
                derecha={<p className="text-xs" style={{ color: C.tenue }}>{dias === 1 ? 'mañana' : `${etiquetaCorta(p.fecha)} · en ${dias} días`}</p>} />
            );
          })}
        </Tarjeta>
      )}

      <Tarjeta className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold" style={{ color: C.tinta }}>Últimos movimientos</p>
          <button onClick={() => abrir.pestania('movimientos')} className="text-xs font-semibold" style={{ color: C.acento }}>Ver todo</button>
        </div>
        {recientes.length === 0 ? <Vacio>Todavía no hay movimientos.</Vacio> : recientes.map((m) => (
          <FilaMovimiento key={m.id} m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onClick={() => abrir.dialogo({ tipo: 'movimiento', inicial: m })} />
        ))}
      </Tarjeta>
    </div>
  );
}

export function Cuentas() {
  const d = useDatos();
  const abrir = useAbrir();
  const [elegida, setElegida] = useState<string | null>(null);
  const cuenta = d.cuentas.find((c) => c.id === elegida);

  if (elegida) {
    const volver = <button onClick={() => setElegida(null)} className="flex items-center gap-1 text-sm mb-4" style={{ color: C.tenue }}><Icono nombre="izq" tam={16} /> Cuentas</button>;
    if (!cuenta) return <div>{volver}<Vacio>Esta cuenta ya no existe.</Vacio></div>;
    const movs = d.movimientos.filter((m) => m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id).sort(ordenarPorFecha);
    return (
      <div>
        {volver}
        <div className="rounded-2xl p-5 mb-3 text-center" style={{ background: cuenta.color }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{cuenta.nombre}</p>
          <p className="font-mono text-2xl" style={{ color: '#fff' }}>{dinero(saldo(cuenta, d.movimientos), d.moneda)}</p>
        </div>
        <button onClick={() => abrir.dialogo({ tipo: 'cuenta', inicial: cuenta })} className="text-sm font-semibold mb-4" style={{ color: C.acento }}>Editar cuenta</button>
        <p className="text-sm font-semibold mb-3" style={{ color: C.tinta }}>Movimientos</p>
        {movs.length === 0 ? <Vacio>Sin movimientos todavía.</Vacio> : (
          <Tarjeta className="p-2">
            {movs.map((m) => <FilaMovimiento key={m.id} m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onClick={() => abrir.dialogo({ tipo: 'movimiento', inicial: m })} />)}
          </Tarjeta>
        )}
      </div>
    );
  }

  const total = d.cuentas.reduce((s, c) => s + saldo(c, d.movimientos), 0);
  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => abrir.dialogo({ tipo: 'cuenta' })} className="text-xs font-semibold px-3 py-2 rounded-full" style={{ background: C.acento, color: '#fff' }}>+ Cuenta</button>
      </div>
      <Balance titulo="Balance total" monto={total} grande={30} />
      <Tarjeta className="p-2">
        {d.cuentas.map((c, i) => {
          const s = saldo(c, d.movimientos);
          return (
            <button key={c.id} onClick={() => setElegida(c.id)} className="w-full flex items-center gap-3 text-left p-2.5" style={{ borderBottom: i < d.cuentas.length - 1 ? `1px solid ${C.linea}` : 'none' }}>
              <Placa color={c.color}>{c.nombre.charAt(0).toUpperCase()}</Placa>
              <p className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: C.tinta }}>{c.nombre}</p>
              <span className="font-mono text-sm font-semibold" style={{ color: s < 0 ? C.alerta : C.tinta }}>{dinero(s, d.moneda)}</span>
              <Icono nombre="der" tam={16} style={{ color: C.tenue }} />
            </button>
          );
        })}
      </Tarjeta>
    </div>
  );
}

export function Presupuesto() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const gastos = d.categorias.filter((c) => c.tipo === 'gasto');
  const gastado = (id: string) => d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.categoria_id === id && m.fecha.startsWith(mes.clave) ? m.monto : 0), 0);
  const conPresupuesto = gastos.filter((c) => c.presupuesto);
  const totalPresupuesto = conPresupuesto.reduce((s, c) => s + (c.presupuesto ?? 0), 0);
  const totalGastado = conPresupuesto.reduce((s, c) => s + gastado(c.id), 0);

  return (
    <div>
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />
      {totalPresupuesto > 0 && (
        <Tarjeta className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: C.tinta }}>Total presupuestado</span>
            <span className="font-mono text-xs" style={{ color: C.tenue }}>{dinero(totalGastado, d.moneda)} / {dinero(totalPresupuesto, d.moneda)}</span>
          </div>
          <Barra parte={totalGastado} total={totalPresupuesto} />
          <p className="text-xs mt-2" style={{ color: totalGastado > totalPresupuesto ? C.alerta : C.tenue }}>
            {totalGastado > totalPresupuesto ? `Te pasaste por ${dinero(totalGastado - totalPresupuesto, d.moneda)}` : `Te quedan ${dinero(totalPresupuesto - totalGastado, d.moneda)}`}
          </p>
        </Tarjeta>
      )}
      <Tarjeta className="p-2 mb-4">
        {gastos.map((c, i) => {
          const g = gastado(c.id);
          const pasado = !!c.presupuesto && g > c.presupuesto;
          return (
            <div key={c.id} className="p-3" style={{ borderBottom: i < gastos.length - 1 ? `1px solid ${C.linea}` : 'none' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{c.emoji}</span>
                  <span className="text-sm font-medium truncate" style={{ color: C.tinta }}>{c.nombre}</span>
                </div>
                <button onClick={() => abrir.dialogo({ tipo: 'presupuesto', categoria: c })} className="text-xs font-semibold" style={{ color: C.acento }}>{c.presupuesto ? 'Editar' : 'Definir'}</button>
              </div>
              {c.presupuesto ? (
                <>
                  <Barra parte={g} total={c.presupuesto} />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-mono text-xs" style={{ color: C.tenue }}>{dinero(g, d.moneda)} / {dinero(c.presupuesto, d.moneda)}</span>
                    {pasado && <span className="text-xs flex items-center gap-1" style={{ color: C.alerta }}><Icono nombre="alerta" tam={12} /> Superado</span>}
                  </div>
                </>
              ) : <p className="text-xs" style={{ color: C.tenue }}>Gastado este mes: {dinero(g, d.moneda)}</p>}
            </div>
          );
        })}
      </Tarjeta>
      <Tarjeta className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: C.tinta }}>Categorías</p>
          <p className="text-xs" style={{ color: C.tenue }}>Crea, edita, reordena o borra tus categorías</p>
        </div>
        <button onClick={abrir.ajustes} className="text-xs font-semibold px-3 py-2 rounded-full shrink-0" style={{ background: C.acento, color: '#fff' }}>Ajustes</button>
      </Tarjeta>
    </div>
  );
}

function Barra({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.min((parte / total) * 100, 100) : 0;
  return (
    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: C.linea }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: parte > total ? C.alerta : C.acento, transition: 'width 0.4s ease' }} />
    </div>
  );
}

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';

export function Movimientos() {
  const d = useDatos();
  const abrir = useAbrir();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(120);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const nombreCat = new Map(d.categorias.map((c) => [c.id, c.nombre.toLowerCase()]));
    const filtrados = d.movimientos
      .filter((m) => filtro === 'todos' || m.tipo === filtro)
      .filter((m) => !q || m.nota.toLowerCase().includes(q) || (nombreCat.get(m.categoria_id ?? '') ?? '').includes(q))
      .sort(ordenarPorFecha);
    const mapa = new Map<string, Movimiento[]>();
    for (const m of filtrados.slice(0, limite)) mapa.set(m.fecha, [...(mapa.get(m.fecha) ?? []), m]);
    return { lista: [...mapa.entries()], total: filtrados.length };
  }, [d.movimientos, d.categorias, filtro, busqueda, limite]);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl px-3 mb-3" style={{ background: C.tarjeta }}>
        <Icono nombre="buscar" tam={16} style={{ color: C.tenue }} />
        <input type="search" placeholder="Buscar por descripción o categoría" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 min-w-0 py-2.5 outline-none bg-transparent text-sm" style={{ color: C.tinta }} />
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {([['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']] as [Filtro, string][]).map(([id, texto]) => (
          <button key={id} onClick={() => setFiltro(id)} className="text-xs font-semibold rounded-full" style={{ padding: '7px 14px', background: filtro === id ? C.acento : C.tarjeta, color: filtro === id ? '#fff' : C.tenue }}>{texto}</button>
        ))}
      </div>
      {grupos.lista.length === 0 ? <Vacio>No hay movimientos para mostrar.</Vacio> : grupos.lista.map(([fecha, items]) => {
        const neto = items.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : m.tipo === 'gasto' ? -m.monto : 0), 0);
        return (
          <div key={fecha} className="mb-4">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <p className="text-xs font-semibold capitalize" style={{ color: C.tenue }}>{etiquetaDia(fecha, d.hoy)}</p>
              <span className="font-mono font-semibold text-xs" style={{ color: neto >= 0 ? C.bien : C.alerta }}>{neto >= 0 ? '+' : '−'}{dinero(Math.abs(neto), d.moneda)}</span>
            </div>
            <Tarjeta className="p-2">
              {items.map((m, i) => (
                <div key={m.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.linea}` : 'none' }}>
                  <FilaMovimiento m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onClick={() => abrir.dialogo({ tipo: 'movimiento', inicial: m })} />
                </div>
              ))}
            </Tarjeta>
          </div>
        );
      })}
      {grupos.total > limite && (
        <button onClick={() => setLimite((l) => l + 200)} className="w-full py-3 text-sm font-semibold" style={{ color: C.acento }}>Ver más ({grupos.total - limite})</button>
      )}
    </div>
  );
}

export function Graficos() {
  const d = useDatos();
  const mes = useMes();
  const porCategoria = useMemo(() => {
    const delMes = d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha.startsWith(mes.clave));
    return d.categorias.filter((c) => c.tipo === 'gasto')
      .map((c) => ({ ...c, total: delMes.reduce((s, m) => s + (m.categoria_id === c.id ? m.monto : 0), 0) }))
      .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [d.movimientos, d.categorias, mes.clave]);
  const totalGastos = porCategoria.reduce((s, c) => s + c.total, 0);

  const seisMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const f = new Date(mes.anio, mes.mes - 6 + i, 1);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    const movs = d.movimientos.filter((m) => m.fecha.startsWith(clave));
    return { etiqueta: MESES_CORTOS[f.getMonth()], ingresos: sumar(movs, 'ingreso'), gastos: sumar(movs, 'gasto') };
  }), [d.movimientos, mes.anio, mes.mes]);

  return (
    <div>
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />
      <Tarjeta className="p-4 mb-4">
        <p className="text-sm font-semibold mb-2" style={{ color: C.tinta }}>Gastos por categoría</p>
        {porCategoria.length === 0 ? <Vacio>Sin gastos este mes.</Vacio> : (
          <>
            <Dona datos={porCategoria} moneda={d.moneda} />
            <div className="mt-2">
              {porCategoria.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: i < porCategoria.length - 1 ? `1px solid ${C.linea}` : 'none' }}>
                  <span className="rounded-md shrink-0" style={{ width: 10, height: 10, background: c.color }} />
                  <span className="flex-1 text-sm" style={{ color: C.tinta }}>{c.emoji} {c.nombre}</span>
                  <span className="text-xs" style={{ color: C.tenue }}>{((c.total / totalGastos) * 100).toFixed(0)}%</span>
                  <span className="font-mono text-sm font-semibold" style={{ color: C.tinta }}>{dinero(c.total, d.moneda)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Tarjeta>
      <Tarjeta className="p-4">
        <p className="text-sm font-semibold mb-2" style={{ color: C.tinta }}>Ingresos vs. gastos · últimos 6 meses</p>
        <div className="flex items-center gap-3 mb-2">
          <span className="flex items-center gap-1 text-xs" style={{ color: C.tenue }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.bien, display: 'inline-block' }} /> Ingresos</span>
          <span className="flex items-center gap-1 text-xs" style={{ color: C.tenue }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.alerta, display: 'inline-block' }} /> Gastos</span>
        </div>
        <Barras datos={seisMeses} moneda={d.moneda} />
      </Tarjeta>
    </div>
  );
}
