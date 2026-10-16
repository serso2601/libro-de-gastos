// Lo mismo que devuelve el servidor en GET /api/datos. Montos en centavos, fechas 'YYYY-MM-DD'.

export type TipoMovimiento = 'gasto' | 'ingreso' | 'transferencia';
export type TipoCategoria = 'gasto' | 'ingreso';
export type Frecuencia = 'semanal' | 'quincenal' | 'mensual' | 'anual';

export interface Cuenta {
  id: string;
  nombre: string;
  color: string;
  saldo_inicial: number;
  orden: number;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  color: string;
  emoji: string;
  presupuesto: number | null;
  orden: number;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  fecha: string;
  hora: string | null;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  nota: string;
  recurrencia_id: string | null;
  origen: string;
}

export interface Recurrencia {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  nota: string;
  frecuencia: Frecuencia;
  fecha_inicio: string;
  fecha_fin: string | null;
  generada_hasta: string | null;
}

export interface Proximo {
  recurrencia_id: string;
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  nota: string;
}

export interface Datos {
  hoy: string;
  moneda: string;
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimientos: Movimiento[];
  recurrencias: Recurrencia[];
  proximos: Proximo[];
}

export const FRECUENCIAS: [Frecuencia, string][] = [
  ['semanal', 'Cada semana'],
  ['quincenal', 'Cada 2 semanas'],
  ['mensual', 'Cada mes'],
  ['anual', 'Cada año'],
];
