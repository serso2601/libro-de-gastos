// La pestaña Cuentas: cada forma de ver el saldo con una estadística que la explica (cuál se ve en
// el Inicio se elige allá, no aquí) y un cuadro por cuenta con lo que entró y salió este mes.

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import {
  cicloTarjeta, claveMes, delMes, deudaTarjeta, flujoCuenta, ORDEN_SALDOS, pagoSugerido, porVenirDelMes, saldos, sumar,
  type IdSaldo,
} from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, conSigno, dinero, MESES, MESES_CORTOS, neto, saldo } from '@/lib/formato';
import type { Categoria, Cuenta, Datos, Movimiento } from '@/lib/tipos';
import { BotonRedondo, colorDeSaldo, Num, Rotulo, Tarjeta, Texto } from '@/ui/componentes';
import { abrirCuenta, Marco } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { mezclar, useTema } from '@/ui/tema';

// --- Cuentas de apoyo -----------------------------------------------------------------------------

/** El mes que queda `n` meses antes (o después) del de `hoy`: su clave, su nombre y su abreviatura. */
function mesDesplazado(hoy: string, n: number): { clave: string; nombre: string; corto: string } {
  const h = aFecha(hoy);
  const f = new Date(h.getFullYear(), h.getMonth() + n, 1);
  return { clave: claveMes(f.getFullYear(), f.getMonth() + 1), nombre: MESES[f.getMonth()], corto: MESES_CORTOS[f.getMonth()] };
}

/** Lo que se gastó del mes `clave` hasta el día `dia` inclusive (para comparar con el mes en curso). */
function gastadoHastaDia(movs: Movimiento[], clave: string, dia: number): number {
  return movs.reduce((s, m) => s + (m.tipo === 'gasto' && m.fecha.startsWith(clave) && Number(m.fecha.slice(8, 10)) <= dia ? m.monto : 0), 0);
}

/** La categoría que se llevó más de los movimientos de un tipo, con su parte del total (0 a 100). */
function categoriaPrincipal(d: Datos, movs: Movimiento[], tipo: 'gasto' | 'ingreso'): { categoria: Categoria | null; monto: number; pct: number } | null {
  const porCategoria = new Map<string | null, number>();
  let total = 0;
  for (const m of movs) {
    if (m.tipo !== tipo) continue;
    porCategoria.set(m.categoria_id, (porCategoria.get(m.categoria_id) ?? 0) + m.monto);
    total += m.monto;
  }
  if (total <= 0) return null;
  const [id, monto] = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];
  return { categoria: d.categorias.find((x) => x.id === id) ?? null, monto, pct: Math.round((monto / total) * 100) };
}

// --- Piezas ---------------------------------------------------------------------------------------

/**
 * Una forma de ver el saldo: su rótulo y su valor y, debajo, la estadística que la explica.
 * La grande (la del total) lleva el valor aparte, más grande.
 */
function TarjetaSaldo({ id, grande, children }: { id: IdSaldo; grande?: boolean; children: ReactNode }) {
  const d = useDatos();
  const { c, estilo } = useTema();
  const forma = saldos(d)[id];
  const valor = neto(forma.valor, d.moneda);
  return (
    <Tarjeta style={{ padding: 14, paddingHorizontal: 16, gap: 12 }}>
      {grande ? (
        <View style={{ gap: 2 }}>
          <Texto tam={14} peso="medio" color={c.tenue}>{forma.rotulo}</Texto>
          <Num tam={estilo.m.cifra} color={colorDeSaldo(forma, c)} lineas={1}>{valor}</Num>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Texto tam={13} peso="medio" color={c.tenue} lineas={2} style={{ flex: 1 }}>{forma.rotulo}</Texto>
          <View style={{ maxWidth: '52%' }}>
            <Num tam={22} color={colorDeSaldo(forma, c)} lineas={1}>{valor}</Num>
          </View>
        </View>
      )}
      {children}
    </Tarjeta>
  );
}

/** Un renglón de una estadística: algo a la izquierda y un monto a la derecha. */
function Renglon({ texto, monto, color }: { texto: string; monto: string; color: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Texto tam={13} color={c.tinta} lineas={1} style={{ flex: 1 }}>{texto}</Texto>
      <Num tam={13} peso="medio" color={color} lineas={1}>{monto}</Num>
    </View>
  );
}

