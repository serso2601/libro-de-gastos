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
function Copiable({ rotulo, valor }: { rotulo: string; valor: string }) {
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

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  const { c } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.suave, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Texto num tam={12} peso="semi">{n}</Texto>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>{children}</View>
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

      <View style={{ gap: 8 }}>
        <Etiqueta>Pasos en el iPhone</Etiqueta>
        <Tarjeta color={c.suave} style={{ padding: 14, gap: 12 }}>
          <Paso n={1}>
            <Texto tam={14}>Abre Atajos → Automatización → + → «Transacción». Elige tu tarjeta y «Ejecutar inmediatamente».</Texto>
          </Paso>
          <Paso n={2}>
            <Texto tam={14}>Agrega la acción «Obtener contenido de URL».</Texto>
          </Paso>
          <Paso n={3}>
            <Texto tam={14}>Pega la dirección de abajo. Método: POST. Encabezado «Authorization» con el valor de abajo. Cuerpo: JSON con estos campos:</Texto>
            <Texto tam={13} color={c.tenue}>origen = wallet</Texto>
            <Texto tam={13} color={c.tenue}>monto = la variable «Importe»</Texto>
            <Texto tam={13} color={c.tenue}>comercio = la variable «Comerciante»</Texto>
            <Texto tam={13} color={c.tenue}>terminacion = los 4 dígitos de abajo</Texto>
          </Paso>
          <Paso n={4}>
            <Texto tam={14}>Deja Tailscale prendido en el iPhone. En Tailscale, activa «VPN a pedido» para que no se apague.</Texto>
          </Paso>
        </Tarjeta>
      </View>

      <View style={{ gap: 12 }}>
        <Etiqueta>Lo que se pega</Etiqueta>
        {conexion ? (
          <>
            <Copiable rotulo="Dirección" valor={direccion} />
            <Copiable rotulo="Encabezado Authorization (valor)" valor={`Bearer ${conexion.token}`} />
          </>
        ) : (
          <Texto tam={13} color={c.tenue}>Conecta la app a la PC para ver la dirección y la clave.</Texto>
        )}
        {cuenta?.terminacion ? <Copiable rotulo={`Últimos 4 dígitos de ${cuenta.nombre}`} valor={cuenta.terminacion} /> : null}
      </View>
    </Hoja>
  );
}
