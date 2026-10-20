import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { useAcciones } from '@/lib/acciones';
import { ORDEN_SALDOS, saldos } from '@/lib/calculos';
import { useAlmacen, useDatos } from '@/lib/datos';
import { conSigno, dineroCorto, fechaISO, neto } from '@/lib/formato';
import type { TipoCategoria } from '@/lib/tipos';
import { textoRegla } from '@/pantallas/Proximos';
import { BotonSuave, Campo, colorDeSaldo, FilaSimple, Lista, Num, Segmentos, Tarjeta, Texto, TituloSeccion } from '@/ui/componentes';
import { ACENTOS } from '@/ui/estilos';
import { Icono } from '@/ui/iconos';
import { Marco, ProveedorApilada } from '@/ui/pantalla';
import { SimboloCategoria } from '@/ui/simbolos';
import { usePreferencias, useTema, type Modo } from '@/ui/tema';

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

export default function Ajustes() {
  return <ProveedorApilada volver="Inicio"><ContenidoAjustes /></ProveedorApilada>;
}

function ContenidoAjustes() {
  const d = useDatos();
  const { conexion, desconectar, pedirYa, estado } = useAlmacen();
  const abrir = useAbrir();
  const acciones = useAcciones();
  const { c } = useTema();
  const prefs = usePreferencias();
  const [moneda, setMoneda] = useState(d.moneda);
  const formas = saldos(d);
  const acento = prefs.acento ?? ACENTOS[0];

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
    prefs.cambiar({ tutorialVisto: false });
    router.dismissTo('/');
  }

  return (
    <Marco titulo="Ajustes" gap={0}>
      <TituloSeccion>Apariencia</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Texto tam={13} peso="medio" color={c.tenue}>Modo</Texto>
          <Segmentos<Modo> opciones={[['sistema', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]} valor={prefs.modo} alCambiar={(modo) => prefs.cambiar({ modo })} />
        </View>
        <View style={{ gap: 10 }}>
          <Texto tam={13} peso="medio" color={c.tenue}>Color principal</Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ACENTOS.map((color, i) => {
              const elegido = acento === color;
              return (
                <Pressable key={color} onPress={() => { Haptics.selectionAsync(); prefs.cambiar({ acento: i === 0 ? null : color }); }}
                  accessibilityLabel={i === 0 ? 'Color de siempre' : `Color ${color}`} accessibilityState={{ selected: elegido }}
                  style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: elegido ? c.tinta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color }} />
                </Pressable>
              );
            })}
          </View>
          <Texto tam={13} color={c.tenue}>Los colores de cada cuenta y categoría se cambian tocándolas abajo.</Texto>
        </View>
        <BotonSuave icono="libro" onPress={verTutorial}>Ver cómo funciona</BotonSuave>
      </Tarjeta>

      <TituloSeccion>Saldo en Inicio</TituloSeccion>
      <Lista>
        {ORDEN_SALDOS.map((id, i) => {
          const f = formas[id];
          const elegido = prefs.saldo === id;
          return (
            <Pressable key={id} onPress={() => { Haptics.selectionAsync(); prefs.cambiar({ saldo: id }); }} accessibilityState={{ selected: elegido }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: elegido ? 0 : 1.5, borderColor: c.linea, backgroundColor: elegido ? c.boton : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {elegido && <Icono nombre="check" tam={13} color={c.sobreBoton} grosor={3} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Texto tam={15} peso={elegido ? 'semi' : 'normal'} lineas={1}>{f.rotulo}</Texto>
                <Texto tam={13} color={c.tenue} lineas={1}>{f.detalle}</Texto>
              </View>
              <Num tam={15} color={colorDeSaldo(f, c)}>{neto(f.valor, d.moneda, f.tono === 'signo')}</Num>
            </Pressable>
          );
        })}
      </Lista>

      <TituloSeccion>Se repiten</TituloSeccion>
      <Lista>
        {d.recurrencias.length === 0 && <Texto tam={14} color={c.tenue} style={{ paddingVertical: 14 }}>Nada se repite todavía. Al anotar algo, elige «Se repite».</Texto>}
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
              {lista.length === 0 && <Texto tam={14} color={c.tenue} style={{ paddingVertical: 14 }}>Ninguna todavía.</Texto>}
              {lista.map((x, i) => (
                <FilaSimple key={x.id} primera={i === 0} texto={x.nombre} onPress={() => abrir({ tipo: 'categoria', inicial: x })}
                  detalle={x.presupuesto ? `tope ${dineroCorto(x.presupuesto, d.moneda)} al mes` : undefined}
                  izquierda={<SimboloCategoria categoria={x} tam={30} />}
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
        <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>La PC guarda una copia de la base cada día. Además puedes sacar todo en un archivo .json.</Texto>
        <BotonSuave icono="exportar" onPress={exportar}>Exportar todo</BotonSuave>
      </Tarjeta>

      <TituloSeccion>Conexión</TituloSeccion>
      <Tarjeta style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: estado === 'ok' ? c.bien : c.alerta }} />
          <Texto tam={14}>{estado === 'ok' ? 'Conectado a la PC por Tailscale' : estado === 'token-malo' ? 'La PC no reconoce la clave' : 'Sin conexión con la PC ahora'}</Texto>
        </View>
        <Texto tam={13} color={c.tenue}>PC: {conexion?.direccion}. Lo que anotes sin señal se manda solo cuando vuelva.</Texto>
        <BotonSuave color={c.alerta} style={{ marginTop: 8 }} onPress={() => Alert.alert('¿Desconectar este teléfono?', 'Los datos siguen en la PC. Para volver hay que escanear el QR otra vez.',
          [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desconectar', style: 'destructive', onPress: () => { desconectar(); router.dismissAll(); } }])}>
          Desconectar este teléfono
        </BotonSuave>
      </Tarjeta>
      <View style={{ height: 12 }} />
    </Marco>
  );
}
