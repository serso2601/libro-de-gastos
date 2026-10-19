// Textos de lo que se repite: cuándo viene la próxima vez y cómo se describe una regla. Lo que falta
// del mes se ve arriba en Movimientos; las reglas se editan desde Ajustes o tocando una de ellas.

import type { useDatos } from '@/lib/datos';
import { aFecha, diaCorto, diasHasta, MESES, MESES_CORTOS } from '@/lib/formato';
import { FRECUENCIAS, type Recurrencia } from '@/lib/tipos';

export function cuandoViene(fecha: string, hoy: string): string {
  const dias = diasHasta(fecha, hoy);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias <= 14) return `en ${dias} días`;
  const d = aFecha(fecha);
  return `el ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function textoRegla(r: Recurrencia, d: ReturnType<typeof useDatos>): string {
  const frec = FRECUENCIAS.find(([f]) => f === r.frecuencia)?.[1] ?? '';
  const terminada = !!r.fecha_fin && r.fecha_fin <= d.hoy && !d.proximos.some((p) => p.recurrencia_id === r.id);
  const proximo = d.proximos.find((p) => p.recurrencia_id === r.id);
  return frec + (terminada ? ' · terminó' : proximo ? ` · próxima ${diaCorto(proximo.fecha)} ${MESES_CORTOS[aFecha(proximo.fecha).getMonth()]}` : '');
}
