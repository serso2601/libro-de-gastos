// Cada cuánto se reinicia el presupuesto: semana, 2 semanas, quincena o mes, y desde cuándo.

import { useState } from 'react';
import { View } from 'react-native';
import { useAcciones } from '@/lib/acciones';
import { configPresupuesto, convertirTope, NOMBRES_PERIODO, nombrePeriodo, periodoDe, periodoVecino, POR_PERIODO } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero } from '@/lib/formato';
import type { ConfigPresupuesto, PeriodoPresupuesto } from '@/lib/tipos';
import { avisar } from '@/ui/aviso';
import { BotonPrincipal, Etiqueta, Ficha, Hoja, Texto } from '@/ui/componentes';
import { CalendarioFecha } from '@/ui/fecha';
import { useTema } from '@/ui/tema';
import { Grilla } from './piezas';

const PERIODOS: PeriodoPresupuesto[] = ['semanal', 'catorcenal', 'quincenal', 'mensual'];
/** Los días de la semana como los cuenta Date (0 domingo), empezando por el lunes. */
const SEMANA: [string, string][] = [['1', 'L'], ['2', 'M'], ['3', 'M'], ['4', 'J'], ['5', 'V'], ['6', 'S'], ['0', 'D']];
const NOMBRE_DIA: Record<string, string> = { '0': 'domingo', '1': 'lunes', '2': 'martes', '3': 'miércoles', '4': 'jueves', '5': 'viernes', '6': 'sábado' };

export function DialogoPeriodo({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const { c } = useTema();
  const { guardarPeriodo, guardarCategoria } = useAcciones();
  const actual = configPresupuesto(d);
  const [periodo, setPeriodo] = useState<PeriodoPresupuesto>(actual.periodo);
  // Cada periodo guarda su propio «desde cuándo»: al cambiar de ficha no se pierde lo que se eligió.
  const [diaSemana, setDiaSemana] = useState(actual.periodo === 'semanal' ? actual.inicio : '1');
  const [fecha, setFecha] = useState(actual.periodo === 'catorcenal' && actual.inicio ? actual.inicio : d.hoy);
  const [diaMes, setDiaMes] = useState(actual.periodo === 'mensual' ? actual.inicio : '1');

  const config: ConfigPresupuesto = {
    periodo,
    inicio: periodo === 'semanal' ? diaSemana : periodo === 'catorcenal' ? fecha : periodo === 'mensual' ? diaMes : '',
  };
  const periodoHoy = periodoDe(config, d.hoy);

  /** Convierte los topes si se quiso; el arrastre de «pasar lo que sobra» empieza de nuevo en el periodo de hoy. */
  function aplicar(convertir: boolean) {
    for (const cat of d.categorias) {
      const nueva = { ...cat };
      if (convertir && cat.presupuesto) nueva.presupuesto = Math.max(100, convertirTope(cat.presupuesto, actual.periodo, periodo));
      if (cat.acumula) nueva.acumula_desde = periodoHoy.desde;
      if (nueva.presupuesto !== cat.presupuesto || nueva.acumula_desde !== cat.acumula_desde) guardarCategoria(nueva);
    }
    alCerrar();
  }

  function guardar() {
    if (config.periodo === actual.periodo && config.inicio === actual.inicio) return alCerrar();
    guardarPeriodo(config);
    const primera = config.periodo !== actual.periodo ? d.categorias.find((x) => x.tipo === 'gasto' && x.presupuesto) : undefined;
    if (!primera?.presupuesto) return aplicar(false);
    const nuevo = Math.max(100, convertirTope(primera.presupuesto, actual.periodo, periodo));
    const ejemplo = `${primera.nombre}: ${dinero(primera.presupuesto, d.moneda)} ${POR_PERIODO[actual.periodo]} → ${dinero(nuevo, d.moneda)} ${POR_PERIODO[periodo]}`;
    avisar('¿Convertir tus topes?', `Tus topes están puestos ${POR_PERIODO[actual.periodo]}. Convertidos quedarían, por ejemplo:\n${ejemplo}`, [
      { text: 'Dejarlos igual', onPress: () => aplicar(false) },
      { text: 'Convertir', onPress: () => aplicar(true) },
    ]);
  }

  // Para que se entienda cada 2 semanas: el periodo que empieza ese día y el que sigue.
  const ancla = periodoDe(config, fecha);
  const siguiente = periodoVecino(config, ancla, 1);

  return (
    <Hoja titulo="Periodo del presupuesto" alCerrar={alCerrar} pie={<BotonPrincipal onPress={guardar}>Guardar periodo</BotonPrincipal>}>
      <Grilla columnas={2}>
        {PERIODOS.map((p) => <Ficha key={p} texto={NOMBRES_PERIODO[p]} activa={p === periodo} onPress={() => setPeriodo(p)} />)}
      </Grilla>

      {periodo === 'semanal' && (
        <View style={{ gap: 8 }}>
          <Etiqueta>¿En qué día empieza la semana?</Etiqueta>
          <Grilla columnas={7} gap={6}>
            {SEMANA.map(([v, letra]) => <Ficha key={v} texto={letra} activa={v === diaSemana} onPress={() => setDiaSemana(v)} compacta />)}
          </Grilla>
          <Texto tam={13} color={c.tenue}>Cada semana empieza el {NOMBRE_DIA[diaSemana]}.</Texto>
        </View>
      )}

      {periodo === 'catorcenal' && (
        <View style={{ gap: 8 }}>
          <Etiqueta>¿Cuándo empieza un periodo?</Etiqueta>
          <CalendarioFecha valor={fecha} alCambiar={setFecha} />
          <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>Duran 14 días: {nombrePeriodo(ancla)}, {nombrePeriodo(siguiente)}.</Texto>
        </View>
      )}

      {periodo === 'quincenal' && (
        <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>Del 1 al 15 y del 16 a fin de mes.</Texto>
      )}

      {periodo === 'mensual' && (
        <View style={{ gap: 8 }}>
          <Etiqueta>¿En qué día empieza el mes?</Etiqueta>
          <Grilla columnas={7} gap={6}>
            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((v) => <Ficha key={v} texto={v} activa={v === diaMes} onPress={() => setDiaMes(v)} compacta />)}
          </Grilla>
          <Texto tam={13} color={c.tenue} style={{ lineHeight: 18 }}>Útil si cobras a fin de mes: por ejemplo del 25 al 24.</Texto>
        </View>
      )}

      <View style={{ backgroundColor: c.suave, borderRadius: 14, padding: 14, gap: 2 }}>
        <Texto tam={13} color={c.tenue}>Así queda el periodo actual</Texto>
        <Texto tam={17} peso="semi">{nombrePeriodo(periodoHoy)}</Texto>
      </View>
      <Texto tam={13} color={c.tenue}>Si no cobras en fechas fijas, deja Cada mes.</Texto>
    </Hoja>
  );
}
