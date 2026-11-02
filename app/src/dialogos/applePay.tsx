// Cómo anotar solo cada pago con Apple Pay: un Atajo del iPhone (automatización «Transacción») le avisa a la PC.
// No hace falta la cuenta de pago de Apple. La hoja da los pasos y deja copiar lo que hay que pegar en el Atajo.

import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';
import { leerConexion } from '@/lib/api';
import { copiarTexto } from '@/lib/copiar';
import { useDatos } from '@/lib/datos';
import { avisar } from '@/ui/aviso';
import { Enlace, Etiqueta, Hoja, Tarjeta, Texto } from '@/ui/componentes';
import { Tocable } from '@/ui/tocable';
import { useTema } from '@/ui/tema';
import { ElegirCuenta } from './piezas';

/** Un dato para pegar en el Atajo: su nombre, el valor (se puede seleccionar) y el botón «Copiar». */
export function Copiable({ rotulo, valor }: { rotulo: string; valor: string }) {
  const { c } = useTema();
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    Haptics.selectionAsync();
    const ok = await copiarTexto(valor);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } else {
      avisar('No se pudo copiar', 'Selecciona el texto y cópialo a mano.');
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <Texto tam={13} peso="medio" color={c.tenue}>{rotulo}</Texto>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, backgroundColor: c.suave, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Texto tam={13} selectable style={{ flexShrink: 1 }}>{valor}</Texto>
        </View>
        <Tocable onPress={copiar} accessibilityLabel={`Copiar ${rotulo}`}
          style={{ height: 40, minWidth: 72, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
          <Texto tam={13} peso="semi" color={c.sobreBoton}>{copiado ? 'Copiado' : 'Copiar'}</Texto>
        </Tocable>
      </View>
    </View>
  );
}

/** Un paso: número, título y lo que hay que hacer (en una tarjeta). */
export function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center' }}>
          <Texto num tam={13} peso="semi" color={c.sobreBoton}>{n}</Texto>
        </View>
        <Texto tam={15} peso="semi" style={{ flex: 1 }}>{titulo}</Texto>
      </View>
      <Tarjeta color={c.suave} style={{ padding: 14, gap: 10 }}>{children}</Tarjeta>
    </View>
  );
}

/** Una línea de instrucción. */
export function Linea({ children }: { children: React.ReactNode }) {
  return <Texto tam={14} style={{ lineHeight: 20 }}>{children}</Texto>;
}

/** Un campo del cuerpo del Atajo: la clave que se escribe a la izquierda y qué va en «Texto». */
function Campo({ clave, valor, detalle }: { clave: string; valor: string; detalle?: string }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 96, backgroundColor: c.tarjeta, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
        <Texto tam={13} peso="semi" selectable>{clave}</Texto>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 5, gap: 2 }}>
        <Texto tam={14} peso="medio">{valor}</Texto>
        {detalle ? <Texto tam={12} color={c.tenue} style={{ lineHeight: 17 }}>{detalle}</Texto> : null}
      </View>
    </View>
  );
}

