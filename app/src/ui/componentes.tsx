// Las piezas de todas las pantallas. Cada una lee el tema en uso (claro u oscuro, color principal),
// así que las pantallas no tienen que saber de colores ni de letras.

import * as Haptics from 'expo-haptics';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatos } from '@/lib/datos';
import { montoEnCuenta, type FormaSaldo } from '@/lib/calculos';
import { conSigno, neto } from '@/lib/formato';
import type { Movimiento, Proximo, TipoMovimiento } from '@/lib/tipos';
import { COLUMNA_WEB, ESTILO, PALETA, type Peso } from './estilos';
import { Icono, type NombreIcono } from './iconos';
import { alfa, sobre, useTema, type Colores as ColoresTema } from './tema';

/** La letra de un peso. Los montos van en la misma letra, con cifras de ancho fijo (`tabular-nums`). */
export function familia(peso: Peso): string {
  return ESTILO.fuentes[peso];
}

export function Texto({ children, tam = 15, peso = 'normal', num = false, color, style, lineas, centro, ajustar }: {
  children: ReactNode; tam?: number; peso?: Peso; num?: boolean; color?: string; style?: StyleProp<TextStyle>; lineas?: number; centro?: boolean;
  /** Achica la letra para que entre en `lineas` en vez de cortar con «…» (montos). */
  ajustar?: boolean;
}) {
  const { c } = useTema();
  return (
    <Text numberOfLines={lineas} adjustsFontSizeToFit={ajustar} minimumFontScale={ajustar ? 0.6 : undefined} style={[{
      fontFamily: familia(peso), fontSize: tam, color: color ?? c.tinta,
      fontVariant: num ? ['tabular-nums'] : undefined, textAlign: centro ? 'center' : undefined,
    }, style]}>
      {children}
    </Text>
  );
}

/** Un monto: cifras de ancho fijo y el peso de cifras del estilo. */
export function Num({ children, tam = 15, peso, color, style, lineas }: {
  children: ReactNode; tam?: number; peso?: Peso; color?: string; style?: StyleProp<TextStyle>; lineas?: number;
}) {
  const { estilo } = useTema();
  const p = peso ?? (tam >= 28 ? estilo.m.pesoCifraGrande : estilo.m.pesoCifra);
  return <Texto num tam={tam} peso={p} color={color} lineas={lineas} ajustar={!!lineas} style={[tam >= 22 && { letterSpacing: tam >= 30 ? -1.2 : -0.4 }, style]}>{children}</Texto>;
}

export function Tarjeta({ children, style, color, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; color?: string; onPress?: () => void }) {
  const { estilo, c } = useTema();
  const base: ViewStyle = { backgroundColor: color ?? c.tarjeta, borderRadius: estilo.m.esquinas };
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.75 }]}>{children}</Pressable>;
  return <View style={[base, style]}>{children}</View>;
}

/** Una tarjeta con filas separadas por una línea fina. */
export function Lista({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Tarjeta style={[{ paddingHorizontal: 16, paddingVertical: 2 }, style]}>{children}</Tarjeta>;
}

export function Linea() {
  const { c } = useTema();
  return <View style={{ height: 1, backgroundColor: c.linea }} />;
}

export function BotonRedondo({ icono, onPress, etiqueta, fondo, color, tam = 44 }: {
  icono: NombreIcono; onPress: () => void; etiqueta: string; fondo?: string; color?: string; tam?: number;
}) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityLabel={etiqueta} hitSlop={4}
      style={({ pressed }) => ({ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: fondo ?? c.tarjeta, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icono nombre={icono} tam={18} color={color ?? c.tinta} />
    </Pressable>
  );
}

export function BotonPrincipal({ children, onPress, style, alto = 56 }: { children: ReactNode; onPress: () => void; style?: StyleProp<ViewStyle>; alto?: number }) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ height: alto, borderRadius: 16, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }, style]}>
      <Texto tam={17} peso="semi" color={c.sobreBoton}>{children}</Texto>
    </Pressable>
  );
}

