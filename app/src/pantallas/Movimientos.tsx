import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { delMes, gastoPorDia, netoDe, nivelador, porDia, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import { Campo, CabeceraDia, Enlace, FilaMovimiento, Lista, Num, PildoraAnotar, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';
const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']];

export function Movimientos() {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const { c, estilo, oscuro } = useTema();
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

  // El cuadrito de calor de cada día (Calendario), comparado con su propio mes.
  const calorDe = useMemo(() => {
    if (estilo.id !== 'calendario') return null;
    const cache = new Map<string, { dias: number[]; nivel: ReturnType<typeof nivelador> }>();
    return (fecha: string) => {
      const clave = fecha.slice(0, 7);
      if (!cache.has(clave)) {
        const dias = gastoPorDia(d.movimientos, Number(clave.slice(0, 4)), Number(clave.slice(5, 7)));
        cache.set(clave, { dias, nivel: nivelador(dias) });
      }
      const x = cache.get(clave)!;
      return c.calor[x.nivel(x.dias[Number(fecha.slice(8, 10)) - 1])];
    };
  }, [estilo.id, d.movimientos, c.calor]);

  const mesNombre = mayuscula(MESES[Number(mesActual.slice(5, 7)) - 1]);
  const limon = estilo.id === 'mosaico' && estilo.bloques ? (oscuro ? mezclar(c.tarjeta, estilo.bloques.limon.base, 0.22) : estilo.bloques.limon.claro) : null;

  return (
    <Marco titulo="Movimientos" subtitulo={`${mesNombre} · ${delMesActual.length} ${delMesActual.length === 1 ? 'anotado' : 'anotados'}`}
      pie={estilo.navegacion === 'bloques' ? <PildoraAnotar onPress={() => anotar()} /> : undefined}>
      {limon && (
        <Tarjeta color={limon} style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tam={12.5} color={c.tenue}>Salió</Texto>
            <Num tam={24}>−{neto(sumar(delMesActual, 'gasto'), d.moneda)}</Num>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tam={12.5} color={c.tenue}>Entró</Texto>
            <Num tam={24} color={c.bien}>+{neto(sumar(delMesActual, 'ingreso'), d.moneda)}</Num>
          </View>
        </Tarjeta>
      )}

      <View style={{ height: 46, borderRadius: estilo.m.esquinas >= 24 ? 16 : 14, backgroundColor: c.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14 }}>
        <Icono nombre="buscar" tam={18} color={c.tenue} />
        <Campo value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por descripción o categoría" clearButtonMode="while-editing"
          style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0, height: 44 }} returnKeyType="search" />
      </View>

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
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(netoDe(items), d.moneda, true)} calor={calorDe?.(fecha)} />
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