/** «Comida · 42% de lo que gastaste» con el símbolo de la categoría. */
function CategoriaPrincipal({ tipo, movs, verbo }: { tipo: 'gasto' | 'ingreso'; movs: Movimiento[]; verbo: string }) {
  const d = useDatos();
  const { c } = useTema();
  const p = categoriaPrincipal(d, movs, tipo);
  if (!p) return null;
  const nombre = p.categoria?.nombre ?? 'Sin categoría';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {p.categoria && <SimboloCategoria categoria={p.categoria} tam={26} />}
      <Texto tam={13} color={c.tenue} lineas={2} style={{ flex: 1 }}>
        <Texto tam={13} peso="semi">{nombre}</Texto> {verbo} el {p.pct}%
      </Texto>
    </View>
  );
}

// --- Las cinco formas de ver el saldo ---------------------------------------------------------------

/** Tienes en total: una barra partida por cuenta y, aparte, lo que se debe en tarjetas. */
function EstadisticaTotal() {
  const d = useDatos();
  const { c, colorCuenta } = useTema();
  const partes = d.cuentas.filter((x) => !x.es_credito).map((x) => ({ cuenta: x, valor: saldo(x, d.movimientos) }))
    .filter((p) => p.valor > 0).sort((a, b) => b.valor - a.valor);
  const suma = partes.reduce((s, p) => s + p.valor, 0);
  const deuda = d.cuentas.reduce((s, x) => s + (x.es_credito ? deudaTarjeta(d, x) : 0), 0);
  const visibles = partes.slice(0, 4);
  return (
    <>
      {suma > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {partes.map((p) => <View key={p.cuenta.id} style={{ flex: p.valor, backgroundColor: colorCuenta(p.cuenta.color) }} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
            {visibles.map((p) => (
              <View key={p.cuenta.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorCuenta(p.cuenta.color) }} />
                <Texto num tam={12} color={c.tenue}>{p.cuenta.nombre} {Math.round((p.valor / suma) * 100)}%</Texto>
              </View>
            ))}
            {partes.length > visibles.length && <Texto tam={12} color={c.tenue}>y {partes.length - visibles.length} más</Texto>}
          </View>
        </View>
      )}
      {deuda > 0 && <Texto num tam={13} peso="medio" color={c.gasto}>Debes {dinero(deuda, d.moneda)} en tarjetas</Texto>}
      {suma <= 0 && deuda <= 0 && <Texto tam={13} color={c.tenue}>Todavía no hay saldo en tus cuentas.</Texto>}
    </>
  );
}

/** Libre después de lo que viene: los gastos que faltan del mes y los pagos de tarjeta que se sugieren. */
function EstadisticaLibre() {
  const d = useDatos();
  const { c } = useTema();
  const gastos = porVenirDelMes(d).filter((p) => p.tipo === 'gasto');
  const pagos = d.cuentas.flatMap((x) => { const p = pagoSugerido(d, x); return p ? [{ cuenta: x, pago: p }] : []; });
  const nombreDe = (p: (typeof gastos)[number]) => p.nota || d.categorias.find((x) => x.id === p.categoria_id)?.nombre || 'Gasto';
  const resto = gastos.slice(3);
  return (
    <View style={{ gap: 6 }}>
      {gastos.slice(0, 3).map((p, i) => <Renglon key={`${p.recurrencia_id}${p.fecha}${i}`} texto={nombreDe(p)} monto={conSigno(p.monto, d.moneda, 'gasto')} color={c.gasto} />)}
      {resto.length > 0 && <Renglon texto={`y ${resto.length} más`} monto={conSigno(resto.reduce((s, p) => s + p.monto, 0), d.moneda, 'gasto')} color={c.gasto} />}
      {gastos.length === 0 && <Texto tam={13} color={c.tenue}>No falta nada por pagarse este mes.</Texto>}
      {pagos.map((p) => <Renglon key={p.cuenta.id} texto={`Pago sugerido de ${p.cuenta.nombre}`} monto={dinero(p.pago.total, d.moneda)} color={c.tenue} />)}
      {pagos.length > 0 && <Texto tam={12} color={c.tenue}>Lo que se debe en tarjetas ya está restado de tu total.</Texto>}
    </View>
  );
}

