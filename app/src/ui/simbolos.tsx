// El símbolo de una categoría. `categoria.emoji` guarda un símbolo de la app ('i:<clave>'), un emoji
// cualquiera, o '💰' (el valor de siempre, que quiere decir «sin elegir»: se muestra la inicial).

import { Text, View } from 'react-native';
import type { Categoria } from '@/lib/tipos';
import { inicialDe } from '@/lib/formato';
import { Texto } from './componentes';
import { useTema } from './tema';

/** Los símbolos predeterminados: clave → nombre para leerlo (accesibilidad y el elegidor). */
export const SIMBOLOS: Record<string, string> = {};

/** Un símbolo dibujado con líneas, del color que se le pase. Sin dibujo para la clave → null. */
export function Simbolo(_p: { clave: string; tam: number; color: string }) {
  return null;
}

export const esSimbolo = (emoji: string) => emoji.startsWith('i:') && emoji.slice(2) in SIMBOLOS;
export const sinElegir = (emoji: string) => !emoji || emoji === '💰' || (emoji.startsWith('i:') && !esSimbolo(emoji));

/** El cuadrito de una categoría: su símbolo o su emoji sobre el pastel de su color; si no, la inicial. */
export function SimboloCategoria({ categoria, tam = 36, redondo = false }: {
  categoria: Pick<Categoria, 'nombre' | 'color' | 'emoji'>; tam?: number; redondo?: boolean;
}) {
  const { pastel } = useTema();
  const fondo = pastel(categoria.color);
  const caja = { width: tam, height: tam, borderRadius: redondo ? tam / 2 : Math.round(tam * 0.28), backgroundColor: fondo, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (esSimbolo(categoria.emoji)) {
    return <View style={caja}><Simbolo clave={categoria.emoji.slice(2)} tam={Math.round(tam * 0.56)} color={categoria.color} /></View>;
  }
  if (!sinElegir(categoria.emoji)) {
    return <View style={caja}><Text style={{ fontSize: Math.round(tam * 0.5) }}>{categoria.emoji}</Text></View>;
  }
  return <View style={caja}><Texto tam={Math.round(tam * 0.4)} peso="semi">{inicialDe(categoria.nombre || '?')}</Texto></View>;
}
