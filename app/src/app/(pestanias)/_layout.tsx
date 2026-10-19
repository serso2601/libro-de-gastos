// Las pestañas: una barra abajo con Inicio, Movimientos, el botón de anotar al centro, Presupuesto y
// Cuentas. Si el Inicio está en el calendario y hay un día elegido, el + anota en ese día.

import * as Haptics from 'expo-haptics';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnotar } from '@/dialogos/abrir';
import { useAlmacen } from '@/lib/datos';
import { Texto } from '@/ui/componentes';
import { ProveedorDia, useDiaElegido } from '@/ui/elegirMes';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { usePreferencias, useTema } from '@/ui/tema';

const RUTAS = ['index', 'movimientos', 'presupuesto', 'cuentas'];

interface PropsBarra {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}

export default function Pestanias() {
  const { conexion, datos } = useAlmacen();
  const { c } = useTema();
  if (!conexion) return <Redirect href="/conectar" />;
  if (!datos) {
    return <View style={{ flex: 1, backgroundColor: c.fondo, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.tenue} /></View>;
  }
  return (
    <ProveedorDia>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.fondo } }} tabBar={(p) => <Barra {...(p as unknown as PropsBarra)} />}>
        {RUTAS.map((nombre) => <Tabs.Screen key={nombre} name={nombre} />)}
      </Tabs>
    </ProveedorDia>
  );
}

const IZQUIERDA: [string, string, NombreIcono][] = [['index', 'Inicio', 'inicio'], ['movimientos', 'Movimientos', 'lista']];
const DERECHA: [string, string, NombreIcono][] = [['presupuesto', 'Presupuesto', 'presupuesto'], ['cuentas', 'Cuentas', 'cuentas']];

function Barra({ state, navigateToTab }: PropsBarra) {
  const abajo = useSafeAreaInsets().bottom;
  const { c } = useTema();
  const anotar = useAnotar();
  const { vistaInicio } = usePreferencias();
  const { fecha } = useDiaElegido();
  const actual = state.routes[state.index]?.name;

  const ir = (nombre: string) => {
    const r = state.routes.find((x) => x.name === nombre);
    if (!r) return;
    Haptics.selectionAsync();
    navigateToTab(r.key);
  };

  const boton = ([nombre, texto, icono]: [string, string, NombreIcono]) => {
    const activa = actual === nombre;
    return (
      <Pressable key={nombre} onPress={() => ir(nombre)} accessibilityLabel={texto} accessibilityState={{ selected: activa }}
        style={{ width: 72, height: 48, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <Icono nombre={icono} tam={22} color={activa ? c.acento : c.tenue} grosor={activa ? 1.9 : 1.8} />
        <Texto tam={11} peso={activa ? 'semi' : 'normal'} color={activa ? c.acento : c.tenue} lineas={1}>{texto}</Texto>
      </Pressable>
    );
  };

  function tocarMas() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    anotar(actual === 'index' && vistaInicio === 'calendario' && fecha ? { fechaInicial: fecha } : {});
  }

  return (
    <View style={{ height: 58 + Math.max(abajo - 8, 12), paddingTop: 6, paddingHorizontal: 6, paddingBottom: Math.max(abajo - 8, 12), backgroundColor: c.tarjeta,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      {IZQUIERDA.map(boton)}
      <Pressable onPress={tocarMas} accessibilityLabel="Anotar"
        style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <Icono nombre="mas" tam={24} color={c.sobreBoton} grosor={2.4} />
      </Pressable>
      {DERECHA.map(boton)}
    </View>
  );
}
