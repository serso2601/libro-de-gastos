// El tema en uso: el estilo elegido, claro u oscuro y el color principal. Se guarda en el teléfono y
// cada pantalla lo lee con useTema(). También recuerda qué tutoriales ya se vieron.

import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { ESTILOS, type Estilo, type IdEstilo, type Paleta } from './estilos';

export type Modo = 'sistema' | 'claro' | 'oscuro';

interface Preferencias {
  estilo: IdEstilo;
  modo: Modo;
  /** null = el color propio del estilo. */
  acento: string | null;
  tutoriales: IdEstilo[];
}

export interface Colores extends Paleta {
  /** El botón principal (Guardar, Anotar): oscuro en claro y claro en oscuro. */
  boton: string;
  sobreBoton: string;
  /** Calor del calendario: 0 = sin gasto, 4 = el día que más gastaste. */
  calor: [string, string, string, string, string];
  /** El acento lavado, para rellenos (vasos, barras de gráficos). */
  acentoSuave: string;
  velo: string;
}

export interface Tema {
  estilo: Estilo;
  c: Colores;
  oscuro: boolean;
  /** Fondo pastel para un color (iniciales de categorías, bloques). */
  pastel: (color: string) => string;
  /** El relleno de un vaso: más color que un pastel lavado, un solo tono. */
  relleno: (color: string) => string;
  /** El color de una cuenta como fondo de tarjeta (se aclara si en oscuro no se ve). */
  colorCuenta: (color: string) => string;
}

const CLAVE = 'gastos:apariencia';
const INICIALES: Preferencias = { estilo: 'billetera', modo: 'sistema', acento: null, tutoriales: [] };

function leer(): Preferencias {
  try {
    const crudo = Storage.getItemSync(CLAVE);
    const p = crudo ? { ...INICIALES, ...(JSON.parse(crudo) as Partial<Preferencias>) } : INICIALES;
    return ESTILOS[p.estilo] ? p : { ...p, estilo: 'billetera' };
  } catch {
    return INICIALES;
  }
}

// --- Colores --------------------------------------------------------------------------------------

function aRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla dos colores: t = 0 es `a`, t = 1 es `b`. */
export function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = aRGB(a);
  const [r2, g2, b2] = aRGB(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Un color con transparencia: '#3B82F6' + 0.15 → '#3B82F626'. */
export function alfa(color: string, opacidad: number): string {
  return color.slice(0, 7) + Math.round(opacidad * 255).toString(16).padStart(2, '0');
}

export function luminancia(hex: string): number {
  const [r, g, b] = aRGB(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto que se lee sobre un fondo: blanco sobre oscuro, tinta sobre claro. */
export function sobre(fondo: string, tinta = '#15181D'): string {
  return luminancia(fondo) > 0.42 ? tinta : '#FFFFFF';
}

export function crearTema(estilo: Estilo, oscuro: boolean, acento: string | null): Tema {
  const base = oscuro ? estilo.oscuro : estilo.claro;
  const acentoFinal = acento ? (oscuro && luminancia(acento) < 0.2 ? mezclar(acento, '#FFFFFF', 0.35) : acento) : base.acento;
  const p: Paleta = { ...base, acento: acentoFinal };
  const pasos = oscuro ? [0.28, 0.48, 0.72, 1] : [0.16, 0.36, 0.66, 1];
  const c: Colores = {
    ...p,
    boton: p.tinta,
    sobreBoton: oscuro ? p.fondo : '#FFFFFF',
    calor: [oscuro ? p.suave : p.tarjeta, ...pasos.map((t) => mezclar(p.tarjeta, acentoFinal, t))] as Colores['calor'],
    acentoSuave: mezclar(p.tarjeta, acentoFinal, oscuro ? 0.45 : 0.32),
    velo: oscuro ? 'rgba(0,0,0,0.6)' : 'rgba(20,22,28,0.38)',
  };
  return {
    estilo,
    c,
    oscuro,
    pastel: (color) => mezclar(oscuro ? p.tarjeta : '#FFFFFF', color, oscuro ? 0.3 : 0.2),
    relleno: (color) => mezclar(oscuro ? p.tarjeta : '#FFFFFF', color, oscuro ? 0.42 : 0.36),
    colorCuenta: (color) => (oscuro && luminancia(color) < 0.03 ? mezclar(color, '#FFFFFF', 0.14) : color),
  };
}

// --- Proveedor ------------------------------------------------------------------------------------

interface Contexto {
  tema: Tema;
  prefs: Preferencias;
  cambiar: (p: Partial<Preferencias>) => void;
  marcarTutorial: (estilo: IdEstilo, visto: boolean) => void;
}

const Ctx = createContext<Contexto | null>(null);

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferencias>(leer);
  const sistema = useColorScheme();

  // Los controles nativos (teclado, calendario, avisos) siguen al modo elegido.
  useEffect(() => {
    Appearance.setColorScheme(prefs.modo === 'sistema' ? 'auto' : prefs.modo === 'claro' ? 'light' : 'dark');
  }, [prefs.modo]);

  const cambiar = useCallback((p: Partial<Preferencias>) => {
    setPrefs((viejas) => {
      const nuevas = { ...viejas, ...p };
      try {
        Storage.setItemSync(CLAVE, JSON.stringify(nuevas));
      } catch {
        /* sin espacio: solo no lo recuerda */
      }
      return nuevas;
    });
  }, []);

  const marcarTutorial = useCallback((estilo: IdEstilo, visto: boolean) => {
    setPrefs((viejas) => {
      const tutoriales = visto ? [...new Set([...viejas.tutoriales, estilo])] : viejas.tutoriales.filter((e) => e !== estilo);
      const nuevas = { ...viejas, tutoriales };
      try {
        Storage.setItemSync(CLAVE, JSON.stringify(nuevas));
      } catch {
        /* nada */
      }
      return nuevas;
    });
  }, []);

  const oscuro = prefs.modo === 'oscuro' || (prefs.modo === 'sistema' && sistema === 'dark');
  const tema = useMemo(() => crearTema(ESTILOS[prefs.estilo], oscuro, prefs.acento), [prefs.estilo, oscuro, prefs.acento]);

  return <Ctx.Provider value={{ tema, prefs, cambiar, marcarTutorial }}>{children}</Ctx.Provider>;
}

function useCtx(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('Fuera de <ProveedorTema>');
  return c;
}

export function useTema(): Tema {
  return useCtx().tema;
}

export function usePreferencias() {
  const { prefs, cambiar, marcarTutorial } = useCtx();
  return { ...prefs, cambiar, marcarTutorial };
}
