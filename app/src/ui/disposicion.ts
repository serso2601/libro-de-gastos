// Cómo se reparte la pantalla según su ancho. En el teléfono (y en la web en un teléfono) todo va en una
// columna con la barra abajo. En la web, en algo más ancho (iPad, computadora), la barra pasa al costado
// —un riel de íconos, o con nombres si hay espacio— y, si el contenido da para dos columnas, cada pantalla
// pone lado a lado lo que en el teléfono va una cosa debajo de otra.

import { useWindowDimensions } from 'react-native';
import { ESTILO } from './estilos';

/** Ancho de la ventana desde el que la barra va al costado. */
const LATERAL_DESDE = 700;
/** Ancho de la ventana desde el que la barra lateral lleva los nombres al lado de los íconos. */
const BARRA_ANCHA_DESDE = 1100;
export const ANCHO_RIEL = 88;
export const ANCHO_BARRA = 232;
/** El contenido no pasa de esto (con márgenes): en una pantalla grande queda al centro. */
export const ANCHO_MAXIMO = 1160;
/** Ancho del contenido desde el que una pantalla va en dos columnas. */
const DOS_COLUMNAS_DESDE = 760;
/** Lo que mide una lista (Movimientos, Ajustes) cuando va sola en una pantalla ancha: más ancha se lee mal. */
export const ANCHO_LECTURA = 640;
/** La columna de la izquierda (la pila de tarjetas, el calendario, el periodo del presupuesto) en dos columnas. */
export const ANCHO_COLUMNA = 420;
/** El Inicio se parte en dos desde un contenido más angosto: estiradas a lo ancho, las tarjetas pierden su forma. */
const INICIO_PARTIDO_DESDE = 640;

export interface Disposicion {
  /** La barra va al costado y las hojas salen como ventana al centro. */
  lateral: boolean;
  /** La barra lateral lleva los nombres (si no, es un riel de íconos). */
  barraAncha: boolean;
  margen: number;
  /** Lo que mide el contenido de una pantalla, sin márgenes. */
  contenido: number;
  dosColumnas: boolean;
  /** En el Inicio: el ancho de la columna de la izquierda (la pila o el calendario), o null si va en una sola. */
  columnaInicio: number | null;
}

export function useDisposicion(): Disposicion {
  const { width } = useWindowDimensions();
  const lateral = width >= LATERAL_DESDE;
  const barraAncha = width >= BARRA_ANCHA_DESDE;
  const margen = lateral ? 28 : ESTILO.m.margen;
  const libre = Math.min(width - (lateral ? (barraAncha ? ANCHO_BARRA : ANCHO_RIEL) : 0), ANCHO_MAXIMO);
  const contenido = libre - margen * 2;
  const columnaInicio = lateral && contenido >= INICIO_PARTIDO_DESDE ? Math.min(ANCHO_COLUMNA, Math.round(contenido * 0.55)) : null;
  return { lateral, barraAncha, margen, contenido, dosColumnas: contenido >= DOS_COLUMNAS_DESDE, columnaInicio };
}

/** Una hoja o aviso abierto como ventana al centro (en una pantalla ancha). */
export const VENTANA = { width: '100%', maxWidth: 560, borderRadius: 26 } as const;

/** Cuántas columnas caben de cuadros de al menos `minimo` px (con `gap` entre ellos), entre `desde` y `hasta`. */
export function columnasPara(contenido: number, minimo: number, gap: number, desde = 2, hasta = 5): number {
  return Math.max(desde, Math.min(hasta, Math.floor((contenido + gap) / (minimo + gap))));
}
