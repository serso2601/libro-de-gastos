// La vista «Tarjetas» del Inicio: las cuentas apiladas y, debajo, el día a día de la del frente («la
// cuenta en la que estás»). Tocar una de atrás la pasa al frente; la del frente abre la cuenta y trae
// a mano Anotar y Transferir (y Pagar, si es tarjeta de crédito con pago pendiente). Lo de abajo, el
// mes y los últimos movimientos, es de esa cuenta: el resumen de todas está en la pestaña Cuentas.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { cicloTarjeta, deudaTarjeta, diasDelMes, flujoCuenta, gastadoEnCorte, pagoSugerido } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dinero, dineroCorto, fechaISO, MESES, mayuscula, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import type { Cuenta, Movimiento } from '@/lib/tipos';
import { BotonPrincipal, Dato, Enlace, FilaMovimiento, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { abrirCuenta } from '@/ui/pantalla';
import { alfa, sobre, useTema } from '@/ui/tema';

/** Cuántos movimientos salen en «Últimos movimientos». */
const RECIENTES = 5;

/** La cuenta que quedó al frente: se recuerda mientras la app esté abierta (aunque se pase al Calendario). */
let recordada: string | null = null;

export function Tarjetas() {
  const d = useDatos();
  const abrir = useAbrir();
  const { colorCuenta } = useTema();
  const [elegida, setElegida] = useState<string | null>(recordada);
  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const atras = d.cuentas.filter((x) => x.id !== frente?.id).reverse();

  function alFrente(id: string) {
    Haptics.selectionAsync();
    recordada = id;
    setElegida(id);
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
      <View>
        {atras.map((x, i) => {
          const fondo = colorCuenta(x.color);
          const tinta = sobre(fondo);
          return (
            <Pressable key={x.id} onPress={() => alFrente(x.id)} accessibilityLabel={`Pasar ${x.nombre} al frente`}
              style={{ marginTop: i === 0 ? 0 : -134, height: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
                shadowColor: '#000', shadowOpacity: i === 0 ? 0 : 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -6 } }}>
              <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
              <Num tam={17} peso="medio" color={tinta}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
            </Pressable>
          );
        })}
        <Frente cuenta={frente} arriba={atras.length > 0} />
      </View>

      <MesDeCuenta cuenta={frente} />
      <Ultimos cuenta={frente} />
    </>
  );
}

/** La tarjeta del frente: el saldo (o la deuda, si es de crédito) y las acciones sobre esa cuenta. */
function Frente({ cuenta, arriba }: { cuenta: Cuenta; arriba: boolean }) {
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

  return (
    <View style={{ marginTop: arriba ? -134 : 0, borderRadius: 22, shadowColor: '#000', shadowOpacity: arriba ? 0.14 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: -6 } }}>
    <Pressable onPress={() => abrirCuenta(cuenta.id)} accessibilityLabel={`Abrir ${cuenta.nombre}`}
      style={({ pressed }) => ({ minHeight: 196, borderRadius: 22, backgroundColor: fondo, paddingVertical: 18, paddingHorizontal: 20,
        justifyContent: 'space-between', gap: 14, overflow: 'hidden', opacity: pressed ? 0.92 : 1 })}>
      <Svg width={220} height={220} style={{ position: 'absolute', right: -70, bottom: -90 }}>
        <Circle cx={110} cy={110} r={40} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
        <Circle cx={110} cy={110} r={80} stroke={tinta} strokeOpacity={0.12} strokeWidth={18} fill="none" />
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Texto tam={17} peso="semi" color={tinta} lineas={1} style={{ flex: 1 }}>{cuenta.nombre}</Texto>
        {ciclo ? (
          <Texto tam={13} peso="medio" color={tinta} style={{ opacity: 0.85 }}>
            {ciclo.proximoCorte === d.hoy ? 'corta hoy' : `corta el ${Number(ciclo.proximoCorte.slice(8, 10))}`}
          </Texto>
        ) : (
          <Icono nombre="adelante" tam={18} color={tinta} grosor={2} />
        )}
      </View>

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

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Accion icono="mas" texto="Anotar" tinta={tinta} onPress={() => anotar({ cuentaInicial: cuenta.id })} />
        {sugerido && (
          <Accion texto="Pagar" tinta={tinta} etiqueta={`Pagar ${dinero(sugerido.total, d.moneda)} de ${cuenta.nombre}`}
            onPress={() => anotar({ tipoInicial: 'transferencia', cuentaInicial: origenPago, destinoInicial: cuenta.id,
              montoInicial: sugerido.total, notaInicial: `Pago de ${cuenta.nombre}` })} />
        )}
        <Accion icono="transferir" texto="Transferir" tinta={tinta} onPress={() => anotar({ tipoInicial: 'transferencia', cuentaInicial: cuenta.id })} />
      </View>
    </Pressable>
    </View>
  );
}

