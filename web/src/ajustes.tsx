import { useRef, useState, type ReactNode } from 'react';
import { useAbrir } from './abrir';
import { useAcciones } from './acciones';
import { api } from './api';
import { useAlmacen, useDatos } from './datos';
import { dinero, etiquetaCorta, hoyISO } from './formato';
import { FRECUENCIAS, type TipoCategoria } from './tipos';
import { C, Icono, estiloCampo } from './ui';

function Seccion({ titulo, accion, children }: { titulo: string; accion?: { texto: string; onClick: () => void }; children: ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: C.tarjeta }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide" style={{ color: C.tenue }}>{titulo}</p>
        {accion && <button onClick={accion.onClick} className="text-xs font-medium" style={{ color: C.acento }}>{accion.texto}</button>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Fila({ punto, emoji, texto, detalle, alEditar, alSubir, alBajar }: {
  punto?: string; emoji?: string; texto: string; detalle?: string; alEditar: () => void; alSubir?: () => void; alBajar?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: `1px solid ${C.linea}` }}>
      {punto && <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: 999, background: punto }} />}
      {emoji && <span className="text-base shrink-0">{emoji}</span>}
      <button onClick={alEditar} className="flex-1 min-w-0 text-left">
        <span className="block text-sm truncate" style={{ color: C.tinta }}>{texto}</span>
        {detalle && <span className="block text-xs truncate" style={{ color: C.tenue }}>{detalle}</span>}
      </button>
      {(alSubir !== undefined || alBajar !== undefined) && (
        <div className="flex items-center shrink-0">
          <button onClick={alSubir} disabled={!alSubir} className="p-1" style={{ opacity: alSubir ? 1 : 0.25 }} aria-label="Subir"><Icono nombre="arriba" tam={15} style={{ color: C.tenue }} /></button>
          <button onClick={alBajar} disabled={!alBajar} className="p-1" style={{ opacity: alBajar ? 1 : 0.25 }} aria-label="Bajar"><Icono nombre="abajo" tam={15} style={{ color: C.tenue }} /></button>
        </div>
      )}
      <button onClick={alEditar} className="p-1" aria-label="Editar"><Icono nombre="lapiz" tam={14} /></button>
    </div>
  );
}

function mover(ids: string[], i: number, delta: number): string[] {
  const copia = [...ids];
  [copia[i], copia[i + delta]] = [copia[i + delta], copia[i]];
  return copia;
}

/** Trae el respaldo .json de la app vieja: primero muestra qué va a pasar, después importa. */
function Importar() {
  const { recargar } = useAlmacen();
  const { movimientos } = useDatos();
  const entrada = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState<unknown>(null);
  const [vista, setVista] = useState<Record<string, number | string> | null>(null);
  const [mensaje, setMensaje] = useState('');

  async function elegir(archivo: File | undefined) {
    setMensaje('');
    setVista(null);
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      setJson(datos);
      setVista((await api.importar(datos, true)) as Record<string, number>);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
    }
  }

  async function confirmar() {
    try {
      await api.importar(json, false);
      setMensaje('Listo: tus datos ya están en la PC.');
      setVista(null);
      await recargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
    }
  }

  if (movimientos.length > 0 && !vista && !mensaje) return null;
  return (
    <Seccion titulo="Traer datos de la app vieja">
      <p className="text-xs" style={{ color: C.tenue }}>
        En la app vieja: Configuración → Exportar mis datos. Después elige aquí ese archivo .json. Primero te muestro qué va a entrar.
      </p>
      <input ref={entrada} type="file" accept="application/json,.json" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      <button onClick={() => entrada.current?.click()} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: C.acento, color: '#fff' }}>Elegir archivo</button>
      {vista && (
        <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: C.tarjetaAlt, color: C.tinta }}>
          <p>{vista.movimientos} movimientos · {vista.cuentas} cuentas · {vista.categorias} categorías</p>
          <p>{vista.recurrencias} recurrencias ({vista.recurrencias_abiertas} siguen activas)</p>
          {Number(vista.futuras_descartadas) > 0 && (
            <p style={{ color: C.tenue }}>{vista.futuras_descartadas} movimientos futuros que la app vieja había creado por adelantado no se copian: las recurrencias los van a anotar cuando llegue su fecha.</p>
          )}
          <button onClick={confirmar} className="w-full rounded-lg py-2 mt-2 font-medium" style={{ background: C.bien, color: '#062b20' }}>Importar</button>
        </div>
      )}
      {mensaje && <p className="text-xs" style={{ color: C.tenue }}>{mensaje}</p>}
    </Seccion>
  );
}

