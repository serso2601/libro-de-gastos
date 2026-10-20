// Lo mismo que devuelve el servidor en GET /api/datos. Montos en centavos, fechas 'YYYY-MM-DD'.

export type TipoMovimiento = 'gasto' | 'ingreso' | 'transferencia';
export type TipoCategoria = 'gasto' | 'ingreso';
/** catorcenal = cada 14 días; quincenal = dos veces al mes (el día de inicio y 15 días después). */
export type Frecuencia = 'semanal' | 'catorcenal' | 'quincenal' | 'mensual' | 'anual';

export interface Cuenta {
  id: string;
  nombre: string;
  color: string;
  saldo_inicial: number;
  orden: number;
  /** Tarjeta de crédito: su saldo es deuda y tiene día de corte. Lo de abajo solo vale si es true. */
  es_credito?: boolean;
  dia_corte?: number | null;
  /** Opcionales: el usuario los copia de su estado de cuenta; la app no los calcula. */
  dia_pago?: number | null;
  pago_minimo?: number | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  color: string;
  /** Un emoji o un símbolo de la app con la forma 'i:<clave>' (ver ui/simbolos.tsx). */
  emoji: string;
  /** El tope por periodo del presupuesto (ver ConfigPresupuesto). */
  presupuesto: number | null;
  /** Pasar lo que sobra: lo no gastado se suma al periodo siguiente (y lo pasado se resta). */
  acumula?: boolean;
  /** Desde qué periodo se acumula (la fecha en que empieza ese periodo). */
  acumula_desde?: string | null;
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

export type PeriodoPresupuesto = 'semanal' | 'catorcenal' | 'quincenal' | 'mensual';

/**
 * Cada cuánto se reinicia el presupuesto. `inicio` según el periodo: semanal = día de la semana en
 * que empieza ('0' domingo … '6' sábado); catorcenal = una fecha en que empieza un periodo;
 * quincenal = '' (1–15 y 16–fin de mes); mensual = día del mes en que empieza ('1'..'28').
 */
export interface ConfigPresupuesto {
  periodo: PeriodoPresupuesto;
  inicio: string;
}

export interface Datos {
  hoy: string;
  moneda: string;
  /** Falta en datos viejos guardados en el teléfono: entonces es mensual desde el día 1. */
  presupuesto?: ConfigPresupuesto;
  cuentas: Cuenta[];
  categorias: Categoria[];
  movimientos: Movimiento[];
  recurrencias: Recurrencia[];
  proximos: Proximo[];
}

export const FRECUENCIAS: [Frecuencia, string][] = [
  ['semanal', 'Cada semana'],
  ['catorcenal', 'Cada 2 semanas'],
  ['quincenal', 'Cada quincena'],
  ['mensual', 'Cada mes'],
  ['anual', 'Cada año'],
];
