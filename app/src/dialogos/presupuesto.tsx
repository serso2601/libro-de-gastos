// Las hojas del presupuesto: el tope de una categoría y todos los topes juntos.

import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { gastadoEn } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aCentavos, aTexto, dinero } from '@/lib/formato';
import type { Categoria } from '@/lib/tipos';
import { BotonBorrar, BotonPrincipal, Hoja, MontoGrande, Texto, TextoError, familia } from '@/ui/componentes';
import { SimboloCategoria } from '@/ui/simbolos';
import { useTema } from '@/ui/tema';

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
          {categoria.presupuesto ? <BotonBorrar texto="Quitar el tope" onPress={() => guardar(null)} /> : null}
        </>
      )}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        Cuánto quieres gastar como mucho en {categoria.nombre.toLowerCase()} cada mes. Este mes llevas {dinero(gastado, d.moneda)}.
      </Texto>
      <MontoGrande valor={monto} alCambiar={setMonto} moneda={d.moneda} autoFocus />
    </Hoja>
  );
}

/** Todos los topes en una sola hoja. */
export function DialogoTopes({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const { c, oscuro } = useTema();
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
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>Deja vacío lo que no quieras limitar. En total: {dinero(total, d.moneda)} al mes.</Texto>
      <View style={{ backgroundColor: c.suave, borderRadius: 14 }}>
        {deGasto.map((cat, i) => (
          <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.tarjeta }}>
            <SimboloCategoria categoria={cat} tam={30} />
            <Texto tam={15} style={{ flex: 1 }} lineas={1}>{cat.nombre}</Texto>
            <Texto num tam={15} color={c.tenue}>{d.moneda}</Texto>
            <TextInput value={valores[cat.id]} onChangeText={(t) => setValores((v) => ({ ...v, [cat.id]: t }))} placeholder="sin tope" placeholderTextColor={c.tenue}
              keyboardType="decimal-pad" keyboardAppearance={oscuro ? 'dark' : 'light'} accessibilityLabel={`Tope de ${cat.nombre}`}
              style={{ width: 96, height: 40, paddingVertical: 0, textAlign: 'right', fontSize: 16, color: c.tinta, fontFamily: familia('medio'), fontVariant: ['tabular-nums'] }} />
          </View>
        ))}
      </View>
    </Hoja>
  );
}
