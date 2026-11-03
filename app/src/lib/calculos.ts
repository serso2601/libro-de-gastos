// Cuentas que comparten las pantallas: lo del mes, el calor de cada día, el presupuesto, las formas
// de ver el saldo y las próximas veces de una regla. Todo en centavos.

import { aFecha, dinero, fechaISO, MESES, MESES_CORTOS, saldo } from './formato';
import type { Categoria, ConfigPresupuesto, Cuenta, Datos, Frecuencia, Movimiento, PeriodoPresupuesto, Proximo, Recurrencia, VersionTarjeta } from './tipos';

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

// --- Periodos del presupuesto ---------------------------------------------------------------------

/** Un periodo del presupuesto, con sus dos puntas incluidas ('YYYY-MM-DD'). */
export interface Periodo {
  desde: string;
  hasta: string;
}

const POR_ANIO: Record<PeriodoPresupuesto, number> = { semanal: 52, catorcenal: 26, quincenal: 24, mensual: 12 };
export const NOMBRES_PERIODO: Record<PeriodoPresupuesto, string> = {
  semanal: 'Cada semana', catorcenal: 'Cada 2 semanas', quincenal: 'Cada quincena', mensual: 'Cada mes',
};
/** «al mes», «a la semana»…: para «tope $400 al mes». */
export const POR_PERIODO: Record<PeriodoPresupuesto, string> = {
  semanal: 'a la semana', catorcenal: 'cada 2 semanas', quincenal: 'por quincena', mensual: 'al mes',
};

export function configPresupuesto(d: Datos): ConfigPresupuesto {
  return d.presupuesto ?? { periodo: 'mensual', inicio: '1' };
}

function sumarDias(iso: string, n: number): string {
  const f = aFecha(iso);
  f.setDate(f.getDate() + n);
  return fechaISO(f);
}

/** Los días de un periodo, contando sus dos puntas. */
export function diasDelPeriodo(p: Periodo): number {
  return Math.round((aFecha(p.hasta).getTime() - aFecha(p.desde).getTime()) / 86_400_000) + 1;
}

/** Los días que le quedan al periodo contando hoy (1 el último día; 0 si ya terminó). */
export function diasQueQuedanEn(p: Periodo, hoy: string): number {
  if (hoy > p.hasta) return 0;
  if (hoy < p.desde) return diasDelPeriodo(p);
  return diasDelPeriodo({ desde: hoy, hasta: p.hasta });
}

/** El periodo del presupuesto en el que cae `fecha`. */
export function periodoDe(config: ConfigPresupuesto, fecha: string): Periodo {
  const f = aFecha(fecha);
  switch (config.periodo) {
    case 'semanal': {
      const atras = (f.getDay() - (Number(config.inicio) || 0) + 7) % 7;
      const desde = sumarDias(fecha, -atras);
      return { desde, hasta: sumarDias(desde, 6) };
    }
    case 'catorcenal': {
      const ancla = /^\d{4}-\d{2}-\d{2}$/.test(config.inicio) ? config.inicio : fecha;
      const dias = Math.round((f.getTime() - aFecha(ancla).getTime()) / 86_400_000);
      const desde = sumarDias(ancla, Math.floor(dias / 14) * 14);
      return { desde, hasta: sumarDias(desde, 13) };
    }
    case 'quincenal': {
      const [anio, mes] = [f.getFullYear(), f.getMonth() + 1];
      return f.getDate() <= 15
        ? { desde: `${claveMes(anio, mes)}-01`, hasta: `${claveMes(anio, mes)}-15` }
        : { desde: `${claveMes(anio, mes)}-16`, hasta: `${claveMes(anio, mes)}-${String(diasDelMes(anio, mes)).padStart(2, '0')}` };
    }
    case 'mensual': {
      const dia = Math.min(Math.max(Number(config.inicio) || 1, 1), 28);
      const desde = f.getDate() >= dia ? new Date(f.getFullYear(), f.getMonth(), dia) : new Date(f.getFullYear(), f.getMonth() - 1, dia);
      const hasta = new Date(desde.getFullYear(), desde.getMonth() + 1, dia - 1);
      return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
    }
  }
}

