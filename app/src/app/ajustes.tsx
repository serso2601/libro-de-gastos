import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAbrir } from '@/dialogos/abrir';
import { useAcciones } from '@/lib/acciones';
import { useAlmacen, useDatos } from '@/lib/datos';
import { dinero, etiquetaCorta, fechaISO } from '@/lib/formato';
import { FRECUENCIAS, type TipoCategoria } from '@/lib/tipos';
import { Boton, Campo, Separador, Tarjeta, Texto } from '@/ui/componentes';
import { C } from '@/ui/tema';

function Seccion({ titulo, accion, children }: { titulo: string; accion?: { texto: string; onPress: () => void }; children: ReactNode }) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, marginBottom: 6, marginTop: 8 }}>
        <Texto tam={12} peso="semi" color={C.tenue} style={{ letterSpacing: 0.6 }}>{titulo.toUpperCase()}</Texto>
        {accion && <Pressable onPress={accion.onPress} hitSlop={8}><Texto tam={13} peso="semi" color={C.acentoClaro}>{accion.texto}</Texto></Pressable>}
      </View>
      <Tarjeta style={{ paddingHorizontal: 14, paddingVertical: 4 }}>{children}</Tarjeta>
    </>
  );
}

function Fila({ izquierda, texto, detalle, onPress, alSubir, alBajar, primera }: {
  izquierda?: ReactNode; texto: string; detalle?: string; onPress: () => void; alSubir?: () => void; alBajar?: () => void; primera: boolean;
}) {
  return (
    <>
      {!primera && <Separador />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }}>
        {izquierda}
        <Pressable onPress={onPress} style={{ flex: 1 }}>
          <Texto lineas={1}>{texto}</Texto>
          {detalle ? <Texto tam={12} color={C.tenue} lineas={1}>{detalle}</Texto> : null}
        </Pressable>
        {(alSubir || alBajar) && (
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <Pressable onPress={alSubir} disabled={!alSubir} hitSlop={6} style={{ padding: 4, opacity: alSubir ? 1 : 0.2 }}><Texto color={C.tenue}>▲</Texto></Pressable>
            <Pressable onPress={alBajar} disabled={!alBajar} hitSlop={6} style={{ padding: 4, opacity: alBajar ? 1 : 0.2 }}><Texto color={C.tenue}>▼</Texto></Pressable>
          </View>
        )}
        <Pressable onPress={onPress} hitSlop={6}><Texto tam={18} color={C.tenue}>›</Texto></Pressable>
      </View>
    </>
  );
}

function mover(ids: string[], i: number, delta: number): string[] {
  const copia = [...ids];
  [copia[i], copia[i + delta]] = [copia[i + delta], copia[i]];
  return copia;
}

/** Traer el respaldo .json de la app vieja: primero muestra qué va a entrar y después importa. */
function Importar() {
  const { pedirYa, recargar } = useAlmacen();
  const [mensaje, setMensaje] = useState('');

  async function elegir() {
    setMensaje('');
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled) return;
    try {
      const json = JSON.parse(await new File(r.assets[0].uri).text());
      const v = (await pedirYa('POST', '/api/importar?simular=true', json)) as Record<string, number>;
      const futuras = v.futuras_descartadas > 0
        ? `\n\n${v.futuras_descartadas} movimientos futuros que la app vieja había creado por adelantado no se copian: las reglas los anotan cuando llegue su fecha.`
        : '';
      Alert.alert('¿Importar esto?',
        `${v.movimientos} movimientos · ${v.cuentas} cuentas · ${v.categorias} categorías\n${v.recurrencias} cosas que se repiten (${v.recurrencias_abiertas} siguen activas)${futuras}`,
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Importar', onPress: async () => {
          try {
            await pedirYa('POST', '/api/importar', json);
            await recargar();
            setMensaje('Listo: tus datos ya están en la PC.');
          } catch (e) { setMensaje(e instanceof Error ? e.message : String(e)); }
        } }]);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Seccion titulo="Traer datos de la app vieja">
      <Texto tam={13} color={C.tenue} style={{ paddingVertical: 10 }}>
        En la app vieja: Configuración → Exportar mis datos → Guardar en Archivos. Después elige aquí ese archivo. Solo funciona con la base vacía.
      </Texto>
      <Boton tipo="suave" onPress={elegir}>Elegir archivo .json</Boton>
      {mensaje ? <Texto tam={12} color={C.tenue} style={{ marginBottom: 10 }}>{mensaje}</Texto> : null}
    </Seccion>
  );
}

