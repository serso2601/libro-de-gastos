// El estilo de la app: una sola familia de letra (Onest, también en los montos, con cifras de ancho
// fijo), las medidas y los colores en claro y oscuro. Las pantallas leen de aquí con useTema() y
// todas usan las mismas medidas.

import { Platform } from 'react-native';

/** En la web (el iPad) la app va en una columna del ancho de un teléfono, al centro: está hecha para eso. */
export const COLUMNA_WEB = Platform.OS === 'web' ? { width: '100%', maxWidth: 520, alignSelf: 'center' } as const : null;

export interface Paleta {
  fondo: string;
  tarjeta: string;
  /** Fondo de campos, fichas sin elegir y botones suaves. */
  suave: string;
  linea: string;
  tinta: string;
  tenue: string;
  /** Estados: conectado, todo bien. */
  bien: string;
  /** Estados: te pasaste, error, borrar. */
  alerta: string;
  acento: string;
  /** Todo lo que es ingreso (montos, barras, días del calendario). */
  ingreso: string;
  /** Todo lo que es gasto. */
  gasto: string;
}

export type Peso = 'normal' | 'medio' | 'semi' | 'negrita';

export interface Estilo {
  /** La familia de cada peso. */
  fuentes: Record<Peso, string>;
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
}

export const ESTILO: Estilo = {
  fuentes: { normal: 'Onest_400Regular', medio: 'Onest_500Medium', semi: 'Onest_600SemiBold', negrita: 'Onest_700Bold' },
  m: { margen: 18, esquinas: 20, titulo: 30, pesoTitulo: 'negrita', cifra: 38, cifraBloque: 22, pesoCifra: 'medio', pesoCifraGrande: 'semi' },
  claro: {
    fondo: '#ECEEF2', tarjeta: '#FFFFFF', suave: '#F1F3F6', linea: '#ECEEF2', tinta: '#121417', tenue: '#5B6270',
    bien: '#0F6E50', alerta: '#B4361F', acento: '#2346C8', ingreso: '#0F7A55', gasto: '#C0392B',
  },
  oscuro: {
    fondo: '#0E1013', tarjeta: '#1A1D22', suave: '#24282E', linea: '#262A30', tinta: '#F2F3F5', tenue: '#9AA1AD',
    bien: '#3CC08E', alerta: '#F07A62', acento: '#7590FF', ingreso: '#3CC08E', gasto: '#F07A62',
  },
};

/** Colores para elegir como principal. El primero es el predeterminado. */
export const ACENTOS = ['#2346C8', '#5B47D6', '#C2410C', '#0F7A55', '#B4366E', '#0E7490', '#B45309', '#15181D'];

/** Colores para cuentas y categorías: se leen bien en claro y en oscuro. */
export const PALETA = ['#2346C8', '#0F6E50', '#1C1C21', '#C2410C', '#5B47D6', '#B4366E', '#0E7490', '#B45309', '#2E8B6A', '#8A6BBF', '#E0782F', '#94A3B8'];
