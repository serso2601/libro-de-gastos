import { useState } from 'react';
import { useDatos } from './datos';
import type { Movimiento } from './tipos';

/** El mes que se está mirando (empieza en el de hoy) y su clave 'YYYY-MM'. */
export function useMes() {
  const { hoy } = useDatos();
  const [y, m] = hoy.split('-').map(Number);
  const [mes, setMes] = useState({ anio: y, mes: m });
  const clave = `${mes.anio}-${String(mes.mes).padStart(2, '0')}`;
  return { ...mes, clave, cambiar: (anio: number, nuevo: number) => setMes({ anio, mes: nuevo }) };
}

export function sumar(movs: Movimiento[], tipo: 'gasto' | 'ingreso') {
  return movs.reduce((s, m) => s + (m.tipo === tipo ? m.monto : 0), 0);
}
