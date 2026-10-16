import { useState } from 'react';
import { ContextoAbrir, type Dialogo, type Pestania } from './abrir';
import { Ajustes } from './ajustes';
import { useAlmacen } from './datos';
import { DialogoCategoria, DialogoCuenta, DialogoMovimiento, DialogoPresupuesto, DialogoRecurrencia } from './dialogos';
import { Cuentas, Graficos, Movimientos, Presupuesto, Resumen } from './pantallas';
import type { TipoMovimiento } from './tipos';
import { C, Icono } from './ui';

const PESTANIAS: { id: Pestania; texto: string; icono: Parameters<typeof Icono>[0]['nombre'] }[] = [
  { id: 'resumen', texto: 'Resumen', icono: 'inicio' },
  { id: 'cuentas', texto: 'Cuentas', icono: 'cartera' },
  { id: 'presupuesto', texto: 'Presupuesto', icono: 'chanchito' },
  { id: 'movimientos', texto: 'Movimientos', icono: 'lista' },
  { id: 'graficos', texto: 'Gráficos', icono: 'torta' },
];

function Entrar() {
  const { entrar, conexion } = useAlmacen();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.fondo }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: C.tarjeta }}>
        <p className="text-3xl mb-2">📒</p>
        <h1 className="font-display text-xl mb-1" style={{ color: C.tinta }}>Libro de Gastos</h1>
        <p className="text-sm mb-4" style={{ color: C.tenue }}>
          {conexion === 'sin-conexion' ? 'No hay conexión con la PC. Revisa que Tailscale esté activo.' : 'Pega el token de la PC (está en la página de estado del servidor).'}
        </p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" className="w-full rounded-xl px-3 py-2.5 mb-3 outline-none text-sm"
          style={{ border: `1px solid ${C.linea}`, background: C.fondo, color: C.tinta }} />
        {error && <p className="text-xs mb-3" style={{ color: C.alerta }}>{error}</p>}
        <button onClick={() => entrar(token.trim()).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
          className="w-full rounded-xl py-3 text-sm font-medium" style={{ background: C.acento, color: '#fff' }}>Entrar</button>
      </div>
    </div>
  );
}

function Estado() {
  const { conexion, pendientes, aviso, cerrarAviso } = useAlmacen();
  return (
    <>
      {conexion === 'sin-conexion' && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'rgba(245,185,66,0.12)', color: '#F5B942' }}>
          <Icono nombre="nube" tam={14} />
          <span>Sin conexión con la PC.{pendientes > 0 ? ` ${pendientes} ${pendientes === 1 ? 'cambio espera' : 'cambios esperan'} y se mandan solos al volver.` : ' Lo que anotes se guarda aquí y se manda después.'}</span>
        </div>
      )}
      {aviso && (
        <button onClick={cerrarAviso} className="w-full text-left mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(241,101,101,0.14)', color: C.alerta, border: `1px solid ${C.alerta}` }}>
          {aviso} <span style={{ opacity: 0.7 }}>· tocar para cerrar</span>
        </button>
      )}
    </>
  );
}

