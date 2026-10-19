import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { delMes, netoDe, porDia, porVenirDelMes, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import type { Movimiento, Proximo } from '@/lib/tipos';
import { Buscador, CabeceraDia, Enlace, FilaMovimiento, Lista, Num, Rotulo, Segmentos, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { alfa, useTema } from '@/ui/tema';
import { ContenidoGraficos } from './Graficos';
import { cuandoViene } from './Proximos';

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';
type Vista = 'lista' | 'graficos';
const VISTAS: [Vista, string][] = [['lista', 'Lista'], ['graficos', 'Gráficos']];
const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']];

/**
 * Movimientos: la lista y los Gráficos. Arriba de la lista va lo que todavía se va a anotar solo en
 * lo que queda del mes; cuando llega su día pasa a la lista como cualquier otro movimiento.
 */
export function Movimientos() {
  const d = useDatos();
  const { vista: vistaPedida } = useLocalSearchParams<{ vista?: string }>();
  const [vista, setVista] = useState<Vista>('lista');
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(80);
  // Quien llega con `vista` cae directo en Gráficos; el parámetro se limpia para que tocar la pestaña
  // después no lo repita.
  useEffect(() => {
    if (vistaPedida === 'graficos' || vistaPedida === 'lista') {
      setVista(vistaPedida);
      router.setParams({ vista: undefined });
    }
  }, [vistaPedida]);
  const mesActual = d.hoy.slice(0, 7);
  const delMesActual = delMes(d.movimientos, mesActual);

  // El buscador y los filtros valen igual para lo anotado y para lo que viene.
  const coincide = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const nombreCat = new Map(d.categorias.map((x) => [x.id, x.nombre.toLowerCase()]));
    const nombreCuenta = new Map(d.cuentas.map((x) => [x.id, x.nombre.toLowerCase()]));
    return (m: Movimiento | Proximo) => (filtro === 'todos' || m.tipo === filtro)
      && (!q || m.nota.toLowerCase().includes(q) || (nombreCat.get(m.categoria_id ?? '') ?? '').includes(q)
        || (nombreCuenta.get(m.cuenta_id) ?? '').includes(q));
  }, [d.categorias, d.cuentas, filtro, busqueda]);

  const grupos = useMemo(() => {
    const filtrados = d.movimientos.filter(coincide).sort(ordenarPorFecha);
    return { lista: porDia(filtrados.slice(0, limite)), total: filtrados.length };
  }, [d.movimientos, coincide, limite]);

  const porVenir = porVenirDelMes(d).filter(coincide);
  const vaASalir = porVenir.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const vaAEntrar = porVenir.reduce((s, p) => s + (p.tipo === 'ingreso' ? p.monto : 0), 0);
  const nombreCuenta = (id: string) => d.cuentas.find((x) => x.id === id)?.nombre ?? '';

  const salio = sumar(delMesActual, 'gasto');
  const entro = sumar(delMesActual, 'ingreso');
  const mesNombre = mayuscula(MESES[Number(mesActual.slice(5, 7)) - 1]);

  return (
    <Marco titulo="Movimientos" subtitulo={`${mesNombre} · ${delMesActual.length} ${delMesActual.length === 1 ? 'anotado' : 'anotados'}`}>
      <Segmentos opciones={VISTAS} valor={vista} alCambiar={setVista} />

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

          {porVenir.length > 0 && (
            <View style={{ gap: 6 }}>
              <Rotulo derecha={(
                <Texto tam={13}>
                  {vaASalir > 0 && <Texto num tam={13} peso="medio" color={c.gasto}>−{neto(vaASalir, d.moneda)}</Texto>}
                  {vaASalir > 0 && vaAEntrar > 0 && '  '}
                  {vaAEntrar > 0 && <Texto num tam={13} peso="medio" color={c.ingreso}>+{neto(vaAEntrar, d.moneda)}</Texto>}
                </Texto>
              )}>
                Por venir en {mesNombre.toLowerCase()}
              </Rotulo>
              {/* Borde punteado: todavía no pasó; se anota solo cuando llegue su día. */}
              <Lista style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: alfa(c.tenue, 0.35) }}>
                {porVenir.map((p, i) => {
                  const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
                  return (
                    <FilaMovimiento key={`${p.recurrencia_id}@${p.fecha}`} m={p} primera={i === 0}
                      detalle={`Se anota solo ${cuandoViene(p.fecha, d.hoy)} · ${nombreCuenta(p.cuenta_id)}`}
                      onPress={regla ? () => abrir({ tipo: 'recurrencia', regla }) : undefined} />
                  );
                })}
              </Lista>
            </View>
          )}

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
