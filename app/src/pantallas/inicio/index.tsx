import { useTema } from '@/ui/tema';
import { InicioBilletera } from './Billetera';
import { InicioCalendario, InicioCalMosaico } from './Calendario';
import { InicioCartera } from './Cartera';
import { InicioMosaico } from './Mosaico';

/** Cada estilo tiene su propio Inicio. */
export function Inicio() {
  const { estilo } = useTema();
  switch (estilo.id) {
    case 'billetera': return <InicioBilletera />;
    case 'mosaico': return <InicioMosaico />;
    case 'calendario': return <InicioCalendario />;
    case 'cartera': return <InicioCartera />;
    case 'calmosaico': return <InicioCalMosaico />;
  }
}
