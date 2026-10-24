import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import type { Cuenta, Movimiento } from './tipos';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

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
/** Sin centavos ("$412"), para leyendas y topes. Redondea. */
export function dineroCorto(centavos: number, moneda: string): string {
  const signo = centavos < 0 ? '−' : '';
  return `${signo}${moneda}${String(Math.round(Math.abs(centavos) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Con signo de gasto o ingreso: "−$46.80", "+$1,225.00". */
export function conSigno(centavos: number, moneda: string, tipo: 'gasto' | 'ingreso' | 'transferencia'): string {
  return `${tipo === 'gasto' ? '−' : tipo === 'ingreso' ? '+' : ''}${dinero(Math.abs(centavos), moneda)}`;
}

/** Un saldo o neto: "−$420.15" con el menos tipográfico. */
export function neto(centavos: number, moneda: string, conMas = false): string {
  return `${centavos < 0 ? '−' : conMas && centavos > 0 ? '+' : ''}${dinero(Math.abs(centavos), moneda)}`;
}

export const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** La primera letra (o emoji entero) de un nombre, en mayúscula. */
export const inicialDe = (nombre: string) => (Array.from(nombre.trim())[0] ?? '?').toUpperCase();

/** "Hoy, viernes 16", "Ayer, jueves 15", "Miércoles 14" o, si es de otro mes, "Martes 30 de sep". */
export function tituloDia(iso: string, hoy: string): string {
  const d = aFecha(iso);
  const nombre = `${DIAS[d.getDay()]} ${d.getDate()}`;
  if (iso === hoy) return `Hoy, ${nombre}`;
  const ayer = aFecha(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (iso === fechaISO(ayer)) return `Ayer, ${nombre}`;
  return mayuscula(iso.slice(0, 7) === hoy.slice(0, 7) ? nombre : `${nombre} de ${MESES_CORTOS[d.getMonth()]}`);
}

/** "dom 18" */
export function diaCorto(iso: string): string {
  const d = aFecha(iso);
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
}

/** "dom" */
export function nombreDiaCorto(iso: string): string {
  return DIAS_CORTOS[aFecha(iso).getDay()];
}

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
  if (Platform.OS !== 'web' || typeof globalThis.crypto.randomUUID === 'function') return randomUUID();
  // En la web por http (el iPad por Tailscale) el navegador no da randomUUID: se arma uno v4 igual.
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
