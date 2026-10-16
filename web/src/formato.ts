import type { Cuenta, Movimiento } from './tipos';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dos = (n: number) => String(n).padStart(2, '0');

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function hoyISO(): string {
  return fechaISO(new Date());
}

/** Centavos → "$1,234.56" (formato de Panamá). */
export function dinero(centavos: number, moneda: string): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos) / 100;
  return `${signo}${moneda}${abs.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Lo que escribe el usuario ("12.5", "12,50") → centavos. NaN si no es un número. */
export function aCentavos(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(limpio) || limpio === '' || limpio === '.') return NaN;
  return Math.round(parseFloat(limpio) * 100);
}

export function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function etiquetaDia(iso: string, hoy: string): string {
  if (iso === hoy) return 'Hoy';
  const ayer = aFecha(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (iso === fechaISO(ayer)) return 'Ayer';
  const d = aFecha(iso);
  const semana = d.toLocaleDateString('es-PA', { weekday: 'long' });
  return `${semana}, ${d.getDate()} de ${MESES_CORTOS[d.getMonth()]}`;
}

export function etiquetaCorta(iso: string): string {
  const d = aFecha(iso);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

export function diasHasta(iso: string, hoy: string): number {
  return Math.round((aFecha(iso).getTime() - aFecha(hoy).getTime()) / 86_400_000);
}

export function saldo(cuenta: Cuenta, movimientos: Movimiento[]): number {
  let s = cuenta.saldo_inicial;
  for (const m of movimientos) {
    if (m.cuenta_id === cuenta.id) s += m.tipo === 'ingreso' ? m.monto : -m.monto;
    if (m.cuenta_destino_id === cuenta.id) s += m.monto;
  }
  return s;
}

export function ordenarPorFecha(a: Movimiento, b: Movimiento): number {
  return (b.fecha + (b.hora ?? '')).localeCompare(a.fecha + (a.hora ?? ''));
}

export function nuevoId(): string {
  // randomUUID solo existe con HTTPS; por http (pruebas en la red local) se arma uno a mano.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
