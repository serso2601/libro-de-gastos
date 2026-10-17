// Mosaico: el Inicio es una grilla de bloques de colores, cada uno lleva a su sección.

import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAnotar } from '@/dialogos/abrir';
import { delMes, gastoPorDia, proximosEn, sumar, topes } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, conSigno, DIAS, diaCorto, dineroCorto, MESES, mayuscula, neto, ordenarPorFecha, saldo } from '@/lib/formato';
import { BotonRedondo, Num, PildoraAnotar, Texto } from '@/ui/componentes';
import { Anillo } from '@/ui/graficos';
import { Icono } from '@/ui/iconos';
import { Marco, useIr } from '@/ui/pantalla';
import { mezclar, useTema } from '@/ui/tema';
import { Tutorial } from '../Tutorial';

type Bloque = 'lavanda' | 'durazno' | 'cielo' | 'menta' | 'limon';

function Mosaiquito({ color, alto, onPress, children, etiqueta, fila }: { color: string; alto: number; onPress: () => void; children: ReactNode; etiqueta: string; fila?: boolean }) {
  const { estilo } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityLabel={etiqueta}
      style={({ pressed }) => ({ flex: 1, height: alto, borderRadius: estilo.m.esquinas, backgroundColor: color, padding: 16, justifyContent: 'space-between',
        flexDirection: fila ? 'row' : 'column', opacity: pressed ? 0.85 : 1 })}>
      {children}
    </Pressable>
  );
}

