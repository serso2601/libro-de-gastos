// La vista «Tarjetas» del Inicio: las cuentas apiladas (la de adelante muestra su saldo y lo que entró
// y salió este mes; tocar una de atrás la pasa al frente), la tarjeta del mes y los últimos movimientos.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAbrir } from '@/dialogos/abrir';
import { diasQueQuedan, flujoCuenta, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto, MESES, mayuscula, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import { BotonPrincipal, Enlace, FilaMovimiento, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { abrirCuenta, useIr } from '@/ui/pantalla';
import { sobre, useTema } from '@/ui/tema';

/** Cuántos movimientos salen en «Recientes». */
const RECIENTES = 5;

export function Tarjetas() {
  const d = useDatos();
  const abrir = useAbrir();
  const ir = useIr();
  const { c, colorCuenta } = useTema();
  const [elegida, setElegida] = useState<string | null>(null);
  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const atras = d.cuentas.filter((x) => x.id !== frente?.id).reverse();
  const clave = d.hoy.slice(0, 7);
  const t = topes(d, clave);
  const gastoMes = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.fecha.startsWith(clave) ? m.monto : 0), 0);
  const base = t.tope > 0 ? Math.max(t.tope, gastoMes) : gastoMes;
  // Lo que ya pasó, del más nuevo al más viejo: un movimiento con fecha futura no es «reciente».
  const recientes = d.movimientos.filter((m) => m.fecha <= d.hoy).sort(ordenarPorFecha).slice(0, RECIENTES);

  return (
    <>
      {!frente ? (
        <Tarjeta style={{ padding: 18, gap: 12 }}>
          <Texto tam={15} peso="semi">Todavía no hay cuentas</Texto>
          <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'cuenta' })}>Crear la primera</BotonPrincipal>
        </Tarjeta>
      ) : (
        <View>
          {atras.map((x, i) => {
            const fondo = colorCuenta(x.color);
            const tinta = sobre(fondo);
            return (
              <Pressable key={x.id} onPress={() => { Haptics.selectionAsync(); setElegida(x.id); }} accessibilityLabel={`Pasar ${x.nombre} al frente`}
                style={{ marginTop: i === 0 ? 0 : -134, height: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                  shadowColor: '#000', shadowOpacity: i === 0 ? 0 : 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -6 } }}>
                <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                <Num tam={17} peso="medio" color={tinta}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
              </Pressable>
            );
          })}
          <Frente cuentaId={frente.id} arriba={atras.length > 0} />
        </View>
      )}

      <Tarjeta onPress={() => ir('presupuesto')} style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Texto tam={15} peso="semi">{mayuscula(MESES[Number(clave.slice(5, 7)) - 1])}</Texto>
          <Texto tam={13} color={c.tenue}>quedan {diasQueQuedan(d.hoy)} días</Texto>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.suave, flexDirection: 'row', overflow: 'hidden' }}>
          {base > 0 && d.cuentas.map((x) => {
            const g = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.cuenta_id === x.id && m.fecha.startsWith(clave) ? m.monto : 0), 0);
            return g > 0 ? <View key={x.id} style={{ width: `${(g / base) * 100}%`, backgroundColor: colorCuenta(x.color) }} /> : null;
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Texto tam={13} color={c.tenue}>
            Gastaste <Texto num tam={13} color={c.gasto}>{dinero(gastoMes, d.moneda)}</Texto>
            {t.tope > 0 ? <> de <Texto num tam={13}>{dineroCorto(t.tope, d.moneda)}</Texto></> : ' este mes'}
          </Texto>
          {t.tope > 0 && <Texto tam={13} color={gastoMes > t.tope ? c.alerta : c.tenue}>{Math.round((gastoMes / t.tope) * 100)}%</Texto>}
        </View>
      </Tarjeta>

      <View style={{ gap: 8 }}>
        <Rotulo derecha={<Enlace onPress={() => ir('movimientos')}>Ver todo</Enlace>}>Recientes</Rotulo>
        {recientes.length === 0 ? (
          <Tarjeta><Vacio>Todavía no hay movimientos.</Vacio></Tarjeta>
        ) : (
          <Lista>
            {recientes.map((m, i) => (
              <FilaMovimiento key={m.id} m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
            ))}
          </Lista>
        )}
      </View>
    </>
  );
}

function Frente({ cuentaId, arriba }: { cuentaId: string; arriba: boolean }) {
  const d = useDatos();
  const { colorCuenta } = useTema();
  const cuenta = d.cuentas.find((x) => x.id === cuentaId)!;
  const f = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));
  const fondo = colorCuenta(cuenta.color);
  const tinta = sobre(fondo);
  return (
    <View style={{ marginTop: arriba ? -134 : 0, borderRadius: 22, shadowColor: '#000', shadowOpacity: arriba ? 0.14 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: -6 } }}>
    <Pressable onPress={() => abrirCuenta(cuenta.id)} accessibilityLabel={`Abrir ${cuenta.nombre}`}
      style={({ pressed }) => ({ height: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
        justifyContent: 'space-between', overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}>
      <Svg width={220} height={220} style={{ position: 'absolute', right: -70, bottom: -90 }}>
        <Circle cx={110} cy={110} r={40} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
        <Circle cx={110} cy={110} r={80} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{cuenta.nombre}</Texto>
        <Texto tam={13} peso="medio" color={tinta} style={{ opacity: 0.85 }}>Toca para abrir</Texto>
      </View>
      <View style={{ gap: 10 }}>
        <Num tam={34} peso="semi" color={tinta}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Texto tam={13} color={tinta}>Entró <Texto num tam={13} color={tinta}>+{neto(f.entro, d.moneda)}</Texto></Texto>
          <Texto tam={13} color={tinta}>Salió <Texto num tam={13} color={tinta}>−{neto(f.salio, d.moneda)}</Texto></Texto>
        </View>
      </View>
    </Pressable>
    </View>
  );
}
