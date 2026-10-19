import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { delMes, netoDe, porDia, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import { Buscador, CabeceraDia, Enlace, FilaMovimiento, Lista, Num, Segmentos, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';
import { ContenidoGraficos } from './Graficos';
import { ContenidoProximos } from './Proximos';

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';
type Vista = 'lista' | 'proximos' | 'graficos';
const VISTAS: [Vista, string][] = [['lista', 'Lista'], ['proximos', 'Próximos'], ['graficos', 'Gráficos']];
const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']];

/** Movimientos y sus tres vistas: la lista, lo que viene (Próximos) y los Gráficos. */
export function Movimientos() {
  const d = useDatos();
  const { vista: vistaPedida } = useLocalSearchParams<{ vista?: string }>();
  const [vista, setVista] = useState<Vista>('lista');
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(80);
  // Quien llega desde el Inicio con `vista` cae directo en Próximos o Gráficos; el parámetro se limpia
  // para que tocar la pestaña después no lo repita.
  useEffect(() => {
    if (vistaPedida === 'proximos' || vistaPedida === 'graficos' || vistaPedida === 'lista') {
      setVista(vistaPedida);
      router.setParams({ vista: undefined });
    }
  }, [vistaPedida]);
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

  const salio = sumar(delMesActual, 'gasto');
  const entro = sumar(delMesActual, 'ingreso');
  const mesNombre = mayuscula(MESES[Number(mesActual.slice(5, 7)) - 1]);

  return (
    <Marco titulo="Movimientos" subtitulo={`${mesNombre} · ${delMesActual.length} ${delMesActual.length === 1 ? 'anotado' : 'anotados'}`}>
      <Segmentos opciones={VISTAS} valor={vista} alCambiar={setVista} />

      {vista === 'proximos' && <ContenidoProximos />}
      {vista === 'graficos' && <ContenidoGraficos />}
      {vista === 'lista' && (
        <>
          <Tarjeta style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, gap: 16 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto tam={13} color={c.tenue}>Salió</Texto>
              <Num tam={22} color={salio ? c.gasto : undefined} lineas={1}>{neto(salio, d.moneda)}</Num>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto tam={13} color={c.tenue}>Entró</Texto>
              <Num tam={22} color={entro ? c.ingreso : undefined} lineas={1}>{neto(entro, d.moneda)}</Num>
            </View>
          </Tarjeta>

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
        </>
      )}
    </Marco>
  );
}
