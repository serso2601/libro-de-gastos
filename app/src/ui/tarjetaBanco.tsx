// Las tarjetas del banco dibujadas (con los colores de `diseno` en bancos.json; un dibujo aproximado, no la imagen
// del banco) y el selector en pila de la hoja de la cuenta: como la pila del Inicio, las tarjetas quedan una encima
// de otra, asomando su nombre; tocar una la elige y la pila se cierra sobre ella. Tocar la elegida la vuelve a abrir.

import * as Haptics from 'expo-haptics';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { DisenoTarjeta } from '@/lib/tipos';
import { resorte } from './animar';
import { Enlace, Texto } from './componentes';
import { mezclar, sobre, useTema } from './tema';
import { Tocable } from './tocable';

const PROPORCION = 1.586; // la de una tarjeta de verdad (85.6 × 54 mm)
const PASO = 50;          // lo que asoma de cada tarjeta con la pila abierta
const RESORTE = resorte(0.5, 1);

/** «Crédito Estrellas Classic/Gold» → «Estrellas Classic/Gold»: en la tarjeta ya se ve que es de crédito. */
export function nombreCorto(nombre: string): string {
  return nombre.replace(/^Crédito\s+/i, '');
}

/** El diseño de una tarjeta que no está en el catálogo: con el color de la cuenta. */
export function disenoConColor(color: string): DisenoTarjeta {
  return { fondo: [mezclar(color, '#000000', 0.3), color], tinta: sobre(color) };
}

/** La marca de la red, dibujada: «VISA» en cursiva o los dos círculos de Mastercard. */
function Red({ red, tinta }: { red: DisenoTarjeta['red']; tinta: string }) {
  if (red === 'visa') return <Texto tam={20} peso="semi" color={tinta} style={{ fontStyle: 'italic', letterSpacing: 1 }}>VISA</Texto>;
  if (red === 'mastercard') {
    return (
      <Svg width={46} height={28}>
        <Circle cx={15} cy={14} r={13} fill="#EB001B" fillOpacity={0.92} />
        <Circle cx={31} cy={14} r={13} fill="#F79E1B" fillOpacity={0.88} />
      </Svg>
    );
  }
  return null;
}

/** Una tarjeta dibujada: el nombre arriba (lo que asoma en la pila), el chip, los 4 dígitos y la red. */
export function DibujoTarjeta({ banco, nombre, diseno, clase, terminacion, ancho }: {
  banco: string; nombre: string; diseno: DisenoTarjeta; clase?: 'credito' | 'debito'; terminacion?: string | null; ancho: number;
}) {
  const id = `t${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const alto = Math.round(ancho / PROPORCION);
  const { fondo: [a, b], tinta } = diseno;
  return (
    <View style={{ width: ancho, height: alto, borderRadius: 16, overflow: 'hidden', backgroundColor: b }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
          <LinearGradient id={`${id}b`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}b)`} />
        <Circle cx={ancho * 0.92} cy={alto * 1.05} r={alto * 0.55} stroke={tinta} strokeOpacity={0.1} strokeWidth={16} fill="none" />
      </Svg>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 14, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Texto tam={15} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{nombre}</Texto>
          <Texto tam={12} peso="medio" color={tinta} lineas={1} style={{ opacity: 0.8, maxWidth: '45%' }}>{banco}</Texto>
        </View>
        {/* El chip. */}
        <View style={{ width: 40, height: 30, borderRadius: 6, backgroundColor: '#D9B866', opacity: 0.9, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 1, backgroundColor: '#8C7438' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 19, height: 1, backgroundColor: '#8C7438' }} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 14, width: 1, backgroundColor: '#8C7438' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Texto num tam={15} peso="medio" color={tinta} style={{ letterSpacing: 1.5 }}>•••• {terminacion || '····'}</Texto>
            {clase && <Texto tam={11} color={tinta} style={{ opacity: 0.75 }}>{clase === 'credito' ? 'Crédito' : 'Débito'}</Texto>}
          </View>
          <Red red={diseno.red} tinta={tinta} />
        </View>
      </View>
    </View>
  );
}

