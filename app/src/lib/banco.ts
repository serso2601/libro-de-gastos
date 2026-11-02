// Lo que el banco le va a dar o cobrar a una cuenta vinculada, calculado con el catálogo (bancos.json) y los
// saldos de cada día del mes. Funciones puras, sin React. Montos en centavos; el redondeo va solo al final.

import { diasDelMes } from './calculos';
import type { Banco, Catalogo, Cuenta, Datos, InteresCuenta, ProductoCuenta, SeguroTarjeta, Tarjeta, VersionCuenta, VersionTarjeta } from './tipos';

/** La versión del producto con mayor `vigente_desde` que no pase de la fecha; si la fecha es anterior a todas, la primera. */
export function versionVigente<V extends { vigente_desde: string }>(producto: { versiones: V[] }, fechaISO: string): V {
  const orden = [...producto.versiones].sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
  let elegida = orden[0];
  for (const v of orden) if (v.vigente_desde <= fechaISO) elegida = v;
  return elegida;
}

export interface VinculoResuelto {
  banco: Banco;
  producto: ProductoCuenta | null;
  tarjeta: Tarjeta | null;
  seguro: SeguroTarjeta | null;
}

/** El banco, el producto, la tarjeta y el seguro de una cuenta, o null si no está vinculada o el catálogo no lo conoce. */
export function vinculoDe(catalogo: Catalogo | undefined, cuenta: Cuenta): VinculoResuelto | null {
  const v = cuenta.banco;
  if (!catalogo || !v) return null;
  const banco = catalogo.bancos.find((b) => b.id === v.banco);
  if (!banco) return null;
  const producto = banco.cuentas.find((p) => p.id === v.cuenta) ?? null;
  const tarjeta = banco.tarjetas.find((t) => t.id === v.tarjeta) ?? null;
  let seguro: SeguroTarjeta | null = null;
  if (tarjeta && v.seguro) {
    for (const ver of tarjeta.versiones) seguro = ver.seguros?.find((s) => s.id === v.seguro) ?? seguro;
  }
  return { banco, producto, tarjeta, seguro };
}

export interface SaldosDelMes {
  /** Saldo al final de cada día: índice 0 = día 1. */
  saldos: number[];
  /** Verdadero para los días que todavía no llegan (el saldo de hoy más lo que viene). */
  proyectado: boolean[];
}

/** Saldo al final de cada día del mes ('YYYY-MM'). Los días después de hoy suman lo que se va a anotar solo. */
export function saldosDiariosDelMes(d: Datos, cuenta: Cuenta, mes: string): SaldosDelMes {
  const [anio, m] = mes.split('-').map(Number);
  const n = diasDelMes(anio, m);
  const cambio = new Map<string, number>(); // lo que mueve cada fecha en esta cuenta
  const suma = (fecha: string, x: number) => cambio.set(fecha, (cambio.get(fecha) ?? 0) + x);
  const efecto = (x: { tipo: string; monto: number; cuenta_id: string; cuenta_destino_id: string | null }) => {
    let e = 0;
    if (x.cuenta_id === cuenta.id) e -= x.tipo === 'ingreso' ? -x.monto : x.monto;
    if (x.cuenta_destino_id === cuenta.id) e += x.monto;
    return e;
  };
  for (const x of d.movimientos) suma(x.fecha, efecto(x));
  for (const p of d.proximos) if (p.fecha > d.hoy) suma(p.fecha, efecto(p));

  const primero = `${mes}-01`;
  let s = cuenta.saldo_inicial;
  for (const [fecha, e] of cambio) if (fecha < primero) s += e;
  const saldos: number[] = [];
  const proyectado: boolean[] = [];
  for (let dia = 1; dia <= n; dia++) {
    const fecha = `${mes}-${String(dia).padStart(2, '0')}`;
    s += cambio.get(fecha) ?? 0;
    saldos.push(s);
    proyectado.push(fecha > d.hoy);
  }
  return { saldos, proyectado };
}

/** La tasa (% anual) que le toca a un saldo. */
function tasaDe(interes: InteresCuenta, saldo: number): number {
  let tasa = 0;
  for (const t of interes.tramos) if (saldo >= t.desde) tasa = t.tasa;
  return tasa;
}

/** Interés de un día sin redondear: según el tramo, o cada porción a la tasa de su tramo si es combinado. */
function interesDeUnDia(interes: InteresCuenta, saldo: number): number {
  if (saldo <= 0 || saldo < interes.minimo_diario) return 0;
  if (!interes.combinado) return (saldo * tasaDe(interes, saldo)) / 100 / interes.base_dias;
  const tramos = [...interes.tramos].sort((a, b) => a.desde - b.desde);
  let total = 0;
  tramos.forEach((t, i) => {
    const hasta = i + 1 < tramos.length ? tramos[i + 1].desde : Infinity;
    const porcion = Math.min(saldo, hasta) - t.desde;
    if (porcion > 0) total += (porcion * t.tasa) / 100 / interes.base_dias;
  });
  return total;
}

