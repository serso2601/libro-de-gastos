// La primera vez que se abre la app sale un tutorial corto de cómo se maneja. Después ya no, salvo
// que se pida de nuevo en Ajustes («Ver cómo funciona»).

import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotonPrincipal, Texto } from '@/ui/componentes';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { usePreferencias, useTema } from '@/ui/tema';

interface Paso { icono: NombreIcono; titulo: string; texto: string }

const PASOS: Paso[] = [
  { icono: 'inicio', titulo: 'Tu saldo, arriba', texto: 'En el Inicio ves tu saldo. Tócalo para elegir cuál ver: el total, lo libre después de lo que viene, el balance del mes… Debajo hay dos vistas: Tarjetas o Calendario.' },
  { icono: 'calendario', titulo: 'El mes en un calendario', texto: 'Cada día muestra en verde lo que entró y en rojo lo que salió. Toca un día para ver sus movimientos; el + anota en ese día.' },
  { icono: 'lista', titulo: 'Movimientos', texto: 'La lista con el buscador, Próximos (lo que se anota solo cuando llega su día) y Gráficos.' },
  { icono: 'presupuesto', titulo: 'Presupuesto y cuentas', texto: 'El presupuesto va en cuadros que se llenan con lo que gastas. En Cuentas están todas tus cuentas y todas las formas de ver tu saldo.' },
  { icono: 'mas', titulo: 'Anotar', texto: 'El botón negro del centro anota un gasto, un ingreso o una transferencia.' },
];

export function Tutorial() {
  const { estilo, c } = useTema();
  const { tutorialVisto, cambiar } = usePreferencias();
  const enFoco = useIsFocused();
  const abajo = useSafeAreaInsets().bottom;
  const [paso, setPaso] = useState(0);
  const visible = enFoco && !tutorialVisto;
  const terminar = () => { cambiar({ tutorialVisto: true }); setPaso(0); };
  const actual = PASOS[Math.min(paso, PASOS.length - 1)];
  const ultimo = paso >= PASOS.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={terminar}>
      <View style={{ flex: 1, backgroundColor: c.velo, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.tarjeta, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: abajo + 18, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto tam={12} peso="semi" color={c.tenue} lineas={1} style={{ letterSpacing: 0.6, flex: 1 }}>CÓMO FUNCIONA</Texto>
            {!ultimo && <Pressable onPress={terminar} hitSlop={10}><Texto tam={14} color={c.tenue}>Saltar</Texto></Pressable>}
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
            <Icono nombre={actual.icono} tam={26} color={c.sobreBoton} />
          </View>
          <View style={{ gap: 8, minHeight: 120 }}>
            <Texto tam={22} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.5 }}>{actual.titulo}</Texto>
            <Texto tam={15} color={c.tenue} style={{ lineHeight: 22 }}>{actual.texto}</Texto>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {PASOS.map((_, i) => (
              <View key={i} style={{ width: i === paso ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === paso ? c.tinta : c.linea }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {paso > 0 && (
              <Pressable onPress={() => setPaso((p) => p - 1)} style={{ height: 56, paddingHorizontal: 22, borderRadius: 16, backgroundColor: c.suave, justifyContent: 'center' }}>
                <Texto tam={17} peso="semi">Atrás</Texto>
              </Pressable>
            )}
            <BotonPrincipal style={{ flex: 1 }} onPress={() => (ultimo ? terminar() : setPaso((p) => p + 1))}>{ultimo ? 'Entendido' : 'Siguiente'}</BotonPrincipal>
          </View>
        </View>
      </View>
    </Modal>
  );
}
