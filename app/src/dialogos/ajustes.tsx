import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { gastadoEn } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, dinero, inicialDe, nuevoId } from '@/lib/formato';
import type { Categoria, Cuenta, TipoCategoria } from '@/lib/tipos';
import { BotonPrincipal, Campo, Colores, Etiqueta, Hoja, Inicial, MontoGrande, Segmentos, Texto, TextoError, familia } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { useTema } from '@/ui/tema';

function Borrar({ texto, onPress }: { texto: string; onPress: () => void }) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Texto tam={15} peso="semi" color={c.alerta}>{texto}</Texto>
    </Pressable>
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
    <Hoja titulo={inicial ? 'Editar cuenta' : 'Nueva cuenta'} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear cuenta'}</BotonPrincipal>
          {inicial && (borrable
            ? <Borrar texto="Borrar cuenta" onPress={() => { acciones.borrarCuenta(inicial); alCerrar(); }} />
            : <Texto tam={12.5} color={c.tenue} centro style={{ paddingVertical: 8 }}>No se puede borrar: es la única cuenta o tiene movimientos.</Texto>)}
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

export function DialogoCategoria({ inicial, tipoInicial = 'gasto', alCerrar }: { inicial?: Categoria; tipoInicial?: TipoCategoria; alCerrar: () => void }) {
  const { movimientos, recurrencias } = useDatos();
  const { c } = useTema();
  const acciones = useAcciones();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial?.tipo ?? tipoInicial);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [color, setColor] = useState(inicial?.color ?? PALETA[0]);
  const [error, setError] = useState('');
  const borrable = !!inicial && !movimientos.some((m) => m.categoria_id === inicial.id) && !recurrencias.some((r) => r.categoria_id === inicial.id);

  function guardar() {
    if (!nombre.trim()) return setError('Ponle un nombre a la categoría');
    acciones.guardarCategoria({ id: inicial?.id ?? nuevoId(), nombre: nombre.trim(), tipo, color, emoji: inicial?.emoji || '💰', presupuesto: inicial?.presupuesto ?? null, orden: inicial?.orden ?? 999 });
    alCerrar();
  }

  return (
    <Hoja titulo={inicial ? 'Editar categoría' : 'Nueva categoría'} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={guardar}>{inicial ? 'Guardar cambios' : 'Crear categoría'}</BotonPrincipal>
          {inicial && (borrable
            ? <Borrar texto="Borrar categoría" onPress={() => { acciones.borrarCategoria(inicial); alCerrar(); }} />
            : <Texto tam={12.5} color={c.tenue} centro style={{ paddingVertical: 8 }}>No se puede borrar: tiene movimientos o se repite.</Texto>)}
        </>
      )}>
      {inicial
        ? <Texto tam={13.5} color={c.tenue}>Categoría de {tipo}s</Texto>
        : <Segmentos<TipoCategoria> opciones={[['gasto', 'De gastos'], ['ingreso', 'De ingresos']]} valor={tipo} alCambiar={setTipo} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Inicial texto={inicialDe(nombre)} color={color} tam={48} />
        <Campo value={nombre} onChangeText={setNombre} placeholder="Nombre de la categoría" autoFocus={!inicial} style={{ flex: 1 }} />
      </View>
      <View style={{ gap: 8 }}>
        <Etiqueta>Color</Etiqueta>
        <Colores valor={color} alCambiar={setColor} />
      </View>
    </Hoja>
  );
}

export function DialogoPresupuesto({ categoria, alCerrar }: { categoria: Categoria; alCerrar: () => void }) {
  const d = useDatos();
  const { c } = useTema();
  const { guardarCategoria } = useAcciones();
  const [monto, setMonto] = useState(categoria.presupuesto ? aTexto(categoria.presupuesto) : '');
  const [error, setError] = useState('');
  const gastado = gastadoEn(d, categoria.id, d.hoy.slice(0, 7));
  function guardar(valor: number | null) {
    guardarCategoria({ ...categoria, presupuesto: valor });
    alCerrar();
  }
  return (
    <Hoja titulo={categoria.nombre} alCerrar={alCerrar}
      pie={(
        <>
          <TextoError texto={error} />
          <BotonPrincipal onPress={() => {
            if (monto.trim() === '') return guardar(null);
            const x = aCentavos(monto);
            if (!(x > 0)) return setError('Escribe un monto válido, o déjalo vacío para no tener tope');
            guardar(x);
          }}>Guardar tope</BotonPrincipal>
          {categoria.presupuesto ? <Borrar texto="Quitar el tope" onPress={() => guardar(null)} /> : null}
        </>
      )}>
      <Texto tam={13.5} color={c.tenue} style={{ lineHeight: 20 }}>
        Cuánto quieres gastar como mucho en {categoria.nombre.toLowerCase()} cada mes. Este mes llevas {dinero(gastado, d.moneda)}.
      </Texto>
      <MontoGrande valor={monto} alCambiar={setMonto} moneda={d.moneda} autoFocus />
    </Hoja>
  );
}

/** Todos los topes en una sola hoja. */
export function DialogoTopes({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const { c, estilo, oscuro } = useTema();
  const { guardarCategoria } = useAcciones();
  const deGasto = d.categorias.filter((x) => x.tipo === 'gasto');
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(deGasto.map((x) => [x.id, x.presupuesto ? aTexto(x.presupuesto) : ''])));
  const [error, setError] = useState('');

  function guardar() {
    for (const cat of deGasto) {
      const texto = (valores[cat.id] ?? '').trim();
      const nuevo = texto === '' ? null : aCentavos(texto);
      if (nuevo !== null && Number.isNaN(nuevo)) return setError(`El tope de ${cat.nombre} no es un número`);
      const final = nuevo && nuevo > 0 ? nuevo : null;
      if (final !== cat.presupuesto) guardarCategoria({ ...cat, presupuesto: final });
    }
    alCerrar();
  }

  const total = deGasto.reduce((s, x) => { const v = aCentavos(valores[x.id] ?? ''); return s + (v > 0 ? v : 0); }, 0);

  return (
    <Hoja titulo="Topes por mes" alCerrar={alCerrar} pie={<><TextoError texto={error} /><BotonPrincipal onPress={guardar}>Guardar topes</BotonPrincipal></>}>
      <Texto tam={13.5} color={c.tenue} style={{ lineHeight: 20 }}>Deja vacío lo que no quieras limitar. En total: {dinero(total, d.moneda)} al mes.</Texto>
      <View style={{ backgroundColor: c.suave, borderRadius: 14 }}>
        {deGasto.map((cat, i) => (
          <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.tarjeta }}>
            <Inicial texto={inicialDe(cat.nombre)} color={cat.color} tam={30} />
            <Texto tam={15} style={{ flex: 1 }} lineas={1}>{cat.nombre}</Texto>
            <Texto num tam={15} color={c.tenue}>{d.moneda}</Texto>
            <TextInput value={valores[cat.id]} onChangeText={(t) => setValores((v) => ({ ...v, [cat.id]: t }))} placeholder="sin tope" placeholderTextColor={c.tenue}
              keyboardType="decimal-pad" keyboardAppearance={oscuro ? 'dark' : 'light'} accessibilityLabel={`Tope de ${cat.nombre}`}
              style={{ width: 96, height: 40, textAlign: 'right', fontSize: 15, color: c.tinta, fontFamily: familia(estilo.fuentes, 'medio', true) }} />
          </View>
        ))}
      </View>
    </Hoja>
  );
}
