import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { Grilla } from '@/dialogos/piezas';
import { useAcciones } from '@/lib/acciones';
import { useAlmacen, useDatos } from '@/lib/datos';
import { conSigno, dineroCorto, fechaISO, inicialDe } from '@/lib/formato';
import type { TipoCategoria } from '@/lib/tipos';
import { textoRegla } from '@/pantallas/Proximos';
import { BotonSuave, Campo, FilaSimple, Inicial, Lista, Segmentos, Tarjeta, Texto, TituloSeccion } from '@/ui/componentes';
import { ACENTOS, ESTILOS, ORDEN_ESTILOS, type IdEstilo } from '@/ui/estilos';
import { Icono } from '@/ui/iconos';
import { Marco, ProveedorApilada, useIr } from '@/ui/pantalla';
import { crearTema, usePreferencias, useTema, type Modo } from '@/ui/tema';

function mover(ids: string[], i: number, delta: number): string[] {
  const copia = [...ids];
  [copia[i], copia[i + delta]] = [copia[i + delta], copia[i]];
  return copia;
}

function Ordenar({ alSubir, alBajar }: { alSubir?: () => void; alBajar?: () => void }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Pressable onPress={alSubir} disabled={!alSubir} hitSlop={4} accessibilityLabel="Subir" style={{ width: 30, height: 44, alignItems: 'center', justifyContent: 'center', opacity: alSubir ? 1 : 0.25 }}>
        <Icono nombre="arriba" tam={16} color={c.tenue} grosor={2.2} />
      </Pressable>
      <Pressable onPress={alBajar} disabled={!alBajar} hitSlop={4} accessibilityLabel="Bajar" style={{ width: 30, height: 44, alignItems: 'center', justifyContent: 'center', opacity: alBajar ? 1 : 0.25 }}>
        <Icono nombre="abajo" tam={16} color={c.tenue} grosor={2.2} />
      </Pressable>
    </View>
  );
}

/** La miniatura de un estilo, dibujada con sus propios colores. */
function Miniatura({ id }: { id: IdEstilo }) {
  const { oscuro } = useTema();
  const t = crearTema(ESTILOS[id], oscuro, null);
  const p = t.c;
  const caja = (estilo: object, fondo: string, key?: string) => <View key={key} style={[{ position: 'absolute', borderRadius: 7, backgroundColor: fondo }, estilo]} />;
  const calor = (lista: number[], rampa: string[]) => (
    <View style={{ position: 'absolute', left: 8, right: 8, top: 10, padding: 6, borderRadius: 7, backgroundColor: p.tarjeta, gap: 3 }}>
      {[0, 7, 14].map((desde) => (
        <View key={desde} style={{ flexDirection: 'row', gap: 3 }}>
          {lista.slice(desde, desde + 7).map((n, i) => <View key={i} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: rampa[n] }} />)}
        </View>
      ))}
    </View>
  );
  const PATRON = [0, 2, 1, 0, 3, 1, 2, 4, 0, 2, 1, 3, 0, 1, 2, 3, 0, 2, 4, 1, 0];
  let dibujo: ReactNode;
  if (id === 'billetera') {
    dibujo = <>{caja({ left: 8, right: 8, top: 10, height: 26 }, t.colorCuenta('#1C1C21'))}{caja({ left: 8, right: 8, top: 22, height: 26 }, '#0F6E50')}{caja({ left: 8, right: 8, top: 34, height: 36 }, p.acento)}{caja({ left: 8, right: 8, top: 76, height: 18, borderRadius: 5 }, p.tarjeta)}{caja({ left: 0, right: 0, bottom: 0, height: 12, borderRadius: 0 }, p.tarjeta)}</>;
  } else if (id === 'mosaico') {
    const b = ESTILOS.mosaico.bloques!;
    const tono = (k: keyof typeof b) => (oscuro ? t.relleno(b[k].base) : b[k].claro);
    dibujo = <>{caja({ left: 8, right: 8, top: 10, height: 26 }, p.heroe)}{caja({ left: 8, width: '40%', top: 40, height: 30 }, tono('lavanda'))}{caja({ right: 8, width: '40%', top: 40, height: 30 }, tono('durazno'))}{caja({ left: 8, width: '40%', top: 74, height: 30 }, tono('menta'))}{caja({ right: 8, width: '40%', top: 74, height: 30 }, tono('limon'))}</>;
  } else if (id === 'calendario') {
    dibujo = <>{calor(PATRON, p.calor)}{caja({ left: 8, right: 8, top: 64, height: 8, borderRadius: 3 }, p.tarjeta)}{caja({ left: 8, right: 30, top: 78, height: 8, borderRadius: 3 }, p.tarjeta)}{caja({ left: 8, right: 28, bottom: 8, height: 14 }, p.tarjeta)}{caja({ right: 8, bottom: 8, width: 14, height: 14 }, p.boton)}</>;
  } else if (id === 'cartera') {
    dibujo = <>{caja({ left: 8, right: 8, top: 10, height: 22 }, t.colorCuenta('#2A2C33'))}{caja({ left: 8, right: 8, top: 20, height: 22 }, '#1D6A51')}{caja({ left: 8, right: 8, top: 30, height: 32 }, p.acento)}{caja({ left: 8, width: '40%', top: 68, height: 26 }, p.tarjeta)}{caja({ right: 8, width: '40%', top: 68, height: 26 }, p.tarjeta)}</>;
  } else {
    dibujo = <>{calor(PATRON.map((n) => Math.min(n, 4)), [p.suave, ...p.calor.slice(1)])}{caja({ left: 8, width: '40%', top: 66, height: 28 }, t.relleno(p.acento))}{caja({ right: 8, width: '40%', top: 66, height: 28 }, oscuro ? t.relleno('#3DB386') : '#E2F1EA')}</>;
  }
  return <View style={{ height: 108, borderRadius: 12, backgroundColor: p.fondo, overflow: 'hidden' }}>{dibujo}</View>;
}

