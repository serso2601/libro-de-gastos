import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aFecha, aTexto, DIAS, nuevoId } from '@/lib/formato';
import { FRECUENCIAS, type Frecuencia, type Movimiento, type Recurrencia, type TipoMovimiento } from '@/lib/tipos';
import { BotonPrincipal, familia, Ficha, Hoja, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { useTema } from '@/ui/tema';
import { Desplegable, ElegirCategoria, ElegirCuenta, ElegirFecha } from './piezas';

const TIPOS: [TipoMovimiento, string][] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];
type Repetir = 'no' | Frecuencia;
const REPETIR: [Repetir, string][] = [['no', 'No'], ...FRECUENCIAS];

/** Anotar o editar un gasto, ingreso o transferencia. Al anotar, se puede volver una regla que se repite. */
export function DialogoMovimiento({ inicial, tipoInicial = 'gasto', fechaInicial, cuentaInicial, alCerrar, alEditarRegla }: {
  inicial?: Movimiento; tipoInicial?: TipoMovimiento; fechaInicial?: string; cuentaInicial?: string;
  alCerrar: () => void; alEditarRegla: (r: Recurrencia) => void;
}) {
  const { cuentas, categorias, moneda, hoy, recurrencias } = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const editando = !!inicial;
  const primeraDe = (t: TipoMovimiento) => categorias.find((x) => x.tipo === t)?.id ?? '';
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? tipoInicial);
  const [monto, setMonto] = useState(inicial ? aTexto(inicial.monto) : '');
  const [cuenta, setCuenta] = useState(inicial?.cuenta_id ?? (cuentas.some((x) => x.id === cuentaInicial) ? cuentaInicial! : cuentas[0]?.id ?? ''));
  const [destino, setDestino] = useState(inicial?.cuenta_destino_id ?? cuentas.find((x) => x.id !== cuenta)?.id ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria_id ?? primeraDe(inicial?.tipo ?? tipoInicial));
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? fechaInicial ?? hoy);
  const [hora, setHora] = useState(inicial?.hora ?? '');
  const [repetir, setRepetir] = useState<Repetir>('no');
  const [verRepetir, setVerRepetir] = useState(false);
  const [error, setError] = useState('');
  const regla = inicial?.recurrencia_id ? recurrencias.find((r) => r.id === inicial.recurrencia_id) : undefined;

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    setError('');
    if (t !== 'transferencia' && categorias.find((x) => x.id === categoria)?.tipo !== t) setCategoria(primeraDe(t));
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

  function borrar() {
    if (!inicial) return;
    const hacer = (ySiguientes: boolean) => {
      acciones.borrarMovimiento(inicial, ySiguientes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      alCerrar();
    };
    if (inicial.recurrencia_id) {
      Alert.alert('¿Borrar este movimiento?', 'Viene de algo que se repite.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Solo este', style: 'destructive', onPress: () => hacer(false) },
        { text: 'Este y los siguientes', style: 'destructive', onPress: () => hacer(true) },
      ]);
    } else {
      Alert.alert('¿Borrar este movimiento?', undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => hacer(false) }]);
    }
  }

  // Si no es hoy, el botón dice qué día se va a guardar: «Guardar el martes 14».
  const d = aFecha(fecha);
  const textoGuardar = editando ? 'Guardar cambios' : fecha === hoy ? 'Guardar' : `Guardar el ${DIAS[d.getDay()]} ${d.getDate()}`;
  const textoRepetir = REPETIR.find(([r]) => r === repetir)?.[1] ?? 'No';

  return (
    <Hoja titulo={editando ? 'Editar' : 'Anotar'} alCerrar={alCerrar}
      derecha={editando ? <Pressable onPress={borrar} hitSlop={10}><Texto tam={17} color={c.alerta}>Borrar</Texto></Pressable> : undefined}
      pie={<><TextoError texto={error} /><BotonPrincipal onPress={guardar}>{textoGuardar}</BotonPrincipal></>}>
      <Segmentos opciones={TIPOS} valor={tipo} alCambiar={cambiarTipo} />

      <View style={{ alignItems: 'stretch' }}>
        <MontoGrande valor={monto} alCambiar={(v) => { setMonto(v); setError(''); }} moneda={moneda} autoFocus={!editando} />
        <TextInput value={nota} onChangeText={setNota} placeholder="¿De qué se trata?" placeholderTextColor={c.tenue} accessibilityLabel="Descripción"
          style={{ textAlign: 'center', fontSize: 16, height: 36, paddingVertical: 0, color: c.tinta, fontFamily: familia('normal') }} returnKeyType="done" />
      </View>

      <ElegirFecha fecha={fecha} alCambiar={setFecha} rotulo={repetir === 'no' ? 'Fecha' : 'Primera vez'}
        hora={repetir === 'no' ? hora : undefined} alCambiarHora={repetir === 'no' ? setHora : undefined} />

      {tipo !== 'transferencia' && <ElegirCategoria tipo={tipo} valor={categoria} alCambiar={setCategoria} fecha={fecha} />}

      <ElegirCuenta rotulo={tipo === 'transferencia' ? 'Desde' : 'Cuenta'} valor={cuenta} alCambiar={setCuenta} />
      {tipo === 'transferencia' && <ElegirCuenta rotulo="Hacia" valor={destino} alCambiar={setDestino} />}

      {!editando && (
        <View style={{ backgroundColor: c.suave, borderRadius: 14 }}>
          <Desplegable icono="repetir" texto="Se repite" valor={textoRepetir} abierto={verRepetir} alTocar={() => setVerRepetir((v) => !v)}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {REPETIR.map(([r, t]) => (
                <Ficha key={r} texto={t} activa={r === repetir} alto={36}
                  onPress={() => { setRepetir(r); if (r === 'no') setVerRepetir(false); }} />
              ))}
            </View>
            {repetir !== 'no' && (
              <Texto tam={13} color={c.tenue} style={{ marginTop: 10, lineHeight: 18 }}>
                Se anota solo cada vez que llega la fecha, sin crear nada por adelantado. Lo que falta del mes sale arriba en Movimientos.
              </Texto>
            )}
          </Desplegable>
        </View>
      )}

      {regla && (
        <Pressable onPress={() => alEditarRegla(regla)}
          style={({ pressed }) => ({ height: 50, borderRadius: 14, backgroundColor: c.suave, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}>
          <Icono nombre="repetir" tam={18} color={c.tinta} />
          <Texto tam={15} style={{ flex: 1 }}>Se repite</Texto>
          <Texto tam={15} color={c.tenue}>{FRECUENCIAS.find(([f]) => f === regla.frecuencia)?.[1]}</Texto>
          <Icono nombre="adelante" tam={16} color={c.tenue} grosor={2} />
        </Pressable>
      )}
    </Hoja>
  );
}
