import { useLocalSearchParams } from 'expo-router';
import { Cuenta } from '@/pantallas/Cuenta';
import { ProveedorApilada } from '@/ui/pantalla';
import { useTema } from '@/ui/tema';

export default function VerCuenta() {
  const { id, volver } = useLocalSearchParams<{ id: string; volver?: string }>();
  const { estilo } = useTema();
  return <ProveedorApilada volver={volver || estilo.inicio}><Cuenta id={id} /></ProveedorApilada>;
}
