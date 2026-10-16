// Primera vez: decirle a la app dónde está la PC y con qué token entra. Lo más fácil es escanear con
// la cámara del iPhone el QR de la página de estado (http://127.0.0.1:8766 en la PC): abre
// librogastos://conectar?d=...&t=... y esta pantalla se conecta sola.

import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, View } from 'react-native';
import { useAlmacen } from '@/lib/datos';
import { Boton, Campo, Etiqueta, Texto, TextoError } from '@/ui/componentes';
import { C } from '@/ui/tema';

export default function Conectar() {
  const { conectar, conexion } = useAlmacen();
  const params = useLocalSearchParams<{ d?: string; t?: string }>();
  // En el build de desarrollo el código viene de Metro, que corre en la misma PC que el servidor.
  const pcDeMetro = Constants.expoConfig?.hostUri?.split(':')[0];
  const [direccion, setDireccion] = useState(params.d ?? conexion?.direccion ?? (pcDeMetro ? `${pcDeMetro}:8766` : ''));
  const [token, setToken] = useState(params.t ?? '');
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState('');

  async function probar(d = direccion, t = token) {
    if (!d.trim() || !t.trim()) return setError('Faltan la dirección o el token');
    setProbando(true);
    setError('');
    try {
      await conectar({ direccion: d.trim(), token: t.trim() });
      router.replace('/');
    } catch (e) {
      setError(`${e instanceof Error ? e.message : e}. Revisa que Tailscale esté activo en el teléfono y que la PC esté prendida.`);
    } finally {
      setProbando(false);
    }
  }

  useEffect(() => {
    if (params.d && params.t) void probar(params.d, params.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.d, params.t]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.fondo, justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: C.tarjeta, borderRadius: 20, padding: 22 }}>
        <Texto tam={34} style={{ marginBottom: 6 }}>📒</Texto>
        <Texto tam={22} peso="negrita" style={{ marginBottom: 6 }}>Conectar con la PC</Texto>
        <Texto tam={14} color={C.tenue} style={{ marginBottom: 20 }}>
          En la PC abre «Estado Libro de Gastos» (escritorio) y escanea el QR con la cámara del iPhone. O escríbelo a mano:
        </Texto>
        <Etiqueta>Dirección de la PC</Etiqueta>
        <Campo value={direccion} onChangeText={setDireccion} placeholder="100.x.y.z:8766" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Etiqueta>Token</Etiqueta>
        <Campo value={token} onChangeText={setToken} placeholder="El de token.txt" autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <TextoError texto={error} />
        {probando ? <ActivityIndicator color={C.tenue} style={{ paddingVertical: 14 }} /> : <Boton onPress={() => probar()}>Conectar</Boton>}
      </View>
    </KeyboardAvoidingView>
  );
}
