// Cualquier pantalla puede abrir una hoja (anotar, editar una cuenta...) sin pasar funciones de mano
// en mano: `useAbrir()(...)`. La hoja abierta vive en <AnfitrionDialogos> y hay una sola a la vez.

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Categoria, Cuenta, Movimiento, Pendiente, Recurrencia, TipoCategoria, TipoMovimiento } from '@/lib/tipos';
import { DialogoCategoria } from './categoria';
import { DialogoApplePay } from './applePay';
import { DialogoAvisoPagos } from './avisoPagos';
import { DialogoMinimo } from './minimo';
import { DialogoCuenta } from './cuenta';
import { DialogoDetalleCategoria } from './detalleCategoria';
import { DialogoMovimiento } from './movimiento';
import { DialogoPeriodo } from './periodo';
import type { Periodo } from '@/lib/calculos';
import { DialogoPresupuesto, DialogoTopes } from './presupuesto';
import { DialogoRecurrencia } from './recurrencia';
import { DialogoYappy } from './yappy';

/** Lo que se puede dejar listo al abrir la hoja de anotar (el pago sugerido de una tarjeta, por ejemplo). */
export interface OpcionesAnotar {
  tipoInicial?: TipoMovimiento; fechaInicial?: string; cuentaInicial?: string;
  destinoInicial?: string; montoInicial?: number; notaInicial?: string;
  /** Un aviso del banco por revisar: la hoja sale prellenada y al guardar se cierra el aviso. */
  pendiente?: Pendiente;
}

export type Dialogo =
  | ({ tipo: 'movimiento'; inicial?: Movimiento } & OpcionesAnotar)
  | { tipo: 'recurrencia'; regla: Recurrencia }
  | { tipo: 'cuenta'; inicial?: Cuenta }
  | { tipo: 'categoria'; inicial?: Categoria; tipoInicial?: TipoCategoria }
  | { tipo: 'presupuesto'; categoria: Categoria }
  /** El detalle de una categoría del presupuesto en un periodo. */
  | { tipo: 'detalleCategoria'; categoria: Categoria; periodo: Periodo }
  /** Elegir cada cuánto se reinicia el presupuesto (y convertir los topes). */
  | { tipo: 'periodo' }
  | { tipo: 'topes' }
  /** Cómo anotar solo los pagos con Apple Pay (un Atajo del iPhone). */
  | { tipo: 'applePay' }
  /** La categoría por defecto de los Yappy que entran solos. */
  | { tipo: 'yappy' }
  /** Cómo armar el Atajo diario que avisa los pagos de tarjeta con una notificación. */
  | { tipo: 'avisoPagos' }
  /** Corregir el pago mínimo de una tarjeta para su último corte (si el banco dice otro). */
  | { tipo: 'minimo'; cuenta: Cuenta };

const Contexto = createContext<((d: Dialogo) => void) | null>(null);

export function useAbrir() {
  const abrir = useContext(Contexto);
  if (!abrir) throw new Error('useAbrir fuera de <AnfitrionDialogos>');
  return abrir;
}

export function AnfitrionDialogos({ children }: { children: ReactNode }) {
  const [d, setD] = useState<Dialogo | null>(null);
  const cerrar = () => setD(null);
  return (
    <Contexto.Provider value={setD}>
      {children}
      {d?.tipo === 'movimiento' && (
        <DialogoMovimiento key={d.inicial?.id ?? d.pendiente?.id ?? 'nuevo'} inicial={d.inicial} tipoInicial={d.tipoInicial} fechaInicial={d.fechaInicial}
          cuentaInicial={d.cuentaInicial} destinoInicial={d.destinoInicial} montoInicial={d.montoInicial} notaInicial={d.notaInicial} pendiente={d.pendiente} alCerrar={cerrar}
          alEditarRegla={(regla) => {
            // iOS no deja presentar una hoja mientras otra se está cerrando: se espera a que baje.
            setD(null);
            setTimeout(() => setD({ tipo: 'recurrencia', regla }), 600);
          }} />
      )}
      {d?.tipo === 'recurrencia' && <DialogoRecurrencia regla={d.regla} alCerrar={cerrar} />}
      {d?.tipo === 'cuenta' && <DialogoCuenta inicial={d.inicial} alCerrar={cerrar} />}
      {d?.tipo === 'categoria' && <DialogoCategoria inicial={d.inicial} tipoInicial={d.tipoInicial} alCerrar={cerrar} />}
      {d?.tipo === 'presupuesto' && <DialogoPresupuesto categoria={d.categoria} alCerrar={cerrar} />}
      {d?.tipo === 'detalleCategoria' && (
        <DialogoDetalleCategoria categoria={d.categoria} periodo={d.periodo} alCerrar={cerrar}
          alEditarTope={() => {
            const categoria = d.categoria;
            setD(null);
            setTimeout(() => setD({ tipo: 'presupuesto', categoria }), 600);
          }} />
      )}
      {d?.tipo === 'topes' && <DialogoTopes alCerrar={cerrar} />}
      {d?.tipo === 'periodo' && <DialogoPeriodo alCerrar={cerrar} />}
      {d?.tipo === 'applePay' && <DialogoApplePay alCerrar={cerrar} />}
      {d?.tipo === 'yappy' && <DialogoYappy alCerrar={cerrar} />}
      {d?.tipo === 'avisoPagos' && <DialogoAvisoPagos alCerrar={cerrar} />}
      {d?.tipo === 'minimo' && <DialogoMinimo cuenta={d.cuenta} alCerrar={cerrar} />}
    </Contexto.Provider>
  );
}

/** Abrir la hoja de anotar, con el día o la cuenta ya elegidos si hace falta. */
export function useAnotar() {
  const abrir = useAbrir();
  return (o: OpcionesAnotar = {}) => abrir({ tipo: 'movimiento', ...o });
}
