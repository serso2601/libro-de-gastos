// Calendario y Calendario en mosaico: el mes como calendario de calor. Cada día se pinta según lo
// que se gastó; los días con un cobro programado llevan borde punteado. Abajo, lo del día elegido.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { claveMes, delMes, diasDelMes, gastoPorDia, nivelador, sumar, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, conSigno, DIAS, dinero, dineroCorto, mayuscula, neto, saldo, tituloDia } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import type { Movimiento, Proximo } from '@/lib/tipos';
import { BotonRedondo, Dato, FilaMovimiento, Num, PildoraAnotar, Tarjeta, Texto } from '@/ui/componentes';
import { CalendarioMes, type Celda } from '@/ui/graficos';
import { ElegirMes, useDiaElegido } from '@/ui/elegirMes';
import { Icono } from '@/ui/iconos';
import { Marco, useIr } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';
import { Tutorial } from '../Tutorial';

/** El mes, los gastos por día y lo que viene, listo para pintar el calendario. */
function useCalendario() {
  const d = useDatos();
  const mes = useMes();
  const { c } = useTema();
  const hoy = aFecha(d.hoy);
  const [elegido, setElegido] = useState(hoy.getDate());
  const dias = gastoPorDia(d.movimientos, mes.anio, mes.mes);
  const nivel = nivelador(dias);
  const cobros = new Map<number, Proximo[]>();
  for (const p of d.proximos) if (p.fecha.startsWith(mes.clave)) cobros.set(Number(p.fecha.slice(8, 10)), [...(cobros.get(Number(p.fecha.slice(8, 10))) ?? []), p]);
  const fechaDe = (dia: number) => `${mes.clave}-${String(dia).padStart(2, '0')}`;
  const futuro = (dia: number) => fechaDe(dia) > d.hoy;
  const diaElegido = Math.min(elegido, diasDelMes(mes.anio, mes.mes));
  const fecha = fechaDe(diaElegido);

  // Al cambiar de mes (o de día, al volver a la app) se elige hoy si es este mes, o el primer día.
  useEffect(() => {
    setElegido(mes.esActual ? hoy.getDate() : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes.clave, d.hoy]);

  const delMesActual = delMes(d.movimientos, mes.clave);
  return {
    d, mes, hoy, dias, nivel, cobros, fecha, diaElegido, futuro, setElegido,
    gastado: sumar(delMesActual, 'gasto'),
    entro: sumar(delMesActual, 'ingreso'),
    movsDelDia: d.movimientos.filter((m) => m.fecha === fecha),
    cobrosDelDia: d.proximos.filter((p) => p.fecha === fecha),
    calor: (dia: number) => (futuro(dia) ? c.tarjeta : c.calor[nivel(dias[dia - 1])]),
  };
}

function Leyenda({ calor, cobro, texto, alTocar, tam = 12 }: { calor: string[]; cobro: string; texto: string; alTocar: () => void; tam?: number }) {
  const { c } = useTema();
  const cuadro = tam - 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Texto tam={tam} color={c.tenue}>Menos</Texto>
        {calor.map((x) => <View key={x} style={{ width: cuadro, height: cuadro, borderRadius: 3, backgroundColor: x }} />)}
        <Texto tam={tam} color={c.tenue}>Más</Texto>
      </View>
      <Pressable onPress={alTocar} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: cuadro, height: cuadro, borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cobro }} />
        <Texto tam={tam} color={c.tenue} style={{ textDecorationLine: 'underline' }}>{texto}</Texto>
      </Pressable>
    </View>
  );
}

