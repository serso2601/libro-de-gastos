import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { aFecha, dinero, fechaISO, horaTexto, MESES } from '@/lib/formato';
import type { Categoria, Cuenta, Movimiento, TipoMovimiento } from '@/lib/tipos';
import { alfa, C, FUENTES, PALETA } from './tema';

type Peso = 'normal' | 'medio' | 'semi' | 'negrita';

export function Texto({ children, tam = 14, peso = 'normal', mono = false, color = C.tinta, style, lineas }: {
  children: ReactNode; tam?: number; peso?: Peso; mono?: boolean; color?: string; style?: StyleProp<TextStyle>; lineas?: number;
}) {
  const familia = mono
    ? (peso === 'negrita' ? FUENTES.monoNegrita : peso === 'semi' ? FUENTES.monoSemi : FUENTES.monoMedio)
    : FUENTES[peso];
  return <Text numberOfLines={lineas} style={[{ fontFamily: familia, fontSize: tam, color }, style]}>{children}</Text>;
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[e.tarjeta, style]}>{children}</View>;
}

export function Placa({ color, children, tam = 40 }: { color: string; children: ReactNode; tam?: number }) {
  return (
    <View style={{ width: tam, height: tam, borderRadius: 12, backgroundColor: alfa(color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <Texto color={C.tenue} style={{ textAlign: 'center', paddingVertical: 20 }}>{children}</Texto>;
}

export function Separador() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.lineaFuerte }} />;
}

/** Una hoja que sube desde abajo (la hoja nativa de iOS), con título y botón de cerrar. */
export function Hoja({ titulo, visible = true, alCerrar, children }: { titulo: string; visible?: boolean; alCerrar: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.tarjeta }}>
        <View style={e.hojaCabecera}>
          <Texto tam={18} peso="negrita">{titulo}</Texto>
          <Pressable onPress={alCerrar} hitSlop={12}><Texto tam={15} peso="semi" color={C.acentoClaro}>Cerrar</Texto></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Texto tam={12} color={C.tenue} style={{ marginBottom: 6 }}>{children}</Texto>;
}

export function Campo(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.tenue} keyboardAppearance="dark" {...props} style={[e.campo, props.style]} />;
}

