// La vista «Tarjetas» del Inicio, al estilo de la pila de Wallet. La cuenta elegida queda sola arriba, con
// su estado (saldo, el mes y Anotar, Pagar y Transferir); las demás quedan apiñadas debajo, cada una en su
// lugar de siempre. Tocar la pila la abre: las tarjetas se ponen casi de pie, vistas desde arriba, y se
// despliegan en cascada. Tocar una abierta la pasa arriba con un salto por encima de las demás (tocar la
// de arriba cierra la pila); tocar la de arriba, con la pila cerrada, abre la cuenta. «Recientes» es de
// todas las cuentas: el resumen de cada una está en la pestaña Cuentas. En una pantalla ancha, la pila va a la
// izquierda y «Recientes» a la derecha.
//
// Todo el movimiento sale de resortes (`ui/resorte.ts`) y se calcula cuadro a cuadro: `P` es cuánto está
// abierta la pila (0 apilada, 1 abierta) y `J` recorre el salto de la tarjeta elegida.

import * as Haptics from 'expo-haptics';
import { memo, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type BoxShadowValue } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { cicloTarjeta, deudaTarjeta, flujoCuenta, gastadoEnCorte, pagoSugerido } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, MESES, mayuscula, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { useVez } from '@/ui/animar';
import { BotonPrincipal, Enlace, FilaMovimiento, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { FilaViva, ListaViva } from '@/ui/filaViva';
import { useDisposicion } from '@/ui/disposicion';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { CapaInclinada, useInclinacion } from '@/ui/inclinacion';
import { abrirCuenta, useIr } from '@/ui/pantalla';
import { Resorte, useMotor } from '@/ui/resorte';
import { vibrar } from '@/ui/vibrar';
import { alfa, mezclar, sobre, useTema } from '@/ui/tema';
import { Tocable } from '@/ui/tocable';

/** Cuántos movimientos salen en «Recientes» (al lado de la pila, en una pantalla ancha, caben más). */
const RECIENTES = 6;
const RECIENTES_AL_LADO = 10;

/** La cuenta que quedó arriba: se recuerda mientras la app esté abierta (aunque se pase al Calendario). */
let recordada: string | null = null;

// Geometría ---------------------------------------------------------------------------------------------
const ALTO = 216;            // alto de cada tarjeta
const HUECO = 14;            // aire entre la tarjeta de arriba y la pila
const APINADO = 40;          // lo que asoma de cada tarjeta de la pila cerrada
const SEPARACION = 88;       // lo que se ve de cada tarjeta con la pila abierta
const INCLINACION = 58;      // grados que se levanta cada tarjeta al abrir (90 = de pie)
const GROSOR = 6;            // canto de la tarjeta cuando está de pie
const ARCO = 46;             // cuánto sube el salto por encima de las demás
const PERSPECTIVA = 1400;
const MARCO = 14;            // aire dentro del cuadro de la pila: las sombras, el rebote y el arco caben ahí
const CASCADA = 0.35;        // las tarjetas se abren una tras otra dentro del mismo avance
const RESPUESTA = 0.5;       // el resorte de la pila: segundos que tarda en llegar…
const AMORTIGUACION = 1;     // …y cuánto rebota (1 = nada; menos de 1 vibra al llegar)

const rad = (a: number) => (a * Math.PI) / 180;
const acotar = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** Cuánto se ve de una tarjeta inclinada: ALTO·cos(ángulo). */
const VISTO = ALTO * Math.cos(rad(INCLINACION));
/** Coloca la tarjeta para que lo que se VE de ella arranque en `visible` (inclinada se ve más baja de lo que mide). */
const colocar = (visible: number, ang: number) => visible - ALTO + ALTO * Math.cos(rad(ang));

/** Canto, sombra hacia la tarjeta de atrás y un filo de luz. */
function sombras(g: number, shy: number, shb: number, sh: number, hl: number, borde: string): BoxShadowValue[] {
  const canto: BoxShadowValue[] = g < 0.05 ? [] : [0.5, 1].map((f) => ({ offsetX: 0, offsetY: -g * f, blurRadius: 0, color: borde }));
  return [
    ...canto,
    { offsetX: 0, offsetY: -shy, blurRadius: shb, color: `rgba(0,0,0,${sh.toFixed(3)})` },
    { offsetX: 0, offsetY: 1, blurRadius: 0, color: `rgba(255,255,255,${hl.toFixed(3)})`, inset: true },
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: 'rgba(255,255,255,0.14)', inset: true },
  ];
}

