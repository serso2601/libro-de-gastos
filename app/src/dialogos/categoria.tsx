// La hoja de una categoría: crearla, editarla o borrarla.

import { useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { nuevoId } from '@/lib/formato';
import type { Categoria, TipoCategoria } from '@/lib/tipos';
import { BotonBorrar, BotonPrincipal, Campo, Colores, Etiqueta, Hoja, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { SimboloCategoria } from '@/ui/simbolos';
import { useTema } from '@/ui/tema';

export function DialogoCategoria({ inicial, tipoInicial = 'gasto', alCerrar }: { inicial?: Categoria; tipoInicial?: TipoCategoria; alCerrar: () => void }) {
  const { movimientos, recurrencias } = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [emoji] = useState(inicial?.emoji || '💰');
  const [error, setError] = useState('');
  const borrable = !!inicial && !movimientos.some((m) => m.categoria_id === inicial.id) && !recurrencias.some((r) => r.categoria_id === inicial.id);

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la categoría');
    acciones.guardarCategoria({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), tipo, color, emoji, presupuesto: inicial?.presupuesto ?? null, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

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
        <SimboloCategoria categoria={{ nombre, color, emoji }} tam={48} />
        <Campo value={nombre} onChangeText={setNombre} placeholder="Nombre de la categoría" autoFocus={!inicial} style={{ flex: 1 }} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Color</Etiqueta>
        <Colores valor={color} alCambiar={setColor} />
      </View>
    </Hoja>
  );
}