function HojaRapida({ alCerrar, alElegir }: { alCerrar: () => void; alElegir: (t: TipoMovimiento) => void }) {
  const opciones: [TipoMovimiento, string, string][] = [['gasto', 'Gasto', '➖'], ['ingreso', 'Ingreso', '➕'], ['transferencia', 'Transferencia', '⇄']];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(10,8,5,0.6)' }} onClick={alCerrar}>
      <div className="w-full sm:max-w-md rounded-t-3xl p-5" style={{ background: C.tarjeta, borderTop: `1px solid ${C.lineaFuerte}`, paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg" style={{ color: C.tinta }}>¿Qué quieres anotar?</h2>
          <button onClick={alCerrar}><Icono nombre="x" tam={20} style={{ color: C.tenue }} /></button>
        </div>
        <div className="space-y-2">
          {opciones.map(([id, texto, emoji]) => (
            <button key={id} onClick={() => alElegir(id)} className="w-full flex items-center gap-3 rounded-xl px-4 py-3" style={{ border: `1px solid ${C.linea}` }}>
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-medium" style={{ color: C.tinta }}>{texto}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { datos, conexion } = useAlmacen();
  const [pestania, setPestania] = useState<Pestania>('resumen');
  const [ajustes, setAjustes] = useState(false);
  const [hoja, setHoja] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  if (conexion === 'sin-entrar' || (!datos && conexion === 'sin-conexion')) return <Entrar />;
  if (!datos) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: C.fondo, color: C.tenue }}>Abriendo el libro…</div>;
  }

  const cerrar = () => setDialogo(null);
  const abrir = { dialogo: setDialogo, pestania: (p: Pestania) => { setAjustes(false); setPestania(p); }, ajustes: () => setAjustes(true) };
  const titulo = PESTANIAS.find((p) => p.id === pestania)!.texto;

  return (
    <ContextoAbrir.Provider value={abrir}>
      <div style={{ background: C.fondo, minHeight: '100vh', color: C.tinta }}>
        {ajustes ? <Ajustes alCerrar={() => setAjustes(false)} /> : (
          <>
            <div className="max-w-md mx-auto px-5" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
              <div className="flex items-center justify-between">
                <h1 className="font-display text-xl" style={{ color: C.tinta }}>{titulo}</h1>
                <button onClick={() => setAjustes(true)} className="rounded-full flex items-center justify-center" style={{ background: C.tarjeta, width: 38, height: 38 }} aria-label="Ajustes">
                  <Icono nombre="ajustes" tam={16} />
                </button>
              </div>
            </div>
            <div className="max-w-md mx-auto px-5 pt-4" style={{ paddingBottom: 'calc(130px + env(safe-area-inset-bottom))' }}>
              <Estado />
              {pestania === 'resumen' && <Resumen />}
              {pestania === 'cuentas' && <Cuentas />}
              {pestania === 'presupuesto' && <Presupuesto />}
              {pestania === 'movimientos' && <Movimientos />}
              {pestania === 'graficos' && <Graficos />}
            </div>

            <button onClick={() => setHoja(true)} className="fixed left-1/2 -translate-x-1/2 rounded-full z-30 flex items-center justify-center"
              style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))', width: 56, height: 56, background: C.acento, boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }} aria-label="Anotar">
              <Icono nombre="mas" tam={24} style={{ color: '#fff' }} />
            </button>

            <nav className="fixed bottom-0 left-0 right-0 z-30" style={{ background: C.tarjeta, borderTop: `1px solid ${C.linea}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="max-w-md mx-auto grid grid-cols-5">
                {PESTANIAS.map((p) => {
                  const activa = pestania === p.id;
                  const color = activa ? C.acento : C.tenue;
                  return (
                    <button key={p.id} onClick={() => setPestania(p.id)} className="flex flex-col items-center gap-1 py-2.5">
                      <Icono nombre={p.icono} tam={19} style={{ color }} />
                      <span style={{ fontSize: 10, color, fontWeight: activa ? 600 : 400 }}>{p.texto}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {hoja && <HojaRapida alCerrar={() => setHoja(false)} alElegir={(t) => { setHoja(false); setDialogo({ tipo: 'movimiento', tipoInicial: t }); }} />}
          </>
        )}

        {dialogo?.tipo === 'movimiento' && (
          <DialogoMovimiento key={dialogo.inicial?.id ?? 'nuevo'} inicial={dialogo.inicial} tipoInicial={dialogo.tipoInicial} alCerrar={cerrar}
            alEditarRegla={(regla) => setDialogo({ tipo: 'recurrencia', regla })} />
        )}
        {dialogo?.tipo === 'recurrencia' && <DialogoRecurrencia regla={dialogo.regla} alCerrar={cerrar} />}
        {dialogo?.tipo === 'cuenta' && <DialogoCuenta inicial={dialogo.inicial} alCerrar={cerrar} />}
        {dialogo?.tipo === 'categoria' && <DialogoCategoria inicial={dialogo.inicial} tipoInicial={dialogo.tipoInicial} alCerrar={cerrar} />}
        {dialogo?.tipo === 'presupuesto' && <DialogoPresupuesto categoria={dialogo.categoria} alCerrar={cerrar} />}
      </div>
    </ContextoAbrir.Provider>
  );
}
