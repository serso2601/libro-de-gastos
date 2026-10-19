import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Num, Texto } from './componentes';
import { useTema } from './tema';

/** Dona de gastos por categoría, con el total en el centro. */
export function Dona({ datos, centro, tam = 136, grosor = 18 }: { datos: { id: string; total: number; color: string }[]; centro: string; tam?: number; grosor?: number }) {
  const { c } = useTema();
  const total = datos.reduce((s, d) => s + d.total, 0);
  const r = (tam - grosor) / 2;
  const circ = 2 * Math.PI * r;
  const separacion = datos.length > 1 ? 2 : 0;
  let acumulado = 0;
  return (
    <View style={{ width: tam, height: tam, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={tam} height={tam} style={{ position: 'absolute' }}>
        <Circle cx={tam / 2} cy={tam / 2} r={r} stroke={c.suave} strokeWidth={grosor} fill="none" />
        <G rotation={-90} origin={`${tam / 2}, ${tam / 2}`}>
          {total > 0 && datos.map((d) => {
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
      <Num tam={17}>{centro}</Num>
      <Texto tam={11} color={c.tenue}>gastado</Texto>
    </View>
  );
}

/** Un anillo de avance. */
export function Anillo({ pct, color, fondo, tam = 56, grosor = 8 }: { pct: number; color: string; fondo: string; tam?: number; grosor?: number }) {
  const r = (tam - grosor) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={tam} height={tam}>
      <Circle cx={tam / 2} cy={tam / 2} r={r} stroke={fondo} strokeWidth={grosor} fill="none" />
      <G rotation={-90} origin={`${tam / 2}, ${tam / 2}`}>
        <Circle cx={tam / 2} cy={tam / 2} r={r} stroke={color} strokeWidth={grosor} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(Math.min(pct, 100) / 100 * circ, 0.1)} ${circ}`} />
      </G>
    </Svg>
  );
}

/** Barras de ingresos (verde) y gastos (rojo) por mes; el mes elegido va en negrita. */
export function Barras({ datos }: { datos: { clave: string; etiqueta: string; ingresos: number; gastos: number; actual: boolean }[] }) {
  const { c } = useTema();
  const maximo = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]));
  const alto = 110;
  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      {datos.map((d) => (
        <View key={d.clave} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ height: alto, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <View style={{ width: 11, height: Math.max((d.ingresos / maximo) * alto, 2), backgroundColor: c.ingreso, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderRadius: 1 }} />
            <View style={{ width: 11, height: Math.max((d.gastos / maximo) * alto, 2), backgroundColor: c.gasto, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderRadius: 1 }} />
          </View>
          <Texto tam={12} peso={d.actual ? 'negrita' : 'normal'} color={d.actual ? c.tinta : c.tenue}>{d.etiqueta}</Texto>
        </View>
      ))}
    </View>
  );
}

export function Leyenda({ color, texto }: { color: string; texto: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Texto tam={12} color={c.tenue}>{texto}</Texto>
    </View>
  );
}

export interface Celda {
  fondo: string;
  tinta: string;
  borde?: { color: string; punteado: boolean };
  peso?: 'medio' | 'semi' | 'negrita';
  /** Texto chico debajo del número ("hoy", "cobro"). */
  marca?: string;
  /** Un puntito debajo del número. */
  punto?: string;
  elegida?: boolean;
  etiqueta: string;
}

/** La grilla de un mes que empieza en lunes. `celda(dia)` dice cómo se pinta cada día. */
export function CalendarioMes({ anio, mes, alto, gap = 4, celda, alElegir }: {
  anio: number; mes: number; alto: number; gap?: number; celda: (dia: number) => Celda; alElegir?: (dia: number) => void;
}) {
  const { c } = useTema();
  const primero = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  const dias = new Date(anio, mes, 0).getDate();
  const total = Math.ceil((primero + dias) / 7) * 7;
  const semanas: (number | null)[][] = [];
  for (let k = 0; k < total; k += 7) semanas.push(Array.from({ length: 7 }, (_, i) => { const d = k + i - primero + 1; return d >= 1 && d <= dias ? d : null; }));
  const radio = alto >= 40 ? 10 : 9;
  return (
    <View style={{ gap }}>
      <View style={{ flexDirection: 'row', gap }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <Texto key={i} tam={11} peso="semi" color={c.tenue} centro style={{ flex: 1 }}>{x}</Texto>)}
      </View>
      {semanas.map((semana, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {semana.map((d, j) => {
            if (d === null) return <View key={j} style={{ flex: 1, height: alto }} />;
            const x = celda(d);
            const contenido: ReactNode = (
              <>
                <Texto num tam={12} peso={x.peso ?? 'medio'} color={x.tinta}>{d}</Texto>
                {x.marca ? <Texto tam={11} color={x.tinta} style={{ letterSpacing: 0.2 }}>{x.marca}</Texto> : null}
                {x.punto ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: x.punto }} /> : null}
              </>
            );
            const estiloCelda = {
              flex: 1, height: alto, borderRadius: radio, paddingHorizontal: 6, paddingVertical: 5, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const,
              backgroundColor: x.fondo, borderWidth: x.elegida ? 2 : x.borde ? 1.5 : 0,
              borderColor: x.elegida ? c.tinta : x.borde?.color, borderStyle: x.borde?.punteado && !x.elegida ? 'dashed' as const : 'solid' as const,
            };
            return alElegir
              ? <Pressable key={j} onPress={() => alElegir(d)} accessibilityLabel={x.etiqueta} style={estiloCelda}>{contenido}</Pressable>
              : <View key={j} accessibilityLabel={x.etiqueta} style={estiloCelda}>{contenido}</View>;
          })}
        </View>
      ))}
    </View>
  );
}

/** La tira de cuadritos de un mes (un día cada uno): más fuerte, más gasto. */
export function TiraDias({ colores, tam = 11, gap = 3 }: { colores: { fondo: string; borde?: string }[]; tam?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {colores.map((x, i) => (
        <View key={i} style={{ width: tam, height: tam, borderRadius: 3, backgroundColor: x.fondo, borderWidth: x.borde ? 1 : 0, borderColor: x.borde }} />
      ))}
    </View>
  );
}
