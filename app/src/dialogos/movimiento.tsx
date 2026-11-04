import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { deudaTarjeta, pagoSugerido } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aCentavos, aFecha, aTexto, DIAS, horaTexto, MESES_CORTOS, neto, nuevoId } from '@/lib/formato';
import { FRECUENCIAS, type Frecuencia, type Movimiento, type Pendiente, type Recurrencia, type TipoMovimiento } from '@/lib/tipos';
import { avisar } from '@/ui/aviso';
import { BotonPrincipal, Campo, Ficha, Hoja, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { Tocable } from '@/ui/tocable';
import { useTema } from '@/ui/tema';
import { abrirHoja, anunciarBorrado, anunciarNuevo, BAJA_LA_HOJA } from '@/ui/vivo';
import { Desplegable, ElegirCategoria, ElegirCuenta, ElegirFecha } from './piezas';

const TIPOS: [TipoMovimiento, string][] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferencia']];
/** Con una tarjeta de crédito: comprar con ella, pagarla desde una cuenta normal o sacar dinero de ella a una cuenta. */
type Accion = 'compra' | 'pago' | 'sacar';
const ACCIONES: [Accion, string][] = [['compra', 'Compra'], ['pago', 'Pago'], ['sacar', 'Sacar dinero']];
type Repetir = 'no' | Frecuencia;
const REPETIR: [Repetir, string][] = [['no', 'No'], ...FRECUENCIAS];

/** Anotar o editar un gasto, ingreso o transferencia. Al anotar, se puede volver una regla que se repite. */
export function DialogoMovimiento({ inicial, tipoInicial = 'gasto', fechaInicial, cuentaInicial, destinoInicial, montoInicial, notaInicial, pendiente, alCerrar, alEditarRegla }: {
  inicial?: Movimiento; tipoInicial?: TipoMovimiento; fechaInicial?: string; cuentaInicial?: string;
  /** Para el pago sugerido de una tarjeta: la transferencia ya armada, que el usuario confirma. */
  destinoInicial?: string; montoInicial?: number; notaInicial?: string;
  /** Un aviso del banco por revisar: la hoja sale prellenada y al guardar se cierra el aviso. */
  pendiente?: Pendiente;
  alCerrar: () => void; alEditarRegla: (r: Recurrencia) => void;
}) {
  const datos = useDatos();
  const { cuentas, categorias, moneda, hoy, recurrencias } = datos;
  const { c } = useTema();
  const acciones = useAcciones();
  const editando = !!inicial;
  const primeraDe = (t: TipoMovimiento) => categorias.find((x) => x.tipo === t)?.id ?? '';
  const tipoPendiente = pendiente?.tipo ?? tipoInicial;
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? tipoPendiente);
  const [monto, setMonto] = useState(inicial ? aTexto(inicial.monto) : pendiente?.monto ? aTexto(pendiente.monto) : montoInicial ? aTexto(montoInicial) : '');
  const [cuenta, setCuenta] = useState(inicial?.cuenta_id ?? (cuentas.some((x) => x.id === pendiente?.cuenta_id) ? pendiente!.cuenta_id! : cuentas.some((x) => x.id === cuentaInicial) ? cuentaInicial! : cuentas[0]?.id ?? ''));
  const [destino, setDestino] = useState(inicial?.cuenta_destino_id ?? (cuentas.some((x) => x.id === destinoInicial) ? destinoInicial! : cuentas.find((x) => x.id !== cuenta)?.id ?? ''));
  const [categoria, setCategoria] = useState(inicial?.categoria_id
    ?? (categorias.some((x) => x.id === pendiente?.categoria_id && x.tipo === tipoPendiente) ? pendiente!.categoria_id! : primeraDe(inicial?.tipo ?? tipoPendiente)));
  const [nota, setNota] = useState(inicial?.nota ?? (pendiente ? pendiente.comercio || pendiente.asunto : notaInicial) ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? pendiente?.fecha ?? fechaInicial ?? hoy);
  // Lo nuevo sale con la hora en que se anota (se cambia o se quita con la ✕); lo editado conserva la suya
  // y un aviso del banco trae la de la operación.
  const [hora, setHora] = useState(() => inicial ? inicial.hora ?? '' : pendiente ? pendiente.hora ?? '' : horaTexto(new Date()));
  const [repetir, setRepetir] = useState<Repetir>('no');
  const [verRepetir, setVerRepetir] = useState(false);
  const [error, setError] = useState('');
  const regla = inicial?.recurrencia_id ? recurrencias.find((r) => r.id === inicial.recurrencia_id) : undefined;
  // Mientras la hoja está abierta (y un rato después), las listas de atrás acomodan sus filas con resorte.
  useEffect(() => abrirHoja(), []);

  // La hoja tiene dos formas y siempre sale de las cuentas elegidas (así cambiar de pestaña no la pierde):
  // - Normal (Gasto · Ingreso · Transferencia), con cuentas normales.
  // - Tarjeta (Compra · Pago · Sacar dinero), cuando la cuenta es una tarjeta de crédito o la transferencia va hacia
  //   una. Compra = gasto en la tarjeta; Pago = de una cuenta normal hacia la tarjeta; Sacar dinero = de la tarjeta a
  //   una cuenta (Kash a tu cuenta, avance de efectivo). A una tarjeta no le entra «ingreso»: lo que entra es un pago.
  const esCredito = (id: string) => !!cuentas.find((x) => x.id === id)?.es_credito;
  const normales = cuentas.filter((x) => !x.es_credito);
  const enTarjeta = esCredito(cuenta);
  const haciaTarjeta = tipo === 'transferencia' && !enTarjeta && esCredito(destino);
  const modoTarjeta = enTarjeta || haciaTarjeta;
  const tarjetaId = enTarjeta ? cuenta : haciaTarjeta ? destino : '';
  const accion: Accion | null = !modoTarjeta ? null : haciaTarjeta ? 'pago' : tipo === 'gasto' ? 'compra' : tipo === 'transferencia' ? 'sacar' : null;
  /** La cuenta normal desde la que se paga o hacia la que se saca: la que ya estaba, si es normal; si no, la primera. */
  const unaNormal = (aparte: string, preferida?: string) =>
    normales.find((x) => x.id === preferida && x.id !== aparte)?.id ?? normales.find((x) => x.id !== aparte)?.id ?? '';
  const ponerCategoria = (t: TipoMovimiento) => {
    if (t !== 'transferencia' && categorias.find((x) => x.id === categoria)?.tipo !== t) setCategoria(primeraDe(t));
  };
  const notaDePago = (tarjeta: string) => {
    if (!nota.trim() || nota.startsWith('Pago de ')) setNota(`Pago de ${cuentas.find((x) => x.id === tarjeta)?.nombre ?? ''}`);
  };

  /** Pasa la hoja a una acción de la tarjeta `tarjeta`. */
  function hacer(a: Accion, tarjeta: string) {
    setError('');
    if (a === 'compra') {
      setTipo('gasto');
      setCuenta(tarjeta);
      ponerCategoria('gasto');
    } else if (a === 'pago') {
      const desde = unaNormal(tarjeta, enTarjeta ? destino : cuenta);
      if (!desde) return setError('Para pagar la tarjeta necesitas una cuenta que no sea de crédito');
      setTipo('transferencia');
      setCuenta(desde);
      setDestino(tarjeta);
      notaDePago(tarjeta);
    } else {
      setTipo('transferencia');
      setCuenta(tarjeta);
      setDestino(unaNormal(tarjeta, haciaTarjeta ? cuenta : destino) || cuentas.find((x) => x.id !== tarjeta)?.id || '');
      if (nota.startsWith('Pago de ')) setNota('');
    }
  }

  function cambiarTipo(t: TipoMovimiento) {
    setError('');
    setTipo(t);
    ponerCategoria(t);
    if (t === 'transferencia' && (!destino || destino === cuenta)) setDestino(cuentas.find((x) => x.id !== cuenta)?.id ?? '');
  }

  /** Forma normal: elegir una tarjeta como cuenta pasa a la forma de tarjeta, con la acción que corresponde. */
  function elegirCuenta(id: string) {
    setError('');
    if (!esCredito(id)) {
      setCuenta(id);
      if (tipo === 'transferencia' && destino === id) setDestino(cuentas.find((x) => x.id !== id)?.id ?? '');
      return;
    }
    hacer(tipo === 'gasto' ? 'compra' : tipo === 'ingreso' ? 'pago' : 'sacar', id);
  }

  /** Forma de tarjeta: cambiar de tarjeta, o elegir una cuenta normal y volver a la forma normal. */
  function elegirTarjeta(id: string) {
    setError('');
    if (esCredito(id)) return hacer(accion ?? 'compra', id);
    // Con una cuenta normal: la compra sigue como gasto, el pago como ingreso y sacar dinero como transferencia.
    if (accion === 'pago') {
      setTipo('ingreso');
      ponerCategoria('ingreso');
      if (nota.startsWith('Pago de ')) setNota('');
    } else if (accion === 'sacar' && normales.some((x) => x.id !== id)) {
      // Una transferencia normal: hacia otra cuenta normal (hacia una tarjeta sería un pago).
      setTipo('transferencia');
      setDestino(unaNormal(id, destino));
    } else {
      setTipo('gasto');
    }
    setCuenta(id);
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
      if (fecha <= hoy) {
        const m: Movimiento = { ...comun, id: `${id}@${fecha}`, fecha, hora: null, recurrencia_id: id, origen: 'recurrencia' };
        anunciarNuevo(m);
        acciones.guardarMovimiento(m);
      }
    } else {
      const m: Movimiento = { ...comun, id: inicial?.id ?? nuevoId(), fecha, hora: hora || null,
        recurrencia_id: inicial?.recurrencia_id ?? null, origen: inicial?.origen ?? (pendiente ? 'correo' : 'manual') };
      // Lo nuevo vuela desde el + hasta su fila; lo editado se queda donde está.
      if (!editando) anunciarNuevo(m);
      if (pendiente) acciones.aceptarPendiente(pendiente, m);
      else acciones.guardarMovimiento(m);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alCerrar();
  }

  function borrar() {
    if (!inicial) return;
    const hacer = (ySiguientes: boolean) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Se borra cuando la hoja ya bajó, para que se vea la fila desvanecerse y cerrarse el hueco.
      anunciarBorrado(inicial.id);
      alCerrar();
      setTimeout(() => acciones.borrarMovimiento(inicial, ySiguientes), BAJA_LA_HOJA);
    };
    if (inicial.recurrencia_id) {
      avisar('¿Borrar este movimiento?', 'Viene de algo que se repite.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Solo este', style: 'destructive', onPress: () => hacer(false) },
        { text: 'Este y los siguientes', style: 'destructive', onPress: () => hacer(true) },
      ]);
    } else {
      avisar('¿Borrar este movimiento?', undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => hacer(false) }]);
    }
  }

  // Pagar una tarjeta de crédito: fichas con el total, lo del corte y el mínimo (descontando lo ya pagado).
  const tarjetaDestino = tipo === 'transferencia' ? cuentas.find((x) => x.id === destino && x.es_credito) : undefined;
  const deudaDestino = tarjetaDestino ? deudaTarjeta(datos, tarjetaDestino) : 0;
  const sugerido = tarjetaDestino ? pagoSugerido(datos, tarjetaDestino) : null;
  const opcionesPago: [string, number][] = !tarjetaDestino || editando || deudaDestino <= 0 ? [] : [
    ['Total', deudaDestino] as [string, number],
    ...(sugerido && sugerido.delCorte !== deudaDestino ? [['Lo del corte', sugerido.delCorte] as [string, number]] : []),
    ...(sugerido?.minimo ? [['Mínimo', sugerido.minimo] as [string, number]] : []),
  ];
  const elegido = aCentavos(monto);
  function elegirPago(centavos: number | null) {
    Haptics.selectionAsync();
    setMonto(centavos === null ? '' : aTexto(centavos));
    setError('');
    if (!nota.trim() && tarjetaDestino) setNota(`Pago de ${tarjetaDestino.nombre}`);
  }
  // Un gasto que dice «pago … tarjeta» casi siempre es el pago de la tarjeta: va como transferencia, no como gasto.
  const pareceTarjeta = (() => {
    if (tipo !== 'gasto' || editando || pendiente) return undefined;
    const t = nota.toLowerCase();
    if (!/(pago|pagu[eé]|abono)/.test(t)) return undefined;
    const credito = cuentas.filter((x) => x.es_credito);
    return credito.find((x) => t.includes(x.nombre.toLowerCase()))
      ?? (/(tarjeta|visa|master|cr[eé]dito)/.test(t) ? credito[0] : undefined);
  })();
  function comoPagoDeTarjeta() {
    if (!pareceTarjeta) return;
    Haptics.selectionAsync();
    hacer('pago', pareceTarjeta.id);
  }
  const destinoInicialTarjeta = cuentas.some((x) => x.id === destinoInicial && x.es_credito);

  // Si no es hoy, el botón dice qué día se va a guardar: «Guardar el martes 14».
  const d = aFecha(fecha);
  const textoGuardar = editando ? 'Guardar cambios' : fecha === hoy ? 'Guardar' : `Guardar el ${DIAS[d.getDay()]} ${d.getDate()}`;
  const textoRepetir = REPETIR.find(([r]) => r === repetir)?.[1] ?? 'No';

  return (
    <Hoja titulo={editando ? 'Editar' : pendiente ? 'Por revisar' : 'Anotar'} alCerrar={alCerrar}
      derecha={editando ? <Pressable onPress={borrar} hitSlop={10}><Texto tam={17} color={c.alerta}>Borrar</Texto></Pressable> : undefined}
      pie={<><TextoError texto={error} /><BotonPrincipal onPress={guardar}>{textoGuardar}</BotonPrincipal></>}>
      {modoTarjeta
        ? <Segmentos<Accion | ''> opciones={ACCIONES} valor={accion ?? ''} alCambiar={(a) => a && hacer(a, tarjetaId)} />
        : <Segmentos opciones={TIPOS} valor={tipo} alCambiar={cambiarTipo} />}

      {opcionesPago.length > 0 && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {opcionesPago.map(([t, v]) => (
              <Ficha key={t} texto={`${t} ${neto(v, moneda)}`} activa={elegido === v} alto={36} onPress={() => elegirPago(v)} />
            ))}
            <Ficha texto="Otro monto" activa={!opcionesPago.some(([, v]) => v === elegido)} alto={36} onPress={() => elegirPago(null)} />
          </View>
          {sugerido?.fecha && (
            <Texto tam={13} color={c.tenue}>
              Pagar lo del corte antes del {Number(sugerido.fecha.slice(8, 10))} {MESES_CORTOS[Number(sugerido.fecha.slice(5, 7)) - 1]} evita los intereses.
            </Texto>
          )}
        </View>
      )}

      <View style={{ alignItems: 'stretch' }}>
        <MontoGrande valor={monto} alCambiar={(v) => { setMonto(v); setError(''); }} moneda={moneda} autoFocus={!editando && !montoInicial && !pendiente && !destinoInicialTarjeta} />
        <Campo value={nota} onChangeText={setNota} placeholder="¿De qué se trata?" accessibilityLabel="Descripción" returnKeyType="done"
          style={{ height: 40, backgroundColor: 'transparent', textAlign: 'center' }} />
      </View>

      {pareceTarjeta && (
        <Tocable onPress={comoPagoDeTarjeta} accessibilityLabel={`Anotarlo como pago de ${pareceTarjeta.nombre}`}
          style={{ borderRadius: 14, backgroundColor: c.suave, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icono nombre="transferir" tam={18} color={c.tinta} />
          <Texto tam={13} style={{ flex: 1 }}>¿Es el pago de {pareceTarjeta.nombre}? Anótalo como pago de la tarjeta, así no cuenta como gasto dos veces.</Texto>
        </Tocable>
      )}

      <ElegirFecha fecha={fecha} alCambiar={setFecha} rotulo={repetir === 'no' ? 'Fecha' : 'Primera vez'}
        hora={repetir === 'no' ? hora : undefined} alCambiarHora={repetir === 'no' ? setHora : undefined} />

      {tipo !== 'transferencia' && <ElegirCategoria tipo={tipo} valor={categoria} alCambiar={setCategoria} fecha={fecha} />}

      {modoTarjeta ? (
        <>
          <ElegirCuenta rotulo="Tarjeta" valor={tarjetaId} alCambiar={elegirTarjeta} />
          {accion === 'pago' && <ElegirCuenta rotulo="Pagas desde" valor={cuenta} alCambiar={setCuenta} solo={(x) => !x.es_credito} />}
          {accion === 'sacar' && <ElegirCuenta rotulo="Hacia" valor={destino} alCambiar={setDestino} solo={(x) => x.id !== tarjetaId} />}
          {accion === 'sacar' && (
            <Texto tam={13} color={c.tenue}>Sacar dinero de la tarjeta suele llevar comisión del banco: anótala aparte como compra.</Texto>
          )}
          {accion === null && (
            <Texto tam={13} color={c.tenue}>Está anotado como ingreso en la tarjeta: cuenta como pago. Elige arriba qué fue.</Texto>
          )}
        </>
      ) : (
        <>
          <ElegirCuenta rotulo={tipo === 'transferencia' ? 'Desde' : 'Cuenta'} valor={cuenta} alCambiar={elegirCuenta} />
          {tipo === 'transferencia' && <ElegirCuenta rotulo="Hacia" valor={destino} alCambiar={setDestino} solo={(x) => x.id !== cuenta} />}
        </>
      )}

      {!editando && !pendiente && (
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
        <Tocable onPress={() => alEditarRegla(regla)}
          style={{ height: 50, borderRadius: 14, backgroundColor: c.suave, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
          <Icono nombre="repetir" tam={18} color={c.tinta} />
          <Texto tam={15} style={{ flex: 1 }}>Se repite</Texto>
          <Texto tam={15} color={c.tenue}>{FRECUENCIAS.find(([f]) => f === regla.frecuencia)?.[1]}</Texto>
          <Icono nombre="adelante" tam={16} color={c.tenue} grosor={2} />
        </Tocable>
      )}
    </Hoja>
  );
}
