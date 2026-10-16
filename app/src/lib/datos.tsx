// El almacén de la app: la última copia de los datos y una cola de cambios por mandar.
//
// Cada cambio se ve al instante en pantalla y se anota en la cola (las dos cosas quedan guardadas
// en el teléfono); la cola se manda a la PC en orden. Sin conexión, los cambios esperan y salen
// solos cuando la PC vuelve a responder. Con la cola vacía se vuelve a pedir todo: la verdad es la
// del servidor (por ejemplo, los movimientos que van creando las recurrencias).

import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { guardarConexion, leerConexion, pedir, pedirDatos, SinConexion, TokenMalo, type Conexion } from './api';
import type { Datos } from './tipos';

export interface Cambio {
  metodo: 'PUT' | 'DELETE' | 'POST';
  ruta: string;
  cuerpo?: unknown;
  descripcion: string;
}

export type Estado = 'cargando' | 'ok' | 'sin-conexion' | 'token-malo';

interface Almacen {
  conexion: Conexion | null;
  datos: Datos | null;
  estado: Estado;
  pendientes: number;
  aviso: string | null;
  cerrarAviso: () => void;
  recargar: () => Promise<void>;
  cambiar: (cambio: Cambio, local?: (d: Datos) => Datos) => void;
  conectar: (c: Conexion) => Promise<void>;
  desconectar: () => void;
  /** Un pedido directo (importar, exportar): no pasa por la cola. */
  pedirYa: (metodo: string, ruta: string, cuerpo?: unknown) => Promise<unknown>;
}

const CLAVE_DATOS = 'gastos:datos';
const CLAVE_COLA = 'gastos:cola';

function leer<T>(clave: string, siNo: T): T {
  try {
    const crudo = Storage.getItemSync(clave);
    return crudo ? (JSON.parse(crudo) as T) : siNo;
  } catch {
    return siNo;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    Storage.setItemSync(clave, JSON.stringify(valor));
  } catch {
    /* sin espacio: la app sigue, solo no recuerda */
  }
}

const Contexto = createContext<Almacen | null>(null);

export function useAlmacen(): Almacen {
  const a = useContext(Contexto);
  if (!a) throw new Error('useAlmacen fuera de <ProveedorDatos>');
  return a;
}

/** Los datos ya cargados (las pantallas solo se muestran cuando los hay). */
export function useDatos(): Datos {
  const { datos } = useAlmacen();
  if (!datos) throw new Error('Todavía no hay datos');
  return datos;
}

export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [conexion, setConexion] = useState<Conexion | null>(leerConexion);
  const [datos, setDatos] = useState<Datos | null>(() => leer<Datos | null>(CLAVE_DATOS, null));
  const [estado, setEstado] = useState<Estado>('cargando');
  const [aviso, setAviso] = useState<string | null>(null);
  const cola = useRef<Cambio[]>(leer<Cambio[]>(CLAVE_COLA, []));
  const [pendientes, setPendientes] = useState(cola.current.length);
  const enviando = useRef(false);
  const conRef = useRef(conexion);
  conRef.current = conexion;

  const guardarCola = useCallback(() => {
    escribir(CLAVE_COLA, cola.current);
    setPendientes(cola.current.length);
  }, []);

  const fallo = useCallback((e: unknown) => {
    if (e instanceof TokenMalo) setEstado('token-malo');
    else if (e instanceof SinConexion) setEstado('sin-conexion');
    else setAviso(e instanceof Error ? e.message : String(e));
  }, []);

  const pedirTodo = useCallback(async () => {
    const con = conRef.current;
    if (!con) return;
    const nuevos = await pedirDatos(con);
    setDatos(nuevos);
    escribir(CLAVE_DATOS, nuevos);
    setEstado('ok');
  }, []);

  const vaciar = useCallback(async () => {
    const con = conRef.current;
    if (enviando.current || !con) return;
    enviando.current = true;
    try {
      while (cola.current.length > 0) {
        const c = cola.current[0];
        try {
          await pedir(con, c.metodo, c.ruta, c.cuerpo);
        } catch (e) {
          if (e instanceof SinConexion || e instanceof TokenMalo) {
            fallo(e);
            return;
          }
          // La PC lo rechazó (422/409): reintentarlo no sirve. Se avisa y se descarta; al pedir todo
          // de nuevo, la pantalla vuelve a lo que de verdad quedó guardado.
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

  const conectar = useCallback(async (c: Conexion) => {
    const nuevos = await pedirDatos(c); // si falla, no se guarda nada
    guardarConexion(c);
    conRef.current = c;
    setConexion(c);
    setDatos(nuevos);
    escribir(CLAVE_DATOS, nuevos);
    setEstado('ok');
  }, []);

  const desconectar = useCallback(() => {
    guardarConexion(null);
    setConexion(null);
  }, []);

  const pedirYa = useCallback(async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const con = conRef.current;
    if (!con) throw new SinConexion('Sin conectar');
    return pedir(con, metodo, ruta, cuerpo);
  }, []);

  // Al abrir la app y cada vez que vuelve al frente, se pide todo.
  useEffect(() => {
    if (!conexion) return;
    void recargar();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void recargar());
    return () => sub.remove();
  }, [conexion, recargar]);

  // Mientras haya algo sin mandar o la PC no responda, se reintenta cada 20 segundos.
  useEffect(() => {
    if (!conexion || estado === 'token-malo' || (estado === 'ok' && pendientes === 0)) return;
    const t = setInterval(() => void recargar(), 20_000);
    return () => clearInterval(t);
  }, [conexion, estado, pendientes, recargar]);

  return (
    <Contexto.Provider
      value={{ conexion, datos, estado, pendientes, aviso, cerrarAviso: () => setAviso(null), recargar, cambiar, conectar, desconectar, pedirYa }}
    >
      {children}
    </Contexto.Provider>
  );
}
