import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlmacen } from '@/lib/datos';
import { Texto } from './componentes';
import { alfa, C } from './tema';

/** El marco de cada pestaña: título, botón de ajustes, avisos de conexión y jalar para actualizar. */
export function Pantalla({ titulo, children }: { titulo: string; children: ReactNode }) {
  const arriba = useSafeAreaInsets().top;
  const { recargar } = useAlmacen();
  const [actualizando, setActualizando] = useState(false);

  async function actualizar() {
    setActualizando(true);
    await recargar();
    setActualizando(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.fondo }} contentContainerStyle={{ paddingTop: arriba + 12, paddingHorizontal: 18, paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={actualizando} onRefresh={actualizar} tintColor={C.tenue} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Texto tam={26} peso="negrita">{titulo}</Texto>
        <Pressable onPress={() => router.push('/ajustes')} hitSlop={8}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' }}>
          <Texto tam={16}>⚙️</Texto>
        </Pressable>
      </View>
      <Avisos />
      {children}
    </ScrollView>
  );
}

function Avisos() {
  const { estado, pendientes, aviso, cerrarAviso } = useAlmacen();
  return (
    <>
      {estado === 'sin-conexion' && (
        <View style={{ backgroundColor: alfa(C.aviso, 0.12), borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <Texto tam={12} color={C.aviso}>
            ☁️  Sin conexión con la PC.{pendientes > 0
              ? ` ${pendientes} ${pendientes === 1 ? 'cambio espera' : 'cambios esperan'} y se mandan solos al volver.`
              : ' Lo que anotes se guarda aquí y se manda después.'}
          </Texto>
        </View>
      )}
      {aviso && (
        <Pressable onPress={cerrarAviso} style={{ backgroundColor: alfa(C.alerta, 0.14), borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: C.alerta }}>
          <Texto tam={12} color={C.alerta}>{aviso} · tocar para cerrar</Texto>
        </Pressable>
      )}
    </>
  );
}
