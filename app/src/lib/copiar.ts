// Copiar un texto al portapapeles sin agregar dependencias. En la web: navigator.clipboard (solo existe con https o
// localhost) o, por http como en Tailscale, un campo oculto y `execCommand`. En el teléfono se abre la hoja de
// compartir, que trae «Copiar».

import { Platform, Share } from 'react-native';

/** Devuelve true si quedó copiado; false si hay que copiarlo a mano (el texto también se puede seleccionar en pantalla). */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message: texto });
      return true;
    } catch {
      return false;
    }
  }
  const g = globalThis as unknown as {
    navigator?: { clipboard?: { writeText(t: string): Promise<void> } };
    document?: {
      createElement(t: string): { value: string; style: Record<string, string>; select(): void; setAttribute(k: string, v: string): void };
      body: { appendChild(e: unknown): void; removeChild(e: unknown): void };
      execCommand(c: string): boolean;
    };
  };
  try {
    if (g.navigator?.clipboard) {
      await g.navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue con el respaldo
  }
  try {
    const doc = g.document;
    if (!doc) return false;
    const campo = doc.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    doc.body.appendChild(campo);
    campo.select();
    const ok = doc.execCommand('copy');
    doc.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
