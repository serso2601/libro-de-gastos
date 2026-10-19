import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { delMes, netoDe, porDia } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import { Buscador, CabeceraDia, Enlace, FilaMovimiento, Lista, Texto, Vacio } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';
const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']];

export function Movimientos() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(80);
  const mesActual = d.hoy.slice(0, 7);
  const delMesActual = delMes(d.movimientos, mesActual);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const nombreCat = new Map(d.categorias.map((x) => [x.id, x.nombre.toLowerCase()]));
    const nombreCuenta = new Map(d.cuentas.map((x) => [x.id, x.nombre.toLowerCase()]));
    const filtrados = d.movimientos
      .filter((m) => filtro === 'todos' || m.tipo === filtro)
      .filter((m) => !q || m.nota.toLowerCase().includes(q) || (nombreCat.get(m.categoria_id ?? '') ?? '').includes(q)
        || (nombreCuenta.get(m.cuenta_id) ?? '').includes(q))
      .sort(ordenarPorFecha);
    return { lista: porDia(filtrados.slice(0, limite)), total: filtrados.length };
  }, [d.movimientos, d.categorias, d.cuentas, filtro, busqueda, limite]);

  const mesNombre = mayuscula(MESES[Number(mesActual.slice(5, 7)) - 1]);

  return (
    <Marco titulo="Movimientos" subtitulo={`${mesNombre} · ${delMesActual.length} ${delMesActual.length === 1 ? 'anotado' : 'anotados'}`}>
      <Buscador valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar por descripción o categoría" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -estilo.m.margen }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: estilo.m.margen }}>
        {FILTROS.map(([id, texto]) => {
          const activo = filtro === id;
          return (
            <Pressable key={id} onPress={() => setFiltro(id)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: activo ? c.boton : c.tarjeta, justifyContent: 'center' }}>
              <Texto tam={13} peso={activo ? 'semi' : 'medio'} color={activo ? c.sobreBoton : c.tenue}>{texto}</Texto>
            </Pressable>
          );
        })}
      </ScrollView>

      {grupos.lista.length === 0
        ? <Vacio>{busqueda || filtro !== 'todos' ? 'No hay nada que coincida.' : 'Todavía no hay movimientos. Toca + para anotar el primero.'}</Vacio>
        : grupos.lista.map(([fecha, items]) => (
          <View key={fecha} style={{ gap: 6 }}>
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(netoDe(items), d.moneda, true)} />
            <Lista>
              {items.map((m, i) => <FilaMovimiento key={m.id} m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />)}
            </Lista>
          </View>
        ))}
      {grupos.total > limite && (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Enlace tam={15} onPress={() => setLimite((l) => l + 200)}>Ver más ({grupos.total - limite})</Enlace>
        </View>
      )}
    </Marco>
  );
}