/** La tarjeta dibujada a todo el ancho de donde está. */
export function TarjetaMedida(props: Omit<Parameters<typeof DibujoTarjeta>[0], 'ancho'>) {
  const [ancho, setAncho] = useState(0);
  return (
    <View onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}>
      {ancho > 0 ? <DibujoTarjeta {...props} ancho={ancho} /> : <View style={{ aspectRatio: PROPORCION }} />}
    </View>
  );
}

export interface OpcionTarjeta { id: string; nombre: string; diseno?: DisenoTarjeta }

/**
 * Una tarjeta dentro de la pila: abierta, en su lugar (i × PASO), tapando la mitad de abajo de la anterior; cerrada,
 * la elegida sola arriba (`arriba`) y las demás se esconden detrás.
 */
function EnLaPila({ i, elegida, arriba, ab, ancho, children, onPress, etiqueta }: {
  i: number; elegida: boolean; arriba: boolean; ab: SharedValue<number>; ancho: number; children: ReactNode; onPress: () => void; etiqueta: string;
}) {
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(ab.value, [0, 1], [elegida ? 0 : Math.min(i, 3) * 6, i * PASO]) }],
    opacity: elegida ? 1 : interpolate(ab.value, [0, 0.6, 1], [0, 0.7, 1]),
  }));
  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, top: 0, width: ancho, zIndex: arriba ? 1000 : i }, estilo]}>
      <Tocable onPress={onPress} escala={0.97} accessibilityLabel={etiqueta}
        style={{ borderRadius: 16, boxShadow: [{ offsetX: 0, offsetY: -2, blurRadius: 10, spreadDistance: 0, color: 'rgba(0,0,0,0.22)' }] }}>
        {children}
      </Tocable>
    </Animated.View>
  );
}

/**
 * Elegir la tarjeta del banco en una pila. Sin ninguna elegida, la pila queda abierta. `ninguna` agrega arriba la
 * opción de no tener tarjeta (débito).
 */
export function ElegirTarjetaBanco({ banco, tarjetas, valor, alCambiar, clase, terminacion, color, ninguna }: {
  banco: string; tarjetas: OpcionTarjeta[]; valor: string | null; alCambiar: (id: string | null) => void;
  clase: 'credito' | 'debito'; terminacion?: string | null; color: string; ninguna?: string;
}) {
  const { c } = useTema();
  const [ancho, setAncho] = useState(0);
  const [abierta, setAbierta] = useState(valor === null);
  const ab = useSharedValue(valor === null ? 1 : 0);
  const elegidaI = tarjetas.findIndex((t) => t.id === valor);
  const hayElegida = elegidaI >= 0;
  const abiertaDe = abierta || !hayElegida;
  useEffect(() => { ab.value = withSpring(abiertaDe ? 1 : 0, RESORTE); }, [abiertaDe, ab]);
  const alto = Math.round(ancho / PROPORCION);
  const n = tarjetas.length;
  const caja = useAnimatedStyle(() => ({ height: interpolate(ab.value, [0, 1], [alto + Math.min(n - 1, 3) * 6, (n - 1) * PASO + alto]) }));

  function tocar(id: string) {
    Haptics.selectionAsync();
    if (!abiertaDe && id === valor) { setAbierta(true); return; }
    alCambiar(id);
    setAbierta(false);
  }

  return (
    <View style={{ gap: 10 }} onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 20 }}>
        <Texto tam={13} color={c.tenue}>{abiertaDe ? 'Toca la tuya' : 'Toca la tarjeta para cambiarla'}</Texto>
        {ninguna && hayElegida && <Enlace onPress={() => { alCambiar(null); setAbierta(true); }}>{ninguna}</Enlace>}
      </View>
      {ancho > 0 && (
        <Animated.View style={[{ width: ancho }, caja]}>
          {tarjetas.map((t, i) => (
            <EnLaPila key={t.id} i={i} elegida={i === elegidaI} arriba={i === elegidaI && !abiertaDe} ab={ab} ancho={ancho} onPress={() => tocar(t.id)}
              etiqueta={`${t.nombre}${i === elegidaI ? ', elegida' : ''}`}>
              <DibujoTarjeta banco={banco} nombre={nombreCorto(t.nombre)} diseno={t.diseno ?? disenoConColor(color)} clase={clase}
                terminacion={i === elegidaI ? terminacion : null} ancho={ancho} />
            </EnLaPila>
          ))}
        </Animated.View>
      )}
    </View>
  );
}
