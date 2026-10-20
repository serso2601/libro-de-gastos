// El símbolo de una categoría. `categoria.emoji` guarda un símbolo de la app ('i:<clave>'), un emoji
// cualquiera, o '💰' (el valor de siempre, que quiere decir «sin elegir»: se muestra la inicial).

import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Categoria } from '@/lib/tipos';
import { inicialDe } from '@/lib/formato';
import { Texto } from './componentes';
import { useTema } from './tema';

/** Los símbolos predeterminados: clave → nombre para leerlo (accesibilidad y el elegidor). Van en el orden del elegidor. */
export const SIMBOLOS: Record<string, string> = {
  comida: 'Comida', restaurante: 'Restaurante', cafe: 'Café', super: 'Supermercado',
  casa: 'Casa', mueble: 'Muebles', servicios: 'Servicios', luz: 'Luz', agua: 'Agua', internet: 'Internet', telefono: 'Teléfono',
  transporte: 'Transporte', bus: 'Autobús', auto: 'Auto', gasolina: 'Gasolina', avion: 'Viajes',
  salud: 'Salud', farmacia: 'Farmacia', gimnasio: 'Gimnasio', belleza: 'Belleza',
  compras: 'Compras', ropa: 'Ropa', regalo: 'Regalos', mascota: 'Mascotas', ninos: 'Niños',
  entretenimiento: 'Entretenimiento', juegos: 'Juegos', musica: 'Música', suscripcion: 'Suscripciones',
  educacion: 'Educación', libro: 'Libros',
  sueldo: 'Sueldo', trabajo: 'Trabajo', ahorro: 'Ahorro', inversion: 'Inversiones',
  banco: 'Banco', tarjeta: 'Tarjeta', impuestos: 'Impuestos', otros: 'Otros',
};

/** Palabras con las que puede empezar el nombre de una categoría para sugerir un símbolo. Lo específico va antes. */
const PALABRAS: [string, string[]][] = [
  ['gasolina', ['gasolina', 'combustible', 'diesel']],
  ['bus', ['bus', 'autobus', 'colectivo']],
  ['transporte', ['transporte', 'taxi', 'uber', 'metro', 'pasaje', 'tren']],
  ['auto', ['auto', 'carro', 'coche', 'vehiculo', 'mecanic', 'moto']],
  ['avion', ['viaje', 'vuelo', 'avion', 'vacacion', 'hotel', 'turismo']],
  ['super', ['super', 'mercado', 'abarrot', 'despensa']],
  ['cafe', ['cafe', 'cafeteria']],
  ['restaurante', ['restaurante', 'delivery', 'antojo', 'salidas']],
  ['comida', ['comida', 'alimento', 'almuerzo', 'desayuno']],
  ['luz', ['luz', 'electric']],
  ['agua', ['agua']],
  ['internet', ['internet', 'wifi']],
  ['telefono', ['telefono', 'celular', 'movil', 'recarga']],
  ['mueble', ['mueble', 'decoracion', 'electrodomestico']],
  ['casa', ['casa', 'hogar', 'alquiler', 'renta', 'hipoteca', 'vivienda', 'apartamento']],
  ['servicios', ['servicio', 'recibo', 'factura']],
  ['farmacia', ['farmacia', 'medicina', 'medicamento']],
  ['salud', ['salud', 'medico', 'doctor', 'dentista', 'hospital', 'consulta']],
  ['gimnasio', ['gimnasio', 'gym', 'deporte', 'ejercicio', 'fitness']],
  ['belleza', ['belleza', 'peluquer', 'salon', 'cosmetic', 'estetica', 'barber']],
  ['ropa', ['ropa', 'vestimenta', 'calzado', 'zapato']],
  ['regalo', ['regalo', 'obsequio', 'donacion', 'cumple']],
  ['mascota', ['mascota', 'perro', 'gato', 'veterinari']],
  ['ninos', ['nino', 'hijo', 'bebe', 'guarderia', 'panal', 'juguete']],
  ['libro', ['libro', 'lectura']],
  ['educacion', ['educacion', 'colegio', 'escuela', 'universidad', 'curso', 'matricula', 'estudio']],
  ['juegos', ['juego', 'videojuego', 'gaming']],
  ['musica', ['musica', 'spotify', 'concierto']],
  ['suscripcion', ['suscripcion', 'netflix', 'membresia', 'streaming']],
  ['entretenimiento', ['entretenimiento', 'cine', 'ocio', 'diversion', 'fiesta']],
  ['compras', ['compra', 'tienda', 'shopping']],
  ['ahorro', ['ahorro', 'alcancia', 'fondo']],
  ['inversion', ['inversion', 'bolsa', 'accion', 'cripto']],
  ['impuestos', ['impuesto', 'tax', 'tributo']],
  ['banco', ['banco', 'comision', 'prestamo', 'deuda']],
  ['tarjeta', ['tarjeta']],
  ['sueldo', ['sueldo', 'salario', 'nomina', 'quincena']],
  ['trabajo', ['trabajo', 'freelance', 'negocio', 'honorario', 'extra']],
  ['otros', ['otro', 'vario', 'imprevisto']],
];

