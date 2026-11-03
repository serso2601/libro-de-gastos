// La hoja de una cuenta: crearla, editarla o borrarla. Una cuenta puede ser tarjeta de crédito (día de
// corte; día de pago, límite y mínimo si el usuario quiere): su saldo es deuda y la pantalla de la cuenta lo
// muestra así. Si la tarjeta es una del catálogo con sus reglas, el mínimo y la fecha de pago los calcula la app.

import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, MESES_CORTOS, nuevoId } from '@/lib/formato';
import { versionVigente } from '@/lib/banco';
import { cicloTarjeta, reglasPropias } from '@/lib/calculos';
import type { Cuenta, ReglasPropias, VinculoBanco } from '@/lib/tipos';
import { avisar } from '@/ui/aviso';
import { BotonBorrar, BotonPrincipal, Campo, CampoMonto, Colores, Etiqueta, Ficha, Hoja, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { disenoConColor, ElegirTarjetaBanco, TarjetaMedida } from '@/ui/tarjetaBanco';
import { useTema } from '@/ui/tema';

const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;

/** Un número escrito («4,5» o «4.5») o null si está vacío; NaN si no es número. */
function leerNumero(t: string): number | null {
  const x = t.trim().replace(',', '.');
  return x === '' ? null : Number(x);
}
const numTexto = (x: number | null | undefined) => (x == null ? '' : String(x));
const OTRO = 'otro';

/** Un campo de las reglas con su rótulo y, debajo, lo que significa (callado). */
function CampoRegla({ rotulo, children, ayuda }: { rotulo: string; children: ReactNode; ayuda?: string }) {
  const { c } = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Etiqueta>{rotulo}</Etiqueta>
      {children}
      {ayuda ? <Texto tam={12} color={c.tenue}>{ayuda}</Texto> : null}
    </View>
  );
}

/** Dos campos lado a lado, cada uno con su rótulo chico arriba (se lee aunque el campo ya tenga valor). */
function DosCampos({ izquierda, derecha }: { izquierda: [string, ReactNode]; derecha: [string, ReactNode] }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[izquierda, derecha].map(([r, campo]) => (
        <View key={r} style={{ flex: 1, gap: 4 }}>
          <Texto tam={12} color={c.tenue}>{r}</Texto>
          {campo}
        </View>
      ))}
    </View>
  );
}

