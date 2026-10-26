// El presupuesto en vasos: cada categoría con tope es un vaso que se llena con lo que gastas, del
// color de la categoría (o del de alerta si te pasaste o vas casi al tope). Se navega por periodos
// (semana, quincena, mes…, según Ajustes) y se puede ver otro.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import {
  configPresupuesto, diasQueQuedanEn, gastadoEn, nombrePeriodo, NOMBRES_PERIODO, periodoDe, periodoVecino, topes,
  type EstadoTope, type Periodo,
} from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { DIAS, dinero, dineroCorto } from '@/lib/formato';
import type { Categoria, ConfigPresupuesto } from '@/lib/tipos';
import { Barra, BotonPrincipal, Num, Tarjeta, Texto, Vaso } from '@/ui/componentes';
import { useVez } from '@/ui/animar';
import { ANCHO_COLUMNA, columnasPara, useDisposicion } from '@/ui/disposicion';
import { Icono, type NombreIcono } from '@/ui/iconos';
import { Marco } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { mezclar, useTema } from '@/ui/tema';
import { Tocable } from '@/ui/tocable';
import { Deslizar } from '@/ui/deslizar';

/**
 * Corto a propósito: en un vaso de media pantalla tiene que caber junto al porcentaje. Los montos ya
 * van en el subtítulo. Si trae algo del periodo anterior y no hay alerta, eso es lo que se avisa.
 */
function avisoDe(t: EstadoTope, moneda: string): string {
  if (t.pasado) return 'Te pasaste';
  if (t.casiAlTope) return 'Casi al tope';
  if (t.arrastre !== 0) return `${t.arrastre > 0 ? '+' : ''}${dineroCorto(t.arrastre, moneda)} del anterior`;
  return `Quedan ${dineroCorto(t.tope - t.gastado, moneda)}`;
}

/** Cómo está configurado el periodo, para la ficha de arriba: «Cada semana · empieza el lunes». */
function descripcionPeriodo(config: ConfigPresupuesto): string {
  const nombre = NOMBRES_PERIODO[config.periodo];
  if (config.periodo === 'mensual') return `${nombre} · desde el día ${Number(config.inicio) || 1}`;
  if (config.periodo === 'semanal') return `${nombre} · empieza el ${DIAS[Number(config.inicio) || 0]}`;
  return nombre;
}

/** El navegador de periodos en cápsula, de la misma forma que el de meses: ‹ 19 – 25 oct › */
function NavegadorPeriodo({ nombre, mover }: { nombre: string; mover: (d: number) => void }) {
  const { c } = useTema();
  const flecha = (d: number, icono: NombreIcono) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); mover(d); }} accessibilityLabel={d < 0 ? 'Periodo anterior' : 'Periodo siguiente'}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icono nombre={icono} tam={20} color={c.tinta} grosor={2} />
    </Pressable>
  );
  return (
    <View style={{ height: 44, borderRadius: 22, backgroundColor: c.tarjeta, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {flecha(-1, 'atras')}
      <Texto tam={15} peso="semi">{nombre}</Texto>
      {flecha(1, 'adelante')}
    </View>
  );
}

/** La ficha chica con el periodo del presupuesto; tocarla abre la hoja para cambiarlo. */
function FichaPeriodo({ config }: { config: ConfigPresupuesto }) {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Tocable onPress={() => abrir({ tipo: 'periodo' })} accessibilityLabel={`${descripcionPeriodo(config)}. Cambiar el periodo`}
      style={{ alignSelf: 'center', height: 32, paddingLeft: 14, paddingRight: 10, borderRadius: 16, backgroundColor: c.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Texto tam={13} color={c.tenue}>{descripcionPeriodo(config)}</Texto>
      <Icono nombre="adelante" tam={14} color={c.tenue} grosor={2} />
    </Tocable>
  );
}

function BotonTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Tocable onPress={() => abrir({ tipo: 'topes' })}
      style={{ height: 32, paddingLeft: 14, paddingRight: 10, borderRadius: 16, backgroundColor: c.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Texto tam={13} peso="semi">Editar topes</Texto>
      <Icono nombre="adelante" tam={14} color={c.tenue} grosor={2} />
    </Tocable>
  );
}

function SinTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Tarjeta style={{ padding: 18, gap: 12 }}>
      <Texto tam={15} peso="semi">Todavía no hay topes</Texto>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>Ponle a cada categoría cuánto quieres gastar como mucho en cada periodo y aquí ves cuánto te queda.</Texto>
      <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'topes' })}>Poner topes</BotonPrincipal>
    </Tarjeta>
  );
}

/** Dónde queda el periodo que se mira respecto a hoy. */
type Momento = 'actual' | 'pasado' | 'futuro';

/** Lo gastado contra la suma de todos los topes del periodo que se mira. */
function Resumen({ gastado, tope, moneda, momento, dias }: { gastado: number; tope: number; moneda: string; momento: Momento; dias: number }) {
  const { c } = useTema();
  const pasado = gastado > tope;
  const pct = tope > 0 ? Math.round((gastado / tope) * 100) : 0;
  const quedan = tope - gastado;
  const aviso = momento === 'futuro'
    ? 'Todavía no empieza'
    : pasado
      ? `Te pasaste por ${dinero(-quedan, moneda)}`
      : momento === 'pasado'
        ? `Terminó con ${dinero(quedan, moneda)} de sobra`
        : `Te quedan ${dinero(quedan, moneda)} para ${dias} ${dias === 1 ? 'día' : 'días'} · ~${dineroCorto(Math.round(quedan / dias), moneda)} por día`;
  return (
    <Tarjeta style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <Texto tam={14} color={c.tenue}>Gastaste</Texto>
        <Num tam={22} color={c.gasto}>{dinero(gastado, moneda)}</Num>
        <Texto tam={14} color={c.tenue}>de {dinero(tope, moneda)}</Texto>
      </View>
      <Barra pct={pct} color={pasado ? c.alerta : c.gasto} />
      <Texto num tam={14} peso={pasado ? 'semi' : 'normal'} color={pasado ? c.alerta : c.tenue}>{aviso}</Texto>
    </Tarjeta>
  );
}

