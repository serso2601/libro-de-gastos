// Qué cuentas suman al saldo «Tienes en total» del Inicio: una ficha por cuenta y un atajo para
// sacar las tarjetas de crédito. Solo cambia el total de arriba; las cuentas siguen igual.

import { View } from 'react-native';
import { useDatos } from '@/lib/datos';
import { Etiqueta, Ficha, Texto } from '@/ui/componentes';
import { usePreferencias, useTema } from '@/ui/tema';

export function CuentasEnElTotal() {
  const d = useDatos();
  const { c } = useTema();
  const { fueraDelTotal, cambiar } = usePreferencias();
  // Los ids de cuentas que ya no existen no cuentan.
  const fuera = fueraDelTotal.filter((id) => d.cuentas.some((x) => x.id === id));
  const suman = d.cuentas.filter((x) => !fuera.includes(x.id));
  const credito = d.cuentas.filter((x) => x.es_credito);
  const sinTarjetas = credito.length > 0 && credito.every((x) => fuera.includes(x.id));

  const poner = (ids: string[]) => cambiar({ fueraDelTotal: ids });
  const alternar = (id: string) => {
    if (fuera.includes(id)) return poner(fuera.filter((x) => x !== id));
    if (suman.length <= 1) return; // siempre queda al menos una
    poner([...fuera, id]);
  };
  const alternarTarjetas = () => {
    if (sinTarjetas) return poner(fuera.filter((id) => !credito.some((x) => x.id === id)));
    const nuevas = [...fuera, ...credito.filter((x) => !fuera.includes(x.id)).map((x) => x.id)];
    if (d.cuentas.every((x) => nuevas.includes(x.id))) return; // no dejar el total sin cuentas
    poner(nuevas);
  };

  return (
    <View style={{ gap: 8 }}>
      <Etiqueta>Cuentas en el total</Etiqueta>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {credito.length > 0 && <Ficha texto="Sin tarjetas de crédito" activa={sinTarjetas} alto={36} onPress={alternarTarjetas} />}
        {d.cuentas.map((x) => <Ficha key={x.id} texto={x.nombre} activa={!fuera.includes(x.id)} alto={36} onPress={() => alternar(x.id)} />)}
      </View>
      <Texto tam={13} color={c.tenue}>Solo cambia el total de arriba; cada cuenta sigue igual.</Texto>
    </View>
  );
}
