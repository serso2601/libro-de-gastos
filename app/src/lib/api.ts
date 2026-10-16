// Los pedidos al servidor de la PC. La dirección (IP de Tailscale y puerto) y el token se guardan
// en el teléfono la primera vez (pantalla Conectar o el QR de la página de estado).

import Storage from 'expo-sqlite/kv-store';
import type { Datos } from './tipos';

export interface Conexion {
  direccion: string; // "100.x.y.z:8766"
  token: string;
}

const CLAVE = 'gastos:conexion';
const ESPERA_MS = 8000;

export class SinConexion extends Error {}
export class TokenMalo extends Error {}
export class Rechazado extends Error {}

export function leerConexion(): Conexion | null {
  try {
    const crudo = Storage.getItemSync(CLAVE);
    return crudo ? (JSON.parse(crudo) as Conexion) : null;
  } catch {
    return null;
  }
}

export function guardarConexion(c: Conexion | null) {
  if (c) Storage.setItemSync(CLAVE, JSON.stringify(c));
  else Storage.removeItemSync(CLAVE);
}

export function base(direccion: string): string {
  const d = direccion.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(d) ? d : `http://${d}`;
}

export async function pedir(con: Conexion, metodo: string, ruta: string, cuerpo?: unknown): Promise<unknown> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  let r: Response;
  try {
    r = await fetch(base(con.direccion) + ruta, {
      method: metodo,
      signal: control.signal,
      headers: {
        Authorization: `Bearer ${con.token}`,
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new SinConexion('No responde la PC');
  } finally {
    clearTimeout(reloj);
  }
  if (r.status === 401) throw new TokenMalo('El token no es el de la PC');
  if (r.status >= 500 || r.status === 403) throw new SinConexion(`La PC respondió ${r.status}`);
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const detalle = (datos as { detail?: unknown } | null)?.detail;
    throw new Rechazado(typeof detalle === 'string' ? detalle : `Error ${r.status}`);
  }
  return datos;
}

export const pedirDatos = (con: Conexion) => pedir(con, 'GET', '/api/datos') as Promise<Datos>;
