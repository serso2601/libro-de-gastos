// Cambiar de mes (o de periodo) como pasar una página: lo de antes se va entero hacia un lado y lo nuevo entra por
// el otro, con el resorte de la pila. Lo de antes es una copia de lo último que se dibujó, que se va y se borra.
// La dirección sale de comparar las claves ('2026-10' < '2026-11'): hacia adelante, lo nuevo entra por la derecha.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import Animated, { withSpring } from 'react-native-reanimated';
import { resorte } from './animar';

const PASO = resorte(0.45, 1);

const entra = (desde: number) => () => {
  'worklet';
  return { initialValues: { transform: [{ translateX: desde }] }, animations: { transform: [{ translateX: withSpring(0, PASO) }] } };
};
const sale = (hasta: number) => () => {
  'worklet';
  return { initialValues: { transform: [{ translateX: 0 }] }, animations: { transform: [{ translateX: withSpring(hasta, PASO) }] } };
};

/** En la web, Reanimated no corre animaciones de entrada hechas a mano: ahí el mes cambia sin más. */
export function Deslizar({ clave, children }: { clave: string; children: ReactNode }) {
  return Platform.OS === 'web' ? <>{children}</> : <DeslizarNativo clave={clave}>{children}</DeslizarNativo>;
}

function DeslizarNativo({ clave, children }: { clave: string; children: ReactNode }) {
  const ultimo = useRef<ReactNode>(children);
  const [vista, setVista] = useState(clave);
  const [saliente, setSaliente] = useState<{ nodo: ReactNode; dir: 1 | -1; n: number } | null>(null);
  const [ancho, setAncho] = useState(0);
  if (vista !== clave) {
    setVista(clave);
    setSaliente({ nodo: ultimo.current, dir: clave > vista ? 1 : -1, n: (saliente?.n ?? 0) + 1 });
  }
  useEffect(() => { ultimo.current = children; });
  useEffect(() => {
    if (!saliente) return;
    const t = setTimeout(() => setSaliente(null), 900);
    return () => clearTimeout(t);
  }, [saliente]);

  const w = ancho || 400;
  const dir = saliente?.dir ?? 1;
  return (
    <View style={{ overflow: 'hidden' }} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      <Animated.View key={clave} entering={saliente ? entra(dir * w) : undefined}>{children}</Animated.View>
      {saliente && (
        <Animated.View key={`sale-${saliente.n}`} pointerEvents="none" entering={sale(-dir * w)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          {saliente.nodo}
        </Animated.View>
      )}
    </View>
  );
}
