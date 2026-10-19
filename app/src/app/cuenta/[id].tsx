import { useLocalSearchParams } from 'expo-router';
import { Cuenta } from '@/pantallas/Cuenta';
import { ProveedorApilada } from '@/ui/pantalla';

export default function VerCuenta() {
  const { id, volver } = useLocalSearchParams<{ id: string; volver?: string }>();
  return <ProveedorApilada volver={volver || 'Inicio'}><Cuenta id={id} /></ProveedorApilada>;
}
