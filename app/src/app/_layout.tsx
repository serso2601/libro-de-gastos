import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnfitrionDialogos } from '@/dialogos/abrir';
import { ProveedorDatos } from '@/lib/datos';
import { C } from '@/ui/tema';

SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  const [listas] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
    IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold,
  });

  useEffect(() => {
    if (listas) SplashScreen.hideAsync();
  }, [listas]);

  if (!listas) return null;
  return (
    <SafeAreaProvider>
      <ProveedorDatos>
        <AnfitrionDialogos>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.fondo } }}>
            <Stack.Screen name="(pestanias)" />
            <Stack.Screen name="ajustes" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="conectar" options={{ gestureEnabled: false }} />
          </Stack>
        </AnfitrionDialogos>
      </ProveedorDatos>
    </SafeAreaProvider>
  );
}
