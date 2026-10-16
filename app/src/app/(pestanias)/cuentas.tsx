import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { useDatos } from '@/lib/datos';
import { dinero, ordenarPorFecha, saldo } from '@/lib/formato';
import { Balance, FilaMovimiento, Placa, Separador, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Pantalla } from '@/ui/pantalla';
import { C } from '@/ui/tema';

export default function Cuentas() {
  const d = useDatos();
  const abrir = useAbrir();
  const [elegida, setElegida] = useState<string | null>(null);
  const cuenta = d.cuentas.find((c) => c.id === elegida);

  if (elegida && cuenta) {
    const movs = d.movimientos.filter((m) => m.cuenta_id === cuenta.id || m.cuenta_destino_id === cuenta.id).sort(ordenarPorFecha);
    return (
      <Pantalla titulo={cuenta.nombre}>
        <Pressable onPress={() => setElegida(null)} hitSlop={8} style={{ marginBottom: 12 }}><Texto color={C.tenue}>‹ Todas las cuentas</Texto></Pressable>
        <View style={{ backgroundColor: cuenta.color, borderRadius: 16, padding: 22, alignItems: 'center', marginBottom: 12 }}>
          <Texto tam={12} color="rgba(255,255,255,0.85)" style={{ letterSpacing: 1 }}>SALDO</Texto>
          <Texto tam={30} mono peso="negrita" color="#fff">{dinero(saldo(cuenta, d.movimientos), d.moneda)}</Texto>
        </View>
        <Pressable onPress={() => abrir({ tipo: 'cuenta', inicial: cuenta })} style={{ marginBottom: 16 }}>
          <Texto peso="semi" color={C.acentoClaro}>Editar cuenta</Texto>
        </Pressable>
        <Tarjeta style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
          {movs.length === 0 ? <Vacio>Sin movimientos todavía.</Vacio> : movs.map((m) => (
            <FilaMovimiento key={m.id} m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
          ))}
        </Tarjeta>
      </Pantalla>
    );
  }

  const total = d.cuentas.reduce((s, c) => s + saldo(c, d.movimientos), 0);
  return (
    <Pantalla titulo="Cuentas">
      <Balance titulo="Balance total" monto={total} moneda={d.moneda} tam={30} />
      <Tarjeta style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
        {d.cuentas.map((c, i) => {
          const s = saldo(c, d.movimientos);
          return (
            <View key={c.id}>
              {i > 0 && <Separador />}
              <Pressable onPress={() => setElegida(c.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, pressed && { opacity: 0.6 }]}>
                <Placa color={c.color}><Texto peso="semi" color={c.color}>{c.nombre.charAt(0).toUpperCase()}</Texto></Placa>
                <Texto peso="medio" style={{ flex: 1 }} lineas={1}>{c.nombre}</Texto>
                <Texto mono peso="semi" color={s < 0 ? C.alerta : C.tinta}>{dinero(s, d.moneda)}</Texto>
                <Texto tam={18} color={C.tenue}>›</Texto>
              </Pressable>
            </View>
          );
        })}
      </Tarjeta>
      <Pressable onPress={() => abrir({ tipo: 'cuenta' })} style={{ alignSelf: 'center', paddingVertical: 8 }}>
        <Texto peso="semi" color={C.acentoClaro}>+ Nueva cuenta</Texto>
      </Pressable>
    </Pantalla>
  );
}
