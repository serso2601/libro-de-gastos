// En la web del iPhone (abierta desde el ícono), iOS dibuja la barra de estado encima de la página y
// difumina también lo que queda justo debajo: pegados a ese margen, «‹ Volver» o «Cancelar» se ven apagados
// y cuesta tocarlos. Si hay barra arriba, se deja un poco más de aire.

import { useMemo } from 'react';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

const AIRE_ARRIBA = 14;

export function useZonaSegura(): EdgeInsets {
  const z = useSafeAreaInsets();
  return useMemo(() => (z.top > 0 ? { ...z, top: z.top + AIRE_ARRIBA } : z), [z]);
}
