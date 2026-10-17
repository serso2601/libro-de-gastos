// Los íconos de línea de los diseños (24×24, trazo redondeado).

import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type NombreIcono =
  | 'mas' | 'ajustes' | 'buscar' | 'calendario' | 'graficos' | 'presupuesto' | 'cuentas' | 'lista'
  | 'atras' | 'adelante' | 'abajo' | 'repetir' | 'reloj' | 'check' | 'libro' | 'qr' | 'exportar'
  | 'cerrar' | 'transferir' | 'arriba';

export function Icono({ nombre, tam = 20, color, grosor = 1.9 }: { nombre: NombreIcono; tam?: number; color: string; grosor?: number }) {
  const t = { stroke: color, strokeWidth: grosor, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={tam} height={tam} viewBox="0 0 24 24">
      {(() => {
        switch (nombre) {
          case 'mas': return <Path d="M12 5v14M5 12h14" {...t} />;
          case 'ajustes': return (
            <>
              <Path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" {...t} />
              <Circle cx={16} cy={6} r={2.2} {...t} /><Circle cx={10} cy={12} r={2.2} {...t} /><Circle cx={18} cy={18} r={2.2} {...t} />
            </>
          );
          case 'buscar': return <><Circle cx={11} cy={11} r={7} {...t} /><Path d="m20 20-3.5-3.5" {...t} /></>;
          case 'calendario': return <><Rect x={3} y={5} width={18} height={16} rx={2} {...t} /><Path d="M3 10h18M8 3v4M16 3v4" {...t} /></>;
          case 'graficos': return <Path d="M5 20V11M12 20V4M19 20v-6" {...t} />;
          case 'presupuesto': return <><Path d="M21 12A9 9 0 1 1 12 3v9z" {...t} /><Path d="M15 3.5A9 9 0 0 1 20.5 9H15z" {...t} /></>;
          case 'cuentas': return <><Rect x={3} y={6} width={18} height={14} rx={3} {...t} /><Path d="M3 10h18M16 15h2" {...t} /></>;
          case 'lista': return <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" {...t} />;
          case 'atras': return <Path d="m15 6-6 6 6 6" {...t} />;
          case 'adelante': return <Path d="m9 6 6 6-6 6" {...t} />;
          case 'abajo': return <Path d="m6 9 6 6 6-6" {...t} />;
          case 'arriba': return <Path d="m6 15 6-6 6 6" {...t} />;
          case 'repetir': return <><Path d="M17 2l4 4-4 4" {...t} /><Path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" {...t} /><Path d="M21 13v2a3 3 0 0 1-3 3H3" {...t} /></>;
          case 'reloj': return <><Circle cx={12} cy={12} r={9} {...t} /><Path d="M12 7.5V12l3 2" {...t} /></>;
          case 'check': return <Path d="m5 12.5 4.5 4.5L19 7.5" {...t} />;
          case 'libro': return <><Path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" {...t} /><Path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" {...t} /><Path d="M9 7.5h6" {...t} /></>;
          case 'qr': return (
            <>
              <Rect x={3} y={3} width={7} height={7} rx={1.5} {...t} /><Rect x={14} y={3} width={7} height={7} rx={1.5} {...t} />
              <Rect x={3} y={14} width={7} height={7} rx={1.5} {...t} /><Path d="M14 14h3v3h-3zM20 14v.01M14 20.5h.01M17.5 20.5H21V17" {...t} />
            </>
          );
          case 'exportar': return <><Path d="M12 3v12M7 8l5-5 5 5" {...t} /><Path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" {...t} /></>;
          case 'cerrar': return <Path d="M6 6l12 12M18 6 6 18" {...t} />;
          case 'transferir': return <Path d="M7 7h12l-3-3M17 17H5l3 3" {...t} />;
        }
      })()}
    </Svg>
  );
}
