import { Tutorial } from '../Tutorial';
import { InicioPrincipal } from './Inicio';

/** El Inicio y, la primera vez (o si se pide en Ajustes), el tutorial encima. */
export function Inicio() {
  return (
    <>
      <InicioPrincipal />
      <Tutorial />
    </>
  );
}
