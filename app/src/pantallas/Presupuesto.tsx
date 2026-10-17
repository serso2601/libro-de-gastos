// Presupuesto en tres formas: barras por categoría (Billetera, Calendario), vasos que se llenan
// (Mosaico, Cartera en mosaico) y el calendario de una categoría (Calendario en mosaico).

import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { diasQueQuedan, gastoPorDia, topes, type EstadoTope } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dinero, dineroCorto, inicialDe, MESES } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import type { Categoria } from '@/lib/tipos';
import { Barra, BotonPrincipal, FilaSimple, Inicial, Lista, NavegadorMes, Num, Rotulo, Tarjeta, Texto, Vaso } from '@/ui/componentes';
import { CalendarioMes } from '@/ui/graficos';
import { Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

function avisoDe(t: EstadoTope, moneda: string, corto = false): string {
  if (t.pasado) return `te pasaste ${corto ? dineroCorto(t.gastado - t.tope, moneda) : dinero(t.gastado - t.tope, moneda)}`;
  if (t.casiAlTope) return 'Casi al tope';
  return `quedan ${corto ? dineroCorto(t.tope - t.gastado, moneda) : dinero(t.tope - t.gastado, moneda)}`;
}

function BotonTopes() {
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'topes' })} style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.tarjeta, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Texto tam={14} peso={estilo.m.pesoTitulo === 'extra' ? 'negrita' : 'semi'}>Editar topes</Texto>
    </Pressable>
  );
}

function SinTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Tarjeta style={{ padding: 18, gap: 12 }}>
      <Texto tam={15} peso="semi">Todavía no hay topes</Texto>
      <Texto tam={13.5} color={c.tenue} style={{ lineHeight: 20 }}>Ponle a cada categoría cuánto quieres gastar como mucho al mes y aquí ves cuánto te queda.</Texto>
      <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'topes' })}>Poner topes</BotonPrincipal>
    </Tarjeta>
  );
}

export function Presupuesto() {
  const { estilo } = useTema();
  if (estilo.id === 'mosaico' || estilo.id === 'cartera') return <PresupuestoVasos />;
  if (estilo.id === 'calmosaico') return <PorCategoria />;
  return <PresupuestoLista />;
}

