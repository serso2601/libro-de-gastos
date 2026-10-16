import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, etiquetaCorta } from '@/lib/formato';
import { FRECUENCIAS, type Frecuencia, type Recurrencia } from '@/lib/tipos';
import { Boton, Campo, CampoFecha, CampoMonto, Etiqueta, Fichas, Hoja, Selector, Texto, TextoError } from '@/ui/componentes';
import { C } from '@/ui/tema';
import { ElegirCategoria } from './categorias';

/** Editar una regla que se repite. Lo que cambie vale para lo que viene; lo ya anotado no se toca. */
export function DialogoRecurrencia({ regla, alCerrar }: { regla: Recurrencia; alCerrar: () => void }) {
  const { cuentas, moneda } = useDatos();
  const acciones = useAcciones();
  const [monto, setMonto] = useState(aTexto(regla.monto));
  const [cuenta, setCuenta] = useState(regla.cuenta_id);
  const [destino, setDestino] = useState(regla.cuenta_destino_id ?? '');
  const [categoria, setCategoria] = useState(regla.categoria_id ?? '');
  const [nota, setNota] = useState(regla.nota);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(regla.frecuencia);
  const [fin, setFin] = useState(regla.fecha_fin ?? '');
  const [error, setError] = useState('');

  function guardar() {
    const centavos = aCentavos(monto);
    if (!(centavos > 0)) return setError('Escribe un monto válido');
    if (fin && fin < regla.fecha_inicio) return setError('El fin no puede ser antes del inicio');
    acciones.guardarRecurrencia({
      ...regla, monto: centavos, cuenta_id: cuenta, nota: nota.trim(), frecuencia, fecha_fin: fin || null,
      cuenta_destino_id: regla.tipo === 'transferencia' ? destino : null,
      categoria_id: regla.tipo === 'transferencia' ? null : categoria,
    });
    alCerrar();
  }

  return (
    <Hoja titulo="Se repite" alCerrar={alCerrar}>
      <Texto tam={13} color={C.tenue} style={{ marginBottom: 16 }}>
        Empezó el {etiquetaCorta(regla.fecha_inicio)}. Lo que cambies vale para lo que viene; lo ya anotado se queda como está.
      </Texto>
      <Etiqueta>Monto</Etiqueta>
      <CampoMonto valor={monto} alCambiar={setMonto} moneda={moneda} />
      <Etiqueta>{regla.tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</Etiqueta>
      <Fichas opciones={cuentas} valor={cuenta} alCambiar={setCuenta} />
      {regla.tipo === 'transferencia'
        ? <><Etiqueta>Hacia</Etiqueta><Fichas opciones={cuentas} valor={destino} alCambiar={setDestino} /></>
        : <ElegirCategoria tipo={regla.tipo} valor={categoria} alCambiar={setCategoria} />}
      <Etiqueta>Descripción</Etiqueta>
      <Campo value={nota} onChangeText={setNota} />
      <Etiqueta>Frecuencia</Etiqueta>
      <Selector<Frecuencia> opciones={FRECUENCIAS.map(([f, t]) => [f, t.replace('Cada ', '')])} valor={frecuencia} alCambiar={setFrecuencia} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Texto color={C.tenue}>Termina</Texto>
        {fin
          ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CampoFecha valor={fin} alCambiar={setFin} />
              <Pressable onPress={() => setFin('')} hitSlop={8} style={{ paddingLeft: 8 }}><Texto color={C.tenue}>✕</Texto></Pressable>
            </View>
          : <Pressable onPress={() => setFin(regla.fecha_inicio)}><Texto tam={13} color={C.acentoClaro}>Nunca · poner fecha</Texto></Pressable>}
      </View>
      <TextoError texto={error} />
      <Boton onPress={guardar}>Guardar</Boton>
      <Boton tipo="peligro" onPress={() => { acciones.borrarRecurrencia(regla); alCerrar(); }}>Dejar de repetir</Boton>
    </Hoja>
  );
}
