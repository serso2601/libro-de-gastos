// El saldo grande del Inicio cuando cambia (se anotó o se borró algo): el número nuevo late una vez, se tiñe un
// momento del color de lo que pasó y, junto al rótulo, sale una etiqueta con la diferencia que sube y se apaga.
// Al abrir la app o al cambiar qué saldo se ve, no se anima nada.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { resorte } from './animar';
import { Num, Texto } from './componentes';
import { alfa } from './tema';
import { esperaPorLaHoja } from './vivo';

/** Cuánto cambió `valor` la última vez (mientras se mire la misma `forma` de saldo); `vez` es cuándo. */
export function useCambio(forma: string, valor: number): { delta: number; vez: number } | null {
  const antes = useRef({ forma, valor });
  const [cambio, setCambio] = useState<{ delta: number; vez: number } | null>(null);
  useEffect(() => {
    const a = antes.current;
    antes.current = { forma, valor };
    if (a.forma === forma && a.valor !== valor) setCambio({ delta: valor - a.valor, vez: Date.now() });
  }, [forma, valor]);
  return cambio;
}

/** El número grande que late. `tinte` es el color del momento; `vez` cambia con cada cambio. */
export function NumeroQueLate({ children, tam, color, tinte, vez }: { children: ReactNode; tam: number; color: string; tinte: string; vez: number }) {
  const esc = useSharedValue(1);
  const tinta = useSharedValue(0);
  useEffect(() => {
    if (!vez) return;
    const espera = esperaPorLaHoja();
    esc.value = withDelay(espera, withSequence(withTiming(1.05, { duration: 110 }), withSpring(1, resorte(0.32, 0.5))));
    tinta.value = withDelay(espera, withSequence(withTiming(1, { duration: 60 }), withDelay(200, withTiming(0, { duration: 1000 }))));
  }, [vez, esc, tinta]);
  const latido = useAnimatedStyle(() => ({ transform: [{ scale: esc.value }] }));
  const encima = useAnimatedStyle(() => ({ opacity: tinta.value }));
  return (
    <Animated.View style={[{ transformOrigin: 'left center' }, latido]}>
      <Num tam={tam} color={color} lineas={1}>{children}</Num>
      {/* El mismo número en el color del cambio, encima, que se apaga. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, encima]}>
        <Num tam={tam} color={tinte} lineas={1}>{children}</Num>
      </Animated.View>
    </Animated.View>
  );
}

/** La etiqueta con la diferencia: aparece subiendo, se queda un momento y se va hacia arriba apagándose. */
export function EtiquetaCambio({ texto, color, vez }: { texto: string; color: string; vez: number }) {
  const op = useSharedValue(0);
  const dy = useSharedValue(8);
  useEffect(() => {
    if (!vez) return;
    const espera = esperaPorLaHoja();
    op.value = withDelay(espera, withSequence(withTiming(1, { duration: 220 }), withDelay(1100, withTiming(0, { duration: 420 }))));
    dy.value = 8;
    dy.value = withDelay(espera, withSequence(withSpring(0, resorte(0.35, 1)), withDelay(900, withTiming(-6, { duration: 420 }))));
  }, [vez, op, dy]);
  const estilo = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: dy.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: alfa(color, 0.16) }, estilo]}>
      <Texto num tam={13} peso="semi" color={color}>{texto}</Texto>
    </Animated.View>
  );
}