export function CampoMonto({ valor, alCambiar, moneda, autoFocus }: { valor: string; alCambiar: (v: string) => void; moneda: string; autoFocus?: boolean }) {
  return (
    <View style={[e.campo, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
      <Texto tam={22} mono color={C.tenue}>{moneda}</Texto>
      <TextInput value={valor} onChangeText={alCambiar} placeholder="0.00" placeholderTextColor={C.tenue} keyboardType="decimal-pad"
        keyboardAppearance="dark" autoFocus={autoFocus}
        style={{ flex: 1, fontFamily: FUENTES.monoSemi, fontSize: 26, color: C.tinta, paddingVertical: 12, marginLeft: 4 }} />
    </View>
  );
}

export function CampoFecha({ valor, alCambiar, modo = 'date' }: { valor: string; alCambiar: (v: string) => void; modo?: 'date' | 'time' }) {
  const fecha = modo === 'date'
    ? aFecha(valor)
    : (() => { const d = new Date(); const [h, m] = (valor || '12:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; })();
  return (
    <DateTimePicker value={fecha} mode={modo} display="compact" themeVariant="dark" accentColor={C.acento} locale="es-PA"
      onChange={(_, d) => d && alCambiar(modo === 'date' ? fechaISO(d) : horaTexto(d))} />
  );
}

export function Selector<T extends string>({ opciones, valor, alCambiar, colores }: {
  opciones: [T, string][]; valor: T; alCambiar: (v: T) => void; colores?: Partial<Record<T, string>>;
}) {
  return (
    <View style={e.selector}>
      {opciones.map(([id, texto]) => {
        const activo = valor === id;
        return (
          <Pressable key={id} onPress={() => { Haptics.selectionAsync(); alCambiar(id); }}
            style={[e.selectorOpcion, activo && { backgroundColor: colores?.[id] ?? C.acento }]}>
            <Texto tam={13} peso="semi" color={activo ? C.blanco : C.tenue}>{texto}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Opciones en fila que se desliza (por ejemplo, las cuentas). */
export function Fichas<T extends { id: string; nombre: string; color: string }>({ opciones, valor, alCambiar }: { opciones: T[]; valor: string; alCambiar: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
      {opciones.map((o) => {
        const activa = o.id === valor;
        return (
          <Pressable key={o.id} onPress={() => { Haptics.selectionAsync(); alCambiar(o.id); }}
            style={[e.ficha, { borderColor: activa ? o.color : C.linea, backgroundColor: activa ? alfa(o.color, 0.15) : 'transparent' }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.color }} />
            <Texto tam={13} peso="medio" color={activa ? C.tinta : C.tenue}>{o.nombre}</Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Colores({ valor, alCambiar }: { valor: string; alCambiar: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      {PALETA.map((c) => (
        <Pressable key={c} onPress={() => alCambiar(c)}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 2, borderColor: valor === c ? C.tinta : 'transparent' }} />
      ))}
    </View>
  );
}

export function Boton({ children, onPress, tipo = 'principal', style }: {
  children: ReactNode; onPress: () => void; tipo?: 'principal' | 'peligro' | 'suave'; style?: StyleProp<ViewStyle>;
}) {
  const estilo = tipo === 'principal' ? { backgroundColor: C.acento }
    : tipo === 'peligro' ? { borderWidth: 1, borderColor: C.alerta }
    : { backgroundColor: C.tarjetaAlt };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [e.boton, estilo, pressed && { opacity: 0.7 }, style]}>
      <Texto tam={15} peso="semi" color={tipo === 'peligro' ? C.alerta : C.blanco}>{children}</Texto>
    </Pressable>
  );
}

export function TextoError({ texto }: { texto: string }) {
  return texto ? <Texto tam={13} color={C.alerta} style={{ marginBottom: 12 }}>{texto}</Texto> : null;
}

export const colorTipo = (t: TipoMovimiento) => (t === 'ingreso' ? C.bien : t === 'gasto' ? C.alerta : C.acentoClaro);
export const signoTipo = (t: TipoMovimiento) => (t === 'ingreso' ? '+' : t === 'gasto' ? '−' : '');

const SIN_CATEGORIA = { emoji: '💰', color: '#94A3B8', nombre: 'Sin categoría' };

/** Una fila de movimiento (o de un próximo, que tiene la misma forma). */
export function FilaMovimiento({ m, cuentas, categorias, moneda, onPress, debajoDelMonto }: {
  m: Pick<Movimiento, 'tipo' | 'monto' | 'cuenta_id' | 'cuenta_destino_id' | 'categoria_id' | 'nota' | 'recurrencia_id'>;
  cuentas: Cuenta[]; categorias: Categoria[]; moneda: string; onPress?: () => void; debajoDelMonto?: string;
}) {
  const cuenta = (id: string | null) => cuentas.find((a) => a.id === id)?.nombre ?? '?';
  const transferencia = m.tipo === 'transferencia';
  const cat = categorias.find((c) => c.id === m.categoria_id) ?? SIN_CATEGORIA;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [e.fila, pressed && { opacity: 0.6 }]}>
      <Placa color={transferencia ? C.acento : cat.color}>
        <Texto tam={transferencia ? 16 : 18} color={C.acentoClaro}>{transferencia ? '⇄' : cat.emoji}</Texto>
      </Placa>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto peso="medio" lineas={1}>{m.nota || (transferencia ? 'Transferencia' : cat.nombre)}{m.recurrencia_id ? '  🔁' : ''}</Texto>
        <Texto tam={12} color={C.tenue} lineas={1}>
          {transferencia ? `${cuenta(m.cuenta_id)} → ${cuenta(m.cuenta_destino_id)}` : `${cuenta(m.cuenta_id)} · ${cat.nombre}`}
        </Texto>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Texto mono peso="semi" color={colorTipo(m.tipo)}>{signoTipo(m.tipo)}{dinero(m.monto, moneda)}</Texto>
        {debajoDelMonto ? <Texto tam={11} color={C.tenue}>{debajoDelMonto}</Texto> : null}
      </View>
    </Pressable>
  );
}

export function NavegadorMes({ anio, mes, alCambiar }: { anio: number; mes: number; alCambiar: (anio: number, mes: number) => void }) {
  const mover = (delta: number) => {
    Haptics.selectionAsync();
    const d = new Date(anio, mes - 1 + delta, 1);
    alCambiar(d.getFullYear(), d.getMonth() + 1);
  };
  const nombre = MESES[mes - 1];
  return (
    <View style={e.navMes}>
      <Pressable onPress={() => mover(-1)} style={e.redondo} hitSlop={8}><Texto tam={18} color={C.tenue}>‹</Texto></Pressable>
      <Texto peso="semi">{nombre.charAt(0).toUpperCase() + nombre.slice(1)} {anio}</Texto>
      <Pressable onPress={() => mover(1)} style={e.redondo} hitSlop={8}><Texto tam={18} color={C.tenue}>›</Texto></Pressable>
    </View>
  );
}

export function Balance({ titulo, monto, moneda, tam = 34 }: { titulo: string; monto: number; moneda: string; tam?: number }) {
  return (
    <Tarjeta style={{ padding: 20 }}>
      <Texto peso="semi" style={{ marginBottom: 4 }}>{titulo}</Texto>
      <Texto tam={tam} mono peso="negrita" color={monto < 0 ? C.alerta : C.bien}>{dinero(monto, moneda)}</Texto>
    </Tarjeta>
  );
}

export function BarraProgreso({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.min((parte / total) * 100, 100) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: C.linea, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: parte > total ? C.alerta : C.acento }} />
    </View>
  );
}

export const e = StyleSheet.create({
  tarjeta: { backgroundColor: C.tarjeta, borderRadius: 16, marginBottom: 14 },
  hojaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  campo: { borderWidth: 1, borderColor: C.linea, backgroundColor: C.fondo, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.tinta, fontFamily: FUENTES.normal, fontSize: 15, marginBottom: 16 },
  selector: { flexDirection: 'row', borderWidth: 1, borderColor: C.linea, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  selectorOpcion: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  ficha: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  boton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  redondo: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center' },
});
