// Una cuenta abierta: su saldo, lo que entró y salió este mes y sus movimientos por día. La parte de
// arriba toma el color de la cuenta (con letra que se lea encima); los movimientos van debajo.

import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { comprasCercaDelCorte, interesSiNoPagas, resumenBanco, resumenMes, vinculoDe } from '@/lib/banco';
import {
  ajusteMinimo, atrasoAprendido, atrasoObservado, cicloTarjeta, configPresupuesto, deudaTarjeta, estadoTarjeta, flujoCuenta, gastadoEnCorte, montoEnCuenta, pagadoDesdeCorte, pagoSugerido, periodoDe, porDia,
  porVenirDelMes, reglasTarjeta,
} from '@/lib/calculos';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { conSigno, dineroCorto, MESES, MESES_CORTOS, neto, ordenarPorFecha, saldo, tituloDia } from '@/lib/formato';
import type { Cuenta as TCuenta } from '@/lib/tipos';
import { BotonRedondo, Buscador, CabeceraDia, Enlace, Ficha, FilaMovimiento, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { useVez } from '@/ui/animar';
import { avisar } from '@/ui/aviso';
import { Deslizar } from '@/ui/deslizar';
import { ANCHO_COLUMNA, ANCHO_LECTURA, useDisposicion } from '@/ui/disposicion';
import { FilaViva, GrupoVivo, ListaViva } from '@/ui/filaViva';
import { Icono } from '@/ui/iconos';
import { Marco, useApilada, Volver } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { alfa, sobre, useTema } from '@/ui/tema';
import { useZonaSegura } from '@/ui/zonaSegura';
import { cuandoViene } from './Proximos';
import { Tocable } from '@/ui/tocable';

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
  const vez = useVez();
  if (grupos.length === 0) return <Vacio>Sin movimientos todavía.</Vacio>;
  let orden = 0;
  return (
    <>
      {grupos.map(([fecha, items]) => {
        const total = items.reduce((s, m) => s + montoEnCuenta(m, cuenta.id), 0);
        const filas = items.map((m, i) => (
          <FilaViva key={m.id} id={m.id} orden={orden++} vez={vez}>
            <FilaMovimiento m={m} cuentaId={cuenta.id} primera={i === 0 || !separadas} sinIcono={!separadas} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
          </FilaViva>
        ));
        return (
          <GrupoVivo key={fecha} style={{ gap: 6 }}>
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(total, d.moneda, true)} />
            {separadas ? <ListaViva>{filas}</ListaViva> : <GrupoVivo>{filas}</GrupoVivo>}
          </GrupoVivo>
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

/** Una fila de cifras: rótulo a la izquierda, valor a la derecha. `tenue` es la versión chica y callada. */
function FilaCifra({ texto, valor, color, tenue = false }: { texto: string; valor: string; color?: string; tenue?: boolean }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 }}>
      <Texto tam={tenue ? 13 : 15} color={tenue ? c.tenue : undefined} style={{ flex: 1, minWidth: 0 }}>{texto}</Texto>
      <Texto num tam={tenue ? 13 : 15} peso={tenue ? 'normal' : 'medio'} color={color ?? (tenue ? c.tenue : undefined)}>{valor}</Texto>
    </View>
  );
}

/** '2026-10-18' → '18 oct'. */
function fechaCorta(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
}

/** El mes anterior o siguiente de una clave 'YYYY-MM'. */
function moverMes(clave: string, delta: number): string {
  const [y, m] = clave.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/** Al pie del bloque: de dónde sale el estado de cuenta de verdad y cómo abrirlo. */
function PieBanca({ banca }: { banca: { nombre: string; url: string; pasos: string } }) {
  const { c } = useTema();
  return (
    <View style={{ marginTop: 4, gap: 4, alignItems: 'flex-start' }}>
      <Texto tam={12} color={c.tenue}>El estado de cuenta completo está en la {banca.nombre}: {banca.pasos}.</Texto>
      <Enlace tam={13} onPress={() => { Linking.openURL(banca.url).catch(() => avisar('No se pudo abrir la banca')); }}>Abrir la banca</Enlace>
    </View>
  );
}

/** Resumen del mes de una cuenta (no de crédito): lo anotado y, si está vinculada a un banco, lo que él da o cobra. Callado. */
function ResumenDelMes({ cuenta, fondo }: { cuenta: TCuenta; fondo: string }) {
  const d = useDatos();
  const { c } = useTema();
  const actual = d.hoy.slice(0, 7);
  const [mes, setMes] = useState(actual);
  const sel = mes > actual ? actual : mes;
  const nombreMes = MESES[Number(sel.slice(5, 7)) - 1];
  const r = useMemo(() => resumenMes(d, cuenta, sel), [d, cuenta, sel]);
  const res = useMemo(() => resumenBanco(d, cuenta, sel), [d, cuenta, sel]);
  const vinculo = vinculoDe(d.catalogo, cuenta);
  const banca = vinculo?.banco.banca;
  const interes = res?.interes ?? null;
  const cargos = res?.cargos;
  const hayBanco = !!res && (!!interes || (!!cargos && (cargos.cargos.length > 0 || !!cargos.anual)));
  const flecha = (delta: number, activa: boolean) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); setMes(moverMes(sel, delta)); }} disabled={!activa} hitSlop={6}
      accessibilityLabel={delta < 0 ? 'Mes anterior' : 'Mes siguiente'}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: activa ? 1 : 0.3 }}>
      <Icono nombre={delta < 0 ? 'atras' : 'adelante'} tam={16} color={c.tenue} grosor={2.2} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <Rotulo derecha={<View style={{ flexDirection: 'row' }}>{flecha(-1, true)}{flecha(1, sel < actual)}</View>}>Resumen de {nombreMes}</Rotulo>
      <Tarjeta color={fondo} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2, overflow: 'hidden' }}>
        <Deslizar clave={sel}>
          <View style={{ gap: 2 }}>
            <FilaCifra texto={`Saldo al empezar ${nombreMes.toLowerCase()}`} valor={neto(r.abre, d.moneda)} tenue />
            <FilaCifra texto="Entró" valor={`+${neto(r.entro, d.moneda)}`} color={c.ingreso} />
            <FilaCifra texto="Salió" valor={`−${neto(r.salio, d.moneda)}`} color={c.gasto} />
            <View style={{ borderTopWidth: 1, borderTopColor: c.linea, marginTop: 4, paddingTop: 4 }}>
              <FilaCifra texto={r.esActual ? 'Saldo hoy' : 'Saldo al cierre'} valor={neto(r.cierra, d.moneda)} />
            </View>
            {res && hayBanco && (
              <View style={{ borderTopWidth: 1, borderTopColor: c.linea, marginTop: 6, paddingTop: 6 }}>
                <Texto tam={13} color={c.tenue} style={{ marginBottom: 2 }}>
                  {[vinculo?.banco.nombre, vinculo?.producto?.nombre, vinculo?.tarjeta?.nombre].filter(Boolean).join(' · ')}
                </Texto>
                {interes && (
                  <>
                    <FilaCifra texto="Interés (aprox.)" valor={`+${neto(interes.alCierre, d.moneda)}`} color={c.ingreso} />
                    {r.esActual && <FilaCifra texto="hasta hoy" valor={`+${neto(interes.hastaHoy, d.moneda)}`} tenue />}
                    {interes.diasBajoMinimo > 0 && (
                      <Texto tam={13} color={c.tenue}>
                        {interes.diasBajoMinimo} {interes.diasBajoMinimo === 1 ? 'día bajo' : 'días bajo'} {dineroCorto(vinculo?.producto ? (vinculo.producto.versiones[vinculo.producto.versiones.length - 1].interes?.minimo_diario ?? 0) : 0, d.moneda)} no {interes.diasBajoMinimo === 1 ? 'ganó' : 'ganaron'} interés
                      </Texto>
                    )}
                  </>
                )}
                {cargos?.cargos.map((x, i) => <FilaCifra key={`cargo${i}`} texto={x.nombre} valor={`−${neto(x.monto, d.moneda)}`} color={c.gasto} />)}
                {cargos?.anual && <FilaCifra texto={`${cargos.anual.nombre} (se cobra una vez al año)`} valor={neto(cargos.anual.monto, d.moneda)} tenue />}
                {(interes || (cargos && cargos.cargos.length > 0)) && (
                  <FilaCifra texto="Neto del banco (aprox.)" valor={neto(res.neto, d.moneda, true)} />
                )}
                {interes && <Texto tam={12} color={c.tenue} style={{ marginTop: 4 }}>Estimado con el saldo de cada día. El banco lo acredita al cierre del mes.</Texto>}
              </View>
            )}
          </View>
        </Deslizar>
        <Texto tam={12} color={c.tenue} style={{ marginTop: 6 }}>Solo lo que anotaste: lo que entró y gastaste tú.</Texto>
        {banca && <PieBanca banca={banca} />}
      </Tarjeta>
    </View>
  );
}

