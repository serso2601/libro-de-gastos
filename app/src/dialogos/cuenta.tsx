// La hoja de una cuenta: crearla, editarla o borrarla. Una cuenta puede ser tarjeta de crédito (día de
// corte, y de pago y mínimo si el usuario quiere): su saldo es deuda y la pantalla de la cuenta lo muestra así.

import { useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, nuevoId } from '@/lib/formato';
import { versionVigente } from '@/lib/banco';
import type { Cuenta, VinculoBanco } from '@/lib/tipos';
import { avisar } from '@/ui/aviso';
import { BotonBorrar, BotonPrincipal, Campo, Colores, Etiqueta, Ficha, Hoja, limpiarMonto, MontoGrande, Segmentos, Texto, TextoError } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { useTema } from '@/ui/tema';
import { Desplegable } from './piezas';

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
  const v0 = inicial?.banco;
  const [bancoId, setBancoId] = useState<string | null>(v0?.banco ?? null);
  const [productoId, setProductoId] = useState<string | null>(v0?.cuenta ?? null);
  const [tarjetaId, setTarjetaId] = useState<string | null>(v0?.tarjeta ?? null);
  const [membresia, setMembresia] = useState<'mensual' | 'anual'>(v0?.membresia ?? 'mensual');
  const [seguroId, setSeguroId] = useState<string | null>(v0?.seguro ?? null);
  const [verBanco, setVerBanco] = useState(false);
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
      es_credito: esTarjeta, dia_corte: esTarjeta ? corte : null, dia_pago: esTarjeta ? pago : null, pago_minimo: esTarjeta ? min : null,
      banco: vinculo, terminacion: final4 === '' ? null : final4,
    });
    // El Yappy solo se marca en cuentas que no son de crédito; si cambió, se avisa a la PC.
    const quiereYappy = !esTarjeta && yappy === 'si';
    if (quiereYappy && !eraYappy) acciones.guardarCuentaYappy(id);
    else if (!quiereYappy && eraYappy) acciones.guardarCuentaYappy(null);
    alCerrar();
  }

  // El banco (si el catálogo lo trae): la cuenta y la tarjeta que se pueden elegir según sea de crédito o no.
  const banco = catalogo?.bancos.find((b) => b.id === bancoId) ?? null;
  const productos = banco?.cuentas ?? [];
  const tarjetas = (banco?.tarjetas ?? []).filter((t) => t.clase === (esTarjeta ? 'credito' : 'debito'));
  const tarjeta = tarjetas.find((t) => t.id === tarjetaId) ?? null;
  const debito = !esTarjeta && !!tarjeta;
  const segurosDe = tarjeta ? versionVigente(tarjeta, hoy).seguros ?? [] : [];
  const membresiaDe = tarjeta ? versionVigente(tarjeta, hoy).membresia : undefined;
  const nombreBanco = banco ? [banco.nombre, esTarjeta ? tarjeta?.nombre : productos.find((p) => p.id === productoId)?.nombre].filter(Boolean).join(' · ') : 'Ninguno';
  const elegirBanco = (id: string | null) => { setBancoId(id); setProductoId(null); setTarjetaId(null); setSeguroId(null); };
  const elegirTarjeta = (id: string | null) => { setTarjetaId(id); setSeguroId(null); };
  const dinero0 = (x: number) => `${moneda}${(x / 100).toFixed(2)}`;

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
      {catalogo && catalogo.bancos.length > 0 && (
        <View style={{ backgroundColor: c.suave, borderRadius: 14 }}>
          <Desplegable texto="Banco" valor={nombreBanco} abierto={verBanco} alTocar={() => setVerBanco((v) => !v)}>
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Ficha texto="Ninguno" activa={!banco} alto={36} onPress={() => elegirBanco(null)} />
                {catalogo.bancos.map((b) => <Ficha key={b.id} texto={b.nombre} activa={b.id === bancoId} alto={36} onPress={() => elegirBanco(b.id)} />)}
              </View>
              {banco && !esTarjeta && (
                <>
                  <View style={{ gap: 8 }}>
                    <Etiqueta>Tipo de cuenta</Etiqueta>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {productos.map((p) => <Ficha key={p.id} texto={p.nombre} activa={p.id === productoId} alto={36} onPress={() => setProductoId(p.id === productoId ? null : p.id)} />)}
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Etiqueta>Tarjeta de débito</Etiqueta>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Ficha texto="Ninguna" activa={!tarjetaId} alto={36} onPress={() => elegirTarjeta(null)} />
                      {tarjetas.map((t) => <Ficha key={t.id} texto={t.nombre} activa={t.id === tarjetaId} alto={36} onPress={() => elegirTarjeta(t.id)} />)}
                    </View>
                  </View>
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
                </>
              )}
              {banco && esTarjeta && (
                <View style={{ gap: 8 }}>
                  <Etiqueta>Tarjeta</Etiqueta>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {tarjetas.map((t) => <Ficha key={t.id} texto={t.nombre} activa={t.id === tarjetaId} alto={36} onPress={() => setTarjetaId(t.id === tarjetaId ? null : t.id)} />)}
                  </View>
                </View>
              )}
            </View>
          </Desplegable>
        </View>
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
