// Las pestañas. Billetera lleva una barra abajo con el botón de anotar al centro; Calendario, una
// barra flotante con el + al lado; los estilos de bloques no llevan barra (todo sale del Inicio).

import * as Haptics from 'expo-haptics';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnotar } from '@/dialogos/abrir';
import { useAlmacen } from '@/lib/datos';
import { Texto } from '@/ui/componentes';
import { ProveedorDia, useDiaElegido } from '@/ui/elegirMes';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { useTema } from '@/ui/tema';

const RUTAS = ['index', 'movimientos', 'presupuesto', 'graficos', 'cuentas'];

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

function Barra({ state, navigateToTab }: PropsBarra) {
  const { estilo } = useTema();
  const actual = state.routes[state.index]?.name;
  const permitidas = ['index', ...estilo.pestanias];
  const inicio = state.routes.find((r) => r.name === 'index')?.key;

  // Si se cambia a un estilo donde la pestaña abierta no existe, se vuelve al Inicio.
  useEffect(() => {
    if (actual && !permitidas.includes(actual) && inicio) navigateToTab(inicio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estilo.id, actual]);

  if (estilo.navegacion === 'barra') return <BarraBilletera state={state} navigateToTab={navigateToTab} />;
  if (estilo.navegacion === 'flotante') return <BarraFlotante state={state} navigateToTab={navigateToTab} />;
  return null;
}

const BILLETERA: [string, string, NombreIcono][] = [['index', 'Cuentas', 'cuentas'], ['movimientos', 'Movimientos', 'lista'], ['presupuesto', 'Presupuesto', 'presupuesto'], ['graficos', 'Gráficos', 'graficos']];
const FLOTANTE: [string, string, NombreIcono][] = [['index', 'Calendario', 'calendario'], ['graficos', 'Gráficos', 'graficos'], ['presupuesto', 'Presupuesto', 'presupuesto'], ['cuentas', 'Cuentas', 'cuentas']];

function useIrA(state: PropsBarra['state'], navigateToTab: PropsBarra['navigateToTab']) {
  return (nombre: string) => {
    const r = state.routes.find((x) => x.name === nombre);
    if (!r) return;
    Haptics.selectionAsync();
    navigateToTab(r.key);
  };
}

function BarraBilletera({ state, navigateToTab }: PropsBarra) {
  const abajo = useSafeAreaInsets().bottom;
  const { c } = useTema();
  const anotar = useAnotar();
  const ir = useIrA(state, navigateToTab);
  const actual = state.routes[state.index]?.name;
  const boton = ([nombre, texto, icono]: [string, string, NombreIcono]) => {
    const activa = actual === nombre;
    return (
      <Pressable key={nombre} onPress={() => ir(nombre)} accessibilityLabel={texto} accessibilityState={{ selected: activa }}
        style={{ width: 64, height: 48, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <Icono nombre={icono} tam={22} color={activa ? c.acento : c.tenue} grosor={activa ? 1.9 : 1.8} />
        <Texto tam={10.5} peso={activa ? 'semi' : 'normal'} color={activa ? c.acento : c.tenue}>{texto}</Texto>
      </Pressable>
    );
  };
  return (
    <View style={{ height: 58 + Math.max(abajo - 8, 12), paddingTop: 6, paddingHorizontal: 10, paddingBottom: Math.max(abajo - 8, 12), backgroundColor: c.tarjeta,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      {BILLETERA.slice(0, 2).map(boton)}
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); anotar(); }} accessibilityLabel="Anotar"
        style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <Icono nombre="mas" tam={24} color={c.sobreBoton} grosor={2.4} />
      </Pressable>
      {BILLETERA.slice(2).map(boton)}
    </View>
  );
}

function BarraFlotante({ state, navigateToTab }: PropsBarra) {
  const abajo = useSafeAreaInsets().bottom;
  const { c } = useTema();
  const anotar = useAnotar();
  const { fecha } = useDiaElegido();
  const ir = useIrA(state, navigateToTab);
  const actual = state.routes[state.index]?.name;
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: Math.max(abajo - 4, 14), backgroundColor: c.fondo, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: c.tarjeta, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6,
        shadowColor: '#15181D', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}>
        {FLOTANTE.map(([nombre, texto, icono]) => {
          const activa = actual === nombre;
          return (
            <Pressable key={nombre} onPress={() => ir(nombre)} accessibilityLabel={texto} accessibilityState={{ selected: activa }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: activa ? c.boton : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <Icono nombre={icono} tam={20} color={activa ? c.sobreBoton : c.tenue} grosor={1.8} />
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); anotar(actual === 'index' && fecha ? { fechaInicial: fecha } : {}); }} accessibilityLabel="Anotar"
        style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <Icono nombre="mas" tam={24} color={c.sobreBoton} grosor={2.4} />
      </Pressable>
    </View>
  );
}