/**
 * Tarjeta de crédito: lo que va del corte, lo que se debía al último corte con su pago mínimo, el límite y el
 * sobregiro, y lo que dice el banco (tasa, interés si no pagas el total, pago atrasado).
 */
function ResumenTarjeta({ cuenta, fondo }: { cuenta: TCuenta; fondo: string }) {
  const d = useDatos();
  const { c } = useTema();
  const res = useMemo(() => resumenBanco(d, cuenta, d.hoy.slice(0, 7)), [d, cuenta]);
  const estado = useMemo(() => estadoTarjeta(d, cuenta), [d, cuenta]);
  const reglas = reglasTarjeta(d, cuenta);
  const fechaPago = cicloTarjeta(cuenta, d.hoy, reglas?.dias_para_pagar)?.fechaPago ?? null;
  const vinculo = vinculoDe(d.catalogo, cuenta);
  const credito = res?.credito ?? null;
  const cerca = comprasCercaDelCorte(d, cuenta);
  const nombre = vinculo ? [vinculo.banco.nombre, vinculo.tarjeta?.nombre].filter(Boolean).join(' · ') : 'Tarjeta de crédito';
  const banca = vinculo?.banco.banca;
  const sg = estado?.sobregiro ?? null;
  const pasado = estado?.limite ? Math.max(0, deudaTarjeta(d, cuenta) - estado.limite) : 0;
  const pagado = estado ? pagadoDesdeCorte(d, cuenta, estado.corte) : 0;
  const abrir = useAbrir();
  const acciones = useAcciones();
  const atraso = atrasoAprendido(d, cuenta);
  // Después de cada corte (hasta la fecha de pago), una pregunta callada: ¿el mínimo es ese? Con la respuesta la app
  // aprende cuántos días tarda el banco en hacer efectivas las compras.
  const pideConfirmar = !!estado && estado.origen === 'regla' && !estado.confirmado && estado.alCorte > 0 && !!fechaPago && d.hoy <= fechaPago;
  function confirmar(minimo: number) {
    if (!estado) return;
    const pasan = ajusteMinimo(d, cuenta, minimo)?.pasan ?? [];
    acciones.guardarCorte(cuenta.id, estado.corte, { minimo, dias: atrasoObservado(d, cuenta, estado.corte, pasan) });
  }
  return (
    <View style={{ gap: 6 }}>
      <Rotulo>{nombre}</Rotulo>
      <Tarjeta color={fondo} style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}>
        <FilaCifra texto="Al corte (aprox.)" valor={neto(gastadoEnCorte(d, cuenta), d.moneda)} />
        {cerca > 0 && (
          <Texto tam={13} color={c.tenue}>Las compras de los últimos días antes del corte pueden pasar al siguiente: {neto(cerca, d.moneda)}</Texto>
        )}
        {estado && estado.alCorte > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.linea, marginTop: 6, paddingTop: 6, gap: 2 }}>
            <FilaCifra texto={`Debías al corte del ${fechaCorta(estado.corte)}`} valor={neto(estado.alCorte, d.moneda)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 }}>
              <Texto tam={15} style={{ flex: 1, minWidth: 0 }}>
                {estado.origen === 'regla' ? 'Pago mínimo (aprox.)' : estado.origen === 'banco' ? 'Pago mínimo (de tu banco)' : 'Pago mínimo'}
              </Texto>
              <Enlace tam={13} onPress={() => abrir({ tipo: 'minimo', cuenta })}>{estado.minimo ? 'Editar' : 'Poner'}</Enlace>
              {estado.minimo ? <Texto num tam={15} peso="medio">{neto(estado.minimo, d.moneda)}</Texto> : null}
            </View>
            {estado.origen === 'regla' && reglas?.pago_minimo && (
              <Texto tam={13} color={c.tenue}>
                {reglas.pago_minimo.porcentaje}% de lo que debías, nunca menos de {dineroCorto(reglas.pago_minimo.minimo, d.moneda)}
                {estado.exceso > 0 ? `, más ${neto(estado.exceso, d.moneda)} que pasaba del límite` : ''}.
              </Texto>
            )}
            {estado.pasan.length > 0 && (
              <Texto tam={13} color={c.tenue}>
                {estado.segun === 'promedio' ? 'Según tus cortes anteriores' : 'Con el mínimo de tu banco'}, {estado.pasan.length === 1 ? 'esta compra entra' : 'estas compras entran'} en el corte siguiente: {estado.pasan.map((m) =>
                  `${m.nota || 'compra'} ${neto(m.monto, d.moneda)} (${fechaCorta(m.fecha)})`).join(', ')}.
              </Texto>
            )}
            {pideConfirmar && estado.minimo && (
              <View style={{ marginTop: 6, gap: 8, backgroundColor: c.suave, borderRadius: 12, padding: 12 }}>
                <Texto tam={13} style={{ lineHeight: 18 }}>
                  ¿Tu estado de cuenta del {fechaCorta(estado.corte)} dice {neto(estado.minimo, d.moneda)} de mínimo? Así la app aprende qué compras entran en cada corte.
                </Texto>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Ficha texto="Sí, es ese" activa={false} alto={34} onPress={() => confirmar(estado.minimo!)} />
                  <Ficha texto="Es otro" activa={false} alto={34} onPress={() => abrir({ tipo: 'minimo', cuenta })} />
                </View>
              </View>
            )}
            {estado.faltaAnotar !== null && (
              <Texto tam={13} color={c.tenue}>
                Tu banco cuenta unos {neto(estado.faltaAnotar, d.moneda)} más de lo anotado al corte: puede faltar algo por anotar, o intereses o cargos.
              </Texto>
            )}
            {pagado > 0 && <FilaCifra texto="Pagado desde el corte" valor={neto(pagado, d.moneda)} tenue />}
            {fechaPago && <FilaCifra texto="Paga antes del" valor={fechaCorta(fechaPago)} tenue />}
            {atraso && atraso.dias > 0 && (
              <Texto tam={12} color={c.tenue}>
                Tu banco suele hacer efectivas las compras {atraso.dias === 1 ? '1 día' : `${atraso.dias} días`} después (según {atraso.cortes === 1 ? '1 corte' : `${atraso.cortes} cortes`}).
              </Texto>
            )}
          </View>
        )}
        {estado?.limite && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.linea, marginTop: 6, paddingTop: 6, gap: 2 }}>
            <FilaCifra texto="Límite" valor={neto(estado.limite, d.moneda)} tenue />
            <FilaCifra texto="Disponible" valor={neto(estado.disponible ?? 0, d.moneda)} color={(estado.disponible ?? 0) < 0 ? c.alerta : undefined} />
            {sg && sg.hasta !== null && (
              <FilaCifra texto={`Disponible con sobregiro (${sg.porcentaje}%)`} valor={neto(sg.hasta - deudaTarjeta(d, cuenta), d.moneda)}
                color={sg.hasta - deudaTarjeta(d, cuenta) < 0 ? c.alerta : undefined} />
            )}
            {sg && sg.estado === 'dentro' && (
              <Texto tam={13} color={c.tenue}>
                {sg.hasta !== null
                  ? `Puedes pasarte hasta ${neto(sg.hasta, d.moneda)} (${sg.porcentaje}% más) sin cargo; más de eso, ${neto(sg.cargo, d.moneda)} al corte.`
                  : `Si pasas el límite, el banco cobra hasta ${neto(sg.cargo, d.moneda)} al corte.`}
              </Texto>
            )}
            {sg && sg.estado === 'permitido' && (
              <Texto tam={13} color={c.tenue}>
                Vas {neto(pasado, d.moneda)} sobre el límite, dentro del {sg.porcentaje}% que no cobra. El banco pide abonar lo que pasa del límite.
              </Texto>
            )}
            {sg && sg.estado === 'cobra' && (
              <Texto tam={13} color={c.alerta}>
                Vas {neto(pasado, d.moneda)} sobre el límite{sg.hasta !== null ? `, más del ${sg.porcentaje}% permitido` : ''}: si sigue así al corte, el banco cobra {sg.hasta !== null ? '' : 'hasta '}{neto(sg.cargo, d.moneda)}.
              </Texto>
            )}
          </View>
        )}
        {credito && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.linea, marginTop: 6, paddingTop: 6, gap: 2 }}>
            <FilaCifra texto="Tasa anual" valor={`${credito.tasa}%`} />
            <Texto tam={13} color={c.tenue}>Si no pagas el total: unos {neto(interesSiNoPagas(deudaTarjeta(d, cuenta), credito.tasa), d.moneda)} de interés al mes</Texto>
            {credito.pagoAtrasado > 0 && <FilaCifra texto="Pago atrasado" valor={neto(credito.pagoAtrasado, d.moneda)} tenue />}
          </View>
        )}
        <Texto tam={12} color={c.tenue} style={{ marginTop: 6 }}>Solo lo que anotaste. El corte real lo da tu banco.</Texto>
        {banca && <PieBanca banca={banca} />}
      </Tarjeta>
    </View>
  );
}

