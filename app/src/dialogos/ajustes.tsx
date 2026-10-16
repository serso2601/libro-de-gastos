import { useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, nuevoId } from '@/lib/formato';
import type { Categoria, Cuenta, TipoCategoria } from '@/lib/tipos';
import { Boton, Campo, CampoMonto, Colores, Etiqueta, Hoja, Selector, Texto, TextoError } from '@/ui/componentes';
import { C, PALETA } from '@/ui/tema';

export function DialogoCuenta({ inicial, alCerrar }: { inicial?: Cuenta; alCerrar: () => void }) {
  const { cuentas, movimientos, recurrencias, moneda } = useDatos();
  const acciones = useAcciones();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
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
    acciones.guardarCuenta({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), color, saldo_inicial: negativo === 'si' ? -abs : abs, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Hoja titulo={inicial ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar={alCerrar}>
      <Etiqueta>Nombre</Etiqueta>
      <Campo value={nombre} onChangeText={setNombre} placeholder="Ej: Efectivo, Banco, Ahorros" autoFocus={!inicial} />
      <Etiqueta>Color</Etiqueta>
      <Colores valor={color} alCambiar={setColor} />
      <Etiqueta>Saldo con el que empieza</Etiqueta>
      <CampoMonto valor={saldo} alCambiar={setSaldo} moneda={moneda} />
      <Selector<'no' | 'si'> opciones={[['no', 'A favor'], ['si', 'En contra (deuda)']]} valor={negativo} alCambiar={setNegativo} />
      <TextoError texto={error} />
      <Boton onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear cuenta'}</Boton>
      {inicial && (borrable
        ? <Boton tipo="peligro" onPress={() => { acciones.borrarCuenta(inicial); alCerrar(); }}>Borrar cuenta</Boton>
        : <Texto tam={12} color={C.tenue} style={{ textAlign: 'center' }}>No se puede borrar: es la única cuenta o tiene movimientos.</Texto>)}
    </Hoja>
  );
}

export function DialogoCategoria({ inicial, tipoInicial = 'gasto', alCerrar }: { inicial?: Categoria; tipoInicial?: TipoCategoria; alCerrar: () => void }) {
  const { movimientos, recurrencias } = useDatos();
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [emoji, setEmoji] = useState(inicial?.emoji ?? '💰');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [error, setError] = useState('');
  const borrable = !!inicial && !movimientos.some((m) => m.categoria_id === inicial.id) && !recurrencias.some((r) => r.categoria_id === inicial.id);

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la categoría');
    acciones.guardarCategoria({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), tipo, color, emoji: emoji || '💰', presupuesto: inicial?.presupuesto ?? null, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Hoja titulo={inicial ? 'Editar categoría' : 'Nueva categoría'} alCerrar={alCerrar}>
      {inicial
        ? <Texto tam={13} color={C.tenue} style={{ marginBottom: 16 }}>Categoría de {tipo}s</Texto>
        : <Selector<TipoCategoria> opciones={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} valor={tipo} alCambiar={setTipo} />}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Campo value={emoji} onChangeText={setEmoji} style={{ width: 60, textAlign: 'center', fontSize: 22 }} />
        <Campo value={nombre} onChangeText={setNombre} placeholder="Nombre de la categoría" style={{ flex: 1 }} autoFocus={!inicial} />
      </View>
      <Etiqueta>Color</Etiqueta>
      <Colores valor={color} alCambiar={setColor} />
      <TextoError texto={error} />
      <Boton onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear categoría'}</Boton>
      {inicial && (borrable
        ? <Boton tipo="peligro" onPress={() => { acciones.borrarCategoria(inicial); alCerrar(); }}>Borrar categoría</Boton>
        : <Texto tam={12} color={C.tenue} style={{ textAlign: 'center' }}>No se puede borrar: tiene movimientos o se repite.</Texto>)}
    </Hoja>
  );
}

export function DialogoPresupuesto({ categoria, alCerrar }: { categoria: Categoria; alCerrar: () => void }) {
  const { moneda } = useDatos();
  const { guardarCategoria } = useAcciones();
  const [monto, setMonto] = useState(categoria.presupuesto ? aTexto(categoria.presupuesto) : '');
  function guardar(valor: number | null) {
    guardarCategoria({ ...categoria, presupuesto: valor });
    alCerrar();
  }
  return (
    <Hoja titulo={`${categoria.emoji} ${categoria.nombre}`} alCerrar={alCerrar}>
      <Etiqueta>Presupuesto por mes</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} autoFocus />
      <Boton onPress={() => { const c = aCentavos(monto); guardar(c > 0 ? c : null); }}>Guardar</Boton>
      {categoria.presupuesto ? <Boton tipo="peligro" onPress={() => guardar(null)}>Quitar presupuesto</Boton> : null}
    </Hoja>
  );
}
