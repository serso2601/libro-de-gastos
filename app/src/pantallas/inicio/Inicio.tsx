// El Inicio: arriba un saldo que se puede cambiar (tocarlo abre las formas de verlo), debajo la vista
// que se prefiera, Tarjetas o Calendario. Sin cobros por venir: aquí solo se ve lo ya anotado.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ORDEN_SALDOS, saldos } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { neto } from '@/lib/formato';
import { BotonRedondo, colorDeSaldo, Hoja, Num, Segmentos, Texto } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { Marco } from '@/ui/pantalla';
import { usePreferencias, useTema, type VistaInicio } from '@/ui/tema';
import { Calendario } from './Calendario';
import { Tarjetas } from './Tarjetas';

export function InicioPrincipal() {
  const d = useDatos();
  const { c, estilo } = useTema();
  const { saldo, vistaInicio, cambiar } = usePreferencias();
  const [eligiendo, setEligiendo] = useState(false);
  const formas = saldos(d);
  const forma = formas[saldo];

  const cabecera = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <Pressable onPress={() => { Haptics.selectionAsync(); setEligiendo(true); }} accessibilityLabel={`${forma.rotulo}. Tocar para ver otro saldo`}
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Texto tam={14} color={c.tenue} lineas={1} style={{ flexShrink: 1 }}>{forma.rotulo}</Texto>
          <Icono nombre="abajo" tam={14} color={c.tenue} grosor={2} />
        </View>
        <Num tam={estilo.m.cifra} color={colorDeSaldo(forma, c)} lineas={1}>{neto(forma.valor, d.moneda)}</Num>
      </Pressable>
      <View style={{ marginBottom: 4 }}>
        <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>
    </View>
  );

  return (
    <>
      <Marco cabecera={cabecera} gap={16}>
        <Segmentos<VistaInicio> opciones={[['tarjetas', 'Tarjetas'], ['calendario', 'Calendario']]} valor={vistaInicio} alCambiar={(v) => cambiar({ vistaInicio: v })} />
        {vistaInicio === 'calendario' ? <Calendario /> : <Tarjetas />}
      </Marco>

      {eligiendo && (
        <Hoja titulo="Qué saldo ver" alCerrar={() => setEligiendo(false)}>
          {ORDEN_SALDOS.map((id) => {
            const f = formas[id];
            const elegida = id === saldo;
            return (
              <Pressable key={id} onPress={() => { Haptics.selectionAsync(); cambiar({ saldo: id }); setEligiendo(false); }}
                accessibilityLabel={f.rotulo} accessibilityState={{ selected: elegida }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: estilo.m.esquinas, backgroundColor: c.suave,
                  borderWidth: 2, borderColor: elegida ? c.tinta : 'transparent', opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tam={15} peso="semi">{f.rotulo}</Texto>
                  <Texto tam={13} color={c.tenue}>{f.detalle}</Texto>
                </View>
                <Num tam={17} color={colorDeSaldo(f, c)}>{neto(f.valor, d.moneda)}</Num>
                {elegida && <Icono nombre="check" tam={18} color={c.tinta} grosor={2} />}
              </Pressable>
            );
          })}
        </Hoja>
      )}
    </>
  );
}
