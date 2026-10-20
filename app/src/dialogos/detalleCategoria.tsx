// El detalle de una categoría en el presupuesto: lo gastado, su tope y las compras del mes.
// Editar el tope es una opción de aquí, no lo primero que se ve.

import { View } from 'react-native';
import { delMes, diasQueQuedan, gastadoEn, netoDe, porDia } from '@/lib/calculos';
import { useDatos } from '@/lib/datos';
import { dinero, dineroCorto, MESES, mayuscula, neto, ordenarPorFecha, tituloDia } from '@/lib/formato';
import type { Categoria } from '@/lib/tipos';
import { Barra, BotonSuave, CabeceraDia, Dato, FilaMovimiento, Hoja, Lista, Num, Tarjeta, Texto, Vacio } from '@/ui/componentes';
import { SimboloCategoria } from '@/ui/simbolos';
import { useTema } from '@/ui/tema';
import { useAbrir } from './abrir';

/** El mes anterior de 'YYYY-MM' (diciembre → enero del año antes). */
function mesAnterior(clave: string): string {
  const anio = Number(clave.slice(0, 4));
  const m = Number(clave.slice(5, 7));
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, '0')}`;
}

export function DialogoDetalleCategoria({ categoria, mes, alCerrar, alEditarTope }: {
  categoria: Categoria; /** 'YYYY-MM' del mes que se está mirando en Presupuesto. */ mes: string;
  alCerrar: () => void; alEditarTope: () => void;
}) {
  const d = useDatos();
  const abrir = useAbrir();
  const { c, relleno } = useTema();

  const compras = delMes(d.movimientos, mes).filter((m) => m.tipo === 'gasto' && m.categoria_id === categoria.id).sort(ordenarPorFecha);
  const gastado = gastadoEn(d, categoria.id, mes);
  const anterior = gastadoEn(d, categoria.id, mesAnterior(mes));
  const masGrande = compras.reduce((s, m) => Math.max(s, m.monto), 0);
  const nombreCuenta = (id: string) => d.cuentas.find((x) => x.id === id)?.nombre ?? '?';

  const tope = categoria.presupuesto ?? 0;
  const conTope = tope > 0;
  const pasado = gastado > tope;
  const quedan = tope - gastado;
  const esActual = mes === d.hoy.slice(0, 7);
  const dias = diasQueQuedan(d.hoy);
  const nombreMes = `${mayuscula(MESES[Number(mes.slice(5, 7)) - 1])} ${mes.slice(0, 4)}`;

  // Con una sola hoja a la vez: se cierra esta y la otra se abre cuando ya bajó (como en abrir.tsx).
  const abrirCompra = (inicial: (typeof compras)[number]) => {
    alCerrar();
    setTimeout(() => abrir({ tipo: 'movimiento', inicial }), 600);
  };

  return (
    <Hoja titulo={nombreMes} alCerrar={alCerrar}
      pie={<BotonSuave onPress={alEditarTope}>{conTope ? 'Editar tope' : 'Poner tope'}</BotonSuave>}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SimboloCategoria categoria={categoria} tam={40} />
          <Texto tam={20} peso="semi" lineas={1} style={{ flex: 1 }}>{categoria.nombre}</Texto>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 }}>
            <Texto tam={14} color={c.tenue}>Gastaste</Texto>
            <Num tam={34} color={c.gasto}>{dinero(gastado, d.moneda)}</Num>
            {conTope && <Texto num tam={14} color={c.tenue}>de {dinero(tope, d.moneda)}</Texto>}
          </View>
          {conTope && (
            <>
              <Barra pct={Math.round((gastado / tope) * 100)} color={pasado ? c.alerta : relleno(categoria.color)} alto={10} />
              <Texto num tam={14} peso={pasado ? 'semi' : 'normal'} color={pasado ? c.alerta : c.tenue}>
                {pasado ? `Te pasaste por ${dinero(-quedan, d.moneda)}` : `Te quedan ${dinero(quedan, d.moneda)}`}
              </Texto>
              {esActual && !pasado && quedan > 0 && (
                <Texto num tam={13} color={c.tenue} style={{ lineHeight: 18 }}>
                  {dias === 0 ? 'Hoy es el último día del mes' : `Quedan ${dias} ${dias === 1 ? 'día' : 'días'} · puedes gastar ~${dineroCorto(Math.round(quedan / dias), d.moneda)} por día`}
                </Texto>
              )}
            </>
          )}
        </View>
      </View>

      {compras.length > 0 && (
        <Tarjeta color={c.suave} style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
          <Dato rotulo="Compras" valor={String(compras.length)} />
          <Dato rotulo="La más grande" valor={dineroCorto(masGrande, d.moneda)} />
          <Dato rotulo="Mes anterior" valor={anterior > 0 ? dineroCorto(anterior, d.moneda) : '—'} />
        </Tarjeta>
      )}

      {compras.length === 0 ? (
        <Tarjeta color={c.suave}>
          <Vacio>{anterior > 0 ? `Sin compras en ${categoria.nombre.toLowerCase()} este mes.` : `Todavía no hay compras en ${categoria.nombre.toLowerCase()}.`}</Vacio>
        </Tarjeta>
      ) : (
        porDia(compras).map(([fecha, items]) => (
          <View key={fecha} style={{ gap: 6 }}>
            <CabeceraDia titulo={tituloDia(fecha, d.hoy)} derecha={neto(netoDe(items), d.moneda, true)} />
            <Lista style={{ backgroundColor: c.suave }}>
              {items.map((m, i) => (
                <FilaMovimiento key={m.id} m={m} primera={i === 0} sinIcono detalle={nombreCuenta(m.cuenta_id)} onPress={() => abrirCompra(m)} />
              ))}
            </Lista>
          </View>
        ))
      )}
    </Hoja>
  );
}
