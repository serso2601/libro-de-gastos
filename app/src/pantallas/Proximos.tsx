import { Pressable, View } from 'react-native';
import { useAbrir } from '@/dialogos/abrir';
import { proximosEn } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { aFecha, conSigno, diaCorto, diasHasta, MESES, MESES_CORTOS, neto, nombreDiaCorto } from '@/lib/formato';
import { FRECUENCIAS, type Proximo, type Recurrencia } from '@/lib/tipos';
import { colorTipo, FilaSimple, Lista, Num, Rotulo, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { Icono } from '@/ui/iconos';
import { useTema } from '@/ui/tema';

export function cuandoViene(fecha: string, hoy: string): string {
  const dias = diasHasta(fecha, hoy);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias <= 14) return `en ${dias} días`;
  const d = aFecha(fecha);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** La fecha de un cobro en un cuadrito: «dom 18», con una rayita del color de la cuenta. */
export function FechaCobro({ p }: { p: Pick<Proximo, 'fecha' | 'tipo' | 'cuenta_id'> }) {
  const d = useDatos();
  const { c, colorCuenta } = useTema();
  const barra = colorCuenta(d.cuentas.find((x) => x.id === p.cuenta_id)?.color ?? c.tenue);
  return (
    <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: c.suave, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: barra }} />
      <Texto tam={11} color={c.tenue}>{nombreDiaCorto(p.fecha)}</Texto>
      <Num tam={17} peso="semi">{aFecha(p.fecha).getDate()}</Num>
    </View>
  );
}

export function textoRegla(r: Recurrencia, d: ReturnType<typeof useDatos>): string {
  const frec = FRECUENCIAS.find(([f]) => f === r.frecuencia)?.[1] ?? '';
  const terminada = !!r.fecha_fin && r.fecha_fin <= d.hoy && !d.proximos.some((p) => p.recurrencia_id === r.id);
  const proximo = d.proximos.find((p) => p.recurrencia_id === r.id);
  return frec + (terminada ? ' · terminó' : proximo ? ` · próxima ${diaCorto(proximo.fecha)} ${MESES_CORTOS[aFecha(proximo.fecha).getMonth()]}` : '');
}

/** Lo que viene: va a salir / va a entrar, los próximos 30 días y las reglas. Sin marco: vive dentro de Movimientos. */
export function ContenidoProximos() {
  const d = useDatos();
  const abrir = useAbrir();
  const { c } = useTema();
  const lista = proximosEn(d, 30);
  const sale = lista.reduce((s, p) => s + (p.tipo === 'gasto' ? p.monto : 0), 0);
  const entra = lista.reduce((s, p) => s + (p.tipo === 'ingreso' ? p.monto : 0), 0);
  const nombreCuenta = (id: string) => d.cuentas.find((x) => x.id === id)?.nombre ?? '?';
  const nombreDe = (p: Proximo) => p.nota || d.categorias.find((x) => x.id === p.categoria_id)?.nombre || 'Transferencia';
  const reglas = [...d.recurrencias].sort((a, b) => {
    const pa = d.proximos.find((p) => p.recurrencia_id === a.id)?.fecha ?? '9999';
    const pb = d.proximos.find((p) => p.recurrencia_id === b.id)?.fecha ?? '9999';
    return pa.localeCompare(pb);
  });

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tarjeta style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 2 }}>
          <Texto tam={13} color={c.tenue}>Va a salir</Texto>
          <Num tam={22} color={sale ? c.gasto : undefined} lineas={1}>{sale ? `−${neto(sale, d.moneda)}` : neto(0, d.moneda)}</Num>
        </Tarjeta>
        <Tarjeta style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 2 }}>
          <Texto tam={13} color={c.tenue}>Va a entrar</Texto>
          <Num tam={22} color={entra ? c.ingreso : undefined} lineas={1}>{entra ? `+${neto(entra, d.moneda)}` : neto(0, d.moneda)}</Num>
        </Tarjeta>
      </View>

      <View style={{ gap: 6 }}>
        <Rotulo>En los próximos 30 días</Rotulo>
        <Lista>
          {lista.length === 0 ? <Vacio>Nada programado para estos días.</Vacio> : lista.map((p, i) => {
            const regla = d.recurrencias.find((r) => r.id === p.recurrencia_id);
            return (
              <Pressable key={`${p.recurrencia_id}@${p.fecha}`} disabled={!regla} onPress={() => regla && abrir({ tipo: 'recurrencia', regla })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, borderTopWidth: i ? 1 : 0, borderTopColor: c.linea, opacity: pressed ? 0.6 : 1 })}>
                <FechaCobro p={p} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Texto tam={15} peso="medio" lineas={1}>{nombreDe(p)}</Texto>
                  <Texto tam={13} color={c.tenue} lineas={1}>{nombreCuenta(p.cuenta_id)} · {cuandoViene(p.fecha, d.hoy)}</Texto>
                </View>
                <Num tam={15} color={colorTipo(p.tipo, c)}>{conSigno(p.monto, d.moneda, p.tipo)}</Num>
              </Pressable>
            );
          })}
        </Lista>
      </View>

      <View style={{ gap: 6, marginTop: 6 }}>
        <Rotulo>Las reglas que se repiten</Rotulo>
        <Lista>
          {reglas.length === 0 ? <Vacio>Nada se repite todavía. Al anotar algo, elige «Se repite».</Vacio> : reglas.map((r, i) => (
            <FilaSimple key={r.id} primera={i === 0} onPress={() => abrir({ tipo: 'recurrencia', regla: r })}
              izquierda={<View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.suave, alignItems: 'center', justifyContent: 'center' }}><Icono nombre="repetir" tam={16} color={c.tenue} /></View>}
              texto={r.nota || d.categorias.find((x) => x.id === r.categoria_id)?.nombre || 'Transferencia'} detalle={textoRegla(r, d)}
              derecha={<Num tam={14} color={colorTipo(r.tipo, c)}>{conSigno(r.monto, d.moneda, r.tipo)}</Num>} />
          ))}
        </Lista>
      </View>
    </>
  );
}
