// Elegir otro mes desde el título del calendario: el año con flechas y los doce meses.

import * as Haptics from 'expo-haptics';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Grilla } from '@/dialogos/piezas';
import { MESES_CORTOS, mayuscula } from '@/lib/formato';
import { Texto } from './componentes';
import { COLUMNA_WEB } from './estilos';
import { Icono } from './iconos';
import { useTema } from './tema';

export function ElegirMes({ visible, anio, mes, hoy, alElegir, alCerrar }: {
  visible: boolean; anio: number; mes: number; hoy: string; alElegir: (anio: number, mes: number) => void; alCerrar: () => void;
}) {
  const { c, estilo } = useTema();
  const abajo = useSafeAreaInsets().bottom;
  const [viendo, setViendo] = useState(anio);
  const [anioHoy, mesHoy] = hoy.split('-').map(Number);
  const limite = anioHoy * 12 + mesHoy; // se puede mirar hasta el mes que viene
  const hayAdelante = (viendo + 1) * 12 + 1 <= limite + 1;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCerrar} onShow={() => setViendo(anio)}>
      <Pressable style={{ flex: 1, backgroundColor: c.velo, justifyContent: 'flex-end' }} onPress={alCerrar}>
        <Pressable onPress={() => {}} style={[{ backgroundColor: c.tarjeta, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: estilo.m.margen, paddingBottom: abajo + 16, gap: 14 }, COLUMNA_WEB]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setViendo((a) => a - 1)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Año anterior">
              <Icono nombre="atras" tam={20} color={c.tinta} grosor={2} />
            </Pressable>
            <Texto tam={17} peso="semi" num>{viendo}</Texto>
            <Pressable onPress={() => setViendo((a) => a + 1)} disabled={!hayAdelante} hitSlop={8} accessibilityLabel="Año siguiente"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: hayAdelante ? 1 : 0.3 }}>
              <Icono nombre="adelante" tam={20} color={c.tinta} grosor={2} />
            </Pressable>
          </View>
          <Grilla columnas={4}>
            {MESES_CORTOS.map((nombre, i) => {
              const elegido = viendo === anio && i + 1 === mes;
              const posible = viendo * 12 + i + 1 <= limite + 1;
              return (
                <Pressable key={nombre} disabled={!posible} onPress={() => { Haptics.selectionAsync(); alElegir(viendo, i + 1); alCerrar(); }}
                  style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: elegido ? c.boton : c.suave, opacity: posible ? 1 : 0.35 }}>
                  <Texto tam={15} peso={elegido ? 'semi' : 'normal'} color={elegido ? c.sobreBoton : c.tinta}>{mayuscula(nombre)}</Texto>
                </Pressable>
              );
            })}
          </Grilla>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** El día elegido en el calendario del Inicio, para que el + de la barra anote en ese día. */
const DiaCtx = createContext<{ fecha: string | null; setFecha: (f: string | null) => void } | null>(null);

export function ProveedorDia({ children }: { children: ReactNode }) {
  const [fecha, setFecha] = useState<string | null>(null);
  return <DiaCtx.Provider value={{ fecha, setFecha }}>{children}</DiaCtx.Provider>;
}

export function useDiaElegido() {
  const x = useContext(DiaCtx);
  if (!x) throw new Error('Fuera de <ProveedorDia>');
  return x;
}
