// Lo que comparten las hojas de anotar y de la regla que se repite: elegir día (fichas), categoría
// (una grilla) y cuenta (tarjetas de colores con su saldo).

import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Children, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, diaCorto, dineroCorto, fechaISO, horaTexto, nuevoId, saldo } from '@/lib/formato';
import type { Categoria, TipoCategoria } from '@/lib/tipos';
import { Campo, Colores, Etiqueta, Num, Texto } from '@/ui/componentes';
import { PALETA } from '@/ui/estilos';
import { Icono } from '@/ui/iconos';
import { sobre, useTema } from '@/ui/tema';

/** Hijos en columnas iguales; la última fila se completa con huecos. */
export function Grilla({ columnas, gap = 8, children }: { columnas: number; gap?: number; children: ReactNode }) {
  const items = Children.toArray(children);
  const filas: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columnas) filas.push(items.slice(i, i + columnas));
  return (
    <View style={{ gap }}>
      {filas.map((fila, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {fila.map((x, j) => <View key={j} style={{ flex: 1 }}>{x}</View>)}
          {Array.from({ length: columnas - fila.length }, (_, j) => <View key={`h${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

function sumarDias(iso: string, n: number): string {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

/** El día (y la hora, si se quiere): Hoy, Ayer, anteayer o cualquier otro en el calendario. */
export function ElegirFecha({ fecha, alCambiar, hora, alCambiarHora, rotulo = 'Fecha' }: {
  fecha: string; alCambiar: (f: string) => void; hora?: string; alCambiarHora?: (h: string) => void; rotulo?: string;
}) {
  const { hoy } = useDatos();
  const { c, oscuro } = useTema();
  const [calendario, setCalendario] = useState(false);
  const elegir = (f: string) => { Haptics.selectionAsync(); alCambiar(f); setCalendario(false); };

  const botonCalendario = (activo: boolean, ancho: number, alto: number, radio: number, texto?: string) => (
    <Pressable onPress={() => setCalendario((v) => !v)} accessibilityLabel="Elegir otro día"
      style={{ minWidth: ancho, height: alto, borderRadius: radio, paddingHorizontal: texto ? 12 : 0, backgroundColor: activo ? c.boton : c.suave,
        flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
      <Icono nombre="calendario" tam={17} color={activo ? c.sobreBoton : c.tinta} />
      {texto && <Texto tam={14} peso="semi" color={c.sobreBoton}>{texto}</Texto>}
    </Pressable>
  );

  const fichas: [string, string][] = [[hoy, 'Hoy'], [sumarDias(hoy, -1), 'Ayer'], [sumarDias(hoy, -2), diaCorto(sumarDias(hoy, -2))]];
  const fuera = !fichas.some(([f]) => f === fecha);
  const opciones = (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {fichas.map(([f, t]) => {
        const activo = f === fecha;
        return (
          <Pressable key={f} onPress={() => elegir(f)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: activo ? c.boton : c.suave, justifyContent: 'center' }}>
            <Texto tam={14} peso={activo ? 'semi' : 'normal'} color={activo ? c.sobreBoton : c.tinta}>{t}</Texto>
          </Pressable>
        );
      })}
      {botonCalendario(fuera, 40, 40, 20, fuera ? diaCorto(fecha) : undefined)}
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      <Etiqueta derecha={alCambiarHora && !hora ? (
        <Pressable onPress={() => alCambiarHora(horaTexto(new Date()))} hitSlop={8}><Texto tam={14} peso="semi" color={c.acento}>+ hora</Texto></Pressable>
      ) : undefined}>{rotulo}</Etiqueta>
      {opciones}
      {calendario && (
        <DateTimePicker value={aFecha(fecha)} mode="date" display="inline" locale="es-PA" accentColor={c.acento} themeVariant={oscuro ? 'dark' : 'light'}
          onChange={(_, d) => d && elegir(fechaISO(d))} />
      )}
      {alCambiarHora && hora ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, borderRadius: 14, backgroundColor: c.suave, paddingLeft: 14, paddingRight: 6 }}>
          <Texto tam={15}>Hora</Texto>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <DateTimePicker value={(() => { const d = new Date(); const [h, m] = hora.split(':').map(Number); d.setHours(h, m, 0, 0); return d; })()}
              mode="time" display="compact" locale="es-PA" accentColor={c.acento} themeVariant={oscuro ? 'dark' : 'light'}
              onChange={(_, d) => d && alCambiarHora(horaTexto(d))} />
            <Pressable onPress={() => alCambiarHora('')} hitSlop={8} accessibilityLabel="Quitar la hora" style={{ padding: 8 }}>
              <Icono nombre="cerrar" tam={16} color={c.tenue} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** La grilla de categorías, con lo que le queda a cada una y la opción de crear otra ahí mismo. */
export function ElegirCategoria({ tipo, valor, alCambiar, fecha, rotulo = true }: {
  tipo: TipoCategoria; valor: string; alCambiar: (id: string) => void; fecha: string; rotulo?: boolean;
}) {
  const d = useDatos();
  const { c } = useTema();
  const { guardarCategoria } = useAcciones();
  const [nueva, setNueva] = useState(false);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState(PALETA[0]);
  const disponibles = d.categorias.filter((x) => x.tipo === tipo);
  const estados = new Map(topes(d, fecha.slice(0, 7)).conTope.map((t) => [t.categoria.id, t]));

  function crear() {
    if (!nombre.trim()) return;
    const cat: Categoria = { id: nuevoId(), nombre: nombre.trim(), tipo, color, emoji: '💰', presupuesto: null, orden: 999 };
    guardarCategoria(cat);
    alCambiar(cat.id);
    setNueva(false);
    setNombre('');
  }

  return (
    <View style={{ gap: 8 }}>
      {rotulo && <Etiqueta derecha={tipo === 'gasto' && estados.size > 0 ? <Texto tam={13} color={c.tenue}>y lo que le queda</Texto> : undefined}>Categoría</Etiqueta>}
      <Grilla columnas={3}>
        {disponibles.map((cat) => {
          const activa = cat.id === valor;
          const t = estados.get(cat.id);
          const aviso = t ? (t.pasado ? 'te pasaste' : t.casiAlTope ? 'casi al tope' : `quedan ${dineroCorto(t.tope - t.gastado, d.moneda)}`) : null;
          return (
            <Pressable key={cat.id} onPress={() => { Haptics.selectionAsync(); alCambiar(cat.id); }}
              style={{ height: 54, borderRadius: 14, backgroundColor: c.suave, paddingHorizontal: 11,
                justifyContent: 'center', borderWidth: 2, borderColor: activa ? c.tinta : 'transparent', alignItems: 'flex-start', gap: 2 }}>
              <View style={{ gap: 1 }}>
                <Texto tam={14} peso={activa ? 'semi' : 'medio'} lineas={1}>{cat.nombre}</Texto>
                {aviso && <Texto tam={12} peso={t?.pasado || t?.casiAlTope ? 'semi' : 'normal'} color={t?.pasado || t?.casiAlTope ? c.alerta : c.tenue} lineas={1}>{aviso}</Texto>}
              </View>
            </Pressable>
          );
        })}
        <Pressable key="nueva" onPress={() => setNueva((v) => !v)} accessibilityLabel="Nueva categoría"
          style={{ height: 54, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.linea,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Icono nombre={nueva ? 'cerrar' : 'mas'} tam={16} color={c.tenue} />
          <Texto tam={14} color={c.tenue}>{nueva ? 'Cerrar' : 'Nueva'}</Texto>
        </Pressable>
      </Grilla>
      {nueva && (
        <View style={{ backgroundColor: c.suave, borderRadius: 16, padding: 12, gap: 12 }}>
          <Campo value={nombre} onChangeText={setNombre} placeholder={`Nombre de la categoría de ${tipo}s`} autoFocus
            style={{ backgroundColor: c.tarjeta }} returnKeyType="done" onSubmitEditing={crear} />
          <Colores valor={color} alCambiar={setColor} />
          <Pressable onPress={crear} style={{ height: 44, borderRadius: 14, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
            <Texto tam={15} peso="semi" color={c.sobreBoton}>Crear categoría</Texto>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Elegir una cuenta: tarjetas de colores con su saldo. */
export function ElegirCuenta({ valor, alCambiar, rotulo }: { valor: string; alCambiar: (id: string) => void; rotulo?: string }) {
  const d = useDatos();
  const { c, colorCuenta } = useTema();
  return (
    <View style={{ gap: 8 }}>
      {rotulo && <Etiqueta>{rotulo}</Etiqueta>}
      <Grilla columnas={3}>
        {d.cuentas.map((cu) => {
          const activa = cu.id === valor;
          const tocar = () => { Haptics.selectionAsync(); alCambiar(cu.id); };
          const fondo = colorCuenta(cu.color);
          const tinta = sobre(fondo);
          return (
            <Pressable key={cu.id} onPress={tocar} accessibilityState={{ selected: activa }}
              style={{ borderRadius: 17, padding: 2, borderWidth: 2, borderColor: activa ? c.tinta : 'transparent' }}>
              <View style={{ height: 56, borderRadius: 13, backgroundColor: fondo, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'space-between' }}>
                <Texto tam={14} peso="semi" color={tinta} lineas={1} style={{ paddingRight: activa ? 18 : 0 }}>{cu.nombre}</Texto>
                <Num tam={12} peso="medio" color={tinta} lineas={1} style={{ opacity: 0.86 }}>{dineroCorto(saldo(cu, d.movimientos), d.moneda)}</Num>
                {activa && (
                  <View style={{ position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                    <Icono nombre="check" tam={12} color="#15181D" grosor={3} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </Grilla>
    </View>
  );
}

/** Una fila que se abre para mostrar opciones debajo (Se repite, Cuenta, Categoría...). */
export function Desplegable({ icono, texto, valor, abierto, alTocar, children, primera = true }: {
  icono?: 'repetir'; texto: string; valor: string; abierto: boolean; alTocar: () => void; children?: ReactNode; primera?: boolean;
}) {
  const { c } = useTema();
  return (
    <View style={{ borderTopWidth: primera ? 0 : 1, borderTopColor: c.tarjeta }}>
      <Pressable onPress={alTocar} style={({ pressed }) => ({ height: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}>
        {icono && <Icono nombre={icono} tam={18} color={c.tinta} />}
        <Texto tam={15} style={{ flex: 1 }}>{texto}</Texto>
        <Texto tam={15} color={c.tenue} lineas={1} style={{ maxWidth: '55%' }}>{valor}</Texto>
        <Icono nombre={abierto ? 'abajo' : 'adelante'} tam={16} color={c.tenue} grosor={2} />
      </Pressable>
      {abierto && children ? <View style={{ marginHorizontal: 8, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: c.tarjeta }}>{children}</View> : null}
    </View>
  );
}