/** Balance del mes: barritas de los últimos 6 meses (verde si sobró, rojo si faltó) y cómo va contra el anterior. */
function EstadisticaMes() {
  const d = useDatos();
  const { c } = useTema();
  const meses = [-5, -4, -3, -2, -1, 0].map((n) => mesDesplazado(d.hoy, n));
  const balances = meses.map((m) => { const movs = delMes(d.movimientos, m.clave); return sumar(movs, 'ingreso') - sumar(movs, 'gasto'); });
  const mayor = Math.max(1, ...balances.map(Math.abs));
  const mitad = 28;
  const diferencia = balances[5] - balances[4];
  const anterior = meses[4].nombre;
  const frase = diferencia > 0 ? `Mejor que ${anterior} por ${dinero(diferencia, d.moneda)}`
    : diferencia < 0 ? `Peor que ${anterior} por ${dinero(-diferencia, d.moneda)}` : `Igual que ${anterior}`;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {meses.map((m, i) => {
          const b = balances[i];
          const alto = b === 0 ? 0 : Math.max(3, Math.round((Math.abs(b) / mayor) * mitad));
          const ahora = i === meses.length - 1;
          return (
            <View key={m.clave} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ height: mitad * 2, width: '100%', alignItems: 'center' }}>
                <View style={{ height: mitad, justifyContent: 'flex-end' }}>
                  {b > 0 && <View style={{ width: 22, height: alto, borderRadius: 4, backgroundColor: c.ingreso, opacity: ahora ? 1 : 0.55 }} />}
                </View>
                <View style={{ height: 1, width: '100%', backgroundColor: c.linea }} />
                <View style={{ height: mitad - 1 }}>
                  {b < 0 && <View style={{ width: 22, height: alto, borderRadius: 4, backgroundColor: c.gasto, opacity: ahora ? 1 : 0.55 }} />}
                </View>
              </View>
              <Texto tam={11} peso={ahora ? 'semi' : 'normal'} color={ahora ? c.tinta : c.tenue}>{m.corto}</Texto>
            </View>
          );
        })}
      </View>
      <Texto num tam={13} color={c.tenue}>{frase}</Texto>
    </View>
  );
}

/** Gastado en el mes: lo que se gasta por día, cómo va contra el mes pasado y dónde se fue más. */
function EstadisticaGastado() {
  const d = useDatos();
  const { c } = useTema();
  const dia = Number(d.hoy.slice(8, 10));
  const movs = delMes(d.movimientos, d.hoy.slice(0, 7));
  const gastado = sumar(movs, 'gasto');
  const anterior = mesDesplazado(d.hoy, -1);
  const antes = gastadoHastaDia(d.movimientos, anterior.clave, dia);
  const cambio = antes > 0 ? Math.round(((gastado - antes) / antes) * 100) : null;
  return (
    <View style={{ gap: 8 }}>
      <Texto num tam={13} color={c.tinta}>Un promedio de {dinero(Math.round(gastado / Math.max(1, dia)), d.moneda)} por día</Texto>
      {cambio === null
        ? <Texto tam={13} color={c.tenue}>En {anterior.nombre} no habías gastado a esta altura.</Texto>
        : cambio === 0
          ? <Texto tam={13} color={c.tenue}>Igual que en {anterior.nombre} al mismo día.</Texto>
          : <Texto num tam={13} peso="medio" color={cambio < 0 ? c.bien : c.alerta}>
            {Math.abs(cambio)}% {cambio < 0 ? 'menos' : 'más'} que en {anterior.nombre} al mismo día
          </Texto>}
      <CategoriaPrincipal tipo="gasto" movs={movs} verbo="se llevó" />
    </View>
  );
}

/** Entró en el mes: cuánto va de lo que entró el mes pasado y de dónde vino más. */
function EstadisticaEntro() {
  const d = useDatos();
  const { c } = useTema();
  const movs = delMes(d.movimientos, d.hoy.slice(0, 7));
  const entro = sumar(movs, 'ingreso');
  const anterior = mesDesplazado(d.hoy, -1);
  const antes = sumar(delMes(d.movimientos, anterior.clave), 'ingreso');
  const pct = antes > 0 ? Math.round((entro / antes) * 100) : null;
  return (
    <View style={{ gap: 8 }}>
      {pct === null
        ? <Texto tam={13} color={c.tenue}>En {anterior.nombre} no entró nada.</Texto>
        : pct >= 100
          ? <Texto num tam={13} peso="medio" color={c.ingreso}>Ya pasó lo de {anterior.nombre} ({dinero(antes, d.moneda)})</Texto>
          : <Texto num tam={13} color={c.tenue}>Va el {pct}% de lo que entró en {anterior.nombre} ({dinero(antes, d.moneda)})</Texto>}
      <CategoriaPrincipal tipo="ingreso" movs={movs} verbo="aportó" />
    </View>
  );
}