export default function Ajustes() {
  const d = useDatos();
  const { conexion, desconectar, pedirYa } = useAlmacen();
  const abrir = useAbrir();
  const acciones = useAcciones();
  const [moneda, setMoneda] = useState(d.moneda);
  const insets = useSafeAreaInsets();

  const categoriasDe = (tipo: TipoCategoria) => d.categorias.filter((c) => c.tipo === tipo);
  const reordenarCategorias = (tipo: TipoCategoria, ids: string[]) => {
    const otras = d.categorias.filter((c) => c.tipo !== tipo).map((c) => c.id);
    acciones.ordenar('categorias', tipo === 'gasto' ? [...ids, ...otras] : [...otras, ...ids]);
  };

  async function exportar() {
    try {
      const todo = await pedirYa('GET', '/api/exportar');
      const archivo = new File(Paths.cache, `gastos-${fechaISO(new Date())}.json`);
      if (archivo.exists) archivo.delete();
      archivo.create();
      archivo.write(JSON.stringify(todo, null, 2));
      await Sharing.shareAsync(archivo.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.fondo }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Texto tam={16} color={C.acentoClaro}>‹ Volver</Texto></Pressable>
      </View>
      <Texto tam={26} peso="negrita" style={{ marginBottom: 8 }}>Ajustes</Texto>

      {d.movimientos.length === 0 && <Importar />}

      <Seccion titulo="Se repiten">
        {d.recurrencias.length === 0 && <Texto tam={13} color={C.tenue} style={{ paddingVertical: 12 }}>Nada se repite todavía. Al anotar algo, elige «Repetir».</Texto>}
        {d.recurrencias.map((r, i) => {
          const cat = d.categorias.find((c) => c.id === r.categoria_id);
          const frec = FRECUENCIAS.find(([f]) => f === r.frecuencia)?.[1].toLowerCase();
          const terminada = !!r.fecha_fin && r.fecha_fin < d.hoy;
          const proximo = d.proximos.find((p) => p.recurrencia_id === r.id);
          const detalle = `${dinero(r.monto, d.moneda)} ${frec}` + (terminada ? ' · terminó' : proximo ? ` · próxima ${etiquetaCorta(proximo.fecha)}` : '');
          return <Fila key={r.id} primera={i === 0} izquierda={<Texto tam={17}>{r.tipo === 'transferencia' ? '⇄' : cat?.emoji ?? '🔁'}</Texto>}
            texto={r.nota || cat?.nombre || 'Transferencia'} detalle={detalle} onPress={() => abrir({ tipo: 'recurrencia', regla: r })} />;
        })}
      </Seccion>

      <Seccion titulo="Cuentas" accion={{ texto: '+ Agregar', onPress: () => abrir({ tipo: 'cuenta' }) }}>
        {d.cuentas.map((c, i) => {
          const ids = d.cuentas.map((x) => x.id);
          return <Fila key={c.id} primera={i === 0} izquierda={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />}
            texto={c.nombre} onPress={() => abrir({ tipo: 'cuenta', inicial: c })}
            alSubir={i > 0 ? () => acciones.ordenar('cuentas', mover(ids, i, -1)) : undefined}
            alBajar={i < ids.length - 1 ? () => acciones.ordenar('cuentas', mover(ids, i, 1)) : undefined} />;
        })}
      </Seccion>

      {(['gasto', 'ingreso'] as TipoCategoria[]).map((tipo) => {
        const lista = categoriasDe(tipo);
        const ids = lista.map((c) => c.id);
        return (
          <Seccion key={tipo} titulo={tipo === 'gasto' ? 'Categorías de gastos' : 'Categorías de ingresos'}
            accion={{ texto: '+ Agregar', onPress: () => abrir({ tipo: 'categoria', tipoInicial: tipo }) }}>
            {lista.map((c, i) => (
              <Fila key={c.id} primera={i === 0} izquierda={<Texto tam={17}>{c.emoji}</Texto>} texto={c.nombre}
                onPress={() => abrir({ tipo: 'categoria', inicial: c })}
                alSubir={i > 0 ? () => reordenarCategorias(tipo, mover(ids, i, -1)) : undefined}
                alBajar={i < lista.length - 1 ? () => reordenarCategorias(tipo, mover(ids, i, 1)) : undefined} />
            ))}
          </Seccion>
        );
      })}

      <Seccion titulo="Moneda">
        <View style={{ flexDirection: 'row', gap: 8, paddingTop: 12 }}>
          <Campo value={moneda} onChangeText={setMoneda} maxLength={4} style={{ flex: 1 }} />
          <Boton onPress={() => acciones.guardarMoneda(moneda.trim() || '$')} style={{ paddingHorizontal: 20, marginBottom: 16 }}>Guardar</Boton>
        </View>
      </Seccion>

      <Seccion titulo="Respaldo">
        <Texto tam={13} color={C.tenue} style={{ paddingVertical: 10 }}>La PC guarda una copia de la base cada día. Además puedes sacar todo en un .json.</Texto>
        <Boton tipo="suave" onPress={exportar}>Exportar todo</Boton>
      </Seccion>

      <Seccion titulo="Conexión">
        <Texto tam={13} color={C.tenue} style={{ paddingVertical: 10 }}>PC: {conexion?.direccion}</Texto>
        <Boton tipo="peligro" onPress={() => Alert.alert('¿Desconectar este teléfono?', 'Los datos siguen en la PC. Para volver hay que escanear el QR otra vez.',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desconectar', style: 'destructive', onPress: () => { desconectar(); router.replace('/conectar'); } }])}>
          Desconectar
        </Boton>
      </Seccion>
    </ScrollView>
  );
}
