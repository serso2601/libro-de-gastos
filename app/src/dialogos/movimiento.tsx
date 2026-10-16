import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, etiquetaCorta, nuevoId } from '@/lib/formato';
import { FRECUENCIAS, type Frecuencia, type Movimiento, type Recurrencia, type TipoMovimiento } from '@/lib/tipos';
import { Boton, Campo, CampoFecha, CampoMonto, Etiqueta, Fichas, Hoja, Selector, Texto, TextoError } from '@/ui/componentes';
import { C } from '@/ui/tema';
import { ElegirCategoria } from './categorias';

const TIPOS: [TipoMovimiento, string][] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];
const COLORES_TIPO = { gasto: C.alerta, ingreso: C.bien, transferencia: C.acento };
type Repetir = 'no' | Frecuencia;

/** Anotar o editar un gasto, ingreso o transferencia. Al anotar, se puede volver una regla que se repite. */
export function DialogoMovimiento({ inicial, tipoInicial = 'gasto', alCerrar, alEditarRegla }: {
  inicial?: Movimiento; tipoInicial?: TipoMovimiento; alCerrar: () => void; alEditarRegla: (r: Recurrencia) => void;
}) {
  const { cuentas, categorias, moneda, hoy, recurrencias } = useDatos();
  const acciones = useAcciones();
  const editando = !!inicial;
  const primeraDe = (t: TipoMovimiento) => categorias.find((c) => c.tipo === t)?.id ?? '';
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? tipoInicial);
  const [monto, setMonto] = useState(inicial ? aTexto(inicial.monto) : '');
  const [cuenta, setCuenta] = useState(inicial?.cuenta_id ?? cuentas[0]?.id ?? '');
  const [destino, setDestino] = useState(inicial?.cuenta_destino_id ?? cuentas[1]?.id ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria_id ?? primeraDe(tipo));
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [hora, setHora] = useState(inicial?.hora ?? '');
  const [repetir, setRepetir] = useState<Repetir>('no');
  const [error, setError] = useState('');
  const regla = inicial?.recurrencia_id ? recurrencias.find((r) => r.id === inicial.recurrencia_id) : undefined;

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    if (t !== 'transferencia' && categorias.find((c) => c.id === categoria)?.tipo !== t) setCategoria(primeraDe(t));
  }

  function guardar() {
    const centavos = aCentavos(monto);
    if (!(centavos > 0)) return setError('Escribe un monto válido');
    if (!cuenta) return setError('Elige una cuenta');
    if (tipo === 'transferencia' && (!destino || destino === cuenta)) return setError('Elige dos cuentas distintas');
    if (tipo !== 'transferencia' && !categoria) return setError('Elige o crea una categoría');
    const comun = {
      tipo, monto: centavos, cuenta_id: cuenta, nota: nota.trim(),
      cuenta_destino_id: tipo === 'transferencia' ? destino : null,
      categoria_id: tipo === 'transferencia' ? null : categoria,
    };
    if (!editando && repetir !== 'no') {
      const id = nuevoId();
      acciones.guardarRecurrencia({ ...comun, id, frecuencia: repetir, fecha_inicio: fecha, fecha_fin: null, generada_hasta: null });
      // La PC anota la primera vez si la fecha ya llegó; se muestra ya, con el mismo id que le va a dar.
      if (fecha <= hoy) acciones.guardarMovimiento({ ...comun, id: `${id}@${fecha}`, fecha, hora: null, recurrencia_id: id, origen: 'recurrencia' });
    } else {
      acciones.guardarMovimiento({ ...comun, id: inicial?.id ?? nuevoId(), fecha, hora: hora || null,
        recurrencia_id: inicial?.recurrencia_id ?? null, origen: inicial?.origen ?? 'manual' });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alCerrar();
  }

  function borrar(ySiguientes: boolean) {
    if (inicial) acciones.borrarMovimiento(inicial, ySiguientes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    alCerrar();
  }

  return (
    <Hoja titulo={editando ? 'Editar movimiento' : 'Anotar'} alCerrar={alCerrar}>
      <Selector opciones={TIPOS} valor={tipo} alCambiar={cambiarTipo} colores={COLORES_TIPO} />

      <Etiqueta>Monto</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} autoFocus={!editando} />

      <Etiqueta>{tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</Etiqueta>
      <Fichas opciones={cuentas} valor={cuenta} alCambiar={setCuenta} />
      {tipo === 'transferencia'
        ? <><Etiqueta>Hacia</Etiqueta><Fichas opciones={cuentas} valor={destino} alCambiar={setDestino} /></>
        : <ElegirCategoria tipo={tipo} valor={categoria} alCambiar={setCategoria} />}

      <Etiqueta>Descripción</Etiqueta>
      <Campo value={nota} onChangeText={setNota} placeholder="¿De qué se trata?" />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Texto color={C.tenue}>{repetir === 'no' ? 'Fecha' : 'Primera vez'}</Texto>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <CampoFecha valor={fecha} alCambiar={setFecha} />
          {repetir === 'no' && (hora
            ? <CampoFecha valor={hora} alCambiar={setHora} modo="time" />
            : <Pressable onPress={() => setHora('12:00')} style={{ justifyContent: 'center', paddingHorizontal: 8 }}><Texto tam={13} color={C.acentoClaro}>+ hora</Texto></Pressable>)}
        </View>
      </View>

      {!editando && (
        <>
          <Etiqueta>Repetir</Etiqueta>
          <Selector<Repetir> opciones={[['no', 'No'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']]} valor={repetir} alCambiar={setRepetir} />
          {repetir !== 'no' && (
            <Texto tam={12} color={C.tenue} style={{ marginTop: -8, marginBottom: 16 }}>
              Se anota solo cada vez que llega la fecha, sin crear nada por adelantado. Lo que viene lo ves en «Próximos».
            </Texto>
          )}
        </>
      )}

      {regla && (
        <Pressable onPress={() => alEditarRegla(regla)} style={{ backgroundColor: C.tarjetaAlt, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Texto>🔁</Texto>
          <Texto tam={12} color={C.tenue} style={{ flex: 1 }}>
            Se repite {FRECUENCIAS.find(([f]) => f === regla.frecuencia)?.[1].toLowerCase()}{regla.fecha_fin ? ` hasta el ${etiquetaCorta(regla.fecha_fin)}` : ''}.
          </Texto>
          <Texto tam={12} peso="semi" color={C.acentoClaro}>Editar la regla</Texto>
        </Pressable>
      )}

      <TextoError texto={error} />
      <Boton onPress={guardar}>{editando ? 'Guardar cambios' : 'Guardar'}</Boton>
      {editando && (inicial?.recurrencia_id
        ? <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton tipo="peligro" onPress={() => borrar(false)} style={{ flex: 1 }}>Borrar esta</Boton>
            <Boton tipo="peligro" onPress={() => borrar(true)} style={{ flex: 1 }}>Y las siguientes</Boton>
          </View>
        : <Boton tipo="peligro" onPress={() => borrar(false)}>Borrar</Boton>)}
    </Hoja>
  );
}
