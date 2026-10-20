// El detalle de una categoría en el presupuesto: lo gastado, su tope y las compras del mes.
// Editar el tope es una opción de aquí, no lo primero que se ve.

import type { Categoria } from '@/lib/tipos';
import { Hoja } from '@/ui/componentes';

export function DialogoDetalleCategoria({ categoria, mes, alCerrar }: {
  categoria: Categoria; /** 'YYYY-MM' del mes que se está mirando en Presupuesto. */ mes: string;
  alCerrar: () => void; alEditarTope: () => void;
}) {
  void mes;
  return <Hoja titulo={categoria.nombre} alCerrar={alCerrar}>{null}</Hoja>;
}
