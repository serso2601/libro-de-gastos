// La versión web de fecha.tsx: el selector de iOS no existe en el navegador. El calendario se dibuja
// aquí, igual que el de iOS (mes con flechas y el día elegido en un círculo del color principal); la
// hora es el campo de hora del navegador, que en Safari abre la rueda de siempre.

import { createElement, useState } from 'react';
import { Pressable, View } from 'react-native';
import { aFecha, fechaISO, MESES } from '@/lib/formato';
import { Texto } from './componentes';
import { Icono } from './iconos';
import { alfa, sobre, useTema } from './tema';

export function CalendarioFecha({ valor, alCambiar, minimo }: { valor: string; alCambiar: (iso: string) => void; minimo?: string }) {
  const { c } = useTema();
  const elegido = aFecha(valor);
  const [mes, setMes] = useState({ anio: elegido.getFullYear(), mes: elegido.getMonth() });
  const hoy = fechaISO(new Date());
  const primero = (new Date(mes.anio, mes.mes, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const dias = new Date(mes.anio, mes.mes + 1, 0).getDate();
  const filas = Math.ceil((primero + dias) / 7);
  const mover = (delta: number) => setMes(({ anio, mes: m }) => {
    const d = new Date(anio, m + delta, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center' }}>
        <Texto tam={17} peso="semi" style={{ flex: 1, paddingLeft: 4 }}>{MESES[mes.mes][0].toUpperCase() + MESES[mes.mes].slice(1)} {mes.anio}</Texto>
        <Pressable onPress={() => mover(-1)} hitSlop={6} accessibilityLabel="Mes anterior" style={{ padding: 8 }}>
          <Icono nombre="atras" tam={20} color={c.acento} grosor={2.2} />
        </Pressable>
        <Pressable onPress={() => mover(1)} hitSlop={6} accessibilityLabel="Mes siguiente" style={{ padding: 8 }}>
          <Icono nombre="adelante" tam={20} color={c.acento} grosor={2.2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <Texto key={i} tam={13} peso="semi" color={c.tenue} centro style={{ flex: 1 }}>{x}</Texto>)}
      </View>
      {Array.from({ length: filas }, (_, k) => (
        <View key={k} style={{ flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const n = k * 7 + i - primero + 1;
            if (n < 1 || n > dias) return <View key={i} style={{ flex: 1, height: 42 }} />;
            const iso = fechaISO(new Date(mes.anio, mes.mes, n));
            const es = iso === valor;
            const fuera = minimo !== undefined && iso < minimo;
            return (
              <Pressable key={i} disabled={fuera} onPress={() => alCambiar(iso)} style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: es ? c.acento : 'transparent' }}>
                  <Texto num tam={18} peso={es || iso === hoy ? 'semi' : 'normal'}
                    color={es ? sobre(c.acento) : fuera ? alfa(c.tenue, 0.4) : iso === hoy ? c.acento : c.tinta}>{n}</Texto>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** `valor` es «HH:MM». */
export function SelectorHora({ valor, alCambiar }: { valor: string; alCambiar: (hora: string) => void }) {
  const { c, estilo, oscuro } = useTema();
  return createElement('input', {
    type: 'time',
    value: valor,
    onChange: (e: { target: { value: string } }) => e.target.value && alCambiar(e.target.value),
    style: {
      fontFamily: estilo.fuentes.normal, fontSize: 17, color: c.tinta, backgroundColor: alfa(c.tenue, 0.15),
      border: 'none', borderRadius: 8, padding: '6px 10px', colorScheme: oscuro ? 'dark' : 'light', fontVariantNumeric: 'tabular-nums',
    },
  });
}
