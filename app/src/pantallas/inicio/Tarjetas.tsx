// La vista «Tarjetas» del Inicio: las cuentas apiladas y, debajo, lo último de todas. Tocar una de
// atrás abre la pila (se inclina, como vista desde arriba, y se despliega); tocar entonces una
// tarjeta la hace saltar por encima de las demás hasta el frente. La del frente muestra el estado de
// esa cuenta (saldo, el mes y Anotar, Pagar y Transferir) y, tocada, abre la cuenta. «Recientes» es de todas las cuentas: el resumen de
// cada una está en la pestaña Cuentas.

import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { cicloTarjeta, deudaTarjeta, flujoCuenta, gastadoEnCorte, pagoSugerido } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, MESES, mayuscula, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonPrincipal, Enlace, FilaMovimiento, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { abrirCuenta, useIr } from '@/ui/pantalla';
import { alfa, sobre, useTema } from '@/ui/tema';

/** Cuántos movimientos salen en «Recientes». */
const RECIENTES = 6;

/** Lo que asoma de cada tarjeta de atrás: apilada y con la pila abierta (la alta es de 196). */
const ASOMA_CERRADA = 62;
const ASOMA_ABIERTA = 92;

/** La cuenta que quedó al frente: se recuerda mientras la app esté abierta (aunque se pase al Calendario). */
let recordada: string | null = null;

export function Tarjetas() {
  const d = useDatos();
  const abrir = useAbrir();
  const { colorCuenta } = useTema();
  const [elegida, setElegida] = useState<string | null>(recordada);
  const [saltando, setSaltando] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  // 0 = apilada, 1 = abierta (inclinada y desplegada); `salto` recorre el brinco de la tarjeta elegida.
  const abierto = useRef(new Animated.Value(0)).current;
  const salto = useRef(new Animated.Value(0)).current;
  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const atras = d.cuentas.filter((x) => x.id !== frente?.id).reverse();

  function mover(a: boolean) {
    setAbierta(a);
    Animated.spring(abierto, { toValue: a ? 1 : 0, friction: 8, tension: 70, useNativeDriver: false }).start();
  }

  function tocarAtras(id: string) {
    if (saltando) return;
    if (!abierta) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mover(true);
      return;
    }
    // Con la pila abierta: la tarjeta salta por encima de las demás hasta el frente y la pila se cierra.
    Haptics.selectionAsync();
    setSaltando(id);
    salto.setValue(0);
    Animated.timing(salto, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      recordada = id;
      setElegida(id);
      setSaltando(null);
      mover(false);
    });
  }

  function tocarFrente() {
    if (saltando) return;
    if (abierta) { mover(false); return; }
    abrirCuenta(frente.id);
  }

  if (!frente) {
    return (
      <Tarjeta style={{ padding: 18, gap: 12 }}>
        <Texto tam={15} peso="semi">Todavía no hay cuentas</Texto>
        <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'cuenta' })}>Crear la primera</BotonPrincipal>
      </Tarjeta>
    );
  }

  return (
    <>
      <Animated.View style={{ zIndex: 1, transform: [
        { perspective: 900 },
        { rotateX: abierto.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] }) },
        { scale: abierto.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
      ] }}>
        {atras.map((x, i) => {
          const fondo = colorCuenta(x.color);
          const tinta = sobre(fondo);
          const brinca = saltando === x.id;
          // Cuánto le falta para llegar al frente (con la pila abierta), y su arco: sube, pasa por encima y cae.
          const falta = (atras.length - i) * ASOMA_ABIERTA;
          return (
            <Animated.View key={x.id} style={{
              marginTop: i === 0 ? 0 : abierto.interpolate({ inputRange: [0, 1], outputRange: [ASOMA_CERRADA - 196, ASOMA_ABIERTA - 196] }),
              zIndex: brinca ? 10 : 0,
              transform: brinca ? [
                { translateY: salto.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0, falta * 0.25 - 34, falta * 0.5 - 46, falta * 0.75 - 26, falta] }) },
                { scale: salto.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) },
              ] : [],
            }}>
              <Pressable onPress={() => tocarAtras(x.id)} accessibilityLabel={abierta ? `Pasar ${x.nombre} al frente` : 'Abrir las tarjetas'}
                style={{ height: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                  shadowColor: '#000', shadowOpacity: i === 0 && !brinca ? 0 : brinca ? 0.3 : 0.12, shadowRadius: brinca ? 14 : 8, shadowOffset: { width: 0, height: brinca ? 8 : -6 } }}>
                <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                <Num tam={17} peso="medio" color={tinta}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
              </Pressable>
            </Animated.View>
          );
        })}
        <Frente cuenta={frente} arriba={atras.length > 0} abierto={abierto} alPulsar={tocarFrente} />
      </Animated.View>

      <Recientes />
    </>
  );
}

