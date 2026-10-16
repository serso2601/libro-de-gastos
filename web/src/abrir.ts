// Para que cualquier pantalla pueda abrir un diálogo o cambiar de pestaña sin pasar funciones de mano en mano.

import { createContext, useContext } from 'react';
import type { Categoria, Cuenta, Movimiento, Recurrencia, TipoCategoria, TipoMovimiento } from './tipos';

export type Pestania = 'resumen' | 'cuentas' | 'presupuesto' | 'movimientos' | 'graficos';

export type Dialogo =
  | { tipo: 'movimiento'; inicial?: Movimiento; tipoInicial?: TipoMovimiento }
  | { tipo: 'recurrencia'; regla: Recurrencia }
  | { tipo: 'cuenta'; inicial?: Cuenta }
  | { tipo: 'categoria'; inicial?: Categoria; tipoInicial?: TipoCategoria }
  | { tipo: 'presupuesto'; categoria: Categoria };

export interface Abrir {
  dialogo: (d: Dialogo) => void;
  pestania: (p: Pestania) => void;
  ajustes: () => void;
}

export const ContextoAbrir = createContext<Abrir | null>(null);

export function useAbrir(): Abrir {
  const a = useContext(ContextoAbrir);
  if (!a) throw new Error('useAbrir fuera de la app');
  return a;
}
