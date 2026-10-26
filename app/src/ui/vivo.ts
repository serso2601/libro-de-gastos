// Lo que las listas necesitan saber para animar un cambio: qué movimiento se acaba de anotar (para que vuele
// desde el + hasta su fila), cuál se está borrando (para que su fila se desvanezca) y si en este momento las
// filas deben acomodarse con resorte. Esto último vale mientras la hoja de anotar está abierta y un rato después
// de cerrarla: así, buscar o filtrar no anima nada, pero lo que se anota o se borra sí.

import { useSyncExternalStore } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { Movimiento } from '@/lib/tipos';

/** Lo que tarda la hoja de iOS en bajar: recién ahí se ve la lista, y entonces vuela o se borra. */
export const BAJA_LA_HOJA = 420;
const SIGUE_ANIMANDO = 1800;

export interface Rect { x: number; y: number; ancho: number; alto: number }
export interface Vuelo { m: Movimiento; hasta: Rect; desde: number; opacidadFila: SharedValue<number> }

let nuevo: { m: Movimiento; desde: number } | null = null;
let vuelo: Vuelo | null = null;
let origen: Rect | null = null;
let borrando: string | null = null;
let hojas = 0;
let animando = false;
let apagar: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

function cambio() {
  oyentes.forEach((f) => f());
}
function suscribir(f: () => void) {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}
function ponerAnimando(si: boolean) {
  clearTimeout(apagar);
  if (si) {
    if (!animando) { animando = true; cambio(); }
    return;
  }
  apagar = setTimeout(() => { if (hojas === 0) { animando = false; cambio(); } }, SIGUE_ANIMANDO);
}

/** La hoja de anotar se abrió; lo que devuelve se llama al cerrarla. */
export function abrirHoja(): () => void {
  hojas++;
  ponerAnimando(true);
  return () => {
    hojas = Math.max(0, hojas - 1);
    cerradaEn = Date.now();
    if (hojas === 0) ponerAnimando(false);
  };
}
let cerradaEn = 0;

/** Cuánto falta para que la hoja termine de bajar (0 si no hay hoja): lo que cambia detrás espera eso para animarse. */
export function esperaPorLaHoja(): number {
  return hojas > 0 ? BAJA_LA_HOJA : Math.max(0, cerradaEn + BAJA_LA_HOJA - Date.now());
}

/** Se anotó `m`: su fila nace escondida y espera a que le llegue la pastilla desde el +. */
export function anunciarNuevo(m: Movimiento) {
  nuevo = { m, desde: Date.now() };
}
export function esNuevo(id: string): boolean {
  return !!nuevo && nuevo.m.id === id && Date.now() - nuevo.desde < 3000;
}

/** La fila del nuevo, ya en su lugar, pide la pastilla. Solo la primera que la pide la recibe. */
export function reclamar(id: string, hasta: Rect, opacidadFila: SharedValue<number>): boolean {
  if (!nuevo || nuevo.m.id !== id) return false;
  vuelo = { m: nuevo.m, hasta, desde: nuevo.desde, opacidadFila };
  nuevo = null;
  cambio();
  return true;
}
export function terminarVuelo() {
  vuelo = null;
  cambio();
}

/** Dónde está el botón + (la pastilla sale de ahí). */
export function registrarOrigen(r: Rect) {
  origen = r;
}
export const origenDelVuelo = () => origen;

/** Se va a borrar `id`: su fila se marca para desvanecerse cuando el dato desaparezca. */
export function anunciarBorrado(id: string) {
  borrando = id;
  ponerAnimando(true);
  ponerAnimando(false);
  cambio();
}

export const useAnimando = () => useSyncExternalStore(suscribir, () => animando);
export const useBorrando = (id: string) => useSyncExternalStore(suscribir, () => borrando === id);
export const useVuelo = () => useSyncExternalStore(suscribir, () => vuelo);
