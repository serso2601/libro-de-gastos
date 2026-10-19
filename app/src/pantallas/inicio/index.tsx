import { Tutorial } from '../Tutorial';
import { InicioBilletera } from './Billetera';

/** El Inicio y, la primera vez (o si se pide en Ajustes), el tutorial encima. */
export function Inicio() {
  return (
    <>
      <InicioBilletera />
      <Tutorial />
    </>
  );
}