function PresupuestoLista() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const { c, estilo } = useTema();
  const t = topes(d, mes.clave);
  const pct = t.tope > 0 ? (t.gastado / t.tope) * 100 : 0;
  const quedan = mes.esActual ? diasQueQuedan(d.hoy) : null;
  const colorBarra = estilo.id === 'calendario' ? c.calor[3] : c.acento;
  const queda = t.tope - t.gastado;

  return (
    <Marco titulo="Presupuesto">
      <NavegadorMes nombre={mes.nombre} anio={mes.anio} mover={mes.mover} />
      {t.conTope.length === 0 ? <SinTopes /> : (
        <>
          <Tarjeta style={{ padding: 16, gap: 8 }}>
            {estilo.id === 'calendario' ? (
              <>
                <Texto tam={13} color={c.tenue}>{queda >= 0 ? 'Te quedan' : 'Te pasaste por'}</Texto>
                <Num tam={32} color={queda < 0 ? c.alerta : undefined}>{dinero(Math.abs(queda), d.moneda)}</Num>
                <View style={{ marginTop: 8 }}><Barra pct={pct} color={queda < 0 ? c.alerta : colorBarra} alto={10} /></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Texto tam={12.5} color={c.tenue}>Gastaste <Texto num tam={12.5}>{dinero(t.gastado, d.moneda)}</Texto> de <Texto num tam={12.5}>{dineroCorto(t.tope, d.moneda)}</Texto></Texto>
                  {quedan !== null && <Texto tam={12.5} color={c.tenue}>quedan {quedan} días</Texto>}
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Texto tam={15} peso="semi">Total del mes</Texto>
                  {quedan !== null && <Texto tam={13} color={c.tenue}>quedan {quedan} días</Texto>}
                </View>
                <Barra pct={pct} color={queda < 0 ? c.alerta : colorBarra} alto={10} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Texto tam={13} color={c.tenue}>Gastaste <Texto num tam={13}>{dinero(t.gastado, d.moneda)}</Texto> de <Texto num tam={13}>{dineroCorto(t.tope, d.moneda)}</Texto></Texto>
                  <Texto tam={13} color={queda < 0 ? c.alerta : c.tenue}>{queda >= 0 ? 'Te quedan ' : 'Te pasaste '}<Texto num tam={13} color={queda < 0 ? c.alerta : c.tinta}>{dinero(Math.abs(queda), d.moneda)}</Texto></Texto>
                </View>
              </>
            )}
          </Tarjeta>

          <Lista style={{ paddingVertical: 0 }}>
            {t.conTope.map((x, i) => {
              const malo = x.pasado || x.casiAlTope;
              return (
                <Pressable key={x.categoria.id} onPress={() => abrir({ tipo: 'presupuesto', categoria: x.categoria })} accessibilityLabel={`${x.categoria.nombre}: ${x.pct}% de ${dineroCorto(x.tope, d.moneda)}. Editar tope`}
                  style={({ pressed }) => ({ paddingVertical: 10, gap: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {estilo.id === 'calendario' && <Inicial texto={inicialDe(x.categoria.nombre)} color={x.categoria.color} tam={28} />}
                    <Texto tam={15} peso="medio" style={{ flex: 1 }} lineas={1}>{x.categoria.nombre}</Texto>
                    <Texto tam={13}><Texto num tam={13} peso="medio">{dinero(x.gastado, d.moneda)}</Texto><Texto tam={13} color={c.tenue}> de {dineroCorto(x.tope, d.moneda)}</Texto></Texto>
                  </View>
                  <Barra pct={x.pct} color={malo ? c.alerta : colorBarra} />
                  <Texto tam={12.5} peso={malo ? 'semi' : 'normal'} color={malo ? c.alerta : c.tenue}>{avisoDe(x, d.moneda)}</Texto>
                </Pressable>
              );
            })}
          </Lista>
        </>
      )}
      {t.sinTope.length > 0 && t.conTope.length > 0 && (
        <View style={{ gap: 6 }}>
          <Rotulo>Sin tope</Rotulo>
          <Lista>
            {t.sinTope.map((cat, i) => <FilaSimple key={cat.id} primera={i === 0} texto={cat.nombre} detalle="Toca para ponerle un tope" onPress={() => abrir({ tipo: 'presupuesto', categoria: cat })} />)}
          </Lista>
        </View>
      )}
    </Marco>
  );
}

function PresupuestoVasos() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, estilo, relleno } = useTema();
  const clave = d.hoy.slice(0, 7);
  const t = topes(d, clave);
  const grande = estilo.id === 'mosaico' ? 156 : 150;

  return (
    <Marco titulo="Presupuesto" derecha={<BotonTopes />}
      subtitulo={t.tope > 0 ? `${estilo.id === 'cartera' ? 'Llevas' : 'Gastaste'} ${dinero(t.gastado, d.moneda)} de ${dineroCorto(t.tope, d.moneda)} · quedan ${diasQueQuedan(d.hoy)} días` : undefined}>
      {t.conTope.length === 0 ? <SinTopes /> : (
        <Grilla columnas={2} gap={estilo.id === 'mosaico' ? 10 : 12}>
          {t.conTope.map((x) => {
            const malo = x.pasado || x.casiAlTope;
            const color = estilo.id === 'mosaico' ? relleno(x.categoria.color) : malo ? relleno(c.alerta) : c.acentoSuave;
            return (
              <Vaso key={x.categoria.id} nombre={x.categoria.nombre} sub={`${dineroCorto(x.gastado, d.moneda)} de ${dineroCorto(x.tope, d.moneda)}`}
                pct={x.pct} aviso={avisoDe(x, d.moneda, true)} alerta={malo} relleno={malo && estilo.id === 'mosaico' ? relleno(c.alerta) : color}
                alto={grande} punto={estilo.id === 'cartera'} onPress={() => abrir({ tipo: 'presupuesto', categoria: x.categoria })} />
            );
          })}
          {t.sinTope.map((cat) => <VasoVacio key={cat.id} categoria={cat} alto={grande} />)}
        </Grilla>
      )}
      <Texto tam={13} color={c.tenue} centro style={{ marginTop: 6 }}>
        {estilo.id === 'mosaico' ? 'Cada vaso se llena con lo que gastas. Tócalo para cambiar su tope.' : 'Toca un vaso para cambiar su tope.'}
      </Texto>
    </Marco>
  );
}

