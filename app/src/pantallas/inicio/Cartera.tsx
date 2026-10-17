// Cartera en mosaico: las cuentas apiladas arriba (una al frente) y cuatro bloques que muestran lo
// de la cuenta del frente. El botón de abajo anota en esa cuenta.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { flujoCuenta, proximosEn, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { conSigno, diaCorto, dineroCorto, neto, ordenarPorFecha, saldo, tituloDia } from '@/lib/formato';
import { BotonPrincipal, BotonRedondo, Num, PildoraAnotar, Tarjeta, Texto } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { abrirCuenta, Marco, useIr } from '@/ui/pantalla';
import { alfa, mezclar, sobre, useTema } from '@/ui/tema';
import { Tutorial } from '../Tutorial';

function Bloque({ onPress, etiqueta, children, relleno }: { onPress: () => void; etiqueta: string; children: ReactNode; relleno?: { pct: number; color: string } }) {
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityLabel={etiqueta}
      style={({ pressed }) => ({ height: 148, borderRadius: estilo.m.esquinas, backgroundColor: c.tarjeta, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
      {relleno && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(relleno.pct, 100)}%`, backgroundColor: relleno.color }} />}
      <View style={{ flex: 1, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between' }}>{children}</View>
    </Pressable>
  );
}

export function InicioCartera() {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const ir = useIr();
  const { c, estilo, colorCuenta } = useTema();
  const [elegida, setElegida] = useState<string | null>(null);
  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const total = d.cuentas.reduce((s, x) => s + saldo(x, d.movimientos), 0);

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <View style={{ gap: 4 }}>
        <Texto tam={13} peso="medio" color={c.tenue}>Tienes en total</Texto>
        <Num tam={estilo.m.cifra}>{neto(total, d.moneda)}</Num>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <BotonRedondo icono="buscar" etiqueta="Buscar" onPress={() => ir('movimientos')} />
        <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );

  if (!frente) {
    return (
      <Marco cabecera={cabecera}>
        <Tutorial />
        <Tarjeta style={{ padding: 18, gap: 12 }}>
          <Texto tam={15} peso="semi">Todavía no hay cuentas</Texto>
          <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'cuenta' })}>Crear la primera</BotonPrincipal>
        </Tarjeta>
      </Marco>
    );
  }

  const clave = d.hoy.slice(0, 7);
  const f = flujoCuenta(d.movimientos, frente.id, clave);
  const t = topes(d, clave);
  const pctTotal = t.tope > 0 ? Math.round((t.gastado / t.tope) * 100) : 0;
  const gastoFrente = d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.cuenta_id === frente.id && m.fecha.startsWith(clave) ? m.monto : 0), 0);
  const prox = proximosEn(d, 30, (p) => p.cuenta_id === frente.id || p.cuenta_destino_id === frente.id);
  const proxTotal = prox.reduce((s, p) => s + (p.tipo === 'ingreso' || p.cuenta_destino_id === frente.id ? p.monto : -p.monto), 0);
  const movsFrente = d.movimientos.filter((m) => (m.cuenta_id === frente.id || m.cuenta_destino_id === frente.id) && m.fecha.startsWith(clave)).sort(ordenarPorFecha);
  const ultimo = movsFrente[0];
  const cats = d.categorias.filter((x) => x.tipo === 'gasto')
    .map((x) => ({ x, total: movsFrente.reduce((s, m) => s + (m.tipo === 'gasto' && m.cuenta_id === frente.id && m.categoria_id === x.id ? m.monto : 0), 0) }))
    .filter((y) => y.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
  const fondo = colorCuenta(frente.color);
  const tinta = sobre(fondo);
  const medio = mezclar(fondo, c.tarjeta, 0.4);

  return (
    <Marco cabecera={cabecera} gap={12} pie={<PildoraAnotar texto={`Anotar en ${frente.nombre}`} onPress={() => anotar({ cuentaInicial: frente.id })} />}>
      <Tutorial />
      <View style={{ marginTop: 10 }}>
        {d.cuentas.filter((x) => x.id !== frente.id).map((x) => {
          const fx = colorCuenta(x.color);
          return (
            <Pressable key={x.id} onPress={() => { Haptics.selectionAsync(); setElegida(x.id); }} accessibilityLabel={`Pasar ${x.nombre} al frente`}
              style={{ height: 64, marginBottom: -20, borderRadius: 20, backgroundColor: fx, paddingTop: 13, paddingHorizontal: 18,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                shadowColor: '#16181D', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: -2 } }}>
              <Texto tam={15} peso="semi" color={sobre(fx)} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
              <Num tam={14} peso="medio" color={sobre(fx)} style={{ opacity: 0.8 }}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
            </Pressable>
          );
        })}
        <Pressable onPress={() => abrirCuenta(frente.id, 'Inicio')} accessibilityLabel={`Abrir ${frente.nombre}`}
          style={({ pressed }) => ({ height: 160, borderRadius: 20, backgroundColor: fondo, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18,
            justifyContent: 'space-between', opacity: pressed ? 0.92 : 1,
            shadowColor: '#16181D', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: -2 } })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Texto tam={15} peso="semi" color={tinta}>{frente.nombre}</Texto>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: alfa(tinta, 0.14), alignItems: 'center', justifyContent: 'center' }}>
              <Icono nombre="adelante" tam={16} color={tinta} grosor={2} />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Texto tam={12.5} peso="medio" color={alfa(tinta, 0.76)}>Saldo</Texto>
            <Num tam={32} color={tinta}>{neto(saldo(frente, d.movimientos), d.moneda)}</Num>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              <Texto tam={13} color={alfa(tinta, 0.82)}>Entró <Texto num tam={13} color={alfa(tinta, 0.82)}>+{neto(f.entro, d.moneda)}</Texto></Texto>
              <Texto tam={13} color={alfa(tinta, 0.82)}>Salió <Texto num tam={13} color={alfa(tinta, 0.82)}>−{neto(f.salio, d.moneda)}</Texto></Texto>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={{ marginTop: 6 }}>
        <Grilla columnas={2} gap={12}>
          <Bloque onPress={() => ir('presupuesto')} etiqueta="Presupuesto" relleno={t.tope > 0 ? { pct: pctTotal, color: c.acentoSuave } : undefined}>
            <View style={{ gap: 4 }}>
              <Texto tam={13} peso="medio" color={c.tenue}>Presupuesto</Texto>
              {t.tope > 0
                ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><Num tam={22}>{pctTotal}%</Num><Texto num tam={12.5} color={c.tenue}>de {dineroCorto(t.tope, d.moneda)}</Texto></View>
                : <Texto tam={13} color={c.tenue}>Sin topes. Toca para ponerlos.</Texto>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: fondo }} />
              <Texto num tam={12} peso="medio" lineas={1}>{frente.nombre} {dineroCorto(gastoFrente, d.moneda)}</Texto>
            </View>
          </Bloque>
          <Bloque onPress={() => ir('proximos')} etiqueta="Próximos">
            <View style={{ gap: 4 }}>
              <Texto tam={13} peso="medio" color={c.tenue}>Próximos</Texto>
              <Num tam={22} color={prox.length ? undefined : c.tenue} lineas={1}>{neto(proxTotal, d.moneda, true)}</Num>
              <Texto tam={12.5} color={c.tenue}>en los próximos 30 días</Texto>
            </View>
            <View style={{ gap: 4 }}>
              {prox.length === 0 ? <Texto tam={12.5} color={c.tenue}>Nada programado</Texto> : prox.slice(0, 1).map((p) => (
                <View key={`${p.recurrencia_id}@${p.fecha}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 22, gap: 6 }}>
                  <Texto tam={12.5} peso="medio" lineas={1} style={{ flex: 1 }}>{p.nota || d.categorias.find((x) => x.id === p.categoria_id)?.nombre || 'Transferencia'}</Texto>
                  <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: fondo, justifyContent: 'center' }}>
                    <Texto tam={12} color={c.tinta}>{diaCorto(p.fecha)}</Texto>
                  </View>
                </View>
              ))}
            </View>
          </Bloque>
          <Bloque onPress={() => ir('movimientos')} etiqueta="Movimientos">
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Texto tam={13} peso="medio" color={c.tenue}>Movimientos</Texto>
                <Icono nombre="buscar" tam={16} color={c.tenue} />
              </View>
              <Num tam={22}>{f.n}</Num>
              <Texto tam={12.5} color={c.tenue}>anotados este mes</Texto>
            </View>
            <View style={{ gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.linea }}>
              {ultimo ? (
                <>
                  <Texto tam={11.5} color={c.tenue} lineas={1}>Último · {tituloDia(ultimo.fecha, d.hoy).split(',')[0].toLowerCase()}</Texto>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    <Texto tam={13} peso="medio" lineas={1} style={{ flex: 1 }}>{ultimo.nota || d.categorias.find((x) => x.id === ultimo.categoria_id)?.nombre || 'Transferencia'}</Texto>
                    <Num tam={13} peso="normal">{conSigno(ultimo.monto, d.moneda, ultimo.tipo)}</Num>
                  </View>
                </>
              ) : <Texto tam={12.5} color={c.tenue}>Nada este mes</Texto>}
            </View>
          </Bloque>
          <Bloque onPress={() => ir('graficos')} etiqueta="En qué se fue">
            <Texto tam={13} peso="medio" color={c.tenue}>En qué se fue</Texto>
            <View style={{ gap: 8 }}>
              {cats.length === 0 ? <Texto tam={12.5} color={c.tenue}>Sin gastos este mes</Texto> : cats.map(({ x, total }) => (
                <View key={x.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    <Texto tam={12.5} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                    <Num tam={12.5} peso="normal" color={c.tenue}>{dineroCorto(total, d.moneda)}</Num>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: c.suave }}>
                    <View style={{ height: 4, width: `${Math.max(6, (total / cats[0].total) * 100)}%`, borderRadius: 2, backgroundColor: medio }} />
                  </View>
                </View>
              ))}
            </View>
          </Bloque>
        </Grilla>
      </View>
    </Marco>
  );
}
