import { useMemo } from 'react';
import { View } from 'react-native';
import { useDatos } from '@/lib/datos';
import { dinero, MESES_CORTOS } from '@/lib/formato';
import { sumar, useMes } from '@/lib/mes';
import { NavegadorMes, Separador, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Barras, Dona } from '@/ui/graficos';
import { Pantalla } from '@/ui/pantalla';
import { C } from '@/ui/tema';

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Texto tam={12} color={C.tenue}>{texto}</Texto>
    </View>
  );
}

export default function Graficos() {
  const d = useDatos();
  const mes = useMes();

  const porCategoria = useMemo(() => {
    const delMes = d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha.startsWith(mes.clave));
    return d.categorias.filter((c) => c.tipo === 'gasto')
      .map((c) => ({ ...c, total: delMes.reduce((s, m) => s + (m.categoria_id === c.id ? m.monto : 0), 0) }))
      .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [d.movimientos, d.categorias, mes.clave]);
  const totalGastos = porCategoria.reduce((s, c) => s + c.total, 0);

  const seisMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const f = new Date(mes.anio, mes.mes - 6 + i, 1);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    const movs = d.movimientos.filter((m) => m.fecha.startsWith(clave));
    return { etiqueta: MESES_CORTOS[f.getMonth()], ingresos: sumar(movs, 'ingreso'), gastos: sumar(movs, 'gasto') };
  }), [d.movimientos, mes.anio, mes.mes]);

  return (
    <Pantalla titulo="Gráficos">
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />
      <Tarjeta style={{ padding: 16 }}>
        <Texto peso="semi">Gastos por categoría</Texto>
        {porCategoria.length === 0 ? <Vacio>Sin gastos este mes.</Vacio> : (
          <>
            <Dona datos={porCategoria} moneda={d.moneda} />
            {porCategoria.map((c, i) => (
              <View key={c.id}>
                {i > 0 && <Separador />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />
                  <Texto style={{ flex: 1 }} lineas={1}>{c.emoji} {c.nombre}</Texto>
                  <Texto tam={12} color={C.tenue}>{((c.total / totalGastos) * 100).toFixed(0)}%</Texto>
                  <Texto mono peso="semi">{dinero(c.total, d.moneda)}</Texto>
                </View>
              </View>
            ))}
          </>
        )}
      </Tarjeta>
      <Tarjeta style={{ padding: 16 }}>
        <Texto peso="semi" style={{ marginBottom: 8 }}>Ingresos y gastos · 6 meses</Texto>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Leyenda color={C.bien} texto="Ingresos" />
          <Leyenda color={C.alerta} texto="Gastos" />
        </View>
        <Barras datos={seisMeses} />
      </Tarjeta>
    </Pantalla>
  );
}