/** El periodo anterior (delta = -1) o siguiente (+1) a `p`. */
export function periodoVecino(config: ConfigPresupuesto, p: Periodo, delta: number): Periodo {
  let actual = p;
  for (let i = 0; i < Math.abs(delta); i++) actual = periodoDe(config, delta < 0 ? sumarDias(actual.desde, -1) : sumarDias(actual.hasta, 1));
  return actual;
}

/** «Octubre 2026» si el periodo es un mes entero; si no, «13 – 19 oct» o «25 sep – 24 oct». */
export function nombrePeriodo(p: Periodo): string {
  const a = aFecha(p.desde);
  const b = aFecha(p.hasta);
  if (a.getDate() === 1 && b.getDate() === diasDelMes(b.getFullYear(), b.getMonth() + 1) && a.getMonth() === b.getMonth()) {
    return `${MESES[a.getMonth()].charAt(0).toUpperCase()}${MESES[a.getMonth()].slice(1)} ${a.getFullYear()}`;
  }
  const mesB = MESES_CORTOS[b.getMonth()];
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${mesB}` : `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} – ${b.getDate()} ${mesB}`;
}

/** Un monto de un periodo llevado a otro con la misma proporción por año ($400 al mes ≈ $92 a la semana). */
export function convertirTope(centavos: number, de: PeriodoPresupuesto, a: PeriodoPresupuesto): number {
  return Math.round((centavos * POR_ANIO[de]) / POR_ANIO[a] / 100) * 100;
}

/** Un mes calendario 'YYYY-MM' como periodo (para lo que todavía mira meses). */
function periodoDeMes(clave: string): Periodo {
  const [anio, mes] = clave.split('-').map(Number);
  return { desde: `${clave}-01`, hasta: `${clave}-${String(diasDelMes(anio, mes)).padStart(2, '0')}` };
}

const comoPeriodo = (p: Periodo | string): Periodo => (typeof p === 'string' ? periodoDeMes(p) : p);

/** Lo gastado en una categoría en un periodo (o en un mes 'YYYY-MM'). */
export function gastadoEn(d: Datos, categoriaId: string, periodo: Periodo | string): number {
  const p = comoPeriodo(periodo);
  return d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.categoria_id === categoriaId && m.fecha >= p.desde && m.fecha <= p.hasta ? m.monto : 0), 0);
}

/**
 * Lo que una categoría que «pasa lo que sobra» trae de los periodos anteriores a `p`: la suma de
 * (tope − gastado) desde el periodo de `acumula_desde`. Puede ser negativo si se pasó. Usa el tope de
 * hoy para los periodos viejos (no se guarda el historial de topes).
 */
export function arrastre(d: Datos, categoria: Categoria, p: Periodo): number {
  if (!categoria.acumula || !categoria.acumula_desde || !categoria.presupuesto) return 0;
  const config = configPresupuesto(d);
  let actual = periodoDe(config, categoria.acumula_desde);
  let total = 0;
  for (let i = 0; i < 400 && actual.desde < p.desde; i++) {
    total += categoria.presupuesto - gastadoEn(d, categoria.id, actual);
    actual = periodoVecino(config, actual, 1);
  }
  return total;
}

export interface EstadoTope {
  categoria: Categoria;
  gastado: number;
  /** El tope de este periodo: el de la categoría más lo que trae (si pasa lo que sobra). */
  tope: number;
  /** Lo que trae de periodos anteriores (0 si no acumula; negativo si se pasó). */
  arrastre: number;
  /** 0 a 100+ */
  pct: number;
  casiAlTope: boolean;
  pasado: boolean;
}

/** El estado de cada tope en un periodo (o en un mes 'YYYY-MM'). */
export function topes(d: Datos, periodo: Periodo | string): { conTope: EstadoTope[]; sinTope: Categoria[]; tope: number; gastado: number } {
  const p = comoPeriodo(periodo);
  const deGasto = d.categorias.filter((c) => c.tipo === 'gasto');
  const conTope = deGasto.filter((c) => c.presupuesto).map((c): EstadoTope => {
    const gastado = gastadoEn(d, c.id, p);
    const extra = arrastre(d, c, p);
    const tope = Math.max(0, (c.presupuesto ?? 0) + extra);
    const pct = tope > 0 ? Math.round((gastado / tope) * 100) : gastado > 0 ? 100 : 0;
    return { categoria: c, gastado, tope, arrastre: extra, pct, casiAlTope: pct >= 90 && gastado <= tope, pasado: gastado > tope };
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

/** `fuera`: ids de las cuentas que el usuario sacó del total (p. ej. las tarjetas de crédito); no suman al total ni a «libre». */
export function saldos(d: Datos, fuera: readonly string[] = []): Record<IdSaldo, FormaSaldo> {
  const enTotal = d.cuentas.filter((x) => !fuera.includes(x.id));
  const total = enTotal.reduce((s, x) => s + saldo(x, d.movimientos), 0);
  const programado = porVenirDelMes(d).reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const movs = delMes(d.movimientos, d.hoy.slice(0, 7));
  const entro = sumar(movs, 'ingreso');
  const gastado = sumar(movs, 'gasto');
  const nGastos = movs.filter((m) => m.tipo === 'gasto').length;
  const nIngresos = movs.filter((m) => m.tipo === 'ingreso').length;
  const mes = MESES[Number(d.hoy.slice(5, 7)) - 1];
  const n = enTotal.length;
  const de = n < d.cuentas.length ? ` de ${d.cuentas.length}` : '';
  return {
    total: { rotulo: 'Tienes en total', valor: total, detalle: `en ${n}${de} ${n === 1 && !de ? 'cuenta' : 'cuentas'}`, tono: 'neutro' },
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

// --- Tarjeta de crédito ---------------------------------------------------------------------------

/** El día `dia` de un mes, o el último si el mes es más corto (corte el 31 → 30 de abril). */
function diaDelMes(anio: number, mes0: number, dia: number): Date {
  const primero = new Date(anio, mes0, 1);
  return new Date(primero.getFullYear(), primero.getMonth(), Math.min(dia, diasDelMes(primero.getFullYear(), primero.getMonth() + 1)));
}

/** La versión del producto con mayor `vigente_desde` que no pase de la fecha; si la fecha es anterior a todas, la primera. */
export function versionVigente<V extends { vigente_desde: string }>(producto: { versiones: V[] }, fechaISO: string): V {
  const orden = [...producto.versiones].sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
  let elegida = orden[0];
  for (const v of orden) if (v.vigente_desde <= fechaISO) elegida = v;
  return elegida;
}

/** Las reglas que da el banco para la tarjeta de crédito (catálogo), si está vinculada a una que las trae. */
export function reglasTarjeta(d: Pick<Datos, 'catalogo' | 'hoy'>, cuenta: Cuenta): VersionTarjeta | null {
  const v = cuenta.banco;
  if (!cuenta.es_credito || !v?.tarjeta || !d.catalogo) return null;
  const tarjeta = d.catalogo.bancos.find((b) => b.id === v.banco)?.tarjetas.find((t) => t.id === v.tarjeta);
  return tarjeta ? versionVigente(tarjeta, d.hoy) : null;
}

export interface CicloTarjeta {
  /** El último corte que ya pasó (el periodo actual empieza el día siguiente). */
  corteAnterior: string;
  /** El próximo corte (hoy, si hoy es día de corte): ahí se cierra el periodo actual. */
  proximoCorte: string;
  /** La fecha de pago que sigue al último corte: la del día que puso el usuario o, si no puso, la que dice el banco. */
  fechaPago: string | null;
}

/**
 * El periodo de la tarjeta en el que cae `hoy`: (corteAnterior, proximoCorte]. Sin día de pago, si el banco dice
 * cuántos días da para pagar (`diasParaPagar`, 28 en Banco General), la fecha de pago sale de ahí.
 */
export function cicloTarjeta(cuenta: Cuenta, hoy: string, diasParaPagar?: number | null): CicloTarjeta | null {
  if (!cuenta.es_credito || !cuenta.dia_corte) return null;
  const h = aFecha(hoy);
  let proximo = diaDelMes(h.getFullYear(), h.getMonth(), cuenta.dia_corte);
  if (proximo < h) proximo = diaDelMes(h.getFullYear(), h.getMonth() + 1, cuenta.dia_corte);
  const anterior = diaDelMes(proximo.getFullYear(), proximo.getMonth() - 1, cuenta.dia_corte);
  let fechaPago: string | null = null;
  if (cuenta.dia_pago) {
    let pago = diaDelMes(anterior.getFullYear(), anterior.getMonth(), cuenta.dia_pago);
    if (pago <= anterior) pago = diaDelMes(anterior.getFullYear(), anterior.getMonth() + 1, cuenta.dia_pago);
    fechaPago = fechaISO(pago);
  } else if (diasParaPagar) {
    fechaPago = fechaISO(new Date(anterior.getFullYear(), anterior.getMonth(), anterior.getDate() + diasParaPagar));
  }
  return { corteAnterior: fechaISO(anterior), proximoCorte: fechaISO(proximo), fechaPago };
}

/**
 * Lo que se gastó con la tarjeta en el periodo actual (desde el día después del último corte), con las compras de
 * antes del corte que, según el mínimo que dio el banco, no entraron en ese estado de cuenta.
 */
export function gastadoEnCorte(d: Datos, cuenta: Cuenta): number {
  const ciclo = cicloTarjeta(cuenta, d.hoy);
  if (!ciclo) return 0;
  const pasan = pasanAlSiguiente(d, cuenta);
  const ini = inicioDeTarjeta(cuenta);
  const alCrearla = ini && ini.corte === ciclo.corteAnterior ? ini.compras : 0;
  return alCrearla + d.movimientos.reduce((s, m) => s + (m.cuenta_id === cuenta.id && m.tipo !== 'ingreso'
    && ((m.fecha > ciclo.corteAnterior && m.fecha <= ciclo.proximoCorte) || pasan.has(m.id)) ? m.monto : 0), 0);
}

/** Lo que se debe en la tarjeta: su saldo en contra (0 si está a favor). */
export function deudaTarjeta(d: Datos, cuenta: Cuenta): number {
  return Math.max(0, -saldo(cuenta, d.movimientos));
}

/** Lo que se debía en la tarjeta al cerrar el día `fecha` (0 si estaba a favor). */
export function deudaAl(d: Datos, cuenta: Cuenta, fecha: string): number {
  const ini = inicioDeTarjeta(cuenta);
  // En el corte con el que se creó la tarjeta, la deuda de partida es la del estado de cuenta, no la de hoy.
  const desde = ini && fecha === ini.corte ? { ...cuenta, saldo_inicial: -ini.alCorte } : cuenta;
  return Math.max(0, -saldo(desde, d.movimientos.filter((m) => m.fecha <= fecha)));
}

/**
 * Lo que se separó al crear la tarjeta para su último corte: lo que se debía en ese corte (estado de cuenta) y las
 * compras y pagos que el banco hizo efectivos después y ya venían en «lo que debes hoy». null si no se separó.
 */
export function inicioDeTarjeta(cuenta: Cuenta): { corte: string; alCorte: number; compras: number; pagos: number } | null {
  if (!cuenta.es_credito || !cuenta.corte_inicial || cuenta.deuda_al_corte == null) return null;
  const pagos = cuenta.pagos_tras_corte ?? 0;
  const debeHoy = Math.max(0, -cuenta.saldo_inicial);
  return { corte: cuenta.corte_inicial, alCorte: cuenta.deuda_al_corte, pagos, compras: Math.max(0, debeHoy - cuenta.deuda_al_corte + pagos) };
}

/** Días antes del corte en que una compra puede no haber entrado todavía: el banco la fecha 2 a 4 días después. */
export const DIAS_SIN_ENTRAR = 4;

/** El mínimo según la regla del banco para un saldo al corte: el %, nunca menos del piso ni más de lo que se debe, más el exceso del límite. */
function minimoDeRegla(alCorte: number, limite: number | null, regla: { porcentaje: number; minimo: number }): number {
  if (alCorte <= 0) return 0;
  const exceso = limite ? Math.max(0, alCorte - limite) : 0;
  return Math.min(alCorte, Math.max(Math.round((alCorte * regla.porcentaje) / 100), regla.minimo) + exceso);
}

/** El mínimo que el usuario corrigió para el último corte (si es para ese corte), o null. */
export function minimoCorregido(cuenta: Cuenta, corte: string): number | null {
  return cuenta.pago_minimo && cuenta.minimo_corte === corte ? cuenta.pago_minimo : null;
}

export interface AjusteMinimo {
  /** Compras anotadas en los últimos días antes del corte que, según el mínimo del banco, entran en el corte siguiente. */
  pasan: Movimiento[];
  /** Lo que se debía al corte sin esas compras. */
  alCorte: number;
  /** Si el banco cuenta más de lo anotado (falta algo por anotar, o intereses o cargos): cuánto, aprox.; si no, null. */
  faltaAnotar: number | null;
}

/**
 * Con el mínimo que dice el banco, qué compras de los últimos días antes del corte no entraron en ese estado de
 * cuenta: se quitan de la más reciente hacia atrás hasta que el mínimo calculado dé igual (o lo más cerca posible).
 * Si el banco dice más de lo que da lo anotado, no se quita nada y se estima cuánto falta.
 */
export function ajusteMinimo(d: Datos, cuenta: Cuenta, minimoBanco: number): AjusteMinimo | null {
  const ciclo = cicloTarjeta(cuenta, d.hoy);
  const regla = reglasTarjeta(d, cuenta)?.pago_minimo;
  if (!ciclo || !regla) return null;
  const limite = cuenta.limite ?? null;
  const s0 = deudaAl(d, cuenta, ciclo.corteAnterior);
  const desde = aFecha(ciclo.corteAnterior);
  desde.setDate(desde.getDate() - DIAS_SIN_ENTRAR);
  const desdeISO = fechaISO(desde);
  const candidatas = d.movimientos
    .filter((m) => m.cuenta_id === cuenta.id && m.tipo === 'gasto' && m.fecha > desdeISO && m.fecha <= ciclo.corteAnterior)
    .sort((a, b) => (b.fecha + (b.hora ?? '')).localeCompare(a.fecha + (a.hora ?? '')));
  let mejor = 0;
  let mejorDif = Math.abs(minimoDeRegla(s0, limite, regla) - minimoBanco);
  let s = s0;
  for (let k = 1; k <= candidatas.length && mejorDif > 0; k++) {
    s -= candidatas[k - 1].monto;
    if (s < 0) break;
    const dif = Math.abs(minimoDeRegla(s, limite, regla) - minimoBanco);
    if (dif < mejorDif) { mejor = k; mejorDif = dif; }
  }
  const pasan = candidatas.slice(0, mejor);
  const alCorte = s0 - pasan.reduce((x, m) => x + m.monto, 0);
  // Por encima del piso, el mínimo es el % del saldo: de ahí sale el saldo que vio el banco.
  let faltaAnotar: number | null = null;
  if (mejor === 0 && minimoBanco > minimoDeRegla(s0, limite, regla) && minimoBanco > regla.minimo) {
    const delBanco = Math.round((minimoBanco * 100) / regla.porcentaje);
    if (delBanco - s0 >= 100) faltaAnotar = delBanco - s0;
  }
  return { pasan, alCorte, faltaAnotar };
}

/** Los ids de las compras que, por el mínimo corregido del último corte, cuentan para el corte siguiente. */
export function pasanAlSiguiente(d: Datos, cuenta: Cuenta): Set<string> {
  const ciclo = cicloTarjeta(cuenta, d.hoy);
  const corregido = ciclo ? minimoCorregido(cuenta, ciclo.corteAnterior) : null;
  if (!corregido) return new Set();
  return new Set(ajusteMinimo(d, cuenta, corregido)?.pasan.map((m) => m.id) ?? []);
}

export interface EstadoTarjeta {
  /** El último corte y lo que se debía ese día: el «saldo pendiente del mes» sobre el que el banco calcula el mínimo. */
  corte: string;
  alCorte: number;
  /**
   * El pago mínimo de ese corte y de dónde sale: `banco` = el que corrigió el usuario para este corte, `regla` = el
   * calculado con las reglas de la tarjeta, `copiado` = el que puso el usuario en una tarjeta sin reglas; null si no hay.
   */
  minimo: number | null;
  origen: 'banco' | 'regla' | 'copiado' | null;
  /** Con el mínimo del banco: las compras que pasan al corte siguiente y lo que parece faltar por anotar. */
  pasan: Movimiento[];
  faltaAnotar: number | null;
  /** Lo que pasaba del límite al corte: el banco pide abonarlo aparte, así que va sumado al mínimo. */
  exceso: number;
  /** El límite de crédito (si el usuario lo puso) y lo que queda hoy (negativo si se pasó). */
  limite: number | null;
  disponible: number | null;
  /**
   * El sobregiro según el banco: `hasta` = límite + el % que deja pasarse sin cargo (null si no lo publica);
   * `cargo` = lo que cobra al corte si te pasas de ahí. `estado` es el de hoy.
   */
  sobregiro: { porcentaje: number | null; hasta: number | null; cargo: number; estado: 'dentro' | 'permitido' | 'cobra' } | null;
}

/**
 * Cómo está la tarjeta frente al banco: lo que se debía al corte, el pago mínimo, lo disponible y el sobregiro.
 * Pago mínimo (Banco General): el % del saldo al corte, nunca menos del piso ni más de lo que se debe, más lo que
 * pase del límite. Todo es aproximado: sale de lo anotado, no del estado de cuenta.
 */
export function estadoTarjeta(d: Datos, cuenta: Cuenta): EstadoTarjeta | null {
  const ciclo = cicloTarjeta(cuenta, d.hoy);
  if (!ciclo) return null;
  const reglas = reglasTarjeta(d, cuenta);
  const limite = cuenta.limite ?? null;
  const corregido = minimoCorregido(cuenta, ciclo.corteAnterior);
  const ajuste = corregido && reglas?.pago_minimo ? ajusteMinimo(d, cuenta, corregido) : null;
  const alCorte = ajuste ? ajuste.alCorte : deudaAl(d, cuenta, ciclo.corteAnterior);
  const exceso = limite ? Math.max(0, alCorte - limite) : 0;
  let minimo: number | null = null;
  let origen: EstadoTarjeta['origen'] = null;
  if (corregido && reglas?.pago_minimo) {
    minimo = corregido;
    origen = 'banco';
  } else if (reglas?.pago_minimo) {
    minimo = minimoDeRegla(alCorte, limite, reglas.pago_minimo);
    origen = 'regla';
  } else if (cuenta.pago_minimo) {
    minimo = cuenta.pago_minimo;
    origen = 'copiado';
  }
  const deuda = deudaTarjeta(d, cuenta);
  let sobregiro: EstadoTarjeta['sobregiro'] = null;
  if (limite && reglas?.sobregiro) {
    const { permitido, cargo } = reglas.sobregiro;
    const hasta = permitido !== null ? Math.round(limite * (1 + permitido / 100)) : null;
    const estado = deuda <= limite ? 'dentro' : hasta !== null && deuda <= hasta ? 'permitido' : 'cobra';
    sobregiro = { porcentaje: permitido, hasta, cargo, estado };
  }
  return {
    corte: ciclo.corteAnterior, alCorte, minimo, origen, pasan: ajuste?.pasan ?? [], faltaAnotar: ajuste?.faltaAnotar ?? null,
    exceso, limite, disponible: limite ? limite - deuda : null, sobregiro,
  };
}

/** Lo que se le pagó a la tarjeta desde el último corte (todo lo que entró a ella, y lo pagado al crearla si es ese corte). */
export function pagadoDesdeCorte(d: Datos, cuenta: Cuenta, corte: string): number {
  const ini = inicioDeTarjeta(cuenta);
  const alCrearla = ini && ini.corte === corte ? ini.pagos : 0;
  // Todo dinero que entra a la tarjeta es pago: la transferencia hacia ella o un «ingreso» anotado en ella.
  const entra = (m: Movimiento) => (m.tipo === 'transferencia' && m.cuenta_destino_id === cuenta.id) || (m.tipo === 'ingreso' && m.cuenta_id === cuenta.id);
  return alCrearla + d.movimientos.reduce((s, m) => s + (entra(m) && m.fecha > corte ? m.monto : 0), 0);
}

export interface PagoSugerido {
  /** Todo lo que se debe hoy (con lo gastado después del corte). */
  total: number;
  /** Lo que falta del saldo al corte: pagarlo a tiempo evita los intereses. */
  delCorte: number;
  /** Lo que falta del mínimo (null si no se sabe o ya se cubrió). */
  minimo: number | null;
  minimoCubierto: boolean;
  pagado: number;
  fecha: string | null;
}

/**
 * El pago que la app sugiere (nunca lo anota sola): aparece si al último corte se debía algo y todavía no se pagó
 * todo eso. Descuenta lo que ya se pagó desde el corte. El mínimo es el corregido, el de las reglas o el copiado.
 */
export function pagoSugerido(d: Datos, cuenta: Cuenta): PagoSugerido | null {
  const ciclo = cicloTarjeta(cuenta, d.hoy, reglasTarjeta(d, cuenta)?.dias_para_pagar);
  const estado = estadoTarjeta(d, cuenta);
  const deuda = deudaTarjeta(d, cuenta);
  if (!ciclo || !estado || deuda <= 0 || estado.alCorte <= 0) return null;
  const pagado = pagadoDesdeCorte(d, cuenta, ciclo.corteAnterior);
  const delCorte = Math.min(deuda, estado.alCorte - pagado);
  if (delCorte <= 0) return null;
  const falta = estado.minimo !== null ? Math.min(deuda, Math.max(0, estado.minimo - pagado)) : null;
  return { total: deuda, delCorte, minimo: falta && falta > 0 ? falta : null, minimoCubierto: estado.minimo !== null && pagado >= estado.minimo, pagado, fecha: ciclo.fechaPago };
}

/** La categoría que se les pone a los Yappy de ese tipo: la elegida, o la automática (Compras / la primera del tipo). */
export function categoriaYappy(d: Datos, tipo: 'gasto' | 'ingreso'): { categoria: Categoria | undefined; automatica: boolean } {
  const lista = d.categorias.filter((x) => x.tipo === tipo).sort((a, b) => a.orden - b.orden);
  const elegida = lista.find((x) => x.id === d.yappy_categorias?.[tipo]);
  if (elegida) return { categoria: elegida, automatica: false };
  const compras = tipo === 'gasto' ? lista.find((x) => x.id === 'compras') : undefined;
  return { categoria: compras ?? lista[0], automatica: true };
}
