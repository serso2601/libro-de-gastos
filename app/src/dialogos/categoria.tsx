// La hoja de una categoría: crearla, editarla o borrarla.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { nuevoId } from '@/lib/formato';
import type { Categoria, TipoCategoria } from '@/lib/tipos';
import { BotonBorrar, BotonPrincipal, Campo, Colores, Etiqueta, Hoja, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { SIMBOLOS, Simbolo, SimboloCategoria, esSimbolo, sinElegir, sugerirSimbolo } from '@/ui/simbolos';
import { useTema } from '@/ui/tema';
import { Grilla } from './piezas';

/** El primer emoji de un texto (con sus uniones, tonos de piel y banderas), o '' si no hay nada. */
function primerEmoji(texto: string): string {
  const piezas = Array.from(texto.trim());
  if (!piezas.length) return '';
  const cp = (x: string) => x.codePointAt(0) ?? 0;
  const indicador = (x: string) => cp(x) >= 0x1f1e6 && cp(x) <= 0x1f1ff;
  const pegado = (x: string) => {
    const n = cp(x);
    return n === 0xfe0f || n === 0xfe0e || n === 0x20e3 || (n >= 0x1f3fb && n <= 0x1f3ff) || (n >= 0xe0020 && n <= 0xe007f);
  };
  let r = piezas[0];
  let i = 1;
  if (indicador(r) && piezas[1] && indicador(piezas[1])) { r += piezas[1]; i = 2; }
  while (i < piezas.length) {
    if (pegado(piezas[i])) r += piezas[i++];
    else if (cp(piezas[i]) === 0x200d && piezas[i + 1]) { r += piezas[i] + piezas[i + 1]; i += 2; }
    else break;
  }
  return r;
}

export function DialogoCategoria({ inicial, tipoInicial = 'gasto', alCerrar }: { inicial?: Categoria; tipoInicial?: TipoCategoria; alCerrar: () => void }) {
  const { movimientos, recurrencias } = useDatos();
  const { c, pastel } = useTema();
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [emoji, setEmoji] = useState(inicial?.emoji || '💰');
  // «Emoji» es una opción aparte: mientras esté elegida se muestra el campo y se guarda lo que se escriba ahí.
  const enModoEmoji = !!inicial && !esSimbolo(inicial.emoji) && !sinElegir(inicial.emoji);
  const [modoEmoji, setModoEmoji] = useState(enModoEmoji);
  const [textoEmoji, setTextoEmoji] = useState(enModoEmoji ? inicial.emoji : '');
  // En una categoría nueva, mientras no toque el símbolo, el nombre que escribe le sugiere uno.
  const [elegido, setElegido] = useState(!!inicial);
  const [error, setError] = useState('');
  const borrable = !!inicial && !movimientos.some((m) => m.categoria_id === inicial.id) && !recurrencias.some((r) => r.categoria_id === inicial.id);
  const emojiFinal = modoEmoji ? primerEmoji(textoEmoji) || '💰' : emoji;

  function cambiarNombre(t: string) {
    setNombre(t);
    if (!elegido) {
      const s = sugerirSimbolo(t);
      setEmoji(s ? `i:${s}` : '💰');
    }
  }

  function elegirSimbolo(nuevo: string) {
    Haptics.selectionAsync();
    setElegido(true);
    setModoEmoji(false);
    setEmoji(nuevo);
    setError('');
  }

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la categoría');
    if (modoEmoji && !primerEmoji(textoEmoji)) return setError('Escribe un emoji o elige otro símbolo');
    acciones.guardarCategoria({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), tipo, color, emoji: emojiFinal, presupuesto: inicial?.presupuesto ?? null, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  const opciones: [string, string, boolean, () => void][] = [
    ['Letra', 'Usar la inicial del nombre', !modoEmoji && sinElegir(emoji), () => elegirSimbolo('💰')],
    ['Emoji', 'Poner un emoji', modoEmoji, () => { Haptics.selectionAsync(); setElegido(true); setModoEmoji(true); setError(''); }],
  ];

  return (
    <Hoja titulo={inicial ? 'Editar categoría' : 'Nueva categoría'} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear categoría'}</BotonPrincipal>
          {inicial && (borrable
            ? <BotonBorrar texto="Borrar categoría" onPress={() => { acciones.borrarCategoria(inicial); alCerrar(); }} />
            : <Texto tam={13} color={c.tenue} centro style={{ paddingVertical: 8 }}>No se puede borrar: tiene movimientos o se repite.</Texto>)}
        </>
      )}>
      {inicial
        ? <Texto tam={14} color={c.tenue}>Categoría de {tipo}s</Texto>
        : <Segmentos<TipoCategoria> opciones={[['gasto', 'De gastos'], ['ingreso', 'De ingresos']]} valor={tipo} alCambiar={setTipo} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SimboloCategoria categoria={{ nombre, color, emoji: emojiFinal }} tam={48} />
        <Campo value={nombre} onChangeText={cambiarNombre} placeholder="Nombre de la categoría" autoFocus={!inicial} style={{ flex: 1 }} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Color</Etiqueta>
        <Colores valor={color} alCambiar={setColor} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Símbolo</Etiqueta>
        <Grilla columnas={7}>
          {Object.entries(SIMBOLOS).map(([clave, nombreSimbolo]) => {
            const activo = !modoEmoji && emoji === `i:${clave}`;
            return (
              <Pressable key={clave} onPress={() => elegirSimbolo(`i:${clave}`)} accessibilityLabel={nombreSimbolo} accessibilityState={{ selected: activo }}
                style={{ aspectRatio: 1, borderRadius: 13, backgroundColor: pastel(color), alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: activo ? c.tinta : 'transparent' }}>
                <Simbolo clave={clave} tam={22} color={color} />
              </Pressable>
            );
          })}
        </Grilla>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {opciones.map(([texto, ayuda, activo, alTocar]) => (
            <Pressable key={texto} onPress={alTocar} accessibilityLabel={ayuda} accessibilityState={{ selected: activo }}
              style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: activo ? c.boton : c.suave, alignItems: 'center', justifyContent: 'center' }}>
              <Texto tam={14} peso={activo ? 'semi' : 'normal'} color={activo ? c.sobreBoton : c.tinta}>{texto}</Texto>
            </Pressable>
          ))}
        </View>
        {modoEmoji && (
          <Campo value={textoEmoji} onChangeText={(t) => { setTextoEmoji(primerEmoji(textoEmoji && t.startsWith(textoEmoji) && t.length > textoEmoji.length ? t.slice(textoEmoji.length) : t)); setError(''); }} placeholder="Escribe o pega un emoji"
            autoFocus autoCorrect={false} accessibilityLabel="Emoji de la categoría" style={{ textAlign: 'center', fontSize: 24 }} />
        )}
      </View>
    </Hoja>
  );
}
