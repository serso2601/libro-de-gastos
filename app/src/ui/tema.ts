// El sistema visual: fintech oscuro, tarjetas sólidas sin bordes, verde menta para ingresos, rojo
// para gastos y azul como acento de acción. IBM Plex Sans para el texto, IBM Plex Mono para montos.

export const C = {
  fondo: '#0B0E13',
  tarjeta: '#171B22',
  tarjetaAlt: '#20252E',
  tinta: '#F5F6F7',
  tenue: 'rgba(245,246,247,0.5)',
  linea: 'rgba(245,246,247,0.08)',
  lineaFuerte: 'rgba(245,246,247,0.14)',
  bien: '#34D8A6',
  alerta: '#F16565',
  aviso: '#F5B942',
  acento: '#3B82F6',
  acentoClaro: '#60A5FA',
  blanco: '#FFFFFF',
};

export const PALETA = ['#3DA5F5', '#34D8A6', '#F16565', '#F5B942', '#A78BFA', '#F472B6', '#4ADE80', '#38BDF8', '#FB923C', '#94A3B8'];

export const FUENTES = {
  normal: 'IBMPlexSans_400Regular',
  medio: 'IBMPlexSans_500Medium',
  semi: 'IBMPlexSans_600SemiBold',
  negrita: 'IBMPlexSans_700Bold',
  monoMedio: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
  monoNegrita: 'IBMPlexMono_700Bold',
};

/** Un color con transparencia: '#3B82F6' + 0.15 → '#3B82F626'. */
export function alfa(color: string, opacidad: number): string {
  return color + Math.round(opacidad * 255).toString(16).padStart(2, '0');
}