function VasoVacio({ categoria, alto }: { categoria: Categoria; alto: number }) {
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'presupuesto', categoria })}
      style={({ pressed }) => ({ height: alto, borderRadius: estilo.m.esquinas, borderWidth: 1.5, borderStyle: 'dashed', borderColor: mezclar(c.fondo, c.tenue, 0.35),
        padding: 14, paddingHorizontal: 16, justifyContent: 'space-between', opacity: pressed ? 0.6 : 1 })}>
      <Texto tam={15} peso="semi" lineas={1}>{categoria.nombre}</Texto>
      <Texto tam={12.5} color={c.tenue}>Sin tope · tócalo para ponerle uno</Texto>
    </Pressable>
  );
}

/** Calendario en mosaico: el mes de una sola categoría, y sus vasos para elegirla. */
function PorCategoria() {
  const d = useDatos();
  const { c, relleno } = useTema();
  const clave = d.hoy.slice(0, 7);
  const [anio, mes] = clave.split('-').map(Number);
  const t = topes(d, clave);
  const deGasto = d.categorias.filter((x) => x.tipo === 'gasto');
  const [elegida, setElegida] = useState(() => t.conTope[0]?.categoria.id ?? deGasto[0]?.id ?? '');
  const cat = deGasto.find((x) => x.id === elegida) ?? deGasto[0];
  const hoyDia = aFecha(d.hoy).getDate();
  const dias = cat ? gastoPorDia(d.movimientos, anio, mes, (m) => m.categoria_id === cat.id) : [];
  const maximo = Math.max(0, ...dias);
  const conGasto = dias.filter((v) => v > 0).length;
  const total = dias.reduce((s, v) => s + v, 0);
  const rampa = cat ? [0.16, 0.36, 0.66, 1].map((x) => mezclar(c.tarjeta, cat.color, x)) : [];

  return (
    <Marco titulo="Por categoría" derecha={<BotonTopes />}>
      {!cat ? <SinTopes /> : (
        <>
          <Tarjeta style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 4 }}>
              <View style={{ gap: 3, flex: 1 }}>
                <Texto tam={17} peso="extra" style={{ letterSpacing: -0.3 }} lineas={1}>{cat.nombre} en {MESES[mes - 1]}</Texto>
                <Texto tam={12.5} color={c.tenue}>{conGasto === 1 ? 'Un día con gasto' : `${conGasto} días con gasto`}, de {hoyDia} que van</Texto>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cat.color }} />
                <Num tam={17} peso="extra">{dinero(total, d.moneda)}</Num>
              </View>
            </View>
            <CalendarioMes anio={anio} mes={mes} alto={30} gap={5} celda={(dia) => {
              const futuro = dia > hoyDia;
              const v = dias[dia - 1];
              const nivel = futuro || v <= 0 ? 0 : Math.max(1, Math.ceil((v / maximo) * 4));
              return {
                fondo: futuro ? c.tarjeta : nivel === 0 ? c.suave : rampa[nivel - 1],
                tinta: futuro ? c.tenue : nivel === 4 ? '#FFFFFF' : c.tinta,
                borde: futuro ? { color: c.linea, punteado: false } : undefined,
                peso: dia === hoyDia ? 'extra' : 'semi',
                etiqueta: `${dia}: ${dinero(v, d.moneda)}`,
              };
            }} />
          </Tarjeta>
          <Grilla columnas={2} gap={10}>
            {deGasto.map((x) => {
              const e = t.conTope.find((y) => y.categoria.id === x.id);
              const malo = !!e && (e.pasado || e.casiAlTope);
              const gastado = e?.gastado ?? gastoPorDia(d.movimientos, anio, mes, (m) => m.categoria_id === x.id).reduce((s, v) => s + v, 0);
              return (
                <Vaso key={x.id} nombre={x.nombre} alto={104} elegido={x.id === cat.id} onPress={() => setElegida(x.id)}
                  sub={e ? `${dineroCorto(e.gastado, d.moneda)} de ${dineroCorto(e.tope, d.moneda)}` : `${dineroCorto(gastado, d.moneda)} · sin tope`}
                  pct={e?.pct ?? 0} aviso={e ? avisoDe(e, d.moneda, true) : ''} alerta={malo} relleno={malo ? relleno(c.alerta) : relleno(x.color)} />
              );
            })}
          </Grilla>
          <Texto tam={13} color={c.tenue} centro>Toca un vaso y el calendario muestra solo esa categoría.</Texto>
        </>
      )}
    </Marco>
  );
}
