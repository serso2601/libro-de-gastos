// La hoja de una cuenta: crearla, editarla o borrarla. Una cuenta puede ser tarjeta de crédito (día de
// corte, y de pago y mínimo si el usuario quiere): su saldo es deuda y la pantalla de la cuenta lo muestra así.

import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, nuevoId } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonBorrar, BotonPrincipal, Campo, Colores, Etiqueta, Ficha, Hoja, limpiarMonto, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { useTema } from '@/ui/tema';

/** Los días 1–31 en filas de 7, para elegir uno; tocar el elegido otra vez lo quita. */
function GrillaDias({ valor, alCambiar }: { valor: number | null; alCambiar: (d: number | null) => void }) {
  const filas: number[][] = [];
  for (let d = 1; d <= 31; d += 7) filas.push(Array.from({ length: Math.min(7, 32 - d) }, (_, i) => d + i));
  return (
    <View style={{ gap: 6 }}>
      {filas.map((fila, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: 7 }, (_, j) => {
            const dia = fila[j];
            return (
              <View key={j} style={{ flex: 1 }}>
                {dia !== undefined && <Ficha texto={String(dia)} activa={valor === dia} alto={38} compacta onPress={() => alCambiar(valor === dia ? null : dia)} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function DialogoCuenta({ inicial, alCerrar }: { inicial?: Cuenta; alCerrar: () => void }) {
  const { cuentas, movimientos, recurrencias, moneda } = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[cuentas.length % PALETA.length]);
  const [saldo, setSaldo] = useState(inicial ? aTexto(Math.abs(inicial.saldo_inicial)) : '');
  const [negativo, setNegativo] = useState<'si' | 'no'>(inicial && inicial.saldo_inicial < 0 ? 'si' : 'no');
  const [credito, setCredito] = useState<'si' | 'no'>(inicial?.es_credito ? 'si' : 'no');
  const [corte, setCorte] = useState<number | null>(inicial?.dia_corte ?? null);
  const [pago, setPago] = useState<number | null>(inicial?.dia_pago ?? null);
  const [minimo, setMinimo] = useState(inicial?.pago_minimo ? aTexto(inicial.pago_minimo) : '');
  const [error, setError] = useState('');
  const esTarjeta = credito === 'si';

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la cuenta');
    const abs = saldo.trim() === '' ? 0 : aCentavos(saldo);
    if (Number.isNaN(abs)) return setError(esTarjeta ? 'Lo que debes no es un número' : 'El saldo inicial no es un número');
    if (esTarjeta && corte === null) return setError('Elige el día de corte de la tarjeta');
    const min = minimo.trim() === '' ? null : aCentavos(minimo);
    if (min !== null && Number.isNaN(min)) return setError('El pago mínimo no es un número');
    acciones.guardarCuenta({
      ...inicial, id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), color, orden: inicial?.orden ?? 999,
      saldo_inicial: esTarjeta || negativo === 'si' ? -abs : abs,
      es_credito: esTarjeta, dia_corte: esTarjeta ? corte : null, dia_pago: esTarjeta ? pago : null, pago_minimo: esTarjeta ? min : null,
    });
    alCerrar();
  }

  // Borrar: con confirmación simple si la cuenta está vacía; si tiene historia, se avisa de todo lo que se va con ella.
  function borrar() {
    if (!inicial) return;
    const toca = (x: { cuenta_id: string; cuenta_destino_id: string | null }) => x.cuenta_id === inicial.id || x.cuenta_destino_id === inicial.id;
    const nMovs = movimientos.filter(toca).length;
    const nReglas = recurrencias.filter(toca).length;
    if (nMovs === 0 && nReglas === 0) {
      Alert.alert(`¿Borrar ${inicial.nombre}?`, undefined, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => { acciones.borrarCuenta(inicial); alCerrar(); } },
      ]);
      return;
    }
    const movs = `${nMovs} ${nMovs === 1 ? 'movimiento' : 'movimientos'}`;
    const reglas = `${nReglas} ${nReglas === 1 ? 'cosa que se repite' : 'cosas que se repiten'}`;
    Alert.alert(`¿Borrar ${inicial.nombre}?`, `${inicial.nombre} tiene ${movs} y ${reglas}. Si la borras, se borra todo eso también.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: () => { acciones.borrarCuenta(inicial, true); alCerrar(); } },
    ]);
  }

  return (
    <Hoja titulo={inicial ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear cuenta'}</BotonPrincipal>
          {inicial && (cuentas.length > 1
            ? <BotonBorrar texto="Borrar cuenta" onPress={borrar} />
            : <Texto tam={13} color={c.tenue} centro style={{ paddingVertical: 8 }}>No se puede borrar: es la única cuenta. Crea otra primero.</Texto>)}
        </>
      )}>
      <View style={{ gap: 8 }}>
        <Etiqueta>Nombre</Etiqueta>
        <Campo value={nombre} onChangeText={setNombre} placeholder="Ej: Efectivo, Banco, Ahorros" autoFocus={!inicial} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Color</Etiqueta>
        <Colores valor={color} alCambiar={setColor} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Es tarjeta de crédito</Etiqueta>
        <Segmentos<'no' | 'si'> opciones={[['no', 'No'], ['si', 'Sí']]} valor={credito} alCambiar={setCredito} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>{esTarjeta ? 'Lo que debes hoy' : 'Saldo con el que empieza'}</Etiqueta>
        <MontoGrande valor={saldo} alCambiar={setSaldo} moneda={moneda} />
        {!esTarjeta && <Segmentos<'no' | 'si'> opciones={[['no', 'A favor'], ['si', 'En contra (deuda)']]} valor={negativo} alCambiar={setNegativo} />}
      </View>
      {esTarjeta && (
        <>
          <View style={{ gap: 8 }}>
            <Etiqueta>Día de corte</Etiqueta>
            <GrillaDias valor={corte} alCambiar={setCorte} />
          </View>
          <View style={{ gap: 8 }}>
            <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Día de pago</Etiqueta>
            <GrillaDias valor={pago} alCambiar={setPago} />
          </View>
          <View style={{ gap: 8 }}>
            <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Pago mínimo</Etiqueta>
            <Campo value={minimo} onChangeText={(t) => setMinimo(limpiarMonto(t))} placeholder={`${moneda}0.00`} keyboardType="decimal-pad" />
            <Texto tam={13} color={c.tenue}>Cópialo de tu estado de cuenta: la app no lo calcula.</Texto>
          </View>
        </>
      )}
    </Hoja>
  );
}
