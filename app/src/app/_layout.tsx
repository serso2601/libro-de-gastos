import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { RedHatMono_400Regular } from '@expo-google-fonts/red-hat-mono/400Regular';
import { RedHatMono_500Medium } from '@expo-google-fonts/red-hat-mono/500Medium';
import { RedHatMono_600SemiBold } from '@expo-google-fonts/red-hat-mono/600SemiBold';
import { SchibstedGrotesk_400Regular } from '@expo-google-fonts/schibsted-grotesk/400Regular';
import { SchibstedGrotesk_500Medium } from '@expo-google-fonts/schibsted-grotesk/500Medium';
import { SchibstedGrotesk_600SemiBold } from '@expo-google-fonts/schibsted-grotesk/600SemiBold';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnfitrionDialogos } from '@/dialogos/abrir';
import { ProveedorDatos } from '@/lib/datos';
import { ProveedorTema, useTema } from '@/ui/tema';

SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  const [listas] = useFonts({
    Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold,
    RedHatMono_400Regular, RedHatMono_500Medium, RedHatMono_600SemiBold,
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
    SchibstedGrotesk_400Regular, SchibstedGrotesk_500Medium, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_700Bold,
    JetBrainsMono_400Regular, JetBrainsMono_500Medium,
  });

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
        </ProveedorDatos>
      </ProveedorTema>
    </SafeAreaProvider>
  );
}

function Pantallas() {
  const { c, oscuro } = useTema();
  return (
    <>
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }}>
        <Stack.Screen name="(pestanias)" />
        <Stack.Screen name="ver/[pantalla]" />
        <Stack.Screen name="cuenta/[id]" />
        <Stack.Screen name="ajustes" />
        <Stack.Screen name="conectar" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
