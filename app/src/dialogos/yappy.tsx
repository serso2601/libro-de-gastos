// La categoría que se les pone a los Yappy que entran solos. Si ya le pusiste categoría a esa persona o comercio,
// se usa la de antes; si no, la que se elige aquí (o la automática: Compras / la primera de ingresos).

import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { categoriaYappy } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { fechaISO } from '@/lib/formato';
import { Enlace, Etiqueta, Hoja, Texto } from '@/ui/componentes';
import { useTema } from '@/ui/tema';
import { ElegirCategoria } from './piezas';

export function DialogoYappy({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const { c } = useTema();
  const { guardarCategoriaYappy } = useAcciones();
  const hoy = fechaISO(new Date());

  const selector = (tipo: 'gasto' | 'ingreso', titulo: string) => {
    const { categoria, automatica } = categoriaYappy(d, tipo);
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Etiqueta>{titulo}</Etiqueta>
          {automatica
            ? <Texto tam={13} color={c.tenue}>Automática</Texto>
            : <Enlace tam={13} onPress={() => guardarCategoriaYappy(tipo, null)}>Volver a automática</Enlace>}
        </View>
        <ElegirCategoria tipo={tipo} valor={categoria?.id ?? ''} fecha={hoy} rotulo={false}
          alCambiar={(id) => guardarCategoriaYappy(tipo, id)} />
      </View>
    );
  };

  return (
    <Hoja titulo="Categoría de los Yappy" alCerrar={alCerrar} derecha={<Enlace tam={17} onPress={alCerrar}>Listo</Enlace>}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        Los Yappy entran solos con el nombre de la persona o comercio. Si ya le pusiste categoría a esa persona antes, se usa esa; si no, esta:
      </Texto>
      {selector('gasto', 'Gastos')}
      {selector('ingreso', 'Ingresos')}
    </Hoja>
  );
}
