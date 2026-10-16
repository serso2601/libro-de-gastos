// Las piezas visuales compartidas. El sistema visual es el de la app de siempre: fintech oscuro,
// tarjetas sólidas sin bordes, verde menta para ingresos, rojo para gastos y azul como acento.

import type { CSSProperties, ReactNode } from 'react';
import { dinero } from './formato';
import type { Categoria, Cuenta, Movimiento, TipoMovimiento } from './tipos';

export const PALETA = ['#3DA5F5', '#34D8A6', '#F16565', '#F5B942', '#A78BFA', '#F472B6', '#4ADE80', '#38BDF8', '#FB923C', '#94A3B8'];

export const C = {
  fondo: '#0B0E13',
  tarjeta: '#171B22',
  tarjetaAlt: '#20252E',
  tinta: '#F5F6F7',
  tenue: 'rgba(245,246,247,0.5)',
  linea: 'rgba(245,246,247,0.08)',
  lineaFuerte: 'rgba(245,246,247,0.14)',
  bien: '#34D8A6',
  alerta: '#F16565',
  acento: '#3B82F6',
  acentoClaro: '#60A5FA',
  sobreAcento: '#FFFFFF',
};

type NombreIcono =
  | 'mas' | 'x' | 'izq' | 'der' | 'arriba' | 'abajo' | 'basura' | 'lapiz' | 'ajustes' | 'alerta' | 'repetir'
  | 'transferir' | 'inicio' | 'cartera' | 'chanchito' | 'lista' | 'torta' | 'buscar' | 'nube';

export function Icono({ nombre, tam = 18, style = {} }: { nombre: NombreIcono; tam?: number; style?: CSSProperties }) {
  const color = style.color ?? 'currentColor';
  const caja = { width: tam, height: tam, flexShrink: 0, ...style };
  const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: caja };
  const emoji = (e: string, f = 1) => <span style={{ fontSize: tam * f, lineHeight: 1, ...style }}>{e}</span>;
  switch (nombre) {
    case 'mas': return <svg {...svg}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case 'x': return <svg {...svg}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'izq': return <svg {...svg}><polyline points="15 18 9 12 15 6" /></svg>;
    case 'der': return <svg {...svg}><polyline points="9 18 15 12 9 6" /></svg>;
    case 'arriba': return <svg {...svg}><polyline points="18 15 12 9 6 15" /></svg>;
    case 'abajo': return <svg {...svg}><polyline points="6 9 12 15 18 9" /></svg>;
    case 'buscar': return <svg {...svg}><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>;
    case 'basura': return emoji('🗑️');
    case 'lapiz': return emoji('✏️');
    case 'ajustes': return emoji('⚙️', 1.05);
    case 'alerta': return emoji('⚠️');
    case 'repetir': return emoji('🔁', 0.9);
    case 'transferir': return emoji('⇄');
    case 'inicio': return emoji('🏠', 1.05);
    case 'cartera': return emoji('👛', 1.05);
    case 'chanchito': return emoji('🐷', 1.05);
    case 'lista': return emoji('📋', 1.05);
    case 'torta': return emoji('📊', 1.05);
    case 'nube': return emoji('☁️');
  }
}

export function Tarjeta({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: C.tarjeta, ...style }}>{children}</div>;
}

