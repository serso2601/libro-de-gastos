// Cada cosa que el usuario puede cambiar: el pedido a la PC y cómo se ve al instante en pantalla.

import { useMemo } from 'react';
import { useAlmacen } from './datos';
import type { Categoria, Cuenta, Datos, Movimiento, Recurrencia } from './tipos';

function reemplazar<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item];
}

const enc = encodeURIComponent;

export function useAcciones() {
  const { cambiar } = useAlmacen();
  return useMemo(
    () => ({
      guardarMovimiento(m: Movimiento) {
        const { tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota } = m;
        cambiar(
          { metodo: 'PUT', ruta: `/api/movimientos/${enc(m.id)}`, descripcion: 'Guardar el movimiento',
            cuerpo: { tipo, monto, fecha, hora, cuenta_id, cuenta_destino_id, categoria_id, nota } },
          (d) => ({ ...d, movimientos: reemplazar(d.movimientos, m) }),
        );
      },

      borrarMovimiento(m: Movimiento, ySiguientes = false) {
        cambiar(
          { metodo: 'DELETE', ruta: `/api/movimientos/${enc(m.id)}${ySiguientes ? '?y_siguientes=true' : ''}`,
            descripcion: 'Borrar el movimiento' },
          (d): Datos => {
            if (!ySiguientes || !m.recurrencia_id) return { ...d, movimientos: d.movimientos.filter((x) => x.id !== m.id) };
            return {
              ...d,
              movimientos: d.movimientos.filter((x) => !(x.recurrencia_id === m.recurrencia_id && x.fecha >= m.fecha)),
              proximos: d.proximos.filter((p) => p.recurrencia_id !== m.recurrencia_id),
            };
          },
        );
      },

      guardarRecurrencia(r: Recurrencia) {
        const { tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, nota, frecuencia, fecha_inicio, fecha_fin } = r;
        cambiar(
          { metodo: 'PUT', ruta: `/api/recurrencias/${enc(r.id)}`, descripcion: 'Guardar la recurrencia',
            cuerpo: { tipo, monto, cuenta_id, cuenta_destino_id, categoria_id, nota, frecuencia, fecha_inicio, fecha_fin } },
          (d) => ({ ...d, recurrencias: reemplazar(d.recurrencias, r) }),
        );
      },

      borrarRecurrencia(r: Recurrencia) {
        cambiar(
          { metodo: 'DELETE', ruta: `/api/recurrencias/${enc(r.id)}`, descripcion: 'Borrar la recurrencia' },
          (d) => ({
            ...d,
            recurrencias: d.recurrencias.filter((x) => x.id !== r.id),
            proximos: d.proximos.filter((p) => p.recurrencia_id !== r.id),
            movimientos: d.movimientos.map((m) => (m.recurrencia_id === r.id ? { ...m, recurrencia_id: null } : m)),
          }),
        );
      },

      guardarCuenta(c: Cuenta) {
        cambiar(
          { metodo: 'PUT', ruta: `/api/cuentas/${enc(c.id)}`, descripcion: 'Guardar la cuenta',
            cuerpo: { nombre: c.nombre, color: c.color, saldo_inicial: c.saldo_inicial, es_credito: !!c.es_credito,
              dia_corte: c.es_credito ? c.dia_corte ?? null : null, dia_pago: c.es_credito ? c.dia_pago ?? null : null,
              pago_minimo: c.es_credito ? c.pago_minimo ?? null : null } },
          (d) => ({ ...d, cuentas: reemplazar(d.cuentas, c) }),
        );
      },

      /** Con `conTodo` se van también sus movimientos (y las transferencias que la tocan) y sus reglas. */
      borrarCuenta(c: Cuenta, conTodo = false) {
        const toca = (x: { cuenta_id: string; cuenta_destino_id: string | null }) => x.cuenta_id === c.id || x.cuenta_destino_id === c.id;
        cambiar({ metodo: 'DELETE', ruta: `/api/cuentas/${enc(c.id)}${conTodo ? '?con_todo=true' : ''}`, descripcion: 'Borrar la cuenta' },
          (d) => ({
            ...d,
            cuentas: d.cuentas.filter((x) => x.id !== c.id),
            movimientos: d.movimientos.filter((m) => !toca(m)),
            recurrencias: d.recurrencias.filter((r) => !toca(r)),
            proximos: d.proximos.filter((p) => !toca(p)),
          }));
      },

      guardarCategoria(c: Categoria) {
        cambiar(
          { metodo: 'PUT', ruta: `/api/categorias/${enc(c.id)}`, descripcion: 'Guardar la categoría',
            cuerpo: { nombre: c.nombre, tipo: c.tipo, color: c.color, emoji: c.emoji, presupuesto: c.presupuesto } },
          (d) => ({ ...d, categorias: reemplazar(d.categorias, c) }),
        );
      },

      borrarCategoria(c: Categoria) {
        cambiar({ metodo: 'DELETE', ruta: `/api/categorias/${enc(c.id)}`, descripcion: 'Borrar la categoría' },
          (d) => ({ ...d, categorias: d.categorias.filter((x) => x.id !== c.id) }));
      },

      ordenar(tabla: 'cuentas' | 'categorias', ids: string[]) {
        cambiar({ metodo: 'PUT', ruta: `/api/orden/${tabla}`, cuerpo: { ids }, descripcion: 'Reordenar' }, (d) => {
          const pos = new Map(ids.map((id, i) => [id, i]));
          const conOrden = <T extends { id: string; orden: number }>(xs: T[]) =>
            xs.map((x) => (pos.has(x.id) ? { ...x, orden: pos.get(x.id)! } : x)).sort((a, b) => a.orden - b.orden);
          return tabla === 'cuentas' ? { ...d, cuentas: conOrden(d.cuentas) } : { ...d, categorias: conOrden(d.categorias) };
        });
      },

      guardarMoneda(moneda: string) {
        cambiar({ metodo: 'PUT', ruta: '/api/ajustes', cuerpo: { moneda }, descripcion: 'Guardar la moneda' },
          (d) => ({ ...d, moneda }));
      },
    }),
    [cambiar],
  );
}
