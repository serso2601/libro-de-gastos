// Los pedidos al servidor. La web entra con una cookie (POST /web/entrar con el token) y en cada
// escritura manda `x-app-web: 1`, que es lo que el servidor le pide a la cookie para dejar escribir.

import type { Datos } from './tipos';

export class SinEntrar extends Error {}
export class SinConexion extends Error {}
export class Rechazado extends Error {}

async function pedir(metodo: string, ruta: string, cuerpo?: unknown): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: { 'x-app-web': '1', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new SinConexion('Sin conexión con la PC');
  }
  if (r.status === 401) throw new SinEntrar('Hay que entrar con el token');
  if (r.status >= 500) throw new SinConexion(`El servidor respondió ${r.status}`);
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const detalle = (datos as { detail?: unknown } | null)?.detail;
    throw new Rechazado(typeof detalle === 'string' ? detalle : `Error ${r.status}`);
  }
  return datos;
}

export const api = {
  datos: () => pedir('GET', '/api/datos') as Promise<Datos>,
  enviar: (metodo: string, ruta: string, cuerpo?: unknown) => pedir(metodo, ruta, cuerpo),
  entrar: (token: string) => pedir('POST', '/web/entrar', { token }),
  salir: () => pedir('POST', '/web/salir'),
  importar: (json: unknown, simular: boolean) => pedir('POST', `/api/importar${simular ? '?simular=true' : ''}`, json),
};
