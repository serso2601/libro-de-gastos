// Las preguntas de confirmar («¿Borrar esta cuenta?»). En el teléfono son las de iOS (Alert.alert); en
// la web Alert no hace nada, así que se dibujan aquí, con el mismo aspecto, en <AnfitrionAvisos>.

import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, View, type AlertButton } from 'react-native';
import { Texto } from './componentes';
import { alfa, useTema } from './tema';

interface Aviso {
  titulo: string;
  mensaje?: string;
  botones: AlertButton[];
}

let mostrar: ((a: Aviso | null) => void) | null = null;

/** Igual que Alert.alert: sin botones queda uno de «OK». */
export function avisar(titulo: string, mensaje?: string, botones?: AlertButton[]): void {
  if (Platform.OS !== 'web') return Alert.alert(titulo, mensaje, botones);
  mostrar?.({ titulo, mensaje, botones: botones?.length ? botones : [{ text: 'OK' }] });
}

export function AnfitrionAvisos() {
  const { c } = useTema();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  useEffect(() => {
    mostrar = setAviso;
    return () => { mostrar = null; };
  }, []);
  if (!aviso) return null;

  const enFila = aviso.botones.length === 2;
  // Como en iOS: «Cancelar» va a la izquierda en fila y al final en columna.
  const botones = enFila
    ? [...aviso.botones].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'))
    : [...aviso.botones].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));
  const cancelar = aviso.botones.find((b) => b.style === 'cancel');

  function tocar(b?: AlertButton) {
    setAviso(null);
    b?.onPress?.();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => tocar(cancelar)}>
      <Pressable onPress={cancelar ? () => tocar(cancelar) : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable style={{ width: 290, maxWidth: '100%', borderRadius: 16, backgroundColor: c.tarjeta, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, gap: 6 }}>
            <Texto tam={17} peso="semi" centro>{aviso.titulo}</Texto>
            {aviso.mensaje ? <Texto tam={13} color={c.tenue} centro style={{ lineHeight: 18 }}>{aviso.mensaje}</Texto> : null}
          </View>
          <View style={{ flexDirection: enFila ? 'row' : 'column' }}>
            {botones.map((b, i) => (
              <Pressable key={b.text ?? i} onPress={() => tocar(b)}
                style={({ pressed }) => ({
                  flex: enFila ? 1 : undefined, height: 46, alignItems: 'center', justifyContent: 'center',
                  borderTopWidth: 1, borderLeftWidth: enFila && i > 0 ? 1 : 0, borderColor: alfa(c.tenue, 0.2),
                  backgroundColor: pressed ? c.suave : 'transparent',
                })}>
                <Texto tam={17} peso={b.style === 'cancel' ? 'semi' : 'normal'} color={b.style === 'destructive' ? c.alerta : c.acento}>{b.text}</Texto>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
