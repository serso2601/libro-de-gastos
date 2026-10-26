// La tarjeta de arriba del Inicio sigue la inclinación del teléfono: se ladea unos pocos grados y un brillo se
// corre sobre ella, como una tarjeta de verdad bajo la luz. La postura «quieta» se va acomodando sola a como
// tengas el teléfono, así que en reposo la tarjeta queda derecha y sin brillo. Solo con la pila cerrada, con el
// Inicio a la vista y en el teléfono (en la web, Safari no da los sensores por http).

import { DeviceMotion } from 'expo-sensors';
import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { resorte } from './animar';

/** Grados que se ladea como mucho, y cuánto hay que inclinar el teléfono (en radianes) para llegar ahí. */
const MAXIMO = 4;
const RECORRIDO = 0.35;
/** Qué tan rápido la postura quieta alcanza a la del teléfono (por lectura, 20 por segundo). */
const ACOMODA = 0.02;
const SIGUE = resorte(0.3, 1);

const acotar = (x: number) => Math.max(-1, Math.min(1, x));

export function useInclinacion(activa: boolean): { rx: SharedValue<number>; ry: SharedValue<number> } {
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const enfocada = useIsFocused();
  useEffect(() => {
    if (!activa || !enfocada || Platform.OS === 'web') {
      rx.value = withSpring(0, SIGUE);
      ry.value = withSpring(0, SIGUE);
      return;
    }
    let vivo = true;
    let sub: { remove: () => void } | undefined;
    let quieta: { b: number; g: number } | null = null;
    DeviceMotion.isAvailableAsync().then((hay) => {
      if (!hay || !vivo) return;
      DeviceMotion.setUpdateInterval(50);
      sub = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const { beta, gamma } = rotation;
        if (!quieta) quieta = { b: beta, g: gamma };
        quieta.b += (beta - quieta.b) * ACOMODA;
        quieta.g += (gamma - quieta.g) * ACOMODA;
        rx.value = withSpring(-acotar((beta - quieta.b) / RECORRIDO) * MAXIMO, SIGUE);
        ry.value = withSpring(acotar((gamma - quieta.g) / RECORRIDO) * MAXIMO, SIGUE);
      });
    }).catch(() => {});
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, [activa, enfocada, rx, ry]);
  return { rx, ry };
}

/** Lo de dentro de la tarjeta, ladeado según `rx`/`ry`, con el brillo encima. `fondo` es el color de la tarjeta. */
export function CapaInclinada({ rx, ry, fondo, children }: { rx: SharedValue<number>; ry: SharedValue<number>; fondo: string; children: ReactNode }) {
  const ladeo = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }));
  // El brillo se corre hacia donde se inclina y se enciende más cuanto más se inclina.
  const luz = useAnimatedStyle(() => ({
    opacity: Math.min(1, (Math.abs(rx.value) + Math.abs(ry.value)) / MAXIMO),
    transform: [{ translateX: ry.value * 22 }, { translateY: -rx.value * 22 }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: fondo, borderRadius: 22 }, ladeo]}>
      {children}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: '-25%', top: '-25%', width: '150%', height: '150%' }, luz]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="luz" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#luz)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
