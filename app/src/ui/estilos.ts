// Los cinco estilos de la app. Cada uno tiene su Inicio, su forma de moverse entre pantallas, sus
// fuentes, sus medidas y sus colores (claro y oscuro). Las pantallas son las mismas para todos y
// leen de aquí lo que cambia. Dentro de un estilo todas las pantallas usan las mismas medidas.

export type IdEstilo = 'billetera' | 'mosaico' | 'calendario' | 'cartera' | 'calmosaico';

/** Cómo se llega a las secciones: barra de abajo, barra flotante o bloques del Inicio. */
export type Navegacion = 'barra' | 'flotante' | 'bloques';

/** Qué lleva a la izquierda cada fila de movimiento. */
export type Fila = 'barra' | 'circulo' | 'cuadro' | 'nada';

export interface Paleta {
  fondo: string;
  tarjeta: string;
  /** Fondo de campos, fichas sin elegir y botones suaves. */
  suave: string;
  linea: string;
  tinta: string;
  tenue: string;
  bien: string;
  alerta: string;
  acento: string;
  /** El bloque oscuro de Mosaico. */
  heroe: string;
  /** El borde punteado de lo que se va a cobrar. */
  cobro: string;
}

export interface Fuentes {
  normal: string;
  medio: string;
  semi: string;
  negrita: string;
  extra: string;
  /** Para montos. Sin mono, los montos van en la misma letra con cifras de ancho fijo. */
  mono?: { normal: string; medio: string; semi: string };
}

export interface Estilo {
  id: IdEstilo;
  nombre: string;
  navegacion: Navegacion;
  fila: Fila;
  /** Qué secciones son pestañas (las demás se abren encima, con «‹ volver»). */
  pestanias: Seccion[];
  /** El nombre del Inicio, para el «‹ volver». */
  inicio: string;
  fuentes: Fuentes;
  m: {
    margen: number;
    esquinas: number;
    titulo: number;
    pesoTitulo: Peso;
    cifra: number;
    cifraBloque: number;
    /** Peso de los montos en filas y bloques. */
    pesoCifra: Peso;
    pesoCifraGrande: Peso;
  };
  claro: Paleta;
  oscuro: Paleta;
  /** Los bloques de colores de Mosaico (y los mosaicos de los otros): tono base y su pastel claro. */
  bloques?: Record<'lavanda' | 'durazno' | 'cielo' | 'menta' | 'limon', { claro: string; base: string }>;
}

export type Peso = 'normal' | 'medio' | 'semi' | 'negrita' | 'extra';
export type Seccion = 'movimientos' | 'presupuesto' | 'graficos' | 'cuentas' | 'proximos';

const ONEST: Fuentes = {
  normal: 'Onest_400Regular', medio: 'Onest_500Medium', semi: 'Onest_600SemiBold', negrita: 'Onest_700Bold', extra: 'Onest_700Bold',
};
const JAKARTA: Fuentes = {
  normal: 'PlusJakartaSans_400Regular', medio: 'PlusJakartaSans_500Medium', semi: 'PlusJakartaSans_600SemiBold',
  negrita: 'PlusJakartaSans_700Bold', extra: 'PlusJakartaSans_800ExtraBold',
};
const SCHIBSTED: Fuentes = {
  normal: 'SchibstedGrotesk_400Regular', medio: 'SchibstedGrotesk_500Medium', semi: 'SchibstedGrotesk_600SemiBold',
  negrita: 'SchibstedGrotesk_700Bold', extra: 'SchibstedGrotesk_700Bold',
  mono: { normal: 'JetBrainsMono_400Regular', medio: 'JetBrainsMono_500Medium', semi: 'JetBrainsMono_500Medium' },
};

const BLOQUES_MOSAICO = {
  lavanda: { claro: '#E4DEFF', base: '#7B68E8' },
  durazno: { claro: '#FFE1CC', base: '#F08A4B' },
  cielo: { claro: '#D6E8FF', base: '#5B9BEF' },
  menta: { claro: '#CDEFE0', base: '#3DB386' },
  limon: { claro: '#F5EFB0', base: '#D9C744' },
};

