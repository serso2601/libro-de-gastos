import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { flujoCuenta, gastoPorDia, nivelador } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, dinero, inicialDe, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonRedondo, FilaMovimiento, Inicial, Lista, Num, Rotulo, Texto, Vacio } from '@/ui/componentes';
import { TiraDias } from '@/ui/graficos';
import { Icono } from '@/ui/iconos';
import { abrirCuenta, Marco } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';

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
  const { c, estilo } = useTema();
  const tira = useTiraCuenta();
  const total = d.cuentas.reduce((s, x) => s + saldo(x, d.movimientos), 0);
  const clave = d.hoy.slice(0, 7);
  const resumen = (x: Cuenta) => {
    const f = flujoCuenta(d.movimientos, x.id, clave);
    return `${f.n} ${f.n === 1 ? 'movimiento' : 'movimientos'}${f.salio ? ` · salió ${dinero(f.salio, d.moneda)}` : ''}`;
  };

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
                <Texto tam={17} peso="semi" lineas={1}>{x.nombre}</Texto>
                <Texto tam={13} color={c.tenue} lineas={1}>{resumen(x)}</Texto>
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
