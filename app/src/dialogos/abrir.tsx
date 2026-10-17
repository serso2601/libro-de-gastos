// Cualquier pantalla puede abrir una hoja (anotar, editar una cuenta...) sin pasar funciones de mano
// en mano: `useAbrir()(...)`. La hoja abierta vive en <AnfitrionDialogos> y hay una sola a la vez.

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Categoria, Cuenta, Movimiento, Recurrencia, TipoCategoria, TipoMovimiento } from '@/lib/tipos';
import { DialogoCategoria, DialogoCuenta, DialogoPresupuesto, DialogoTopes } from './ajustes';
import { DialogoMovimiento } from './movimiento';
import { DialogoRecurrencia } from './recurrencia';

export type Dialogo =
  | { tipo: 'movimiento'; inicial?: Movimiento; tipoInicial?: TipoMovimiento; fechaInicial?: string; cuentaInicial?: string }
  | { tipo: 'recurrencia'; regla: Recurrencia }
  | { tipo: 'cuenta'; inicial?: Cuenta }
  | { tipo: 'categoria'; inicial?: Categoria; tipoInicial?: TipoCategoria }
  | { tipo: 'presupuesto'; categoria: Categoria }
  | { tipo: 'topes' };

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
        <DialogoMovimiento key={d.inicial?.id ?? 'nuevo'} inicial={d.inicial} tipoInicial={d.tipoInicial} fechaInicial={d.fechaInicial}
          cuentaInicial={d.cuentaInicial} alCerrar={cerrar}
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
      {d?.tipo === 'topes' && <DialogoTopes alCerrar={cerrar} />}
    </Contexto.Provider>
  );
}

/** Abrir la hoja de anotar, con el día o la cuenta ya elegidos si hace falta. */
export function useAnotar() {
  const abrir = useAbrir();
  return (o: { fechaInicial?: string; cuentaInicial?: string; tipoInicial?: TipoMovimiento } = {}) => abrir({ tipo: 'movimiento', ...o });
}
