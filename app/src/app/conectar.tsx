// Primera vez: decirle a la app dónde está la PC y con qué token entra. Lo más fácil es escanear con
// la cámara del iPhone el QR de la página de estado (http://127.0.0.1:8766 en la PC): abre
// librogastos://conectar?d=...&t=... y esta pantalla se conecta sola.

import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlmacen } from '@/lib/datos';
import { Volver } from '@/ui/pantalla';
import { BotonPrincipal, Campo, Etiqueta, Tarjeta, Texto, TextoError } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { useTema } from '@/ui/tema';

const WEB = Platform.OS === 'web';

function Paso({ n, texto }: { n: number; texto: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.suave, alignItems: 'center', justifyContent: 'center' }}>
        <Texto num tam={13} peso="semi">{n}</Texto>
      </View>
      <Texto tam={15} style={{ flex: 1, lineHeight: 20, paddingTop: 3 }}>{texto}</Texto>
    </View>
  );
}

export default function Conectar() {
  const { conectar, conexion } = useAlmacen();
  const { c, estilo } = useTema();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ d?: string; t?: string }>();
  // En el build de desarrollo el código viene de Metro, que corre en la misma PC que el servidor; la
  // web la sirve el servidor mismo.
  const pcDeMetro = Constants.expoConfig?.hostUri?.split(':')[0];
  const aqui = WEB ? window.location.host : pcDeMetro ? `${pcDeMetro}:8766` : '';
  const [direccion, setDireccion] = useState(params.d ?? conexion?.direccion ?? aqui);
  const [token, setToken] = useState(params.t ?? '');
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState('');

  async function probar(d = direccion, t = token) {
    if (!d.trim() || !t.trim()) return setError('Faltan la dirección o la clave');
    setProbando(true);
    setError('');
    try {
      await conectar({ direccion: d.trim(), token: t.trim() });
      if (router.canGoBack()) router.dismissAll();
      else router.replace('/');
    } catch (e) {
      setError(`${e instanceof Error ? e.message : e}. Revisa que Tailscale esté activo aquí y que la PC esté prendida.`);
    } finally {
      setProbando(false);
    }
  }

  useEffect(() => {
    if (params.t && (params.d || WEB)) void probar(params.d ?? aqui, params.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.d, params.t]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.fondo }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + (conexion && router.canGoBack() ? 4 : 50), paddingHorizontal: estilo.m.margen, paddingBottom: insets.bottom + 16, gap: 22 }}
        keyboardShouldPersistTaps="handled">
        {conexion && router.canGoBack() && <View style={{ height: 44, justifyContent: 'center' }}><Volver texto="Cancelar" /></View>}
        <View style={{ gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
            <Icono nombre="libro" tam={28} color={c.sobreBoton} grosor={1.8} />
          </View>
          <Texto tam={estilo.m.titulo} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.8 }}>Conectar con la PC</Texto>
          <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>Tus datos viven en tu PC. {WEB ? 'Este aparato' : 'El teléfono'} llega a ella por Tailscale, en casa y afuera.</Texto>
        </View>
        <Tarjeta style={{ padding: 18, gap: 14 }}>
          <Paso n={1} texto="En la PC, abre «Libro de Gastos» desde el escritorio." />
          <Paso n={2} texto={WEB ? 'Apunta la cámara al código «En el navegador».' : 'Apunta la cámara del iPhone al código QR que aparece.'} />
          <Paso n={3} texto={WEB ? 'Toca el aviso que sale: se abre ya conectada.' : 'Toca el aviso que sale: la app se conecta sola.'} />
          <View style={{ alignItems: 'center', paddingTop: 6 }}>
            <View style={{ width: 108, height: 108, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: c.linea, alignItems: 'center', justifyContent: 'center' }}>
              <Icono nombre="qr" tam={56} color={c.tinta} grosor={1.6} />
            </View>
          </View>
        </Tarjeta>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.linea }} />
          <Texto tam={13} color={c.tenue}>o escríbelo a mano</Texto>
          <View style={{ flex: 1, height: 1, backgroundColor: c.linea }} />
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Etiqueta>Dirección de la PC</Etiqueta>
            <Campo value={direccion} onChangeText={setDireccion} placeholder="100.x.x.x:8766" autoCapitalize="none" autoCorrect={false} keyboardType="url"
              style={{ backgroundColor: c.tarjeta }} />
          </View>
          <View style={{ gap: 6 }}>
            <Etiqueta>Clave</Etiqueta>
            <Campo value={token} onChangeText={setToken} placeholder="La de la página de estado" autoCapitalize="none" autoCorrect={false} secureTextEntry
              style={{ backgroundColor: c.tarjeta }} />
          </View>
        </View>
        <TextoError texto={error} />
        <View style={{ flex: 1 }} />
        {probando ? <ActivityIndicator color={c.tenue} style={{ height: 56 }} /> : <BotonPrincipal onPress={() => probar()}>Conectar</BotonPrincipal>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