export function DialogoApplePay({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const { c } = useTema();
  const conexion = leerConexion();
  const [cuentaId, setCuentaId] = useState(() => (d.cuentas.find((x) => x.terminacion) ?? d.cuentas[0])?.id ?? '');
  const cuenta = d.cuentas.find((x) => x.id === cuentaId);
  const direccion = conexion ? `http://${conexion.direccion.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/api/entrada` : '';

  return (
    <Hoja titulo="Anotar con Apple Pay" alCerrar={alCerrar} derecha={<Enlace tam={17} onPress={alCerrar}>Listo</Enlace>}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        Cada vez que pagues con el iPhone, un Atajo le avisa a la PC y el gasto se anota solo. No hace falta la cuenta de pago de Apple.
      </Texto>

      <ElegirCuenta rotulo="¿Con qué cuenta pagas?" valor={cuentaId} alCambiar={setCuentaId} />
      {cuenta && !cuenta.terminacion && (
        <Texto tam={13} color={c.tenue}>Ponle los 4 dígitos de la tarjeta a esta cuenta (al editarla): así la PC sabe de cuál es cada pago.</Texto>
      )}

      <Etiqueta>Se arma una sola vez, en la app Atajos del iPhone</Etiqueta>

      <Paso n={1} titulo="Crear la automatización">
        <Linea>Abre Atajos → pestaña «Automatización» → «+» → «Transacción».</Linea>
        <Linea>Elige la tarjeta con la que pagas{cuenta ? ` (la de ${cuenta.nombre})` : ''}. Categorías y comercios: déjalos en «Cualquiera».</Linea>
        <Linea>Deja prendido «Automatización»: así corre sola, sin preguntarte. «Notificar» es opcional: te avisa cada vez que se anota un pago.</Linea>
      </Paso>

      <Paso n={2} titulo="Encender Tailscale por si está apagado">
        <Linea>En la barra «Buscar» de abajo escribe «VPN» y agrega «Configurar VPN» (o la de Tailscale «Conectar»). Ponla en «Conectar» · «Tailscale».</Linea>
        <Linea>Busca «Esperar» y agrégala con 2 segundos: la VPN tarda un momento en conectarse.</Linea>
      </Paso>

      <Paso n={3} titulo="Mandar el pago a la PC">
        <Linea>Busca y agrega «Obtener contenido de URL». Toca «URL» y pega esta dirección:</Linea>
        {conexion ? <Copiable rotulo="Dirección" valor={direccion} /> : (
          <Texto tam={13} color={c.tenue}>Conecta la app a la PC para ver la dirección y la clave.</Texto>
        )}
        <Linea>Toca la flechita junto a la dirección para ver las opciones. Método: «POST».</Linea>
        <Linea>En «Encabezados» → «Agregar nuevo encabezado». En «Clave» escribe Authorization y en «Texto» pega esto:</Linea>
        {conexion ? <Copiable rotulo="Texto del encabezado (es tu llave: no la compartas)" valor={`Bearer ${conexion.token}`} /> : null}
        <Linea>En «Solicitar cuerpo» deja «JSON» y toca 4 veces «Agregar nuevo campo», eligiendo «Texto» cada vez. Llénalos así:</Linea>
        <View style={{ gap: 8 }}>
          <Campo clave="origen" valor="escribe: wallet" />
          <Campo clave="monto" valor="la variable «Cantidad»"
            detalle="Toca «Texto» → «Seleccionar variable» (arriba del teclado) → toca el bloque «Cuando se use…» → toca la burbuja azul que aparece → «Cantidad»." />
          <Campo clave="comercio" valor="la variable «Comercio»" detalle="Igual que monto, pero en la burbuja eliges «Comercio»." />
          <Campo clave="terminacion" valor={cuenta?.terminacion ? `escribe: ${cuenta.terminacion}` : 'los 4 dígitos de la tarjeta'} />
        </View>
        {cuenta && !cuenta.terminacion && (
          <Texto tam={13} color={c.tenue}>Ponle los 4 dígitos de la tarjeta a {cuenta.nombre} (al editar la cuenta): así la PC sabe de qué cuenta es cada pago.</Texto>
        )}
      </Paso>

      <Paso n={4} titulo="Revisar el orden y probar">
        <Linea>De arriba abajo debe quedar: «Cuando se use tu tarjeta» → «Configurar VPN: Conectar Tailscale» → «Esperar 2 s» → «Obtener contenido de URL». Si no, arrástralas.</Linea>
        <Linea>Para probar, paga algo pequeño con el iPhone y abre la app: aparece el gasto con el nombre del comercio. El botón ▶ del Atajo no sirve para probar: sin un pago de verdad no hay monto.</Linea>
      </Paso>

      <Paso n={5} titulo="Mejor aún: Tailscale siempre conectado">
        <Linea>En la app Tailscale, activa «VPN On Demand» (VPN a pedido): se conecta solo, también después de reiniciar o cambiar de red.</Linea>
        <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>Si la PC está apagada cuando pagas, ese gasto no llega: anótalo a mano.</Texto>
      </Paso>
    </Hoja>
  );
}
