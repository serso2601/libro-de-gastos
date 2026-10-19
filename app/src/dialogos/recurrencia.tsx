import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { proximasVeces } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aCentavos, aFecha, aTexto, DIAS, diaCorto, fechaISO, MESES, MESES_CORTOS } from '@/lib/formato';
import { FRECUENCIAS, type Frecuencia, type Recurrencia } from '@/lib/tipos';
import { BotonPrincipal, Etiqueta, familia, Ficha, Hoja, MontoGrande, Texto, TextoError } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { useTema } from '@/ui/tema';
import { Desplegable, ElegirCategoria, ElegirCuenta, Grilla } from './piezas';

const CORTAS: Record<Frecuencia, string> = { semanal: 'Semana', catorcenal: '2 semanas', quincenal: 'Quincena', mensual: 'Mes', anual: 'Año' };

function cuando(f: Frecuencia, inicio: string): string {
  const d = aFecha(inicio);
  if (f === 'semanal') return `cada ${DIAS[d.getDay()]}`;
  if (f === 'catorcenal') return `cada 2 semanas, los ${DIAS[d.getDay()]}`;
  if (f === 'quincenal') {
    const otro = d.getDate() <= 15 ? d.getDate() + 15 : d.getDate() - 15;
    const [a, b] = [d.getDate(), otro].sort((x, y) => x - y);
    return `dos veces al mes, el ${a} y el ${b}`;
  }
  if (f === 'mensual') return `cada mes, el día ${d.getDate()}`;
  return `cada año, el ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const fechaLarga = (iso: string) => { const d = aFecha(iso); return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`; };