export function InicioMosaico() {
  const d = useDatos();
  const ir = useIr();
  const anotar = useAnotar();
  const { c, estilo, oscuro } = useTema();
  const hoy = aFecha(d.hoy);
  const clave = d.hoy.slice(0, 7);
  const delMesActual = delMes(d.movimientos, clave);
  const ingresos = sumar(delMesActual, 'ingreso');
  const gastos = sumar(delMesActual, 'gasto');
  const dias = gastoPorDia(d.movimientos, hoy.getFullYear(), hoy.getMonth() + 1);
  const maximo = Math.max(1, ...dias);
  const t = topes(d, clave);
  const semana = proximosEn(d, 7);
  const semanaTotal = semana.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const ultimo = [...delMesActual].sort(ordenarPorFecha)[0];
  const porCat = d.categorias.filter((x) => x.tipo === 'gasto')
    .map((x) => ({ x, total: delMesActual.reduce((s, m) => s + (m.tipo === 'gasto' && m.categoria_id === x.id ? m.monto : 0), 0) }))
    .filter((y) => y.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
  const bloques = estilo.bloques!;
  const color = (b: Bloque) => (oscuro ? mezclar(c.tarjeta, bloques[b].base, 0.24) : bloques[b].claro);
  const tintaDe = (b: Bloque) => (oscuro ? c.tenue : mezclar(bloques[b].base, '#000000', 0.62));
  const cuentasVisibles = d.cuentas.length > 3 ? d.cuentas.slice(0, 2) : d.cuentas;
  const sobreHeroe = mezclar(c.heroe, '#FFFFFF', 0.7);

  const cabecera = (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Texto tam={estilo.m.titulo} peso="extra" style={{ letterSpacing: -0.8 }}>{mayuscula(MESES[hoy.getMonth()])}</Texto>
        <Texto tam={15} color={c.tenue}>{DIAS[hoy.getDay()]} {hoy.getDate()}</Texto>
      </View>
      <BotonRedondo icono="ajustes" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
    </View>
  );

  return (
    <Marco cabecera={cabecera} gap={10} pie={<PildoraAnotar onPress={() => anotar()} />}>
      <Tutorial />
      <Pressable onPress={() => ir('graficos')} accessibilityLabel="Ver los gráficos del mes"
        style={({ pressed }) => ({ height: 150, borderRadius: estilo.m.esquinas, backgroundColor: c.heroe, paddingVertical: 16, paddingHorizontal: 18,
          justifyContent: 'space-between', opacity: pressed ? 0.9 : 1, marginTop: 4 })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Texto tam={13} color={sobreHeroe}>Te queda este mes</Texto>
            <Num tam={estilo.m.cifra} color="#FFFFFF">{neto(ingresos - gastos, d.moneda)}</Num>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Num tam={12.5} peso="medio" color="#9FE5C4">+{neto(ingresos, d.moneda)}</Num>
            <Num tam={12.5} peso="medio" color="#FFB4A8">−{neto(gastos, d.moneda)}</Num>
          </View>
        </View>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
          {dias.map((v, i) => {
            const dia = i + 1;
            const futuro = dia > hoy.getDate();
            return (
              <View key={dia} style={{ flex: 1, borderRadius: 2, height: futuro || v === 0 ? 3 : Math.max(3, Math.round((v / maximo) * 56)),
                backgroundColor: futuro ? 'rgba(255,255,255,0.16)' : dia === hoy.getDate() ? '#FFFFFF' : v === 0 ? 'rgba(255,255,255,0.3)' : mezclar(c.acento, '#FFFFFF', 0.3) }} />
            );
          })}
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mosaiquito color={color('lavanda')} alto={150} onPress={() => ir('presupuesto')} etiqueta="Presupuesto">
          <Texto tam={15} peso="negrita">Presupuesto</Texto>
          {t.tope > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Anillo pct={(t.gastado / t.tope) * 100} color={t.gastado > t.tope ? c.alerta : c.acento} fondo={oscuro ? c.suave : 'rgba(255,255,255,0.7)'} />
              <View>
                <Num tam={24} peso="extra">{Math.round((t.gastado / t.tope) * 100)}%</Num>
                <Texto tam={12} color={tintaDe('lavanda')}>de {dineroCorto(t.tope, d.moneda)}</Texto>
              </View>
            </View>
          ) : <Texto tam={13} color={tintaDe('lavanda')}>Sin topes todavía. Toca para ponerlos.</Texto>}
        </Mosaiquito>
        <Mosaiquito color={color('durazno')} alto={150} onPress={() => ir('proximos')} etiqueta="Próximos">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Texto tam={15} peso="negrita">Próximos</Texto>
            <Texto tam={12} color={tintaDe('durazno')}>7 días</Texto>
          </View>
          <Num tam={24} peso="extra">{dineroCorto(semanaTotal, d.moneda)}</Num>
          <View style={{ gap: 3 }}>
            {semana.length === 0 ? <Texto tam={12.5} color={tintaDe('durazno')}>Nada esta semana</Texto>
              : semana.slice(0, 2).map((p) => (
                <Texto key={`${p.recurrencia_id}@${p.fecha}`} tam={12.5} color={tintaDe('durazno')} lineas={1}>
                  {p.nota || d.categorias.find((x) => x.id === p.categoria_id)?.nombre || 'Transferencia'} · {diaCorto(p.fecha)}
                </Texto>
              ))}
          </View>
        </Mosaiquito>
      </View>

      <Pressable onPress={() => ir('cuentas')} accessibilityLabel="Cuentas"
        style={({ pressed }) => ({ height: 88, borderRadius: estilo.m.esquinas, backgroundColor: color('cielo'), paddingVertical: 14, paddingHorizontal: 16,
          flexDirection: 'row', gap: 8, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
        {cuentasVisibles.map((x) => (
          <View key={x.id} style={{ flex: 1, gap: 4 }}>
            <Texto tam={12.5} color={tintaDe('cielo')} lineas={1}>{x.nombre}</Texto>
            <Num tam={17} peso="negrita" lineas={1}>{neto(saldo(x, d.movimientos), d.moneda)}</Num>
          </View>
        ))}
        {d.cuentas.length > 3 && (
          <View style={{ flex: 1, gap: 4 }}>
            <Texto tam={12.5} color={tintaDe('cielo')}>y {d.cuentas.length - 2} más</Texto>
            <Icono nombre="adelante" tam={18} color={c.tinta} grosor={2} />
          </View>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mosaiquito color={color('menta')} alto={132} onPress={() => ir('graficos')} etiqueta="Gráficos">
          <Texto tam={15} peso="negrita">Gráficos</Texto>
          <View style={{ gap: 6 }}>
            {porCat.length === 0 ? <Texto tam={12} color={tintaDe('menta')}>Sin gastos este mes</Texto> : porCat.map(({ x, total }) => (
              <View key={x.id} style={{ gap: 2 }}>
                <Texto tam={11.5} color={tintaDe('menta')} lineas={1}>{x.nombre} {Math.round((total / gastos) * 100)}%</Texto>
                <View style={{ height: 6, width: `${Math.max(8, (total / porCat[0].total) * 100)}%`, borderRadius: 3, backgroundColor: oscuro ? bloques.menta.base : mezclar(bloques.menta.base, '#000000', 0.35) }} />
              </View>
            ))}
          </View>
        </Mosaiquito>
        <Mosaiquito color={color('limon')} alto={132} onPress={() => ir('movimientos')} etiqueta="Movimientos">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto tam={15} peso="negrita">Movimientos</Texto>
            <Icono nombre="buscar" tam={18} color={c.tinta} />
          </View>
          <View style={{ gap: 2 }}>
            <Num tam={24} peso="extra">{delMesActual.length}</Num>
            <Texto tam={12} color={tintaDe('limon')}>anotados este mes</Texto>
          </View>
          <Texto tam={12.5} color={tintaDe('limon')} lineas={1}>
            {ultimo ? <>Último: {ultimo.nota || d.categorias.find((x) => x.id === ultimo.categoria_id)?.nombre || 'Transferencia'} <Texto num tam={12.5} color={tintaDe('limon')}>{conSigno(ultimo.monto, d.moneda, ultimo.tipo)}</Texto></> : 'Nada todavía'}
          </Texto>
        </Mosaiquito>
      </View>
    </Marco>
  );
}