export function Modal({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(10,8,5,0.6)' }} onClick={alCerrar}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 overflow-y-auto"
        style={{ background: C.tarjeta, maxHeight: '90vh', borderTop: `1px solid ${C.lineaFuerte}`, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4 sm:hidden">
          <span style={{ width: 32, height: 3, borderRadius: 999, background: C.lineaFuerte }} />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg" style={{ color: C.tinta }}>{titulo}</h2>
          <button onClick={alCerrar} aria-label="Cerrar" className="p-1"><Icono nombre="x" tam={20} style={{ color: C.tenue }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const estiloCampo: CSSProperties = { border: `1px solid ${C.linea}`, background: C.fondo, color: C.tinta };

export function Etiqueta({ children }: { children: ReactNode }) {
  return <label className="block text-xs mb-1" style={{ color: C.tenue }}>{children}</label>;
}

export function CampoMonto({ valor, alCambiar, moneda, autoFocus }: { valor: string; alCambiar: (v: string) => void; moneda: string; autoFocus?: boolean }) {
  return (
    <div className="flex items-center rounded-xl px-3 mb-4" style={estiloCampo}>
      <span className="font-mono text-lg mr-1" style={{ color: C.tenue }}>{moneda}</span>
      <input type="text" inputMode="decimal" placeholder="0.00" value={valor} autoFocus={autoFocus}
        onChange={(e) => alCambiar(e.target.value)} className="font-mono text-lg py-2.5 flex-1 min-w-0 outline-none bg-transparent" style={{ color: C.tinta }} />
    </div>
  );
}

export function Selector<T extends string>({ opciones, valor, alCambiar, colores }: {
  opciones: [T, string][]; valor: T; alCambiar: (v: T) => void; colores?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${C.linea}` }}>
      {opciones.map(([id, texto]) => (
        <button key={id} type="button" onClick={() => alCambiar(id)} className="flex-1 py-2.5 text-xs font-medium"
          style={{ background: valor === id ? (colores?.[id] ?? C.acento) : 'transparent', color: valor === id ? C.sobreAcento : C.tenue }}>
          {texto}
        </button>
      ))}
    </div>
  );
}

export function Colores({ valor, alCambiar }: { valor: string; alCambiar: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 mb-4 flex-wrap">
      {PALETA.map((c) => (
        <button key={c} type="button" onClick={() => alCambiar(c)} aria-label={c}
          style={{ width: 26, height: 26, borderRadius: 999, background: c, border: valor === c ? `2px solid ${C.tinta}` : '2px solid transparent' }} />
      ))}
    </div>
  );
}

export function BotonPrincipal({ children, onClick, tipo = 'normal' }: { children: ReactNode; onClick: () => void; tipo?: 'normal' | 'peligro' }) {
  const peligro = tipo === 'peligro';
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl text-sm font-medium mb-2 ${peligro ? 'py-2.5 text-xs' : 'py-3'}`}
      style={peligro ? { border: `1px solid ${C.alerta}`, color: C.alerta } : { background: C.acento, color: C.sobreAcento }}>
      {children}
    </button>
  );
}

export function Placa({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="rounded-xl flex items-center justify-center shrink-0 font-semibold" style={{ width: 40, height: 40, background: `${color}26`, color }}>
      {children}
    </span>
  );
}

export const colorTipo = (t: TipoMovimiento) => (t === 'ingreso' ? C.bien : t === 'gasto' ? C.alerta : C.acento);
export const signoTipo = (t: TipoMovimiento) => (t === 'ingreso' ? '+' : t === 'gasto' ? '−' : '');

const SIN_CATEGORIA = { emoji: '💰', color: C.tenue, nombre: 'Sin categoría' };

/** Una fila de movimiento (o de un próximo, que tiene la misma forma). */
export function FilaMovimiento({ m, cuentas, categorias, moneda, onClick, derecha }: {
  m: Pick<Movimiento, 'tipo' | 'monto' | 'cuenta_id' | 'cuenta_destino_id' | 'categoria_id' | 'nota' | 'recurrencia_id'>;
  cuentas: Cuenta[]; categorias: Categoria[]; moneda: string; onClick?: () => void; derecha?: ReactNode;
}) {
  const cuenta = (id: string | null) => cuentas.find((a) => a.id === id)?.nombre ?? '?';
  const transferencia = m.tipo === 'transferencia';
  const cat = categorias.find((c) => c.id === m.categoria_id) ?? SIN_CATEGORIA;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 text-left py-2">
      {transferencia
        ? <Placa color={C.acento}><Icono nombre="transferir" tam={16} style={{ color: C.acento }} /></Placa>
        : <Placa color={cat.color}><span className="text-base">{cat.emoji}</span></Placa>}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium flex items-center gap-1" style={{ color: C.tinta }}>
          <span className="truncate">{m.nota || (transferencia ? 'Transferencia' : cat.nombre)}</span>
          {m.recurrencia_id && <Icono nombre="repetir" tam={11} style={{ color: C.tenue }} />}
        </p>
        <p className="text-xs truncate" style={{ color: C.tenue }}>
          {transferencia ? `${cuenta(m.cuenta_id)} → ${cuenta(m.cuenta_destino_id)}` : `${cuenta(m.cuenta_id)} · ${cat.nombre}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-mono text-sm font-semibold" style={{ color: colorTipo(m.tipo) }}>{signoTipo(m.tipo)}{dinero(m.monto, moneda)}</span>
        {derecha}
      </div>
    </button>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-center py-6" style={{ color: C.tenue }}>{children}</p>;
}

export function NavegadorMes({ anio, mes, alCambiar }: { anio: number; mes: number; alCambiar: (anio: number, mes: number) => void }) {
  const mover = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    alCambiar(d.getFullYear(), d.getMonth() + 1);
  };
  const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center justify-between mb-4">
      <button onClick={() => mover(-1)} className="p-2 rounded-full" style={{ background: C.tarjeta }} aria-label="Mes anterior"><Icono nombre="izq" tam={16} style={{ color: C.tenue }} /></button>
      <span className="text-sm font-medium capitalize" style={{ color: C.tinta }}>{nombre.replace(' de ', ' ')}</span>
      <button onClick={() => mover(1)} className="p-2 rounded-full" style={{ background: C.tarjeta }} aria-label="Mes siguiente"><Icono nombre="der" tam={16} style={{ color: C.tenue }} /></button>
    </div>
  );
}
