// Las animaciones chicas de la app (filas, botones, vasos, meses) van con Reanimated: corren en el hilo que
// dibuja, así no se traban aunque el código esté ocupado. Usan el mismo resorte que la pila (`ui/resorte.ts`):
// respuesta (segundos que tarda en llegar) y amortiguación (1 = sin rebote; menos de 1 rebota).

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { LinearTransition } from 'react-native-reanimated';

const rigidez = (resp: number) => (2 * Math.PI / resp) ** 2;
const freno = (resp: number, amort: number) => (4 * Math.PI * amort) / resp;

/** La configuración de `withSpring` para un resorte de respuesta `resp` y amortiguación `amort`. */
export function resorte(resp = 0.5, amort = 1, velocity?: number) {
  return { mass: 1, stiffness: rigidez(resp), damping: freno(resp, amort), velocity };
}

/** Cómo se acomodan las filas y las listas cuando entra o sale una (abren o cierran el hueco). */
export const ACOMODO = LinearTransition.springify().mass(1).stiffness(rigidez(0.45)).damping(freno(0.45, 1));

/** Cuándo se abrió la pantalla (en ms): cambia cada vez que gana el foco, también la primera. */
export function useVez(): number {
  const [vez, setVez] = useState(0);
  useFocusEffect(useCallback(() => { setVez(Date.now()); }, []));
  return vez;
}

/** Si la pantalla se acaba de abrir: lo que aparece mucho después (un filtro, «Ver más») ya no entra animado. */
export const recienAbierta = (vez: number) => vez > 0 && Date.now() - vez < 600;
