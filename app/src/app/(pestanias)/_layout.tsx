// Las pestañas: una barra abajo con Inicio, Movimientos, el botón de anotar al centro, Presupuesto y
// Cuentas. Si el Inicio está en el calendario y hay un día elegido, el + anota en ese día. En una
// pantalla ancha (la web en el iPad o la computadora) la barra va al costado, con Ajustes al final.

import * as Haptics from 'expo-haptics';
import { Redirect, router, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnotar } from '@/dialogos/abrir';
import { useAlmacen } from '@/lib/datos';
import { Texto } from '@/ui/componentes';
import { ANCHO_BARRA, ANCHO_RIEL, useDisposicion } from '@/ui/disposicion';
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
  const { lateral, barraAncha } = useDisposicion();
  if (!conexion) return <Redirect href="/conectar" />;
  if (!datos) {
    return <View style={{ flex: 1, backgroundColor: c.fondo, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.tenue} /></View>;
  }
  return (
    <ProveedorDia>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.fondo }, tabBarPosition: lateral ? 'left' : 'bottom' }}
        tabBar={(p) => lateral ? <BarraLateral {...(p as unknown as PropsBarra)} ancha={barraAncha} /> : <Barra {...(p as unknown as PropsBarra)} />}>
        {RUTAS.map((nombre) => <Tabs.Screen key={nombre} name={nombre} />)}
      </Tabs>
    </ProveedorDia>
  );
}

const IZQUIERDA: [string, string, NombreIcono][] = [['index', 'Inicio', 'inicio'], ['movimientos', 'Movimientos', 'lista']];
const DERECHA: [string, string, NombreIcono][] = [['presupuesto', 'Presupuesto', 'presupuesto'], ['cuentas', 'Cuentas', 'cuentas']];

/** Lo que comparten las dos barras: cuál está abierta, ir a otra y el + (en el día elegido del calendario, si hay). */
function useBarra({ state, navigateToTab }: PropsBarra) {
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
  const tocarMas = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    anotar(actual === 'index' && vistaInicio === 'calendario' && fecha ? { fechaInicial: fecha } : {});
  };
  return { actual, ir, tocarMas };
}

function Barra(props: PropsBarra) {
  const abajo = useSafeAreaInsets().bottom;
  const { c } = useTema();
  const { actual, ir, tocarMas } = useBarra(props);

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

/** La barra al costado: arriba el libro y el +, luego las cuatro secciones y al final Ajustes. Angosta es un
 *  riel (ícono con el nombre debajo); ancha lleva el nombre al lado y el + dice «Anotar». */
function BarraLateral({ ancha, ...props }: PropsBarra & { ancha: boolean }) {
  const insets = useSafeAreaInsets();
  const { c, estilo } = useTema();
  const { actual, ir, tocarMas } = useBarra(props);

  const item = (nombre: string, texto: string, icono: NombreIcono, activa: boolean, onPress: () => void) => (
    <Pressable key={nombre} onPress={onPress} accessibilityLabel={texto} accessibilityState={{ selected: activa }}
      style={({ pressed }) => (ancha
        ? { height: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: activa ? c.suave : 'transparent', opacity: pressed ? 0.6 : 1 }
        : { height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: activa ? c.suave : 'transparent', opacity: pressed ? 0.6 : 1 })}>
      <Icono nombre={icono} tam={22} color={activa ? c.acento : c.tenue} grosor={activa ? 1.9 : 1.8} />
      <Texto tam={ancha ? 15 : 11} peso={activa ? 'semi' : ancha ? 'medio' : 'normal'} color={activa ? c.tinta : c.tenue} lineas={1}>{texto}</Texto>
    </Pressable>
  );

  return (
    <View style={{ width: ancha ? ANCHO_BARRA : ANCHO_RIEL, backgroundColor: c.tarjeta, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16,
      paddingHorizontal: ancha ? 16 : 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: ancha ? 'flex-start' : 'center', gap: 10, paddingHorizontal: ancha ? 6 : 0, marginBottom: 18 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre="libro" tam={19} color={c.sobreBoton} grosor={1.8} />
        </View>
        {ancha && <Texto tam={20} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.4 }}>Gastos</Texto>}
      </View>
      <Pressable onPress={tocarMas} accessibilityLabel="Anotar"
        style={({ pressed }) => ({ height: 52, borderRadius: 26, backgroundColor: c.boton, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
          width: ancha ? undefined : 52, alignSelf: ancha ? 'stretch' : 'center', marginBottom: 14, opacity: pressed ? 0.85 : 1 })}>
        <Icono nombre="mas" tam={22} color={c.sobreBoton} grosor={2.4} />
        {ancha && <Texto tam={16} peso="semi" color={c.sobreBoton}>Anotar</Texto>}
      </Pressable>
      {[...IZQUIERDA, ...DERECHA].map(([nombre, texto, icono]) => item(nombre, texto, icono, actual === nombre, () => ir(nombre)))}
      <View style={{ flex: 1 }} />
      {item('ajustes', 'Ajustes', 'ajustes', false, () => router.push('/ajustes'))}
    </View>
  );
}
