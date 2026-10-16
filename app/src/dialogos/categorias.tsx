import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { nuevoId } from '@/lib/formato';
import type { Categoria, TipoCategoria } from '@/lib/tipos';
import { Campo, Colores, Etiqueta, Texto } from '@/ui/componentes';
import { alfa, C, PALETA } from '@/ui/tema';

/** La grilla de categorías para elegir una, con la opción de crear otra ahí mismo. */
export function ElegirCategoria({ tipo, valor, alCambiar }: { tipo: TipoCategoria; valor: string; alCambiar: (id: string) => void }) {
  const { categorias } = useDatos();
  const { guardarCategoria } = useAcciones();
  const [nueva, setNueva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [color, setColor] = useState(PALETA[0]);
  const disponibles = categorias.filter((c) => c.tipo === tipo);

  function crear() {
    if (!nombre.trim()) return;
    const c: Categoria = { id: nuevoId(), nombre: nombre.trim(), tipo, color, emoji: emoji || '💰', presupuesto: null, orden: 999 };
    guardarCategoria(c);
    alCambiar(c.id);
    setNueva(false);
    setNombre('');
  }

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Etiqueta>Categoría</Etiqueta>
        <Pressable onPress={() => setNueva((v) => !v)} hitSlop={8}><Texto tam={12} peso="semi" color={C.acentoClaro}>+ nueva</Texto></Pressable>
      </View>
      {nueva && (
        <View style={{ backgroundColor: C.fondo, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Campo value={emoji} onChangeText={setEmoji} style={{ width: 56, textAlign: 'center', fontSize: 20 }} />
            <Campo value={nombre} onChangeText={setNombre} placeholder="Nombre" style={{ flex: 1 }} />
          </View>
          <Colores valor={color} alCambiar={setColor} />
          <Pressable onPress={crear} style={{ backgroundColor: C.acento, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
            <Texto tam={13} peso="semi">Crear categoría</Texto>
          </Pressable>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {disponibles.map((c) => {
          const activa = valor === c.id;
          return (
            <Pressable key={c.id} onPress={() => alCambiar(c.id)}
              style={{ width: '23%', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
                borderColor: activa ? c.color : C.linea, backgroundColor: activa ? alfa(c.color, 0.12) : 'transparent' }}>
              <Texto tam={20}>{c.emoji}</Texto>
              <Texto tam={10} color={activa ? c.color : C.tenue} lineas={1} style={{ paddingHorizontal: 2 }}>{c.nombre}</Texto>
            </Pressable>
          );
        })}
        {disponibles.length === 0 && <Texto tam={12} color={C.tenue}>No hay categorías de {tipo}s todavía. Crea una arriba.</Texto>}
      </View>
    </>
  );
}