async function exportar(): Promise<string> {
  const r = await fetch('/api/exportar', { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  const texto = await r.text();
  const archivo = new File([texto], `gastos-${hoyISO()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: archivo.name });
      return 'Listo.';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'Cancelado.';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo);
  a.download = archivo.name;
  a.click();
  return 'Descargado.';
}

export function Ajustes({ alCerrar }: { alCerrar: () => void }) {
  const d = useDatos();
  const abrir = useAbrir();
  const acciones = useAcciones();
  const [moneda, setMoneda] = useState(d.moneda);
  const [aviso, setAviso] = useState('');

  const categoriasDe = (tipo: TipoCategoria) => d.categorias.filter((c) => c.tipo === tipo);
  const reordenarCategorias = (tipo: TipoCategoria, ids: string[]) => {
    const otras = d.categorias.filter((c) => c.tipo !== tipo).map((c) => c.id);
    acciones.ordenar('categorias', tipo === 'gasto' ? [...ids, ...otras] : [...otras, ...ids]);
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-10" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between mb-5">
        <button onClick={alCerrar} className="flex items-center gap-1 text-sm" style={{ color: C.tenue }}><Icono nombre="izq" tam={16} /> Volver</button>
        <h2 className="font-display text-lg" style={{ color: C.tinta }}>Ajustes</h2>
        <span style={{ width: 52 }} />
      </div>

      <Importar />

      <Seccion titulo="Se repiten">
        {d.recurrencias.length === 0 && <p className="text-xs" style={{ color: C.tenue }}>Nada se repite todavía. Al anotar un movimiento, elige «Repetir».</p>}
        {d.recurrencias.map((r) => {
          const cat = d.categorias.find((c) => c.id === r.categoria_id);
          const frec = FRECUENCIAS.find(([f]) => f === r.frecuencia)?.[1].toLowerCase();
          const terminada = !!r.fecha_fin && r.fecha_fin < d.hoy;
          const proximo = d.proximos.find((p) => p.recurrencia_id === r.id);
          const detalle = `${dinero(r.monto, d.moneda)} ${frec}` + (terminada ? ' · terminó' : proximo ? ` · próxima ${etiquetaCorta(proximo.fecha)}` : '');
          return <Fila key={r.id} emoji={r.tipo === 'transferencia' ? '⇄' : cat?.emoji ?? '🔁'} texto={r.nota || cat?.nombre || 'Transferencia'} detalle={detalle}
            alEditar={() => abrir.dialogo({ tipo: 'recurrencia', regla: r })} />;
        })}
      </Seccion>

      <Seccion titulo="Cuentas" accion={{ texto: '+ Agregar', onClick: () => abrir.dialogo({ tipo: 'cuenta' }) }}>
        {d.cuentas.map((c, i) => (
          <Fila key={c.id} punto={c.color} texto={c.nombre} alEditar={() => abrir.dialogo({ tipo: 'cuenta', inicial: c })}
            alSubir={i > 0 ? () => acciones.ordenar('cuentas', mover(d.cuentas.map((x) => x.id), i, -1)) : undefined}
            alBajar={i < d.cuentas.length - 1 ? () => acciones.ordenar('cuentas', mover(d.cuentas.map((x) => x.id), i, 1)) : undefined} />
        ))}
      </Seccion>

      {(['gasto', 'ingreso'] as TipoCategoria[]).map((tipo) => {
        const lista = categoriasDe(tipo);
        const ids = lista.map((c) => c.id);
        return (
          <Seccion key={tipo} titulo={tipo === 'gasto' ? 'Categorías de gastos' : 'Categorías de ingresos'}
            accion={{ texto: '+ Agregar', onClick: () => abrir.dialogo({ tipo: 'categoria', tipoInicial: tipo }) }}>
            {lista.map((c, i) => (
              <Fila key={c.id} emoji={c.emoji} texto={c.nombre} alEditar={() => abrir.dialogo({ tipo: 'categoria', inicial: c })}
                alSubir={i > 0 ? () => reordenarCategorias(tipo, mover(ids, i, -1)) : undefined}
                alBajar={i < lista.length - 1 ? () => reordenarCategorias(tipo, mover(ids, i, 1)) : undefined} />
            ))}
          </Seccion>
        );
      })}

      <Seccion titulo="Moneda">
        <div className="flex gap-2">
          <input type="text" maxLength={4} value={moneda} onChange={(e) => setMoneda(e.target.value)} className="flex-1 min-w-0 rounded-xl px-3 py-2 outline-none text-sm" style={estiloCampo} />
          <button onClick={() => acciones.guardarMoneda(moneda.trim() || '$')} className="px-4 rounded-xl text-xs font-medium" style={{ background: C.acento, color: '#fff' }}>Guardar</button>
        </div>
      </Seccion>

      <Seccion titulo="Respaldo">
        <p className="text-xs" style={{ color: C.tenue }}>La PC guarda una copia de la base cada día. Además puedes sacar todo en un .json.</p>
        <button onClick={() => exportar().then(setAviso, (e) => setAviso(String(e)))} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ border: `1px solid ${C.linea}`, color: C.tinta }}>Exportar todo</button>
        {aviso && <p className="text-xs" style={{ color: C.tenue }}>{aviso}</p>}
      </Seccion>

      <button onClick={() => api.salir().finally(() => location.reload())} className="w-full py-3 text-xs" style={{ color: C.tenue }}>Salir de este dispositivo</button>
    </div>
  );
}