export function Tarjetas() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, colorCuenta } = useTema();
  const { columnaInicio } = useDisposicion();
  const motor = useMotor();
  const [elegida, setElegida] = useState<string | null>(recordada);

  const resortes = useRef<{ P: Resorte; J: Resorte } | null>(null);
  if (!resortes.current) {
    const J = new Resorte(0, motor);
    J.amort = 1;
    J.eps = 0.003;   // el salto se da por terminado en cuanto ya no se nota, sin esperar la cola del resorte
    J.epsV = 0.06;
    const P = new Resorte(0, motor);
    P.resp = RESPUESTA;
    P.amort = AMORTIGUACION;
    P.eps = 0.002;
    P.epsV = 0.03;
    resortes.current = { P, J };
  }
  const { P, J } = resortes.current;
  /** El brinco en curso: quién salta y desde dónde arrancó. */
  const salto = useRef<{ id: string; top: number; ang: number } | null>(null);
  /** Dónde está dibujada cada tarjeta (para arrancar el brinco justo desde ahí). */
  const pos = useRef<Record<string, { top: number; ang: number }>>({});

  // Con la pila cerrada y quieta, la tarjeta de arriba sigue la inclinación del teléfono.
  const { rx, ry } = useInclinacion(P.x < 0.02 && !salto.current);

  const frente = d.cuentas.find((x) => x.id === elegida) ?? d.cuentas[0];
  const N = d.cuentas.length;
  // Los colores de cada tarjeta se calculan una vez, no en cada cuadro de la animación.
  const tonos = useMemo(() => {
    const m: Record<string, { fondo: string; tinta: string; borde: string }> = {};
    d.cuentas.forEach((x) => { const fondo = colorCuenta(x.color); m[x.id] = { fondo, tinta: sobre(fondo), borde: mezclar(fondo, '#000000', 0.42) }; });
    return m;
  }, [d.cuentas, colorCuenta]);

  /** El salto ya llegó: la tarjeta queda arriba y se vuelve a poder tocar. */
  function terminarSalto() {
    salto.current = null;
    vibrar('firme', 350);
  }

  function tocar(id: string) {
    if (!frente) return;
    if (salto.current) {
      // Tocar rápido no debe sentirse trabado: pasado el primer tramo el salto se da por llegado y se atiende el toque.
      if (J.x < 0.6) return;
      J.fijar(1);
      terminarSalto();
    }
    if (P.t < 0.5) {
      if (id === frente.id) { abrirCuenta(id); return; }
      vibrar('suave');
      P.ir(1);
      return;
    }
    if (id === frente.id) { vibrar('seleccion'); P.ir(0); return; }
    saltar(id);
  }

  /** La elegida ya tiene su lugar arriba y el brinco la trae desde donde estaba; mientras, la que estaba sola
   *  vuelve a su lugar en la pila (entra por detrás de las que tiene delante) y las demás se apiñan. */
  function saltar(id: string) {
    const q = pos.current[id];
    if (!q) return;
    salto.current = { id, top: q.top, ang: q.ang };
    vibrar('seleccion');
    recordada = id;
    setElegida(id);
    J.fijar(0);
    J.resp = P.resp * 1.25;
    J.alAcabar = terminarSalto;
    J.ir(1);
    P.ir(0);
  }

  if (!frente) {
    return (
      <Tarjeta style={{ padding: 18, gap: 12 }}>
        <Texto tam={15} peso="semi">Todavía no hay cuentas</Texto>
        <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'cuenta' })}>Crear la primera</BotonPrincipal>
      </Tarjeta>
    );
  }

  // Cuadro actual -------------------------------------------------------------------------------------
  const p = P.x;
  const pc = acotar(p, 0, 1);
  const rank: Record<string, number> = {};
  let r = 0;
  d.cuentas.forEach((x) => { if (x.id !== frente.id) rank[x.id] = r++; });
  const altoAbierta = (N - 1) * SEPARACION + VISTO;
  const altoReposo = N > 1 ? ALTO + HUECO + (N - 2) * APINADO + 52 : ALTO;
  // La altura sigue al resorte pero sin su rebote, para que lo de abajo («Recientes») no se mueva más de lo necesario.
  const altoPila = Math.round(altoReposo + (altoAbierta - altoReposo) * pc);
  const saltando = !!salto.current;

  const cartas = d.cuentas.map((x, k) => {
    const esta = x.id === frente.id;
    const { fondo, tinta, borde } = tonos[x.id];
    const reposo = esta ? 0 : ALTO + HUECO + rank[x.id] * APINADO;
    const abierta = colocar(k * SEPARACION, INCLINACION);
    // Cascada: cada tarjeta arranca un poco después de la anterior dentro del mismo avance de la pila.
    const w = N > 1 ? (N - 1 - k) / (N - 1) : 0;
    const lp = p <= 1 ? acotar(p * (1 + CASCADA) - w * CASCADA, 0, 1) : p;
    let top = reposo + (abierta - reposo) * lp;
    let ang = INCLINACION * lp;
    let esc = 1;
    let z = p > 0.002 ? k + 1 : esta ? 50 : rank[x.id] + 1;
    let lpc = acotar(lp, 0, 1);
    let shy = 8 + 4 * lpc;

    if (salto.current?.id === x.id) {
      const t = acotar(J.x, 0, 1.05);
      const s = Math.sin(Math.PI * acotar(t, 0, 1));
      top = salto.current.top * (1 - t) - ARCO * s;
      ang = salto.current.ang * (1 - t);
      esc = 1 + 0.04 * s;
      z = 100;
      shy = 12 - 34 * s;
      lpc = Math.max(lpc, 1 - t);
    }
    // Ninguna tarjeta sube por encima del borde de la pila (ni en el arco del salto ni en el rebote de abrir).
    top = Math.max(top, colocar(0, ang));
    pos.current[x.id] = { top, ang };

    const escala = (PERSPECTIVA - ALTO * Math.sin(rad(ang))) / PERSPECTIVA;
    const velo = ((0.30 * (N - 1 - k)) / N) * lpc;
    // Las sombras (con desenfoque) son lo más caro de dibujar: cambian por pasos, no en cada cuadro.
    const q = Math.round(lpc * 8) / 8;
    const activa = esta && p < 0.02 && !saltando;

    return (
      <View key={x.id} style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: ALTO, zIndex: z, borderRadius: 22, backgroundColor: fondo,
        transformOrigin: '50% 100%',
        // Se coloca con translateY (no con `top`): así no se recalcula el layout en cada cuadro. Luego se compensa la
        // perspectiva (el borde de arriba mide lo mismo que la tarjeta plana) y se gira.
        transform: [{ translateY: top }, { scale: escala }, { perspective: PERSPECTIVA }, { rotateX: `${-ang}deg` }, { scale: esc }],
        boxShadow: sombras(GROSOR * q, Math.round(shy / 2) * 2, 16 + 4 * q, 0.16 + 0.14 * q, 0.34 * q, borde),
      }}>
        <Pressable onPress={() => tocar(x.id)} accessibilityLabel={esta ? (p > 0.5 ? 'Cerrar las tarjetas' : `Abrir ${x.nombre}`) : (p > 0.5 ? `Pasar ${x.nombre} arriba` : 'Ver todas las tarjetas')}
          style={{ flex: 1, borderRadius: 22, overflow: 'hidden' }}>
          <View pointerEvents={activa ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
            {esta
              ? <CapaInclinada rx={rx} ry={ry} fondo={fondo}><Contenido cuenta={x} tinta={tinta} /></CapaInclinada>
              : <Contenido cuenta={x} tinta={tinta} />}
          </View>
          {/* Las del fondo se oscurecen: están más adentro de la cartera. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: velo }]} />
        </Pressable>
      </View>
    );
  });

  const pila = (
    <>
      {/* El cuadro de la pila: todo lo que hacen las tarjetas (abrir, saltar) pasa dentro de él y se recorta en sus
          bordes (recorte recto: con esquinas redondeadas iOS redibuja todo lo de dentro en cada cuadro), así nunca se
          dibuja sobre otra cosa del Inicio. Se ensancha y se alarga un poco por los lados y el
          alto (margen negativo, dentro del aire que ya hay entre bloques) para que la cartera tenga marco. */}
      <View style={{
        zIndex: 1, overflow: 'hidden', padding: MARCO,
        marginHorizontal: -MARCO, marginVertical: -(MARCO - 4),
      }}>
        {/* El fondo de la cartera: sombra por dentro, para que las tarjetas se vean metidas en algo. */}
        <View pointerEvents="none" style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 30, backgroundColor: c.suave, opacity: pc,
          boxShadow: [
            { offsetX: 0, offsetY: 24, blurRadius: 30, spreadDistance: -6, color: 'rgba(0,0,0,0.5)', inset: true },
            { offsetX: 0, offsetY: -10, blurRadius: 18, color: 'rgba(0,0,0,0.14)', inset: true },
          ],
        }} />
        <View style={{ height: altoPila }}>
          {cartas}
        </View>
      </View>
    </>
  );

  if (columnaInicio) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
        <View style={{ width: columnaInicio }}>{pila}</View>
        <View style={{ flex: 1, minWidth: 0 }}><Recientes cuantos={RECIENTES_AL_LADO} /></View>
      </View>
    );
  }
  return (
    <>
      {pila}
      <Recientes cuantos={RECIENTES} />
    </>
  );
}