/** Editar una regla que se repite. Lo que cambie vale para lo que viene; lo ya anotado no se toca. */
export function DialogoRecurrencia({ regla, alCerrar }: { regla: Recurrencia; alCerrar: () => void }) {
  const { cuentas, categorias, moneda, hoy } = useDatos();
  const { c, oscuro } = useTema();
  const acciones = useAcciones();
  const [monto, setMonto] = useState(aTexto(regla.monto));
  const [cuenta, setCuenta] = useState(regla.cuenta_id);
  const [destino, setDestino] = useState(regla.cuenta_destino_id ?? '');
  const [categoria, setCategoria] = useState(regla.categoria_id ?? '');
  const [nota, setNota] = useState(regla.nota);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(regla.frecuencia);
  const [fin, setFin] = useState(regla.fecha_fin ?? '');
  const [abierto, setAbierto] = useState<'cuenta' | 'destino' | 'categoria' | 'fin' | null>(null);
  const [error, setError] = useState('');
  const transferencia = regla.tipo === 'transferencia';
  const nombreCuenta = (id: string) => cuentas.find((x) => x.id === id)?.nombre ?? 'Elegir';
  const veces = proximasVeces({ ...regla, frecuencia, fecha_fin: fin || null }, hoy);
  const alternar = (q: typeof abierto) => setAbierto((a) => (a === q ? null : q));

  function guardar() {
    const centavos = aCentavos(monto);
    if (!(centavos > 0)) return setError('Escribe un monto válido');
    if (fin && fin < regla.fecha_inicio) return setError('El fin no puede ser antes del inicio');
    if (transferencia && (!destino || destino === cuenta)) return setError('Elige dos cuentas distintas');
    acciones.guardarRecurrencia({
      ...regla, monto: centavos, cuenta_id: cuenta, nota: nota.trim(), frecuencia, fecha_fin: fin || null,
      cuenta_destino_id: transferencia ? destino : null,
      categoria_id: transferencia ? null : categoria,
    });
    alCerrar();
  }

  function dejar() {
    Alert.alert('¿Dejar de repetir?', 'Lo que ya se anotó se queda. No se anota nada más de aquí en adelante.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Dejar de repetir', style: 'destructive', onPress: () => { acciones.borrarRecurrencia(regla); alCerrar(); } },
    ]);
  }

  return (
    <Hoja titulo="Se repite" alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>Guardar</BotonPrincipal>
          <Pressable onPress={dejar} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Texto tam={15} peso="semi" color={c.alerta}>Dejar de repetir</Texto>
          </Pressable>
        </>
      )}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        Esto se anota solo {cuando(frecuencia, regla.fecha_inicio)}. Si cambias algo, vale para las que vienen; las que ya se anotaron quedan como están.
      </Texto>

      <View>
        <MontoGrande valor={monto} alCambiar={setMonto} moneda={moneda} />
        <TextInput value={nota} onChangeText={setNota} placeholder="Descripción" placeholderTextColor={c.tenue} accessibilityLabel="Descripción"
          style={{ textAlign: 'center', fontSize: 16, height: 36, paddingVertical: 0, color: c.tinta, fontFamily: familia('normal') }} />
      </View>

      <View style={{ gap: 8 }}>
        <Etiqueta>Se repite</Etiqueta>
        <Grilla columnas={3} gap={6}>
          {FRECUENCIAS.map(([f]) => <Ficha key={f} texto={CORTAS[f]} activa={f === frecuencia} onPress={() => setFrecuencia(f)} alto={40} compacta />)}
        </Grilla>
      </View>

      <View style={{ backgroundColor: c.suave, borderRadius: 14 }}>
        <Desplegable texto={transferencia ? 'Desde' : 'Cuenta'} valor={nombreCuenta(cuenta)} abierto={abierto === 'cuenta'} alTocar={() => alternar('cuenta')}>
          <ElegirCuenta valor={cuenta} alCambiar={(id) => { setCuenta(id); setAbierto(null); }} />
        </Desplegable>
        {transferencia ? (
          <Desplegable primera={false} texto="Hacia" valor={nombreCuenta(destino)} abierto={abierto === 'destino'} alTocar={() => alternar('destino')}>
            <ElegirCuenta valor={destino} alCambiar={(id) => { setDestino(id); setAbierto(null); }} />
          </Desplegable>
        ) : (
          <Desplegable primera={false} texto="Categoría" valor={categorias.find((x) => x.id === categoria)?.nombre ?? 'Elegir'} abierto={abierto === 'categoria'} alTocar={() => alternar('categoria')}>
            <ElegirCategoria tipo={regla.tipo === 'ingreso' ? 'ingreso' : 'gasto'} valor={categoria} alCambiar={(id) => { setCategoria(id); setAbierto(null); }} fecha={hoy} rotulo={false} />
          </Desplegable>
        )}
        <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: c.tarjeta }}>
          <Texto tam={15} style={{ flex: 1 }}>Empieza</Texto>
          <Texto tam={15} color={c.tenue}>{fechaLarga(regla.fecha_inicio)}</Texto>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: c.tarjeta }}>
          <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
            <Texto tam={15} style={{ flex: 1 }}>Termina</Texto>
            <Pressable onPress={() => fin && alternar('fin')} disabled={!fin}>
              <Texto tam={15} color={c.tenue}>{fin ? fechaLarga(fin) : 'Nunca'}</Texto>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => {
              if (fin) { setFin(''); setAbierto(null); } else {
                const d = aFecha(veces[veces.length - 1] ?? hoy);
                setFin(fechaISO(d));
                setAbierto('fin');
              }
            }}>
              <Texto tam={13} peso="semi" color={c.acento}>{fin ? 'Quitar' : 'Poner fecha'}</Texto>
            </Pressable>
          </View>
          {abierto === 'fin' && fin ? (
            <DateTimePicker value={aFecha(fin)} mode="date" display="inline" locale="es-PA" accentColor={c.acento} themeVariant={oscuro ? 'dark' : 'light'}
              minimumDate={aFecha(regla.fecha_inicio)} onChange={(_, d) => d && setFin(fechaISO(d))} />
          ) : null}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Etiqueta>Las próximas veces</Etiqueta>
        {veces.length === 0
          ? <Texto tam={14} color={c.tenue}>Ya no se va a anotar más: la fecha de fin ya pasó.</Texto>
          : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {veces.map((f) => (
                <View key={f} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.linea, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icono nombre="reloj" tam={14} color={c.tenue} />
                  <Texto tam={13}>{diaCorto(f)} {MESES_CORTOS[aFecha(f).getMonth()]}</Texto>
                </View>
              ))}
            </View>
          )}
      </View>
    </Hoja>
  );
}