/** La tarjeta del frente: el estado de la cuenta (saldo o deuda, lo del mes) y las acciones sobre ella. */
function Frente({ cuenta, arriba, abierto, alPulsar }: { cuenta: Cuenta; arriba: boolean; abierto: Animated.Value; alPulsar: () => void }) {
  const d = useDatos();
  const anotar = useAnotar();
  const { colorCuenta } = useTema();
  const fondo = colorCuenta(cuenta.color);
  const tinta = sobre(fondo);
  const s = saldo(cuenta, d.movimientos);
  const ciclo = cuenta.es_credito ? cicloTarjeta(cuenta, d.hoy) : null;
  const sugerido = cuenta.es_credito ? pagoSugerido(d, cuenta) : null;
  // El pago sale, de entrada, de la primera cuenta que no es tarjeta; el usuario la puede cambiar.
  const origenPago = d.cuentas.find((x) => !x.es_credito)?.id;
  const mes = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));
  // Con tres botones («Transferir» incluido) en una pantalla angosta, el último queda solo con el ícono.
  const compacto = !!sugerido;

  return (
    <Animated.View style={{ marginTop: arriba ? abierto.interpolate({ inputRange: [0, 1], outputRange: [ASOMA_CERRADA - 196, ASOMA_ABIERTA - 196] }) : 0, borderRadius: 22, shadowColor: '#000', shadowOpacity: arriba ? 0.14 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: -6 } }}>
    <Pressable onPress={alPulsar} accessibilityLabel={`Abrir ${cuenta.nombre}`}
      style={({ pressed }) => ({ minHeight: 216, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
        justifyContent: 'space-between', gap: 14, overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}>
      <Svg width={220} height={220} style={{ position: 'absolute', right: -70, bottom: -90 }}>
        <Circle cx={110} cy={110} r={40} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
        <Circle cx={110} cy={110} r={80} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{cuenta.nombre}</Texto>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {ciclo && (
            <Texto tam={13} peso="medio" color={tinta} style={{ opacity: 0.85 }}>
              {ciclo.proximoCorte === d.hoy ? 'corta hoy' : `corta el ${Number(ciclo.proximoCorte.slice(8, 10))}`}
            </Texto>
          )}
          <Icono nombre="adelante" tam={18} color={tinta} grosor={2} />
        </View>
      </View>

      <View style={{ gap: 4 }}>
        {cuenta.es_credito ? (
          <View style={{ gap: 2 }}>
            <Texto tam={13} color={tinta} style={{ opacity: 0.85 }}>{s > 0 ? 'A favor' : 'Debes'}</Texto>
            <Num tam={34} peso="semi" color={tinta} lineas={1}>{dinero(s > 0 ? s : deudaTarjeta(d, cuenta), d.moneda)}</Num>
            {ciclo && (
              <Texto tam={13} color={tinta} style={{ opacity: 0.85 }}>
                Gastado en este corte <Texto num tam={13} peso="medio" color={tinta}>{dinero(gastadoEnCorte(d, cuenta), d.moneda)}</Texto>
              </Texto>
            )}
          </View>
        ) : (
          <Num tam={34} peso="semi" color={tinta} lineas={1}>{neto(s, d.moneda)}</Num>
        )}
        {mes.n > 0 && (
          // Lo del mes en la tinta de contraste, con + y − (nada de verde ni rojo sobre el color de la cuenta).
          <Texto tam={13} color={tinta} lineas={1} style={{ opacity: 0.85 }}>
            {mayuscula(MESES[Number(d.hoy.slice(5, 7)) - 1])}{'  '}
            <Texto num tam={13} peso="medio" color={tinta}>+{dinero(mes.entro, d.moneda)}</Texto>{'  '}
            <Texto num tam={13} peso="medio" color={tinta}>−{dinero(mes.salio, d.moneda)}</Texto>
          </Texto>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Accion icono="mas" texto="Anotar" tinta={tinta} onPress={() => anotar({ cuentaInicial: cuenta.id })} />
        {sugerido && (
          <Accion texto="Pagar" tinta={tinta} etiqueta={`Pagar ${dinero(sugerido.total, d.moneda)} de ${cuenta.nombre}`}
            onPress={() => anotar({ tipoInicial: 'transferencia', cuentaInicial: origenPago, destinoInicial: cuenta.id,
              montoInicial: sugerido.total, notaInicial: `Pago de ${cuenta.nombre}` })} />
        )}
        <Accion icono="transferir" texto="Transferir" soloIcono={compacto} tinta={tinta} onPress={() => anotar({ tipoInicial: 'transferencia', cuentaInicial: cuenta.id })} />
      </View>
    </Pressable>
    </Animated.View>
  );
}

/** Un botón en cápsula sobre el color de la cuenta: con su tinta de contraste, nunca rojo ni verde. */
function Accion({ icono, texto, tinta, onPress, etiqueta, soloIcono }: {
  icono?: NombreIcono; texto: string; tinta: string; onPress: () => void; etiqueta?: string;
  /** Sin texto: un círculo con el ícono (la etiqueta de accesibilidad conserva el nombre). */
  soloIcono?: boolean;
}) {
  const circulo = !!soloIcono && !!icono;
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityLabel={etiqueta ?? texto} hitSlop={4}
      style={({ pressed }) => ({ flexShrink: circulo ? 0 : 1, height: 36, minWidth: 36, borderRadius: 18, paddingHorizontal: circulo ? 0 : 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: alfa(tinta, pressed ? 0.28 : 0.16) })}>
      {icono && <Icono nombre={icono} tam={15} color={tinta} grosor={2.2} />}
      {!circulo && <Texto tam={14} peso="semi" color={tinta} lineas={1} ajustar>{texto}</Texto>}
    </Pressable>
  );
}

/** Lo último de todas las cuentas (lo que ya pasó, del más nuevo al más viejo); cada fila lleva el color de su cuenta. */
function Recientes() {
  const d = useDatos();
  const abrir = useAbrir();
  const ir = useIr();
  const ultimos = d.movimientos.filter((m) => m.fecha <= d.hoy).sort(ordenarPorFecha).slice(0, RECIENTES);
  return (
    <View style={{ gap: 8 }}>
      <Rotulo derecha={<Enlace onPress={() => ir('movimientos')}>Ver todo</Enlace>}>Recientes</Rotulo>
      {ultimos.length === 0 ? (
        <Tarjeta><Vacio>Todavía no hay movimientos.</Vacio></Tarjeta>
      ) : (
        <Lista>
          {ultimos.map((m, i) => (
            <FilaMovimiento key={m.id} m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
          ))}
        </Lista>
      )}
    </View>
  );
}


