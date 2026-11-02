// Avisos de pago de las tarjetas de crédito: un Atajo del iPhone (automatización «Hora del día») le pregunta cada mañana
// a la PC si toca pagar y, si sí, muestra una notificación. La hoja da los pasos y deja probar la respuesta desde la app.

import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { base, leerConexion } from '@/lib/api';
import { Enlace, Etiqueta, Hoja, Texto } from '@/ui/componentes';
import { Tocable } from '@/ui/tocable';
import { useTema } from '@/ui/tema';
import { Copiable, Linea, Paso } from './applePay';

export function DialogoAvisoPagos({ alCerrar }: { alCerrar: () => void }) {
  const { c } = useTema();
  const conexion = leerConexion();
  const direccion = conexion ? `${base(conexion.direccion)}/api/avisos/pagos` : '';
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; error: boolean } | null>(null);

  async function probar() {
    if (!conexion || probando) return;
    setProbando(true);
    setResultado(null);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 8000);
    try {
      const r = await fetch(direccion, { signal: control.signal, headers: { Authorization: `Bearer ${conexion.token}` } });
      if (r.status === 401) setResultado({ texto: 'El token no es el de la PC.', error: true });
      else if (!r.ok) setResultado({ texto: `La PC respondió ${r.status}.`, error: true });
      else {
        const texto = (await r.text()).trim();
        setResultado({ texto: texto || 'Hoy no toca ningún aviso: el Atajo no mostrará nada.', error: false });
      }
    } catch {
      setResultado({ texto: 'No responde la PC. Revisa que esté prendida y que Tailscale esté conectado.', error: true });
    } finally {
      clearTimeout(reloj);
      setProbando(false);
    }
  }

  return (
    <Hoja titulo="Avisos de pago" alCerrar={alCerrar} derecha={<Enlace tam={17} onPress={alCerrar}>Listo</Enlace>}>
      <Texto tam={14} color={c.tenue} style={{ lineHeight: 20 }}>
        Un aviso en el iPhone unos días antes de pagar cada tarjeta, con el pago mínimo. Sale solo, sin abrir la app; los demás días no sale nada.
      </Texto>

      <Etiqueta>Se arma una sola vez, en la app Atajos del iPhone</Etiqueta>

      <Paso n={1} titulo="Crear la automatización">
        <Linea>Abre Atajos → pestaña «Automatización» → «+» → «Hora del día».</Linea>
        <Linea>Pon las 9:00 (o la hora que prefieras) y elige «Diariamente».</Linea>
        <Linea>Elige «Ejecutar inmediatamente»: así corre sola, sin preguntarte.</Linea>
      </Paso>

      <Paso n={2} titulo="Encender Tailscale por si está apagado">
        <Linea>En la barra «Buscar» de abajo escribe «VPN» y agrega «Configurar VPN» (o la de Tailscale «Conectar»). Ponla en «Conectar» · «Tailscale».</Linea>
        <Linea>Busca «Esperar» y agrégala con 2 segundos: la VPN tarda un momento en conectarse.</Linea>
      </Paso>

      <Paso n={3} titulo="Preguntarle a la PC">
        <Linea>Busca y agrega «Obtener contenido de URL». Toca «URL» y pega esta dirección:</Linea>
        {conexion ? <Copiable rotulo="Dirección" valor={direccion} /> : (
          <Texto tam={13} color={c.tenue}>Conecta la app a la PC para ver la dirección y la clave.</Texto>
        )}
        <Linea>Toca la flechita junto a la dirección para ver las opciones. Método: «GET» (el que viene).</Linea>
        <Linea>En «Encabezados» → «Agregar nuevo encabezado». En «Clave» escribe Authorization y en «Texto» pega esto:</Linea>
        {conexion ? <Copiable rotulo="Texto del encabezado (es tu llave: no la compartas)" valor={`Bearer ${conexion.token}`} /> : null}
      </Paso>

      <Paso n={4} titulo="Mostrar el aviso solo si toca">
        <Linea>Agrega «Si». En la condición elige la variable «Contenido de URL» y «tiene cualquier valor».</Linea>
        <Linea>Dentro del «Si», agrega «Mostrar notificación» y, como texto, toca «Contenido de URL» (la variable).</Linea>
        <Linea>De arriba abajo debe quedar: «Configurar VPN: Conectar Tailscale» → «Esperar 2 s» → «Obtener contenido de URL» → «Si Contenido de URL tiene cualquier valor» → «Mostrar notificación». Si no, arrástralas.</Linea>
      </Paso>

      <Paso n={5} titulo="Probar">
        <Linea>Toca «Probar ahora» para ver lo que la PC le contestaría hoy al Atajo.</Linea>
        <Tocable onPress={probar} disabled={!conexion || probando} accessibilityLabel="Probar ahora"
          style={{ height: 44, borderRadius: 12, backgroundColor: c.boton, alignItems: 'center', justifyContent: 'center', opacity: conexion ? 1 : 0.5 }}>
          {probando ? <ActivityIndicator color={c.sobreBoton} /> : <Texto tam={14} peso="semi" color={c.sobreBoton}>Probar ahora</Texto>}
        </Tocable>
        {resultado ? (
          <View style={{ backgroundColor: c.tarjeta, borderRadius: 12, padding: 12 }}>
            <Texto tam={13} selectable color={resultado.error ? c.alerta : undefined} style={{ lineHeight: 19 }}>{resultado.texto}</Texto>
          </View>
        ) : null}
        <Linea>En el Atajo también puedes tocar ▶ para probar. Si hoy no toca ningún pago, no sale notificación: es lo esperado.</Linea>
        <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>Si la PC está apagada a esa hora, ese día no llega el aviso.</Texto>
      </Paso>
    </Hoja>
  );
}