/** La clave del símbolo que va con ese nombre de categoría (p. ej. «Gasolina» → 'gasolina'), o null si ninguno. */
export function sugerirSimbolo(nombre: string): string | null {
  const palabras = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  if (!palabras.length) return null;
  for (const [clave, inicios] of PALABRAS) {
    if (palabras.some((p) => inicios.some((k) => p.startsWith(k)))) return clave;
  }
  return null;
}

/** Un símbolo dibujado con líneas (como los íconos de la app, 24×24), del color que se le pase. Sin dibujo para la clave → null. */
export function Simbolo({ clave, tam, color }: { clave: string; tam: number; color: string }) {
  const t = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const dibujo = (() => {
    switch (clave) {
      case 'comida': return <><Path d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" {...t} /><Path d="M9 8.5c-1-1.4 1-2.2 0-4M15 8.5c-1-1.4 1-2.2 0-4" {...t} /></>;
      case 'restaurante': return <><Path d="M5 3v5a2 2 0 0 0 4 0V3M7 3v18" {...t} /><Path d="M17 21V3c-2.2 1.2-3.2 3.5-3.2 6.5 0 1.7 1 2.5 3.2 2.5" {...t} /></>;
      case 'cafe': return <><Path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" {...t} /><Path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5" {...t} /></>;
      case 'super': return <><Path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" {...t} /><Circle cx={9.5} cy={19.5} r={1.3} {...t} /><Circle cx={17} cy={19.5} r={1.3} {...t} /></>;
      case 'casa': return <><Path d="M3.5 10.5 12 3.5l8.5 7" {...t} /><Path d="M5.5 9v10.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V9M10 21v-5.5h4V21" {...t} /></>;
      case 'mueble': return <><Path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" {...t} /><Path d="M3 14a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM6.5 19v2M17.5 19v2" {...t} /></>;
      case 'servicios': return <><Path d="M6 3.5h12V21l-2-1.5-2 1.5-2-1.5L10 21l-2-1.5L6 21z" {...t} /><Path d="M9.5 8h5M9.5 12h5" {...t} /></>;
      case 'luz': return <Path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" {...t} />;
      case 'agua': return <Path d="M12 3.2c3.5 4.2 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 2.5-6.1 6-10.3z" {...t} />;
      case 'internet': return <Path d="M2.5 9.5a14 14 0 0 1 19 0M5.5 13a9.5 9.5 0 0 1 13 0M8.7 16.3a5 5 0 0 1 6.6 0M12 19.8h.01" {...t} />;
      case 'telefono': return <><Rect x={7} y={2.5} width={10} height={19} rx={2.5} {...t} /><Path d="M11 18.5h2" {...t} /></>;
      case 'transporte': return <><Rect x={5} y={3} width={14} height={14} rx={4} {...t} /><Path d="M5 11h14M9 7h6M9 14h.01M15 14h.01M8 21l1.5-4M16 21l-1.5-4" {...t} /></>;
      case 'bus': return <><Rect x={2.5} y={4} width={19} height={13} rx={2.5} {...t} /><Path d="M2.5 10h19M9 4v6M15 4v6M7.5 17v3M16.5 17v3M6 13.5h.01M18 13.5h.01" {...t} /></>;
      case 'auto': return <><Path d="M5 16.5H4a1 1 0 0 1-1-1v-3.8l2.2-5A2 2 0 0 1 7 5.5h10a2 2 0 0 1 1.8 1.2l2.2 5v3.8a1 1 0 0 1-1 1h-1M9.5 16.5h5M3 11.5h18" {...t} /><Circle cx={7.5} cy={17} r={2} {...t} /><Circle cx={16.5} cy={17} r={2} {...t} /></>;
      case 'gasolina': return <><Path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h13M7.5 8h4" {...t} /><Path d="M14 9.5h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8.5l-2.5-3" {...t} /></>;
      case 'avion': return <Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.2L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.1z" {...t} />;
      case 'salud': return <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" {...t} />;
      case 'farmacia': return <><Path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" {...t} /><Path d="m8.5 8.5 7 7" {...t} /></>;
      case 'gimnasio': return <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" {...t} />;
      case 'belleza': return <><Path d="M11 3.5l1.9 5.6 5.6 1.9-5.6 1.9L11 18.5l-1.9-5.6L3.5 11l5.6-1.9z" {...t} /><Path d="M19 16v4M17 18h4" {...t} /></>;
      case 'compras': return <><Path d="M5 8h14l-1 12.5a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9z" {...t} /><Path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" {...t} /></>;
      case 'ropa': return <Path d="M8.5 3.5 3 6.5l2 4.5 2.5-1v10.5h9V10l2.5 1 2-4.5-5.5-3a3.5 3.5 0 0 1-7 0z" {...t} />;
      case 'regalo': return <><Rect x={3.5} y={8} width={17} height={4} rx={1} {...t} /><Path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12M12 8v13" {...t} /><Path d="M12 8H8.5a2.25 2.25 0 1 1 0-4.5C11 3.5 12 8 12 8zM12 8h3.5a2.25 2.25 0 1 0 0-4.5C13 3.5 12 8 12 8z" {...t} /></>;
      case 'mascota': return <><Path d="M12 20c-2.6 0-4.8-1.5-4.8-3.7 0-2.2 2.2-4.3 4.8-4.3s4.8 2.1 4.8 4.3c0 2.2-2.2 3.7-4.8 3.7z" {...t} /><Circle cx={5} cy={11} r={1.6} {...t} /><Circle cx={9} cy={6.5} r={1.6} {...t} /><Circle cx={15} cy={6.5} r={1.6} {...t} /><Circle cx={19} cy={11} r={1.6} {...t} /></>;
      case 'ninos': return <><Circle cx={12} cy={12} r={9} {...t} /><Path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01M12 3c.2 1.6 1.4 2.3 2.6 2" {...t} /></>;
      case 'entretenimiento': return <><Path d="M3 9V7a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7v2a3 3 0 0 0 0 6v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17v-2a3 3 0 0 0 0-6z" {...t} /><Path d="M14 7v1M14 11.5v1M14 16v1" {...t} /></>;
      case 'juegos': return <><Path d="M6 8h12a4 4 0 0 1 4 4.2l-.6 4a2.7 2.7 0 0 1-4.9.8L15 15.5H9L7.5 17a2.7 2.7 0 0 1-4.9-.8l-.6-4A4 4 0 0 1 6 8z" {...t} /><Path d="M7.5 11v3.5M5.75 12.75h3.5M15.5 11.5h.01M18 13.5h.01" {...t} /></>;
      case 'musica': return <><Path d="M9 18V5l11-2v13M9 9l11-2" {...t} /><Circle cx={6} cy={18} r={3} {...t} /><Circle cx={17} cy={16} r={3} {...t} /></>;
      case 'suscripcion': return <Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" {...t} />;
      case 'educacion': return <Path d="M2 9.5 12 5l10 4.5-10 4.5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5V15" {...t} />;
      case 'libro': return <Path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" {...t} />;
      case 'sueldo': return <><Rect x={2.5} y={6} width={19} height={12} rx={2} {...t} /><Circle cx={12} cy={12} r={2.8} {...t} /><Path d="M6 12h.01M18 12h.01" {...t} /></>;
      case 'trabajo': return <><Rect x={3} y={7} width={18} height={13} rx={2.5} {...t} /><Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" {...t} /></>;
      case 'ahorro': return <><Path d="M4 12.5a7.5 5.5 0 1 0 15 0 7.5 5.5 0 1 0-15 0z" {...t} /><Path d="M8 17.5V20M15 17.5V20M19 11l2.5.5v3L19 14.5M8.3 8.2 8 5l3 1.9M16 11h.01M4 11.5H2.5" {...t} /></>;
      case 'inversion': return <Path d="M3 17l6-6 4 4 8-8M15 7h6v6" {...t} />;
      case 'banco': return <Path d="M3 21h18M4.5 18h15M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 8l9-5 9 5z" {...t} />;
      case 'tarjeta': return <><Rect x={3} y={5} width={18} height={14} rx={3} {...t} /><Path d="M3 10h18M7 15h3" {...t} /></>;
      case 'impuestos': return <><Path d="M19 5 5 19" {...t} /><Circle cx={7} cy={7} r={2.2} {...t} /><Circle cx={17} cy={17} r={2.2} {...t} /></>;
      case 'otros': return <><Circle cx={5.5} cy={12} r={1.4} {...t} fill={color} /><Circle cx={12} cy={12} r={1.4} {...t} fill={color} /><Circle cx={18.5} cy={12} r={1.4} {...t} fill={color} /></>;
      default: return null;
    }
  })();
  if (!dibujo) return null;
  return <Svg width={tam} height={tam} viewBox="0 0 24 24" accessibilityLabel={SIMBOLOS[clave]}>{dibujo}</Svg>;
}