export function Presupuesto() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, relleno } = useTema();
  // En una pantalla ancha, el periodo y el resumen van en una columna a la izquierda y los vasos a la derecha,
  // en tantas columnas como quepan.
  const { contenido, dosColumnas } = useDisposicion();
  const anchoVasos = dosColumnas ? contenido - ANCHO_COLUMNA - 36 : contenido;
  const columnas = columnasPara(anchoVasos, 180, 12, 2, 5);
  const config = configPresupuesto(d);
  // El periodo que se mira. Si cambia la configuración, se vuelve al periodo de hoy.
  const clave = `${config.periodo}|${config.inicio}`;
  const [elegido, setElegido] = useState<{ clave: string; periodo: Periodo } | null>(null);
  const p = elegido && elegido.clave === clave ? elegido.periodo : periodoDe(config, d.hoy);
  const mover = (delta: number) => setElegido({ clave, periodo: periodoVecino(config, p, delta) });
  const momento: Momento = d.hoy < p.desde ? 'futuro' : d.hoy > p.hasta ? 'pasado' : 'actual';

  const t = topes(d, p);
  // Los vasos se llenan desde cero al abrir la pestaña y al cambiar de periodo.
  const abierta = useVez();
  const llenar = `${abierta}|${p.desde}`;
  const alto = 150;
  const ver = (categoria: Categoria) => abrir({ tipo: 'detalleCategoria', categoria, periodo: p });
  // Las categorías sin tope van aparte, en cuadros bajitos: no tienen nada que llenar.
  const sinTope = t.sinTope.length > 0 && (
    <Grilla columnas={columnas} gap={12}>
      {t.sinTope.map((cat) => <CuadroSinTope key={cat.id} categoria={cat} gastado={gastadoEn(d, cat.id, p)} moneda={d.moneda} onPress={() => ver(cat)} />)}
    </Grilla>
  );

  const periodo = (
    <>
      <NavegadorPeriodo nombre={nombrePeriodo(p)} mover={mover} />
      {/* El periodo y los topes, en fichas chicas bajo el navegador (en la cabecera solo van el título y Ajustes). */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
        <FichaPeriodo config={config} />
        <BotonTopes />
      </View>
      {t.conTope.length === 0
        ? <SinTopes />
        : <Deslizar clave={p.desde}><Resumen gastado={t.gastado} tope={t.tope} moneda={d.moneda} momento={momento} dias={diasQueQuedanEn(p, d.hoy)} /></Deslizar>}
    </>
  );
  const vasos = t.conTope.length === 0 ? sinTope : (
    <>
      <Deslizar clave={p.desde}>
      <Grilla columnas={columnas} gap={12}>
        {t.conTope.map((x) => {
          const malo = x.pasado || x.casiAlTope;
          return (
            <Vaso key={x.categoria.id} nombre={x.categoria.nombre} sub={`${dineroCorto(x.gastado, d.moneda)} de ${dineroCorto(x.tope, d.moneda)}`}
              pct={x.pct} aviso={avisoDe(x, d.moneda)} alerta={malo} relleno={malo ? relleno(c.alerta) : relleno(x.categoria.color)}
              alto={alto} onPress={() => ver(x.categoria)} vez={llenar} latir={x.pasado} />
          );
        })}
      </Grilla>
      </Deslizar>
      {sinTope}
      <Texto tam={13} color={c.tenue} centro style={{ marginTop: 6 }}>Toca una categoría para ver sus compras de este periodo.</Texto>
    </>
  );

  return (
    <Marco titulo="Presupuesto">
      {dosColumnas ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 36 }}>
          <View style={{ width: ANCHO_COLUMNA, gap: 12 }}>{periodo}</View>
          <View style={{ flex: 1, minWidth: 0, gap: 12 }}>{vasos}</View>
        </View>
      ) : (
        <>
          {periodo}
          {vasos}
        </>
      )}
    </Marco>
  );
}

/** Una categoría sin tope: su nombre arriba y abajo «Sin tope» con lo gastado en el periodo, si hay. */
function CuadroSinTope({ categoria, gastado, moneda, onPress }: { categoria: Categoria; gastado: number; moneda: string; onPress: () => void }) {
  const { c, estilo } = useTema();
  return (
    <Tocable onPress={onPress} accessibilityLabel={`${categoria.nombre}, sin tope${gastado > 0 ? `, ${dinero(gastado, moneda)} en este periodo` : ''}`}
      style={{ height: 84, borderRadius: estilo.m.esquinas, borderWidth: 1.5, borderStyle: 'dashed', borderColor: mezclar(c.fondo, c.tenue, 0.35),
        paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SimboloCategoria categoria={categoria} tam={24} />
        <Texto tam={15} peso="semi" lineas={1} style={{ flex: 1 }}>{categoria.nombre}</Texto>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <Texto tam={12} color={c.tenue} lineas={1}>Sin tope</Texto>
        {gastado > 0 && <Num tam={13} peso="medio" color={c.gasto} lineas={1} style={{ flexShrink: 1 }}>{dineroCorto(gastado, moneda)}</Num>}
      </View>
    </Tocable>
  );
}
