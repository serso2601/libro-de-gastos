// El presupuesto en vasos: cada categoría con tope es un vaso que se llena con lo que gastas, del
// color de la categoría (o del de alerta si te pasaste o vas casi al tope). Se puede ver otro mes.

import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { diasQueQuedan, topes, type EstadoTope } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import type { Categoria } from '@/lib/tipos';
import { Barra, BotonPrincipal, NavegadorMes, Num, Tarjeta, Texto, Vaso } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

function avisoDe(t: EstadoTope, moneda: string): string {
  if (t.pasado) return `te pasaste ${dineroCorto(t.gastado - t.tope, moneda)}`;
  if (t.casiAlTope) return 'Casi al tope';
  return `quedan ${dineroCorto(t.tope - t.gastado, moneda)}`;
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

  return (
    <Marco titulo="Presupuesto" derecha={<BotonTopes />}>
      <NavegadorMes nombre={mes.nombre} anio={mes.anio} mover={mes.mover} />
      {t.conTope.length === 0 ? <SinTopes /> : (
        <>
          <Resumen gastado={t.gastado} tope={t.tope} moneda={d.moneda} dias={mes.esActual ? diasQueQuedan(d.hoy) : null} />
          <Grilla columnas={2} gap={12}>
            {[
              ...t.conTope.map((x) => {
                const malo = x.pasado || x.casiAlTope;
                return (
                  <Vaso key={x.categoria.id} nombre={x.categoria.nombre} sub={`${dineroCorto(x.gastado, d.moneda)} de ${dineroCorto(x.tope, d.moneda)}`}
                    pct={x.pct} aviso={avisoDe(x, d.moneda)} alerta={malo} relleno={malo ? relleno(c.alerta) : relleno(x.categoria.color)}
                    alto={alto} onPress={() => abrir({ tipo: 'presupuesto', categoria: x.categoria })} />
                );
              }),
              ...t.sinTope.map((cat) => <VasoVacio key={cat.id} categoria={cat} alto={alto} />),
            ]}
          </Grilla>
          <Texto tam={13} color={c.tenue} centro style={{ marginTop: 6 }}>Cada vaso se llena con lo que gastas. Tócalo para cambiar su tope.</Texto>
        </>
      )}
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
      <Texto tam={13} color={c.tenue}>Sin tope · tócalo para ponerle uno</Texto>
    </Pressable>
  );
}
