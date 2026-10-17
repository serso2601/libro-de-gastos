// Una cuenta abierta: su saldo, lo que entró y salió este mes y sus movimientos por día.
// En Billetera la pantalla entera toma el color de la cuenta; en los demás, una tarjeta de color.

import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { flujoCuenta, montoEnCuenta, porDia } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { MESES, neto, ordenarPorFecha, saldo, tituloDia } from '@/lib/formato';
import type { Cuenta as TCuenta } from '@/lib/tipos';
import { BotonRedondo, Campo, CabeceraDia, FilaMovimiento, Lista, Num, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { Marco, useApilada, Volver } from '@/ui/pantalla';
import { alfa, sobre, useTema } from '@/ui/tema';

function useMovsDeCuenta(cuenta: TCuenta | undefined, busqueda: string) {
  const d = useDatos();
  return useMemo(() => {
    if (!cuenta) return [];
    const q = busqueda.trim().toLowerCase();
    const nombreCat = new Map(d.categorias.map((x) => [x.id, x.nombre.toLowerCase()]));
    return porDia(d.movimientos
      .filter((m) => m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id)
      .filter((m) => !q || m.nota.toLowerCase().includes(q) || (nombreCat.get(m.categoria_id ?? '') ?? '').includes(q))
      .sort(ordenarPorFecha).slice(0, 300));
  }, [d.movimientos, d.categorias, cuenta, busqueda]);
}

export function Cuenta({ id }: { id: string }) {
  const d = useDatos();
  const { estilo } = useTema();
  const cuenta = d.cuentas.find((x) => x.id === id);
  if (!cuenta) {
    return <Marco titulo="Cuenta"><Vacio>Esta cuenta ya no existe.</Vacio></Marco>;
  }
  return estilo.id === 'billetera' ? <CuentaColor cuenta={cuenta} /> : <CuentaTarjeta cuenta={cuenta} />;
}

function Buscador({ valor, alCambiar, fondo }: { valor: string; alCambiar: (v: string) => void; fondo?: string }) {
  const { c } = useTema();
  return (
    <View style={{ height: 46, borderRadius: 14, backgroundColor: fondo ?? c.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14 }}>
      <Icono nombre="buscar" tam={18} color={c.tenue} />
      <Campo value={valor} onChangeText={alCambiar} placeholder="Buscar en esta cuenta" autoFocus clearButtonMode="while-editing"
        style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0, height: 44 }} />
    </View>
  );
}

function Grupos({ cuenta, grupos, separadas }: { cuenta: TCuenta; grupos: ReturnType<typeof useMovsDeCuenta>; separadas: boolean }) {
  const d = useDatos();
  const abrir = useAbrir();
  if (grupos.length === 0) return <Vacio>Sin movimientos todavía.</Vacio>;
  return (
    <>
      {grupos.map(([fecha, items]) => {
        const total = items.reduce((s, m) => s + montoEnCuenta(m, cuenta.id), 0);
        const filas = items.map((m, i) => (
          <FilaMovimiento key={m.id} m={m} cuentaId={cuenta.id} primera={i === 0 || !separadas} sinIcono={!separadas} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
        ));
        return (
          <View key={fecha} style={{ gap: 6 }}>
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(total, d.moneda, true)} />
            {separadas ? <Lista>{filas}</Lista> : <View>{filas}</View>}
          </View>
        );
      })}
    </>
  );
}