export function BotonSuave({ children, onPress, icono, color, style }: { children: ReactNode; onPress: () => void; icono?: NombreIcono; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ height: 46, borderRadius: 14, backgroundColor: c.suave, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}>
      {icono && <Icono nombre={icono} tam={17} color={color ?? c.tinta} />}
      <Texto tam={15} peso="semi" color={color}>{children}</Texto>
    </Pressable>
  );
}

/** El botón de texto rojo de abajo de una hoja: «Borrar cuenta», «Quitar el tope». */
export function BotonBorrar({ texto, onPress }: { texto: string; onPress: () => void }) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Texto tam={15} peso="semi" color={c.alerta}>{texto}</Texto>
    </Pressable>
  );
}

export function Enlace({ children, onPress, color, tam = 13 }: { children: ReactNode; onPress: () => void; color?: string; tam?: number }) {
  const { c } = useTema();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      <Texto tam={tam} peso="semi" color={color ?? c.acento}>{children}</Texto>
    </Pressable>
  );
}

/** Opciones en una cápsula (Gasto / Ingreso / Transferencia). */
export function Segmentos<T extends string>({ opciones, valor, alCambiar }: { opciones: [T, string][]; valor: T; alCambiar: (v: T) => void }) {
  const { c } = useTema();
  const r = 14;
  return (
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: c.suave, borderRadius: r, padding: 4 }}>
      {opciones.map(([id, texto]) => {
        const activo = id === valor;
        return (
          <Pressable key={id} onPress={() => { Haptics.selectionAsync(); alCambiar(id); }}
            style={{ flex: 1, height: 36, borderRadius: r - 3, alignItems: 'center', justifyContent: 'center', backgroundColor: activo ? c.boton : 'transparent' }}>
            <Texto tam={15} peso={activo ? 'semi' : 'normal'} color={activo ? c.sobreBoton : c.tenue} lineas={1} ajustar>{texto}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Ficha({ texto, activa, onPress, ancho, alto = 40, children, compacta }: {
  texto?: string; activa: boolean; onPress: () => void; ancho?: number | `${number}%`; alto?: number; children?: ReactNode; compacta?: boolean;
}) {
  const { c } = useTema();
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => ({ height: alto, paddingHorizontal: compacta ? 4 : 14, borderRadius: alto / 2, width: ancho, backgroundColor: activa ? c.boton : c.suave,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.75 : 1 })}>
      {children}
      {texto !== undefined && <Texto tam={14} peso={activa ? 'semi' : 'normal'} color={activa ? c.sobreBoton : c.tinta} lineas={1} ajustar={compacta}>{texto}</Texto>}
    </Pressable>
  );
}

/** Un campo de texto. Letra de 16: se lee bien y iOS no agranda la pantalla al tocarlo. */
/**
 * Un campo de texto. El texto de ejemplo no es el `placeholder` de iOS: con Onest (mucho espacio
 * arriba de las letras) iOS lo dibuja corrido. Se dibuja aparte, con la misma letra que el resto, y
 * se esconde al escribir. `style` es la caja (alto, fondo, márgenes, textAlign).
 */
export function Campo({ style, placeholder, value, ...props }: TextInputProps) {
  const { c, oscuro } = useTema();
  const caja = StyleSheet.flatten([{ height: 48, borderRadius: 14, backgroundColor: c.suave, paddingHorizontal: 14 }, style]) as TextStyle;
  const { paddingHorizontal, paddingLeft, paddingRight, textAlign, fontSize = 16, color, paddingVertical: _pv, ...resto } = caja;
  const izquierda = paddingLeft ?? paddingHorizontal ?? 0;
  const derecha = paddingRight ?? paddingHorizontal ?? 0;
  const letra = { fontFamily: familia('normal'), fontSize, textAlign };
  return (
    <View style={resto}>
      {!value && placeholder ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: izquierda, right: derecha, top: 0, bottom: 0, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={[letra, { color: c.tenue }]}>{placeholder}</Text>
        </View>
      ) : null}
      <TextInput keyboardAppearance={oscuro ? 'dark' : 'light'} {...props} value={value} accessibilityHint={props.accessibilityHint ?? placeholder}
        style={[letra, { flex: 1, paddingLeft: izquierda, paddingRight: derecha, paddingVertical: 0, color: color ?? c.tinta }]} />
    </View>
  );
}

/** El buscador de Movimientos y de una cuenta: lupa y campo, centrados en una cápsula de 46. */
export function Buscador({ valor, alCambiar, placeholder, fondo, autoFocus }: {
  valor: string; alCambiar: (v: string) => void; placeholder: string; fondo?: string; autoFocus?: boolean;
}) {
  const { c } = useTema();
  return (
    <View style={{ height: 46, borderRadius: 14, backgroundColor: fondo ?? c.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14 }}>
      <Icono nombre="buscar" tam={18} color={c.tenue} />
      <Campo value={valor} onChangeText={alCambiar} placeholder={placeholder} autoFocus={autoFocus} clearButtonMode="while-editing" returnKeyType="search"
        style={{ flex: 1, height: 46, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
    </View>
  );
}

/** Solo cifras, un separador decimal y dos decimales: «12..5» no llega a guardarse. */
export function limpiarMonto(t: string): string {
  const s = t.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const i = s.indexOf('.');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
}

/** El monto grande y centrado de las hojas de anotar. */
export function MontoGrande({ valor, alCambiar, moneda, autoFocus, color }: { valor: string; alCambiar: (v: string) => void; moneda: string; autoFocus?: boolean; color?: string }) {
  const { c, estilo, oscuro } = useTema();
  return (
    <TextInput value={valor ? moneda + valor : ''} placeholder={`${moneda}0.00`} placeholderTextColor={c.tenue} keyboardType="decimal-pad"
      keyboardAppearance={oscuro ? 'dark' : 'light'} autoFocus={autoFocus} accessibilityLabel="Monto"
      onChangeText={(t) => alCambiar(limpiarMonto(t.split(moneda).join('')))}
      style={{ fontFamily: familia(estilo.m.pesoCifraGrande), fontSize: 52, letterSpacing: -2, color: color ?? c.tinta,
        textAlign: 'center', paddingVertical: 0, fontVariant: ['tabular-nums'] }} />
  );
}

export function Colores({ valor, alCambiar }: { valor: string; alCambiar: (c: string) => void }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {PALETA.map((color) => (
        <Pressable key={color} onPress={() => { Haptics.selectionAsync(); alCambiar(color); }} accessibilityLabel={`Color ${color}`}
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: valor === color ? c.tinta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color }} />
        </Pressable>
      ))}
    </View>
  );
}