const ESTADISTICAS: Record<Exclude<IdSaldo, 'total'>, () => ReactNode> = {
  libre: () => <EstadisticaLibre />,
  mes: () => <EstadisticaMes />,
  gastado: () => <EstadisticaGastado />,
  entro: () => <EstadisticaEntro />,
};

// --- Las cuentas ------------------------------------------------------------------------------------

/** El cuadro de una cuenta: su color de fondo y su saldo; lo que entró y salió este mes o, si es tarjeta de crédito, lo que se debe. */
function CuadroCuenta({ cuenta, clave }: { cuenta: Cuenta; clave: string }) {
  const d = useDatos();
  const { c, estilo, pastel, colorCuenta } = useTema();
  const credito = !!cuenta.es_credito;
  const ciclo = credito ? cicloTarjeta(cuenta, d.hoy) : null;
  const deuda = credito ? deudaTarjeta(d, cuenta) : 0;
  const f = flujoCuenta(d.movimientos, cuenta.id, clave);
  return (
    <Pressable onPress={() => abrirCuenta(cuenta.id, 'Cuentas')}
      accessibilityLabel={credito ? `${cuenta.nombre}, tarjeta de crédito: ${deuda > 0 ? `debes ${dinero(deuda, d.moneda)}` : 'sin deuda'}` : `${cuenta.nombre}: ${neto(saldo(cuenta, d.movimientos), d.moneda)}`}
      style={({ pressed }) => ({ flex: 1, minHeight: 136, borderRadius: estilo.m.esquinas, backgroundColor: pastel(cuenta.color), padding: 14, paddingHorizontal: 16,
        justifyContent: 'space-between', gap: 10, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorCuenta(cuenta.color) }} />
        <Texto tam={15} peso="semi" lineas={1} style={{ flexShrink: 1 }}>{cuenta.nombre}</Texto>
      </View>
      {credito ? (
        <View style={{ gap: 3 }}>
          <Texto tam={12} peso="medio" color={c.tenue} lineas={1}>{deuda > 0 ? 'Debes' : 'Sin deuda'}</Texto>
          <Num tam={22} lineas={1}>{dinero(deuda, d.moneda)}</Num>
          {ciclo && cuenta.dia_corte ? <Texto tam={12} peso="medio" color={c.tenue} lineas={1}>corta el {cuenta.dia_corte}</Texto> : null}
        </View>
      ) : (
        <View style={{ gap: 3 }}>
          <Num tam={22} lineas={1}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
          <Texto num tam={12} peso="medio" color={c.ingreso} lineas={1} ajustar>Entró {dinero(f.entro, d.moneda)}</Texto>
          <Texto num tam={12} peso="medio" color={c.gasto} lineas={1} ajustar>Salió {dinero(f.salio, d.moneda)}</Texto>
        </View>
      )}
    </Pressable>
  );
}

function CuadroNueva() {
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'cuenta' })} accessibilityLabel="Nueva cuenta"
      style={({ pressed }) => ({ flex: 1, minHeight: 136, borderRadius: estilo.m.esquinas, borderWidth: 1.5, borderStyle: 'dashed', borderColor: mezclar(c.fondo, c.tenue, 0.35),
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Texto tam={15} peso="semi" color={c.tenue}>+ Nueva cuenta</Texto>
    </Pressable>
  );
}

export function Cuentas() {
  const d = useDatos();
  const abrir = useAbrir();
  const clave = d.hoy.slice(0, 7);

  return (
    <Marco titulo="Cuentas" derecha={<BotonRedondo icono="mas" etiqueta="Nueva cuenta" onPress={() => abrir({ tipo: 'cuenta' })} />}>
      <View style={{ gap: 8 }}>
        <Rotulo>Tu saldo</Rotulo>
        <TarjetaSaldo id="total" grande><EstadisticaTotal /></TarjetaSaldo>
        {ORDEN_SALDOS.filter((id): id is Exclude<IdSaldo, 'total'> => id !== 'total').map((id) => (
          <TarjetaSaldo key={id} id={id}>{ESTADISTICAS[id]()}</TarjetaSaldo>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 6 }}>
        <Rotulo>Tus cuentas</Rotulo>
        <Grilla columnas={2} gap={8}>
          {[...d.cuentas.map((x) => <CuadroCuenta key={x.id} cuenta={x} clave={clave} />), <CuadroNueva key="nueva" />]}
        </Grilla>
      </View>
    </Marco>
  );
}
