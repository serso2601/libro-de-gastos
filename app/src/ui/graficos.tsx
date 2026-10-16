import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { dinero } from '@/lib/formato';
import { Texto } from './componentes';
import { C } from './tema';

/** Dona de gastos por categoría, con el total en el centro. */
export function Dona({ datos, moneda, tam = 180 }: { datos: { id: string; total: number; color: string }[]; moneda: string; tam?: number }) {
  const total = datos.reduce((s, d) => s + d.total, 0);
  const grosor = 22;
  const r = (tam - grosor) / 2;
  const circ = 2 * Math.PI * r;
  const separacion = datos.length > 1 ? 2 : 0;
  let acumulado = 0;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
      <Svg width={tam} height={tam}>
        <G rotation={-90} origin={`${tam / 2}, ${tam / 2}`}>
          {datos.map((d) => {
            const largo = (d.total / total) * circ;
            const arco = (
              <Circle key={d.id} cx={tam / 2} cy={tam / 2} r={r} stroke={d.color} strokeWidth={grosor} fill="none"
                strokeDasharray={`${Math.max(largo - separacion, 0.5)} ${circ}`} strokeDashoffset={-acumulado} />
            );
            acumulado += largo;
            return arco;
          })}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Texto tam={11} color={C.tenue}>Total</Texto>
        <Texto mono peso="semi" tam={15}>{dinero(total, moneda)}</Texto>
      </View>
    </View>
  );
}

/** Barras agrupadas de ingresos y gastos por mes. */
export function Barras({ datos }: { datos: { etiqueta: string; ingresos: number; gastos: number }[] }) {
  const maximo = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]));
  const alto = 130;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: alto + 22, paddingTop: 6 }}>
      {datos.map((d) => (
        <View key={d.etiqueta} style={{ alignItems: 'center', flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: alto }}>
            <View style={{ width: 11, height: Math.max((d.ingresos / maximo) * alto, 2), backgroundColor: C.bien, borderRadius: 3 }} />
            <View style={{ width: 11, height: Math.max((d.gastos / maximo) * alto, 2), backgroundColor: C.alerta, borderRadius: 3 }} />
          </View>
          <Texto tam={11} color={C.tenue} style={{ marginTop: 6 }}>{d.etiqueta}</Texto>
        </View>
      ))}
    </View>
  );
}