/** Rótulo de un grupo dentro de una hoja ("Categoría", "Cuenta"), con algo opcional a la derecha. */
export function Etiqueta({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 }}>
      <Texto tam={13} peso="medio" color={c.tenue}>{children}</Texto>
      {derecha}
    </View>
  );
}

/** Título de sección en mayúsculas (Ajustes). */
export function TituloSeccion({ children, accion }: { children: string; accion?: { texto: string; onPress: () => void } }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, marginTop: 18, marginBottom: 8 }}>
      <Texto tam={12} peso="semi" color={c.tenue} style={{ letterSpacing: 0.6 }}>{children.toUpperCase()}</Texto>
      {accion && <Enlace onPress={accion.onPress}>{accion.texto}</Enlace>}
    </View>
  );
}

/** Rótulo sobre una lista ("En los próximos 30 días"). */
export function Rotulo({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, minHeight: 22 }}>
      <Texto tam={13} peso="medio" color={c.tenue}>{children}</Texto>
      {derecha}
    </View>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  const { c } = useTema();
  return <Texto tam={14} color={c.tenue} centro style={{ paddingVertical: 18 }}>{children}</Texto>;
}

export function TextoError({ texto }: { texto: string }) {
  const { c } = useTema();
  return texto ? <Texto tam={13} color={c.alerta}>{texto}</Texto> : null;
}