/** Lo de dentro de cada tarjeta: el estado de la cuenta (saldo o deuda, lo del mes) y las acciones sobre ella.
 *  Es igual para todas: las de atrás solo quedan tapadas por las de adelante. Memoizado: no cambia mientras se mueven. */
const Contenido = memo(function Contenido({ cuenta, tinta }: { cuenta: Cuenta; tinta: string }) {
  const d = useDatos();
  const anotar = useAnotar();
  const s = saldo(cuenta, d.movimientos);
  const ciclo = cuenta.es_credito ? cicloTarjeta(cuenta, d.hoy) : null;
  const sugerido = cuenta.es_credito ? pagoSugerido(d, cuenta) : null;
  // El pago sale, de entrada, de la primera cuenta que no es tarjeta; el usuario la puede cambiar.
  const origenPago = d.cuentas.find((x) => !x.es_credito)?.id;
  const mes = flujoCuenta(d.movimientos, cuenta.id, d.hoy.slice(0, 7));
  // Con tres botones («Transferir» incluido) en una pantalla angosta, el último queda solo con el ícono.
  const compacto = !!sugerido;

  return (
    <View style={{ flex: 1, paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between', gap: 14 }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="brillo" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="0.46" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.08} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brillo)" />
      </Svg>
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
    </View>
  );
});

/** Un botón en cápsula sobre el color de la cuenta: con su tinta de contraste, nunca rojo ni verde. */
function Accion({ icono, texto, tinta, onPress, etiqueta, soloIcono }: {
  icono?: NombreIcono; texto: string; tinta: string; onPress: () => void; etiqueta?: string;
  /** Sin texto: un círculo con el ícono (la etiqueta de accesibilidad conserva el nombre). */
  soloIcono?: boolean;
}) {
  const circulo = !!soloIcono && !!icono;
  return (
    <Tocable onPress={() => { Haptics.selectionAsync(); onPress(); }} accessibilityLabel={etiqueta ?? texto} hitSlop={4}
      style={{ flexShrink: circulo ? 0 : 1, height: 36, minWidth: 36, borderRadius: 18, paddingHorizontal: circulo ? 0 : 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: alfa(tinta, 0.16) }}>
      {icono && <Icono nombre={icono} tam={15} color={tinta} grosor={2.2} />}
      {!circulo && <Texto tam={14} peso="semi" color={tinta} lineas={1} ajustar>{texto}</Texto>}
    </Tocable>
  );
}

/** Lo último de todas las cuentas (lo que ya pasó, del más nuevo al más viejo); cada fila lleva el color de su cuenta.
 *  Memoizado: la pila se repinta en cada cuadro del movimiento y esto no cambia. */
const Recientes = memo(function Recientes({ cuantos }: { cuantos: number }) {
  const d = useDatos();
  const abrir = useAbrir();
  const ir = useIr();
  const vez = useVez();
  const ultimos = d.movimientos.filter((m) => m.fecha <= d.hoy).sort(ordenarPorFecha).slice(0, cuantos);
  return (
    <View style={{ gap: 8 }}>
      <Rotulo derecha={<Enlace onPress={() => ir('movimientos')}>Ver todo</Enlace>}>Recientes</Rotulo>
      {ultimos.length === 0 ? (
        <Tarjeta><Vacio>Todavía no hay movimientos.</Vacio></Tarjeta>
      ) : (
        <ListaViva>
          {ultimos.map((m, i) => (
            <FilaViva key={m.id} id={m.id} orden={i} vez={vez}>
              <FilaMovimiento m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
            </FilaViva>
          ))}
        </ListaViva>
      )}
    </View>
  );
});