/** Un botón en cápsula sobre el color de la cuenta: con su tinta de contraste, nunca rojo ni verde. */
function Accion({ icono, texto, tinta, onPress, etiqueta }: { icono?: NombreIcono; texto: string; tinta: string; onPress: () => void; etiqueta?: string }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityLabel={etiqueta ?? texto} hitSlop={4}
      style={({ pressed }) => ({ flexShrink: 1, height: 36, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: alfa(tinta, pressed ? 0.28 : 0.16) })}>
      {icono && <Icono nombre={icono} tam={15} color={tinta} grosor={2.2} />}
      <Texto tam={14} peso="semi" color={tinta} lineas={1} ajustar>{texto}</Texto>
    </Pressable>
  );
}

/** «Octubre en Banco»: lo que entró y salió de la cuenta este mes, rotulado, y cómo va contra el anterior. */
function MesDeCuenta({ cuenta }: { cuenta: Cuenta }) {
  const d = useDatos();
  const { c, colorCuenta } = useTema();
  const f = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));
  const frase = comparacion(d.movimientos, cuenta.id, d.hoy, f.salio, d.moneda);
  return (
    <Tarjeta style={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorCuenta(cuenta.color) }} />
        <Texto tam={15} peso="semi" lineas={1} style={{ flexShrink: 1 }}>{mayuscula(MESES[Number(d.hoy.slice(5, 7)) - 1])} en {cuenta.nombre}</Texto>
      </View>
      {f.n === 0 ? (
        <Texto tam={14} color={c.tenue}>Nada anotado en esta cuenta este mes.</Texto>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Dato rotulo="Entró" valor={`+${dinero(f.entro, d.moneda)}`} color={c.ingreso} tam={20} />
            <Dato rotulo="Salió" valor={`−${dinero(f.salio, d.moneda)}`} color={c.gasto} tam={20} />
          </View>
          {frase && <Texto tam={13} color={c.tenue}>{frase}</Texto>}
        </>
      )}
    </Tarjeta>
  );
}

/** Los últimos movimientos de la cuenta (lo que ya pasó, del más nuevo al más viejo), vistos desde ella. */
function Ultimos({ cuenta }: { cuenta: Cuenta }) {
  const d = useDatos();
  const abrir = useAbrir();
  const ultimos = d.movimientos
    .filter((m) => (m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id) && m.fecha <= d.hoy)
    .sort(ordenarPorFecha).slice(0, RECIENTES);
  return (
    <View style={{ gap: 8 }}>
      <Rotulo derecha={<Enlace onPress={() => abrirCuenta(cuenta.id, 'Inicio')}>Ver todos</Enlace>}>Últimos movimientos</Rotulo>
      {ultimos.length === 0 ? (
        <Tarjeta><Vacio>Todavía no hay movimientos en esta cuenta.</Vacio></Tarjeta>
      ) : (
        <Lista>
          {ultimos.map((m, i) => (
            <FilaMovimiento key={m.id} m={m} cuentaId={cuenta.id} sinIcono primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
          ))}
        </Lista>
      )}
    </View>
  );
}

/** Lo que salió de la cuenta entre dos fechas (inclusive), contado igual que `flujoCuenta`. */
function salioEntre(movs: Movimiento[], cuentaId: string, desde: string, hasta: string): number {
  return movs.reduce((s, m) => s + (m.cuenta_id === cuentaId && m.tipo !== 'ingreso' && m.fecha >= desde && m.fecha <= hasta ? m.monto : 0), 0);
}

/**
 * «Va saliendo $120 menos que a estas alturas de septiembre.» Compara con el mes anterior hasta el
 * mismo día (el 31 se compara con el último día de un mes corto). Nada si el mes pasado no salió nada.
 */
function comparacion(movs: Movimiento[], cuentaId: string, hoy: string, salio: number, moneda: string): string | null {
  const h = aFecha(hoy);
  const primero = new Date(h.getFullYear(), h.getMonth() - 1, 1);
  const tope = new Date(primero.getFullYear(), primero.getMonth(), Math.min(h.getDate(), diasDelMes(primero.getFullYear(), primero.getMonth() + 1)));
  const antes = salioEntre(movs, cuentaId, fechaISO(primero), fechaISO(tope));
  if (antes <= 0) return null;
  const mes = MESES[primero.getMonth()];
  const dif = salio - antes;
  // Menos de un 5% (o de $1) de diferencia es «lo mismo».
  if (Math.abs(dif) < Math.max(100, antes * 0.05)) return `Va saliendo lo mismo que a estas alturas de ${mes}.`;
  return `Va saliendo ${dineroCorto(Math.abs(dif), moneda)} ${dif < 0 ? 'menos' : 'más'} que a estas alturas de ${mes}.`;
}
