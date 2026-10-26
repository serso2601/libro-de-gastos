// Lo que se toca y responde al dedo: al apretar se achica (a 92 %) y al soltar vuelve pasándose un poco, con
// rebote. En lo ancho (un botón de lado a lado, una tarjeta) se achica menos: nunca más de 8 px por lado, para que
// no parezca que se hunde la pantalla.

import { useState, type ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type LayoutChangeEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { resorte } from './animar';

const PresionableAnimado = Animated.createAnimatedComponent(Pressable);
const BAJA = resorte(0.16, 1);
const SUBE = resorte(0.42, 0.45);

export function Tocable({ escala = 0.92, style, onPressIn, onPressOut, onLayout, children, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  /** Hasta dónde se achica al apretar. */
  escala?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const s = useSharedValue(1);
  const [ancho, setAncho] = useState(0);
  const minimo = ancho > 0 ? Math.max(escala, 1 - 16 / ancho) : escala;
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <PresionableAnimado {...props}
      onLayout={(e: LayoutChangeEvent) => { setAncho(e.nativeEvent.layout.width); onLayout?.(e); }}
      onPressIn={(e: GestureResponderEvent) => { s.value = withSpring(minimo, BAJA); onPressIn?.(e); }}
      onPressOut={(e: GestureResponderEvent) => { s.value = withSpring(1, SUBE); onPressOut?.(e); }}
      style={[style, estilo]}>
      {children}
    </PresionableAnimado>
  );
}
