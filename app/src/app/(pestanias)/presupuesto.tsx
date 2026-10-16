import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { useDatos } from '@/lib/datos';
import { dinero } from '@/lib/formato';
import { useMes } from '@/lib/mes';
import { BarraProgreso, NavegadorMes, Separador, Tarjeta, Texto } from '@/ui/componentes';
import { Pantalla } from '@/ui/pantalla';
import { C } from '@/ui/tema';

export default function Presupuesto() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const gastos = d.categorias.filter((c) => c.tipo === 'gasto');
  const gastado = (id: string) => d.movimientos.reduce((s, m) => s + (m.tipo === 'gasto' && m.categoria_id === id && m.fecha.startsWith(mes.clave) ? m.monto : 0), 0);
  const conPresupuesto = gastos.filter((c) => c.presupuesto);
  const totalPresupuesto = conPresupuesto.reduce((s, c) => s + (c.presupuesto ?? 0), 0);
  const totalGastado = conPresupuesto.reduce((s, c) => s + gastado(c.id), 0);
  const pasado = totalGastado > totalPresupuesto;

  return (
    <Pantalla titulo="Presupuesto">
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />
      {totalPresupuesto > 0 && (
        <Tarjeta style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Texto peso="semi">Total</Texto>
            <Texto tam={12} mono color={C.tenue}>{dinero(totalGastado, d.moneda)} / {dinero(totalPresupuesto, d.moneda)}</Texto>
          </View>
          <BarraProgreso parte={totalGastado} total={totalPresupuesto} />
          <Texto tam={12} color={pasado ? C.alerta : C.tenue} style={{ marginTop: 8 }}>
            {pasado ? `Te pasaste por ${dinero(totalGastado - totalPresupuesto, d.moneda)}` : `Te quedan ${dinero(totalPresupuesto - totalGastado, d.moneda)}`}
          </Texto>
        </Tarjeta>
      )}
      <Tarjeta style={{ paddingHorizontal: 14 }}>
        {gastos.map((c, i) => {
          const g = gastado(c.id);
          return (
            <View key={c.id}>
              {i > 0 && <Separador />}
              <Pressable onPress={() => abrir({ tipo: 'presupuesto', categoria: c })} style={({ pressed }) => [{ paddingVertical: 14 }, pressed && { opacity: 0.6 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: c.presupuesto ? 10 : 2 }}>
                  <Texto tam={17}>{c.emoji}</Texto>
                  <Texto peso="medio" style={{ flex: 1 }} lineas={1}>{c.nombre}</Texto>
                  <Texto tam={12} peso="semi" color={C.acentoClaro}>{c.presupuesto ? 'Editar' : 'Definir'}</Texto>
                </View>
                {c.presupuesto ? (
                  <>
                    <BarraProgreso parte={g} total={c.presupuesto} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Texto tam={12} mono color={C.tenue}>{dinero(g, d.moneda)} / {dinero(c.presupuesto, d.moneda)}</Texto>
                      {g > c.presupuesto && <Texto tam={12} color={C.alerta}>⚠️ Superado</Texto>}
                    </View>
                  </>
                ) : <Texto tam={12} color={C.tenue}>Gastado: {dinero(g, d.moneda)}</Texto>}
              </Pressable>
            </View>
          );
        })}
      </Tarjeta>
    </Pantalla>
  );
}