/** El bloque de la cuenta con lo del mes (o del corte, si es tarjeta de crédito). */
function BloqueBanco({ cuenta, fondo }: { cuenta: TCuenta; fondo: string }) {
  return cuenta.es_credito ? <ResumenTarjeta cuenta={cuenta} fondo={fondo} /> : <ResumenDelMes cuenta={cuenta} fondo={fondo} />;
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
  // El día de pago que puso el usuario o, si no puso, la fecha que da el banco (28 días después del corte en BG).
  const fechaPago = esTarjeta ? cicloTarjeta(cuenta, d.hoy, reglasTarjeta(d, cuenta)?.dias_para_pagar)?.fechaPago ?? null : null;
  const fechas = [cuenta.dia_corte ? `Corta el ${cuenta.dia_corte}` : '',
    cuenta.dia_pago ? `paga el ${cuenta.dia_pago}` : fechaPago ? `paga el ${fechaCorta(fechaPago)}` : ''].filter(Boolean).join(' · ');
  const disponible = esTarjeta && cuenta.limite ? cuenta.limite - deudaTarjeta(d, cuenta) : null;
  // Con sobregiro permitido (el % que publica el banco), también lo que queda contando ese margen.
  const hastaSobregiro = esTarjeta && cuenta.limite ? estadoTarjeta(d, cuenta)?.sobregiro?.hasta ?? null : null;
  const disponibleSobregiro = hastaSobregiro !== null ? hastaSobregiro - deudaTarjeta(d, cuenta) : null;
  // Pagar abre la transferencia a la tarjeta sin monto: en la hoja se elige total, lo del corte, el mínimo u otro.
  const deuda = esTarjeta ? deudaTarjeta(d, cuenta) : 0;
  function pagar() {
    anotar({ tipoInicial: 'transferencia', cuentaInicial: d.cuentas.find((x) => !x.es_credito)?.id, destinoInicial: cuenta.id,
      notaInicial: `Pago de ${cuenta.nombre}` });
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
          {!!pago?.minimo && <Texto tam={14} color={tinta}>Pago mínimo <Texto num tam={14} color={tinta}>{neto(pago.minimo, d.moneda)}</Texto></Texto>}
          {disponible !== null && <Texto tam={14} color={tinta}>Disponible <Texto num tam={14} color={tinta}>{neto(disponible, d.moneda)}</Texto></Texto>}
          {disponibleSobregiro !== null && (
            <Texto tam={14} color={tinta}>Disponible con sobregiro <Texto num tam={14} color={tinta}>{neto(disponibleSobregiro, d.moneda)}</Texto></Texto>
          )}
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
      <Tocable onPress={() => anotar({ cuentaInicial: cuenta.id })}
        style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: tinta, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Icono nombre="mas" tam={18} color={fondo} grosor={2.2} />
        <Texto tam={15} peso="semi" color={fondo}>Anotar aquí</Texto>
      </Tocable>
      <Tocable onPress={() => abrir({ tipo: 'cuenta', inicial: cuenta })}
        style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: alfa(tinta, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Texto tam={15} peso="medio" color={tinta}>Editar cuenta</Texto>
      </Tocable>
    </View>
    {dosColumnas && <BloqueBanco cuenta={cuenta} fondo={c.tarjeta} />}
    {esTarjeta && deuda > 0 && (
      <Tocable onPress={pagar} accessibilityLabel={`Pagar ${cuenta.nombre}`}
        style={{ height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: tinta, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Icono nombre="transferir" tam={18} color={tinta} />
        <Texto tam={15} peso="semi" color={tinta}>
          Pagar{pago?.fecha && pago.minimo ? ` · mínimo ${neto(pago.minimo, d.moneda)} antes del ${fechaCorta(pago.fecha)}` : ''}
        </Texto>
      </Tocable>
    )}
    </>
  );
  const resto = (
    <>
    {/* Lo que no se ve en el Inicio: qué viene y en qué se gastó en ESTA cuenta. Al buscar se esconden. */}
    {!buscando && (
      <View style={{ gap: 18, paddingBottom: 10 }}>
        {!dosColumnas && <BloqueBanco cuenta={cuenta} fondo={c.suave} />}
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