function TituloMes({ mes, abrir, tam, pesoExtra }: { mes: ReturnType<typeof useMes>; abrir: () => void; tam: number; pesoExtra: boolean }) {
  const { c } = useTema();
  return (
    <Pressable onPress={abrir} accessibilityLabel={`Cambiar de mes, ${mes.nombre} ${mes.anio}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, opacity: pressed ? 0.6 : 1 })}>
      <Texto tam={tam} peso={pesoExtra ? 'extra' : 'negrita'} style={{ letterSpacing: -0.8 }}>{mes.nombre}</Texto>
      {!pesoExtra && <Texto tam={17} color={c.tenue}>{mes.anio}</Texto>}
      <Icono nombre="abajo" tam={16} color={c.tenue} grosor={2} />
    </Pressable>
  );
}

export function InicioCalendario() {
  const x = useCalendario();
  const { d, mes, hoy } = x;
  const abrir = useAbrir();
  const ir = useIr();
  const { c, estilo } = useTema();
  const { setFecha } = useDiaElegido();
  const [eligiendoMes, setEligiendoMes] = useState(false);
  useEffect(() => { setFecha(x.fecha); }, [x.fecha, setFecha]);

  const celda = (dia: number): Celda => {
    const futuro = x.futuro(dia);
    const cobro = x.cobros.has(dia);
    const lvl = futuro ? 0 : x.nivel(x.dias[dia - 1]);
    const esHoy = mes.esActual && dia === hoy.getDate();
    return {
      fondo: x.calor(dia),
      tinta: futuro ? c.tenue : lvl === 4 ? '#FFFFFF' : c.tinta,
      borde: cobro ? { color: c.cobro, punteado: true } : undefined,
      peso: esHoy ? 'negrita' : 'medio',
      marca: esHoy ? 'hoy' : cobro ? 'cobro' : undefined,
      elegida: dia === x.diaElegido,
      etiqueta: futuro ? `${dia}${cobro ? ', cobro programado' : ''}` : `${dia}, gastaste ${dinero(x.dias[dia - 1], d.moneda)}`,
    };
  };

  const futuro = x.fecha > d.hoy;
  const totalCobro = x.cobrosDelDia.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const gastoDia = x.dias[x.diaElegido - 1] ?? 0;
  const sub = futuro ? (totalCobro ? `se cobrará ${dinero(totalCobro, d.moneda)}` : 'todavía no llega') : gastoDia ? `gastaste ${dinero(gastoDia, d.moneda)}` : 'sin gastos';

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TituloMes mes={mes} abrir={() => setEligiendoMes(true)} tam={estilo.m.titulo} pesoExtra={false} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <BotonRedondo icono="buscar" etiqueta="Buscar" onPress={() => ir('movimientos', 'Calendario')} />
        <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );

  return (
    <Marco cabecera={cabecera} gap={14}>
      <Tutorial />
      <ElegirMes visible={eligiendoMes} anio={mes.anio} mes={mes.mes} hoy={d.hoy} alElegir={mes.cambiar} alCerrar={() => setEligiendoMes(false)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Dato rotulo="Gastado" valor={dinero(x.gastado, d.moneda)} />
        <Dato rotulo="Entró" valor={dinero(x.entro, d.moneda)} color={c.bien} />
        <Dato rotulo="Te queda" valor={neto(x.entro - x.gastado, d.moneda)} color={x.entro - x.gastado < 0 ? c.alerta : undefined} />
      </View>
      <Tarjeta style={{ padding: 12 }}>
        <CalendarioMes anio={mes.anio} mes={mes.mes} alto={44} celda={celda} alElegir={x.setElegido} />
      </Tarjeta>
      <Leyenda calor={c.calor.slice(1)} cobro={c.cobro} texto="Cobro que viene" alTocar={() => ir('proximos', 'Calendario')} />

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <Texto tam={17} peso="semi">{tituloDia(x.fecha, d.hoy)}</Texto>
          <Num tam={13} peso="normal" color={c.tenue}>{sub}</Num>
        </View>
        {(futuro ? x.cobrosDelDia : x.movsDelDia).length === 0
          ? <Texto tam={14} color={c.tenue} style={{ paddingVertical: 14 }}>{futuro ? 'Nada programado para este día.' : 'Nada anotado este día.'}</Texto>
          : futuro
            ? x.cobrosDelDia.map((p, i) => {
              const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
              return <FilaMovimiento key={p.recurrencia_id} m={p} primera={i === 0} detalle={`Se cobra solo · ${d.cuentas.find((cu) => cu.id === p.cuenta_id)?.nombre ?? ''}`}
                onPress={regla ? () => abrir({ tipo: 'recurrencia', regla }) : undefined} />;
            })
            : x.movsDelDia.map((m, i) => <FilaMovimiento key={m.id} m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />)}
      </View>
    </Marco>
  );
}

export function InicioCalMosaico() {
  const x = useCalendario();
  const { d, mes, hoy } = x;
  const abrir = useAbrir();
  const anotar = useAnotar();
  const ir = useIr();
  const { c, estilo, oscuro, relleno } = useTema();
  const [eligiendoMes, setEligiendoMes] = useState(false);
  const t = topes(d, claveMes(hoy.getFullYear(), hoy.getMonth() + 1));
  const bloques = estilo.bloques!;
  const lavanda = oscuro ? mezclar(c.tarjeta, c.acento, 0.18) : mezclar('#FFFFFF', c.acento, 0.11);
  const menta = oscuro ? mezclar(c.tarjeta, bloques.menta.base, 0.22) : '#E2F1EA';

  const celda = (dia: number): Celda => {
    const futuro = x.futuro(dia);
    const cobro = x.cobros.has(dia);
    const lvl = futuro ? 0 : x.nivel(x.dias[dia - 1]);
    const esHoy = mes.esActual && dia === hoy.getDate();
    return {
      fondo: futuro ? c.tarjeta : lvl === 0 ? c.suave : c.calor[lvl],
      tinta: futuro ? c.tenue : lvl === 4 ? '#FFFFFF' : c.tinta,
      borde: cobro ? { color: c.cobro, punteado: true } : futuro ? { color: c.linea, punteado: false } : undefined,
      peso: esHoy ? 'extra' : 'semi',
      punto: esHoy ? (lvl === 4 ? '#FFFFFF' : c.tinta) : undefined,
      elegida: dia === x.diaElegido,
      etiqueta: futuro ? `${dia}${cobro ? ', cobro programado' : ''}` : `${dia}, gastaste ${dinero(x.dias[dia - 1], d.moneda)}`,
    };
  };

  const futuro = x.fecha > d.hoy;
  const lista: (Movimiento | Proximo)[] = futuro ? x.cobrosDelDia : x.movsDelDia;
  const totalDia = futuro ? x.cobrosDelDia.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0) : x.dias[x.diaElegido - 1] ?? 0;
  const sub = futuro ? (lista.length ? 'Se va a cobrar' : 'Todavía no llega') : lista.length === 0 ? 'Sin movimientos' : lista.length === 1 ? '1 movimiento' : `${lista.length} movimientos`;
  const lvl = futuro ? 0 : x.nivel(totalDia);
  const cobroElegido = x.cobros.has(x.diaElegido);
  const fd = aFecha(x.fecha);
  const nombreDia = `${DIAS[fd.getDay()]} ${fd.getDate()}`;
  const titulo = x.fecha === d.hoy ? `Hoy, ${nombreDia}` : mayuscula(nombreDia);
  const pctPres = t.tope > 0 ? Math.round((t.gastado / t.tope) * 100) : 0;

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TituloMes mes={mes} abrir={() => setEligiendoMes(true)} tam={estilo.m.titulo} pesoExtra />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <BotonRedondo icono="buscar" etiqueta="Buscar" onPress={() => ir('movimientos')} />
        <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );

  return (
    <Marco cabecera={cabecera} gap={12}
      pie={<PildoraAnotar texto={x.fecha === d.hoy ? 'Anotar' : `Anotar el ${x.diaElegido}`} onPress={() => anotar({ fechaInicial: x.fecha })} />}>
      <Tutorial />
      <ElegirMes visible={eligiendoMes} anio={mes.anio} mes={mes.mes} hoy={d.hoy} alElegir={mes.cambiar} alCerrar={() => setEligiendoMes(false)} />
      <Tarjeta style={{ paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, gap: 12 }}>
        <Pressable onPress={() => ir('graficos')} accessibilityLabel="Ver los gráficos del mes"
          style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.linea }}>
          <Dato rotulo="Gastado" valor={dinero(x.gastado, d.moneda)} />
          <Dato rotulo="Entró" valor={`+${dinero(x.entro, d.moneda)}`} color={c.bien} />
          <Dato rotulo="Te queda" valor={neto(x.entro - x.gastado, d.moneda)} color={x.entro - x.gastado < 0 ? c.alerta : undefined} />
        </Pressable>
        <CalendarioMes anio={mes.anio} mes={mes.mes} alto={34} gap={5} celda={celda} alElegir={x.setElegido} />
        <Leyenda calor={c.calor.slice(1)} cobro={c.cobro} texto="Se cobra" alTocar={() => ir('proximos')} tam={11.5} />
      </Tarjeta>

      <Tarjeta style={{ minHeight: 184, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, marginBottom: 4 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: futuro ? c.tarjeta : lvl === 0 ? c.suave : c.calor[lvl],
            borderWidth: cobroElegido || futuro ? 1.5 : 0, borderStyle: cobroElegido ? 'dashed' : 'solid', borderColor: cobroElegido ? c.cobro : c.linea }}>
            <Num tam={16} peso="extra" color={futuro ? c.tenue : lvl === 4 ? '#FFFFFF' : c.tinta}>{x.diaElegido}</Num>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto tam={15} peso="negrita">{titulo}</Texto>
            <Texto tam={12.5} color={c.tenue}>{sub}</Texto>
          </View>
          {totalDia > 0 && <Num tam={15} color={futuro ? c.cobro : undefined}>−{dinero(totalDia, d.moneda)}</Num>}
        </View>
        {lista.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.linea, paddingVertical: 18 }}>
            <Texto tam={13.5} color={c.tenue}>{futuro ? 'Nada programado para este día.' : 'No anotaste nada este día.'}</Texto>
          </View>
        ) : lista.map((m) => {
          const esProximo = !('id' in m);
          const regla = esProximo ? d.recurrencias.find((r) => r.id === m.recurrencia_id) : undefined;
          const cat = d.categorias.find((y) => y.id === m.categoria_id);
          const cuenta = d.cuentas.find((y) => y.id === m.cuenta_id)?.nombre ?? '';
          return (
            <Pressable key={esProximo ? m.recurrencia_id : (m as Movimiento).id}
              onPress={() => (esProximo ? regla && abrir({ tipo: 'recurrencia', regla }) : abrir({ tipo: 'movimiento', inicial: m as Movimiento }))}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38, borderTopWidth: 1, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
              <Texto tam={14} peso="semi" lineas={1} style={{ flexShrink: 1 }}>{m.nota || cat?.nombre || 'Transferencia'}</Texto>
              <Texto tam={12} color={c.tenue} lineas={1} style={{ flex: 1 }}>{esProximo ? 'Se cobra solo' : cat?.nombre ?? 'Transferencia'} · {cuenta}</Texto>
              <Num tam={14} peso="semi" color={m.tipo === 'ingreso' ? c.bien : undefined}>{conSigno(m.monto, d.moneda, m.tipo)}</Num>
            </Pressable>
          );
        })}
      </Tarjeta>

      <Grilla columnas={2} gap={12}>
        <Pressable onPress={() => ir('presupuesto')} accessibilityLabel="Presupuesto por categoría"
          style={({ pressed }) => ({ height: 96, borderRadius: 22, backgroundColor: lavanda, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(pctPres, 100)}%`, backgroundColor: relleno(c.acento) }} />
          <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Texto tam={13} peso="negrita">Presupuesto</Texto>
              <Icono nombre="adelante" tam={16} color={c.tinta} grosor={2} />
            </View>
            {t.tope > 0
              ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><Num tam={22} peso="extra">{pctPres}%</Num><Texto num tam={12.5} color={c.tenue}>de {dineroCorto(t.tope, d.moneda)}</Texto></View>
              : <Texto tam={12.5} color={c.tenue}>Por categoría</Texto>}
          </View>
        </Pressable>
        <Pressable onPress={() => ir('cuentas')} accessibilityLabel="Cuentas"
          style={({ pressed }) => ({ height: 96, borderRadius: 22, backgroundColor: menta, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'space-between', opacity: pressed ? 0.85 : 1 })}>
          <Texto tam={13} peso="negrita">Cuentas</Texto>
          <View style={{ gap: 2 }}>
            {d.cuentas.slice(0, 3).map((cu) => (
              <View key={cu.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                <Texto tam={12.5} color={c.tenue} lineas={1} style={{ flex: 1 }}>{cu.nombre}</Texto>
                <Num tam={12.5} peso="negrita">{dineroCorto(saldo(cu, d.movimientos), d.moneda)}</Num>
              </View>
            ))}
          </View>
        </Pressable>
      </Grilla>
    </Marco>
  );
}
