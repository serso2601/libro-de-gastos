// El Inicio: las cuentas como tarjetas apiladas. La de adelante muestra su saldo y lo que entró y
// salió este mes; tocar una de atrás la pasa al frente. Debajo, el mes.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAbrir } from '@/dialogos/abrir';
import { diasQueQuedan, flujoCuenta, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto, MESES, mayuscula, neto, saldo } from '@/lib/formato';
import { BotonPrincipal, BotonRedondo, Num, Tarjeta, Texto } from '@/ui/componentes';
import { abrirCuenta, Marco, useIr } from '@/ui/pantalla';
import { sobre, useTema } from '@/ui/tema';

export function InicioBilletera() {
  const d = useDatos();
  const abrir = useAbrir();
  const ir = useIr();
  const { c, estilo, colorCuenta } = useTema();
  const [elegida, setElegida] = useState<string | null>(null);
  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const atras = d.cuentas.filter((x) => x.id !== frente?.id).reverse();
  const total = d.cuentas.reduce((s, x) => s + saldo(x, d.movimientos), 0);
  const clave = d.hoy.slice(0, 7);
  const t = topes(d, clave);
  const gastoMes = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.fecha.startsWith(clave) ? m.monto : 0), 0);
  const base = t.tope > 0 ? Math.max(t.tope, gastoMes) : gastoMes;

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ gap: 2 }}>
        <Texto tam={14} color={c.tenue}>Tienes en total</Texto>
        <Num tam={estilo.m.cifra}>{neto(total, d.moneda)}</Num>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        <BotonRedondo icono="mas" etiqueta="Nueva cuenta" onPress={() => abrir({ tipo: 'cuenta' })} />
        <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );

  return (
    <Marco cabecera={cabecera} gap={16}>
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
    </Marco>
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
