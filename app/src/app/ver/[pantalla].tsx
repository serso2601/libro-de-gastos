// Una sección abierta encima, con «‹ volver»: todas en los estilos de bloques y las que no son
// pestaña en los demás (por ejemplo Próximos).

import { useLocalSearchParams } from 'expo-router';
import { Cuentas } from '@/pantallas/Cuentas';
import { Graficos } from '@/pantallas/Graficos';
import { Movimientos } from '@/pantallas/Movimientos';
import { Presupuesto } from '@/pantallas/Presupuesto';
import { Proximos } from '@/pantallas/Proximos';
import { ProveedorApilada } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';

const PANTALLAS = { movimientos: Movimientos, presupuesto: Presupuesto, graficos: Graficos, cuentas: Cuentas, proximos: Proximos };

export default function Ver() {
  const { pantalla, volver } = useLocalSearchParams<{ pantalla: string; volver?: string }>();
  const { estilo } = useTema();
  const Pantalla = PANTALLAS[pantalla as keyof typeof PANTALLAS] ?? Movimientos;
  return <ProveedorApilada volver={volver || estilo.inicio}><Pantalla /></ProveedorApilada>;
}