export const esSimbolo = (emoji: string) => emoji.startsWith('i:') && emoji.slice(2) in SIMBOLOS;
export const sinElegir = (emoji: string) => !emoji || emoji === '💰' || (emoji.startsWith('i:') && !esSimbolo(emoji));

/** El cuadrito de una categoría: su símbolo o su emoji sobre el pastel de su color; si no, la inicial. */
export function SimboloCategoria({ categoria, tam = 36, redondo = false }: {
  categoria: Pick<Categoria, 'nombre' | 'color' | 'emoji'>; tam?: number; redondo?: boolean;
}) {
  const { pastel } = useTema();
  const fondo = pastel(categoria.color);
  const caja = { width: tam, height: tam, borderRadius: redondo ? tam / 2 : Math.round(tam * 0.28), backgroundColor: fondo, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (esSimbolo(categoria.emoji)) {
    return <View style={caja}><Simbolo clave={categoria.emoji.slice(2)} tam={Math.round(tam * 0.56)} color={categoria.color} /></View>;
  }
  if (!sinElegir(categoria.emoji)) {
    return <View style={caja}><Text style={{ fontSize: Math.round(tam * 0.5) }}>{categoria.emoji}</Text></View>;
  }
  return <View style={caja}><Texto tam={Math.round(tam * 0.4)} peso="semi">{inicialDe(categoria.nombre || '?')}</Texto></View>;
}
