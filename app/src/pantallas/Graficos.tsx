import { useMemo } from 'react';
import { View } from 'react-native';
import { claveMes, diasDelMes, fraseDona, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dineroCorto, MESES_CORTOS } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import { NavegadorMes, Num, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Barras, Dona, Leyenda } from '@/ui/graficos';
import { Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

export function Graficos() {
  const d = useDatos();
  const mes = useMes();
  const { c, estilo, oscuro } = useTema();

  const porCategoria = useMemo(() => {
    const delMes = d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha.startsWith(mes.clave));
    const lista = d.categorias.filter((x) => x.tipo === 'gasto')
      .map((x) => ({ id: x.id, nombre: x.nombre, color: x.color, total: delMes.reduce((s, m) => s + (m.categoria_id === x.id ? m.monto : 0), 0) }))
      .filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    const sinCat = delMes.reduce((s, m) => s + (m.categoria_id && d.categorias.some((x) => x.id === m.categoria_id) ? 0 : m.monto), 0);
    if (sinCat > 0) lista.push({ id: 'sin', nombre: 'Sin categoría', color: '#94A3B8', total: sinCat });
    // Con muchas categorías, las chicas se juntan en «Otras» para que la leyenda se lea.
    if (lista.length <= 6) return lista;
    const resto = lista.slice(5);
    return [...lista.slice(0, 5), { id: 'otras', nombre: 'Otras', color: '#A7ADB6', total: resto.reduce((s, x) => s + x.total, 0) }];
  }, [d.movimientos, d.categorias, mes.clave]);
  const total = porCategoria.reduce((s, x) => s + x.total, 0);

  const seisMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const f = new Date(mes.anio, mes.mes - 6 + i, 1);
    const clave = claveMes(f.getFullYear(), f.getMonth() + 1);
    const movs = d.movimientos.filter((m) => m.fecha.startsWith(clave));
    return { clave, etiqueta: MESES_CORTOS[f.getMonth()], ingresos: sumar(movs, 'ingreso'), gastos: sumar(movs, 'gasto'), actual: i === 5 };
  }), [d.movimientos, mes.anio, mes.mes]);

  const bloque = (cual: 'lavanda' | 'menta') => estilo.bloques
    ? (oscuro ? mezclar(c.tarjeta, estilo.bloques[cual].base, 0.22) : estilo.bloques[cual].claro)
    : c.tarjeta;
  const pesoTitulo = estilo.m.pesoTitulo === 'extra' ? 'negrita' : 'semi';
  const hoy = aFecha(d.hoy);
  const avance = hoy.getDate() / diasDelMes(mes.anio, mes.mes);
  const nota = mes.esActual ? `${mes.nombre} ${avance < 0.35 ? 'recién empieza' : avance < 0.7 ? 'todavía va por la mitad' : 'ya casi termina'}.` : null;

  return (
    <Marco titulo="Gráficos">
      <NavegadorMes nombre={mes.nombre} anio={mes.anio} mover={mes.mover} />

      <Tarjeta color={bloque('lavanda')} style={{ padding: 16, gap: 8 }}>
        <Texto tam={15} peso={pesoTitulo}>Gastos por categoría</Texto>
        {porCategoria.length === 0 ? <Vacio>Sin gastos en {mes.nombre.toLowerCase()}.</Vacio> : (
          <>
            <Texto tam={13} color={c.tenue} style={{ marginTop: -4 }}>{fraseDona(porCategoria[0].nombre, porCategoria[0].total, total)}</Texto>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
              <Dona datos={porCategoria} centro={dineroCorto(total, d.moneda)} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                {porCategoria.map((x) => (
                  <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 22 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: x.color }} />
                    <Texto tam={13} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                    <Texto tam={13} color={c.tenue} style={{ width: 34, textAlign: 'right' }}>{Math.round((x.total / total) * 100)}%</Texto>
                    <Num tam={13} peso="medio" style={{ minWidth: 48, textAlign: 'right' }}>{dineroCorto(x.total, d.moneda)}</Num>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </Tarjeta>

      <Tarjeta color={bloque('menta')} style={{ padding: 16, gap: 8 }}>
        <Texto tam={15} peso={pesoTitulo}>Ingresos y gastos · 6 meses</Texto>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Leyenda color={c.bien} texto="Ingresos" />
          <Leyenda color={estilo.id === 'billetera' ? c.tinta : c.calor[3]} texto="Gastos" />
        </View>
        <Barras datos={seisMeses} colorGastos={estilo.id === 'billetera' ? c.tinta : c.calor[3]} />
        {nota && <Texto tam={12} color={c.tenue}>{nota}</Texto>}
      </Tarjeta>
    </Marco>
  );
}
