import { Pressable, View } from 'react-native';
import { useAbrir, useAnotar } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { flujoCuenta, gastoPorDia, nivelador } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dinero, inicialDe, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonRedondo, FilaMovimiento, Inicial, Lista, Num, PildoraAnotar, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { TiraDias } from '@/ui/graficos';
import { Icono } from '@/ui/iconos';
import { abrirCuenta, Marco } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';

/** Los días del mes de una cuenta: más fuerte, más gasto; los que no llegan, solo el borde. */
export function useTiraCuenta() {
  const d = useDatos();
  const { c } = useTema();
  const hoy = aFecha(d.hoy);
  const [anio, mes] = [hoy.getFullYear(), hoy.getMonth() + 1];
  return (cuenta: Cuenta) => {
    const dias = gastoPorDia(d.movimientos, anio, mes, (m) => m.cuenta_id === cuenta.id);
    const nivel = nivelador(dias);
    return dias.map((v, i) => (i + 1 > hoy.getDate() ? { fondo: 'transparent', borde: c.linea } : { fondo: v > 0 ? c.calor[nivel(v)] : c.suave }));
  };
}

function BotonNueva() {
  const abrir = useAbrir();
  const { c, estilo } = useTema();
  return (
    <Pressable onPress={() => abrir({ tipo: 'cuenta' })} style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.tarjeta, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Texto tam={14} peso={estilo.m.pesoTitulo === 'extra' ? 'negrita' : 'semi'}>Nueva cuenta</Texto>
    </Pressable>
  );
}

function Ultimos({ titulo }: { titulo: string }) {
  const d = useDatos();
  const abrir = useAbrir();
  const ultimos = [...d.movimientos].sort(ordenarPorFecha).slice(0, 3);
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Rotulo>{titulo}</Rotulo>
      <Lista>
        {ultimos.length === 0 ? <Vacio>Todavía no hay movimientos.</Vacio>
          : ultimos.map((m, i) => <FilaMovimiento key={m.id} m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />)}
      </Lista>
    </View>
  );
}