/** Traer el respaldo .json de la app vieja: primero muestra qué va a entrar y después importa. */
function Importar() {
  const { pedirYa, recargar } = useAlmacen();
  const { c } = useTema();
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
    <>
      <TituloSeccion>Traer datos de la app vieja</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 12 }}>
        <Texto tam={13.5} color={c.tenue} style={{ lineHeight: 20 }}>
          En la app vieja: Configuración → Exportar mis datos → Guardar en Archivos. Después elige aquí ese archivo. Solo funciona con la base vacía.
        </Texto>
        <BotonSuave onPress={elegir}>Elegir archivo .json</BotonSuave>
        {mensaje ? <Texto tam={12.5} color={c.tenue}>{mensaje}</Texto> : null}
      </Tarjeta>
    </>
  );
}

export default function Ajustes() {
  const { estilo } = useTema();
  return <ProveedorApilada volver={estilo.inicio}><ContenidoAjustes /></ProveedorApilada>;
}

function ContenidoAjustes() {
  const d = useDatos();
  const { conexion, desconectar, pedirYa, estado } = useAlmacen();
  const abrir = useAbrir();
  const ir = useIr();
  const acciones = useAcciones();
  const { c, estilo } = useTema();
  const prefs = usePreferencias();
  const [moneda, setMoneda] = useState(d.moneda);

  const categoriasDe = (tipo: TipoCategoria) => d.categorias.filter((x) => x.tipo === tipo);
  const reordenarCategorias = (tipo: TipoCategoria, ids: string[]) => {
    const otras = d.categorias.filter((x) => x.tipo !== tipo).map((x) => x.id);
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

  function verTutorial() {
    prefs.marcarTutorial(estilo.id, false);
    router.dismissTo('/');
  }

  return (
    <Marco titulo="Ajustes" gap={0}>
      <TituloSeccion>Estilo</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 12 }}>
        <Grilla columnas={3} gap={10}>
          {ORDEN_ESTILOS.map((id) => {
            const elegido = id === estilo.id;
            return (
              <Pressable key={id} onPress={() => { Haptics.selectionAsync(); prefs.cambiar({ estilo: id }); }} accessibilityState={{ selected: elegido }} accessibilityLabel={`Estilo ${ESTILOS[id].nombre}`}
                style={{ gap: 6, marginBottom: 4 }}>
                <View style={{ borderRadius: 14, padding: 2, borderWidth: 2, borderColor: elegido ? c.tinta : 'transparent' }}>
                  <Miniatura id={id} />
                  {elegido && (
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: c.tinta, alignItems: 'center', justifyContent: 'center' }}>
                      <Icono nombre="check" tam={12} color={c.tarjeta} grosor={3} />
                    </View>
                  )}
                </View>
                <Texto tam={12.5} peso={elegido ? 'semi' : 'medio'} style={{ lineHeight: 16, paddingHorizontal: 2 }}>{ESTILOS[id].nombre}</Texto>
              </Pressable>
            );
          })}
        </Grilla>
        <Texto tam={12.5} color={c.tenue}>Cambia cómo se ve la app. Tus datos no cambian.</Texto>
      </Tarjeta>

      <TituloSeccion>Apariencia</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Texto tam={13} peso="medio" color={c.tenue}>Modo</Texto>
          <Segmentos<Modo> opciones={[['sistema', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]} valor={prefs.modo} alCambiar={(modo) => prefs.cambiar({ modo })} />
        </View>
        <View style={{ gap: 10 }}>
          <Texto tam={13} peso="medio" color={c.tenue}>Color principal</Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[null, ...ACENTOS].map((color) => {
              const muestra = color ?? estilo.claro.acento;
              const elegido = prefs.acento === color;
              return (
                <Pressable key={color ?? 'estilo'} onPress={() => { Haptics.selectionAsync(); prefs.cambiar({ acento: color }); }}
                  accessibilityLabel={color ? `Color ${color}` : 'El color del estilo'} accessibilityState={{ selected: elegido }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: elegido ? c.tinta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: muestra, alignItems: 'center', justifyContent: 'center' }}>
                    {color === null && <Texto tam={9} peso="negrita" color="#FFFFFF">auto</Texto>}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Texto tam={12.5} color={c.tenue}>«auto» usa el color propio de cada estilo. Los colores de cada cuenta y categoría se cambian tocándolas abajo.</Texto>
        </View>
        <BotonSuave icono="libro" onPress={verTutorial}>Ver cómo funciona {estilo.nombre}</BotonSuave>
      </Tarjeta>

      {d.movimientos.length === 0 && <Importar />}

      <TituloSeccion accion={{ texto: 'Ver próximos', onPress: () => ir('proximos', 'Ajustes') }}>Se repiten</TituloSeccion>
      <Lista>
        {d.recurrencias.length === 0 && <Texto tam={13.5} color={c.tenue} style={{ paddingVertical: 14 }}>Nada se repite todavía. Al anotar algo, elige «Se repite».</Texto>}
        {d.recurrencias.map((r, i) => (
          <FilaSimple key={r.id} primera={i === 0}
            izquierda={<View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.suave, alignItems: 'center', justifyContent: 'center' }}><Icono nombre="repetir" tam={15} color={c.tenue} /></View>}
            texto={r.nota || d.categorias.find((x) => x.id === r.categoria_id)?.nombre || 'Transferencia'}
            detalle={`${conSigno(r.monto, d.moneda, r.tipo)} · ${textoRegla(r, d).toLowerCase()}`} onPress={() => abrir({ tipo: 'recurrencia', regla: r })} />
        ))}
      </Lista>

      <TituloSeccion accion={{ texto: '+ Agregar', onPress: () => abrir({ tipo: 'cuenta' }) }}>Cuentas</TituloSeccion>
      <Lista>
        {d.cuentas.map((x, i) => {
          const ids = d.cuentas.map((y) => y.id);
          return (
            <FilaSimple key={x.id} primera={i === 0} texto={x.nombre} onPress={() => abrir({ tipo: 'cuenta', inicial: x })}
              izquierda={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.color }} />}
              derecha={<Ordenar alSubir={i > 0 ? () => acciones.ordenar('cuentas', mover(ids, i, -1)) : undefined}
                alBajar={i < ids.length - 1 ? () => acciones.ordenar('cuentas', mover(ids, i, 1)) : undefined} />} />
          );
        })}
      </Lista>

      {(['gasto', 'ingreso'] as TipoCategoria[]).map((tipo) => {
        const lista = categoriasDe(tipo);
        const ids = lista.map((x) => x.id);
        return (
          <View key={tipo}>
            <TituloSeccion accion={{ texto: '+ Agregar', onPress: () => abrir({ tipo: 'categoria', tipoInicial: tipo }) }}>
              {tipo === 'gasto' ? 'Categorías de gastos' : 'Categorías de ingresos'}
            </TituloSeccion>
            <Lista>
              {lista.length === 0 && <Texto tam={13.5} color={c.tenue} style={{ paddingVertical: 14 }}>Ninguna todavía.</Texto>}
              {lista.map((x, i) => (
                <FilaSimple key={x.id} primera={i === 0} texto={x.nombre} onPress={() => abrir({ tipo: 'categoria', inicial: x })}
                  detalle={x.presupuesto ? `tope ${dineroCorto(x.presupuesto, d.moneda)} al mes` : undefined}
                  izquierda={<Inicial texto={inicialDe(x.nombre)} color={x.color} tam={30} />}
                  derecha={<Ordenar alSubir={i > 0 ? () => reordenarCategorias(tipo, mover(ids, i, -1)) : undefined}
                    alBajar={i < lista.length - 1 ? () => reordenarCategorias(tipo, mover(ids, i, 1)) : undefined} />} />
              ))}
            </Lista>
          </View>
        );
      })}

      <TituloSeccion>Moneda</TituloSeccion>
      <Tarjeta style={{ padding: 14, flexDirection: 'row', gap: 8 }}>
        <Campo value={moneda} onChangeText={setMoneda} maxLength={4} style={{ flex: 1, height: 44 }} accessibilityLabel="Símbolo de la moneda" />
        <Pressable onPress={() => { acciones.guardarMoneda(moneda.trim() || '$'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
          style={({ pressed }) => ({ height: 44, paddingHorizontal: 20, borderRadius: 14, backgroundColor: c.boton, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <Texto tam={15} peso="semi" color={c.sobreBoton}>Guardar</Texto>
        </Pressable>
      </Tarjeta>

      <TituloSeccion>Respaldo</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 12 }}>
        <Texto tam={13.5} color={c.tenue} style={{ lineHeight: 20 }}>La PC guarda una copia de la base cada día. Además puedes sacar todo en un archivo .json.</Texto>
        <BotonSuave icono="exportar" onPress={exportar}>Exportar todo</BotonSuave>
      </Tarjeta>

      <TituloSeccion>Conexión</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: estado === 'ok' ? c.bien : c.alerta }} />
          <Texto tam={14}>{estado === 'ok' ? 'Conectado a la PC por Tailscale' : estado === 'token-malo' ? 'La PC no reconoce la clave' : 'Sin conexión con la PC ahora'}</Texto>
        </View>
        <Texto tam={12.5} color={c.tenue}>PC: {conexion?.direccion}. Lo que anotes sin señal se manda solo cuando vuelva.</Texto>
        <BotonSuave color={c.alerta} style={{ marginTop: 8 }} onPress={() => Alert.alert('¿Desconectar este teléfono?', 'Los datos siguen en la PC. Para volver hay que escanear el QR otra vez.',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desconectar', style: 'destructive', onPress: () => { desconectar(); router.dismissAll(); } }])}>
          Desconectar este teléfono
        </BotonSuave>
      </Tarjeta>
      <View style={{ height: 12 }} />
    </Marco>
  );
}