/** Una fila de lo que dice el banco de la tarjeta: el rótulo a la izquierda, el dato a la derecha. */
function FilaRegla({ rotulo, valor, primera }: { rotulo: string; valor: string; primera?: boolean }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 36,
      borderTopWidth: primera ? 0 : 1, borderTopColor: c.linea }}>
      <Texto tam={14} color={c.tenue} style={{ flex: 1 }}>{rotulo}</Texto>
      <Texto num tam={15} peso="medio">{valor}</Texto>
    </View>
  );
}

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
  const { cuentas, movimientos, recurrencias, moneda, catalogo, hoy, cuenta_yappy } = useDatos();
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
  const [limite, setLimite] = useState(inicial?.limite ? aTexto(inicial.limite) : '');
  // Al crear la tarjeta: lo que se debía al último corte o las compras que se hicieron efectivas después (con uno
  // sale el otro: lo de hoy ya lo trae todo), y los pagos hechos después del corte (p. ej. el mínimo).
  const [alCorteTxt, setAlCorteTxt] = useState(inicial?.deuda_al_corte != null ? aTexto(inicial.deuda_al_corte) : '');
  const [despuesTxt, setDespuesTxt] = useState('');
  const [pagosTxt, setPagosTxt] = useState(inicial?.pagos_tras_corte ? aTexto(inicial.pagos_tras_corte) : '');
  const v0 = inicial?.banco;
  const r0 = inicial?.reglas;
  // El banco: uno del catálogo, «otro» (fuera del catálogo: el usuario pone el nombre y las reglas) o ninguno.
  const [bancoId, setBancoId] = useState<string | null>(v0?.banco ?? (r0?.banco ? OTRO : null));
  const [otroBanco, setOtroBanco] = useState(r0?.banco ?? '');
  const [otraTarjeta, setOtraTarjeta] = useState(r0?.tarjeta ?? '');
  const [pctMin, setPctMin] = useState(numTexto(r0?.pago_minimo?.porcentaje));
  const [pisoMin, setPisoMin] = useState(r0?.pago_minimo?.minimo ? aTexto(r0.pago_minimo.minimo) : '');
  const [tasa, setTasa] = useState(numTexto(r0?.tasa_anual));
  const [atrasado, setAtrasado] = useState(r0?.pago_atrasado ? aTexto(r0.pago_atrasado) : '');
  const [pctSobregiro, setPctSobregiro] = useState(numTexto(r0?.sobregiro?.permitido));
  const [cargoSobregiro, setCargoSobregiro] = useState(r0?.sobregiro?.cargo ? aTexto(r0.sobregiro.cargo) : '');
  const [diasPagar, setDiasPagar] = useState(numTexto(r0?.dias_para_pagar));
  const [productoId, setProductoId] = useState<string | null>(v0?.cuenta ?? null);
  const [tarjetaId, setTarjetaId] = useState<string | null>(v0?.tarjeta ?? null);
  const [membresia, setMembresia] = useState<'mensual' | 'anual'>(v0?.membresia ?? 'mensual');
  const [seguroId, setSeguroId] = useState<string | null>(v0?.seguro ?? null);
  const [terminacion, setTerminacion] = useState(inicial?.terminacion ?? '');
  const eraYappy = !!inicial && cuenta_yappy === inicial.id;
  const [yappy, setYappy] = useState<'si' | 'no'>(eraYappy ? 'si' : 'no');
  const [error, setError] = useState('');
  const esTarjeta = credito === 'si';

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la cuenta');
    const abs = saldo.trim() === '' ? 0 : aCentavos(saldo);
    if (Number.isNaN(abs)) return setError(esTarjeta ? 'Lo que debes no es un número' : 'El saldo inicial no es un número');
    if (esTarjeta && corte === null) return setError('Elige el día de corte de la tarjeta');
    const min = minimo.trim() === '' ? null : aCentavos(minimo);
    if (min !== null && Number.isNaN(min)) return setError('El pago mínimo no es un número');
    const lim = limite.trim() === '' ? null : aCentavos(limite);
    if (lim !== null && (Number.isNaN(lim) || lim <= 0)) return setError('El límite de crédito no es un número mayor que 0');
    if (resumenInicio?.error) return setError(resumenInicio.error);
    const propias = leerPropias();
    if (typeof propias === 'string') return setError(propias);
    const final4 = terminacion.trim();
    if (final4 !== '' && !/^\d{4}$/.test(final4)) return setError('Los últimos dígitos de la tarjeta son 4 números');
    const vinculo: VinculoBanco | null = banco ? {
      banco: banco.id,
      cuenta: esTarjeta ? null : productos.find((p) => p.id === productoId)?.id ?? null,
      tarjeta: tarjeta?.id ?? null,
      membresia: debito ? membresia : 'mensual',
      seguro: debito ? seguroId : null,
    } : null;
    const id = inicial?.id ?? nuevoId();
    acciones.guardarCuenta({
      ...inicial, id, nombre: nombre.trim(), color, orden: inicial?.orden ?? 999,
      saldo_inicial: esTarjeta || negativo === 'si' ? -abs : abs,
      es_credito: esTarjeta, dia_corte: esTarjeta ? corte : null, dia_pago: esTarjeta ? pago : null,
      // Con las reglas del banco el mínimo se calcula; se conserva el que el usuario corrigió para un corte
      // (hoja «Pago mínimo»). Sin reglas, el que copió aquí.
      pago_minimo: !esTarjeta ? null : reglas?.pago_minimo ? (inicial?.minimo_corte ? inicial.pago_minimo ?? null : null) : min,
      reglas: propias,
      minimo_corte: esTarjeta && reglas?.pago_minimo ? inicial?.minimo_corte ?? null : null,
      limite: esTarjeta ? lim : null,
      // Los totales del corte: solo mientras la tarjeta sigue en el corte con el que se creó.
      ...(!esTarjeta ? { corte_inicial: null, deuda_al_corte: null, pagos_tras_corte: null }
        : verInicio ? { corte_inicial: resumenInicio ? corteAnt : null, deuda_al_corte: resumenInicio?.alCorte ?? null,
          pagos_tras_corte: resumenInicio?.pagos ?? null } : {}),
      banco: vinculo, terminacion: final4 === '' ? null : final4,
    });
    // El Yappy solo se marca en cuentas que no son de crédito; si cambió, se avisa a la PC.
    const quiereYappy = !esTarjeta && yappy === 'si';
    if (quiereYappy && !eraYappy) acciones.guardarCuentaYappy(id);
    else if (!quiereYappy && eraYappy) acciones.guardarCuentaYappy(null);
    alCerrar();
  }

  // Lo que puso el usuario para un banco fuera del catálogo (o una tarjeta sin reglas del catálogo): el nombre y,
  // si es tarjeta de crédito, sus reglas. Un texto si algo no es número; null si no hay nada.
  function leerPropias(): ReglasPropias | null | string {
    if (esTarjeta && tarjeta) return null; // la tarjeta del catálogo trae las suyas
    const r: ReglasPropias = {};
    if (bancoId === OTRO && otroBanco.trim()) r.banco = otroBanco.trim();
    if (esTarjeta) {
      if (bancoId === OTRO && otraTarjeta.trim()) r.tarjeta = otraTarjeta.trim();
      const pct = leerNumero(pctMin);
      const piso = pisoMin.trim() === '' ? 0 : aCentavos(pisoMin);
      if (pct !== null && (Number.isNaN(pct) || pct <= 0 || pct > 100)) return 'El % del pago mínimo va de 0 a 100';
      if (Number.isNaN(piso)) return 'El mínimo en dólares no es un número';
      if (pct !== null) r.pago_minimo = { porcentaje: pct, minimo: piso };
      else if (piso > 0) return 'Pon también el % del saldo para el pago mínimo';
      const t = leerNumero(tasa);
      if (t !== null && (Number.isNaN(t) || t < 0 || t > 200)) return 'La tasa de interés no es un número';
      if (t !== null) r.tasa_anual = t;
      const at = atrasado.trim() === '' ? null : aCentavos(atrasado);
      if (at !== null && Number.isNaN(at)) return 'El cargo por pago atrasado no es un número';
      if (at) r.pago_atrasado = at;
      const ps = leerNumero(pctSobregiro);
      const cs = cargoSobregiro.trim() === '' ? null : aCentavos(cargoSobregiro);
      if (ps !== null && (Number.isNaN(ps) || ps < 0 || ps > 100)) return 'El % de sobregiro va de 0 a 100';
      if (cs !== null && Number.isNaN(cs)) return 'El cargo por sobregiro no es un número';
      if (ps !== null || cs) r.sobregiro = { permitido: ps, cargo: cs ?? 0 };
      const dp = leerNumero(diasPagar);
      if (dp !== null && (!Number.isInteger(dp) || dp < 1 || dp > 60)) return 'Los días para pagar van de 1 a 60';
      if (dp !== null) r.dias_para_pagar = dp;
    }
    return Object.keys(r).length ? r : null;
  }

  // El banco (si el catálogo lo trae): la cuenta y la tarjeta que se pueden elegir según sea de crédito o no.
  const banco = catalogo?.bancos.find((b) => b.id === bancoId) ?? null;
  const productos = banco?.cuentas ?? [];
  const tarjetas = (banco?.tarjetas ?? []).filter((t) => t.clase === (esTarjeta ? 'credito' : 'debito'));
  const tarjeta = tarjetas.find((t) => t.id === tarjetaId) ?? null;
  const debito = !esTarjeta && !!tarjeta;
  const segurosDe = tarjeta ? versionVigente(tarjeta, hoy).seguros ?? [] : [];
  const membresiaDe = tarjeta ? versionVigente(tarjeta, hoy).membresia : undefined;
  // Las reglas de la tarjeta de crédito: las que publica el banco para la elegida o, si no hay, las que pone el usuario.
  const delCatalogo = esTarjeta && tarjeta ? versionVigente(tarjeta, hoy) : null;
  const propiasAhora = (() => { const r = !delCatalogo && esTarjeta ? leerPropias() : null; return typeof r === 'string' ? null : r; })();
  const reglas = delCatalogo ?? reglasPropias(propiasAhora);
  const verPropias = esTarjeta && !tarjeta;
  const elegirBanco = (id: string | null) => { setBancoId(id); setProductoId(null); setTarjetaId(null); setSeguroId(null); };
  const elegirTarjeta = (id: string | null) => { setTarjetaId(id); setSeguroId(null); };
  // Al elegir la tarjeta de crédito, si todavía no hay día de corte, se pone el que publica el banco (se cambia abajo).
  const elegirCredito = (id: string | null) => {
    setTarjetaId(id);
    const fechas = id ? versionVigente(tarjetas.find((t) => t.id === id)!, hoy).fechas : undefined;
    if (fechas && corte === null) setCorte(fechas.corte);
  };
  const dinero0 = (x: number) => `${moneda}${(x / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  // El último corte según el día elegido, y si se pide separar lo de antes y después de él: al crear la tarjeta,
  // o al editarla mientras siga en ese corte (o si todavía no tiene nada anotado).
  const corteAnt = esTarjeta && corte !== null ? cicloTarjeta({ ...(inicial ?? { id: '', nombre: '', color: '', saldo_inicial: 0, orden: 0 }), es_credito: true, dia_corte: corte }, hoy)?.corteAnterior ?? null : null;
  const usada = !!inicial && movimientos.some((m) => m.cuenta_id === inicial.id || m.cuenta_destino_id === inicial.id);
  const verInicio = esTarjeta && !!corteAnt && (!inicial || !inicial.es_credito || inicial.corte_inicial === corteAnt || (!inicial.corte_inicial && !usada));
  // Lo de hoy = al corte + compras después − pagos después. Con el saldo al corte o las compras sale el otro; si
  // están los dos, tienen que cuadrar. Sin pagos escritos y con un saldo al corte mayor que lo de hoy, la diferencia
  // es lo que se abonó de más.
  const resumenInicio = (() => {
    if (!verInicio) return null;
    const leer = (t: string) => (t.trim() === '' ? null : aCentavos(t));
    const a = leer(alCorteTxt);
    const b = leer(despuesTxt);
    const p = leer(pagosTxt);
    if (a === null && b === null && p === null) return null;
    const hoyDebe = saldo.trim() === '' ? 0 : aCentavos(saldo);
    const base = { alCorte: 0, compras: 0, pagos: 0, sale: null as 'corte' | 'compras' | null };
    if ([a, b, p, hoyDebe].some((x) => x !== null && Number.isNaN(x))) return { ...base, error: 'Alguno de los montos no es un número' };
    if (a === null && b === null) return { ...base, error: 'Pon también el saldo al corte o las compras de después del corte' };
    const pagos = p ?? 0;
    if (a !== null && b !== null && a + b - pagos !== hoyDebe) {
      return { ...base, error: `No concuerda: ${dinero0(a)} al corte + ${dinero0(b)} de compras − ${dinero0(pagos)} de pagos = ${dinero0(a + b - pagos)}, pero debes hoy ${dinero0(hoyDebe)}. Deja vacío el saldo al corte o las compras.` };
    }
    if (a === null) {
      const alCorte = hoyDebe - b! + pagos;
      if (alCorte < 0) return { ...base, error: 'Las compras de después del corte no pueden ser más de lo que debes hoy más lo que pagaste' };
      return { alCorte, compras: b!, pagos, sale: 'corte' as const, error: null };
    }
    const compras = hoyDebe - a + pagos;
    if (compras < 0 && p !== null) return { ...base, error: 'No concuerda: con ese saldo al corte y esos pagos, lo de hoy debería ser menos' };
    return { alCorte: a, compras: Math.max(0, compras), pagos: compras < 0 ? -compras : pagos, sale: b === null ? 'compras' as const : null, error: null };
  })();
  const sobregiro = reglas?.sobregiro;
  const comoSobregiro = !sobregiro ? '' : sobregiro.permitido !== null
    ? `Puedes pasarte ${sobregiro.permitido}% del límite sin cargo${sobregiro.cargo ? `; más de eso, ${dinero0(sobregiro.cargo)} al corte` : ''}.`
    : sobregiro.cargo ? `Si pasas el límite, hasta ${dinero0(sobregiro.cargo)} al corte.` : '';
  // Las reglas de la tarjeta como filas de dato (rótulo, valor): sin explicaciones mezcladas.
  const filasReglas = (v: NonNullable<typeof reglas>): [string, string][] => {
    const f: [string, string][] = [];
    if (v.pago_minimo) f.push(['Pago mínimo', `${v.pago_minimo.porcentaje}% del saldo${v.pago_minimo.minimo ? ` · mín. ${dinero0(v.pago_minimo.minimo)}` : ''}`]);
    if (v.tasa_anual != null) f.push(['Interés anual', `${v.tasa_anual}%`]);
    if (v.pago_atrasado) f.push(['Cargo por pago atrasado', dinero0(v.pago_atrasado)]);
    if (v.sobregiro) {
      f.push(['Sobregiro sin cargo', v.sobregiro.permitido !== null ? `${v.sobregiro.permitido}% del límite` : 'No lo publica']);
      if (v.sobregiro.cargo) f.push(['Cargo por sobregiro', `${v.sobregiro.permitido === null ? 'hasta ' : ''}${dinero0(v.sobregiro.cargo)}`]);
    }
    if (v.fechas) f.push(['Corte y pago que publica', `día ${v.fechas.corte} · día ${v.fechas.pago}`]);
    if (v.dias_para_pagar) f.push(['Días para pagar', `${v.dias_para_pagar} tras el corte`]);
    return f;
  };

  // Borrar: con confirmación simple si la cuenta está vacía; si tiene historia, se avisa de todo lo que se va con ella.
  function borrar() {
    if (!inicial) return;
    const toca = (x: { cuenta_id: string; cuenta_destino_id: string | null }) => x.cuenta_id === inicial.id || x.cuenta_destino_id === inicial.id;
    const nMovs = movimientos.filter(toca).length;
    const nReglas = recurrencias.filter(toca).length;
    if (nMovs === 0 && nReglas === 0) {
      avisar(`¿Borrar ${inicial.nombre}?`, undefined, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => { acciones.borrarCuenta(inicial); alCerrar(); } },
      ]);
      return;
    }
    const movs = `${nMovs} ${nMovs === 1 ? 'movimiento' : 'movimientos'}`;
    const reglas = `${nReglas} ${nReglas === 1 ? 'cosa que se repite' : 'cosas que se repiten'}`;
    avisar(`¿Borrar ${inicial.nombre}?`, `${inicial.nombre} tiene ${movs} y ${reglas}. Si la borras, se borra todo eso también.`, [
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
      <View style={{ gap: 10 }}>
        <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Banco</Etiqueta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Ficha texto="Ninguno" activa={bancoId === null} alto={36} onPress={() => elegirBanco(null)} />
          {(catalogo?.bancos ?? []).map((b) => <Ficha key={b.id} texto={b.nombre} activa={b.id === bancoId} alto={36} onPress={() => elegirBanco(b.id)} />)}
          <Ficha texto="Otro banco" activa={bancoId === OTRO} alto={36} onPress={() => elegirBanco(OTRO)} />
        </View>
        {bancoId === OTRO && (
          <View style={{ gap: 10 }}>
            {esTarjeta ? (
              <DosCampos
                izquierda={['Nombre del banco', <Campo value={otroBanco} onChangeText={setOtroBanco} placeholder="Ej: BAC" />]}
                derecha={['Nombre de la tarjeta', <Campo value={otraTarjeta} onChangeText={setOtraTarjeta} placeholder="Ej: Visa Oro" />]} />
            ) : (
              <Campo value={otroBanco} onChangeText={setOtroBanco} placeholder="Nombre del banco (ej: BAC)" accessibilityLabel="Nombre del banco" />
            )}
            <TarjetaMedida banco={otroBanco.trim() || 'Tu banco'} nombre={(esTarjeta && otraTarjeta.trim()) || nombre.trim() || (esTarjeta ? 'Tarjeta de crédito' : 'Tarjeta de débito')}
              diseno={disenoConColor(color)} clase={esTarjeta ? 'credito' : 'debito'} terminacion={terminacion} />
            <Texto tam={12} color={c.tenue}>
              {esTarjeta ? 'Ese banco todavía no está en la app: abajo pones las reglas de tu tarjeta y la app calcula con ellas.' : 'Ese banco todavía no está en la app: no se calculan sus intereses ni cargos.'}
            </Texto>
          </View>
        )}
        {banco && !esTarjeta && (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 8 }}>
              <Etiqueta>Tipo de cuenta</Etiqueta>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {productos.map((p) => <Ficha key={p.id} texto={p.nombre} activa={p.id === productoId} alto={36} onPress={() => setProductoId(p.id === productoId ? null : p.id)} />)}
              </View>
            </View>
            {tarjetas.length > 0 && (
              <View style={{ gap: 8 }}>
                <Etiqueta>Tarjeta de débito</Etiqueta>
                <ElegirTarjetaBanco banco={banco.nombre} tarjetas={tarjetas} valor={tarjetaId} alCambiar={elegirTarjeta} clase="debito"
                  terminacion={terminacion} color={color} ninguna="No tengo tarjeta de débito" />
              </View>
            )}
            {debito && membresiaDe && (
              <View style={{ gap: 8 }}>
                <Etiqueta>Membresía</Etiqueta>
                <Segmentos<'mensual' | 'anual'> opciones={[['mensual', `Mensual ${dinero0(membresiaDe.mensual)}`], ['anual', `Anual ${dinero0(membresiaDe.anual)}`]]}
                  valor={membresia} alCambiar={setMembresia} />
              </View>
            )}
            {debito && segurosDe.length > 0 && (
              <View style={{ gap: 8 }}>
                <Etiqueta>Seguro contra fraude</Etiqueta>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Ficha texto="Ninguno" activa={!seguroId} alto={36} onPress={() => setSeguroId(null)} />
                  {segurosDe.map((sg) => <Ficha key={sg.id} texto={`${sg.nombre.replace('Seguro contra fraude ', '')} · ${dinero0(sg.mensual)}/mes`} activa={sg.id === seguroId} alto={36} onPress={() => setSeguroId(sg.id)} />)}
                </View>
              </View>
            )}
          </View>
        )}
        {banco && esTarjeta && (
          <View style={{ gap: 10 }}>
            <Etiqueta>Tu tarjeta</Etiqueta>
            <ElegirTarjetaBanco banco={banco.nombre} tarjetas={tarjetas} valor={tarjetaId} alCambiar={elegirCredito} clase="credito"
              terminacion={terminacion} color={color} ninguna="No está aquí" />
            {delCatalogo && (
              <>
                <View style={{ backgroundColor: c.suave, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 }}>
                  {filasReglas(delCatalogo).map(([r, v], i) => <FilaRegla key={r} rotulo={r} valor={v} primera={i === 0} />)}
                </View>
                <Texto tam={12} color={c.tenue}>
                  De la tabla de tarifas de {banco.nombre}{delCatalogo.verificado ? ` (revisada el ${fechaCorta(delCatalogo.verificado)} ${delCatalogo.verificado.slice(0, 4)})` : ''}. Con esto la app calcula el pago mínimo, la fecha de pago y el sobregiro.
                </Texto>
              </>
            )}
            {!tarjeta && tarjetas.length > 0 && (
              <Texto tam={12} color={c.tenue}>Si tu tarjeta no está en la pila, pon abajo sus reglas.</Texto>
            )}
          </View>
        )}
      </View>
      {esTarjeta && (
        <View style={{ gap: 8 }}>
          <Etiqueta>Día de corte</Etiqueta>
          <GrillaDias valor={corte} alCambiar={setCorte} />
          {reglas?.fechas && (
            <Texto tam={13} color={c.tenue}>
              {banco?.nombre} publica para esta tarjeta el corte el {reglas.fechas.corte} y el pago el {reglas.fechas.pago}. Pon el de tu estado de cuenta: puede ser otro.
            </Texto>
          )}
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Etiqueta>{esTarjeta ? 'Lo que debes hoy' : 'Saldo con el que empieza'}</Etiqueta>
        <MontoGrande valor={saldo} alCambiar={setSaldo} moneda={moneda} />
        {esTarjeta && <Texto tam={13} color={c.tenue}>El saldo actual que muestra tu banca, con todo lo de después del corte.</Texto>}
        {!esTarjeta && <Segmentos<'no' | 'si'> opciones={[['no', 'A favor'], ['si', 'En contra (deuda)']]} valor={negativo} alCambiar={setNegativo} />}
      </View>
      {verInicio && corteAnt && (
        <View style={{ gap: 10, backgroundColor: c.suave, borderRadius: 14, padding: 14 }}>
          <Texto tam={15} peso="semi">¿Cuánto era al corte del {fechaCorta(corteAnt)}?</Texto>
          <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>
            Lo que el banco hizo efectivo después del corte (aunque lo hayas hecho antes) entra en el corte siguiente. Pon el saldo al corte o las compras de después (la app saca el otro con lo que debes hoy) y, si pagaste algo después del corte, cuánto. No hace falta anotarlo uno por uno.
          </Texto>
          <View style={{ gap: 6 }}>
            <Etiqueta>Saldo al corte (estado de cuenta)</Etiqueta>
            <CampoMonto valor={alCorteTxt} alCambiar={(v) => { setAlCorteTxt(v); setError(''); }} moneda={moneda} accessibilityLabel="Saldo al corte"
              placeholder={resumenInicio?.sale === 'corte' && !resumenInicio.error ? `${dinero0(resumenInicio.alCorte)} (sale solo)` : undefined} />
          </View>
          <View style={{ gap: 6 }}>
            <Etiqueta>Compras que se hicieron efectivas después del corte</Etiqueta>
            <CampoMonto valor={despuesTxt} alCambiar={(v) => { setDespuesTxt(v); setError(''); }} moneda={moneda} accessibilityLabel="Compras después del corte"
              placeholder={resumenInicio?.sale === 'compras' && !resumenInicio.error ? `${dinero0(resumenInicio.compras)} (sale solo)` : undefined} />
            <Texto tam={13} color={c.tenue}>Compras y cargos que el banco cobró después del corte, aunque los hayas hecho antes.</Texto>
          </View>
          <View style={{ gap: 6 }}>
            <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Pagos a la tarjeta después del corte</Etiqueta>
            <CampoMonto valor={pagosTxt} alCambiar={(v) => { setPagosTxt(v); setError(''); }} moneda={moneda} accessibilityLabel="Pagos después del corte" />
            <Texto tam={13} color={c.tenue}>Por ejemplo, el mínimo si ya lo pagaste. Cuenta como pagado en este corte.</Texto>
          </View>
          {resumenInicio && (
            <Texto tam={13} color={resumenInicio.error ? c.alerta : undefined} style={{ lineHeight: 18 }}>
              {resumenInicio.error
                ?? `Al corte debías ${dinero0(resumenInicio.alCorte)} · después: compras ${dinero0(resumenInicio.compras)}, pagos ${dinero0(resumenInicio.pagos)}. De aquí en adelante, anota cada compra y pago nuevo de la tarjeta.`}
            </Texto>
          )}
        </View>
      )}
      {esTarjeta && (
        <>
          <View style={{ gap: 8 }}>
            <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Día de pago</Etiqueta>
            <GrillaDias valor={pago} alCambiar={setPago} />
            {reglas?.dias_para_pagar && pago === null && (
              <Texto tam={13} color={c.tenue}>Sin elegirlo, la app toma {reglas.dias_para_pagar} días después del corte, como dice el banco.</Texto>
            )}
          </View>
          <View style={{ gap: 8 }}>
            <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Límite de crédito</Etiqueta>
            <CampoMonto valor={limite} alCambiar={setLimite} moneda={moneda} accessibilityLabel="Límite de crédito" />
            <Texto tam={13} color={c.tenue}>{comoSobregiro ? `Para ver lo disponible. ${comoSobregiro}` : 'Para ver cuánto te queda disponible.'}</Texto>
          </View>
          {verPropias && (
            <View style={{ gap: 14, backgroundColor: c.suave, borderRadius: 14, padding: 14 }}>
              <View style={{ gap: 4 }}>
                <Texto tam={15} peso="semi">Reglas de tu tarjeta</Texto>
                <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>
                  Cópialas de tu estado de cuenta o de la tabla de tarifas de tu banco. Todas son opcionales; con el % del pago mínimo la app lo calcula en cada corte.
                </Texto>
              </View>
              <CampoRegla rotulo="Pago mínimo" ayuda="Por ejemplo, 3% y nunca menos de $20.">
                <DosCampos
                  izquierda={['% del saldo al corte', <Campo value={pctMin} onChangeText={setPctMin} placeholder="Ej: 3" keyboardType="decimal-pad" style={{ backgroundColor: c.tarjeta }} accessibilityLabel="Porcentaje del pago mínimo" />]}
                  derecha={['Nunca menos de', <CampoMonto valor={pisoMin} alCambiar={setPisoMin} moneda={moneda} placeholder="Ej: $20.00" accessibilityLabel="Pago mínimo en dólares" style={{ backgroundColor: c.tarjeta }} />]} />
              </CampoRegla>
              <CampoRegla rotulo="Interés anual (%)" ayuda="Para estimar cuánto cobra el banco si no pagas el total.">
                <Campo value={tasa} onChangeText={setTasa} placeholder="Ej: 54" keyboardType="decimal-pad" accessibilityLabel="Interés anual" style={{ backgroundColor: c.tarjeta }} />
              </CampoRegla>
              <CampoRegla rotulo="Cargo por pago atrasado">
                <CampoMonto valor={atrasado} alCambiar={setAtrasado} moneda={moneda} accessibilityLabel="Cargo por pago atrasado" style={{ backgroundColor: c.tarjeta }} />
              </CampoRegla>
              <CampoRegla rotulo="Sobregiro" ayuda="Cuánto % del límite te deja pasar sin cargo, y lo que cobra al corte si te pasas de ahí.">
                <DosCampos
                  izquierda={['% del límite sin cargo', <Campo value={pctSobregiro} onChangeText={setPctSobregiro} placeholder="Ej: 5" keyboardType="decimal-pad" style={{ backgroundColor: c.tarjeta }} accessibilityLabel="Porcentaje de sobregiro sin cargo" />]}
                  derecha={['Cargo si te pasas', <CampoMonto valor={cargoSobregiro} alCambiar={setCargoSobregiro} moneda={moneda} accessibilityLabel="Cargo por sobregiro" style={{ backgroundColor: c.tarjeta }} />]} />
              </CampoRegla>
              <CampoRegla rotulo="Días para pagar después del corte" ayuda="Si tu banco da un plazo en días y no un día fijo. Si eliges arriba el día de pago, manda ese.">
                <Campo value={diasPagar} onChangeText={(t) => setDiasPagar(t.replace(/\D/g, '').slice(0, 2))} placeholder="Ej: 25" keyboardType="number-pad" accessibilityLabel="Días para pagar" style={{ backgroundColor: c.tarjeta }} />
              </CampoRegla>
            </View>
          )}
          {!reglas?.pago_minimo && (
            <View style={{ gap: 8 }}>
              <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Pago mínimo de este corte</Etiqueta>
              <CampoMonto valor={minimo} alCambiar={setMinimo} moneda={moneda} accessibilityLabel="Pago mínimo" />
              <Texto tam={13} color={c.tenue}>Cópialo de tu estado de cuenta. Con el % del pago mínimo en las reglas, la app lo calcula sola.</Texto>
            </View>
          )}
        </>
      )}
      <View style={{ gap: 8 }}>
        <Etiqueta derecha={<Texto tam={13} color={c.tenue}>Opcional</Texto>}>Últimos 4 dígitos de la tarjeta</Etiqueta>
        <Campo value={terminacion} onChangeText={(t) => setTerminacion(t.replace(/\D/g, '').slice(0, 4))} placeholder="1234" keyboardType="number-pad" maxLength={4} />
        <Texto tam={13} color={c.tenue}>Para reconocer los avisos del banco que llegan al correo.</Texto>
      </View>
      {!esTarjeta && (
        <View style={{ gap: 8 }}>
          <Etiqueta>Mi Yappy está en esta cuenta</Etiqueta>
          <Segmentos<'no' | 'si'> opciones={[['no', 'No'], ['si', 'Sí']]} valor={yappy} alCambiar={setYappy} />
          <Texto tam={13} color={c.tenue}>Los Yappy que te lleguen al correo se anotan en esta cuenta.</Texto>
        </View>
      )}
    </Hoja>
  );
}
