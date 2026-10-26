import { useMemo } from 'react';
import { View } from 'react-native';
import { claveMes, diasDelMes, fraseDona, sumar } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dineroCorto, MESES, MESES_CORTOS, mayuscula } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import { NavegadorMes, Num, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Barras, Dona, Leyenda } from '@/ui/graficos';
import { useTema } from '@/ui/tema';
import { Deslizar } from '@/ui/deslizar';

/** Los gráficos del mes: dona por categoría, barras de 6 meses y este mes contra el anterior. Sin marco: vive dentro de Movimientos. */
export function ContenidoGraficos() {
  const d = useDatos();
  const mes = useMes();
  const { c } = useTema();

  const porCategoria = useMemo(() => {
    const delMes = d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha.startsWith(mes.clave));
    const lista = d.categorias.filter((x) => x.tipo === 'gasto')
      .map((x) => ({ id: x.id, nombre: x.nombre, color: x.color, total: delMes.reduce((s, m) => s + (m.categoria_id === x.id ? m.monto : 0), 0) }))
      .filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    const sinCat = delMes.reduce((s, m) => s + (m.categoria_id && d.categorias.some((x) => x.id === m.categoria_id) ? 0 : m.monto), 0);
    if (sinCat > 0) lista.push({ id: 'sin', nombre: 'Sin categoría', color: c.tenue, total: sinCat });
    // Con muchas categorías, las chicas se juntan en «Otras» para que la leyenda se lea.
    if (lista.length <= 6) return lista;
    const resto = lista.slice(5);
    return [...lista.slice(0, 5), { id: 'otras', nombre: 'Otras', color: c.tenue, total: resto.reduce((s, x) => s + x.total, 0) }];
  }, [d.movimientos, d.categorias, mes.clave, c.tenue]);
  const total = porCategoria.reduce((s, x) => s + x.total, 0);

  const seisMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const f = new Date(mes.anio, mes.mes - 6 + i, 1);
    const clave = claveMes(f.getFullYear(), f.getMonth() + 1);
    const movs = d.movimientos.filter((m) => m.fecha.startsWith(clave));
    return { clave, etiqueta: MESES_CORTOS[f.getMonth()], ingresos: sumar(movs, 'ingreso'), gastos: sumar(movs, 'gasto'), actual: i === 5 };
  }), [d.movimientos, mes.anio, mes.mes]);

  // Este mes contra el anterior. Si el mes se está viviendo todavía, el anterior se corta en el mismo día
  // para que la comparación sea justa.
  const comparacion = useMemo(() => {
    const f = new Date(mes.anio, mes.mes - 2, 1);
    const claveAnt = claveMes(f.getFullYear(), f.getMonth() + 1);
    const hasta = mes.esActual ? d.hoy.slice(8, 10) : '31';
    const gastoAnt = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.fecha.startsWith(claveAnt) && m.fecha.slice(8, 10) <= hasta ? m.monto : 0), 0);
    const gastoEste = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.fecha.startsWith(mes.clave) ? m.monto : 0), 0);
    return { gastoAnt, gastoEste, nombreAnt: MESES[f.getMonth()] };
  }, [d.movimientos, d.hoy, mes.anio, mes.mes, mes.clave, mes.esActual]);
  const { gastoAnt, gastoEste, nombreAnt } = comparacion;
  const dif = gastoAnt > 0 ? Math.round(((gastoEste - gastoAnt) / gastoAnt) * 100) : null;
  const fraseComparacion = dif === null ? `En ${nombreAnt} no hubo gastos para comparar.`
    : dif === 0 ? `Vas igual que en ${nombreAnt}.`
    : `${mes.esActual ? 'Vas' : 'Gastaste'} un ${Math.abs(dif)}% ${dif < 0 ? 'menos' : 'más'} que en ${nombreAnt}${mes.esActual ? ' a esta altura' : ''}.`;

  const hoy = aFecha(d.hoy);
  const avance = hoy.getDate() / diasDelMes(mes.anio, mes.mes);
  const nota = mes.esActual ? `${mes.nombre} ${avance < 0.35 ? 'recién empieza' : avance < 0.7 ? 'todavía va por la mitad' : 'ya casi termina'}.` : null;

  return (
    <>
      <NavegadorMes nombre={mes.nombre} anio={mes.anio} mover={mes.mover} />

      <Deslizar clave={mes.clave}>
      <View style={{ gap: 12 }}>

      <Tarjeta style={{ padding: 16, gap: 8 }}>
        <Texto tam={15} peso="semi">Gastos por categoría</Texto>
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

      <Tarjeta style={{ padding: 16, gap: 8 }}>
        <Texto tam={15} peso="semi">Ingresos y gastos · 6 meses</Texto>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Leyenda color={c.ingreso} texto="Ingresos" />
          <Leyenda color={c.gasto} texto="Gastos" />
        </View>
        <Barras datos={seisMeses} />
        {nota && <Texto tam={12} color={c.tenue}>{nota}</Texto>}
      </Tarjeta>

      <Tarjeta style={{ padding: 16, gap: 8 }}>
        <Texto tam={15} peso="semi">Este mes vs. el anterior</Texto>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tam={13} color={c.tenue}>{mes.nombre}</Texto>
            <Num tam={22} color={gastoEste ? c.gasto : undefined} lineas={1}>{dineroCorto(gastoEste, d.moneda)}</Num>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tam={13} color={c.tenue}>{mayuscula(nombreAnt)}</Texto>
            <Num tam={22} color={c.tenue} lineas={1}>{dineroCorto(gastoAnt, d.moneda)}</Num>
          </View>
        </View>
        <Texto tam={13} color={c.tenue}>{fraseComparacion}</Texto>
      </Tarjeta>
      </View>
      </Deslizar>
    </>
  );
}
