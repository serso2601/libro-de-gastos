// Las filas de movimientos de las listas que se mueven: al abrir la pantalla entran en cascada (cada una sube y
// aparece un poco después de la anterior), la que se acaba de anotar espera escondida a que le llegue la pastilla
// desde el + (`ui/vuelo.tsx`), la que se borra se desvanece, y las demás abren o cierran el hueco con resorte.
// La lista y los grupos por día que las contienen se acomodan igual, para que nada salte.

import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { ACOMODO, recienAbierta, resorte } from './animar';
import { useTema } from './tema';
import { esNuevo, reclamar, useAnimando, useBorrando } from './vivo';

/** Solo las primeras filas entran en cascada: las de más abajo ni se ven al abrir. */
const EN_CASCADA = 12;
const PASO = 65;
const SUBE = 26;
const SALIDA = FadeOut.duration(220);

export function FilaViva({ id, orden, vez, children }: {
  id: string;
  /** Su lugar en la pantalla (para la cascada). */
  orden: number;
  /** Cuándo se abrió la pantalla (`useVez`): si fue recién, la fila entra en cascada. */
  vez: number;
  children: ReactNode;
}) {
  const animando = useAnimando();
  const borrando = useBorrando(id);
  const enfocada = useIsFocused();
  const [nueva] = useState(() => esNuevo(id));
  // Nace escondida si espera la pastilla o si va a entrar en cascada (así no se ve un cuadro antes de empezar).
  const op = useSharedValue((nueva && enfocada) || (!nueva && recienAbierta(vez) && orden < EN_CASCADA) ? 0 : 1);
  const dy = useSharedValue(0);
  const esc = useSharedValue(1);
  const caja = useRef<ComponentRef<typeof View>>(null);
  const pidio = useRef(false);

  useEffect(() => {
    if (!recienAbierta(vez) || nueva || orden >= EN_CASCADA) return;
    op.value = 0;
    dy.value = SUBE;
    esc.value = 0.97;
    const espera = orden * PASO;
    const r = resorte(0.5, 1);
    op.value = withDelay(espera, withSpring(1, r));
    dy.value = withDelay(espera, withSpring(0, r));
    esc.value = withDelay(espera, withSpring(1, r));
  }, [vez]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si nadie le manda la pastilla (la lista no se ve), aparece sola.
  useEffect(() => {
    if (!nueva) return;
    const t = setTimeout(() => { if (op.value < 1) op.value = withTiming(1, { duration: 200 }); }, 1800);
    return () => clearTimeout(t);
  }, [nueva, op]);

  function alAcomodarse() {
    if (!nueva || !enfocada || pidio.current) return;
    pidio.current = true;
    caja.current?.measureInWindow((x, y, ancho, alto) => {
      if (!reclamar(id, { x, y, ancho, alto }, op)) op.value = 1;
    });
  }

  const estilo = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: dy.value }, { scale: esc.value }] }));
  return (
    <Animated.View ref={caja} onLayout={alAcomodarse} style={estilo}
      layout={animando ? ACOMODO : undefined} exiting={borrando ? SALIDA : undefined}>
      {children}
    </Animated.View>
  );
}

/** Una `Lista` (tarjeta con filas) que se estira o se encoge con resorte cuando entra o sale una fila. */
export function ListaViva({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, estilo } = useTema();
  const animando = useAnimando();
  return (
    <Animated.View layout={animando ? ACOMODO : undefined}
      style={[{ backgroundColor: c.tarjeta, borderRadius: estilo.m.esquinas, paddingHorizontal: 16, paddingVertical: 2 }, style]}>
      {children}
    </Animated.View>
  );
}

/** Un bloque (el grupo de un día, por ejemplo) que se corre con resorte cuando cambia lo de arriba. */
export function GrupoVivo({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const animando = useAnimando();
  return <Animated.View layout={animando ? ACOMODO : undefined} style={style}>{children}</Animated.View>;
}
