// El almacén de la app: la última copia de los datos y una cola de cambios por mandar.
//
// Cada cambio se aplica al instante en pantalla y se anota en la cola (las dos cosas quedan en
// localStorage), y la cola se manda al servidor en orden. Sin conexión, los cambios esperan y se
// mandan solos cuando la PC vuelve a responder. Cuando la cola queda vacía se vuelve a pedir todo:
// la verdad es la del servidor (por ejemplo, los movimientos que crean las recurrencias).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, SinConexion, SinEntrar } from './api';
import type { Datos } from './tipos';

export interface Cambio {
  metodo: 'PUT' | 'DELETE';
  ruta: string;
  cuerpo?: unknown;
  descripcion: string;
}

export type Conexion = 'cargando' | 'ok' | 'sin-conexion' | 'sin-entrar';

interface Almacen {
  datos: Datos | null;
  conexion: Conexion;
  pendientes: number;
  aviso: string | null;
  cerrarAviso: () => void;
  recargar: () => Promise<void>;
  cambiar: (cambio: Cambio, local?: (d: Datos) => Datos) => void;
  entrar: (token: string) => Promise<void>;
}

const CLAVE_DATOS = 'gastos:datos';
const CLAVE_COLA = 'gastos:cola';

function leer<T>(clave: string, siNo: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : siNo;
  } catch {
    return siNo;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin espacio o en privado: la app sigue, solo no recuerda */
  }
}

const Contexto = createContext<Almacen | null>(null);

export function useAlmacen(): Almacen {
  const a = useContext(Contexto);
  if (!a) throw new Error('useAlmacen fuera de <ProveedorDatos>');
  return a;
}

/** Los datos, ya cargados (las pantallas solo se muestran cuando hay datos). */
export function useDatos(): Datos {
  const { datos } = useAlmacen();
  if (!datos) throw new Error('Todavía no hay datos');
  return datos;
}

export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(() => leer<Datos | null>(CLAVE_DATOS, null));
  const [conexion, setConexion] = useState<Conexion>('cargando');
  const [aviso, setAviso] = useState<string | null>(null);
  const cola = useRef<Cambio[]>(leer<Cambio[]>(CLAVE_COLA, []));
  const [pendientes, setPendientes] = useState(cola.current.length);
  const enviando = useRef(false);

  const guardarCola = useCallback(() => {
    escribir(CLAVE_COLA, cola.current);
    setPendientes(cola.current.length);
  }, []);

  const fallo = useCallback((e: unknown) => {
    if (e instanceof SinEntrar) setConexion('sin-entrar');
    else if (e instanceof SinConexion) setConexion('sin-conexion');
    else setAviso(e instanceof Error ? e.message : String(e));
  }, []);

  const pedirTodo = useCallback(async () => {
    const nuevos = await api.datos();
    setDatos(nuevos);
    escribir(CLAVE_DATOS, nuevos);
    setConexion('ok');
  }, []);

  const vaciar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    try {
      while (cola.current.length > 0) {
        const c = cola.current[0];
        try {
          await api.enviar(c.metodo, c.ruta, c.cuerpo);
        } catch (e) {
          if (e instanceof SinConexion || e instanceof SinEntrar) {
            fallo(e);
            return;
          }
          // El servidor lo rechazó (422/409): no tiene sentido reintentarlo. Se avisa y se descarta;
          // al pedir todo de nuevo, la pantalla vuelve a lo que de verdad quedó guardado.
          setAviso(`${c.descripcion}: ${e instanceof Error ? e.message : e}`);
        }
        cola.current = cola.current.slice(1);
        guardarCola();
      }
      await pedirTodo();
    } catch (e) {
      fallo(e);
    } finally {
      enviando.current = false;
    }
  }, [fallo, guardarCola, pedirTodo]);

  const recargar = useCallback(async () => {
    if (cola.current.length > 0) return vaciar();
    try {
      await pedirTodo();
    } catch (e) {
      fallo(e);
    }
  }, [fallo, pedirTodo, vaciar]);

  const cambiar = useCallback(
    (cambio: Cambio, local?: (d: Datos) => Datos) => {
      if (local) {
        setDatos((d) => {
          if (!d) return d;
          const nuevos = local(d);
          escribir(CLAVE_DATOS, nuevos);
          return nuevos;
        });
      }
      cola.current = [...cola.current, cambio];
      guardarCola();
      void vaciar();
    },
    [guardarCola, vaciar],
  );

  const entrar = useCallback(
    async (token: string) => {
      await api.entrar(token);
      await recargar();
    },
    [recargar],
  );

  useEffect(() => {
    // Un enlace con ?t=<token> entra solo (y el token se saca de la dirección).
    const url = new URL(location.href);
    const token = url.searchParams.get('t');
    if (token) {
      url.searchParams.delete('t');
      history.replaceState(null, '', url);
      entrar(token).catch(fallo);
    } else {
      void recargar();
    }
    const alVolver = () => document.visibilityState === 'visible' && void recargar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [entrar, fallo, recargar]);

  // Mientras haya algo sin mandar o la PC no responda, se reintenta cada 20 segundos.
  useEffect(() => {
    if (conexion === 'ok' && pendientes === 0) return;
    if (conexion === 'sin-entrar') return;
    const t = setInterval(() => void recargar(), 20_000);
    return () => clearInterval(t);
  }, [conexion, pendientes, recargar]);

  return (
    <Contexto.Provider
      value={{ datos, conexion, pendientes, aviso, cerrarAviso: () => setAviso(null), recargar, cambiar, entrar }}
    >
      {children}
    </Contexto.Provider>
  );
}
