// La vista «Calendario» del Inicio: el mes con lo que entró (verde) y salió (rojo) en cada día, tres
// datos del mes arriba y, abajo, los movimientos del día elegido. El día elegido es el que usa el
// botón + de la barra para anotar. En una pantalla ancha, el mes va a la izquierda y el día a la derecha.

import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { claveMes, diasDelMes, netoDe } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import { CabeceraDia, Dato, Enlace, FilaMovimiento, Num, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { useDisposicion } from '@/ui/disposicion';
import { ElegirMes, useDiaElegido } from '@/ui/elegirMes';
import { Icono } from '@/ui/iconos';
import { FilaViva, ListaViva } from '@/ui/filaViva';
import { useIr } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';
import { Deslizar } from '@/ui/deslizar';

const GAP = 4;
const ALTO_CELDA = 58;
const ALTO_CELDA_ANCHA = 72;

/** Un monto sin símbolo ni centavos para que quepa en la celda: 45, 1.2k, 12k, 1.5M. */
function compacto(centavos: number): string {
  const u = Math.round(centavos / 100);
  if (u < 1000) return String(Math.max(u, 1));
  if (u < 10_000) return `${(u / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (u < 1_000_000) return `${Math.round(u / 1000)}k`;
  return `${(u / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function Calendario() {
  const d = useDatos();
  const abrir = useAbrir();
  const ir = useIr();
  const mes = useMes();
  const { c } = useTema();
  const { columnaInicio } = useDisposicion();
  const altoCelda = columnaInicio && columnaInicio >= 400 ? ALTO_CELDA_ANCHA : ALTO_CELDA;
  const { setFecha } = useDiaElegido();
  const [elegirMes, setElegirMes] = useState(false);
  const [dia, setDia] = useState(d.hoy);

  const dias = diasDelMes(mes.anio, mes.mes);
  const primero = (new Date(mes.anio, mes.mes - 1, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const filas = Math.ceil((primero + dias) / 7);
  // Al cambiar de mes se elige hoy (si es el mes actual) o el día 1.
  const diaDeInicio = mes.esActual ? d.hoy : `${mes.clave}-01`;
  const elegido = dia.startsWith(mes.clave) ? dia : diaDeInicio;
  useEffect(() => {
    setDia(elegido);
    setFecha(elegido);
  }, [elegido, setFecha]);
  useEffect(() => () => setFecha(null), [setFecha]);

  // Lo que entró y salió cada día; las transferencias no cuentan.
  const porDia = useMemo(() => {
    const r = Array.from({ length: dias }, () => ({ entro: 0, salio: 0 }));
    for (const m of d.movimientos) {
      if (m.tipo === 'transferencia' || !m.fecha.startsWith(mes.clave)) continue;
      const x = r[Number(m.fecha.slice(8, 10)) - 1];
      if (m.tipo === 'ingreso') x.entro += m.monto;
      else x.salio += m.monto;
    }
    return r;
  }, [d.movimientos, mes.clave, dias]);
  const entro = porDia.reduce((s, x) => s + x.entro, 0);
  const salio = porDia.reduce((s, x) => s + x.salio, 0);
  const balance = entro - salio;

  const delDia = d.movimientos.filter((m) => m.fecha === elegido).sort(ordenarPorFecha);
  // Se puede mirar hasta el mes que viene, como en el selector de meses.
  const [anioHoy, mesHoy] = d.hoy.split('-').map(Number);
  const hayAdelante = mes.anio * 12 + mes.mes < anioHoy * 12 + mesHoy + 1;

  const flecha = (delta: number, activa: boolean) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); mes.mover(delta); }} disabled={!activa} hitSlop={6} accessibilityLabel={delta < 0 ? 'Mes anterior' : 'Mes siguiente'}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: activa ? 1 : 0.3 }}>
      <Icono nombre={delta < 0 ? 'atras' : 'adelante'} tam={20} color={c.tinta} grosor={2} />
    </Pressable>
  );

  const elMes = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {flecha(-1, true)}
        <Pressable onPress={() => setElegirMes(true)} hitSlop={8} accessibilityLabel={`${mes.nombre} ${mes.anio}: elegir otro mes`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.6 : 1 })}>
          <Texto tam={20} peso="semi">{mes.nombre} {mes.anio}</Texto>
          <Icono nombre="abajo" tam={16} color={c.tenue} grosor={2} />
        </Pressable>
        {flecha(1, hayAdelante)}
      </View>

      <Deslizar clave={mes.clave}>
      <View style={{ gap: 16 }}>
      <Tarjeta style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
        <Dato rotulo="Entró" valor={neto(entro, d.moneda)} color={c.ingreso} />
        <Dato rotulo="Salió" valor={neto(salio, d.moneda)} color={c.gasto} />
        <Dato rotulo="Balance" valor={neto(balance, d.moneda, true)} color={balance < 0 ? c.gasto : balance > 0 ? c.ingreso : c.tinta} />
      </Tarjeta>

      <View style={{ gap: GAP }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <Texto key={i} tam={11} peso="semi" color={c.tenue} centro style={{ flex: 1 }}>{x}</Texto>)}
        </View>
        {Array.from({ length: filas }, (_, k) => (
          <View key={k} style={{ flexDirection: 'row', gap: GAP }}>
            {Array.from({ length: 7 }, (_, i) => {
              const n = k * 7 + i - primero + 1;
              if (n < 1 || n > dias) return <View key={i} style={{ flex: 1, height: altoCelda }} />;
              const fecha = `${claveMes(mes.anio, mes.mes)}-${String(n).padStart(2, '0')}`;
              const x = porDia[n - 1];
              const futuro = fecha > d.hoy;
              const esHoy = fecha === d.hoy;
              const esElegido = fecha === elegido;
              return (
                <Pressable key={i} onPress={() => { Haptics.selectionAsync(); setDia(fecha); setFecha(fecha); }}
                  accessibilityLabel={`${tituloDia(fecha, d.hoy)}${futuro ? '' : `: entró ${neto(x.entro, d.moneda)}, salió ${neto(x.salio, d.moneda)}`}`}
                  style={{ flex: 1, height: altoCelda, borderRadius: 10, backgroundColor: c.tarjeta, paddingHorizontal: 5, paddingVertical: 4, gap: 1,
                    borderWidth: 2, borderColor: esElegido ? c.tinta : esHoy ? c.acento : 'transparent', opacity: futuro ? 0.55 : 1 }}>
                  <Texto num tam={12} peso={esHoy ? 'negrita' : 'medio'} color={futuro ? c.tenue : c.tinta}>{n}</Texto>
                  {!futuro && x.entro > 0 ? <Num tam={11} peso="medio" color={c.ingreso} lineas={1}>{compacto(x.entro)}</Num> : null}
                  {!futuro && x.salio > 0 ? <Num tam={11} peso="medio" color={c.gasto} lineas={1}>{compacto(x.salio)}</Num> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      </View>
      </Deslizar>
    </>
  );

  const elDia = (
    <>
      <View style={{ gap: 8 }}>
        <CabeceraDia titulo={tituloDia(elegido, d.hoy)} derecha={delDia.length ? neto(netoDe(delDia), d.moneda, true) : undefined} />
        {delDia.length === 0 ? (
          <Tarjeta><Vacio>Nada anotado este día.</Vacio></Tarjeta>
        ) : (
          <ListaViva>
            {delDia.map((m, i) => (
              <FilaViva key={m.id} id={m.id} orden={i} vez={0}>
                <FilaMovimiento m={m} primera={i === 0} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
              </FilaViva>
            ))}
          </ListaViva>
        )}
      </View>

      <View style={{ alignItems: 'center' }}>
        <Enlace onPress={() => ir('movimientos')}>Ver todo</Enlace>
      </View>
    </>
  );

  return (
    <>
      {columnaInicio ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
          <View style={{ width: columnaInicio, gap: 16 }}>{elMes}</View>
          <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{elDia}</View>
        </View>
      ) : (
        <>
          {elMes}
          {elDia}
        </>
      )}

      <ElegirMes visible={elegirMes} anio={mes.anio} mes={mes.mes} hoy={d.hoy} alElegir={mes.cambiar} alCerrar={() => setElegirMes(false)} />
    </>
  );
}