export const ESTILOS: Record<IdEstilo, Estilo> = {
  billetera: {
    id: 'billetera', nombre: 'Billetera', navegacion: 'barra', fila: 'barra', inicio: 'Cuentas',
    pestanias: ['movimientos', 'presupuesto', 'graficos'],
    fuentes: { ...ONEST, mono: { normal: 'RedHatMono_400Regular', medio: 'RedHatMono_500Medium', semi: 'RedHatMono_600SemiBold' } },
    m: { margen: 18, esquinas: 20, titulo: 30, pesoTitulo: 'negrita', cifra: 38, cifraBloque: 22, pesoCifra: 'medio', pesoCifraGrande: 'semi' },
    claro: {
      fondo: '#ECEEF2', tarjeta: '#FFFFFF', suave: '#F1F3F6', linea: '#ECEEF2', tinta: '#121417', tenue: '#5B6270',
      bien: '#0F6E50', alerta: '#B4361F', acento: '#2346C8', heroe: '#1C1C21', cobro: '#B4361F',
    },
    oscuro: {
      fondo: '#0E1013', tarjeta: '#1A1D22', suave: '#24282E', linea: '#262A30', tinta: '#F2F3F5', tenue: '#9AA1AD',
      bien: '#3CC08E', alerta: '#F07A62', acento: '#7590FF', heroe: '#2A2E36', cobro: '#F07A62',
    },
  },
  mosaico: {
    id: 'mosaico', nombre: 'Mosaico', navegacion: 'bloques', fila: 'circulo', inicio: 'Inicio',
    pestanias: [],
    fuentes: JAKARTA,
    m: { margen: 16, esquinas: 24, titulo: 28, pesoTitulo: 'extra', cifra: 36, cifraBloque: 24, pesoCifra: 'extra', pesoCifraGrande: 'extra' },
    claro: {
      fondo: '#F2F3F5', tarjeta: '#FFFFFF', suave: '#F2F3F5', linea: '#EEEFF2', tinta: '#1A1A2E', tenue: '#565A6E',
      bien: '#1F7A57', alerta: '#A3361F', acento: '#5B47D6', heroe: '#1A1A2E', cobro: '#C2552A',
    },
    oscuro: {
      fondo: '#101019', tarjeta: '#1B1B29', suave: '#252536', linea: '#272738', tinta: '#F1F1F7', tenue: '#A0A2B8',
      bien: '#4CC995', alerta: '#F2846C', acento: '#9C8CFF', heroe: '#2C2A4A', cobro: '#F2846C',
    },
    bloques: BLOQUES_MOSAICO,
  },
  calendario: {
    id: 'calendario', nombre: 'Calendario', navegacion: 'flotante', fila: 'cuadro', inicio: 'Calendario',
    pestanias: ['graficos', 'presupuesto', 'cuentas'],
    fuentes: SCHIBSTED,
    m: { margen: 18, esquinas: 20, titulo: 30, pesoTitulo: 'negrita', cifra: 32, cifraBloque: 22, pesoCifra: 'medio', pesoCifraGrande: 'medio' },
    claro: {
      fondo: '#F6F7F9', tarjeta: '#FFFFFF', suave: '#F1F2F4', linea: '#EEF0F2', tinta: '#15181D', tenue: '#5F6670',
      bien: '#0F7A55', alerta: '#B4361F', acento: '#C2410C', heroe: '#15181D', cobro: '#C2410C',
    },
    oscuro: {
      fondo: '#0F1114', tarjeta: '#1B1E23', suave: '#25292F', linea: '#272B31', tinta: '#F2F3F5', tenue: '#9CA2AC',
      bien: '#3CC08E', alerta: '#F07A62', acento: '#F08A5D', heroe: '#2A2E35', cobro: '#F08A5D',
    },
  },
  cartera: {
    id: 'cartera', nombre: 'Cartera en mosaico', navegacion: 'bloques', fila: 'barra', inicio: 'Inicio',
    pestanias: [],
    fuentes: ONEST,
    m: { margen: 20, esquinas: 20, titulo: 28, pesoTitulo: 'semi', cifra: 32, cifraBloque: 22, pesoCifra: 'semi', pesoCifraGrande: 'semi' },
    claro: {
      fondo: '#F1F2F4', tarjeta: '#FFFFFF', suave: '#F1F2F4', linea: '#ECEDF0', tinta: '#16181D', tenue: '#646A75',
      bien: '#16774F', alerta: '#A3361F', acento: '#2D4FC0', heroe: '#16181D', cobro: '#A3361F',
    },
    oscuro: {
      fondo: '#0F1013', tarjeta: '#1A1C21', suave: '#24272D', linea: '#26292F', tinta: '#F2F3F5', tenue: '#9BA1AB',
      bien: '#3CC08E', alerta: '#F07A62', acento: '#7D95F0', heroe: '#2A2D34', cobro: '#F07A62',
    },
  },
  calmosaico: {
    id: 'calmosaico', nombre: 'Calendario en mosaico', navegacion: 'bloques', fila: 'nada', inicio: 'Inicio',
    pestanias: [],
    fuentes: JAKARTA,
    m: { margen: 16, esquinas: 24, titulo: 28, pesoTitulo: 'extra', cifra: 32, cifraBloque: 22, pesoCifra: 'negrita', pesoCifraGrande: 'extra' },
    claro: {
      fondo: '#F4F3F0', tarjeta: '#FFFFFF', suave: '#F4F3F0', linea: '#F0EEE9', tinta: '#1D1B26', tenue: '#67646F',
      bien: '#1C6F4F', alerta: '#A3361F', acento: '#5646D2', heroe: '#1D1B26', cobro: '#B9581A',
    },
    oscuro: {
      fondo: '#121117', tarjeta: '#1D1B24', suave: '#27252F', linea: '#2A2832', tinta: '#F3F2F6', tenue: '#A4A1AD',
      bien: '#4CC995', alerta: '#F2846C', acento: '#A196EC', heroe: '#2B2840', cobro: '#E8925A',
    },
    bloques: BLOQUES_MOSAICO,
  },
};

export const ORDEN_ESTILOS: IdEstilo[] = ['billetera', 'mosaico', 'calendario', 'cartera', 'calmosaico'];

/** Colores para elegir como principal (además del propio de cada estilo). */
export const ACENTOS = ['#2346C8', '#5B47D6', '#C2410C', '#0F7A55', '#B4366E', '#0E7490', '#B45309', '#15181D'];

/** Colores para cuentas y categorías: se leen bien en claro y en oscuro. */
export const PALETA = ['#2346C8', '#0F6E50', '#1C1C21', '#C2410C', '#5B47D6', '#B4366E', '#0E7490', '#B45309', '#2E8B6A', '#8A6BBF', '#E0782F', '#94A3B8'];
