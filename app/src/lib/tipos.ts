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
  /** Opcionales. Si la tarjeta está vinculada a una del catálogo con sus reglas, la app calcula el mínimo y la
   *  fecha de pago; el mínimo copiado sirve para las que no. El límite (centavos) da lo disponible y el sobregiro. */
  dia_pago?: number | null;
  pago_minimo?: number | null;
  limite?: number | null;
  /** Su vínculo con un banco del catálogo (opcional) y los últimos 4 dígitos de su tarjeta. */
  banco?: VinculoBanco | null;
  terminacion?: string | null;
}

/** Con qué productos del catálogo está vinculada una cuenta. */
export interface VinculoBanco {
  banco: string;
  cuenta: string | null;
  tarjeta: string | null;
  membresia: 'mensual' | 'anual';
  seguro: string | null;
}

// --- El catálogo de bancos (servidor/gastos/bancos.json) ---

export interface TramoInteres { desde: number; tasa: number }
export interface InteresCuenta { tramos: TramoInteres[]; minimo_diario: number; base_dias: number; combinado: boolean }
export interface CargoCuenta { id: string; nombre: string; tipo: string; menor_que: number; monto: number }
export interface VersionCuenta {
  vigente_desde: string; verificado?: string; fuente?: string;
  interes: InteresCuenta | null; cargos: CargoCuenta[];
}
export interface ProductoCuenta { id: string; nombre: string; clase: 'ahorros' | 'corriente'; nota?: string; versiones: VersionCuenta[] }

export interface SeguroTarjeta { id: string; nombre: string; mensual: number }
export interface CargoPorUso { id: string; nombre: string; monto?: number; porcentaje?: number; minimo?: number }
export interface VersionTarjeta {
  vigente_desde: string; verificado?: string; fuente?: string;
  /** Débito. */
  membresia?: { mensual: number; anual: number };
  seguros?: SeguroTarjeta[];
  por_uso?: CargoPorUso[];
  /** Crédito. */
  tasa_anual?: number;
  pago_atrasado?: number;
  adelanto_efectivo?: { porcentaje: number; minimo: number };
  /** Pago mínimo: `porcentaje` del saldo al corte, nunca menos de `minimo` (centavos). */
  pago_minimo?: { porcentaje: number; minimo: number };
  /** `permitido`: % sobre el límite que se puede pasar sin cargo (null si el banco no lo publica); `cargo`: lo que cobra al corte si te pasas de ahí. */
  sobregiro?: { permitido: number | null; cargo: number };
  /** El corte y el pago que publica el banco para este producto (de referencia: el del cliente puede ser otro). */
  fechas?: { corte: number; pago: number };
  /** Días entre el corte y la fecha de pago. */
  dias_para_pagar?: number;
}
export interface Tarjeta { id: string; nombre: string; clase: 'debito' | 'credito'; versiones: VersionTarjeta[] }

export interface Banco { id: string; nombre: string; banca?: { nombre: string; url: string; pasos: string }; cuentas: ProductoCuenta[]; tarjetas: Tarjeta[] }
export interface Catalogo { acerca?: string; notas?: string[]; bancos: Banco[] }

/** Un aviso del banco (llegó al correo) que espera que el usuario lo revise. */
export interface Pendiente {
  id: string;
  origen: string;
  recibido: string;
  remitente: string;
  asunto: string;
  texto: string;
  tipo: 'gasto' | 'ingreso' | null;
  monto: number | null;
  fecha: string | null;
  hora: string | null;
  comercio: string;
  categoria_id: string | null;
  cuenta_id: string | null;
  terminacion: string | null;
  motivo: string;
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
  /** Faltan en datos viejos guardados en el teléfono. */
  catalogo?: Catalogo;
  pendientes?: Pendiente[];
  /** La cuenta de la que salen (o a la que llegan) los Yappy; null si no se ha elegido. */
  cuenta_yappy?: string | null;
  /** La categoría que se les pone a los Yappy por defecto, por tipo; null = automática. */
  yappy_categorias?: { gasto: string | null; ingreso: string | null };
}

export const FRECUENCIAS: [Frecuencia, string][] = [
  ['semanal', 'Cada semana'],
  ['catorcenal', 'Cada 2 semanas'],
  ['quincenal', 'Cada quincena'],
  ['mensual', 'Cada mes'],
  ['anual', 'Cada año'],
];