export interface InteresMes {
  hastaHoy: number;
  alCierre: number;
  /** La tasa anual (%) del saldo de hoy. */
  tasa: number;
  /** Días (ya pasados) en que el saldo estuvo bajo el mínimo y no ganó interés. */
  diasBajoMinimo: number;
}

/** Cuánto interés gana la cuenta en el mes; null si el producto no paga interés. */
export function interesDelMes(version: VersionCuenta, del: SaldosDelMes, hoy: string, mes: string): InteresMes | null {
  const interes = version.interes;
  if (!interes) return null;
  let hastaHoy = 0;
  let alCierre = 0;
  let diasBajoMinimo = 0;
  let ultimoReal = 0; // el último día que ya pasó (o es hoy)
  del.saldos.forEach((s, i) => {
    const x = interesDeUnDia(interes, s);
    alCierre += x;
    if (!del.proyectado[i]) {
      hastaHoy += x;
      ultimoReal = i;
      if (interes.minimo_diario > 0 && s < interes.minimo_diario) diasBajoMinimo++;
    }
  });
  const indiceHoy = hoy.startsWith(mes) ? Number(hoy.slice(8)) - 1 : ultimoReal;
  const saldoHoy = del.saldos[Math.min(Math.max(indiceHoy, 0), del.saldos.length - 1)] ?? 0;
  return { hastaHoy: Math.round(hastaHoy), alCierre: Math.round(alCierre), tasa: tasaDe(interes, saldoHoy), diasBajoMinimo };
}

export interface CargoMes { nombre: string; monto: number }

export interface CargosMes {
  /** Lo que se cobra este mes. */
  cargos: CargoMes[];
  /** La membresía anual, aparte: no se suma al mes, se muestra como nota. */
  anual: CargoMes | null;
}

/** Lo que el banco cobra este mes: membresía mensual, seguro y el saldo promedio bajo de las corrientes. */
export function cargosDelMes(
  producto: ProductoCuenta | null, tarjeta: Tarjeta | null, vinculo: Cuenta['banco'], del: SaldosDelMes, mes: string,
): CargosMes {
  const cargos: CargoMes[] = [];
  let anual: CargoMes | null = null;
  const primero = `${mes}-01`;
  if (tarjeta && vinculo) {
    const v: VersionTarjeta = versionVigente(tarjeta, primero);
    if (v.membresia) {
      if (vinculo.membresia === 'anual') anual = { nombre: 'Membresía anual', monto: v.membresia.anual };
      else cargos.push({ nombre: 'Membresía de la tarjeta', monto: v.membresia.mensual });
    }
    const seguro = vinculo.seguro ? v.seguros?.find((s) => s.id === vinculo.seguro) : undefined;
    if (seguro) cargos.push({ nombre: seguro.nombre, monto: seguro.mensual });
  }
  if (producto) {
    const v = versionVigente(producto, primero);
    const promedio = del.saldos.length ? del.saldos.reduce((a, b) => a + b, 0) / del.saldos.length : 0;
    for (const cg of v.cargos) {
      if (cg.tipo === 'saldo_promedio_bajo' && promedio < cg.menor_que) cargos.push({ nombre: cg.nombre, monto: cg.monto });
    }
  }
  return { cargos, anual };
}

/** Lo que cobraría el banco en un mes si no pagas el total de la tarjeta (sin contar el pago atrasado). */
export function interesSiNoPagas(deuda: number, tasaAnual: number): number {
  return Math.round((Math.max(deuda, 0) * tasaAnual) / 100 / 12);
}

/** Todo junto, listo para la pantalla de la cuenta; null si la cuenta no está vinculada o no hay nada que calcular. */
export interface ResumenBanco {
  vinculo: VinculoResuelto;
  interes: InteresMes | null;
  cargos: CargosMes;
  /** Interés al cierre menos cargos del mes. */
  neto: number;
  credito: { tasa: number; pagoAtrasado: number } | null;
}

export function resumenBanco(d: Datos, cuenta: Cuenta, mes: string): ResumenBanco | null {
  const vinculo = vinculoDe(d.catalogo, cuenta);
  if (!vinculo || !cuenta.banco) return null;
  const primero = `${mes}-01`;
  if (cuenta.es_credito) {
    if (!vinculo.tarjeta) return null;
    const v = versionVigente(vinculo.tarjeta, primero);
    if (v.tasa_anual === undefined) return null;
    return { vinculo, interes: null, cargos: { cargos: [], anual: null }, neto: 0, credito: { tasa: v.tasa_anual, pagoAtrasado: v.pago_atrasado ?? 0 } };
  }
  if (!vinculo.producto && !vinculo.tarjeta) return null;
  const del = saldosDiariosDelMes(d, cuenta, mes);
  const interes = vinculo.producto ? interesDelMes(versionVigente(vinculo.producto, primero), del, d.hoy, mes) : null;
  const cargos = cargosDelMes(vinculo.producto, vinculo.tarjeta, cuenta.banco, del, mes);
  const neto = (interes?.alCierre ?? 0) - cargos.cargos.reduce((s, c) => s + c.monto, 0);
  return { vinculo, interes, cargos, neto, credito: null };
}
