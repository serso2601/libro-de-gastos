// La pastilla que vuela desde el botón + hasta la fila de lo que se acaba de anotar: sale cuando la hoja ya bajó,
// hace un arco, se estira al ancho de la fila y, al llegar, se apaga mientras la fila aparece debajo. Vive encima
// de todas las pantallas y no se puede tocar.

import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { resorte } from './animar';
import { FilaMovimiento } from './componentes';
import { useTema } from './tema';
import { BAJA_LA_HOJA, origenDelVuelo, terminarVuelo, useVuelo } from './vivo';

const ANCHO_INICIAL = 150;
const ALTO_INICIAL = 46;
const ARCO = 60;

export function Vuelo() {
  const v = useVuelo();
  const { width, height } = useWindowDimensions();
  const { c, oscuro } = useTema();
  const p = useSharedValue(0);

  // Sale del + (si no se sabe dónde está, de abajo al centro, donde está en el teléfono).
  const o = origenDelVuelo() ?? { x: width / 2 - 26, y: height - 90, ancho: 52, alto: 52 };
  const ox = o.x + o.ancho / 2;
  const oy = o.y + o.alto / 2;
  const h = v?.hasta ?? { x: 0, y: 0, ancho: 0, alto: 0 };
  // Lo que queda fuera de la pantalla no se ve llegar: ahí la fila aparece sin vuelo.
  const visible = !!v && h.y > 0 && h.y + h.alto < height;

  useEffect(() => {
    if (!v) return;
    if (!visible) {
      v.opacidadFila.value = 1;
      terminarVuelo();
      return;
    }
    const espera = Math.max(0, v.desde + BAJA_LA_HOJA - Date.now());
    p.value = 0;
    p.value = withDelay(espera, withSpring(1, resorte(0.62, 1), (fin) => { if (fin) scheduleOnRN(terminarVuelo); }));
  }, [v, visible, p]);

  // Al final del camino la fila se enciende mientras la pastilla se apaga.
  const fila = v?.opacidadFila;
  useAnimatedReaction(() => p.value, (t) => {
    if (fila && t > 0.9) fila.value = Math.min(1, (t - 0.9) / 0.1);
  }, [fila]);

  const estilo = useAnimatedStyle(() => {
    const t = p.value;
    const k = Math.min(1, Math.max(0, (t - 0.35) / 0.65));
    const w = ANCHO_INICIAL + (h.ancho - ANCHO_INICIAL) * k;
    const alto = ALTO_INICIAL + (h.alto - ALTO_INICIAL) * k;
    const cx = ox + (h.x + h.ancho / 2 - ox) * t;
    const cy = oy + (h.y + h.alto / 2 - oy) * t - Math.sin(Math.PI * Math.min(t, 1)) * ARCO;
    return {
      width: w, height: alto,
      opacity: t <= 0 ? 0 : t < 0.9 ? Math.min(1, t * 6) : Math.max(0, (1 - t) / 0.1),
      transform: [{ translateX: cx - w / 2 }, { translateY: cy - alto / 2 }],
    };
  }, [ox, oy, h.x, h.y, h.ancho, h.alto]);

  if (!v || !visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
      <Animated.View style={[{
        position: 'absolute', left: 0, top: 0, borderRadius: 14, backgroundColor: c.tarjeta, overflow: 'hidden',
        paddingHorizontal: 12, justifyContent: 'center',
        boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 26, color: oscuro ? 'rgba(0,0,0,0.55)' : 'rgba(20,22,28,0.22)' }],
      }, estilo]}>
        <FilaMovimiento m={v.m} primera />
      </Animated.View>
    </View>
  );
}
