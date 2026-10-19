// Cuentas que comparten las pantallas: lo del mes, el calor de cada día, el presupuesto, las formas
// de ver el saldo y las próximas veces de una regla. Todo en centavos.

import { aFecha, dinero, fechaISO, MESES, saldo } from './formato';
import type { Categoria, Datos, Frecuencia, Movimiento, Proximo, Recurrencia } from './tipos';

export const claveMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`;

export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Los días que faltan para que termine el mes de `hoy` (sin contar hoy). */
export function diasQueQuedan(hoy: string): number {
  const d = aFecha(hoy);
  return diasDelMes(d.getFullYear(), d.getMonth() + 1) - d.getDate();
}

export function delMes(movs: Movimiento[], clave: string): Movimiento[] {
  return movs.filter((m) => m.fecha.startsWith(clave));
}

export function sumar(movs: Movimiento[], tipo: 'gasto' | 'ingreso'): number {
  return movs.reduce((s, m) => s + (m.tipo === tipo ? m.monto : 0), 0);
}

/** Lo gastado cada día del mes: índice 0 = día 1. */
export function gastoPorDia(movs: Movimiento[], anio: number, mes: number, filtro?: (m: Movimiento) => boolean): number[] {
  const dias = new Array(diasDelMes(anio, mes)).fill(0);
  const clave = claveMes(anio, mes);
  for (const m of movs) {
    if (m.tipo !== 'gasto' || !m.fecha.startsWith(clave) || (filtro && !filtro(m))) continue;
    dias[Number(m.fecha.slice(8, 10)) - 1] += m.monto;
  }
  return dias;
}

/** De 0 (nada) a 4 (mucho), comparando con lo que se gasta un día normal de ese mes. */
export function nivelador(valores: number[]): (v: number) => 0 | 1 | 2 | 3 | 4 {
  const conGasto = valores.filter((v) => v > 0);
  const promedio = conGasto.length ? conGasto.reduce((s, v) => s + v, 0) / conGasto.length : 0;
  return (v) => (v <= 0 ? 0 : v < promedio * 0.5 ? 1 : v < promedio ? 2 : v < promedio * 2 ? 3 : 4);
}

export function gastadoEn(d: Datos, categoriaId: string, clave: string): number {
  return d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.categoria_id === categoriaId && m.fecha.startsWith(clave) ? m.monto : 0), 0);
}

export interface EstadoTope {
  categoria: Categoria;
  gastado: number;
  tope: number;
  /** 0 a 100+ */
  pct: number;
  casiAlTope: boolean;
  pasado: boolean;
}

export function topes(d: Datos, clave: string): { conTope: EstadoTope[]; sinTope: Categoria[]; tope: number; gastado: number } {
  const deGasto = d.categorias.filter((c) => c.tipo === 'gasto');
  const conTope = deGasto.filter((c) => c.presupuesto).map((c): EstadoTope => {
    const gastado = gastadoEn(d, c.id, clave);
    const tope = c.presupuesto ?? 0;
    const pct = tope > 0 ? Math.round((gastado / tope) * 100) : 0;
    return { categoria: c, gastado, tope, pct, casiAlTope: pct >= 90 && gastado <= tope, pasado: gastado > tope };
  });
  return {
    conTope,
    sinTope: deGasto.filter((c) => !c.presupuesto),
    tope: conTope.reduce((s, x) => s + x.tope, 0),
    gastado: conTope.reduce((s, x) => s + x.gastado, 0),
  };
}

/** Lo que viene en los próximos `dias` días (el servidor manda 45). */
export function proximosEn(d: Datos, dias: number, filtro?: (p: Proximo) => boolean): Proximo[] {
  const limite = aFecha(d.hoy);
  limite.setDate(limite.getDate() + dias);
  const hasta = fechaISO(limite);
  return d.proximos.filter((p) => p.fecha <= hasta && (!filtro || filtro(p))).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Lo que todavía se va a anotar solo en lo que queda del mes de hoy. Cuando llega su día, el
 *  servidor lo anota y pasa a ser un movimiento más; el mes que viene trae los suyos. */
export function porVenirDelMes(d: Datos): Proximo[] {
  const mes = d.hoy.slice(0, 7);
  return d.proximos.filter((p) => p.fecha > d.hoy && p.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// --- Formas de ver el saldo -----------------------------------------------------------------------

/** Lo que se puede poner arriba en el Inicio (se elige en Ajustes o tocando el saldo). */
export type IdSaldo = 'total' | 'libre' | 'mes' | 'gastado' | 'entro';

export const ORDEN_SALDOS: IdSaldo[] = ['total', 'libre', 'mes', 'gastado', 'entro'];

export interface FormaSaldo {
  rotulo: string;
  valor: number;
  detalle: string;
  /** signo = verde si es 0 o más, rojo si es menos. */
  tono: 'neutro' | 'ingreso' | 'gasto' | 'signo';
}

export function saldos(d: Datos): Record<IdSaldo, FormaSaldo> {
  const total = d.cuentas.reduce((s, x) => s + saldo(x, d.movimientos), 0);
  const programado = porVenirDelMes(d).reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const movs = delMes(d.movimientos, d.hoy.slice(0, 7));
  const entro = sumar(movs, 'ingreso');
  const gastado = sumar(movs, 'gasto');
  const nGastos = movs.filter((m) => m.tipo === 'gasto').length;
  const nIngresos = movs.filter((m) => m.tipo === 'ingreso').length;
  const mes = MESES[Number(d.hoy.slice(5, 7)) - 1];
  const n = d.cuentas.length;
  return {
    total: { rotulo: 'Tienes en total', valor: total, detalle: `en ${n} ${n === 1 ? 'cuenta' : 'cuentas'}`, tono: 'neutro' },
    libre: { rotulo: 'Libre después de lo que viene', valor: total - programado, detalle: `descontando lo que falta por pagarse en ${mes}`, tono: 'neutro' },
    mes: { rotulo: `Balance de ${mes}`, valor: entro - gastado, detalle: `entró ${dinero(entro, d.moneda)} y salió ${dinero(gastado, d.moneda)}`, tono: 'signo' },
    gastado: { rotulo: `Gastado en ${mes}`, valor: gastado, detalle: `en ${nGastos} ${nGastos === 1 ? 'gasto' : 'gastos'}`, tono: 'gasto' },
    entro: { rotulo: `Entró en ${mes}`, valor: entro, detalle: `en ${nIngresos} ${nIngresos === 1 ? 'ingreso' : 'ingresos'}`, tono: 'ingreso' },
  };
}

// La misma cuenta del servidor (recurrencias.py): lo mensual se cuenta siempre desde el inicio.
function sumarMeses(d: Date, n: number): Date {
  const indice = d.getMonth() + n;
  const anio = d.getFullYear() + Math.floor(indice / 12);
  const mes = ((indice % 12) + 12) % 12;
  return new Date(anio, mes, Math.min(d.getDate(), diasDelMes(anio, mes + 1)));
}

/** Quincenal: las veces pares caen el día de inicio, las impares 15 días después. */
function mediaQuincena(inicio: Date, n: number): Date {
  const base = sumarMeses(inicio, Math.floor(n / 2));
  if (n % 2 === 0) return base;
  const dia = inicio.getDate();
  if (dia <= 15) return new Date(base.getFullYear(), base.getMonth(), Math.min(dia + 15, diasDelMes(base.getFullYear(), base.getMonth() + 1)));
  return new Date(base.getFullYear(), base.getMonth() + 1, dia - 15);
}

function ocurrencia(inicio: Date, f: Frecuencia, n: number): Date {
  if (f === 'semanal' || f === 'catorcenal') {
    const r = new Date(inicio);
    r.setDate(r.getDate() + n * (f === 'semanal' ? 7 : 14));
    return r;
  }
  if (f === 'quincenal') return mediaQuincena(inicio, n);
  return sumarMeses(inicio, f === 'mensual' ? n : 12 * n);
}

/** Las próximas `cuantas` fechas de una regla después de hoy (o de lo ya anotado). */
export function proximasVeces(r: Pick<Recurrencia, 'fecha_inicio' | 'frecuencia' | 'fecha_fin' | 'generada_hasta'>, hoy: string, cuantas = 3): string[] {
  const despues = r.generada_hasta && r.generada_hasta > hoy ? r.generada_hasta : hoy;
  const inicio = aFecha(r.fecha_inicio);
  const fechas: string[] = [];
  for (let n = 0; n < 5000 && fechas.length < cuantas; n++) {
    const f = fechaISO(ocurrencia(inicio, r.frecuencia, n));
    if (r.fecha_fin && f > r.fecha_fin) break;
    if (f > despues) fechas.push(f);
  }
  return fechas;
}

/** "Comida se llevó un tercio de lo que gastaste." */
export function fraseDona(nombre: string, parte: number, total: number): string {
  const r = total > 0 ? parte / total : 0;
  const cuanto = r > 0.9 ? 'casi todo' : r >= 0.6 ? 'más de la mitad' : r >= 0.45 ? 'la mitad' : r >= 0.3 ? 'un tercio'
    : r >= 0.22 ? 'un cuarto' : `el ${Math.round(r * 100)}%`;
  return `${nombre} se llevó ${cuanto} de lo que gastaste.`;
}

/** Lo que entró y salió de una cuenta en un mes (las transferencias cuentan). */
export function flujoCuenta(movs: Movimiento[], cuentaId: string, clave: string): { entro: number; salio: number; n: number } {
  let entro = 0;
  let salio = 0;
  let n = 0;
  for (const m of movs) {
    if (!m.fecha.startsWith(clave)) continue;
    if (m.cuenta_id === cuentaId) {
      n++;
      if (m.tipo === 'ingreso') entro += m.monto;
      else salio += m.monto;
    } else if (m.cuenta_destino_id === cuentaId) {
      n++;
      entro += m.monto;
    }
  }
  return { entro, salio, n };
}

/** El monto de un movimiento visto desde una cuenta: lo que le entra es positivo. */
export function montoEnCuenta(m: Movimiento, cuentaId: string): number {
  if (m.tipo === 'transferencia') return m.cuenta_destino_id === cuentaId ? m.monto : -m.monto;
  return m.tipo === 'ingreso' ? m.monto : -m.monto;
}

export function netoDe(movs: Movimiento[]): number {
  return movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : m.tipo === 'gasto' ? -m.monto : 0), 0);
}

/** Los movimientos agrupados por día, del más nuevo al más viejo. */
export function porDia(movs: Movimiento[]): [string, Movimiento[]][] {
  const mapa = new Map<string, Movimiento[]>();
  for (const m of movs) mapa.set(m.fecha, [...(mapa.get(m.fecha) ?? []), m]);
  return [...mapa.entries()];
}
