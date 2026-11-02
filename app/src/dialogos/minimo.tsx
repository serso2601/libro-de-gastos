// Corregir el pago mínimo de una tarjeta con el que dice el banco para su último corte. Con las reglas de la tarjeta,
// la app deduce qué compras de los últimos días antes del corte no entraron en ese estado de cuenta (pasan al
// siguiente). La corrección vale solo para ese corte: el mes siguiente la app vuelve a calcularlo.

import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { ajusteMinimo, cicloTarjeta, DIAS_SIN_ENTRAR, estadoTarjeta, minimoCorregido, reglasTarjeta } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, dineroCorto, MESES_CORTOS, neto } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonPrincipal, CampoMonto, Enlace, Etiqueta, Hoja, Tarjeta, Texto, TextoError } from '@/ui/componentes';
import { useTema } from '@/ui/tema';

const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;

export function DialogoMinimo({ cuenta, alCerrar }: { cuenta: Cuenta; alCerrar: () => void }) {
  const d = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const ciclo = cicloTarjeta(cuenta, d.hoy);
  const corte = ciclo?.corteAnterior ?? d.hoy;
  const reglas = reglasTarjeta(d, cuenta);
  const regla = reglas?.pago_minimo;
  // Lo que calcula la app sin la corrección, para comparar.
  const sinCorregir = useMemo(() => estadoTarjeta(d, { ...cuenta, pago_minimo: null, minimo_corte: null }), [d, cuenta]);
  const corregido = regla ? minimoCorregido(cuenta, corte) : cuenta.pago_minimo ?? null;
  const [texto, setTexto] = useState(corregido ? aTexto(corregido) : '');
  const [error, setError] = useState('');
  const escrito = texto.trim() === '' ? null : aCentavos(texto);
  const valido = escrito !== null && !Number.isNaN(escrito) && escrito > 0 ? escrito : null;
  const ajuste = useMemo(() => (valido && regla ? ajusteMinimo(d, cuenta, valido) : null), [d, cuenta, valido, regla]);

  /** Guarda el mínimo corregido para este corte, o null para volver al cálculo de la app. */
  function guardar(monto: number | null) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    acciones.guardarCuenta({ ...cuenta, pago_minimo: monto, minimo_corte: monto ? corte : null });
    alCerrar();
  }

  return (
    <Hoja titulo="Pago mínimo" alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={() => (valido ? guardar(valido) : setError('Escribe el mínimo que dice tu banco'))}>Guardar</BotonPrincipal>
          {corregido ? (
            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Enlace tam={15} onPress={() => guardar(null)}>{regla ? 'Volver al cálculo de la app' : 'Quitar el mínimo'}</Enlace>
            </View>
          ) : null}
        </>
      )}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        {cuenta.nombre} · corte del {fechaCorta(corte)}
        {sinCorregir ? ` · debías ${neto(sinCorregir.alCorte, d.moneda)} según lo anotado` : ''}.
      </Texto>

      {regla && sinCorregir?.minimo != null && (
        <Tarjeta color={c.suave} style={{ padding: 14, gap: 4 }}>
          <Texto tam={15}>La app calcula <Texto num tam={15} peso="semi">{neto(sinCorregir.minimo, d.moneda)}</Texto> (aprox.)</Texto>
          <Texto tam={13} color={c.tenue}>
            {regla.porcentaje}% de lo que debías al corte, nunca menos de {dineroCorto(regla.minimo, d.moneda)}{sinCorregir.exceso > 0 ? ', más lo que pasaba del límite' : ''}.
          </Texto>
        </Tarjeta>
      )}

      <View style={{ gap: 8 }}>
        <Etiqueta>Lo que dice tu banco</Etiqueta>
        <CampoMonto valor={texto} alCambiar={(v) => { setTexto(v); setError(''); }} moneda={d.moneda} autoFocus={!corregido}
          accessibilityLabel="Pago mínimo que dice tu banco" />
        <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>
          {regla
            ? `Edítalo solo si el mínimo de tu estado de cuenta es otro. Lo de la app es aproximado: sale de lo que anotaste, y las compras de los últimos ${DIAS_SIN_ENTRAR} días antes del corte a veces el banco las cobra en el corte siguiente (las registra 2 a 4 días después). Vale solo para este corte.`
            : 'Cópialo de tu estado de cuenta. Si eliges el banco y la tarjeta al editar la cuenta, la app lo calcula sola.'}
        </Texto>
      </View>

      {regla && valido && ajuste && sinCorregir && (
        <Tarjeta color={c.suave} style={{ padding: 14, gap: 6 }}>
          {valido === sinCorregir.minimo ? (
            <Texto tam={14}>Cuadra con lo anotado: no hay que mover nada.</Texto>
          ) : ajuste.pasan.length > 0 ? (
            <>
              <Texto tam={14}>
                Con {neto(valido, d.moneda)}, {ajuste.pasan.length === 1 ? 'esta compra no entró' : 'estas compras no entraron'} en el corte y {ajuste.pasan.length === 1 ? 'pasa' : 'pasan'} al siguiente:
              </Texto>
              {ajuste.pasan.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', gap: 10 }}>
                  <Texto tam={13} style={{ flex: 1, minWidth: 0 }} lineas={1}>{m.nota || 'Compra'} · {fechaCorta(m.fecha)}</Texto>
                  <Texto num tam={13}>{neto(m.monto, d.moneda)}</Texto>
                </View>
              ))}
              <Texto tam={13} color={c.tenue}>Al corte habrías debido unos {neto(ajuste.alCorte, d.moneda)}.</Texto>
            </>
          ) : ajuste.faltaAnotar !== null ? (
            <Texto tam={14}>Tu banco cuenta unos {neto(ajuste.faltaAnotar, d.moneda)} más de lo anotado al corte: puede faltar algo por anotar, o intereses o cargos.</Texto>
          ) : (
            <Texto tam={14}>Ninguna compra de los últimos días lo explica; se usa tu mínimo igual.</Texto>
          )}
        </Tarjeta>
      )}
    </Hoja>
  );
}
