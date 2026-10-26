// El Inicio: arriba un saldo que se puede cambiar (tocarlo abre las formas de verlo), debajo la vista
// que se prefiera, Tarjetas o Calendario. Sin cobros por venir: aquí solo se ve lo ya anotado. En una pantalla
// ancha, cada vista va en dos columnas (ver Tarjetas y Calendario) y Ajustes está en la barra del costado.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ORDEN_SALDOS, saldos } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { neto } from '@/lib/formato';
import { BotonRedondo, colorDeSaldo, Hoja, Num, Segmentos, Texto } from '@/ui/componentes';
import { useDisposicion } from '@/ui/disposicion';
import { Icono } from '@/ui/iconos';
import { Marco } from '@/ui/pantalla';
import { EtiquetaCambio, NumeroQueLate, useCambio } from '@/ui/saldoVivo';
import { usePreferencias, useTema, type VistaInicio } from '@/ui/tema';
import { Calendario } from './Calendario';
import { Tarjetas } from './Tarjetas';
import { Tocable } from '@/ui/tocable';

export function InicioPrincipal() {
  const d = useDatos();
  const { c, estilo } = useTema();
  const { saldo, vistaInicio, cambiar } = usePreferencias();
  const { lateral, columnaInicio } = useDisposicion();
  const [eligiendo, setEligiendo] = useState(false);
  const formas = saldos(d);
  const forma = formas[saldo];
  // Cuando el saldo cambia, late y sale la diferencia: verde si es para bien (en «gastado», que baje).
  const cambio = useCambio(saldo, forma.valor);
  const bueno = cambio ? (forma.tono === 'gasto' ? cambio.delta < 0 : cambio.delta > 0) : true;
  const colorCambio = bueno ? c.ingreso : c.gasto;

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={() => { Haptics.selectionAsync(); setEligiendo(true); }} accessibilityLabel={`${forma.rotulo}. Tocar para ver otro saldo`}
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Texto tam={14} color={c.tenue} lineas={1} style={{ flexShrink: 1 }}>{forma.rotulo}</Texto>
          <Icono nombre="abajo" tam={14} color={c.tenue} grosor={2} />
          {cambio && (
            <View style={{ marginLeft: 6 }}>
              <EtiquetaCambio key={cambio.vez} vez={cambio.vez} color={colorCambio} texto={neto(cambio.delta, d.moneda, true)} />
            </View>
          )}
        </View>
        <NumeroQueLate tam={estilo.m.cifra} color={colorDeSaldo(forma, c)} tinte={colorCambio} vez={cambio?.vez ?? 0}>
          {neto(forma.valor, d.moneda)}
        </NumeroQueLate>
      </Pressable>
      {!lateral && (
        <View style={{ marginBottom: 4 }}>
          <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
        </View>
      )}
    </View>
  );

  return (
    <>
      <Marco cabecera={cabecera} gap={16} angosto={!columnaInicio}>
        <View style={columnaInicio ? { width: columnaInicio } : undefined}>
          <Segmentos<VistaInicio> opciones={[['tarjetas', 'Tarjetas'], ['calendario', 'Calendario']]} valor={vistaInicio} alCambiar={(v) => cambiar({ vistaInicio: v })} />
        </View>
        {vistaInicio === 'calendario' ? <Calendario /> : <Tarjetas />}
      </Marco>

      {eligiendo && (
        <Hoja titulo="Qué saldo ver" alCerrar={() => setEligiendo(false)}>
          {ORDEN_SALDOS.map((id) => {
            const f = formas[id];
            const elegida = id === saldo;
            return (
              <Tocable key={id} onPress={() => { Haptics.selectionAsync(); cambiar({ saldo: id }); setEligiendo(false); }}
                accessibilityLabel={f.rotulo} accessibilityState={{ selected: elegida }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: estilo.m.esquinas, backgroundColor: c.suave,
                  borderWidth: 2, borderColor: elegida ? c.tinta : 'transparent' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tam={15} peso="semi">{f.rotulo}</Texto>
                  <Texto tam={13} color={c.tenue}>{f.detalle}</Texto>
                </View>
                <Num tam={17} color={colorDeSaldo(f, c)}>{neto(f.valor, d.moneda)}</Num>
                {elegida && <Icono nombre="check" tam={18} color={c.tinta} grosor={2} />}
              </Tocable>
            );
          })}
        </Hoja>
      )}
    </>
  );
}
