// La primera vez que se usa un estilo sale un tutorial corto de cómo se maneja ese estilo. Después
// ya no, salvo que se pida de nuevo en Ajustes («Ver cómo funciona»).

import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotonPrincipal, Texto } from '@/ui/componentes';
import type { IdEstilo } from '@/ui/estilos';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { usePreferencias, useTema } from '@/ui/tema';

interface Paso { icono: NombreIcono; titulo: string; texto: string }

const PASOS: Record<IdEstilo, Paso[]> = {
  billetera: [
    { icono: 'cuentas', titulo: 'Tus cuentas son tarjetas', texto: 'Arriba ves cuánto tienes en total. Toca una tarjeta de atrás para pasarla al frente; toca la de adelante para abrirla y ver sus movimientos.' },
    { icono: 'presupuesto', titulo: 'El mes de un vistazo', texto: 'La barra muestra cuánto llevas gastado del presupuesto, con un color por cuenta. Debajo está lo que se cobra pronto; «Ver todo» abre Próximos.' },
    { icono: 'lista', titulo: 'Las secciones van abajo', texto: 'Cuentas, Movimientos, Presupuesto y Gráficos están en la barra de abajo. El botón negro del centro es para anotar.' },
  ],
  mosaico: [
    { icono: 'graficos', titulo: 'Todo en bloques', texto: 'Cada bloque es una parte de la app: tócalo para entrar. El grande muestra lo que te queda este mes y una barrita por cada día.' },
    { icono: 'atras', titulo: 'Para volver, «‹ Inicio»', texto: 'Aquí no hay barra de abajo. Desde cualquier sección vuelves con «‹ Inicio» arriba a la izquierda, o deslizando desde el borde de la pantalla.' },
    { icono: 'presupuesto', titulo: 'El presupuesto en vasos', texto: 'Cada categoría es un vaso que se llena con lo que gastas. Toca un vaso para cambiar su tope, o «Editar topes» para cambiarlos todos.' },
    { icono: 'mas', titulo: 'Anotar, siempre a mano', texto: 'El botón «Anotar» de abajo está en el Inicio, en Movimientos y en Cuentas.' },
  ],
  calendario: [
    { icono: 'calendario', titulo: 'El mes es un calendario', texto: 'Cada día se pinta según lo que gastaste: más fuerte, más gasto. Toca un día y abajo ves lo que anotaste.' },
    { icono: 'reloj', titulo: 'Lo que viene', texto: 'Los días con borde punteado tienen un cobro programado. Toca uno que todavía no llega para ver qué se va a cobrar.' },
    { icono: 'buscar', titulo: 'Otro mes y el buscador', texto: 'Toca el nombre del mes para ir a otro. La lupa abre todos los movimientos con el buscador.' },
    { icono: 'mas', titulo: 'Anotar en el día elegido', texto: 'El + de abajo anota en el día que tengas elegido en el calendario. La barra flotante lleva a Gráficos, Presupuesto y Cuentas.' },
  ],
  cartera: [
    { icono: 'cuentas', titulo: 'Una cuenta al frente', texto: 'Tus cuentas están apiladas arriba. Toca una de atrás para pasarla al frente; toca la grande para abrirla.' },
    { icono: 'graficos', titulo: 'Los bloques siguen a esa cuenta', texto: 'Presupuesto, Próximos, Movimientos y «En qué se fue» muestran lo de la cuenta que está al frente.' },
    { icono: 'mas', titulo: 'Anotar en esa cuenta', texto: 'El botón de abajo anota directo en la cuenta del frente. Desde cualquier sección vuelves con «‹ Inicio».' },
  ],
  calmosaico: [
    { icono: 'calendario', titulo: 'El calendario arriba', texto: 'Cada día se pinta según lo que gastaste. Toca uno y debajo ves lo que anotaste ese día; los totales del mes llevan a Gráficos.' },
    { icono: 'mas', titulo: 'Anota en el día elegido', texto: 'Si eliges un día que ya pasó, el botón dice «Anotar el 12» y lo guarda en ese día.' },
    { icono: 'presupuesto', titulo: 'Presupuesto por categoría', texto: 'El bloque de Presupuesto abre el mes de una sola categoría: toca un vaso y el calendario muestra en qué días gastaste en eso.' },
    { icono: 'atras', titulo: 'Para volver, «‹ Inicio»', texto: 'No hay barra de abajo: desde cada sección vuelves con «‹ Inicio». La lupa de arriba busca en todos los movimientos.' },
  ],
};

export function Tutorial() {
  const { estilo, c } = useTema();
  const { tutoriales, marcarTutorial } = usePreferencias();
  const enFoco = useIsFocused();
  const abajo = useSafeAreaInsets().bottom;
  const [paso, setPaso] = useState(0);
  const pasos = PASOS[estilo.id];
  const visible = enFoco && !tutoriales.includes(estilo.id);
  const terminar = () => { marcarTutorial(estilo.id, true); setPaso(0); };
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const ultimo = paso >= pasos.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={terminar}>
      <View style={{ flex: 1, backgroundColor: c.velo, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.tarjeta, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: abajo + 18, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto tam={12} peso="semi" color={c.tenue} lineas={1} style={{ letterSpacing: 0.6, flex: 1 }}>{`CÓMO FUNCIONA · ${estilo.nombre.toUpperCase()}`}</Texto>
            {!ultimo && <Pressable onPress={terminar} hitSlop={10}><Texto tam={14} color={c.tenue}>Saltar</Texto></Pressable>}
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
            <Icono nombre={actual.icono} tam={26} color={c.sobreBoton} />
          </View>
          <View style={{ gap: 8, minHeight: 120 }}>
            <Texto tam={22} peso={estilo.m.pesoTitulo} style={{ letterSpacing: -0.5 }}>{actual.titulo}</Texto>
            <Texto tam={15.5} color={c.tenue} style={{ lineHeight: 23 }}>{actual.texto}</Texto>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {pasos.map((_, i) => (
              <View key={i} style={{ width: i === paso ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === paso ? c.tinta : c.linea }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {paso > 0 && (
              <Pressable onPress={() => setPaso((p) => p - 1)} style={{ height: 56, paddingHorizontal: 22, borderRadius: 16, backgroundColor: c.suave, justifyContent: 'center' }}>
                <Texto tam={16} peso="semi">Atrás</Texto>
              </Pressable>
            )}
            <BotonPrincipal style={{ flex: 1 }} onPress={() => (ultimo ? terminar() : setPaso((p) => p + 1))}>{ultimo ? 'Entendido' : 'Siguiente'}</BotonPrincipal>
          </View>
        </View>
      </View>
    </Modal>
  );
}