export function Cuentas() {
  const d = useDatos();
  const abrir = useAbrir();
  const anotar = useAnotar();
  const { c, estilo, oscuro, pastel, colorCuenta } = useTema();
  const tira = useTiraCuenta();
  const total = d.cuentas.reduce((s, x) => s + saldo(x, d.movimientos), 0);
  const clave = d.hoy.slice(0, 7);
  const resumen = (x: Cuenta) => {
    const f = flujoCuenta(d.movimientos, x.id, clave);
    return `${f.n} ${f.n === 1 ? 'movimiento' : 'movimientos'}${f.salio ? ` · salió ${dinero(f.salio, d.moneda)}` : ''}`;
  };

  if (estilo.id === 'mosaico') {
    return (
      <Marco titulo="Cuentas" derecha={<BotonNueva />} pie={<PildoraAnotar onPress={() => anotar()} />}>
        <Tarjeta color={c.heroe} style={{ paddingVertical: 16, paddingHorizontal: 18, gap: 2 }}>
          <Texto tam={13} color={mezclar(c.heroe, '#FFFFFF', 0.7)}>Tienes en total</Texto>
          <Num tam={36} color="#FFFFFF">{neto(total, d.moneda)}</Num>
        </Tarjeta>
        <Grilla columnas={2} gap={10}>
          {d.cuentas.map((x) => (
            <Pressable key={x.id} onPress={() => abrirCuenta(x.id, 'Cuentas')}
              style={({ pressed }) => ({ height: 128, borderRadius: estilo.m.esquinas, backgroundColor: oscuro ? mezclar(c.tarjeta, x.color, 0.25) : pastel(x.color),
                paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'space-between', opacity: pressed ? 0.8 : 1 })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Texto tam={15} peso="negrita" lineas={1} style={{ flex: 1 }}>{x.nombre}</Texto>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorCuenta(x.color) }} />
              </View>
              <Num tam={24} lineas={1}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
              <Texto tam={12.5} color={c.tenue} lineas={1}>{flujoCuenta(d.movimientos, x.id, clave).n} movimientos</Texto>
            </Pressable>
          ))}
          <Pressable key="nueva" onPress={() => abrir({ tipo: 'cuenta' })}
            style={({ pressed }) => ({ height: 128, borderRadius: estilo.m.esquinas, borderWidth: 1.5, borderStyle: 'dashed', borderColor: mezclar(c.fondo, c.tenue, 0.35),
              alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
            <Icono nombre="mas" tam={22} color={c.tenue} />
            <Texto tam={14} peso="negrita" color={c.tenue}>Nueva cuenta</Texto>
          </Pressable>
        </Grilla>
        <Ultimos titulo="Lo último en todas" />
      </Marco>
    );
  }

  if (estilo.id === 'calmosaico') {
    const menta = estilo.bloques ? (oscuro ? mezclar(c.tarjeta, estilo.bloques.menta.base, 0.22) : '#E2F1EA') : c.tarjeta;
    return (
      <Marco titulo="Cuentas" derecha={<BotonNueva />} pie={<PildoraAnotar onPress={() => anotar()} />}>
        <Tarjeta color={menta} style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Texto tam={14} peso="negrita">Tienes en total</Texto>
          <Num tam={22} peso="extra">{neto(total, d.moneda)}</Num>
        </Tarjeta>
        {d.cuentas.map((x) => (
          <Tarjeta key={x.id} onPress={() => abrirCuenta(x.id, 'Cuentas')} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Texto tam={16} peso="negrita" lineas={1}>{x.nombre}</Texto>
                <Texto tam={12.5} color={c.tenue} lineas={1}>{resumen(x)}</Texto>
              </View>
              <Num tam={22} peso="extra">{neto(saldo(x, d.movimientos), d.moneda)}</Num>
              <Icono nombre="adelante" tam={16} color={c.tenue} grosor={2} />
            </View>
            <TiraDias colores={tira(x)} tam={12} gap={4} />
          </Tarjeta>
        ))}
        <Texto tam={11.5} color={c.tenue} style={{ paddingHorizontal: 4 }}>Cada cuadrito es un día del mes: más fuerte, más gasto.</Texto>
        <Ultimos titulo="Lo último en todas" />
      </Marco>
    );
  }

  // Calendario (y cualquier otro que llegue aquí).
  return (
    <Marco titulo="Cuentas" derecha={<BotonRedondo icono="mas" etiqueta="Nueva cuenta" onPress={() => abrir({ tipo: 'cuenta' })} />}>
      <View style={{ gap: 4 }}>
        <Texto tam={13} color={c.tenue}>Tienes en total</Texto>
        <Num tam={estilo.m.cifra}>{neto(total, d.moneda)}</Num>
      </View>
      <Lista>
        {d.cuentas.map((x, i) => (
          <Pressable key={x.id} onPress={() => abrirCuenta(x.id, 'Cuentas')}
            style={({ pressed }) => ({ paddingVertical: 14, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Inicial texto={inicialDe(x.nombre)} color={x.color} tam={38} solido />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Texto tam={16} peso="semi" lineas={1}>{x.nombre}</Texto>
                <Texto tam={12.5} color={c.tenue} lineas={1}>{resumen(x)}</Texto>
              </View>
              <Num tam={15}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
              <Icono nombre="adelante" tam={16} color={c.tenue} grosor={2} />
            </View>
            <View style={{ paddingLeft: 50 }}><TiraDias colores={tira(x)} /></View>
          </Pressable>
        ))}
      </Lista>
      <Texto tam={12} color={c.tenue} style={{ paddingHorizontal: 4 }}>Cada cuadrito es un día: más fuerte, más gasto.</Texto>
      <Ultimos titulo="Lo último" />
    </Marco>
  );
}
