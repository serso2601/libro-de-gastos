import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { useDatos } from '@/lib/datos';
import { diasHasta, dinero, etiquetaCorta, ordenarPorFecha, saldo } from '@/lib/formato';
import { sumar, useMes } from '@/lib/mes';
import { Balance, FilaMovimiento, NavegadorMes, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Pantalla } from '@/ui/pantalla';
import { alfa, C } from '@/ui/tema';

function MiniDato({ texto, monto, color, flecha }: { texto: string; monto: string; color: string; flecha: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.tarjetaAlt, borderRadius: 12, padding: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: alfa(color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
        <Texto tam={16} peso="negrita" color={color}>{flecha}</Texto>
      </View>
      <View style={{ flex: 1 }}>
        <Texto tam={12} color={C.tenue}>{texto}</Texto>
        <Texto tam={14} mono peso="semi" color={color} lineas={1}>{monto}</Texto>
      </View>
    </View>
  );
}

export default function Resumen() {
  const d = useDatos();
  const abrir = useAbrir();
  const mes = useMes();
  const total = d.cuentas.reduce((s, c) => s + saldo(c, d.movimientos), 0);
  const delMes = d.movimientos.filter((m) => m.fecha.startsWith(mes.clave));
  const ingresos = sumar(delMes, 'ingreso');
  const gastos = sumar(delMes, 'gasto');
  const neto = ingresos - gastos;
  const recientes = [...d.movimientos].sort(ordenarPorFecha).slice(0, 5);

  return (
    <Pantalla titulo="Resumen">
      <Balance titulo="Balance total" monto={total} moneda={d.moneda} />
      <NavegadorMes anio={mes.anio} mes={mes.mes} alCambiar={mes.cambiar} />

      <Tarjeta style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Texto peso="semi">Este mes</Texto>
          <Texto tam={12} mono peso="semi" color={neto >= 0 ? C.bien : C.alerta}>Neto {neto >= 0 ? '+' : '−'}{dinero(Math.abs(neto), d.moneda)}</Texto>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MiniDato texto="Gastos" monto={`−${dinero(gastos, d.moneda)}`} color={C.alerta} flecha="↓" />
          <MiniDato texto="Ingresos" monto={`+${dinero(ingresos, d.moneda)}`} color={C.bien} flecha="↑" />
        </View>
      </Tarjeta>

      {d.proximos.length > 0 && (
        <Tarjeta style={{ padding: 16 }}>
          <Texto peso="semi" style={{ marginBottom: 4 }}>Próximos</Texto>
          {d.proximos.slice(0, 4).map((p) => {
            const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
            const dias = diasHasta(p.fecha, d.hoy);
            return (
              <FilaMovimiento key={`${p.recurrencia_id}@${p.fecha}`} m={p} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda}
                onPress={() => regla && abrir({ tipo: 'recurrencia', regla })}
                debajoDelMonto={dias === 1 ? 'mañana' : `${etiquetaCorta(p.fecha)} · en ${dias} días`} />
            );
          })}
        </Tarjeta>
      )}

      <Tarjeta style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Texto peso="semi">Últimos movimientos</Texto>
          <Pressable onPress={() => router.navigate('/movimientos')} hitSlop={8}><Texto tam={12} peso="semi" color={C.acentoClaro}>Ver todo</Texto></Pressable>
        </View>
        {recientes.length === 0 ? <Vacio>Todavía no hay movimientos. Toca + para anotar el primero.</Vacio> : recientes.map((m) => (
          <FilaMovimiento key={m.id} m={m} cuentas={d.cuentas} categorias={d.categorias} moneda={d.moneda} onPress={() => abrir({ tipo: 'movimiento', inicial: m })} />
        ))}
      </Tarjeta>
    </Pantalla>
  );
}
