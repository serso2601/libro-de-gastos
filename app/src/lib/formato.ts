import { randomUUID } from 'expo-crypto';
import type { Cuenta, Movimiento } from './tipos';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n: number) => String(n).padStart(2, '0');

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function horaTexto(d: Date): string {
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Centavos → "$1,234.56" (formato de Panamá). Hecho a mano: Hermes no siempre trae los locales. */
export function dinero(centavos: number, moneda: string): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(centavos));
  const enteros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}${moneda}${enteros}.${dos(abs % 100)}`;
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

export function etiquetaDia(iso: string, hoy: string): string {
  if (iso === hoy) return 'Hoy';
  const ayer = aFecha(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (iso === fechaISO(ayer)) return 'Ayer';
  const d = aFecha(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_CORTOS[d.getMonth()]}`;
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
  return randomUUID();
}
