// La hoja de una cuenta: crearla, editarla o borrarla.

import { useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, nuevoId } from '@/lib/formato';
import type { Cuenta } from '@/lib/tipos';
import { BotonBorrar, BotonPrincipal, Campo, Colores, Etiqueta, Hoja, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { useTema } from '@/ui/tema';

export function DialogoCuenta({ inicial, alCerrar }: { inicial?: Cuenta; alCerrar: () => void }) {
  const { cuentas, movimientos, recurrencias, moneda } = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[cuentas.length % PALETA.length]);
  const [saldo, setSaldo] = useState(inicial ? aTexto(Math.abs(inicial.saldo_inicial)) : '');
  const [negativo, setNegativo] = useState<'si' | 'no'>(inicial && inicial.saldo_inicial < 0 ? 'si' : 'no');
  const [error, setError] = useState('');
  const usada = !!inicial && (movimientos.some((m) => m.cuenta_id === inicial.id || m.cuenta_destino_id === inicial.id)
    || recurrencias.some((r) => r.cuenta_id === inicial.id || r.cuenta_destino_id === inicial.id));
  const borrable = !!inicial && cuentas.length > 1 && !usada;

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la cuenta');
    const abs = saldo.trim() === '' ? 0 : aCentavos(saldo);
    if (Number.isNaN(abs)) return setError('El saldo inicial no es un número');
    acciones.guardarCuenta({ ...inicial, id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), color, saldo_inicial: negativo === 'si' ? -abs : abs, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Hoja titulo={inicial ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear cuenta'}</BotonPrincipal>
          {inicial && (borrable
            ? <BotonBorrar texto="Borrar cuenta" onPress={() => { acciones.borrarCuenta(inicial); alCerrar(); }} />
            : <Texto tam={13} color={c.tenue} centro style={{ paddingVertical: 8 }}>No se puede borrar: es la única cuenta o tiene movimientos.</Texto>)}
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
        <Etiqueta>Saldo con el que empieza</Etiqueta>
        <MontoGrande valor={saldo} alCambiar={setSaldo} moneda={moneda} />
        <Segmentos<'no' | 'si'> opciones={[['no', 'A favor'], ['si', 'En contra (deuda)']]} valor={negativo} alCambiar={setNegativo} />
      </View>
    </Hoja>
  );
}