function CuentaColor({ cuenta }: { cuenta: TCuenta }) {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const insets = useSafeAreaInsets();
  const volver = useApilada() ?? 'Cuentas';
  const { c, colorCuenta } = useTema();
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const grupos = useMovsDeCuenta(cuenta, busqueda);
  const fondo = colorCuenta(cuenta.color);
  const tinta = sobre(fondo);
  const mes = MESES[Number(d.hoy.slice(5, 7)) - 1];
  const f = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: fondo }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <StatusBar style={tinta === '#FFFFFF' ? 'light' : 'dark'} />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 18, paddingBottom: 40, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Volver texto={volver} color={tinta} />
          <BotonRedondo icono={buscando ? 'cerrar' : 'buscar'} etiqueta={`Buscar en ${cuenta.nombre}`} fondo={alfa(tinta, 0.16)} color={tinta}
            onPress={() => { setBuscando((v) => !v); setBusqueda(''); }} />
        </View>
        <View style={{ gap: 6 }}>
          <Texto tam={16} peso="semi" color={tinta}>{cuenta.nombre}</Texto>
          <Num tam={38} color={tinta}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
          <Texto tam={14} color={tinta} style={{ marginTop: 4 }}>Entró en {mes} <Texto num tam={14} color={tinta}>+{neto(f.entro, d.moneda)}</Texto></Texto>
          <Texto tam={14} color={tinta}>Salió en {mes} <Texto num tam={14} color={tinta}>−{neto(f.salio, d.moneda)}</Texto></Texto>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => anotar({ cuentaInicial: cuenta.id })}
            style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, backgroundColor: tinta, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <Icono nombre="mas" tam={18} color={fondo} grosor={2.2} />
            <Texto tam={15} peso="semi" color={fondo}>Anotar aquí</Texto>
          </Pressable>
          <Pressable onPress={() => abrir({ tipo: 'cuenta', inicial: cuenta })}
            style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 23, backgroundColor: alfa(tinta, 0.16), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Texto tam={15} peso="medio" color={tinta}>Editar cuenta</Texto>
          </Pressable>
        </View>
      </View>
      <View style={{ flexGrow: 1, marginTop: -14, backgroundColor: c.tarjeta, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 14, paddingHorizontal: 18, paddingBottom: insets.bottom + 30, gap: 8 }}>
        {buscando && <Buscador valor={busqueda} alCambiar={setBusqueda} fondo={c.suave} />}
        <Grupos cuenta={cuenta} grupos={grupos} separadas={false} />
      </View>
    </ScrollView>
  );
}

function CuentaTarjeta({ cuenta }: { cuenta: TCuenta }) {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const { c, estilo, colorCuenta } = useTema();
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const grupos = useMovsDeCuenta(cuenta, busqueda);
  const fondo = colorCuenta(cuenta.color);
  const tinta = sobre(fondo);
  const f = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));

  return (
    <Marco titulo={cuenta.nombre} subtitulo={`${f.n} ${f.n === 1 ? 'movimiento' : 'movimientos'} este mes`}
      derecha={<BotonRedondo icono={buscando ? 'cerrar' : 'buscar'} etiqueta={`Buscar en ${cuenta.nombre}`} onPress={() => { setBuscando((v) => !v); setBusqueda(''); }} />}>
      <Tarjeta color={fondo} style={{ height: 132, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18, justifyContent: 'flex-end', gap: 6 }}>
        <Texto tam={12.5} peso="medio" color={alfa(tinta, 0.76)}>Saldo</Texto>
        <Num tam={32} color={tinta}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <Texto tam={13} color={alfa(tinta, 0.86)}>Entró <Texto num tam={13} color={alfa(tinta, 0.86)}>+{neto(f.entro, d.moneda)}</Texto></Texto>
          <Texto tam={13} color={alfa(tinta, 0.86)}>Salió <Texto num tam={13} color={alfa(tinta, 0.86)}>−{neto(f.salio, d.moneda)}</Texto></Texto>
        </View>
      </Tarjeta>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => anotar({ cuentaInicial: cuenta.id })}
          style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, backgroundColor: c.boton, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Icono nombre="mas" tam={18} color={c.sobreBoton} grosor={2.2} />
          <Texto tam={15} peso="semi" color={c.sobreBoton}>Anotar aquí</Texto>
        </Pressable>
        <Pressable onPress={() => abrir({ tipo: 'cuenta', inicial: cuenta })}
          style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, backgroundColor: c.tarjeta, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Texto tam={15} peso={estilo.m.pesoTitulo === 'extra' ? 'negrita' : 'semi'}>Editar cuenta</Texto>
        </Pressable>
      </View>
      {buscando && <Buscador valor={busqueda} alCambiar={setBusqueda} />}
      <Grupos cuenta={cuenta} grupos={grupos} separadas />
    </Marco>
  );
}

