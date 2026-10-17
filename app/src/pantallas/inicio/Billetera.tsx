// Billetera: las cuentas como tarjetas apiladas. La de adelante muestra su saldo y lo que entró y
// salió este mes; tocar una de atrás la pasa al frente. Debajo, el mes y lo que se cobra pronto.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAbrir } from '@/dialogos/abrir';
import { diasQueQuedan, flujoCuenta, proximosEn, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { conSigno, dinero, dineroCorto, diaCorto, MESES, mayuscula, neto, saldo } from '@/lib/formato';
import { BotonPrincipal, BotonRedondo, Enlace, Num, Tarjeta, Texto } from '@/ui/componentes';
import { abrirCuenta, Marco, useIr } from '@/ui/pantalla';
import { sobre, useTema } from '@/ui/tema';
import { Tutorial } from '../Tutorial';

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
  const pronto = proximosEn(d, 30).slice(0, 3);
  const nombreCuenta = (id: string) => d.cuentas.find((x) => x.id === id)?.nombre ?? '';

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
      <Tutorial />
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
                <Texto tam={16} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                <Num tam={16} peso="medio" color={tinta}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
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
            Gastaste <Texto num tam={13}>{dinero(gastoMes, d.moneda)}</Texto>
            {t.tope > 0 ? <> de <Texto num tam={13}>{dineroCorto(t.tope, d.moneda)}</Texto></> : ' este mes'}
          </Texto>
          {t.tope > 0 && <Texto tam={13} color={gastoMes > t.tope ? c.alerta : c.tenue}>{Math.round((gastoMes / t.tope) * 100)}%</Texto>}
        </View>
      </Tarjeta>

      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
          <Texto tam={13} color={c.tenue}>Se cobra pronto</Texto>
          <Enlace onPress={() => ir('proximos', 'Cuentas')} color={c.tenue}>Ver todo</Enlace>
        </View>
        {pronto.length === 0 ? <Texto tam={14} color={c.tenue} style={{ paddingVertical: 12 }}>Nada programado para los próximos días.</Texto> : pronto.map((p) => {
          const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
          const cu = d.cuentas.find((x) => x.id === p.cuenta_id);
          return (
            <Pressable key={`${p.recurrencia_id}@${p.fecha}`} onPress={() => regla && abrir({ tipo: 'recurrencia', regla })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 46, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: 10, height: 26, borderRadius: 3, backgroundColor: colorCuenta(cu?.color ?? c.tenue) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Texto tam={15} lineas={1}>{p.nota || d.categorias.find((x) => x.id === p.categoria_id)?.nombre || 'Transferencia'}</Texto>
                <Texto tam={12.5} color={c.tenue}>{diaCorto(p.fecha)} · {nombreCuenta(p.cuenta_id)}</Texto>
              </View>
              <Num tam={15} color={p.tipo === 'ingreso' ? c.bien : undefined}>{conSigno(p.monto, d.moneda, p.tipo)}</Num>
            </Pressable>
          );
        })}
      </View>
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
    <Pressable onPress={() => abrirCuenta(cuenta.id, 'Cuentas')} accessibilityLabel={`Abrir ${cuenta.nombre}`}
      style={({ pressed }) => ({ height: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
        justifyContent: 'space-between', overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}>
      <Svg width={220} height={220} style={{ position: 'absolute', right: -70, bottom: -90 }}>
        <Circle cx={110} cy={110} r={40} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
        <Circle cx={110} cy={110} r={80} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Texto tam={16} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{cuenta.nombre}</Texto>
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
