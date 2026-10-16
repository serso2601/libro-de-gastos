import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { useDatos } from '@/lib/datos';
import { dinero, etiquetaDia, ordenarPorFecha } from '@/lib/formato';
import type { Movimiento } from '@/lib/tipos';
import { Campo, FilaMovimiento, Separador, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Pantalla } from '@/ui/pantalla';
import { C } from '@/ui/tema';

type Filtro = 'todos' | 'gasto' | 'ingreso' | 'transferencia';
const FILTROS: [Filtro, string][] = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['transferencia', 'Transferencias']];

export default function Movimientos() {
  const d = useDatos();
  const abrir = useAbrir();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [limite, setLimite] = useState(100);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const nombreCat = new Map(d.categorias.map((c) => [c.id, c.nombre.toLowerCase()]));
    const filtrados = d.movimientos
      .filter((m) => filtro === 'todos' || m.tipo === filtro)
      .filter((m) => !q || m.nota.toLowerCase().includes(q) || (nombreCat.get(m.categoria_id ?? '') ?? '').includes(q))
      .sort(ordenarPorFecha);
    const mapa = new Map<string, Movimiento[]>();
    for (const m of filtrados.slice(0, limite)) mapa.set(m.fecha, [...(mapa.get(m.fecha) ?? []), m]);
    return { lista: [...mapa.entries()], total: filtrados.length };
  }, [d.movimientos, d.categorias, filtro, busqueda, limite]);

  return (
    <Pantalla titulo="Movimientos">
      <Campo value={busqueda} onChangeText={setBusqueda} placeholder="🔍  Buscar por descripción o categoría" clearButtonMode="while-editing"
        style={{ backgroundColor: C.tarjeta, borderWidth: 0, marginBottom: 12 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginBottom: 16, flexGrow: 0 }}>
        {FILTROS.map(([id, texto]) => (
          <Pressable key={id} onPress={() => setFiltro(id)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: filtro === id ? C.acento : C.tarjeta }}>
            <Texto tam={12} peso="semi" color={filtro === id ? C.blanco : C.tenue}>{texto}</Texto>
          </Pressable>
        ))}
      </ScrollView>

      {grupos.lista.length === 0 ? <Vacio>No hay movimientos para mostrar.</Vacio> : grupos.lista.map(([fecha, items]) => {
        const neto = items.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : m.tipo === 'gasto' ? -m.monto : 0), 0);
        const dia = etiquetaDia(fecha, d.hoy);
        return (
          <View key={fecha}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 }}>
              <Texto tam={12} peso="semi" color={C.tenue}>{dia.charAt(0).toUpperCase() + dia.slice(1)}</Texto>
              <Texto tam={12} mono peso="semi" color={neto >= 0 ? C.bien : C.alerta}>{neto >= 0 ? '+' : '−'}{dinero(Math.abs(neto), d.moneda)}</Texto>
            </View>
            <Tarjeta style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {items.map((m, i) => (
                <View key={m.id}>
                  {i > 0 && <Separador />}
                  <FilaMovimiento m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
                </View>
              ))}
            </Tarjeta>
          </View>
        );
      })}
      {grupos.total > limite && (
        <Pressable onPress={() => setLimite((l) => l + 200)} style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Texto peso="semi" color={C.acentoClaro}>Ver más ({grupos.total - limite})</Texto>
        </Pressable>
      )}
    </Pantalla>
  );
}