/** Una letra sobre un fondo pastel (categorías). */
export function Inicial({ texto, color, tam = 36, redondo = false, solido = false }: { texto: string; color: string; tam?: number; redondo?: boolean; solido?: boolean }) {
  const { pastel, colorCuenta } = useTema();
  const fondo = solido ? colorCuenta(color) : pastel(color);
  return (
    <View style={{ width: tam, height: tam, borderRadius: redondo ? tam / 2 : Math.round(tam * 0.28), backgroundColor: fondo, alignItems: 'center', justifyContent: 'center' }}>
      <Texto tam={Math.round(tam * 0.4)} peso="semi" color={solido ? sobre(fondo) : undefined}>{texto}</Texto>
    </View>
  );
}

export function Barra({ pct, color, alto = 8, fondo }: { pct: number; color: string; alto?: number; fondo?: string }) {
  const { c } = useTema();
  return (
    <View style={{ height: alto, borderRadius: alto / 2, backgroundColor: fondo ?? c.suave, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(pct, 100))}%`, borderRadius: alto / 2, backgroundColor: color }} />
    </View>
  );
}

/** Un vaso de presupuesto: se llena desde abajo con un solo color, sin raya en el borde. */
export function Vaso({ nombre, sub, pct, aviso, alerta, relleno, alto, onPress, elegido, fondo, punto }: {
  nombre: string; sub: string; pct: number; aviso: string; alerta: boolean; relleno: string; alto: number;
  onPress: () => void; elegido?: boolean; fondo?: string; punto?: boolean;
}) {
  const { c, estilo } = useTema();
  const grande = alto >= 140;
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${nombre}: ${pct}%. ${aviso}`}
      style={({ pressed }) => ({ flex: 1, height: alto, borderRadius: estilo.m.esquinas - (grande ? 0 : 2), backgroundColor: fondo ?? c.tarjeta, overflow: 'hidden',
        borderWidth: elegido ? 2 : 0, borderColor: c.tinta, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.min(pct, 100)}%`, backgroundColor: relleno }} />
      <View style={{ flex: 1, padding: grande ? 14 : 12, paddingHorizontal: grande ? 16 : 14, justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <Texto tam={15} peso="semi" lineas={1}>{nombre}</Texto>
          <Texto num tam={13} color={c.tenue} lineas={1}>{sub}</Texto>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
            {punto && alerta && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.alerta }} />}
            <Texto num tam={12} peso={alerta ? 'semi' : 'medio'} color={alerta ? c.alerta : c.tenue} lineas={1}>{aviso}</Texto>
          </View>
          <Num tam={grande ? 24 : 20} peso={estilo.m.pesoCifraGrande}>{pct}%</Num>
        </View>
      </View>
    </Pressable>
  );
}

/** El navegador de meses en cápsula: ‹ Octubre 2026 › */
export function NavegadorMes({ nombre, anio, mover, puedeAdelante = true }: { nombre: string; anio: number; mover: (d: number) => void; puedeAdelante?: boolean }) {
  const { c } = useTema();
  const flecha = (d: number, icono: NombreIcono, activa: boolean) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); mover(d); }} disabled={!activa} accessibilityLabel={d < 0 ? 'Mes anterior' : 'Mes siguiente'}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: activa ? 1 : 0.35 }}>
      <Icono nombre={icono} tam={20} color={c.tinta} grosor={2} />
    </Pressable>
  );
  return (
    <View style={{ height: 44, borderRadius: 22, backgroundColor: c.tarjeta, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {flecha(-1, 'atras', true)}
      <Texto tam={15} peso="semi">{nombre} {anio}</Texto>
      {flecha(1, 'adelante', puedeAdelante)}
    </View>
  );
}

/** La cabecera de un día en una lista: «Hoy, viernes 16» y el neto. */
export function CabeceraDia({ titulo, derecha, calor }: { titulo: string; derecha?: string; calor?: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, height: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {calor && <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: calor, borderWidth: calor === c.calor[0] ? 1 : 0, borderColor: c.linea }} />}
        <Texto tam={13} peso="semi" color={c.tenue}>{titulo}</Texto>
      </View>
      {derecha && <Num tam={13} peso="medio" color={c.tenue}>{derecha}</Num>}
    </View>
  );
}

/**
 * Una fila de movimiento (o de un próximo). A la izquierda lleva la barra del color de la cuenta.
 * El monto va en verde si es ingreso, en rojo si es gasto y tenue si es transferencia.
 * Con `cuentaId`, el monto se muestra visto desde esa cuenta (lo que entra verde, lo que sale rojo)
 * y el detalle no repite la cuenta.
 */
export function FilaMovimiento({ m, onPress, cuentaId, primera, detalle, sinIcono }: {
  m: Pick<Movimiento | Proximo, 'tipo' | 'monto' | 'cuenta_id' | 'cuenta_destino_id' | 'categoria_id' | 'nota' | 'recurrencia_id'>;
  onPress?: () => void; cuentaId?: string; primera: boolean; detalle?: string; sinIcono?: boolean;
}) {
  const d = useDatos();
  const { c, colorCuenta } = useTema();
  const nombreCuenta = (id: string | null) => d.cuentas.find((a) => a.id === id)?.nombre ?? '?';
  const transferencia = m.tipo === 'transferencia';
  const cat = d.categorias.find((x) => x.id === m.categoria_id);
  const nombre = m.nota || (transferencia ? 'Transferencia' : cat?.nombre ?? 'Sin categoría');
  const sub = detalle ?? (transferencia
    ? `${nombreCuenta(m.cuenta_id)} → ${nombreCuenta(m.cuenta_destino_id)}`
    : cuentaId ? cat?.nombre ?? 'Sin categoría' : `${cat?.nombre ?? 'Sin categoría'} · ${nombreCuenta(m.cuenta_id)}`);
  const enCuenta = cuentaId ? montoEnCuenta(m as Movimiento, cuentaId) : 0;
  const monto = cuentaId ? neto(enCuenta, d.moneda, true) : conSigno(m.monto, d.moneda, m.tipo);
  const colorMonto = cuentaId ? (enCuenta > 0 ? c.ingreso : enCuenta < 0 ? c.gasto : c.tenue) : colorTipo(m.tipo, c);
  const cuentaColor = d.cuentas.find((a) => a.id === m.cuenta_id)?.color ?? c.tenue;

  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 6,
        borderTopWidth: primera ? 0 : 1, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
      {!sinIcono && <View style={{ width: 6, height: 28, borderRadius: 3, backgroundColor: colorCuenta(cuentaColor) }} />}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Texto tam={15} peso="medio" lineas={1} style={{ flexShrink: 1 }}>{nombre}</Texto>
          {m.recurrencia_id && <Icono nombre="repetir" tam={12} color={c.tenue} />}
        </View>
        <Texto tam={13} color={c.tenue} lineas={1}>{sub}</Texto>
      </View>
      <Num tam={15} color={colorMonto}>{monto}</Num>
    </Pressable>
  );
}

/**
 * Una hoja que sube desde abajo: la manija, «Cancelar», el título y, abajo y siempre a la vista,
 * el botón principal (`pie`).
 */
export function Hoja({ titulo, alCerrar, children, pie, derecha }: { titulo: string; alCerrar: () => void; children: ReactNode; pie?: ReactNode; derecha?: ReactNode }) {
  const { c, estilo } = useTema();
  const abajo = useSafeAreaInsets().bottom;
  // La hoja no empieza arriba de la pantalla: sin este corrimiento el teclado tapa el botón de abajo.
  const caja = useRef<ComponentRef<typeof View>>(null);
  const [arriba, setArriba] = useState(0);
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <View style={{ flex: 1, backgroundColor: COLUMNA_WEB ? c.fondo : c.tarjeta }}>
      <View ref={caja} style={[{ flex: 1, backgroundColor: c.tarjeta }, COLUMNA_WEB]} onLayout={() => caja.current?.measureInWindow((_x, y) => setArriba(Math.max(0, y)))}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={arriba} style={{ flex: 1 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: alfa(c.tenue, 0.35), marginTop: 8 }} />
        <View style={{ height: 44, marginHorizontal: estilo.m.margen, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Pressable onPress={alCerrar} hitSlop={10}><Texto tam={17} color={c.tenue}>Cancelar</Texto></Pressable>
          </View>
          <Texto tam={17} peso="semi" lineas={1} style={{ flexShrink: 1, maxWidth: '60%' }}>{titulo}</Texto>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>{derecha}</View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: estilo.m.margen, paddingTop: 6, paddingBottom: 20, gap: 14 }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {pie && <View style={{ paddingHorizontal: estilo.m.margen, paddingTop: 8, paddingBottom: Math.max(abajo, 16) + 4, gap: 6 }}>{pie}</View>}
      </KeyboardAvoidingView>
      </View>
      </View>
    </Modal>
  );
}

/** Una fila de ajustes o de una lista simple: algo a la izquierda, texto, detalle y flecha. */
export function FilaSimple({ izquierda, texto, detalle, onPress, derecha, primera, flecha = true }: {
  izquierda?: ReactNode; texto: string; detalle?: string; onPress?: () => void; derecha?: ReactNode; primera: boolean; flecha?: boolean;
}) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderTopWidth: primera ? 0 : 1, borderTopColor: c.linea }}>
      {izquierda}
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, paddingVertical: 8, gap: 2, opacity: pressed ? 0.6 : 1 })}>
        <Texto tam={15} lineas={1}>{texto}</Texto>
        {detalle ? <Texto tam={13} color={c.tenue} lineas={1}>{detalle}</Texto> : null}
      </Pressable>
      {derecha}
      {flecha && onPress && <Pressable onPress={onPress} hitSlop={8}><Icono nombre="adelante" tam={16} color={c.tenue} grosor={2} /></Pressable>}
    </View>
  );
}

/** Verde si es ingreso, rojo si es gasto, tenue si es transferencia. */
export function colorTipo(tipo: TipoMovimiento, c: ColoresTema): string {
  return tipo === 'ingreso' ? c.ingreso : tipo === 'gasto' ? c.gasto : c.tenue;
}

/** El color de una forma de ver el saldo: verde lo que entró, rojo lo gastado, y el balance según su signo. */
export function colorDeSaldo(f: Pick<FormaSaldo, 'tono' | 'valor'>, c: ColoresTema): string {
  if (f.tono === 'ingreso') return c.ingreso;
  if (f.tono === 'gasto') return c.gasto;
  if (f.tono === 'signo') return f.valor < 0 ? c.gasto : c.ingreso;
  return c.tinta;
}

/** Un dato chico con su rótulo arriba («Gastado» y el monto). */
export function Dato({ rotulo, valor, color, tam = 15 }: { rotulo: string; valor: string; color?: string; tam?: number }) {
  const { c } = useTema();
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Texto tam={12} peso="medio" color={c.tenue}>{rotulo}</Texto>
      <Num tam={tam} color={color} lineas={1}>{valor}</Num>
    </View>
  );
}
