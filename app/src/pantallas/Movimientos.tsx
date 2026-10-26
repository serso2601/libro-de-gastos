import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { delMes, netoDe, pagoSugerido, porDia, porVenirDelMes, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import type { Movimiento, Proximo } from '@/lib/tipos';
import { Buscador, CabeceraDia, Enlace, FilaMovimiento, Lista, Num, Rotulo, Segmentos, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { useVez } from '@/ui/animar';
import { useDisposicion } from '@/ui/disposicion';
import { FilaViva, GrupoVivo, ListaViva } from '@/ui/filaViva';
import { Icono } from '@/ui/iconos';
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
 * lo que queda del mes; cuando llega su día pasa a la lista como cualquier otro movimiento. En una pantalla
 * ancha, la lista y los Gráficos van lado a lado.
 */
export function Movimientos() {
  const d = useDatos();
  const { vista: vistaPedida } = useLocalSearchParams<{ vista?: string }>();
  const [vista, setVista] = useState<Vista>('lista');
  const abrir = useAbrir();
  const anotar = useAnotar();
  const { c, colorCuenta } = useTema();
  const { dosColumnas, margen } = useDisposicion();
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
  // Cada vez que se abre la pestaña, las filas entran en cascada (cada una en su lugar de la pantalla).
  const vez = useVez();
  const antes: number[] = [];
  grupos.lista.reduce((n, [, items]) => { antes.push(n); return n + items.length; }, 0);

  const porVenir = porVenirDelMes(d).filter(coincide);
  const vaASalir = porVenir.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const vaAEntrar = porVenir.reduce((s, p) => s + (p.tipo === 'ingreso' ? p.monto : 0), 0);
  // Pagos de tarjeta que la app sugiere (nunca se anotan solos): tocarlos abre la transferencia ya armada.
  // Si la fecha de pago cae en otro mes, no se muestra aquí.
  const sugeridos = useMemo(() => {
    if (filtro !== 'todos' && filtro !== 'transferencia') return [];
    const q = busqueda.trim().toLowerCase();
    return d.cuentas.flatMap((cuenta) => {
      const pago = cuenta.es_credito ? pagoSugerido(d, cuenta) : null;
      return pago && (!q || `pago de ${cuenta.nombre}`.toLowerCase().includes(q)) ? [{ cuenta, pago }] : [];
    }).sort((a, b) => (a.pago.fecha ?? '9').localeCompare(b.pago.fecha ?? '9'));
  }, [d, filtro, busqueda]);
  function registrarPago(tarjeta: string, total: number) {
    anotar({ tipoInicial: 'transferencia', cuentaInicial: d.cuentas.find((x) => !x.es_credito)?.id, destinoInicial: tarjeta,
      montoInicial: total, notaInicial: `Pago de ${d.cuentas.find((x) => x.id === tarjeta)?.nombre ?? ''}` });
  }
  const nombreCuenta = (id: string) => d.cuentas.find((x) => x.id === id)?.nombre ?? '';

  const salio = sumar(delMesActual, 'gasto');
  const entro = sumar(delMesActual, 'ingreso');
  const mesNombre = mayuscula(MESES[Number(mesActual.slice(5, 7)) - 1]);

  const lista = (
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: dosColumnas ? 0 : -margen }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: dosColumnas ? 0 : margen }}>
        {FILTROS.map(([id, texto]) => {
          const activo = filtro === id;
          return (
            <Pressable key={id} onPress={() => setFiltro(id)} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: activo ? c.boton : c.tarjeta, justifyContent: 'center' }}>
              <Texto tam={13} peso={activo ? 'semi' : 'medio'} color={activo ? c.sobreBoton : c.tenue}>{texto}</Texto>
            </Pressable>
          );
        })}
      </ScrollView>

      {(porVenir.length > 0 || sugeridos.length > 0) && (
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
          {/* Borde punteado: todavía no pasó; se anota solo cuando llegue su día (el pago de una tarjeta, solo si tú lo confirmas). */}
          <Lista style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: alfa(c.tenue, 0.35) }}>
            {porVenir.map((p, i) => {
              const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
              return (
                <FilaMovimiento key={`${p.recurrencia_id}@${p.fecha}`} m={p} primera={i === 0}
                  detalle={`Se anota solo ${cuandoViene(p.fecha, d.hoy)} · ${nombreCuenta(p.cuenta_id)}`}
                  onPress={regla ? () => abrir({ tipo: 'recurrencia', regla }) : undefined} />
              );
            })}
            {sugeridos.map(({ cuenta, pago }, i) => {
              const delMesPago = pago.fecha && pago.fecha.slice(0, 7) === mesActual ? pago.fecha : null;
              const cuando = delMesPago ? (delMesPago < d.hoy ? `venció el ${Number(delMesPago.slice(8))}` : `paga ${cuandoViene(delMesPago, d.hoy)}`) : '';
              return (
                <Pressable key={`pago@${cuenta.id}`} onPress={() => registrarPago(cuenta.id, pago.total)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 6,
                    borderTopWidth: porVenir.length + i === 0 ? 0 : 1, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 6, height: 28, borderRadius: 3, backgroundColor: colorCuenta(cuenta.color) }} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Texto tam={15} peso="medio" lineas={1} style={{ flexShrink: 1 }}>Pago de {cuenta.nombre}</Texto>
                      <Icono nombre="transferir" tam={12} color={c.tenue} />
                    </View>
                    <Texto tam={13} color={c.tenue} lineas={2}>
                      Sugerido · Total {neto(pago.total, d.moneda)}{pago.minimo ? ` · Mínimo ${neto(pago.minimo, d.moneda)}` : ''}{cuando ? ` · ${cuando}` : ''}
                    </Texto>
                  </View>
                  <Texto tam={13} peso="semi" color={c.acento}>Registrar</Texto>
                </Pressable>
              );
            })}
          </Lista>
        </View>
      )}

      {grupos.lista.length === 0
        ? <Vacio>{busqueda || filtro !== 'todos' ? 'No hay nada que coincida.' : 'Todavía no hay movimientos. Toca + para anotar el primero.'}</Vacio>
        : grupos.lista.map(([fecha, items], g) => (
          <GrupoVivo key={fecha} style={{ gap: 6 }}>
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(netoDe(items), d.moneda, true)} />
            <ListaViva>
              {items.map((m, i) => (
                <FilaViva key={m.id} id={m.id} orden={antes[g] + i} vez={vez}>
                  <FilaMovimiento m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
                </FilaViva>
              ))}
            </ListaViva>
          </GrupoVivo>
        ))}
      {grupos.total > limite && (
        <GrupoVivo style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Enlace tam={15} onPress={() => setLimite((l) => l + 200)}>Ver más ({grupos.total - limite})</Enlace>
        </GrupoVivo>
      )}
    </>
  );

  return (
    <Marco angosto={!dosColumnas} titulo="Movimientos" subtitulo={`${mesNombre} · ${delMesActual.length} ${delMesActual.length === 1 ? 'anotado' : 'anotados'}`}>
      {dosColumnas ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 36 }}>
          <View style={{ flex: 6, minWidth: 0, gap: 12 }}>{lista}</View>
          <View style={{ flex: 5, minWidth: 0, gap: 12 }}><ContenidoGraficos /></View>
        </View>
      ) : (
        <>
          <Segmentos opciones={VISTAS} valor={vista} alCambiar={setVista} />
          {vista === 'graficos' ? <ContenidoGraficos /> : lista}
        </>
      )}
    </Marco>
  );
}
