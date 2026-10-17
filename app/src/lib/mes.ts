import { useEffect, useRef, useState } from 'react';
import { claveMes } from './calculos';
import { useDatos } from './datos';
import { MESES, mayuscula } from './formato';

/** El mes que se está mirando (empieza en el de hoy), su clave 'YYYY-MM' y su nombre. */
export function useMes() {
  const { hoy } = useDatos();
  const [y, m] = hoy.split('-').map(Number);
  const [mes, setMes] = useState({ anio: y, mes: m });
  const clave = claveMes(mes.anio, mes.mes);
  const deHoy = useRef(hoy.slice(0, 7));
  useEffect(() => {
    const nuevo = hoy.slice(0, 7);
    if (nuevo !== deHoy.current && clave === deHoy.current) setMes({ anio: y, mes: m });
    deHoy.current = nuevo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy]);
  return {
    ...mes,
    clave,
    nombre: mayuscula(MESES[mes.mes - 1]),
    esActual: clave === hoy.slice(0, 7),
    esFuturo: clave > hoy.slice(0, 7),
    cambiar: (anio: number, nuevo: number) => setMes({ anio, mes: nuevo }),
    mover: (delta: number) => {
      const d = new Date(mes.anio, mes.mes - 1 + delta, 1);
      setMes({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
    },
  };
}

export type Mes = ReturnType<typeof useMes>;
