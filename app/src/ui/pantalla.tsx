// El marco de cada pantalla y cómo se va de una a otra. Inicio, Movimientos, Presupuesto y Cuentas son
// pestañas de la barra de abajo; Gráficos es una vista dentro de Movimientos. Ajustes y una
// cuenta abierta se abren encima, con «‹ volver» arriba a la izquierda.

import { router } from 'expo-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlmacen } from '@/lib/datos';
import { BotonRedondo, Texto } from './componentes';
import { ANCHO_LECTURA, ANCHO_MAXIMO, useDisposicion } from './disposicion';
import { Icono } from './iconos';
import { alfa, useTema } from './tema';

export type Seccion = 'inicio' | 'movimientos' | 'presupuesto' | 'cuentas' | 'graficos';

const Apilada = createContext<string | null>(null);

/** Las pantallas abiertas encima reciben el nombre de a dónde vuelven. */
export function ProveedorApilada({ volver, children }: { volver: string; children: ReactNode }) {
  return <Apilada.Provider value={volver}>{children}</Apilada.Provider>;
}

export function useApilada(): string | null {
  return useContext(Apilada);
}

/** Ir a una sección: cambia de pestaña; Gráficos abre Movimientos en esa vista. */
export function useIr() {
  return useCallback((s: Seccion) => {
    if (s === 'graficos') return router.navigate({ pathname: '/movimientos', params: { vista: s } });
    router.navigate(s === 'inicio' ? '/' : `/${s}`);
  }, []);
}

export function abrirCuenta(id: string, volver = 'Inicio') {
  router.push({ pathname: '/cuenta/[id]', params: { id, volver } });
}

export function volverAtras() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function Volver({ texto, color }: { texto: string; color?: string }) {
  const { c } = useTema();
  return (
    <Pressable onPress={volverAtras} hitSlop={10} accessibilityLabel={`Volver a ${texto}`}
      style={({ pressed }) => ({ height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, opacity: pressed ? 0.5 : 1 })}>
      <Icono nombre="atras" tam={22} color={color ?? c.tinta} grosor={2} />
      <Texto tam={17} peso="semi" color={color}>{texto}</Texto>
    </Pressable>
  );
}

/**
 * El marco: cabecera (volver o ajustes, y botones a la derecha), título, avisos de conexión,
 * jalar para actualizar y, si hace falta, algo fijo abajo (el botón de anotar).
 */
export function Marco({ titulo, subtitulo, derecha, children, pie, cabecera, sinAjustes, angosto, gap = 12 }: {
  titulo?: string; subtitulo?: string; derecha?: ReactNode; children: ReactNode; pie?: ReactNode;
  cabecera?: ReactNode; sinAjustes?: boolean; gap?: number;
  /** En una pantalla ancha no pasa del ancho de lectura (listas y formularios). */
  angosto?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { c, estilo } = useTema();
  const { lateral, margen } = useDisposicion();
  // En una pantalla ancha el contenido queda al centro, sin estirarse de lado a lado.
  const centro = { width: '100%', maxWidth: angosto ? ANCHO_LECTURA + margen * 2 : ANCHO_MAXIMO, alignSelf: 'center' } as const;
  const volver = useApilada();
  const { recargar } = useAlmacen();
  const [actualizando, setActualizando] = useState(false);

  async function actualizar() {
    setActualizando(true);
    await recargar();
    setActualizando(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets
        contentContainerStyle={[{ paddingTop: insets.top + (lateral ? 20 : 4), paddingHorizontal: margen, paddingBottom: pie ? 16 : volver ? insets.bottom + 24 : 24, gap }, centro]}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={actualizar} tintColor={c.tenue} />}>
        {cabecera ?? (lateral && !volver && titulo ? (
          // Con la barra al costado no hay botón de Ajustes arriba: el título sube y lo de la derecha va a su lado.
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Texto tam={estilo.m.titulo} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.8 }}>{titulo}</Texto>
              {subtitulo ? <Texto tam={14} color={c.tenue}>{subtitulo}</Texto> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>{derecha}</View>
          </View>
        ) : (
          <>
            <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {volver ? <Volver texto={volver} /> : <View />}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {derecha}
                {!volver && !sinAjustes && !lateral && <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />}
              </View>
            </View>
            {titulo && (
              <View style={{ marginTop: 10, gap: 4 }}>
                <Texto tam={estilo.m.titulo} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.8 }}>{titulo}</Texto>
                {subtitulo ? <Texto tam={14} color={c.tenue}>{subtitulo}</Texto> : null}
              </View>
            )}
          </>
        ))}
        <Avisos />
        {children}
      </ScrollView>
      {pie && <View style={[{ paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) + 2 }, centro]}>{pie}</View>}
    </View>
  );
}

function Aviso({ texto, color, onPress }: { texto: string; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ backgroundColor: alfa(color, 0.12), borderRadius: 14, padding: 12 }}>
      <Texto tam={13} color={color}>{texto}</Texto>
    </Pressable>
  );
}

function Avisos() {
  const { estado, pendientes, aviso, cerrarAviso } = useAlmacen();
  const { c } = useTema();
  return (
    <>
      {estado === 'sin-conexion' && (
        <Aviso color={c.tenue} texto={`Sin conexión con la PC.${pendientes > 0
          ? ` ${pendientes} ${pendientes === 1 ? 'cambio espera' : 'cambios esperan'} y se mandan solos al volver.`
          : ' Lo que anotes se guarda aquí y se manda después.'}`} />
      )}
      {estado === 'token-malo' && (
        <Aviso color={c.alerta} onPress={() => router.push('/conectar')} texto="La PC no reconoce la clave guardada aquí. Toca para conectar de nuevo." />
      )}
      {aviso ? <Aviso color={c.alerta} onPress={cerrarAviso} texto={`${aviso} · tocar para cerrar`} /> : null}
    </>
  );
}
