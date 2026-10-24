// Una cuenta abierta: su saldo, lo que entró y salió este mes y sus movimientos por día. La parte de
// arriba toma el color de la cuenta (con letra que se lea encima); los movimientos van debajo.

import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { configPresupuesto, deudaTarjeta, flujoCuenta, gastadoEnCorte, montoEnCuenta, pagoSugerido, periodoDe, porDia, porVenirDelMes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { conSigno, MESES, neto, ordenarPorFecha, saldo, tituloDia } from '@/lib/formato';
import type { Cuenta as TCuenta } from '@/lib/tipos';
import { BotonRedondo, Buscador, CabeceraDia, FilaMovimiento, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { ANCHO_COLUMNA, ANCHO_LECTURA, useDisposicion } from '@/ui/disposicion';
import { Icono } from '@/ui/iconos';
import { Marco, useApilada, Volver } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { alfa, sobre, useTema } from '@/ui/tema';
import { useZonaSegura } from '@/ui/zonaSegura';
import { cuandoViene } from './Proximos';

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
  const cuenta = d.cuentas.find((x) => x.id === id);
  if (!cuenta) {
    return <Marco titulo="Cuenta"><Vacio>Esta cuenta ya no existe.</Vacio></Marco>;
  }
  return <CuentaColor cuenta={cuenta} />;
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

/** Lo que se repite y todavía falta este mes en esta cuenta (el pago sugerido de una tarjeta ya va en la cabecera). */
function LoQueViene({ cuenta }: { cuenta: TCuenta }) {
  const d = useDatos();
  const abrir = useAbrir();
  const { c } = useTema();
  const porVenir = porVenirDelMes(d).filter((p) => p.cuenta_id === cuenta.id || p.cuenta_destino_id === cuenta.id);
  if (porVenir.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Rotulo>Lo que viene en {cuenta.nombre}</Rotulo>
      {/* Borde punteado, igual que arriba en Movimientos: todavía no pasó. */}
      <Lista style={{ backgroundColor: c.suave, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alfa(c.tenue, 0.35) }}>
        {porVenir.map((p, i) => {
          const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
          return (
            <FilaMovimiento key={`${p.recurrencia_id}@${p.fecha}`} m={p} cuentaId={cuenta.id} primera={i === 0}
              detalle={`Se anota solo ${cuandoViene(p.fecha, d.hoy)}`}
              onPress={regla ? () => abrir({ tipo: 'recurrencia', regla }) : undefined} />
          );
        })}
      </Lista>
    </View>
  );
}

const TOP_CATEGORIAS = 5;

/** Los gastos de esta cuenta en el mes, por categoría: las 5 principales con una barra corta y lo gastado. */
function EnQueSeGasto({ cuenta, mes }: { cuenta: TCuenta; mes: string }) {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, relleno } = useTema();
  const mesActual = d.hoy.slice(0, 7);
  const { filas, total, resto } = useMemo(() => {
    const suma = new Map<string, number>();
    for (const m of d.movimientos) {
      if (m.tipo !== 'gasto' || m.cuenta_id !== cuenta.id || !m.fecha.startsWith(mesActual)) continue;
      const k = m.categoria_id ?? '';
      suma.set(k, (suma.get(k) ?? 0) + m.monto);
    }
    const orden = [...suma.entries()].sort((a, b) => b[1] - a[1]);
    return {
      filas: orden.slice(0, TOP_CATEGORIAS),
      total: orden.reduce((s, [, v]) => s + v, 0),
      resto: Math.max(orden.length - TOP_CATEGORIAS, 0),
    };
  }, [d.movimientos, cuenta.id, mesActual]);
  if (filas.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Rotulo>En qué se gastó en {mes.toLowerCase()}</Rotulo>
      <Tarjeta color={c.suave} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        {filas.map(([catId, monto], i) => {
          const cat = d.categorias.find((x) => x.id === catId);
          const nombre = cat?.nombre ?? 'Sin categoría';
          const pct = total > 0 ? Math.max(monto / total, 0.04) : 0;
          return (
            <Pressable key={catId || 'sin'} disabled={!cat} onPress={() => cat && abrir({ tipo: 'detalleCategoria', categoria: cat, periodo: periodoDe(configPresupuesto(d), d.hoy) })}
              accessibilityLabel={`${nombre}: ${neto(monto, d.moneda)}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 6,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
              <SimboloCategoria categoria={cat ?? { nombre, color: c.tenue, emoji: '' }} tam={28} />
              <Texto tam={15} peso="medio" lineas={1} style={{ flex: 1, minWidth: 0 }}>{nombre}</Texto>
              <View style={{ width: 52, height: 6, borderRadius: 3, backgroundColor: c.linea, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, borderRadius: 3, backgroundColor: relleno(cat?.color ?? c.tenue) }} />
              </View>
              <Texto num tam={15} peso="medio" color={c.gasto} style={{ minWidth: 76, textAlign: 'right' }}>{conSigno(monto, d.moneda, 'gasto')}</Texto>
            </Pressable>
          );
        })}
        {resto > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.linea, paddingVertical: 10 }}>
            <Texto tam={13} color={c.tenue}>y {resto} más</Texto>
          </View>
        )}
      </Tarjeta>
    </View>
  );
}

function CuentaColor({ cuenta }: { cuenta: TCuenta }) {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const insets = useZonaSegura();
  const volver = useApilada() ?? 'Inicio';
  const { c, colorCuenta } = useTema();
  const { lateral, dosColumnas, margen } = useDisposicion();
  // En una pantalla ancha, lo de dentro no se estira de lado a lado.
  const centro = { width: '100%', maxWidth: ANCHO_LECTURA + margen * 2, alignSelf: 'center' } as const;
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const grupos = useMovsDeCuenta(cuenta, busqueda);
  const fondo = colorCuenta(cuenta.color);
  const tinta = sobre(fondo);
  const mes = MESES[Number(d.hoy.slice(5, 7)) - 1];
  const f = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));
  // Tarjeta de crédito: arriba va lo que se debe y lo del corte, y el pago es una sugerencia que el usuario confirma.
  const esTarjeta = !!cuenta.es_credito;
  const pago = esTarjeta ? pagoSugerido(d, cuenta) : null;
  const fechas = [cuenta.dia_corte ? `Corta el ${cuenta.dia_corte}` : '', cuenta.dia_pago ? `paga el ${cuenta.dia_pago}` : ''].filter(Boolean).join(' · ');
  function registrarPago() {
    if (!pago) return;
    anotar({ tipoInicial: 'transferencia', cuentaInicial: d.cuentas.find((x) => !x.es_credito)?.id, destinoInicial: cuenta.id,
      montoInicial: pago.total, notaInicial: `Pago de ${cuenta.nombre}` });
  }

  // Arriba (o a la izquierda, en una pantalla ancha) va la cuenta con su color; debajo (o a la derecha), su historia.
  const cabeza = (
    <>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Volver texto={volver} color={tinta} />
      <BotonRedondo icono={buscando ? 'cerrar' : 'buscar'} etiqueta={`Buscar en ${cuenta.nombre}`} fondo={alfa(tinta, 0.16)} color={tinta}
        onPress={() => { setBuscando((v) => !v); setBusqueda(''); }} />
    </View>
    <View style={{ gap: 6 }}>
      <Texto tam={17} peso="semi" color={tinta}>{cuenta.nombre}</Texto>
      {esTarjeta ? (
        <>
          <Num tam={38} color={tinta}>Debes {neto(deudaTarjeta(d, cuenta), d.moneda)}</Num>
          <Texto tam={14} color={tinta} style={{ marginTop: 4 }}>Gastado en este corte <Texto num tam={14} color={tinta}>{neto(gastadoEnCorte(d, cuenta), d.moneda)}</Texto></Texto>
          {fechas !== '' && <Texto tam={14} color={tinta}>{fechas}</Texto>}
          {!!cuenta.pago_minimo && <Texto tam={14} color={tinta}>Pago mínimo <Texto num tam={14} color={tinta}>{neto(cuenta.pago_minimo, d.moneda)}</Texto></Texto>}
        </>
      ) : (
        <>
          <Num tam={38} color={tinta}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
          <Texto tam={14} color={tinta} style={{ marginTop: 4 }}>Entró en {mes} <Texto num tam={14} color={tinta}>+{neto(f.entro, d.moneda)}</Texto></Texto>
          <Texto tam={14} color={tinta}>Salió en {mes} <Texto num tam={14} color={tinta}>−{neto(f.salio, d.moneda)}</Texto></Texto>
        </>
      )}
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
    {pago && (
      <Pressable onPress={registrarPago} accessibilityLabel="Registrar el pago de la tarjeta"
        style={({ pressed }) => ({ height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: tinta, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Icono nombre="transferir" tam={18} color={tinta} />
        <Texto tam={15} peso="semi" color={tinta}>Registrar pago · {neto(pago.total, d.moneda)}</Texto>
      </Pressable>
    )}
    </>
  );
  const resto = (
    <>
    {/* Lo que no se ve en el Inicio: qué viene y en qué se gastó en ESTA cuenta. Al buscar se esconden. */}
    {!buscando && (
      <View style={{ gap: 18, paddingBottom: 10 }}>
        <LoQueViene cuenta={cuenta} />
        <EnQueSeGasto cuenta={cuenta} mes={mes} />
      </View>
    )}
    <Rotulo>Movimientos</Rotulo>
    {buscando && <Buscador valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar en esta cuenta" fondo={c.suave} autoFocus />}
    <Grupos cuenta={cuenta} grupos={grupos} separadas={false} />
    </>
  );

  if (dosColumnas) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: fondo }}>
        <StatusBar style={tinta === '#FFFFFF' ? 'light' : 'dark'} />
        <ScrollView style={{ width: ANCHO_COLUMNA + 56, flexGrow: 0 }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 28, paddingBottom: 40, gap: 18 }}>
          {cabeza}
        </ScrollView>
        <ScrollView style={{ flex: 1, backgroundColor: c.tarjeta, borderTopLeftRadius: 26, borderBottomLeftRadius: 26 }} keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingTop: insets.top + 24, paddingHorizontal: 32, paddingBottom: insets.bottom + 30, gap: 8 }, centro]}>
          {resto}
        </ScrollView>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: fondo }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <StatusBar style={tinta === '#FFFFFF' ? 'light' : 'dark'} />
      <View style={[{ paddingTop: insets.top + (lateral ? 20 : 4), paddingHorizontal: margen, paddingBottom: 40, gap: 18 }, centro]}>
        {cabeza}
      </View>
      <View style={{ flexGrow: 1, marginTop: -14, backgroundColor: c.tarjeta, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
        <View style={[{ paddingTop: 14, paddingHorizontal: margen, paddingBottom: insets.bottom + 30, gap: 8 }, centro]}>
          {resto}
        </View>
      </View>
    </ScrollView>
  );
}
