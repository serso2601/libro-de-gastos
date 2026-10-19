// La pestaña Cuentas: todas las formas de ver el saldo (la elegida es la que sale en el Inicio) y
// un cuadro por cuenta con lo que entró y salió este mes.

import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { flujoCuenta, ORDEN_SALDOS, saldos, type FormaSaldo, type IdSaldo } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, neto, saldo } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonRedondo, colorDeSaldo, Num, Rotulo, Texto } from '@/ui/componentes';
import { abrirCuenta, Marco } from '@/ui/pantalla';
import { mezclar, usePreferencias, useTema } from '@/ui/tema';

/** Una forma de ver el saldo en su cuadro. Tocarla la pone en el Inicio. */
function CuadroSaldo({ id, forma, ancho }: { id: IdSaldo; forma: FormaSaldo; ancho?: boolean }) {
  const d = useDatos();
  const { c, estilo } = useTema();
  const prefs = usePreferencias();
  const elegido = prefs.saldo === id;
  return (
    <Pressable onPress={() => { if (!elegido) { Haptics.selectionAsync(); prefs.cambiar({ saldo: id }); } }}
      accessibilityLabel={`${forma.rotulo}: ${neto(forma.valor, d.moneda)}. ${elegido ? 'Es el que se ve en el Inicio.' : 'Tocar para verlo en el Inicio.'}`}
      style={({ pressed }) => ({ flex: 1, minHeight: ancho ? 132 : 124, borderRadius: estilo.m.esquinas, backgroundColor: c.tarjeta, padding: 14, paddingHorizontal: 16,
        justifyContent: 'space-between', gap: 8, borderWidth: 2, borderColor: elegido ? c.tinta : 'transparent', opacity: pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Texto tam={ancho ? 14 : 12} peso="medio" color={c.tenue} lineas={2} style={{ flex: 1 }}>{forma.rotulo}</Texto>
        {elegido && (
          <View style={{ backgroundColor: c.suave, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Texto tam={11} peso="semi" color={c.tinta}>En Inicio</Texto>
          </View>
        )}
      </View>
      <View style={{ gap: 2 }}>
        <Num tam={ancho ? estilo.m.cifra : 22} color={colorDeSaldo(forma, c)} lineas={1}>{neto(forma.valor, d.moneda)}</Num>
        <Texto tam={12} color={c.tenue} lineas={2}>{forma.detalle}</Texto>
      </View>
    </Pressable>
  );
}

/** El cuadro de una cuenta: su color de fondo, el saldo y lo que entró y salió este mes. */
function CuadroCuenta({ cuenta, clave }: { cuenta: Cuenta; clave: string }) {
  const d = useDatos();
  const { c, estilo, pastel, colorCuenta } = useTema();
  const f = flujoCuenta(d.movimientos, cuenta.id, clave);
  return (
    <Pressable onPress={() => abrirCuenta(cuenta.id, 'Cuentas')} accessibilityLabel={`${cuenta.nombre}: ${neto(saldo(cuenta, d.movimientos), d.moneda)}`}
      style={({ pressed }) => ({ flex: 1, minHeight: 136, borderRadius: estilo.m.esquinas, backgroundColor: pastel(cuenta.color), padding: 14, paddingHorizontal: 16,
        justifyContent: 'space-between', gap: 10, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorCuenta(cuenta.color) }} />
        <Texto tam={15} peso="semi" lineas={1} style={{ flexShrink: 1 }}>{cuenta.nombre}</Texto>
      </View>
      <View style={{ gap: 3 }}>
        <Num tam={22} lineas={1}>{neto(saldo(cuenta, d.movimientos), d.moneda)}</Num>
        <Texto num tam={12} peso="medio" color={c.ingreso} lineas={1} ajustar>Entró {dinero(f.entro, d.moneda)}</Texto>
        <Texto num tam={12} peso="medio" color={c.gasto} lineas={1} ajustar>Salió {dinero(f.salio, d.moneda)}</Texto>
      </View>
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
  const { c } = useTema();
  const formas = saldos(d);
  const clave = d.hoy.slice(0, 7);

  return (
    <Marco titulo="Cuentas" derecha={<BotonRedondo icono="mas" etiqueta="Nueva cuenta" onPress={() => abrir({ tipo: 'cuenta' })} />}>
      <View style={{ gap: 8 }}>
        <Rotulo>Tu saldo</Rotulo>
        <CuadroSaldo id="total" forma={formas.total} ancho />
        <Grilla columnas={2} gap={8}>
          {ORDEN_SALDOS.filter((id) => id !== 'total').map((id) => <CuadroSaldo key={id} id={id} forma={formas[id]} />)}
        </Grilla>
        <Texto tam={12} color={c.tenue} style={{ paddingHorizontal: 4 }}>Toca una para verla en el Inicio.</Texto>
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
