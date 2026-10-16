import * as Haptics from 'expo-haptics';
import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAbrir } from '@/dialogos/abrir';
import { useAlmacen } from '@/lib/datos';
import type { TipoMovimiento } from '@/lib/tipos';
import { Texto } from '@/ui/componentes';
import { C } from '@/ui/tema';

const PESTANIAS: Record<string, { texto: string; icono: string }> = {
  index: { texto: 'Resumen', icono: '🏠' },
  cuentas: { texto: 'Cuentas', icono: '👛' },
  presupuesto: { texto: 'Presupuesto', icono: '🐷' },
  movimientos: { texto: 'Movimientos', icono: '📋' },
  graficos: { texto: 'Gráficos', icono: '📊' },
};

export default function Pestanias() {
  const { conexion, datos } = useAlmacen();
  if (!conexion) return <Redirect href="/conectar" />;
  if (!datos) {
    return <View style={{ flex: 1, backgroundColor: C.fondo, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.tenue} /></View>;
  }
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.fondo } }} tabBar={(p) => <Barra {...p} />}>
      {Object.keys(PESTANIAS).map((nombre) => <Tabs.Screen key={nombre} name={nombre} />)}
    </Tabs>
  );
}

function Barra({ state, navigateToTab }: { state: { index: number; routes: { key: string; name: string }[] }; navigateToTab: (routeKey: string) => void }) {
  const abajo = useSafeAreaInsets().bottom;
  const abrir = useAbrir();
  const [hoja, setHoja] = useState(false);

  function anotar(tipo: TipoMovimiento) {
    setHoja(false);
    setTimeout(() => abrir({ tipo: 'movimiento', tipoInicial: tipo }), 250);
  }

  return (
    <>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setHoja(true); }}
        style={[e.mas, { bottom: abajo + 62 }]} accessibilityLabel="Anotar">
        <Texto tam={30} color={C.blanco} style={{ marginTop: -2 }}>+</Texto>
      </Pressable>
      <View style={[e.barra, { paddingBottom: abajo }]}>
        {state.routes.map((ruta, i) => {
          const p = PESTANIAS[ruta.name];
          if (!p) return null;
          const activa = state.index === i;
          return (
            <Pressable key={ruta.key} style={e.boton} onPress={() => { Haptics.selectionAsync(); navigateToTab(ruta.key); }}>
              <Texto tam={19} style={{ opacity: activa ? 1 : 0.55 }}>{p.icono}</Texto>
              <Texto tam={10} peso={activa ? 'semi' : 'normal'} color={activa ? C.acentoClaro : C.tenue}>{p.texto}</Texto>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={hoja} transparent animationType="fade" onRequestClose={() => setHoja(false)}>
        <Pressable style={e.velo} onPress={() => setHoja(false)}>
          <View style={[e.acciones, { paddingBottom: abajo + 16 }]}>
            <Texto tam={18} peso="negrita" style={{ marginBottom: 12 }}>¿Qué quieres anotar?</Texto>
            {([['gasto', 'Gasto', '➖', C.alerta], ['ingreso', 'Ingreso', '➕', C.bien], ['transferencia', 'Transferencia', '⇄', C.acentoClaro]] as const).map(([tipo, texto, emoji, color]) => (
              <Pressable key={tipo} onPress={() => anotar(tipo)} style={({ pressed }) => [e.accion, pressed && { opacity: 0.6 }]}>
                <Texto tam={20} color={color}>{emoji}</Texto>
                <Texto tam={15} peso="medio">{texto}</Texto>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const e = StyleSheet.create({
  barra: { flexDirection: 'row', backgroundColor: C.tarjeta, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineaFuerte },
  boton: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 9, paddingBottom: 6 },
  mas: {
    position: 'absolute', alignSelf: 'center', zIndex: 10, width: 58, height: 58, borderRadius: 29, backgroundColor: C.acento,
    alignItems: 'center', justifyContent: 'center', shadowColor: C.acento, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  velo: { flex: 1, backgroundColor: 'rgba(5,6,8,0.6)', justifyContent: 'flex-end' },
  acciones: { backgroundColor: C.tarjeta, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.linea, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
});
