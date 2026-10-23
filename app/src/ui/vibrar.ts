// Vibraciones sin amontonarlas. Cada vibración de expo-haptics corre en el hilo principal (el mismo que dibuja),
// crea un generador nuevo y lo prepara antes de disparar; con toques muy rápidos se apilan y la pantalla se
// atrasa hasta que terminan. Aquí se deja pasar una cada tanto y las que sobran se descartan.

import * as Haptics from 'expo-haptics';

export type Vibracion = 'suave' | 'seleccion' | 'firme';

let ultima = 0;

/** Vibra, salvo que ya haya vibrado hace menos de `espera` ms (por defecto 120). */
export function vibrar(tipo: Vibracion, espera = 120): void {
  const ahora = Date.now();
  if (ahora - ultima < espera) return;
  ultima = ahora;
  if (tipo === 'seleccion') Haptics.selectionAsync();
  else Haptics.impactAsync(tipo === 'suave' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
}
