// El presupuesto en vasos: cada categoría con tope es un vaso que se llena con lo que gastas, del
// color de la categoría (o del de alerta si te pasaste o vas casi al tope).

import { Pressable } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { diasQueQuedan, topes, type EstadoTope } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto } from '@/lib/formato';
import type { Categoria } from '@/lib/tipos';
import { BotonPrincipal, Tarjeta, Texto, Vaso } from '@/ui/componentes';
import { Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

function avisoDe(t: EstadoTope, moneda: string, corto = false): string {
  if (t.pasado) return `te pasaste ${corto ? dineroCorto(t.gastado - t.tope, moneda) : dinero(t.gastado - t.tope, moneda)}`;
  if (t.casiAlTope) return 'Casi al tope';
  return `quedan ${corto ? dineroCorto(t.tope - t.gastado, moneda) : dinero(t.tope - t.gastado, moneda)}`;
}

function BotonTopes() {
  const abrir = useAbrir();
  const { c } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'topes' })} style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.tarjeta, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
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

export function Presupuesto() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, relleno } = useTema();
  const clave = d.hoy.slice(0, 7);
  const t = topes(d, clave);
  const alto = 150;

  return (
    <Marco titulo="Presupuesto" derecha={<BotonTopes />}
      subtitulo={t.tope > 0 ? `Gastaste ${dinero(t.gastado, d.moneda)} de ${dineroCorto(t.tope, d.moneda)} · quedan ${diasQueQuedan(d.hoy)} días` : undefined}>
      {t.conTope.length === 0 ? <SinTopes /> : (
        <Grilla columnas={2} gap={12}>
          {t.conTope.map((x) => {
            const malo = x.pasado || x.casiAlTope;
            return (
              <Vaso key={x.categoria.id} nombre={x.categoria.nombre} sub={`${dineroCorto(x.gastado, d.moneda)} de ${dineroCorto(x.tope, d.moneda)}`}
                pct={x.pct} aviso={avisoDe(x, d.moneda, true)} alerta={malo} relleno={malo ? relleno(c.alerta) : relleno(x.categoria.color)}
                alto={alto} onPress={() => abrir({ tipo: 'presupuesto', categoria: x.categoria })} />
            );
          })}
          {t.sinTope.map((cat) => <VasoVacio key={cat.id} categoria={cat} alto={alto} />)}
        </Grilla>
      )}
      <Texto tam={13} color={c.tenue} centro style={{ marginTop: 6 }}>Cada vaso se llena con lo que gastas. Tócalo para cambiar su tope.</Texto>
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
