import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnfitrionDialogos } from '@/dialogos/abrir';
import { ProveedorDatos } from '@/lib/datos';
import { AnfitrionAvisos } from '@/ui/aviso';
import { ProveedorTema, useTema } from '@/ui/tema';
import { Vuelo } from '@/ui/vuelo';

SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  // Si la letra no carga, se sigue con la del sistema: nunca pantalla en negro. En la web no se espera: Safari
  // nunca confirma que la bajó y expo-font se rinde a los 12 s (la web tardaba eso en abrir en el iPhone y el
  // iPad); la regla de la letra ya está puesta y el navegador la usa en cuanto llega.
  const [cargadas, error] = useFonts({
    Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold,
  });
  const listas = cargadas || !!error || Platform.OS === 'web';

  useEffect(() => {
    if (listas) SplashScreen.hideAsync();
  }, [listas]);

  if (!listas) return null;
  return (
    <SafeAreaProvider>
      <ProveedorTema>
        <ProveedorDatos>
          <AnfitrionDialogos>
            <Pantallas />
          </AnfitrionDialogos>
          <Vuelo />
          <AnfitrionAvisos />
        </ProveedorDatos>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}


function Pantallas() {
  const { c, oscuro } = useTema();
  // En la web, lo que se ve al estirar la página más allá del borde es del color del fondo.
  useEffect(() => {
    if (Platform.OS === 'web') document.body.style.backgroundColor = c.fondo;
  }, [c.fondo]);
  return (
    <>
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }}>
        <Stack.Screen name="(pestanias)" />
        <Stack.Screen name="cuenta/[id]" />
        <Stack.Screen name="ajustes" />
        <Stack.Screen name="conectar" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
