// El presupuesto en vasos: cada categoría con tope es un vaso que se llena con lo que gastas, del
// color de la categoría (o del de alerta si te pasaste o vas casi al tope). Se puede ver otro mes.

import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { diasQueQuedan, gastadoEn, topes, type EstadoTope } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import type { Categoria } from '@/lib/tipos';
import { Barra, BotonPrincipal, NavegadorMes, Num, Tarjeta, Texto, Vaso } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { mezclar, useTema } from '@/ui/tema';

/** Corto a propósito: en un vaso de media pantalla tiene que caber junto al porcentaje. Los montos ya van en el subtítulo. */
function avisoDe(t: EstadoTope, moneda: string): string {
  if (t.pasado) return 'Te pasaste';
  if (t.casiAlTope) return 'Casi al tope';
  return `Quedan ${dineroCorto(t.tope - t.gastado, moneda)}`;
}

function BotonTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'topes' })} style={({ pressed }) => ({ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: c.tarjeta, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Texto tam={14} peso="semi">Editar topes</Texto>
    </Pressable>
  );
}

function SinTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Tarjeta style={{ padding: 18, gap: 12 }}>
      <Texto tam={15} peso="semi">Todavía no hay topes</Texto>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>Ponle a cada categoría cuánto quieres gastar como mucho al mes y aquí ves cuánto te queda.</Texto>
      <BotonPrincipal alto={48} onPress={() => abrir({ tipo: 'topes' })}>Poner topes</BotonPrincipal>
    </Tarjeta>
  );
}

/** Lo gastado contra la suma de todos los topes del mes que se mira. */
function Resumen({ gastado, tope, moneda, dias }: { gastado: number; tope: number; moneda: string; dias: number | null }) {
  const { c } = useTema();
  const pasado = gastado > tope;
  const pct = tope > 0 ? Math.round((gastado / tope) * 100) : 0;
  return (
    <Tarjeta style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <Texto tam={14} color={c.tenue}>Gastaste</Texto>
        <Num tam={22} color={c.gasto}>{dinero(gastado, moneda)}</Num>
        <Texto tam={14} color={c.tenue}>de {dinero(tope, moneda)}</Texto>
      </View>
      <Barra pct={pct} color={pasado ? c.alerta : c.gasto} />
      <Texto num tam={14} peso={pasado ? 'semi' : 'normal'} color={pasado ? c.alerta : c.tenue}>
        {pasado ? `Te pasaste por ${dinero(gastado - tope, moneda)}` : `Te quedan ${dinero(tope - gastado, moneda)}`}
        {dias !== null ? ` · quedan ${dias} ${dias === 1 ? 'día' : 'días'}` : ''}
      </Texto>
    </Tarjeta>
  );
}

export function Presupuesto() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const { c, relleno } = useTema();
  const t = topes(d, mes.clave);
  const alto = 150;
  const ver = (categoria: Categoria) => abrir({ tipo: 'detalleCategoria', categoria, mes: mes.clave });
  // Las categorías sin tope van aparte, en cuadros bajitos: no tienen nada que llenar.
  const sinTope = t.sinTope.length > 0 && (
    <Grilla columnas={2} gap={12}>
      {t.sinTope.map((cat) => <CuadroSinTope key={cat.id} categoria={cat} gastado={gastadoEn(d, cat.id, mes.clave)} moneda={d.moneda} onPress={() => ver(cat)} />)}
    </Grilla>
  );

  return (
    <Marco titulo="Presupuesto" derecha={<BotonTopes />}>
      <NavegadorMes nombre={mes.nombre} anio={mes.anio} mover={mes.mover} />
      {t.conTope.length === 0 ? (
        <>
          <SinTopes />
          {sinTope}
        </>
      ) : (
        <>
          <Resumen gastado={t.gastado} tope={t.tope} moneda={d.moneda} dias={mes.esActual ? diasQueQuedan(d.hoy) : null} />
          <Grilla columnas={2} gap={12}>
            {t.conTope.map((x) => {
              const malo = x.pasado || x.casiAlTope;
              return (
                <Vaso key={x.categoria.id} nombre={x.categoria.nombre} sub={`${dineroCorto(x.gastado, d.moneda)} de ${dineroCorto(x.tope, d.moneda)}`}
                  pct={x.pct} aviso={avisoDe(x, d.moneda)} alerta={malo} relleno={malo ? relleno(c.alerta) : relleno(x.categoria.color)}
                  alto={alto} onPress={() => ver(x.categoria)} />
              );
            })}
          </Grilla>
          {sinTope}
          <Texto tam={13} color={c.tenue} centro style={{ marginTop: 6 }}>Toca una categoría para ver sus compras del mes.</Texto>
        </>
      )}
    </Marco>
  );
}

/** Una categoría sin tope: su nombre arriba y abajo «Sin tope» con lo gastado ese mes, si hay. */
function CuadroSinTope({ categoria, gastado, moneda, onPress }: { categoria: Categoria; gastado: number; moneda: string; onPress: () => void }) {
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${categoria.nombre}, sin tope${gastado > 0 ? `, ${dinero(gastado, moneda)} este mes` : ''}`}
      style={({ pressed }) => ({ height: 84, borderRadius: estilo.m.esquinas, borderWidth: 1.5, borderStyle: 'dashed', borderColor: mezclar(c.fondo, c.tenue, 0.35),
        paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between', opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SimboloCategoria categoria={categoria} tam={24} />
        <Texto tam={15} peso="semi" lineas={1} style={{ flex: 1 }}>{categoria.nombre}</Texto>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <Texto tam={12} color={c.tenue} lineas={1}>Sin tope</Texto>
        {gastado > 0 && <Num tam={13} peso="medio" color={c.gasto} lineas={1} style={{ flexShrink: 1 }}>{dineroCorto(gastado, moneda)}</Num>}
      </View>
    </Pressable>
  );
}
